import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { getPricing } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "DocDime — Professional Business Document Generator",
  description:
    "Create professional invoices, quotes, and purchase orders in minutes. Pay $0.10/doc or go Pro at $2/month ($20/year). No subscriptions required.",
  other: {
    "application/ld+json": JSON.stringify([
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "DocDime",
        applicationCategory: "BusinessApplication",
        offers: {
          "@type": "Offer",
          price: "0.10",
          priceCurrency: "USD",
          description: "Pay per document",
        },
        description:
          "Professional business document generation SaaS — invoices, quotes, purchase orders.",
        operatingSystem: "Web",
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "How much does DocDime cost?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "DocDime offers pay-per-use at $0.10 per document, or a Pro plan at $2/month ($20/year, save 17%) which includes 20 free documents per month.",
            },
          },
          {
            "@type": "Question",
            name: "What document types can I create?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "You can create professional Invoices, Quotes/Proposals, and Purchase Orders with full PDF generation.",
            },
          },
        ],
      },
    ]),
  },
};

function getFeatures(docLabel: string, proMonthlyLabel: string) {
  return [
    {
      icon: "📄",
      title: "Professional PDFs",
      description:
        "Generate beautiful, branded PDF invoices, quotes, and purchase orders in seconds.",
    },
    {
      icon: "💰",
      title: "Pay Only What You Use",
      description:
        `No monthly lock-in. Pay ${docLabel} per document or upgrade to Pro for ${proMonthlyLabel}/month.`,
    },
    {
      icon: "🌍",
      title: "Multi-Currency Support",
      description:
        "Work with 30+ world currencies. Set your local currency once, bill globally.",
    },
    {
      icon: "👥",
      title: "Customer Management",
      description:
        "Save customer details and auto-fill documents. Track payment history per client.",
    },
    {
      icon: "🔄",
      title: "Quote to Invoice",
      description:
        "Convert accepted quotes to invoices with one click. No re-entry needed.",
    },
    {
      icon: "📊",
      title: "Dashboard Analytics",
      description:
        "See your revenue, outstanding invoices, and document stats at a glance.",
    },
  ];
}

function getSteps(docLabel: string) {
  return [
    { step: "1", title: "Create Account", desc: "Sign up free — no credit card required." },
    { step: "2", title: "Add Your Business", desc: "Enter your business details and banking info." },
    { step: "3", title: "Create a Document", desc: "Fill in customer, line items, and tax details." },
    { step: "4", title: "Pay & Download", desc: `Pay ${docLabel} and get your professional PDF instantly.` },
  ];
}

const faqs = [
  {
    q: "Is there a free trial?",
    a: "You can set up your account and create draft documents for free. You only pay when you generate the PDF.",
  },
  {
    q: "What payment methods are accepted?",
    a: "We accept all major cards and mobile money via Paystack (Visa, Mastercard and more).",
  },
  {
    q: "Can I cancel my Pro plan?",
    a: "Yes, cancel anytime. You keep access until the end of your billing period.",
  },
  {
    q: "Is my data secure?",
    a: "Yes. All documents are stored securely on AWS S3 with encryption. We never share your data.",
  },
  {
    q: "Can I use my own branding?",
    a: "Yes! Upload your business logo and it will appear on all your documents.",
  },
];

export default async function LandingPage() {
  const pricing = await getPricing();
  const docLabel = `$${pricing.docPriceUsd.toFixed(2)}`;
  const proMonthlyLabel = `$${pricing.proMonthlyUsd}`;
  const proAnnualLabel = `$${pricing.proAnnualUsd}`;

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 pb-20 px-4 sm:px-6 lg:px-8 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block"></span>
            Pay {docLabel}/doc — No subscriptions required
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
            Professional Business
            <br />
            <span className="text-blue-600">Documents in Minutes</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto">
            Create beautiful invoices, quotes, and purchase orders. Generate PDFs instantly.
            Built for SMEs across Africa and beyond.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="bg-blue-600 text-white px-8 py-3.5 rounded-xl font-semibold text-base hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 w-full sm:w-auto"
            >
              Get Started Free
            </Link>
            <Link
              href="#how-it-works"
              className="text-gray-600 px-8 py-3.5 rounded-xl font-medium text-base border border-gray-200 hover:bg-gray-50 transition-colors w-full sm:w-auto"
            >
              See How It Works
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-400">No credit card required • Free to sign up</p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 bg-gray-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 text-center">
            {[
              { value: docLabel, label: "Per document" },
              { value: `${proMonthlyLabel}/mo`, label: "Pro plan" },
              { value: "30+", label: "Currencies supported" },
              { value: "3", label: "Document types" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl font-bold text-blue-600">{stat.value}</p>
                <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Everything you need</h2>
            <p className="mt-3 text-lg text-gray-500">
              All the tools to create, manage, and track your business documents.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {getFeatures(docLabel, proMonthlyLabel).map((feature) => (
              <div
                key={feature.title}
                className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="text-3xl mb-3">{feature.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-500">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">How It Works</h2>
            <p className="mt-3 text-lg text-gray-500">Up and running in 4 simple steps.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {getSteps(docLabel).map((step) => (
              <div key={step.step} className="text-center">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  {step.step}
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{step.title}</h3>
                <p className="text-sm text-gray-500">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Simple Pricing</h2>
            <p className="mt-3 text-lg text-gray-500">
              Pay per document or go Pro. No surprises.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Pay per use */}
            <div className="bg-white rounded-2xl border border-gray-200 p-8">
              <h3 className="text-xl font-semibold text-gray-900">Pay Per Use</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-5xl font-bold text-gray-900">{docLabel}</span>
                <span className="text-gray-500">/ document</span>
              </div>
              <p className="mt-3 text-gray-500 text-sm">
                Only pay when you generate a PDF. No monthly commitment.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Unlimited drafts",
                  "Professional PDF generation",
                  "All document types",
                  "Customer management",
                  "Pay as you go",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-gray-600">
                    <svg className="w-4 h-4 text-green-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="mt-8 block text-center bg-gray-100 text-gray-900 py-3 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                Get Started Free
              </Link>
            </div>

            {/* Pro */}
            <div className="bg-blue-600 rounded-2xl p-8 text-white relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-yellow-400 text-yellow-900 text-xs font-bold px-2.5 py-0.5 rounded-full">
                BEST VALUE
              </div>
              <h3 className="text-xl font-semibold">Pro Plan</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-5xl font-bold">{proMonthlyLabel}</span>
                <span className="text-blue-200">/ month</span>
              </div>
              <p className="text-blue-200 text-sm">{proAnnualLabel}/year (save {pricing.annualDiscountPct}% vs monthly)</p>
              <p className="mt-3 text-blue-100 text-sm">
                {pricing.proMonthlyDocs} free documents per month, then {docLabel} each.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "20 free documents/month",
                  "Everything in Pay Per Use",
                  "Priority support",
                  "Advanced analytics",
                  "Custom banking details",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-blue-100">
                    <svg className="w-4 h-4 text-blue-200 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="mt-8 block text-center bg-white text-blue-600 py-3 rounded-xl font-semibold hover:bg-blue-50 transition-colors"
              >
                Start Pro Plan
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <div key={faq.q} className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-2">{faq.q}</h3>
                <p className="text-sm text-gray-500">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 bg-blue-600 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold">Ready to get started?</h2>
          <p className="mt-3 text-blue-100 text-lg">
            Join thousands of SMEs creating professional documents with DocDime.
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-block bg-white text-blue-600 px-8 py-3.5 rounded-xl font-semibold text-base hover:bg-blue-50 transition-colors"
          >
            Create Your Free Account
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
