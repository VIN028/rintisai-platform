"use client";

import { useEffect, useState } from "react";
import { BarChart3, CreditCard, DollarSign, Landmark, RefreshCw, Wallet } from "lucide-react";

const formatRp = (value) => `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
const formatUsdMicros = (value, digits = 2) => `$${(Number(value || 0) / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: 6 })}`;
const formatNumber = (value) => Number(value || 0).toLocaleString("id-ID");

export default function AdminFinancePage() {
  const [report, setReport] = useState(null);
  const [days, setDays] = useState(30);
  const [section, setSection] = useState("summary");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchReport = async (windowDays = days) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/finance?days=${windowDays}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load finance report.");
      setReport(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchReport(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  if (loading && !report) return <div className="text-sm text-gray-400">Loading finance report...</div>;

  const totals = report?.totals || {};
  const assumptions = report?.assumptions || {};
  const grossMargin = totals.estimatedPaygGrossMarginUsdMicros || 0;
  const marginPercent = totals.apiUsageRevenueUsdMicros
    ? Math.round((grossMargin / totals.apiUsageRevenueUsdMicros) * 100)
    : 0;
  const sections = [
    { key: "summary", label: "Summary", desc: "Revenue and gross profit" },
    { key: "payg", label: "PAYG", desc: "Credit, liability, margin" },
    { key: "revenue", label: "Revenue", desc: "Completed payment groups" },
    { key: "activity", label: "Activity", desc: "Recent payments and usage" },
  ];

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2"><Landmark size={22} className="text-emerald-300" /> Finance</h1>
          <p className="text-sm text-gray-400 mt-1">Revenue, PAYG liability, upstream cost, and gross margin from payments and API usage.</p>
        </div>
        <div className="flex gap-2">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="glass-input rounded-lg px-3 py-2 text-xs">
            <option value={7} className="bg-slate-900">Last 7 days</option>
            <option value={30} className="bg-slate-900">Last 30 days</option>
            <option value={90} className="bg-slate-900">Last 90 days</option>
            <option value={365} className="bg-slate-900">Last 365 days</option>
          </select>
          <button type="button" onClick={() => fetchReport(days)} className="inline-flex items-center gap-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 px-3 py-2 text-xs text-gray-300 cursor-pointer">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <Stat icon={DollarSign} label="Completed Revenue" value={formatRp(totals.revenueRp)} sub={`${formatNumber(totals.completedPayments)} completed payments`} />
        <Stat icon={CreditCard} label="Subscription Revenue" value={formatRp(totals.subscriptionRevenueRp)} sub="3-day, weekly, and monthly plans" />
        <Stat icon={BarChart3} label="Gross Profit" value={formatRp(totals.grossProfitRp)} sub={`${totals.grossMarginPercent || 0}% gross margin`} tone={(totals.grossProfitRp || 0) >= 0 ? "emerald" : "red"} />
        <Stat icon={Landmark} label="Estimated Upstream Cost" value={formatRp((totals.estimatedWebClaudeUpstreamRp || 0) + (totals.estimatedPaygUpstreamRp || 0))} sub="Claude web + PAYG provider cost" />
      </div>

      <div className="grid lg:grid-cols-[220px_1fr] gap-4 items-start">
        <aside className="rounded-2xl border border-white/5 bg-white/[0.02] p-2 lg:sticky lg:top-6">
          {sections.map((item) => (
            <button key={item.key} type="button" onClick={() => setSection(item.key)} className={`w-full rounded-xl px-3 py-3 text-left transition ${section === item.key ? "bg-emerald-500/10 text-white border border-emerald-500/20" : "text-gray-400 border border-transparent hover:bg-white/[0.04] hover:text-gray-200"}`}>
              <span className="block text-sm font-bold">{item.label}</span>
              <span className="block text-[11px] text-gray-500 mt-0.5">{item.desc}</span>
            </button>
          ))}
        </aside>

        <div className="min-w-0 space-y-4">
      {section === "summary" && (
        <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <h2 className="font-bold text-white mb-1">Finance Summary</h2>
          <p className="text-xs text-gray-500 mb-4">High-level numbers only. Use the left menu for details.</p>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <Metric label="Revenue" value={formatRp(totals.revenueRp)} />
            <Metric label="Gross profit" value={formatRp(totals.grossProfitRp)} />
            <Metric label="Upstream cost" value={formatRp((totals.estimatedWebClaudeUpstreamRp || 0) + (totals.estimatedPaygUpstreamRp || 0))} />
            <Metric label="FX rate" value={`Rp ${Number(assumptions.fxRate || 0).toLocaleString("id-ID")}/USD`} />
          </div>
        </section>
      )}

      {section === "payg" && (
        <>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <Stat icon={Wallet} label="PAYG Balance Liability" value={formatUsdMicros(totals.outstandingUsdMicros)} sub={`${formatRp(totals.outstandingRp)} equivalent · ${formatNumber(totals.activeApiBalanceUsers)} users`} />
          <Stat icon={BarChart3} label="PAYG Gross Margin" value={formatUsdMicros(grossMargin)} sub={`${marginPercent}% est. · upstream ${assumptions.upstreamPercentOfOfficial || 5}% official`} tone={grossMargin >= 0 ? "emerald" : "red"} />
          <Stat icon={CreditCard} label="Web Claude Upstream" value={formatRp(totals.estimatedWebClaudeUpstreamRp)} sub={`${formatUsdMicros(totals.estimatedWebClaudeUpstreamUsdMicros)} · ${assumptions.webClaudeUpstreamPercentOfOfficial || 4.8}% official`} />
          <Stat icon={DollarSign} label="API Top-up Revenue" value={formatRp(totals.apiTopupRevenueRp)} sub={`${formatUsdMicros(totals.apiTopupUsdMicros)} credit issued`} />
        </div>
        <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <h2 className="font-bold text-white mb-1">PAYG Economics</h2>
          <p className="text-xs text-gray-500 mb-4">Usage margin is estimated from ledger charges minus assumed upstream cost.</p>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <Metric label="API top-up received" value={formatRp(totals.apiTopupRevenueRp)} />
            <Metric label="USD credit issued" value={formatUsdMicros(totals.apiTopupUsdMicros)} />
            <Metric label="Usage charged" value={formatUsdMicros(totals.apiUsageRevenueUsdMicros)} />
            <Metric label="Official value" value={formatUsdMicros(totals.apiOfficialUsdMicros)} />
            <Metric label="Estimated upstream cost" value={formatUsdMicros(totals.estimatedUpstreamCostUsdMicros)} />
            <Metric label="PAYG upstream in Rupiah" value={formatRp(totals.estimatedPaygUpstreamRp)} />
            <Metric label="Active FX rate" value={`Rp ${Number(assumptions.fxRate || 0).toLocaleString("id-ID")}/USD`} />
          </div>
        </section>
        </>
      )}

      {section === "revenue" && (
        <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <h2 className="font-bold text-white mb-1">Revenue Breakdown</h2>
          <p className="text-xs text-gray-500 mb-4">Grouped from completed upgrade requests in the selected window.</p>
          <div className="space-y-2">
            {(report?.revenueGroups || []).length === 0 ? <p className="text-xs text-gray-500 py-6 text-center">No completed payments in this window.</p> : report.revenueGroups.map((row) => (
              <div key={row.key} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center rounded-xl border border-white/5 bg-black/10 p-3 text-xs">
                <span className="font-semibold text-white capitalize">{row.key.replaceAll("_", " ")}</span>
                <span className="text-gray-400">{formatNumber(row.count)}x</span>
                <span className="font-mono text-emerald-300">{formatRp(row.revenueRp)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {section === "activity" && (
      <div className="grid lg:grid-cols-2 gap-4">
        <RecentPayments rows={report?.recentPayments || []} />
        <RecentUsage rows={report?.recentPaygUsage || []} />
      </div>
      )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, tone = "indigo" }) {
  const color = tone === "emerald" ? "text-emerald-300" : tone === "red" ? "text-red-300" : "text-indigo-300";
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-gray-500"><Icon size={14} className={color} />{label}</div>
      <p className={`text-xl font-black mt-2 ${color}`}>{value}</p>
      <p className="text-[11px] text-gray-500 mt-1">{sub}</p>
    </div>
  );
}

function Metric({ label, value }) {
  return <div className="rounded-xl border border-white/5 bg-black/10 p-3"><p className="text-[10px] uppercase tracking-wide text-gray-500 font-bold">{label}</p><p className="font-mono text-white mt-1">{value}</p></div>;
}

function RecentPayments({ rows }) {
  return (
    <section className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
      <div className="p-4 border-b border-white/5"><h2 className="font-bold text-white">Recent Completed Payments</h2></div>
      <div className="divide-y divide-white/5">
        {rows.length === 0 ? <p className="p-5 text-xs text-gray-500 text-center">No payments.</p> : rows.map((row) => (
          <div key={row.id} className="p-3 grid grid-cols-[1fr_auto] gap-3 text-xs">
            <div><p className="font-semibold text-white capitalize">{row.plan}{!["topup", "api_topup"].includes(row.plan) ? ` · ${row.billingInterval}` : ""}</p><p className="text-gray-500 mt-0.5">Code {row.uniqueCode} · {new Date(row.createdAt).toLocaleDateString("id-ID")}</p></div>
            <div className="text-right"><p className="font-mono text-emerald-300">{formatRp(row.baseAmountRp)}</p><p className="text-gray-500">paid {formatRp(row.transferAmount)}</p></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecentUsage({ rows }) {
  return (
    <section className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
      <div className="p-4 border-b border-white/5"><h2 className="font-bold text-white">Recent PAYG Usage</h2></div>
      <div className="divide-y divide-white/5">
        {rows.length === 0 ? <p className="p-5 text-xs text-gray-500 text-center">No PAYG usage.</p> : rows.map((row) => (
          <div key={row.id} className="p-3 grid grid-cols-[1fr_auto] gap-3 text-xs">
            <div><p className="font-semibold text-white">{row.model || "unknown"}</p><p className="text-gray-500 mt-0.5">{formatNumber((row.promptTokens || 0) + (row.completionTokens || 0))} tokens · {new Date(row.createdAt).toLocaleDateString("id-ID")}</p></div>
            <div className="text-right"><p className="font-mono text-emerald-300">{formatUsdMicros(row.revenueUsdMicros, 4)}</p><p className="text-gray-500">official {formatUsdMicros(row.officialUsdMicros, 4)}</p></div>
          </div>
        ))}
      </div>
    </section>
  );
}
