"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Search, XCircle } from "lucide-react";

const PER_PAGE = 15;

export default function AdminUpgradesPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const fetchUpgrades = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/upgrades")
      .then((r) => r.json())
      .then((data) => { setRequests(data.requests || []); setLoading(false); });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUpgrades();
  }, [fetchUpgrades]);

  const update = async (requestId, status) => {
    setMsg("");
    try {
      const res = await fetch("/api/admin/upgrades", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId, status }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg(status === "completed" ? "Upgrade completed and plan activated." : "Request updated.");
      fetchUpgrades();
    } catch (err) { setMsg("Error: " + err.message); }
  };

  const filtered = requests.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (r.user?.name || "").toLowerCase().includes(s) || (r.user?.email || "").toLowerCase().includes(s) || (r.plan || "").toLowerCase().includes(s) || (r.uniqueCode || "").toLowerCase().includes(s);
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const filters = [
    { key: "pending", label: "Pending" },
    { key: "confirmed", label: "Confirmed" },
    { key: "completed", label: "Completed" },
    { key: "rejected", label: "Rejected" },
    { key: "all", label: "All" },
  ];

  const counts = {
    pending: requests.filter((r) => r.status === "pending").length,
  };

  if (loading) {
    return (
      <div className="max-w-5xl space-y-5 animate-pulse">
        <div className="h-8 bg-white/5 rounded w-48" />
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-24 bg-white/[0.02] border border-white/5 rounded-xl" />)}</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white">Upgrade Requests</h1>
          <p className="text-sm text-gray-400 mt-1">{counts.pending} pending · {filtered.length} shown</p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            placeholder="Search user, plan, code..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="glass-input rounded-lg pl-8 pr-3 py-2 text-xs w-full sm:w-56"
          />
        </div>
      </div>

      {msg && <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-sm text-gray-300">{msg}</div>}

      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => { setFilter(f.key); setPage(1); }}
            className={`text-[11px] px-3 py-1.5 rounded-lg font-medium transition ${
              filter === f.key ? "bg-white/10 text-white" : "bg-white/[0.02] border border-white/5 text-gray-400 hover:text-gray-200"
            }`}
          >
            {f.label}
            {f.key === "pending" && counts.pending > 0 && <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold">{counts.pending}</span>}
          </button>
        ))}
      </div>

      {paged.length === 0 ? (
        <div className="p-8 text-sm text-gray-500 text-center rounded-2xl bg-white/[0.02] border border-white/5">No requests found.</div>
      ) : (
        <>
          <div className="space-y-2">
            {paged.map((req) => (
              <div key={req.id} className="rounded-xl bg-white/[0.02] border border-white/5 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{req.user?.name || req.user?.email}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize ${
                        req.status === "completed" ? "bg-emerald-500/10 text-emerald-300" :
                        req.status === "confirmed" ? "bg-indigo-500/10 text-indigo-300" :
                        req.status === "rejected" ? "bg-red-500/10 text-red-300" :
                        "bg-amber-500/10 text-amber-300"
                      }`}>{req.status}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1 capitalize">
                      {req.plan} plan · {req.paymentMethod}
                      {req.transferAmount ? <span> · Rp {req.transferAmount.toLocaleString("id-ID")}</span> : null}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1">
                      Code: <span className="text-indigo-300 font-mono">{req.uniqueCode}</span>
                      {req.paymentRef ? <span className="ml-3">Ref: {req.paymentRef}</span> : null}
                      <span className="ml-3">{new Date(req.createdAt).toLocaleString("en-US")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a href={`https://wa.me/${req.paymentRef?.replace(/\D/g,"") || ""}`} target="_blank" rel="noopener noreferrer" className="text-[10px] px-2 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 cursor-pointer">WA</a>
                    {req.status === "pending" && (
                      <>
                        <button onClick={() => update(req.id, "confirmed")} className="text-[10px] px-2 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 cursor-pointer">Confirm</button>
                        <button onClick={() => update(req.id, "completed")} className="text-[10px] px-2 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer">Activate</button>
                        <button onClick={() => update(req.id, "rejected")} className="text-[10px] px-1.5 py-1.5 rounded-lg hover:bg-red-500/20 text-red-300 cursor-pointer"><XCircle size={14} /></button>
                      </>
                    )}
                    {req.status === "confirmed" && (
                      <>
                        <button onClick={() => update(req.id, "completed")} className="text-[10px] px-2 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer">Activate</button>
                        <button onClick={() => update(req.id, "rejected")} className="text-[10px] px-1.5 py-1.5 rounded-lg hover:bg-red-500/20 text-red-300 cursor-pointer"><XCircle size={14} /></button>
                      </>
                    )}
                  </div>
                </div>
                {req.paymentProof && (
                  <img src={req.paymentProof} alt="payment proof" className="mt-3 w-24 h-24 rounded-lg object-cover border border-white/10" />
                )}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg bg-white/[0.02] border border-white/5 text-gray-400 hover:text-white disabled:opacity-30 cursor-pointer"
              ><ChevronLeft size={14} /></button>
              {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
                const p = i + Math.max(0, Math.min(page - 5, totalPages - 10));
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p + 1)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition ${page === p + 1 ? "bg-indigo-600 text-white" : "bg-white/[0.02] border border-white/5 text-gray-400 hover:text-white"}`}
                  >{p + 1}</button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || totalPages === 0}
                className="p-1.5 rounded-lg bg-white/[0.02] border border-white/5 text-gray-400 hover:text-white disabled:opacity-30 cursor-pointer"
              ><ChevronRight size={14} /></button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
