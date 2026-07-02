"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Mail, RefreshCw, XCircle } from "lucide-react";

export default function VerifyEmailPage() {
  const getInitialState = () => {
    if (typeof window === "undefined") return { status: "idle", message: "Check your inbox for a verification link." };
    const params = new URLSearchParams(window.location.search);
    if (params.get("verified") === "1") {
      return { status: "success", message: "Email verified. You can now continue using RintisAI." };
    }
    if (params.get("error")) {
      return { status: "error", message: "Verification link is invalid or expired. Request a new one below." };
    }
    return { status: "idle", message: "Check your inbox for a verification link." };
  };

  const [state, setState] = useState(getInitialState);
  const { status, message } = state;
  const [loading, setLoading] = useState(false);

  const resend = async () => {
    setLoading(true);
    setState((current) => ({ ...current, status: "idle" }));
    try {
      const response = await fetch("/api/auth/resend-verification", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to resend verification email.");
      setState({ status: "idle", message: data.message || "Verification email sent." });
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
          <button
            type="button"
            onClick={resend}
            disabled={loading || status === "success"}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/[0.04] disabled:text-gray-500 text-white text-sm font-semibold transition flex items-center justify-center gap-2"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Resend Verification Email
          </button>
          <Link href="/" className="block text-sm text-gray-400 hover:text-white transition">
            Back to app
          </Link>
        </div>
      </div>
    </main>
  );
}
