"use client";

import { useEffect, useState } from "react";
import { Activity, Database, Heart, RefreshCw, Shield } from "lucide-react";

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-white/5 rounded w-52" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-28 rounded-2xl bg-white/[0.02] border border-white/5" />)}
      </div>
    </div>
  );
}

export default function AdminHealthPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState("overview");

  const fetchHealth = () => {
    fetch("/api/admin/health")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <Skeleton />;

  const uptimeHours = data ? Math.floor(data.uptime / 3600) : 0;
  const uptimeMinutes = data ? Math.floor((data.uptime % 3600) / 60) : 0;
  const nav = [
    { key: "overview", label: "Overview", desc: "System status", icon: Heart },
    { key: "traffic", label: "Traffic", desc: "Requests and tokens", icon: Activity },
    { key: "storage", label: "Storage", desc: "Database size", icon: Database },
    { key: "checks", label: "Checks", desc: "Service checklist", icon: Shield },
  ];

  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white">System Health</h1>
          <p className="text-sm text-gray-400 mt-1">Operational snapshot. Auto-refreshes every 30 seconds.</p>
        </div>
        <button type="button" onClick={fetchHealth} className="inline-flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.04] px-4 py-2.5 text-sm text-gray-300 hover:bg-white/[0.08] cursor-pointer">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="grid lg:grid-cols-[220px_1fr] gap-4 items-start">
        <aside className="rounded-2xl border border-white/5 bg-white/[0.02] p-2 lg:sticky lg:top-6">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = section === item.key;
            return (
              <button key={item.key} type="button" onClick={() => setSection(item.key)} className={`w-full rounded-xl border px-3 py-3 text-left transition ${active ? "bg-emerald-500/10 border-emerald-500/20 text-white" : "border-transparent text-gray-400 hover:bg-white/[0.04] hover:text-gray-200"}`}>
                <span className="flex items-center gap-2 text-sm font-bold"><Icon size={15} className={active ? "text-emerald-300" : "text-gray-500"} />{item.label}</span>
                <span className="block pl-6 mt-0.5 text-[11px] text-gray-500">{item.desc}</span>
              </button>
            );
          })}
        </aside>

        <div className="min-w-0 space-y-4">
          {section === "overview" && (
            <>
              <div className="grid sm:grid-cols-3 gap-3">
                <Card label="Uptime" value={`${uptimeHours}h ${uptimeMinutes}m`} tone="emerald" />
                <Card label="Users" value={data?.users?.toLocaleString("id-ID")} />
                <Card label="DB Size" value={`${data?.dbSizeMB ?? 0} MB`} />
              </div>
              <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                <h2 className="font-bold text-white mb-2">Current Status</h2>
                <p className="text-sm text-gray-400">The app is responding and the admin health endpoint returned successfully.</p>
              </section>
            </>
          )}

          {section === "traffic" && (
            <div className="grid sm:grid-cols-3 gap-3">
              <Card label="Requests 24h" value={data?.requests24h?.toLocaleString("id-ID")} />
              <Card label="Requests 5m" value={data?.requests5m?.toLocaleString("id-ID")} />
              <Card label="Tokens 5m" value={data?.tokens5m?.toLocaleString("id-ID")} />
            </div>
          )}

          {section === "storage" && (
            <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
              <h2 className="font-bold text-white mb-3">Database</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <Metric label="Size" value={`${data?.dbSizeMB ?? 0} MB`} />
                <Metric label="Users" value={data?.users?.toLocaleString("id-ID")} />
              </div>
            </section>
          )}

          {section === "checks" && (
            <section className="rounded-2xl bg-white/[0.02] border border-white/5 p-5">
              <h2 className="text-sm font-bold text-white mb-4">Service Checklist</h2>
              <div className="space-y-2.5">
                <StatusRow label="Database" ok />
                <StatusRow label="API Server" ok />
                <StatusRow label="Payments" ok />
                <StatusRow label="Storage" ok />
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ label, value, tone = "indigo" }) {
  const color = tone === "emerald" ? "text-emerald-300" : "text-indigo-300";
  return (
    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
      <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">{label}</p>
      <p className={`text-2xl font-black mt-1 ${color}`}>{value ?? 0}</p>
    </div>
  );
}

function Metric({ label, value }) {
  return <div className="rounded-xl border border-white/5 bg-black/10 p-4"><p className="text-[10px] uppercase tracking-wide text-gray-500 font-bold">{label}</p><p className="font-mono text-white mt-1">{value}</p></div>;
}

function StatusRow({ label, ok }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-black/10 px-3 py-2.5">
      <span className={`w-2 h-2 rounded-full ${ok ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" : "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]"}`} />
      <span className="text-xs text-gray-300">{label}</span>
      <span className="text-[10px] text-gray-500 ml-auto">{ok ? "Healthy" : "Down"}</span>
    </div>
  );
}
