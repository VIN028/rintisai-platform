"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Wallet, XCircle } from "lucide-react";

const filters = ["pending", "confirmed", "completed", "rejected", "all"];
const formatUsd = (micros) => `$${(Number(micros || 0) / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
const formatRp = (value) => `Rp ${Number(value || 0).toLocaleString("id-ID")}`;

export default function AdminCashoutsPage() {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/cashouts");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load cash-outs.");
      setRequests(data.requests || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => filter === "all" ? requests : requests.filter((request) => request.status === filter), [requests, filter]);
  const counts = useMemo(() => requests.reduce((acc, request) => ({ ...acc, [request.status]: (acc[request.status] || 0) + 1 }), {}), [requests]);

  const update = async (requestId, status) => {
    setError("");
    try {
      const res = await fetch("/api/admin/cashouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update cash-out.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2"><Wallet size={22} className="text-emerald-300" /> Cash-Out Requests</h1>
          <p className="text-sm text-gray-400 mt-1">Review unused Claude API PAYG balance cash-out requests.</p>
        </div>
        <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 px-3 py-2 text-xs text-gray-300 cursor-pointer"><RefreshCw size={13} /> Refresh</button>
      </div>

      {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

      <div className="flex flex-wrap gap-2">
        {filters.map((item) => (
          <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${filter === item ? "bg-indigo-600 text-white" : "bg-white/[0.04] text-gray-400 hover:text-white"}`}>
            {item}{["pending", "confirmed"].includes(item) && counts[item] ? <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] text-white">{counts[item]}</span> : null}
          </button>
        ))}
      </div>

      {loading ? <div className="text-sm text-gray-400">Loading...</div> : visible.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-8 text-center text-sm text-gray-500">No cash-out requests found.</div>
      ) : (
        <div className="space-y-2">
          {visible.map((request) => (
            <div key={request.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{request.user?.name || request.user?.email || "Unknown user"}</span>
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold capitalize text-amber-300">{request.status}</span>
                  </div>
                  {request.user?.email && request.user?.name && <div className="mt-0.5 truncate font-mono text-[10px] text-gray-500">{request.user.email}</div>}
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-6 gap-2 text-[10px]">
                    <span className="rounded-lg border border-white/5 bg-black/10 px-2 py-1"><span className="block text-gray-500">Amount</span><span className="font-mono text-emerald-300">{formatUsd(request.amountUsdMicros)}</span></span>
                    <span className="rounded-lg border border-white/5 bg-black/10 px-2 py-1"><span className="block text-gray-500">Estimated Rp</span><span className="font-mono text-white">{formatRp(request.amountRp)}</span></span>
                    <span className="rounded-lg border border-white/5 bg-black/10 px-2 py-1"><span className="block text-gray-500">Fee</span><span className="font-mono text-red-300">-{formatRp(request.feeRp)}</span></span>
                    <span className="rounded-lg border border-emerald-500/10 bg-emerald-500/5 px-2 py-1"><span className="block text-gray-500">Net Payout</span><span className="font-mono text-emerald-300">{formatRp(request.payoutAmountRp || Math.max(0, (request.amountRp || 0) - (request.feeRp || 0)))}</span></span>
                    <span className="rounded-lg border border-white/5 bg-black/10 px-2 py-1"><span className="block text-gray-500">Method</span><span className="font-mono text-gray-300 capitalize">{request.payoutMethod}</span></span>
                    <span className="rounded-lg border border-white/5 bg-black/10 px-2 py-1"><span className="block text-gray-500">Balance</span><span className="font-mono text-indigo-300">{formatUsd(request.user?.subscription?.apiCreditBalanceUsdMicros)}</span></span>
                  </div>
                  <div className="mt-2 text-xs text-gray-400">Ref: <span className="font-mono text-gray-300">{request.payoutRef || "-"}</span></div>
                  {request.reason && <div className="mt-1 text-xs text-gray-500">Reason: {request.reason}</div>}
                  {request.adminActionAt && <div className="mt-2 text-[10px] text-gray-500">Last action by <span className="text-gray-300">{request.adminActionBy || "admin"}</span> at {new Date(request.adminActionAt).toLocaleString("id-ID")}</div>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {request.status === "pending" && <button onClick={() => update(request.id, "confirmed")} className="rounded-lg bg-indigo-500/10 px-2 py-1.5 text-[10px] text-indigo-300 hover:bg-indigo-500/20 cursor-pointer">Confirm</button>}
                  {["pending", "confirmed"].includes(request.status) && <button onClick={() => update(request.id, "completed")} className="rounded-lg bg-emerald-600 px-2 py-1.5 text-[10px] text-white hover:bg-emerald-500 cursor-pointer">Complete</button>}
                  {["pending", "confirmed"].includes(request.status) && <button onClick={() => update(request.id, "rejected")} className="rounded-lg px-1.5 py-1.5 text-red-300 hover:bg-red-500/20 cursor-pointer"><XCircle size={14} /></button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
