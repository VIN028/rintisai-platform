"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, Mail, ArrowRight, Bot } from "lucide-react";
import { clearFieldValidity, handleFormInvalid } from "@/lib/form-validation";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [adminOtp, setAdminOtp] = useState("");
  const [otpRequired, setOtpRequired] = useState(false);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!data?.user) return;
        router.replace(data.user.role === "ADMIN" ? "/admin" : "/");
      })
      .catch(() => {});
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setVerificationEmail("");
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }
    if (otpRequired && !adminOtp.trim()) {
      setError("Admin 2FA code is required.");
      return;
    }
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, adminOtp: otpRequired ? adminOtp : undefined }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.needsVerification && data.email) {
          setVerificationEmail(data.email);
        }
        throw new Error(data.error || "Failed to sign in.");
      }

      if (data.requiresAdminOtp) {
        setOtpRequired(true);
        setNotice("Enter the admin 2FA code to continue.");
        return;
      }

      router.push(data.user?.role === "ADMIN" ? "/admin" : redirect);
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
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: verificationEmail }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to resend verification code.");
      setError(data.message || "Verification code sent.");
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
        <div className="auth-card-glow" />

        <div className="flex flex-col items-center mb-8" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
          <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 mb-4 text-indigo-400" style={{ padding: '0.75rem', backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: '1rem', border: '1px solid rgba(99, 102, 241, 0.2)', marginBottom: '1rem', color: '#818cf8' }}>
            <Bot size={36} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', marginBottom: '0.25rem' }}>RintisAI Platform</h1>
          <p className="text-sm text-gray-400 text-center" style={{ fontSize: '0.875rem', color: '#9ca3af' }}>Sign in to access AI chat and developer tools</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400" style={{ marginBottom: '1.5rem', padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.875rem', color: '#f87171', textAlign: 'left' }}>
            {error}
          </div>
        )}

        {notice && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-300" style={{ marginBottom: '1.5rem', padding: '1rem', borderRadius: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '0.875rem', color: '#6ee7b7', textAlign: 'left' }}>
            {notice}
          </div>
        )}

        {verificationEmail && (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-100 space-y-3">
            <p>Verification is still pending for <span className="font-semibold">{verificationEmail}</span>.</p>
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

        <form onSubmit={handleLogin} noValidate onInvalid={handleFormInvalid} onInput={clearFieldValidity}>
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

          {otpRequired && (
            <div className="form-group">
              <label className="form-label">Admin 2FA Code</label>
              <div className="input-container">
                <div className="input-icon">
                  <Lock size={18} />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  data-label="Admin 2FA Code"
                  value={adminOtp}
                  onChange={(e) => setAdminOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6-digit code"
                  className="auth-input"
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-container">
              <div className="input-icon">
                <Lock size={18} />
              </div>
              <input
                type="password"
                required
                data-label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="auth-input"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="auth-btn"
          >
            {loading ? "Verifying..." : otpRequired ? "Verify 2FA" : "Sign In"}
            {!loading && <ArrowRight size={16} />}
          </button>

        </form>

        <p className="mt-8 text-center text-xs text-gray-400" style={{ marginTop: '2rem', fontSize: '0.75rem', color: '#9ca3af' }}>
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-indigo-400 hover:text-indigo-300 font-semibold underline transition" style={{ color: '#818cf8', fontWeight: '600', textDecoration: 'underline' }}>
            Create Account
          </Link>
        </p>
        <p className="mt-3 text-center text-xs text-gray-500">
          <Link href="/forgot" className="text-gray-400 hover:text-gray-300 underline transition">
            Forgot password?
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="auth-wrapper"><div className="auth-card animate-fade-in"><p className="text-gray-400 text-sm">Loading...</p></div></div>}>
      <LoginForm />
    </Suspense>
  );
}
