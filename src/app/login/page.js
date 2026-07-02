"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, Mail, ArrowRight, Bot } from "lucide-react";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to sign in.");
      }

      router.push(redirect);
      router.refresh();
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

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <div className="input-container">
              <div className="input-icon">
                <Mail size={18} />
              </div>
              <input
                type="email"
                required
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
            {loading ? "Verifying..." : "Sign In"}
            {!loading && <ArrowRight size={16} />}
          </button>

          <div className="mt-4 relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
            <div className="relative flex justify-center text-xs"><span className="px-2 bg-[#090b14] text-gray-500">or</span></div>
          </div>

          <a href="/api/auth/google" className="w-full mt-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 font-medium text-sm transition text-center flex items-center justify-center gap-2 cursor-pointer">
            <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </a>
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
