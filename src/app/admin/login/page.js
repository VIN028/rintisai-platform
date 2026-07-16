"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Lock, Mail, ArrowRight } from "lucide-react";
import { clearFieldValidity, handleFormInvalid } from "@/lib/form-validation";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminOtp, setAdminOtp] = useState("");
  const [otpRequired, setOtpRequired] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }
    if (otpRequired && !adminOtp.trim()) {
      setError("Admin OTP is required.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, adminOtp: otpRequired ? adminOtp : undefined, adminOnly: true }), credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sign in failed.");

      if (data.requiresAdminOtp) {
        setOtpRequired(true);
        setNotice("Enter the admin 2FA code to continue.");
        setLoading(false);
        return;
      }

      if (data.user?.role !== "ADMIN") {
        setError("This account does not have admin access. Please use the regular sign in page.");
        setLoading(false);
        return;
      }

      window.location.href = "/admin";
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card animate-fade-in">
        <div className="auth-card-glow" />
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 mb-4 text-indigo-400">
            <Shield size={36} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1">Admin Sign In</h1>
          <p className="text-sm text-gray-400 text-center">Owner access for RintisAI platform management.</p>
        </div>

        {error && <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 text-left">{error}</div>}
        {notice && <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-300 text-left">{notice}</div>}

        <form onSubmit={handleLogin} noValidate onInvalid={handleFormInvalid} onInput={clearFieldValidity}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <div className="input-container">
              <div className="input-icon"><Mail size={18} /></div>
              <input type="email" required data-label="Email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@email.com" className="auth-input" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-container">
              <div className="input-icon"><Lock size={18} /></div>
              <input type="password" required data-label="Password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="auth-input" />
            </div>
          </div>
          {otpRequired && (
            <div className="form-group">
              <label className="form-label">Admin 2FA Code</label>
              <div className="input-container">
                <div className="input-icon"><Lock size={18} /></div>
                <input type="text" inputMode="numeric" required data-label="Admin 2FA Code" value={adminOtp} onChange={e => setAdminOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code" className="auth-input" />
              </div>
            </div>
          )}
          <button type="submit" disabled={loading} className="auth-btn">
            {loading ? "Verifying..." : otpRequired ? "Verify OTP" : "Sign In"}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>
      </div>
    </div>
  );
}
