"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Mail, User, Bot, ArrowRight } from "lucide-react";
import { clearFieldValidity, handleFormInvalid } from "@/lib/form-validation";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setVerificationEmail("");
    if (!name.trim()) {
      setError("Full Name is required.");
      return;
    }
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, website: "" }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.needsVerification && data.email) {
          setVerificationEmail(data.email);
        }
        throw new Error(data.error || "Failed to create account.");
      }

      if (data.requiresVerification) {
        router.push(`/verify-email?email=${encodeURIComponent(data.email || email)}&sent=1`);
      } else {
        router.push("/");
      }
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resendVerification = async () => {
    if (!verificationEmail) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: verificationEmail }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to resend verification code.");
      setSuccess(data.message || "Verification code sent.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card animate-fade-in">
        {/* Glow accent */}
        <div className="auth-card-glow-emerald" />

        <div className="flex flex-col items-center mb-8" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
          <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 mb-4 text-emerald-400" style={{ padding: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '1rem', border: '1px solid rgba(16, 185, 129, 0.2)', marginBottom: '1rem', color: '#34d399' }}>
            <Bot size={36} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', marginBottom: '0.25rem' }}>Create Account</h1>
          <p className="text-sm text-gray-400 text-center" style={{ fontSize: '0.875rem', color: '#9ca3af' }}>Create your account first, then verify your email with a 6-digit code.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400" style={{ marginBottom: '1.5rem', padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.875rem', color: '#f87171', textAlign: 'left' }}>
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400" style={{ marginBottom: '1.5rem', padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '0.875rem', color: '#34d399', textAlign: 'left' }}>
            {success}
          </div>
        )}

        {verificationEmail && (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-100 space-y-3">
            <p>This email is already registered but not verified yet.</p>
            <p className="font-semibold break-all">{verificationEmail}</p>
            <div className="flex gap-2">
              <Link href={`/verify-email?email=${encodeURIComponent(verificationEmail)}`} className="flex-1 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-center text-sm font-medium transition">
                Verify Email
              </Link>
              <button type="button" onClick={resendVerification} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 disabled:bg-white/[0.04] text-sm font-medium transition cursor-pointer">
                Resend Code
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleRegister} noValidate onInvalid={handleFormInvalid} onInput={clearFieldValidity}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <div className="input-container">
              <div className="input-icon">
                <User size={18} />
              </div>
              <input
                type="text"
                required
                data-label="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Budi Santoso"
                className="auth-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <div className="input-container">
              <div className="input-icon">
                <Mail size={18} />
              </div>
              <input
                type="email"
                required
                data-label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="auth-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-container">
              <div className="input-icon">
                <Lock size={18} />
              </div>
              <input
                type="password"
                required
                minLength={8}
                data-label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="auth-input"
              />
            </div>
            <PasswordStrength password={password} />
          </div>

          <div style={{ position: "absolute", left: "-9999px" }} aria-hidden="true">
            <input type="text" name="website" tabIndex={-1} autoComplete="off" />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="auth-btn auth-btn-emerald"
          >
            {loading ? "Creating..." : "Create Account"}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-gray-400" style={{ marginTop: '2rem', fontSize: '0.75rem', color: '#9ca3af' }}>
          Already have an account?{" "}
          <Link href="/login" className="text-emerald-400 hover:text-emerald-300 font-semibold underline transition" style={{ color: '#34d399', fontWeight: '600', textDecoration: 'underline' }}>
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
}

function PasswordStrength({ password }) {
  if (!password) return null;
  const len = password.length;
  let strength = 0;
  if (len >= 8) strength++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  if (/[^A-Za-z0-9]/.test(password)) strength++;
  const label = strength <= 1 ? "Weak" : strength === 2 ? "Fair" : strength === 3 ? "Good" : "Strong";
  const color = strength <= 1 ? "bg-red-500" : strength === 2 ? "bg-amber-500" : strength === 3 ? "bg-indigo-500" : "bg-emerald-500";
  return (
    <div className="mt-1">
      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${(strength / 4) * 100}%` }} />
      </div>
      <span className="text-[10px] text-gray-500 mt-0.5 block">{label}</span>
    </div>
  );
}
