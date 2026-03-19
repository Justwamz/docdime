import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "DocDime Privacy Policy — how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <Link href="/" className="text-blue-600 text-sm hover:underline mb-6 inline-block">
          ← Back to home
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-8">Last updated: March 2026</p>

        <div className="prose prose-gray max-w-none space-y-6 text-sm text-gray-600 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Information We Collect</h2>
            <p>We collect information you provide directly: name, email, business details, and payment information processed through Paystack. We also collect usage data to improve our service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">2. How We Use Your Information</h2>
            <p>We use collected information to provide and improve DocDime services, process payments, send transactional emails, and comply with legal obligations. We do not sell your personal data.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">3. Data Storage & Security</h2>
            <p>Documents and data are stored securely on AWS infrastructure with encryption at rest and in transit. We implement industry-standard security measures.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Data Retention</h2>
            <p>We retain your data for as long as your account is active or as needed to provide services. You may request data deletion at any time via your account settings.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Third-Party Services</h2>
            <p>We use Paystack for payment processing, AWS S3 for document storage, and Resend for email delivery. Each service has its own privacy policy.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Your Rights</h2>
            <p>You have the right to access, correct, or delete your personal data. Contact us at privacy@docdime.com for any data requests.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Contact</h2>
            <p>For privacy inquiries: privacy@docdime.com</p>
          </section>
        </div>
      </div>
    </div>
  );
}
