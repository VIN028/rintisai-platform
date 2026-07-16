"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Mail, RefreshCw, XCircle } from "lucide-react";
import { clearFieldValidity, handleFormInvalid } from "@/lib/form-validation";

const normalizeEmailParam = (value) => {
  const email = String(value || "").trim().toLowerCase();
  if (!email) return "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
};

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const initialEmail = normalizeEmailParam(searchParams.get("email"));

  const getInitialState = () => {
    if (searchParams.get("verified") === "1") {
      return { status: "success", message: "Email verified. You can now continue using RintisAI." };
    }
    if (searchParams.get("error")) {
      return { status: "error", message: "Verification code is invalid or expired. Request a new one below." };
    }
    if (searchParams.get("sent") === "1") {
      return { status: "idle", message: "We sent a 6-digit verification code to your email." };
    }
    return { status: "idle", message: "Check your inbox for the 6-digit verification code." };
  };

  const [state, setState] = useState(getInitialState);
  const { status, message } = state;
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const successLink = useMemo(() => (status === "success" ? "/login" : "/"), [status]);

  const verify = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setState({ status: "error", message: "Email is required." });
      return;
    }
    if (!code.trim()) {
      setState({ status: "error", message: "Verification code is required." });
      return;
    }
    if (code.trim().length !== 6) {
      setState({ status: "error", message: "Please enter the 6-digit verification code." });
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to verify email.");
      setState({ status: "success", message: data.message || "Email verified. You can now sign in." });
      setCode("");
    } catch (err) {
      setState({ status: "error", message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setLoading(true);
    setState((current) => ({ ...current, status: "idle" }));
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to resend verification code.");
      setState({ status: "idle", message: data.message || "Verification code sent." });
    } catch (err) {
      setState({ status: "error", message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-main flex items-center justify-center p-4 text-white">
      <div className="glass-panel max-w-md w-full p-8 rounded-2xl text-center">
        <div className="mx-auto mb-5 w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-300">
          {status === "success" ? <CheckCircle2 size={24} /> : status === "error" ? <XCircle size={24} /> : <Mail size={24} />}
        </div>
        <h1 className="text-xl font-bold mb-2">Verify Your Email</h1>
        <p className="text-sm text-gray-400 mb-6">{message}</p>
        <div className="space-y-3">
          {status !== "success" && (
            <form onSubmit={verify} noValidate onInvalid={handleFormInvalid} onInput={clearFieldValidity} className="space-y-3 text-left">
              {!initialEmail && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-2">Email</label>
                  <input
                    type="email"
                    required
                    data-label="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@email.com"
                    className="w-full glass-input rounded-xl px-4 py-3 text-sm"
                  />
                </div>
              )}
              {initialEmail && (
                <div className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 text-xs text-gray-400">
                  <p className="font-medium text-gray-400">Verification code sent to:</p>
                  <p className="mt-1 break-all font-semibold text-white">{email}</p>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2">6-digit code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  data-label="Verification Code"
                  data-pattern-message="Please enter the 6-digit verification code."
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  className="w-full glass-input rounded-xl px-4 py-3 text-sm tracking-[0.35em]"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/[0.04] disabled:text-gray-500 text-white text-sm font-semibold transition"
              >
                {loading ? "Verifying..." : "Verify Code"}
              </button>
            </form>
          )}
          <button
            type="button"
            onClick={resend}
            disabled={loading || status === "success" || !email}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/[0.04] disabled:text-gray-500 text-white text-sm font-semibold transition flex items-center justify-center gap-2"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Resend Verification Code
          </button>
          <Link href={successLink} className="block text-sm text-gray-400 hover:text-white transition">
            {status === "success" ? "Go to sign in" : "Back to app"}
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-main flex items-center justify-center p-4 text-white"><div className="glass-panel max-w-md w-full p-8 rounded-2xl text-center"><p className="text-sm text-gray-400">Loading...</p></div></main>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
