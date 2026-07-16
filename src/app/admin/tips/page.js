import { BookOpen, CheckCircle, HelpCircle, KeyRound, MessageSquare, Wallet } from "lucide-react";

const plans = [
  { name: "Free", models: "GPT-5.4 Mini", use: "Trial and light web chat", note: "No API access." },
  { name: "Codex Lite", models: "GPT-5.4 Mini", use: "Affordable web chat", note: "Good for daily writing, summaries, files, and URLs." },
  { name: "Codex Code", models: "GPT-5.4 Mini, GPT-5.4, GPT-5.5, GPT-5.6 Terra", use: "GPT/Codex coding and automation", note: "Includes API access for developer tools." },
  { name: "Codex Pro", models: "GPT-5.4 Mini, GPT-5.4, GPT-5.5, GPT-5.6 Terra, GPT-5.6 Sol", use: "Higher Codex limits", note: "Sol falls back to Terra if upstream is unavailable." },
  { name: "Claude Lite", models: "Claude Haiku, Claude Sonnet", use: "Affordable Claude web chat", note: "No Opus access." },
  { name: "Claude Code", models: "Claude Haiku, Claude Sonnet, Claude Opus", use: "Claude Code/OpenCode workflows", note: "Use Anthropic-compatible base URL." },
  { name: "Claude Pro", models: "Claude Haiku, Claude Sonnet, Claude Opus", use: "Higher Claude limits", note: "Best for regular Sonnet/Opus work." },
  { name: "GPT API", models: "GPT-5.4 Mini, GPT-5.4, GPT-5.5, GPT-5.6 Terra, GPT-5.6 Sol", use: "API-only GPT PAYG", note: "Top-up balance required." },
  { name: "Claude API", models: "Claude Haiku, Claude Sonnet, Claude Opus", use: "API-only Claude PAYG", note: "Works with Claude Code style clients." },
];

const quickAnswers = [
  ["User asks which plan to buy", "For normal GPT/Codex chat, choose Codex Lite. For coding with GPT, choose Codex Code. For affordable Claude, choose Claude Lite; for Claude Code/OpenCode, choose Claude Code. For usage-based API only, choose GPT API or Claude API."],
  ["User asks base URL", "OpenAI-compatible tools use https://rintisai.site/api/v1. Claude Code/OpenCode compatible setup uses https://rintisai.site/api."],
  ["User gets model not allowed", "That model is not included in the current plan. Ask the user to switch to an included model or upgrade to the matching plan family."],
  ["User gets insufficient credit", "The account is API PAYG and needs more balance. Ask user to top up API credit from the dashboard."],
  ["Payment is pending", "Ask the user to transfer the exact amount including unique code and submit payment proof. Admin can then confirm or complete from Upgrade Requests."],
];

const workflows = [
  ["Approve payment", "Open Upgrades, check expected transfer amount, payment method, unique code, and proof. Use Confirm if waiting for final review, Complete to activate plan or credit."],
  ["Check account status", "Open Users, search email, check subscription status, plan, expiry date, and API access."],
  ["Help API setup", "Ask user to create an API key in their dashboard, then use the correct base URL for their client type."],
  ["Escalate to owner", "Escalate provider outage, repeated payment mismatch, suspicious account, margin/pricing question, or anything involving secrets."],
];

export default function AdminTipsPage() {
  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-indigo-400 mb-2">Admin Guide</p>
        <h1 className="text-2xl font-black text-white flex items-center gap-2"><BookOpen size={22} className="text-indigo-300" /> Tips Book</h1>
        <p className="text-sm text-gray-400 mt-1">Operational answers for admins who need to support users without knowing every technical detail.</p>
      </div>

      <section className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
        <div className="p-4 border-b border-white/5 flex items-center gap-2"><CheckCircle size={16} className="text-emerald-300" /><h2 className="font-bold text-white">Plan Cheat Sheet</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="border-b border-white/5 text-gray-500"><tr><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Supported Models</th><th className="px-4 py-3">Best For</th><th className="px-4 py-3">Admin Note</th></tr></thead>
            <tbody>
              {plans.map((plan) => <tr key={plan.name} className="border-b border-white/5 last:border-0"><td className="px-4 py-3 font-bold text-white">{plan.name}</td><td className="px-4 py-3 text-indigo-200">{plan.models}</td><td className="px-4 py-3 text-gray-300">{plan.use}</td><td className="px-4 py-3 text-gray-500">{plan.note}</td></tr>)}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid lg:grid-cols-[1fr_0.9fr] gap-4">
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 mb-3"><MessageSquare size={16} className="text-emerald-300" /><h2 className="font-bold text-white">Quick Answers</h2></div>
          <div className="space-y-2">
            {quickAnswers.map(([title, answer]) => <Answer key={title} title={title} answer={answer} />)}
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 mb-3"><KeyRound size={16} className="text-indigo-300" /><h2 className="font-bold text-white">Base URLs</h2></div>
            <div className="space-y-2 text-xs">
              <Metric label="OpenAI-compatible" value="https://rintisai.site/api/v1" />
              <Metric label="Claude Code compatible" value="https://rintisai.site/api" />
            </div>
          </section>
          <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 mb-3"><Wallet size={16} className="text-amber-300" /><h2 className="font-bold text-white">Admin Workflows</h2></div>
            <div className="space-y-2">
              {workflows.map(([title, detail]) => <div key={title} className="rounded-xl border border-white/5 bg-black/10 p-3"><p className="text-xs font-bold text-white">{title}</p><p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{detail}</p></div>)}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function Answer({ title, answer }) {
  return <div className="rounded-xl border border-white/5 bg-black/10 p-3"><div className="flex items-start gap-2"><HelpCircle size={14} className="text-indigo-300 mt-0.5" /><div><p className="text-xs font-bold text-white">{title}</p><p className="text-[11px] text-gray-400 mt-1 leading-relaxed">{answer}</p></div></div></div>;
}

function Metric({ label, value }) {
  return <div className="rounded-xl border border-white/5 bg-black/10 p-3"><p className="text-[10px] uppercase tracking-wide text-gray-500 font-bold">{label}</p><p className="font-mono text-indigo-200 mt-1 break-all">{value}</p></div>;
}
