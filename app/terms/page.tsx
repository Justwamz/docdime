import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "DocDime Terms of Service — your rights and obligations as a user.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <Link href="/" className="text-blue-600 text-sm hover:underline mb-6 inline-block">
          ← Back to home
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-400 mb-8">Last updated: March 2026</p>

        <div className="space-y-6 text-sm text-gray-600 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Acceptance of Terms</h2>
            <p>By using DocDime, you agree to these Terms of Service. If you do not agree, please discontinue use of the service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Service Description</h2>
            <p>DocDime provides a software-as-a-service platform for generating business documents (invoices, quotes, purchase orders). Service availability is provided &quot;as is&quot; and we do not guarantee uninterrupted service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">3. Payments & Refunds</h2>
            <p>Pay-per-use charges ($0.11/document) are non-refundable once a PDF has been generated. Pro plan subscriptions are billed annually and cancellable with access until the end of the billing period. Refund requests reviewed on a case-by-case basis.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">4. User Responsibilities</h2>
            <p>You are responsible for the accuracy of documents you create. DocDime does not verify document content. You must not use DocDime for fraudulent purposes.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Intellectual Property</h2>
            <p>Documents you create remain yours. DocDime retains rights to the platform, design, and technology.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Account Termination</h2>
            <p>We reserve the right to terminate accounts that violate these terms or engage in abusive behavior. You may delete your account at any time from your settings.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Limitation of Liability</h2>
            <p>DocDime&apos;s liability is limited to the amount paid for the service in the preceding 12 months. We are not liable for indirect, incidental, or consequential damages.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Contact</h2>
            <p>For terms inquiries: legal@docdime.com</p>
          </section>
        </div>
      </div>
    </div>
  );
}
