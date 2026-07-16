"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Shield, Users, ShoppingCart, Activity, CreditCard, Heart, Wrench, LogOut, Landmark, Wallet, BookOpen } from "lucide-react";

const navGroups = [
  {
    label: "Overview",
    links: [{ href: "/admin", icon: Shield, label: "Dashboard", exact: true }],
  },
  {
    label: "Operations",
    links: [
      { href: "/admin/users", icon: Users, label: "Users" },
      { href: "/admin/upgrades", icon: ShoppingCart, label: "Upgrades" },
      { href: "/admin/cashouts", icon: Wallet, label: "Cashouts" },
    ],
  },
  {
    label: "Insights",
    links: [
      { href: "/admin/finance", icon: Landmark, label: "Finance" },
      { href: "/admin/usage", icon: Activity, label: "Usage" },
    ],
  },
  {
    label: "Settings",
    links: [
      { href: "/admin/tips", icon: BookOpen, label: "Tips Book" },
      { href: "/admin/payments", icon: CreditCard, label: "Payments" },
      { href: "/admin/health", icon: Heart, label: "Health" },
      { href: "/admin/maintenance", icon: Wrench, label: "Maintenance" },
    ],
  },
];

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, setPending] = useState({ upgrades: 0, cashouts: 0 });
  const [authed, setAuthed] = useState(null);
  const [navOpen, setNavOpen] = useState(false);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/admin/login");
    router.refresh();
  };

  useEffect(() => {
    if (pathname === "/admin/login") { setTimeout(() => setAuthed(true), 0); return; }
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d.user?.role === "ADMIN") {
        setAuthed(true);
        fetch("/api/admin/notifications").then(r => r.json()).then(d => setPending({ upgrades: d.upgradePending || 0, cashouts: d.cashoutPending || 0 }));
      } else { router.push("/admin/login"); }
    }).catch(() => router.push("/admin/login"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const isActive = (link) => link.exact ? pathname === link.href : pathname.startsWith(link.href);

  if (authed === null && pathname !== "/admin/login") return <div className="flex h-screen bg-main items-center justify-center text-gray-400">Loading...</div>;
  if (pathname === "/admin/login") return <>{children}</>;

  return (
    <div className="admin-shell flex h-screen overflow-hidden bg-main">
      {/* Mobile backdrop */}
      {navOpen && <div className="lg:hidden fixed inset-0 z-20 bg-black/50 backdrop-blur-sm" onClick={() => setNavOpen(false)} />}

      <nav className={`fixed lg:relative z-30 w-60 glass-panel flex flex-col shrink-0 h-full transition-transform duration-300 ${navOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2.5" onClick={() => setNavOpen(false)}>
            <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400 border border-indigo-500/20"><Shield size={16} /></div>
            <span className="font-bold text-white text-sm">RintisAI Admin</span>
          </Link>
          <button className="lg:hidden p-1 text-gray-400" onClick={() => setNavOpen(false)}>&times;</button>
        </div>
        <div className="p-3 flex-1 overflow-y-auto space-y-5">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">{group.label}</div>
              <div className="space-y-0.5">
                {group.links.map((link) => {
                  const active = isActive(link);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setNavOpen(false)}
                      className={`flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition ${active ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20" : "text-gray-400 hover:bg-white/5 hover:text-gray-200 border border-transparent"}`}
                    >
                      <span className="flex items-center gap-2.5">
                        <link.icon size={15} />{link.label}
                      </span>
                      {link.label === "Upgrades" && pending.upgrades > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white font-bold">{pending.upgrades}</span>
                      )}
                      {link.label === "Cashouts" && pending.cashouts > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white font-bold">{pending.cashouts}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-white/5 space-y-3">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/15 hover:text-red-200"
          >
            <LogOut size={14} />
            Logout
          </button>
          <Link href="/admin" className="block text-center text-[11px] text-gray-500 hover:text-gray-300 transition">RintisAI Admin</Link>
        </div>
      </nav>
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 relative">
        <button className="lg:hidden mb-3 p-1.5 rounded-lg bg-white/5 text-gray-400" onClick={() => setNavOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
        </button>
        {children}
      </main>
    </div>
  );
}
