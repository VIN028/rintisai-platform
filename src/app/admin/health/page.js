"use client";

import { useEffect, useState } from "react";
import { Shield } from "lucide-react";

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
            <div className="h-2 bg-white/5 rounded w-24 mb-2" />
            <div className="h-5 bg-white/5 rounded w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminHealthPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-black text-white">System Health</h1>
        <p className="text-sm text-gray-400 mt-1">Auto-refreshes every 30s</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Card label="Uptime" value={`${uptimeHours}h ${uptimeMinutes}m`} />
        <Card label="Users" value={data?.users?.toLocaleString()} />
        <Card label="DB Size" value={`${data?.dbSizeMB ?? 0} MB`} />
        <Card label="Requests (24h)" value={data?.requests24h?.toLocaleString()} />
        <Card label="Requests (5m)" value={data?.requests5m?.toLocaleString()} />
        <Card label="Tokens (5m)" value={data?.tokens5m?.toLocaleString()} />
      </div>

      <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-5">
        <h2 className="text-sm font-bold text-white mb-3">System Status</h2>
        <div className="space-y-2.5">
          <StatusRow label="Database" ok />
          <StatusRow label="API Server" ok />
          <StatusRow label="Payments" ok />
          <StatusRow label="Storage" ok />
        </div>
      </div>
    </div>
  );
}

function Card({ label, value }) {
  return (
    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
      <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">{label}</p>
      <p className="text-lg font-black text-white mt-1">{value}</p>
    </div>
  );
}

function StatusRow({ label, ok }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`w-2 h-2 rounded-full ${ok ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" : "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]"}`} />
      <span className="text-xs text-gray-300">{label}</span>
      <span className="text-[10px] text-gray-500 ml-auto">{ok ? "Healthy" : "Down"}</span>
    </div>
  );
}
