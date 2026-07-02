"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Download } from "lucide-react";

function Skeleton() {
  return (
    <div className="animate-pulse space-y-3 p-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-white/5" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-white/5 rounded w-32" />
            <div className="h-2 bg-white/5 rounded w-48" />
          </div>
        </div>
      ))}
    </div>
  );
}

const filters = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
  { key: "suspended", label: "Suspended" },
  { key: "developer", label: "Developer" },
  { key: "free", label: "Free" },
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState("all");

  const fetchUsers = () => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => {
        const u = data.users || [];
        setAllUsers(u);
        setUsers(u);
        setLoading(false);
      });
  };

  useEffect(() => { fetchUsers(); }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (filter === "all") { setUsers(allUsers); return; }
    if (filter === "active") { setUsers(allUsers.filter((u) => u.subscription?.status === "active")); return; }
    if (filter === "inactive") { setUsers(allUsers.filter((u) => u.subscription?.status === "inactive")); return; }
    if (filter === "suspended") { setUsers(allUsers.filter((u) => u.subscription?.status === "suspended")); return; }
    if (filter === "developer") { setUsers(allUsers.filter((u) => u.subscription?.plan === "developer")); return; }
    if (filter === "free") { setUsers(allUsers.filter((u) => (u.subscription?.plan || "free") === "free")); return; }
  }, [filter, allUsers]);

  const toggleAll = () => {
    if (selected.size === users.length) { setSelected(new Set()); }
    else { setSelected(new Set(users.map((u) => u.id))); }
  };

  const toggleOne = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const bulkAction = async (action) => {
    if (selected.size === 0) return;
    setMsg("");
    try {
      const res = await fetch("/api/admin/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: [...selected], action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg(data.message);
      setSelected(new Set());
      fetchUsers();
    } catch (err) { setMsg("Error: " + err.message); }
  };

  if (loading) return <Skeleton />;

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Users</h1>
          <p className="text-sm text-gray-400 mt-1">{users.length} total users</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/api/admin/export?type=users" className="text-[11px] px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/5 text-gray-400 hover:text-gray-200 cursor-pointer flex items-center gap-1.5"><Download size={12} />CSV</a>
          <a href="/api/admin/export?type=usage" className="text-[11px] px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/5 text-gray-400 hover:text-gray-200 cursor-pointer flex items-center gap-1.5"><Download size={12} />Usage CSV</a>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-[11px] px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              filter === f.key
                ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30"
                : "bg-white/[0.04] border border-white/5 text-gray-400 hover:text-gray-200 hover:bg-white/[0.06]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {msg && <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-sm text-gray-300">{msg}</div>}

      {selected.size > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs">
          <span className="text-indigo-300 font-semibold">{selected.size} selected</span>
          <button onClick={() => bulkAction("activate")} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white cursor-pointer">Activate</button>
          <button onClick={() => bulkAction("suspend")} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white cursor-pointer">Suspend</button>
          <button onClick={() => bulkAction("delete")} className="px-3 py-1.5 rounded-lg bg-red-600 text-white cursor-pointer">Delete</button>
        </div>
      )}

      <div className="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/5 text-[10px] uppercase font-bold tracking-wider text-gray-500">
              <th className="p-3 text-left w-8"><input type="checkbox" checked={selected.size === users.length} onChange={toggleAll} /></th>
              <th className="p-3 text-left">User</th>
              <th className="p-3 text-left">Plan</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-right">API Keys</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className={`border-b border-white/5 hover:bg-white/[0.02] ${selected.has(user.id) ? "bg-indigo-500/5" : ""}`}>
                <td className="p-3"><input type="checkbox" checked={selected.has(user.id)} onChange={() => toggleOne(user.id)} /></td>
                <td className="p-3">
                  <div className="font-semibold text-white truncate max-w-[180px]">{user.name || "Unnamed"}</div>
                  <div className="text-[10px] text-gray-500 font-mono truncate max-w-[180px]">{user.email}</div>
                </td>
                <td className="p-3 text-gray-400 capitalize">{user.subscription?.plan || "free"}</td>
                <td className="p-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${user.subscription?.status === "active" ? "bg-emerald-500/10 text-emerald-300" : "bg-white/5 text-gray-400"}`}>
                    {user.subscription?.status}
                  </span>
                </td>
                <td className="p-3 text-right font-mono text-gray-400">{user.apiKeyCount}</td>
                <td className="p-3 text-right">
                  <Link href={`/admin/users/${user.id}`} className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 justify-end">
                    Edit <ArrowUpRight size={12} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
