"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, ShoppingCart, Activity, ArrowUpRight, CreditCard } from "lucide-react";

const formatNumber = (value) => Number(value || 0).toLocaleString("id-ID");

function Card({ label, value, sub }) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">{label}</p>
      <p className="text-2xl font-black mt-2 text-white">{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-1">{sub}</p>}
    </div>
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
        developerUsers: users.filter((u) => u.subscription?.plan === "developer").length,
        pendingUpgrades: requests.filter((r) => r.status === "pending").length,
        monthlyUsage: users.reduce((sum, u) => sum + (u.usage?.monthly || 0), 0),
      });
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-gray-400 text-sm">Loading...</div>;
  const s = stats || {};

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">Overview of your platform.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card label="Total Users" value={s.totalUsers} />
        <Card label="Active" value={s.activeUsers} sub={s.developerUsers + " dev"} />
        <Card label="Usage (30d)" value={formatNumber(s.monthlyUsage)} sub="units" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Link href="/admin/users" className="glass-card rounded-2xl p-5 hover:border-indigo-500/20 transition flex items-center justify-between">
          <div>
            <Users size={18} className="text-indigo-400 mb-2" />
            <h3 className="font-bold text-white text-sm">Users</h3>
            <p className="text-xs text-gray-400 mt-1">Manage accounts, plans, and limits</p>
          </div>
          <ArrowUpRight size={16} className="text-gray-600" />
        </Link>

        <Link href="/admin/upgrades" className="glass-card rounded-2xl p-5 hover:border-indigo-500/20 transition flex items-center justify-between">
          <div>
            <ShoppingCart size={18} className="text-emerald-400 mb-2" />
            <h3 className="font-bold text-white text-sm">Upgrades</h3>
            <p className="text-xs text-gray-400 mt-1">{s.pendingUpgrades} pending requests</p>
          </div>
          <ArrowUpRight size={16} className="text-gray-600" />
        </Link>

        <Link href="/admin/usage" className="glass-card rounded-2xl p-5 hover:border-indigo-500/20 transition flex items-center justify-between">
          <div>
            <Activity size={18} className="text-amber-400 mb-2" />
            <h3 className="font-bold text-white text-sm">Usage</h3>
            <p className="text-xs text-gray-400 mt-1">API key activity and metrics</p>
          </div>
          <ArrowUpRight size={16} className="text-gray-600" />
        </Link>

        <Link href="/admin/payments" className="glass-card rounded-2xl p-5 hover:border-indigo-500/20 transition flex items-center justify-between">
          <div>
            <CreditCard size={18} className="text-emerald-400 mb-2" />
            <h3 className="font-bold text-white text-sm">Payments</h3>
            <p className="text-xs text-gray-400 mt-1">Set payment destinations</p>
          </div>
          <ArrowUpRight size={16} className="text-gray-600" />
        </Link>
      </div>
    </div>
  );
}
