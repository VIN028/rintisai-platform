"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, KeyRound, Key, Save, Trash2 } from "lucide-react";

const F = (v) => Number(v || 0).toLocaleString("id-ID");
const API_PLAN_KEYS = new Set(["api_gpt", "api_claude", "claude_api"]);

function toDateInput(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function defaultExpiryFor(plan, billingInterval) {
  const now = new Date();
  let days = 30;
  if (plan === "free") days = 365;
  else if (API_PLAN_KEYS.has(plan)) days = 3650;
  else if (billingInterval === "3day") days = 3;
  else if (billingInterval === "weekly") days = 7;
  return toDateInput(now.getTime() + days * 24 * 60 * 60 * 1000);
}

const PLAN_GROUPS = [
  {
    title: "Current Products",
    description: "Primary plans shown to new customers.",
    plans: [
      ["gpt_chat", "Codex Lite", "GPT-5.4 Mini web chat"],
      ["gpt_code", "Codex Code", "Codex coding + API"],
      ["codex_pro", "Codex Pro", "Higher Codex limit + API"],
      ["claude_lite", "Claude Lite", "Claude Haiku/Sonnet web chat"],
      ["claude_code", "Claude Code", "Claude/OpenCode workflow"],
      ["claude_pro", "Claude Pro", "Higher Claude limit"],
    ],
  },
  {
    title: "API Only",
    description: "PAYG API dashboard plans.",
    plans: [
      ["api_gpt", "GPT API", "Usage-based GPT API"],
      ["api_claude", "Claude API", "Usage-based Claude API"],
    ],
  },
  {
    title: "Legacy",
    description: "Keep only for existing users or migrations.",
    plans: [
      ["free", "Free", "Default free access"],
      ["student", "Student", "Legacy GPT plan"],
      ["starter", "Starter", "Legacy GPT plan"],
      ["pro", "Pro", "Legacy GPT + Claude"],
      ["developer", "Developer", "Legacy full plan"],
      ["claude_api", "Claude API Legacy", "Legacy API alias"],
    ],
  },
];

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
  const [confirmState, setConfirmState] = useState({ show: false, title: "", message: "", actionLabel: "Confirm", tone: "danger", onConfirm: null });

  const fetchData = () => {
    fetch(`/api/admin/users/${id}`).then(r => r.json()).then(d => {
      setData(d);
      if (d.subscription) {
        setDraft({
          plan: d.subscription.plan || "free",
          billingInterval: d.subscription.billingInterval || "monthly",
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
    setConfirmState({
      show: true,
      title: "Revoke API key",
      message: "This key will stop working immediately for API requests.",
      actionLabel: "Revoke key",
      tone: "danger",
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, show: false }));
        try {
          await fetch("/api/admin/keys", { method: "DELETE", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ keyId }) });
          setMsg("Key revoked.");
          fetchData();
        } catch (e) { setMsg("Error: " + e.message); }
      },
    });
  };

  const forceLogout = () => {
    setConfirmState({
      show: true,
      title: "Force logout user",
      message: "All active sessions for this user will be invalidated. They will need to sign in again.",
      actionLabel: "Force logout",
      tone: "warning",
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, show: false }));
        try {
          await fetch("/api/admin/force-logout", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ userId: id }) });
          setMsg("User logged out.");
        }
        catch (e) { setMsg("Error: " + e.message); }
      },
    });
  };

  const closeConfirm = () => setConfirmState((prev) => ({ ...prev, show: false }));

  const selectPlan = (plan) => {
    setDraft((prev) => ({
      ...prev,
      plan,
      status: prev.status === "expired" || prev.status === "inactive" ? "active" : prev.status,
      expiryDate: defaultExpiryFor(plan, prev.billingInterval || "monthly"),
    }));
  };

  const selectBillingInterval = (billingInterval) => {
    setDraft((prev) => ({
      ...prev,
      billingInterval,
      expiryDate: defaultExpiryFor(prev.plan || "free", billingInterval),
    }));
  };

  if (loading) return <Skeleton />;
  if (!data) return <div className="text-gray-400">User not found.</div>;

  const { user, subscription, apiKeys, usage, conversations, conversationCount, lastActivity } = data;
  const activeWindowLabel = usage?.windowLabel || (subscription?.billingInterval === "3day" ? "3-Day" : subscription?.billingInterval === "weekly" ? "Weekly" : "Monthly");
  const selectedPlan = PLAN_GROUPS.flatMap((group) => group.plans).find(([plan]) => plan === draft.plan);

  return (
    <div className="max-w-6xl space-y-5">
      <Link href="/admin/users" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white"><ArrowLeft size={12} />Back to Users</Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">{user.name || "Unnamed"}</h1>
          <p className="text-sm text-gray-400 font-mono">{user.email}</p>
          <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-500">
            <span>Role: {user.role}</span>
            <span className={user.emailVerifiedAt ? "text-emerald-400" : "text-amber-300"}>{user.emailVerifiedAt ? "Verified" : "Not Verified"}</span>
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
          <button onClick={forceLogout} disabled={saving} className="text-[11px] px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 cursor-pointer">Force Logout</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/40 text-white text-sm font-semibold cursor-pointer flex items-center gap-2"><Save size={14}/>{saving ? "Saving" : "Save"}</button>
        </div>
      </div>

      {msg && <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-sm text-gray-300 font-mono">{msg}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Stat label={`${activeWindowLabel} Usage Units`} value={F(usage?.current?.usageUnits ?? usage?.current?.units)} sub={`${F(usage?.current?.requests)} reqs`} />
        <Stat label="All-Time Usage Units" value={F(usage?.allTime?.usageUnits ?? usage?.total)} sub={`${F(usage?.allTime?.requests)} reqs`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4">
          <h3 className="font-bold text-white text-sm mb-1">Raw Token Breakdown</h3>
          <p className="text-[11px] text-gray-500 mb-3">Raw tokens are provider tokens before model/reasoning multipliers. Usage units are what plan limits consume.</p>
          <div className="space-y-2 text-xs text-gray-400">
            <Row label={`${activeWindowLabel} Raw Input Tokens`} value={F(usage?.current?.rawInputTokens ?? usage?.current?.input)} />
            <Row label={`${activeWindowLabel} Raw Output Tokens`} value={F(usage?.current?.rawOutputTokens ?? usage?.current?.output)} />
            <Row label="All-Time Raw Input Tokens" value={F(usage?.allTime?.rawInputTokens)} />
            <Row label="All-Time Raw Output Tokens" value={F(usage?.allTime?.rawOutputTokens)} />
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

      <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
          <div>
            <h3 className="font-bold text-white text-sm">Plan & Limits</h3>
            <p className="text-[11px] text-gray-500 mt-1">Assign product access, billing state, expiry, and optional limit overrides.</p>
          </div>
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-3 py-2 text-right">
            <p className="text-[10px] uppercase tracking-wider text-indigo-300 font-bold">Selected</p>
            <p className="text-sm font-black text-white">{selectedPlan?.[1] || draft.plan || "No plan"}</p>
          </div>
        </div>

        <div className="space-y-4">
          {PLAN_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-gray-200">{group.title}</p>
                  <p className="text-[10px] text-gray-500">{group.description}</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {group.plans.map(([plan, label, description]) => (
                  <button
                    key={plan}
                    type="button"
                    onClick={() => selectPlan(plan)}
                    className={`rounded-xl border p-3 text-left transition cursor-pointer ${draft.plan === plan ? "border-indigo-500/40 bg-indigo-500/10" : "border-white/5 bg-black/10 hover:border-white/10 hover:bg-white/[0.03]"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">{label}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{description}</p>
                      </div>
                      <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${draft.plan === plan ? "bg-indigo-300" : "bg-white/10"}`} />
                    </div>
                    <p className="mt-2 font-mono text-[10px] text-gray-500">{plan}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="grid md:grid-cols-4 gap-3 rounded-2xl border border-white/5 bg-black/10 p-4">
            <Field label="Status">
              <select value={draft.status} onChange={e => setDraft({...draft, status: e.target.value})} className="glass-input rounded-lg px-3 py-2 text-sm w-full">
                {["active","inactive","suspended","expired","cancelled"].map(s => <option key={s} className="bg-slate-900">{s}</option>)}
              </select>
            </Field>
            <Field label="Billing">
              <select value={draft.billingInterval} onChange={e => selectBillingInterval(e.target.value)} className="glass-input rounded-lg px-3 py-2 text-sm w-full">
                {["monthly","weekly","3day"].map(i => <option key={i} className="bg-slate-900">{i}</option>)}
              </select>
            </Field>
            <Field label="Expires">
              <input type="date" value={draft.expiryDate} onChange={e => setDraft({...draft, expiryDate: e.target.value})} className="glass-input rounded-lg px-3 py-2 text-sm w-full" />
            </Field>
            <Field label="API Access">
              <label className="flex h-[38px] items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 text-sm text-gray-300">
                <input type="checkbox" checked={draft.apiAccessEnabled} onChange={e => setDraft({...draft, apiAccessEnabled: e.target.checked})} />Enabled
              </label>
            </Field>
          </div>

          <div className="rounded-2xl border border-white/5 bg-black/10 p-4">
            <div className="mb-3">
              <p className="text-xs font-bold text-gray-200">Custom Limit Overrides</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Leave blank to use the plan default. Use only for manual support adjustments.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <Field label="3-Day Custom"><input placeholder="Default" value={draft.customLimit5h} onChange={e => setDraft({...draft, customLimit5h: e.target.value})} className="glass-input rounded-lg px-3 py-2 text-sm w-full" /></Field>
              <Field label="Weekly Custom"><input placeholder="Default" value={draft.customLimitWeekly} onChange={e => setDraft({...draft, customLimitWeekly: e.target.value})} className="glass-input rounded-lg px-3 py-2 text-sm w-full" /></Field>
              <Field label="Monthly Custom"><input placeholder="Default" value={draft.customLimitMonthly} onChange={e => setDraft({...draft, customLimitMonthly: e.target.value})} className="glass-input rounded-lg px-3 py-2 text-sm w-full" /></Field>
            </div>
          </div>
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

      {confirmState.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#181818] p-5 shadow-2xl shadow-black/40">
            <h3 className="text-base font-bold text-white">{confirmState.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">{confirmState.message}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={closeConfirm} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-gray-300 hover:bg-white/[0.06] cursor-pointer">Cancel</button>
              <button type="button" onClick={confirmState.onConfirm} className={`rounded-lg px-3 py-2 text-xs font-bold text-white cursor-pointer ${confirmState.tone === "warning" ? "bg-amber-600 hover:bg-amber-500" : "bg-red-600 hover:bg-red-500"}`}>{confirmState.actionLabel}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return <div className="flex justify-between"><span className="text-gray-500">{label}</span><span className="font-mono text-gray-300">{value}</span></div>;
}

function Field({ label, children }) {
  return <label className="block"><span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 block mb-1.5">{label}</span>{children}</label>;
}
