import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-main text-white">
      <div className="max-w-3xl mx-auto px-4 py-20">
        <Link href="/" className="text-xs text-indigo-400 hover:text-indigo-300 mb-4 inline-block">&larr; Back to Home</Link>
        <h1 className="text-3xl font-black mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: July 2026</p>

        <div className="space-y-8 text-sm text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-white mb-3">1. Information We Collect</h2>
            <p>When you create an account, we collect:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Email address</li>
              <li>Name (optional)</li>
              <li>Chat history and conversation content</li>
              <li>API key usage data (tokens consumed, timestamps)</li>
            </ul>
            <p className="mt-2">We do NOT collect or store: payment card numbers, credit card details, or bank account credentials. Payment is processed manually via third-party services (GoPay, OVO, bank transfer, crypto).</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">2. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To provide and maintain the AI chat and API key service</li>
              <li>To track usage limits and enforce plan quotas</li>
              <li>To communicate about your account, upgrades, or issues via WhatsApp</li>
              <li>To improve the platform based on usage patterns</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">3. Data Storage & Security</h2>
            <p>All user data is stored in a secure SQLite database on our private server. We implement the following security measures:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Passwords are hashed using bcrypt (never stored in plain text)</li>
              <li>Session tokens are signed JWT with configurable expiry</li>
              <li>API keys are cryptographically generated</li>
              <li>Admin routes are IP-restricted</li>
              <li>Rate limiting prevents abuse</li>
            </ul>
            <p className="mt-2">Your chat data is stored to provide conversation history. You can delete conversations at any time from the sidebar.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">4. Data Sharing</h2>
            <p>We do NOT sell, rent, or share your personal data with third parties. Chat content is forwarded to AI model providers solely for generating responses. Conversations are not used to train models.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">5. Your Rights</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You can request deletion of your account and all associated data by contacting admin via WhatsApp</li>
              <li>You can delete individual conversations from the chat interface</li>
              <li>You can revoke API keys from your account settings</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">6. Cookies</h2>
            <p>We use an HTTP-only session cookie for authentication. This cookie is required for the service to function and does not track you across other websites.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">7. Contact</h2>
            <p>For privacy concerns or data deletion requests, contact us via WhatsApp at the number provided in your account dashboard.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
