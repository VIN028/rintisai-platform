"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock, Mail, ArrowRight, RefreshCw } from "lucide-react";
import { clearFieldValidity, handleFormInvalid } from "@/lib/form-validation";

export default function ResetPage() {
  const router = useRouter();
  const initialEmailState = () => {
    if (typeof window === "undefined") return { email: "", fromLink: false };
    const queryEmail = (new URLSearchParams(window.location.search).get("email") || "").trim().toLowerCase();
    const storedEmail = (window.sessionStorage.getItem("rintisai:resetEmail") || "").trim().toLowerCase();
    const candidate = queryEmail || storedEmail;
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate);
    return { email: valid ? candidate : "", fromLink: valid };
  };
  const [initialEmail] = useState(initialEmailState);
  const [email, setEmail] = useState(initialEmail.email);
  const [emailFromLink, setEmailFromLink] = useState(initialEmail.fromLink);
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [resetComplete, setResetComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const startCooldown = () => {
    setCooldown(60);
    const timer = setInterval(() => setCooldown((current) => {
      if (current <= 1) {
        clearInterval(timer);
        return 0;
      }
      return current - 1;
    }), 1000);
  };

  const resendCode = async () => {
    setError("");
    setMessage("");
    setResetComplete(false);
    setResending(true);
    try {
      const res = await fetch("/api/auth/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resend reset code.");
      if (typeof window !== "undefined") window.sessionStorage.setItem("rintisai:resetEmail", email.trim().toLowerCase());
      setResetCode("");
      setMessage("A new reset code has been sent. Use the newest email code; older reset codes no longer work.");
      startCooldown();
    } catch (err) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setMessage(""); setResetComplete(false);
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (!resetCode.trim()) {
      setError("Reset Code is required.");
      return;
    }
    if (!newPassword) {
      setError("New Password is required.");
      return;
    }
    if (newPassword.length < 8) {
      setError("New Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, resetCode, newPassword }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      if (typeof window !== "undefined") window.sessionStorage.removeItem("rintisai:resetEmail");
      setMessage("Password reset successfully. Redirecting to sign in...");
      setResetComplete(true);
      setTimeout(() => router.push("/login"), 1500);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card animate-fade-in">
        <div className="auth-card-glow-emerald" />
        <div className="flex flex-col items-center mb-8" style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:"2rem"}}>
          <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 mb-4 text-emerald-400" style={{padding:"0.75rem",backgroundColor:"rgba(16,185,129,0.1)",borderRadius:"1rem",border:"1px solid rgba(16,185,129,0.2)",marginBottom:"1rem",color:"#34d399"}}><Lock size={36} /></div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1" style={{fontSize:"1.5rem",fontWeight:"bold",color:"white",marginBottom:"0.25rem"}}>Reset Password</h1>
          <p className="text-sm text-gray-400 text-center" style={{fontSize:"0.875rem",color:"#9ca3af"}}>{emailFromLink ? "Enter the reset code sent to your email and choose a new password." : "Enter your email, reset code, and new password."}</p>
        </div>

        {error && <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 text-left" style={{marginBottom:"1.5rem",padding:"1rem",borderRadius:"0.75rem",backgroundColor:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.2)",fontSize:"0.875rem",color:"#f87171"}}>{error}</div>}
        {message && !resetComplete && <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-300 text-left" style={{marginBottom:"1.5rem",padding:"1rem",borderRadius:"0.75rem",backgroundColor:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.2)"}}>{message}</div>}
        {resetComplete ? (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-300 text-left" style={{padding:"1rem",borderRadius:"0.75rem",backgroundColor:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.2)"}}>{message}</div>
        ) : (
          <form onSubmit={handleSubmit} noValidate onInvalid={handleFormInvalid} onInput={clearFieldValidity}>
            {emailFromLink ? (
              <div className="mb-5 p-3 rounded-xl bg-white/[0.03] border border-white/10 text-left">
                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1">Resetting password for</p>
                <p className="text-sm text-white font-mono break-all">{email}</p>
                <button type="button" onClick={resendCode} disabled={resending || cooldown > 0} className="mt-3 inline-flex items-center gap-1.5 text-xs text-indigo-300 hover:text-indigo-200 disabled:opacity-50 disabled:hover:text-indigo-300">
                  <RefreshCw size={12} className={resending ? "animate-spin" : ""} />
                  {cooldown > 0 ? `New code available in ${cooldown}s` : "Send New Code"}
                </button>
              </div>
            ) : (
              <div className="form-group"><label className="form-label">Email</label><div className="input-container"><div className="input-icon"><Mail size={18} /></div><input type="email" required data-label="Email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@email.com" className="auth-input" /></div></div>
            )}
            <div className="form-group"><label className="form-label">Reset Code</label><input type="text" required data-label="Reset Code" value={resetCode} onChange={e=>setResetCode(e.target.value)} placeholder="8-character code from email" className="auth-input pl-4" /></div>
            <div className="form-group"><label className="form-label">New Password</label><div className="input-container"><div className="input-icon"><Lock size={18} /></div><input type="password" required minLength={8} data-label="New Password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="At least 8 characters" className="auth-input" /></div></div>
            <button type="submit" disabled={loading} className="auth-btn auth-btn-emerald">{loading ? "Resetting..." : "Reset Password"}{!loading && <ArrowRight size={16} />}</button>
          </form>
        )}

        <p className="mt-8 text-center text-xs text-gray-400" style={{marginTop:"2rem",fontSize:"0.75rem",color:"#9ca3af"}}>
          <Link href="/login" className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-semibold underline transition" style={{color:"#818cf8",fontWeight:"600",textDecoration:"underline"}}><ArrowLeft size={12} /> Back to Sign In</Link>
        </p>
      </div>
    </div>
  );
}
