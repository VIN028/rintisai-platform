"use client";

import { useEffect, useState } from "react";
import { ArrowUpDown, Search } from "lucide-react";

const formatNumber = (value) => Number(value || 0).toLocaleString("id-ID");

export default function AdminUsagePage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("usageUnits");
  const [desc, setDesc] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/usage")
      .then((r) => r.json())
      .then((data) => { setReport(data); setLoading(false); });
  }, []);

  if (loading) return <div className="text-gray-400 text-sm">Loading usage data...</div>;

  const totals = report?.totals || {};
  const byUser = (report?.byUser || [])
    .filter((u) => !search || (u.email || "").toLowerCase().includes(search.toLowerCase()) || (u.name || "").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const diff = (a[sort] || 0) - (b[sort] || 0);
      return desc ? -diff : diff;
    });

  const recent = report?.recent || [];

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
        <p className="text-sm text-gray-400 mt-1">API key usage per user, sorted by heaviest usage.</p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Stat label="Requests" value={formatNumber(totals.requests)} />
        <Stat label="Input Tokens" value={formatNumber(totals.promptTokens)} />
        <Stat label="Output Tokens" value={formatNumber(totals.completionTokens)} />
        <Stat label="Usage Units" value={formatNumber(totals.usageUnits)} />
      </div>

      <div className="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
        <div className="p-4 border-b border-white/5 flex items-center justify-between gap-4">
          <h2 className="font-bold text-white">Users with API Keys</h2>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
            <input
              placeholder="Search user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="glass-input rounded-lg pl-8 pr-3 py-1.5 text-xs w-48"
            />
          </div>
        </div>

        {byUser.length === 0 ? (
          <div className="p-8 text-sm text-gray-500 text-center">No API key usage data yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="py-2.5 px-4 text-left text-[10px] uppercase font-bold tracking-wider text-gray-500">User</th>
                  <th className="py-2.5 px-4 text-left text-[10px] uppercase font-bold tracking-wider text-gray-500">Plan</th>
                  {sortable("requests", "Requests")}
                  {sortable("promptTokens", "Input")}
                  {sortable("completionTokens", "Output")}
                  {sortable("usageUnits", "Units")}
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
      </div>

      {recent.length > 0 && (
        <div className="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
          <div className="p-4 border-b border-white/5">
            <h2 className="font-bold text-white">Recent Activity</h2>
          </div>
          <div className="divide-y divide-white/5">
            {recent.slice(0, 20).map((row) => (
              <div key={row.id} className="p-3 flex items-center justify-between text-xs hover:bg-white/[0.02]">
                <div className="min-w-0 flex-1">
                  <span className="text-gray-300 truncate">{row.userEmail}</span>
                  <span className="text-gray-600 ml-3">{new Date(row.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="flex items-center gap-4 font-mono text-[11px]">
                  <span className="text-gray-500">{row.model}</span>
                  <span className="text-indigo-400">{formatNumber(row.promptTokens)} in</span>
                  <span className="text-amber-400">{formatNumber(row.completionTokens)} out</span>
                  <span className="text-white font-bold">{formatNumber(row.usageUnits)} u</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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
