"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";

export default function AdminPaymentsPage() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings").then((r) => r.json()).then((d) => {
      setSettings(d.settings || {});
      setLoading(false);
    });
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage("Payment details saved.");
    } catch (err) {
      setMessage("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const update = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  if (loading) return <main className="min-h-screen bg-main p-6 text-white">Loading...</main>;

  return (
    <main className="min-h-screen bg-main text-white p-4 md:p-6 overflow-y-auto">
      <div className="max-w-3xl mx-auto space-y-5">
        <header>
          <Link href="/admin" className="inline-flex items-center gap-2 text-xs text-gray-400 hover:text-white mb-3">
            <ArrowLeft size={14} />
            Back to Admin
          </Link>
          <h1 className="text-2xl font-black">Payment Settings</h1>
          <p className="text-sm text-gray-400 mt-1">These details will be shown to users during checkout.</p>
        </header>

        {message && <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">{message}</div>}

        <form onSubmit={handleSave} className="space-y-5">
          {[
            { key: "gopay", label: "GoPay", placeholder: "GoPay phone number", field: "gopay_number", enabledKey: "payment_gopay_enabled" },
            { key: "ovo", label: "OVO", placeholder: "OVO phone number", field: "ovo_number", enabledKey: "payment_ovo_enabled" },
          ].map((pm) => (
            <section key={pm.key} className="glass-panel rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold">{pm.label}</h2>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-[11px] text-gray-500">{settings[pm.enabledKey] !== "false" ? "Enabled" : "Disabled"}</span>
                  <input
                    type="checkbox"
                    checked={settings[pm.enabledKey] !== "false"}
                    onChange={(e) => update(pm.enabledKey, e.target.checked ? "true" : "false")}
                    className="sr-only peer"
                  />
                  <div className={`w-9 h-5 rounded-full transition-colors ${settings[pm.enabledKey] !== "false" ? "bg-indigo-600" : "bg-white/10"} relative`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings[pm.enabledKey] !== "false" ? "left-4" : "left-0.5"}`} />
                  </div>
                </label>
              </div>
              <input placeholder={pm.placeholder} value={settings[pm.field] || ""} onChange={(e) => update(pm.field, e.target.value)} className="w-full glass-input rounded-xl px-4 py-3 text-sm" />
            </section>
          ))}
          {[
            { key: "bank", label: "Bank Transfer", fields: [{ field: "bank_name", placeholder: "Bank name" }, { field: "bank_account", placeholder: "Account number" }, { field: "bank_holder", placeholder: "Account holder name" }], enabledKey: "payment_bank_enabled" },
            { key: "crypto", label: "Crypto (USDT)", fields: [{ field: "crypto_address", placeholder: "USDT wallet address" }, { field: "crypto_network", placeholder: "Network (TRC20, ERC20, etc)" }], enabledKey: "payment_crypto_enabled" },
          ].map((pm) => (
            <section key={pm.key} className="glass-panel rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold">{pm.label}</h2>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-[11px] text-gray-500">{settings[pm.enabledKey] !== "false" ? "Enabled" : "Disabled"}</span>
                  <input
                    type="checkbox"
                    checked={settings[pm.enabledKey] !== "false"}
                    onChange={(e) => update(pm.enabledKey, e.target.checked ? "true" : "false")}
                    className="sr-only peer"
                  />
                  <div className={`w-9 h-5 rounded-full transition-colors ${settings[pm.enabledKey] !== "false" ? "bg-indigo-600" : "bg-white/10"} relative`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings[pm.enabledKey] !== "false" ? "left-4" : "left-0.5"}`} />
                  </div>
                </label>
              </div>
              {pm.fields.map((f) => (
                <input key={f.field} placeholder={f.placeholder} value={settings[f.field] || ""} onChange={(e) => update(f.field, e.target.value)} className="w-full glass-input rounded-xl px-4 py-3 text-sm" />
              ))}
            </section>
          ))}

          <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/40 text-white font-semibold text-sm cursor-pointer flex items-center justify-center gap-2">
            <Save size={14} />
            {saving ? "Saving..." : "Save Payment Settings"}
          </button>
        </form>
      </div>
    </main>
  );
}
