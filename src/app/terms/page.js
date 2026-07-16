import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-main text-white">
      <div className="max-w-3xl mx-auto px-4 py-20">
        <Link href="/" className="text-xs text-indigo-400 hover:text-indigo-300 mb-4 inline-block">&larr; Back to Home</Link>
        <h1 className="text-3xl font-black mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: July 2026</p>

        <div className="space-y-8 text-sm text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-white mb-3">1. Acceptance of Terms</h2>
            <p>By creating an account or using RintisAI, you agree to these Terms of Service. If you do not agree, do not use the service.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">2. Service Description</h2>
            <p>RintisAI is an AI-powered chat and developer API platform. We provide:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Web-based AI chat interface</li>
              <li>Local API keys for integration with developer tools</li>
              <li>Usage tracking and plan-based limits</li>
            </ul>
            <p className="mt-2">RintisAI is an independent service. We are not affiliated with, endorsed by, or partnered with any specific AI model provider.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">3. Account Requirements</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You must provide accurate registration information</li>
              <li>You are responsible for maintaining the security of your account and API keys</li>
              <li>Sharing accounts or API keys is not permitted</li>
              <li>One person per account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">4. Acceptable Use</h2>
            <p>You agree NOT to use RintisAI for:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Illegal activities or generation of illegal content</li>
              <li>Harassment, hate speech, or harmful content</li>
              <li>Automated scraping, excessive API calls that bypass rate limits</li>
              <li>Reselling or redistributing the service without authorization</li>
              <li>Attempting to reverse engineer or exploit the platform</li>
              <li>Generating spam, phishing content, or malware</li>
            </ul>
            <p className="mt-2">Violation of these terms may result in immediate account suspension without refund.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">5. Plans & Payments</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Plans are subscription-based with 3-day, weekly, or monthly limits on usage</li>
              <li>Payment is processed manually via GoPay, OVO, bank transfer, or cryptocurrency</li>
              <li>Upgrades and top-ups are processed by admin review (typically 1-24 hours)</li>
              <li>Claude API PAYG balance can be cashed out only by manual request to admin and after account/payment review, with a minimum cash-out amount of $1.00 and only one active request at a time</li>
              <li>All payments are final and non-refundable unless otherwise agreed</li>
              <li>We reserve the right to modify plan pricing with notice</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">6. API Key Usage</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>API keys are provided for personal use with your own developer tools</li>
              <li>You are responsible for all usage made with your API keys</li>
              <li>API keys have usage limits based on your plan</li>
              <li>We reserve the right to revoke API keys that exceed reasonable usage</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">7. Service Availability</h2>
            <p>While we strive for high uptime, the service is provided &quot;as is&quot; without warranty of uninterrupted availability. We are not liable for damages resulting from service interruption.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">8. Limitation of Liability</h2>
            <p>RintisAI and its operators shall not be liable for any indirect, incidental, or consequential damages arising from the use of the service, including but not limited to loss of data, business interruption, or AI-generated content inaccuracies.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">9. Changes to Terms</h2>
            <p>We may update these terms at any time. Continued use of the service after changes constitutes acceptance of the new terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">10. Contact</h2>
            <p>For questions about these terms, contact us via WhatsApp at the number provided in your account dashboard.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
