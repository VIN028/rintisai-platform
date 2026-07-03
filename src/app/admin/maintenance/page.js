"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Database, RefreshCw, Trash2 } from "lucide-react";

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round((bytes / 1024 / 1024) * 100) / 100} MB`;
}

export default function MaintenancePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [usageEmail, setUsageEmail] = useState("");
  const [deleteEmail, setDeleteEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/maintenance");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load maintenance data.");
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => fetchData(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const runAction = async (payload) => {
    setBusy(true);
    setMsg("");
    setError("");
    try {
      const res = await fetch("/api/admin/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Maintenance action failed.");
      setMsg(json.message || "Action completed.");
      await fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const counts = data?.counts || {};

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-indigo-400 mb-2">Admin Tools</p>
        <h1 className="text-2xl font-bold text-white">Maintenance</h1>
        <p className="text-sm text-gray-400 mt-1">Safe database operations only. No raw SQL console.</p>
      </div>

      {msg && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-200 px-4 py-3 text-sm">{msg}</div>}
      {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 text-red-200 px-4 py-3 text-sm">{error}</div>}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["Users", counts.users],
          ["Admins", counts.admins],
          ["Subscriptions", counts.subscriptions],
          ["Conversations", counts.conversations],
          ["Messages", counts.messages],
          ["API Keys", counts.apiKeys],
          ["Usage Rows", counts.tokenUsage],
          ["Upgrades", counts.upgradeRequests],
        ].map(([label, value]) => (
          <div key={label} className="glass-panel rounded-2xl border border-white/5 p-4">
            <p className="text-[11px] uppercase tracking-wider text-gray-500">{label}</p>
            <p className="text-2xl font-black text-white mt-1">{loading ? "..." : value ?? 0}</p>
          </div>
        ))}
      </section>

      <section className="grid lg:grid-cols-3 gap-4">
        <div className="glass-panel rounded-2xl border border-white/5 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Database size={18} className="text-indigo-400" />
            <div>
              <h2 className="font-bold text-white">Database</h2>
              <p className="text-xs text-gray-500">SQLite file maintenance</p>
            </div>
          </div>
          <div className="text-sm text-gray-400 space-y-1">
            <p>Size: <span className="text-white">{data?.database?.sizeMB ?? 0} MB</span></p>
            <p className="break-all">Path: <span className="text-gray-300">{data?.database?.path || "-"}</span></p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => runAction({ action: "backup" })} className="px-3 py-2 rounded-lg bg-indigo-500 text-white text-xs font-bold disabled:opacity-50">Create Backup</button>
            <button disabled={busy} onClick={() => runAction({ action: "vacuum" })} className="px-3 py-2 rounded-lg bg-white/5 text-gray-200 text-xs font-bold border border-white/10 disabled:opacity-50">Vacuum</button>
            <button disabled={busy} onClick={fetchData} className="px-3 py-2 rounded-lg bg-white/5 text-gray-200 text-xs font-bold border border-white/10 disabled:opacity-50"><RefreshCw size={13} className="inline mr-1" />Refresh</button>
          </div>
        </div>

        <div className="glass-panel rounded-2xl border border-white/5 p-5 space-y-4">
          <div>
            <h2 className="font-bold text-white">Reset User Usage</h2>
            <p className="text-xs text-gray-500 mt-1">Deletes token usage rows for one user.</p>
          </div>
          <input value={usageEmail} onChange={(e) => setUsageEmail(e.target.value)} placeholder="user@example.com" className="w-full px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-sm text-white outline-none focus:border-indigo-400" />
          <button disabled={busy || !usageEmail} onClick={() => runAction({ action: "resetUsage", email: usageEmail.trim() })} className="px-3 py-2 rounded-lg bg-amber-500 text-black text-xs font-bold disabled:opacity-50">Reset Usage</button>
        </div>

        <div className="glass-panel rounded-2xl border border-red-500/10 bg-red-500/[0.03] p-5 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-red-400 mt-0.5" />
            <div>
              <h2 className="font-bold text-white">Delete User</h2>
              <p className="text-xs text-gray-500 mt-1">Deletes non-admin user and related data. Requires email confirmation.</p>
            </div>
          </div>
          <input value={deleteEmail} onChange={(e) => setDeleteEmail(e.target.value)} placeholder="user@example.com" className="w-full px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-sm text-white outline-none focus:border-red-400" />
          <input value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} placeholder="type same email to confirm" className="w-full px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-sm text-white outline-none focus:border-red-400" />
          <button disabled={busy || !deleteEmail || deleteEmail !== confirmEmail} onClick={() => runAction({ action: "deleteUser", email: deleteEmail.trim(), confirmEmail: confirmEmail.trim() })} className="px-3 py-2 rounded-lg bg-red-500 text-white text-xs font-bold disabled:opacity-50"><Trash2 size={13} className="inline mr-1" />Delete User</button>
        </div>
      </section>

      <section className="glass-panel rounded-2xl border border-white/5 p-5">
        <h2 className="font-bold text-white mb-3">Recent Backups</h2>
        <div className="space-y-2">
          {(data?.backups || []).length === 0 && <p className="text-sm text-gray-500">No backups yet.</p>}
          {(data?.backups || []).map((backup) => (
            <div key={backup.name} className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2 text-sm">
              <span className="text-gray-200">{backup.name}</span>
              <span className="text-gray-500">{formatBytes(backup.size)} · {new Date(backup.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
