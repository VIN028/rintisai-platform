"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, BookOpen, Bot, Check, Code2, Copy, CreditCard, KeyRound, LifeBuoy, Menu, Shield } from "lucide-react";

const apiBase = "https://rintisai.site/api/v1";
const anthropicBase = "https://rintisai.site/api";
const gptModels = ["gpt-5.4-mini", "gpt-5.4", "gpt-5.5", "gpt-5.6-terra", "gpt-5.6-sol"];
const claudeAnthropicModels = ["claude-sonnet-5", "claude-haiku-4-5", "claude-opus-4-8"];
const claudeOpenAiModels = ["claude-sonnet", "claude-haiku", "claude-opus"];

const sidebar = [
  { title: "Quickstart", links: [{ href: "#quickstart", label: "Start in 5 minutes" }] },
  { title: "Integrations", links: [{ href: "#openai", label: "OpenAI-compatible" }, { href: "#anthropic", label: "Claude Code" }, { href: "#examples", label: "API examples" }] },
  { title: "Models & Keys", links: [{ href: "#keys", label: "Scoped API keys" }, { href: "#models", label: "Model IDs" }] },
  { title: "Account", links: [{ href: "#usage", label: "Usage & billing" }, { href: "#troubleshooting", label: "Troubleshooting" }] },
];

const onThisPage = [
  { href: "#quickstart", label: "Quickstart" },
  { href: "#openai", label: "OpenAI-compatible" },
  { href: "#anthropic", label: "Claude Code" },
  { href: "#models", label: "Models" },
  { href: "#troubleshooting", label: "Troubleshooting" },
];

