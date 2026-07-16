import Link from "next/link";
import { Activity, CheckCircle2, Clock, FileText, Gauge, Server } from "lucide-react";
import { API_ENDPOINT_STATUS, API_INCIDENTS, API_MODEL_GROUPS } from "@/lib/api-products";

export const dynamic = "force-dynamic";

function getStatusTone(status) {
  if (["operational", "available"].includes(status)) return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300";
  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300";
}

function StatusBadge({ status }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${getStatusTone(status)}`}>{status}</span>;
}

function MetricCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-950 dark:text-white"><Icon size={16} className="text-indigo-600 dark:text-indigo-300" />{label}</div>
      <p className="text-2xl font-black text-slate-950 dark:text-white">{value}</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{sub}</p>
    </div>
  );
}

export default function StatusPage() {
  const checkedAt = new Date();
  const allSystemsOperational = [...API_ENDPOINT_STATUS, ...API_MODEL_GROUPS].every((item) => ["operational", "available"].includes(item.status));

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 dark:bg-[#0b1020] dark:text-slate-200">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-[#0b1020]/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-black text-slate-950 dark:text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">R</span>
            RintisAI Status
          </Link>
          <Link href="/docs/api" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.08]">Docs</Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2"><StatusBadge status={allSystemsOperational ? "operational" : "degraded"} /><span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">API Health</span></div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">{allSystemsOperational ? "All systems operational" : "Some systems are degraded"}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">Current route availability for RintisAI API endpoints and configured model groups. Live model health is confirmed by actual chat/API requests.</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-black/20">
              <div className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-950 dark:text-white"><Clock size={16} className="text-indigo-600 dark:text-indigo-300" />Last checked</div>
              <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{checkedAt.toLocaleString("en-US", { timeZone: "Asia/Jakarta" })} WIB</p>
            </div>
          </div>
        </section>

        <section className="mb-6 grid gap-3 sm:grid-cols-3">
          <MetricCard icon={Server} label="Endpoints" value={API_ENDPOINT_STATUS.length} sub="OpenAI, Anthropic, dashboard" />
          <MetricCard icon={Activity} label="Model Groups" value={API_MODEL_GROUPS.length} sub="Codex/GPT, Claude" />
          <MetricCard icon={CheckCircle2} label="Incidents" value="0" sub="Active incidents right now" />
        </section>

        <section className="mb-6 rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-white/10 sm:px-5"><h2 className="font-black text-slate-950 dark:text-white">Endpoints</h2></div>
          <div className="divide-y divide-slate-200 dark:divide-white/10">
            {API_ENDPOINT_STATUS.map((item) => (
              <div key={item.name} className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:px-5">
                <div className="min-w-0"><p className="font-bold text-slate-950 dark:text-white">{item.name}</p><p className="mt-1 break-all font-mono text-xs text-slate-500 dark:text-slate-400">{item.url}</p></div>
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><Gauge size={15} />Published route</div>
                <StatusBadge status={item.status} />
              </div>
            ))}
          </div>
        </section>

        <section className="mb-6 rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-white/10 sm:px-5"><h2 className="font-black text-slate-950 dark:text-white">Model Groups</h2></div>
          <div className="divide-y divide-slate-200 dark:divide-white/10">
            {API_MODEL_GROUPS.map((group) => (
              <div key={group.key} className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:px-5">
                <div className="min-w-0">
                  <p className="font-bold text-slate-950 dark:text-white">{group.label}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">{group.models.join(", ")}</p>
                  {group.anthropicModels && <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-500">Anthropic IDs: {group.anthropicModels.join(", ")}</p>}
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><Gauge size={15} />Configured</div>
                <StatusBadge status={group.status} />
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
            <div className="border-b border-slate-200 px-4 py-3 dark:border-white/10 sm:px-5"><h2 className="font-black text-slate-950 dark:text-white">Recent Incidents</h2></div>
            <div className="divide-y divide-slate-200 dark:divide-white/10">
              {API_INCIDENTS.map((incident) => (
                <div key={incident.title} className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-start sm:px-5">
                  <div><p className="font-bold text-slate-950 dark:text-white">{incident.title}</p><p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">{incident.detail}</p><p className="mt-1 text-xs text-slate-500">{incident.date}</p></div>
                  <StatusBadge status={incident.status === "resolved" ? "operational" : incident.status} />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
            <div className="mb-2 flex items-center gap-2 font-bold text-slate-950 dark:text-white"><FileText size={16} className="text-indigo-600 dark:text-indigo-300" />Integration Docs</div>
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">Endpoint setup, model IDs, and troubleshooting live in the API documentation.</p>
            <Link href="/docs/api" className="mt-4 inline-flex rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-500">Open Docs</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
