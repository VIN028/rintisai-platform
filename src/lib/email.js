import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM || "RintisAI <noreply@rintisai.my.id>";

export async function sendEmail({ to, subject, html }) {
  if (!resend) {
    console.log("[EMAIL] Not configured. Would send:", subject, "to", to);
    return { ok: false, error: "Email not configured" };
  }
  try {
    const result = await resend.emails.send({ from: FROM, to, subject, html });
    return { ok: true, id: result.data?.id };
  } catch (err) {
    console.error("[EMAIL] Error:", err.message);
    return { ok: false, error: err.message };
  }
}

export function welcomeEmail(name) {
  return {
    subject: "Welcome to RintisAI!",
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#6366f1">Welcome to RintisAI, ${name || "there"}!</h2>
      <p>Your free account is ready. Start chatting with AI models right away.</p>
      <a href="${process.env.NEXT_PUBLIC_URL || "http://localhost:3001"}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:12px">Open RintisAI</a>
      <p style="color:#9ca3af;font-size:13px;margin-top:24px">— RintisAI Team</p>
    </div>`,
  };
}

export function verifyEmail(token) {
  const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3001";
  const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`;

  return {
    subject: "Verify your RintisAI email",
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#6366f1">Verify Your Email</h2>
      <p>Click the button below to verify your RintisAI account.</p>
      <a href="${verifyUrl}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:12px">Verify Email</a>
      <p style="color:#6b7280;font-size:13px;margin-top:16px">This link expires in 24 hours.</p>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px;word-break:break-all">If the button does not work, open this link: ${verifyUrl}</p>
    </div>`,
  };
}

export function resetCodeEmail(code) {
  return {
    subject: "Password Reset Code — RintisAI",
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#6366f1">Reset Your Password</h2>
      <p>Use this code to reset your password:</p>
      <div style="background:#f3f4f6;padding:16px;border-radius:8px;text-align:center;margin:16px 0">
        <span style="font-size:28px;font-weight:bold;letter-spacing:4px;color:#1f2937">${code}</span>
      </div>
      <p style="color:#9ca3af;font-size:13px">This code expires in 1 hour. If you didn't request this, ignore this email.</p>
    </div>`,
  };
}

export function upgradeEmail(plan) {
  return {
    subject: `Plan Activated — RintisAI ${plan} Plan`,
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#059669">Your ${plan} Plan is Active!</h2>
      <p>Your upgrade has been processed. Enjoy your new limits and features.</p>
      <a href="${process.env.NEXT_PUBLIC_URL || "http://localhost:3001"}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:12px">Open RintisAI</a>
      <p style="color:#9ca3af;font-size:13px;margin-top:24px">— RintisAI Team</p>
    </div>`,
  };
}