function CodeBlock({ children }) {
  const [copied, setCopied] = useState(false);
  const fallbackCopy = (value) => {
    const area = document.createElement("textarea");
    area.value = value;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  };

  const copy = async () => {
    const value = String(children || "");
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
    <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-slate-950 shadow-sm dark:border-white/10">
      <div className="flex items-center justify-end border-b border-white/10 px-3 py-2">
        <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-bold text-slate-100 hover:bg-white/15">
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed text-slate-100">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function InlineCode({ children }) {
  return <code className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-800 dark:border-white/10 dark:bg-white/10 dark:text-slate-100">{children}</code>;
}

function Step({ number, title, children }) {
  return (
    <li className="flex gap-4">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">{number}</span>
      <div>
        <p className="font-semibold text-slate-950 dark:text-white">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">{children}</p>
      </div>
    </li>
  );
}

function Section({ id, eyebrow, title, children }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-slate-200 py-10 first:border-t-0 first:pt-0 dark:border-white/10">
      {eyebrow && <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">{eyebrow}</p>}
      <h2 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">{title}</h2>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

function InfoCard({ icon: Icon, title, children }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-950 dark:text-white">
        <Icon size={16} className="text-indigo-600 dark:text-indigo-300" />
        {title}
      </div>
      <div className="text-sm leading-6 text-slate-600 dark:text-slate-400">{children}</div>
    </div>
  );
}

function ModelTable() {
  const rows = [
    ["OpenAI-compatible", "GPT", gptModels.join(", ")],
    ["OpenAI-compatible", "Claude", claudeOpenAiModels.join(", ")],
    ["Anthropic-compatible", "Claude", claudeAnthropicModels.join(", ")],
  ];

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
          <tr><th className="px-3 py-3">Client</th><th className="px-3 py-3">Family</th><th className="px-3 py-3">Model IDs</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-white/10">
          {rows.map(([client, family, models]) => (
            <tr key={`${client}-${family}`}>
              <td className="px-3 py-3 font-semibold text-slate-900 dark:text-white">{client}</td>
              <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{family}</td>
              <td className="px-3 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">{models}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ApiDocsPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-700 dark:bg-[#0b1020] dark:text-slate-300">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-[#0b1020]/90">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 text-sm font-black text-slate-950 dark:text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">R</span>
            RintisAI Docs
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-600 md:flex dark:text-slate-300">
            <a href="#quickstart" className="hover:text-indigo-600 dark:hover:text-indigo-300">Quickstart</a>
            <a href="#models" className="hover:text-indigo-600 dark:hover:text-indigo-300">Models</a>
            <a href="#troubleshooting" className="hover:text-indigo-600 dark:hover:text-indigo-300">Support</a>
            <Link href="/" className="rounded-lg bg-slate-950 px-3 py-2 text-white hover:bg-indigo-600 dark:bg-white dark:text-slate-950 dark:hover:bg-indigo-200">Open App</Link>
          </nav>
          <Menu className="md:hidden" size={20} />
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[230px_minmax(0,1fr)_210px] lg:px-8">
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-7 text-sm">
            {sidebar.map((group) => (
              <div key={group.title}>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{group.title}</p>
                <div className="space-y-1">
                  {group.links.map((link) => (
                    <a key={link.href} href={link.href} className="block rounded-md px-2 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-indigo-300">{link.label}</a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <article className="min-w-0 rounded-xl border border-slate-200 bg-white px-5 py-8 shadow-sm dark:border-white/10 dark:bg-white/[0.03] sm:px-8 lg:px-10">
          <div className="mb-10">
            <p className="mb-3 inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 dark:border-indigo-400/20 dark:bg-indigo-400/10 dark:text-indigo-200">Quickstart</p>
            <h1 className="max-w-3xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">Connect RintisAI API in under 5 minutes</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-400">
              Use one RintisAI account for Codex and Claude. Create scoped API keys, connect your client, and monitor usage from the dashboard.
            </p>
          </div>

          <Section id="quickstart" title="Start in 5 minutes">
            <ol className="space-y-5">
              <Step number="1" title="Register or log in">Open <Link href="/" className="font-semibold text-indigo-600 dark:text-indigo-300">rintisai.site</Link> and create your account.</Step>
              <Step number="2" title="Activate an API product">Use API PAYG credit or a plan with API access. Codex and Claude share one API wallet.</Step>
              <Step number="3" title="Create an API key">Open the API dashboard, choose a key group, then copy the generated key once.</Step>
              <Step number="4" title="Pick the right base URL">Use <InlineCode>{apiBase}</InlineCode> for OpenAI-compatible clients or <InlineCode>{anthropicBase}</InlineCode> for Claude Code style clients.</Step>
              <Step number="5" title="Paste the config">Use the snippets below for Cursor, Cline, Kilo Code, OpenCode, Claude Code, scripts, or bots.</Step>
            </ol>
            <div className="grid gap-4 md:grid-cols-3">
              <InfoCard icon={KeyRound} title="Private keys">Keys are account-bound and can be revoked from the dashboard.</InfoCard>
              <InfoCard icon={Shield} title="Scoped access">Create separate Codex/GPT and Claude keys for cleaner limits.</InfoCard>
              <InfoCard icon={CreditCard} title="Unified wallet">API PAYG credit is shared across supported model families.</InfoCard>
            </div>
          </Section>

          <Section id="openai" eyebrow="Integration" title="OpenAI-compatible clients">
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
              Use this mode for Cursor, Continue, Cline, Kilo Code, OpenCode, custom scripts, bots, and clients that ask for an OpenAI-compatible endpoint.
            </p>
            <CodeBlock>{`OPENAI_BASE_URL="${apiBase}"
OPENAI_API_KEY="sk-cai-your-key"`}</CodeBlock>
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">If your client asks for the full URL, use <InlineCode>{apiBase}/chat/completions</InlineCode>.</p>
          </Section>

          <Section id="anthropic" eyebrow="Integration" title="Claude Code and Anthropic-compatible clients">
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
              Claude Code and Anthropic-style agent clients use the Messages API. Set the base URL to the API root, not to <InlineCode>/chat/completions</InlineCode>.
            </p>
            <CodeBlock>{`export ANTHROPIC_BASE_URL="${anthropicBase}"
export ANTHROPIC_AUTH_TOKEN="sk-cai-your-key"
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
export CLAUDE_CODE_ATTRIBUTION_HEADER=0

claude`}</CodeBlock>
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">Claude model IDs: <InlineCode>{claudeAnthropicModels.join(", ")}</InlineCode>.</p>
          </Section>

          <Section id="keys" eyebrow="Access control" title="Scoped API keys">
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
              Key groups restrict which model family a key can call while your API PAYG wallet stays unified. Use separate keys for separate tools when you want isolated usage tracking.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <InfoCard icon={Code2} title="Codex / GPT"><span className="font-mono text-xs">{gptModels.join(", ")}</span></InfoCard>
              <InfoCard icon={Bot} title="Claude"><span className="font-mono text-xs">{claudeOpenAiModels.join(", ")} / {claudeAnthropicModels.join(", ")}</span></InfoCard>
            </div>
          </Section>

          <Section id="examples" eyebrow="Examples" title="API examples">
            <p className="text-sm font-bold text-slate-950 dark:text-white">OpenAI-compatible Chat Completions</p>
            <CodeBlock>{`curl ${apiBase}/chat/completions \
  -H "Authorization: Bearer sk-cai-your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-5.4-mini",
    "messages": [{"role": "user", "content": "Hello"}]
  }'`}</CodeBlock>

            <p className="text-sm font-bold text-slate-950 dark:text-white">Anthropic Messages API</p>
            <CodeBlock>{`curl ${anthropicBase}/messages \
  -H "Authorization: Bearer sk-cai-your-key" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-5",
    "max_tokens": 256,
    "messages": [{"role": "user", "content": "Hello"}]
  }'`}</CodeBlock>
          </Section>

          <Section id="models" eyebrow="Reference" title="Model IDs">
            <ModelTable />
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
              Available models depend on your active product and selected API key group. API PAYG balance is unified; key groups only control model-family access.
            </p>
          </Section>

          <Section id="usage" eyebrow="Billing" title="Usage and billing">
            <div className="grid gap-4 md:grid-cols-2">
              <InfoCard icon={CreditCard} title="API PAYG">Top up once and use the balance across Codex and Claude. More expensive models and output-heavy requests consume more credit.</InfoCard>
              <InfoCard icon={BookOpen} title="Dashboard usage">Use the dashboard to inspect active keys, group scope, limits, and recent API usage.</InfoCard>
            </div>
          </Section>

          <Section id="troubleshooting" eyebrow="Support" title="Troubleshooting">
            <div className="space-y-4 text-sm leading-6 text-slate-600 dark:text-slate-400">
              <p><strong className="text-slate-950 dark:text-white">401 Invalid API key:</strong> copy the RintisAI key again and make sure your client uses the RintisAI base URL.</p>
              <p><strong className="text-slate-950 dark:text-white">403 Scope mismatch:</strong> the key group does not match the model family. Create or edit a Codex/GPT or Claude key.</p>
              <p><strong className="text-slate-950 dark:text-white">402 Insufficient credit:</strong> top up API PAYG balance before retrying.</p>
              <p><strong className="text-slate-950 dark:text-white">Wrong endpoint:</strong> OpenAI clients use <InlineCode>{apiBase}</InlineCode>; Claude Code clients use <InlineCode>{anthropicBase}</InlineCode>.</p>
            </div>
          </Section>

          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold text-slate-950 dark:text-white">Ready to connect?</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Open RintisAI, create an API key, then paste the matching config into your client.</p>
            </div>
            <Link href="/" className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-500">
              Open RintisAI <ArrowRight size={16} />
            </Link>
          </div>
        </article>

        <aside className="hidden xl:block">
          <div className="sticky top-24 text-sm">
            <p className="mb-3 font-bold text-slate-950 dark:text-white">On This Page</p>
            <div className="space-y-2 border-l border-slate-200 pl-4 dark:border-white/10">
              {onThisPage.map((item) => (
                <a key={item.href} href={item.href} className="block text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300">{item.label}</a>
              ))}
            </div>
            <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="mb-2 flex items-center gap-2 font-bold text-slate-950 dark:text-white"><LifeBuoy size={16} /> Need help?</div>
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">Use the dashboard support flow or message the seller who issued your RintisAI access.</p>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
