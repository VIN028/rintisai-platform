"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";

export default function AdminPaymentsPage() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [activeMethod, setActiveMethod] = useState("gopay");

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
  const paymentMethods = [
    { key: "gopay", label: "GoPay", desc: "Mobile wallet number", fields: [{ field: "gopay_number", placeholder: "GoPay phone number" }], enabledKey: "payment_gopay_enabled" },
    { key: "ovo", label: "OVO", desc: "Mobile wallet number", fields: [{ field: "ovo_number", placeholder: "OVO phone number" }], enabledKey: "payment_ovo_enabled" },
    { key: "bank", label: "Bank Transfer", desc: "Bank account destination", fields: [{ field: "bank_name", placeholder: "Bank name" }, { field: "bank_account", placeholder: "Account number" }, { field: "bank_holder", placeholder: "Account holder name" }], enabledKey: "payment_bank_enabled" },
    { key: "crypto", label: "Crypto", desc: "USDT wallet destination", fields: [{ field: "crypto_address", placeholder: "USDT wallet address" }, { field: "crypto_network", placeholder: "Network (TRC20, ERC20, etc)" }], enabledKey: "payment_crypto_enabled" },
  ];
  const selectedMethod = paymentMethods.find((method) => method.key === activeMethod) || paymentMethods[0];

  if (loading) return <div className="text-sm text-gray-400">Loading payment settings...</div>;

  return (
    <div className="max-w-5xl space-y-5">
      <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white">Payment Settings</h1>
          <p className="text-sm text-gray-400 mt-1">Configure one payment channel at a time. Enabled channels appear during checkout.</p>
        </div>
        <button form="payment-settings-form" type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:bg-indigo-900/40 cursor-pointer">
          <Save size={14} />
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </header>

      {message && <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">{message}</div>}

      <form id="payment-settings-form" onSubmit={handleSave} className="grid lg:grid-cols-[220px_1fr] gap-4 items-start">
        <aside className="rounded-2xl border border-white/5 bg-white/[0.02] p-2 lg:sticky lg:top-6">
          {paymentMethods.map((method) => {
            const enabled = settings[method.enabledKey] !== "false";
            const active = activeMethod === method.key;
            return (
              <button key={method.key} type="button" onClick={() => setActiveMethod(method.key)} className={`w-full rounded-xl border px-3 py-3 text-left transition ${active ? "bg-indigo-500/10 border-indigo-500/20 text-white" : "border-transparent text-gray-400 hover:bg-white/[0.04] hover:text-gray-200"}`}>
                <span className="flex items-center justify-between gap-2 text-sm font-bold"><span>{method.label}</span><span className={enabled ? "text-[10px] text-emerald-300" : "text-[10px] text-gray-600"}>{enabled ? "On" : "Off"}</span></span>
                <span className="block text-[11px] text-gray-500 mt-0.5">{method.desc}</span>
              </button>
            );
          })}
        </aside>

        <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 space-y-5">
          <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-4">
            <div>
              <h2 className="font-bold text-white">{selectedMethod.label}</h2>
              <p className="text-xs text-gray-500 mt-1">{selectedMethod.desc}</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-[11px] text-gray-500">{settings[selectedMethod.enabledKey] !== "false" ? "Enabled" : "Disabled"}</span>
              <input type="checkbox" checked={settings[selectedMethod.enabledKey] !== "false"} onChange={(e) => update(selectedMethod.enabledKey, e.target.checked ? "true" : "false")} className="sr-only peer" />
              <div className={`w-9 h-5 rounded-full transition-colors ${settings[selectedMethod.enabledKey] !== "false" ? "bg-indigo-600" : "bg-white/10"} relative`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings[selectedMethod.enabledKey] !== "false" ? "left-4" : "left-0.5"}`} />
              </div>
            </label>
          </div>

          <div className="grid gap-3">
            {selectedMethod.fields.map((field) => (
              <input key={field.field} placeholder={field.placeholder} value={settings[field.field] || ""} onChange={(e) => update(field.field, e.target.value)} className="w-full glass-input rounded-xl px-4 py-3 text-sm" />
            ))}
          </div>
        </section>
      </form>
    </div>
  );
}
