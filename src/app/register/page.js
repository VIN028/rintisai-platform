"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Mail, User, Bot, ArrowRight } from "lucide-react";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
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
        throw new Error(data.error || "Failed to create account.");
      }

      window.location.href = "/";
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
        <div className="auth-card-glow-emerald" />

        <div className="flex flex-col items-center mb-8" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
          <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 mb-4 text-emerald-400" style={{ padding: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '1rem', border: '1px solid rgba(16, 185, 129, 0.2)', marginBottom: '1rem', color: '#34d399' }}>
            <Bot size={36} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', marginBottom: '0.25rem' }}>Create Account</h1>
          <p className="text-sm text-gray-400 text-center" style={{ fontSize: '0.875rem', color: '#9ca3af' }}>Create an account to start with free access. Upgrade anytime for more.</p>
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

        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <div className="input-container">
              <div className="input-icon">
                <User size={18} />
              </div>
              <input
                type="text"
                required
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
