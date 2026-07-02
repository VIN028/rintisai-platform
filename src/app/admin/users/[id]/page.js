"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, KeyRound, Key, Save, Trash2 } from "lucide-react";

const F = (v) => Number(v || 0).toLocaleString("id-ID");

function Skeleton() {
  return <div className="animate-pulse space-y-4"><div className="h-6 bg-white/5 rounded w-48"/><div className="h-4 bg-white/5 rounded w-96"/><div className="h-32 bg-white/5 rounded-xl"/></div>;
}

function Stat({ label, value, sub }) {
  return <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 text-center"><p className="text-[10px] uppercase font-bold tracking-wider text-gray-500">{label}</p><p className="text-lg font-black text-white mt-1">{value}</p>{sub && <p className="text-[10px] text-gray-500 mt-0.5">{sub}</p>}</div>;
}

export default function AdminUserDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({});
  const [keyName, setKeyName] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const fetchData = () => {
    fetch(`/api/admin/users/${id}`).then(r => r.json()).then(d => {
      setData(d);
      if (d.subscription) {
        setDraft({
          plan: d.subscription.plan || "free",
          status: d.subscription.status || "inactive",
          expiryDate: d.subscription.expiryDate ? new Date(d.subscription.expiryDate).toISOString().slice(0,10) : "",
          apiAccessEnabled: Boolean(d.subscription.apiAccessEnabled),
          customLimit5h: d.subscription.customLimit5h ?? "",
          customLimitWeekly: d.subscription.customLimitWeekly ?? "",
          customLimitMonthly: d.subscription.customLimitMonthly ?? "",
        });
      }
      setLoading(false);
    });
  };

  useEffect(() => { fetchData(); }, [id]);

  const save = async () => {
    setSaving(true); setMsg("");
    try {
      const r = await fetch("/api/admin/users", { method: "PATCH", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ userId: id, ...draft }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg("Saved.");
      fetchData();
    } catch (e) { setMsg("Error: " + e.message); }
    finally { setSaving(false); }
  };

  const resetPassword = async () => {
    setSaving(true); setMsg("");
    try {
      const r = await fetch("/api/admin/reset-password", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ userId: id }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg("New password: " + d.newPassword);
    } catch (e) { setMsg("Error: " + e.message); }
    finally { setSaving(false); }
  };

  const createKey = async () => {
    setSaving(true); setMsg("");
    try {
      const r = await fetch("/api/admin/keys", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ userId: id, name: keyName || "Test Key" }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setKeyName("");
      setMsg("Key created.");
      fetchData();
    } catch (e) { setMsg("Error: " + e.message); }
    finally { setSaving(false); }
  };

  const revokeKey = async (keyId) => {
    if (!confirm("Revoke?")) return;
    try {
      await fetch("/api/admin/keys", { method: "DELETE", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ keyId }) });
      setMsg("Key revoked.");
      fetchData();
    } catch (e) { setMsg("Error: " + e.message); }
  };

  if (loading) return <Skeleton />;
  if (!data) return <div className="text-gray-400">User not found.</div>;

  const { user, subscription, apiKeys, usage, conversations, conversationCount, lastActivity } = data;

  return (
    <div className="max-w-4xl space-y-5">
      <Link href="/admin/users" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white"><ArrowLeft size={12} />Back to Users</Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">{user.name || "Unnamed"}</h1>
          <p className="text-sm text-gray-400 font-mono">{user.email}</p>
          <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-500">
            <span>Role: {user.role}</span>
            <span>{conversationCount} conversations</span>
            <span>{apiKeys?.length || 0} API keys</span>
            <span>Joined: {new Date(user.createdAt).toLocaleDateString()}</span>
          </div>
          {lastActivity?.timestamp && (
            <p className="text-[11px] text-gray-500 mt-1">Last activity: {new Date(lastActivity.timestamp).toLocaleString()} ({lastActivity.modelUsed})</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={resetPassword} disabled={saving} className="text-[11px] px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/5 text-gray-300 cursor-pointer">Reset PW</button>
          <button onClick={async () => {
            if (!confirm("Force logout this user? All their sessions will be invalidated.")) return;
            try { await fetch("/api/admin/force-logout", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ userId: id }) }); setMsg("User logged out."); }
            catch (e) { setMsg("Error: " + e.message); }
          }} disabled={saving} className="text-[11px] px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 cursor-pointer">Force Logout</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/40 text-white text-sm font-semibold cursor-pointer flex items-center gap-2"><Save size={14}/>{saving ? "Saving" : "Save"}</button>
        </div>
      </div>

      {msg && <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-sm text-gray-300 font-mono">{msg}</div>}

      <div className="grid grid-cols-4 gap-3">
        <Stat label="5h Usage" value={F(usage?.fiveHour?.units)} sub={`${F(usage?.fiveHour?.requests)} reqs`} />
        <Stat label="24h Usage" value={F(usage?.daily?.units)} sub={`${F(usage?.daily?.requests)} reqs`} />
        <Stat label="7d Usage" value={F(usage?.weekly?.units)} sub={`${F(usage?.weekly?.requests)} reqs`} />
        <Stat label="Total" value={F(usage?.total)} sub="all time" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4">
          <h3 className="font-bold text-white text-sm mb-3">Usage Breakdown</h3>
          <div className="space-y-2 text-xs text-gray-400">
            <Row label="5h Input" value={F(usage?.fiveHour?.input)} />
            <Row label="5h Output" value={F(usage?.fiveHour?.output)} />
            <Row label="24h Input" value={F(usage?.daily?.input)} />
            <Row label="24h Output" value={F(usage?.daily?.output)} />
            <Row label="7d Input" value={F(usage?.weekly?.input)} />
            <Row label="7d Output" value={F(usage?.weekly?.output)} />
          </div>
        </div>

        <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4">
          <h3 className="font-bold text-white text-sm mb-3">Recent Conversations</h3>
          <div className="space-y-2">
            {(conversations || []).length === 0 ? (
              <p className="text-xs text-gray-500">No conversations yet.</p>
            ) : conversations.map((c) => (
              <div key={c.id} className="rounded-lg bg-black/20 p-2 text-xs">
                <div className="truncate text-gray-300 font-medium">{c.title}</div>
                <div className="text-gray-600 mt-0.5">{new Date(c.updatedAt).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4">
        <h3 className="font-bold text-white text-sm mb-3">Plan & Limits</h3>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <Field label="Plan">
            <select value={draft.plan} onChange={e => setDraft({...draft, plan: e.target.value})} className="glass-input rounded-lg px-3 py-2 text-sm w-full">
              {["free","student","starter","pro","developer"].map(p => <option key={p} className="bg-slate-900">{p}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={draft.status} onChange={e => setDraft({...draft, status: e.target.value})} className="glass-input rounded-lg px-3 py-2 text-sm w-full">
              {["active","inactive","suspended","expired","cancelled"].map(s => <option key={s} className="bg-slate-900">{s}</option>)}
            </select>
          </Field>
          <Field label="Expires">
            <input type="date" value={draft.expiryDate} onChange={e => setDraft({...draft, expiryDate: e.target.value})} className="glass-input rounded-lg px-3 py-2 text-sm w-full" />
          </Field>
          <Field label="API Access">
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 text-sm text-gray-300">
              <input type="checkbox" checked={draft.apiAccessEnabled} onChange={e => setDraft({...draft, apiAccessEnabled: e.target.checked})} />Enabled
            </label>
          </Field>
          <Field label="5h Custom"><input placeholder="Default" value={draft.customLimit5h} onChange={e => setDraft({...draft, customLimit5h: e.target.value})} className="glass-input rounded-lg px-3 py-2 text-sm w-full" /></Field>
          <Field label="Weekly Custom"><input placeholder="Default" value={draft.customLimitWeekly} onChange={e => setDraft({...draft, customLimitWeekly: e.target.value})} className="glass-input rounded-lg px-3 py-2 text-sm w-full" /></Field>
          <Field label="Monthly Custom"><input placeholder="Default" value={draft.customLimitMonthly} onChange={e => setDraft({...draft, customLimitMonthly: e.target.value})} className="glass-input rounded-lg px-3 py-2 text-sm w-full" /></Field>
        </div>
      </div>

      <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4">
        <h3 className="font-bold text-white text-sm mb-3">API Keys</h3>
        <div className="flex gap-2 mb-3">
          <input placeholder="Key name" value={keyName} onChange={e => setKeyName(e.target.value)} className="glass-input rounded-lg px-3 py-2 text-sm flex-1" />
          <button onClick={createKey} disabled={saving || (apiKeys?.length >= 3)} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900/40 text-xs font-semibold cursor-pointer flex items-center gap-1.5"><KeyRound size={13}/>Create</button>
        </div>
        <div className="space-y-2">
          {(apiKeys || []).map(k => (
            <div key={k.id} className="rounded-lg bg-black/20 border border-white/5 p-3 text-xs flex items-center justify-between gap-3">
              <div className="min-w-0"><span className="font-semibold text-white truncate block">{k.name}</span><span className="font-mono text-indigo-300 truncate select-all block mt-0.5">{k.key}</span></div>
              <button onClick={() => revokeKey(k.id)} className="text-red-400 hover:text-red-300 cursor-pointer"><Trash2 size={14}/></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return <div className="flex justify-between"><span className="text-gray-500">{label}</span><span className="font-mono text-gray-300">{value}</span></div>;
}

function Field({ label, children }) {
  return <label className="block"><span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 block mb-1.5">{label}</span>{children}</label>;
}
