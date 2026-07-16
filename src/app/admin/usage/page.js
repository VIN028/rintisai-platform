"use client";

import { useEffect, useState } from "react";
import { ArrowUpDown, BarChart3, ChevronLeft, ChevronRight, Filter, Search } from "lucide-react";

const formatNumber = (value) => Number(value || 0).toLocaleString("id-ID");
const PAGE_SIZE = 8;

export default function AdminUsagePage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("usageUnits");
  const [desc, setDesc] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [days, setDays] = useState("30");
  const [section, setSection] = useState("summary");

  useEffect(() => {
    fetch(`/api/admin/usage?days=${days}`)
      .then((r) => r.json())
      .then((data) => { setReport(data); setLoading(false); });
  }, [days]);

  if (loading) return <div className="text-gray-400 text-sm">Loading usage data...</div>;

  const totals = report?.totals || {};
  const allUsers = report?.byUser || [];
  const availablePlans = ["all", ...Array.from(new Set(allUsers.map((u) => u.plan).filter(Boolean)))];
  const filteredUsers = allUsers
    .filter((u) => planFilter === "all" || u.plan === planFilter)
    .filter((u) => !search || (u.email || "").toLowerCase().includes(search.toLowerCase()) || (u.name || "").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const diff = (a[sort] || 0) - (b[sort] || 0);
      return desc ? -diff : diff;
    });
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const byUser = filteredUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const topUsers = filteredUsers.slice(0, 5);
  const maxTopUsage = Math.max(1, ...topUsers.map((u) => u.usageUnits || 0));
  const totalTokens = (totals.promptTokens || 0) + (totals.completionTokens || 0);
  const inputPercent = totalTokens ? Math.round(((totals.promptTokens || 0) / totalTokens) * 100) : 0;
  const planStats = allUsers.reduce((acc, user) => {
    const key = user.plan || "unknown";
    acc[key] = acc[key] || { plan: key, users: 0, usageUnits: 0 };
    acc[key].users += 1;
    acc[key].usageUnits += user.usageUnits || 0;
    return acc;
  }, {});
  const planRows = Object.values(planStats).sort((a, b) => b.usageUnits - a.usageUnits);
  const maxPlanUsage = Math.max(1, ...planRows.map((row) => row.usageUnits));

  const recent = report?.recent || [];
  const sections = [
    { key: "summary", label: "Summary", desc: "Totals and token mix" },
    { key: "users", label: "Users", desc: `${formatNumber(filteredUsers.length)} matched users` },
    { key: "recent", label: "Recent", desc: `${formatNumber(recent.length)} latest rows` },
  ];

  const sortable = (key, label) => (
    <th
      className="py-2.5 px-3 text-left text-[10px] uppercase font-bold tracking-wider cursor-pointer select-none hover:text-white transition"
      style={{ color: sort === key ? "#a5b4fc" : "#6b7280" }}
      onClick={() => { if (sort === key) setDesc(!desc); else { setSort(key); setDesc(true); } }}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown size={10} />
      </span>
    </th>
  );

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Usage Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">Per-user usage across web chat, subscription API keys, and Claude PAYG credit usage.</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl bg-white/[0.02] border border-white/5 p-4">
        <div>
          <h2 className="font-bold text-white text-sm">Usage Window</h2>
          <p className="text-xs text-gray-500 mt-1">Current range: {report?.window || `${days}d`}</p>
        </div>
        <select value={days} onChange={(e) => { setDays(e.target.value); setLoading(true); setPage(1); }} className="glass-input rounded-lg px-3 py-2 text-xs w-full sm:w-44">
          <option value="7" className="bg-slate-900">Last 7 days</option>
          <option value="30" className="bg-slate-900">Last 30 days</option>
          <option value="90" className="bg-slate-900">Last 90 days</option>
          <option value="365" className="bg-slate-900">Last 365 days</option>
          <option value="all" className="bg-slate-900">All time</option>
        </select>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Requests" value={formatNumber(totals.requests)} />
        <Stat label="Raw Input Tokens" value={formatNumber(totals.promptTokens)} />
        <Stat label="Raw Output Tokens" value={formatNumber(totals.completionTokens)} />
        <Stat label="Usage Units" value={formatNumber(totals.usageUnits)} />
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Stat label="Web Chat Requests" value={formatNumber(totals.webRequests)} />
        <Stat label="Subscription API Requests" value={formatNumber(totals.apiRequests)} />
        <Stat label="Claude PAYG Requests" value={formatNumber(totals.paygRequests)} />
      </div>

      <div className="grid lg:grid-cols-[220px_1fr] gap-4 items-start">
        <aside className="rounded-2xl bg-white/[0.02] border border-white/5 p-2 lg:sticky lg:top-6">
          {sections.map((item) => (
            <button key={item.key} type="button" onClick={() => setSection(item.key)} className={`w-full rounded-xl border px-3 py-3 text-left transition ${section === item.key ? "bg-indigo-500/10 border-indigo-500/20 text-white" : "border-transparent text-gray-400 hover:bg-white/[0.04] hover:text-gray-200"}`}>
              <span className="block text-sm font-bold">{item.label}</span>
              <span className="block text-[11px] text-gray-500 mt-0.5">{item.desc}</span>
            </button>
          ))}
        </aside>

        <div className="min-w-0 space-y-4">
      {section === "summary" && (
      <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-4">
        <section className="rounded-2xl bg-white/[0.02] border border-white/5 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-white flex items-center gap-2"><BarChart3 size={16} className="text-indigo-300" /> Top Users</h2>
              <p className="text-xs text-gray-500 mt-1">Highest total usage in the selected view.</p>
            </div>
            <span className="text-[10px] px-2 py-1 rounded-lg bg-white/[0.04] text-gray-400 border border-white/5">{report?.window || `${days}d`}</span>
          </div>
          <div className="space-y-3">
            {topUsers.length === 0 ? <div className="py-8 text-center text-sm text-gray-500">No usage yet.</div> : topUsers.map((user) => (
              <div key={user.userId} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <span className="font-semibold text-white truncate block">{user.name || user.email}</span>
                    <span className="text-[10px] text-gray-500 font-mono truncate block">{user.email}</span>
                  </div>
                  <span className="font-mono text-indigo-200 shrink-0">{formatNumber(user.usageUnits)}</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(3, (user.usageUnits / maxTopUsage) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white/[0.02] border border-white/5 p-4 space-y-5">
          <div>
            <h2 className="font-bold text-white">Token Mix</h2>
            <p className="text-xs text-gray-500 mt-1">Raw provider tokens.</p>
          </div>
          <div>
            <div className="h-3 rounded-full overflow-hidden bg-white/5 flex">
              <div className="bg-indigo-500" style={{ width: `${inputPercent}%` }} />
              <div className="bg-amber-500" style={{ width: `${100 - inputPercent}%` }} />
            </div>
            <div className="flex justify-between mt-2 text-[11px] text-gray-400">
              <span>Input {inputPercent}%</span>
              <span>Output {100 - inputPercent}%</span>
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">By Plan</h3>
            {planRows.length === 0 ? <div className="text-xs text-gray-500">No plan data yet.</div> : planRows.map((row) => (
              <div key={row.plan} className="grid grid-cols-[72px_1fr_auto] items-center gap-2 text-xs">
                <span className="capitalize text-gray-300 truncate">{row.plan}</span>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.max(3, (row.usageUnits / maxPlanUsage) * 100)}%` }} /></div>
                <span className="font-mono text-gray-400">{formatNumber(row.usageUnits)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
      )}

      {section === "users" && (
      <div className="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
        <div className="p-4 border-b border-white/5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-white">Users With API Usage</h2>
            <p className="text-xs text-gray-500 mt-1">{formatNumber(filteredUsers.length)} users matched in {report?.window || `${days}d`}.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
              <input
                placeholder="Search user..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="glass-input rounded-lg pl-8 pr-3 py-1.5 text-xs w-full sm:w-52"
              />
            </div>
            <div className="relative">
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
              <select value={planFilter} onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }} className="glass-input rounded-lg pl-8 pr-8 py-1.5 text-xs w-full sm:w-40 capitalize">
                {availablePlans.map((plan) => <option key={plan} value={plan} className="bg-slate-900">{plan === "all" ? "All plans" : plan}</option>)}
              </select>
            </div>
          </div>
        </div>

        {byUser.length === 0 ? (
          <div className="p-8 text-sm text-gray-500 text-center">No usage data in this interval.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="py-2.5 px-4 text-left text-[10px] uppercase font-bold tracking-wider text-gray-500">User</th>
                  <th className="py-2.5 px-4 text-left text-[10px] uppercase font-bold tracking-wider text-gray-500">Plan</th>
                  {sortable("requests", "Requests")}
                  <th className="py-2.5 px-3 text-left text-[10px] uppercase font-bold tracking-wider text-gray-500">Source</th>
                  {sortable("promptTokens", "Raw Input")}
                  {sortable("completionTokens", "Raw Output")}
                  {sortable("usageUnits", "Usage Units")}
                </tr>
              </thead>
              <tbody>
                {byUser.map((user, i) => {
                  const maxUnit = byUser[0]?.usageUnits || 1;
                  const barWidth = Math.max((user.usageUnits / maxUnit) * 100, 2);
                  return (
                    <tr key={user.userId} className="border-b border-white/5 hover:bg-white/[0.02] relative">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white text-xs truncate max-w-[150px]">{user.name || "Unnamed"}</div>
                        <div className="text-[10px] text-gray-500 font-mono mt-0.5 truncate max-w-[150px]">{user.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 capitalize">{user.plan}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-300">{formatNumber(user.requests)}</td>
                      <td className="py-3 px-3 text-[10px] text-gray-400 whitespace-nowrap">
                        <span className="text-emerald-300">W {formatNumber(user.webRequests)}</span>
                        <span className="mx-1 text-gray-600">/</span>
                        <span className="text-indigo-300">A {formatNumber(user.apiRequests)}</span>
                        <span className="mx-1 text-gray-600">/</span>
                        <span className="text-amber-300">P {formatNumber(user.paygRequests)}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-indigo-300">{formatNumber(user.promptTokens)}</td>
                      <td className="py-3 px-4 font-mono text-amber-300">{formatNumber(user.completionTokens)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 bg-white/5 rounded-full flex-1 min-w-[40px] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-indigo-500 transition-all"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                          <span className="font-mono font-bold text-white">{formatNumber(user.usageUnits)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {filteredUsers.length > PAGE_SIZE && (
          <div className="p-3 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
            <span>Page {currentPage} of {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="p-2 rounded-lg bg-white/[0.04] border border-white/5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/[0.08] cursor-pointer"><ChevronLeft size={14} /></button>
              <button disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="p-2 rounded-lg bg-white/[0.04] border border-white/5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/[0.08] cursor-pointer"><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>
      )}

      {section === "recent" && (
        <div className="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
          <div className="p-4 border-b border-white/5">
            <h2 className="font-bold text-white">Recent Activity</h2>
          </div>
          <div className="divide-y divide-white/5">
            {recent.length === 0 ? <div className="p-8 text-sm text-gray-500 text-center">No recent usage activity.</div> : recent.slice(0, 20).map((row) => (
              <div key={row.id} className="p-3 flex items-center justify-between text-xs hover:bg-white/[0.02]">
                <div className="min-w-0 flex-1">
                  <span className="text-gray-300 truncate">{row.userEmail}</span>
                  <span className="text-gray-600 ml-3">{new Date(row.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="flex items-center gap-4 font-mono text-[11px]">
                  <span className="text-gray-500 uppercase">{row.source}</span>
                  <span className="text-gray-500">{row.model}</span>
                  <span className="text-indigo-400">{formatNumber(row.promptTokens)} raw in</span>
                  <span className="text-amber-400">{formatNumber(row.completionTokens)} raw out</span>
                  <span className="text-white font-bold">{formatNumber(row.usageUnits)} units</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4">
      <p className="text-[10px] uppercase font-bold tracking-wider text-gray-500">{label}</p>
      <p className="text-xl font-black mt-2 text-white">{value}</p>
    </div>
  );
}
