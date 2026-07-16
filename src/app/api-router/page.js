"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Copy, KeyRound, Shield, Terminal, Wallet } from "lucide-react";
import { API_PAYG_PRICING } from "@/lib/api-products";

const modelIds = Object.keys(API_PAYG_PRICING);
const formatRp = (value) => `Rp ${Math.max(0, Math.ceil(value || 0)).toLocaleString("id-ID")}`;

function Feature({ icon: Icon, title, body }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
      <Icon size={18} className="mb-3 text-indigo-600 dark:text-indigo-300" />
      <h3 className="font-bold text-slate-950 dark:text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{body}</p>
    </div>
  );
}

function CopySnippet({ lines }) {
  const [copied, setCopied] = useState(false);
  const value = lines.join("\n");
  const fallbackCopy = (text) => {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  };

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
      else fallbackCopy(value);
    } catch {
      fallbackCopy(value);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mt-5 overflow-hidden rounded-lg bg-slate-950 font-mono text-xs leading-6 text-slate-100">
      <div className="flex justify-end border-b border-white/10 px-3 py-2 font-sans">
        <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-bold text-slate-100 hover:bg-white/15">
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="overflow-x-auto p-4">
        {lines.map((line) => <p key={line} className="whitespace-nowrap">{line}</p>)}
      </div>
    </div>
  );
}

export default function ApiRouterPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-900 dark:bg-[#0b1020] dark:text-white">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-slate-50/90 backdrop-blur dark:border-white/10 dark:bg-[#0b1020]/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-black"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">R</span>RintisAI</Link>
          <nav className="hidden items-center gap-5 text-sm font-semibold text-slate-600 md:flex dark:text-slate-300">
            <a href="#pricing" className="hover:text-indigo-600 dark:hover:text-indigo-300">Pricing</a>
            <Link href="/docs/api" className="hover:text-indigo-600 dark:hover:text-indigo-300">Docs</Link>
          </nav>
          <Link href="/register" className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-500">Start</Link>
        </div>
      </header>

      <section className="border-b border-slate-200 dark:border-white/10">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300">API router for developers</p>
            <h1 className="max-w-3xl text-3xl font-black tracking-tight sm:text-5xl lg:text-6xl">Codex and Claude through one RintisAI API workspace.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-400">Connect Cursor, Cline, Kilo Code, OpenCode, Claude Code, bots, and automation using OpenAI-compatible or Anthropic-compatible endpoints. Top up in Rupiah and control access with scoped API keys.</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-500">Create API Account <ArrowRight size={16} /></Link>
              <Link href="/docs/api" className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-900 hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]">Read Docs</Link>
            </div>
          </div>
          <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
            <div className="mb-4 flex items-center gap-2"><Terminal size={18} className="text-indigo-600 dark:text-indigo-300" /><h2 className="font-black">Use with your tools</h2></div>
            <div className="grid gap-2 sm:grid-cols-2">
              {["Cursor", "Cline", "Kilo Code", "OpenCode", "Claude Code", "Continue", "Custom bots"].map((tool) => <div key={tool} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-black/20">{tool}</div>)}
            </div>
            <CopySnippet lines={["OPENAI_BASE_URL=\"https://rintisai.site/api/v1\"", "ANTHROPIC_BASE_URL=\"https://rintisai.site/api\"", "API_KEY=\"sk-cai-your-key\""]} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Feature icon={KeyRound} title="Scoped keys" body="Create separate Codex/GPT and Claude keys for cleaner limits and usage tracking." />
          <Feature icon={Wallet} title="Unified credit" body="One API PAYG wallet can be used across supported Codex and Claude models." />
          <Feature icon={Shield} title="Usage control" body="Disable keys, set quotas, monitor spend, and revoke access from the dashboard." />
        </div>
      </section>

      <section id="pricing" className="border-y border-slate-200 bg-white py-12 dark:border-white/10 dark:bg-white/[0.02]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Pricing</p><h2 className="mt-2 text-3xl font-black">Pay for actual API usage</h2></div>
            <Link href="/docs/api" className="text-sm font-bold text-indigo-600 dark:text-indigo-300">View API docs</Link>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-white/10 dark:bg-white/[0.04]"><tr><th className="px-4 py-3">Model</th><th className="px-4 py-3">Family</th><th className="px-4 py-3">Input / 1M</th><th className="px-4 py-3">Output / 1M</th><th className="px-4 py-3">Suggested Top Up</th></tr></thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                {modelIds.map((id) => {
                  const row = API_PAYG_PRICING[id];
                  return <tr key={id}><td className="px-4 py-3 font-bold text-slate-950 dark:text-white">{row.label}</td><td className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.family}</td><td className="px-4 py-3 font-mono text-emerald-600 dark:text-emerald-300">${row.inputUsdPerMillion}</td><td className="px-4 py-3 font-mono text-emerald-600 dark:text-emerald-300">${row.outputUsdPerMillion}</td><td className="px-4 py-3">{formatRp(row.recommendedTopupRp)}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center dark:border-white/10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-5 flex flex-wrap justify-center gap-3 text-sm font-semibold"><Link href="/register" className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-white hover:bg-indigo-500">Start with RintisAI <ArrowRight size={16} /></Link><Link href="/docs/api" className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-900 hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]">Developer Docs</Link></div>
          <p className="text-xs text-slate-500">RintisAI API Router. Not affiliated with any AI model provider.</p>
        </div>
      </footer>
    </main>
  );
}
