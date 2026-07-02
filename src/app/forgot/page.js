"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, ArrowRight, RefreshCw } from "lucide-react";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const submitCode = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setSent(true);
      setCooldown(60);
      const timer = setInterval(() => setCooldown((c) => { if (c <= 1) { clearInterval(timer); return 0; } return c - 1; }), 1000);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleSubmit = (e) => { e.preventDefault(); submitCode(); };

  return (
    <div className="auth-wrapper">
      <div className="auth-card animate-fade-in">
        <div className="auth-card-glow" />
        <div className="flex flex-col items-center mb-8" style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:"2rem"}}>
          <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 mb-4 text-indigo-400" style={{padding:"0.75rem",backgroundColor:"rgba(99,102,241,0.1)",borderRadius:"1rem",border:"1px solid rgba(99,102,241,0.2)",marginBottom:"1rem",color:"#818cf8"}}><Mail size={36} /></div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1" style={{fontSize:"1.5rem",fontWeight:"bold",color:"white",marginBottom:"0.25rem"}}>Forgot Password</h1>
          <p className="text-sm text-gray-400 text-center" style={{fontSize:"0.875rem",color:"#9ca3af"}}>Enter your email to receive a reset code.</p>
        </div>

        {error && <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 text-left" style={{marginBottom:"1.5rem",padding:"1rem",borderRadius:"0.75rem",backgroundColor:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.2)",fontSize:"0.875rem",color:"#f87171"}}>{error}</div>}

        {sent ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-300 text-left" style={{padding:"1rem",borderRadius:"0.75rem",backgroundColor:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.2)"}}>
              If an account with this email exists, a reset code has been sent.<br />
              <span className="text-gray-400 text-xs mt-1 block">Check your inbox and spam folder. If you do not receive it, the email may not be registered.</span>
            </div>

            <button
              onClick={submitCode}
              disabled={loading || cooldown > 0}
              className="w-full py-2.5 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-40 text-gray-300 font-medium text-sm transition text-center flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              {cooldown > 0 ? `Resend available in ${cooldown}s` : "Resend Code"}
            </button>

            <Link href="/reset" className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition text-center flex items-center justify-center gap-2" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"0.5rem"}}>
              Go to Reset Page <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <div className="input-container">
                <div className="input-icon"><Mail size={18} /></div>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@email.com" className="auth-input" />
              </div>
            </div>
            <button type="submit" disabled={loading} className="auth-btn">{loading ? "Sending..." : "Send Reset Code"}</button>
          </form>
        )}

        <p className="mt-8 text-center text-xs text-gray-400" style={{marginTop:"2rem",fontSize:"0.75rem",color:"#9ca3af"}}>
          <Link href="/login" className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-semibold underline transition" style={{color:"#818cf8",fontWeight:"600",textDecoration:"underline"}}>
            <ArrowLeft size={12} /> Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
