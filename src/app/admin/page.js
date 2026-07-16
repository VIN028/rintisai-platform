"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, ShoppingCart, Activity, ArrowUpRight, CreditCard, Landmark, Wallet } from "lucide-react";

const formatNumber = (value) => Number(value || 0).toLocaleString("id-ID");

function Card({ label, value, sub, tone = "indigo" }) {
  const toneClass = tone === "emerald" ? "text-emerald-300" : tone === "amber" ? "text-amber-300" : "text-indigo-300";
  return (
    <div className="glass-card rounded-2xl p-4">
      <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">{label}</p>
      <p className={`text-2xl font-black mt-2 ${toneClass}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function ActionCard({ href, icon: Icon, title, desc, tone = "indigo" }) {
  const color = tone === "emerald" ? "text-emerald-400" : tone === "amber" ? "text-amber-400" : "text-indigo-400";
  return (
    <Link href={href} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 hover:border-indigo-500/20 hover:bg-white/[0.04] transition flex items-center justify-between gap-3">
      <div className="min-w-0">
        <Icon size={18} className={`${color} mb-2`} />
        <h3 className="font-bold text-white text-sm">{title}</h3>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{desc}</p>
      </div>
      <ArrowUpRight size={16} className="text-gray-600 shrink-0" />
    </Link>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/admin/upgrades").then((r) => r.json()),
    ]).then(([usersData, upgradesData]) => {
      const users = usersData.users || [];
      const requests = upgradesData.requests || [];
      setStats({
        totalUsers: users.length,
        activeUsers: users.filter((u) => u.subscription?.status === "active").length,
        codeUsers: users.filter((u) => ["gpt_code", "codex_pro", "claude_code", "claude_pro", "developer"].includes(u.subscription?.plan)).length,
        pendingUpgrades: requests.filter((r) => r.status === "pending").length,
        monthlyUsage: users.reduce((sum, u) => sum + (u.usage?.monthly || 0), 0),
      });
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-gray-400 text-sm">Loading...</div>;
  const s = stats || {};

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
        <h1 className="text-2xl font-black text-white">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">One-screen admin overview. Use the sidebar for detailed operations.</p>
        </div>
        <Link href="/admin/upgrades" className="w-fit rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition">
          Review Payments
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <Card label="Total Users" value={s.totalUsers} sub="registered accounts" />
        <Card label="Active Users" value={s.activeUsers} sub={`${s.codeUsers || 0} code-plan users`} tone="emerald" />
        <Card label="Pending Payments" value={s.pendingUpgrades} sub="needs admin action" tone="amber" />
        <Card label="Usage Units (30d)" value={formatNumber(s.monthlyUsage)} sub="weighted plan usage" />
      </div>

      <div className="grid lg:grid-cols-[1fr_0.85fr] gap-4">
        <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <h2 className="text-sm font-bold text-white mb-3">Operations</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <ActionCard href="/admin/users" icon={Users} title="Users" desc="Manage accounts, plans, limits, and API access." />
            <ActionCard href="/admin/upgrades" icon={ShoppingCart} title="Payment Requests" desc={`${s.pendingUpgrades || 0} pending upgrade or top-up requests.`} tone="emerald" />
            <ActionCard href="/admin/cashouts" icon={Wallet} title="Cashouts" desc="Review API balance payout requests." tone="amber" />
            <ActionCard href="/admin/payments" icon={CreditCard} title="Payment Settings" desc="Set GoPay, bank, OVO, and crypto destinations." />
          </div>
        </section>

        <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <h2 className="text-sm font-bold text-white mb-3">Insights</h2>
          <div className="space-y-3">
            <ActionCard href="/admin/finance" icon={Landmark} title="Finance" desc="Revenue, gross margin, PAYG liability, and upstream cost." tone="emerald" />
            <ActionCard href="/admin/usage" icon={Activity} title="Usage" desc="Token usage, API key activity, and model distribution." tone="amber" />
          </div>
        </section>
      </div>
    </div>
  );
}
