export default function TutorialsPage() {
  const tutorials = [
    {
      title: "Getting Started",
      description: "Learn how to set up your business profile and create your first document.",
      duration: "3 min",
      emoji: "🚀",
    },
    {
      title: "Creating an Invoice",
      description: "Step-by-step guide to creating a professional invoice with line items and taxes.",
      duration: "5 min",
      emoji: "📄",
    },
    {
      title: "Quote to Invoice Conversion",
      description: "How to send a quote and convert it to an invoice when accepted.",
      duration: "4 min",
      emoji: "🔄",
    },
    {
      title: "Managing Customers",
      description: "Add and manage your customer database for faster document creation.",
      duration: "2 min",
      emoji: "👥",
    },
    {
      title: "Setting Up Banking Details",
      description: "Add your banking information so it appears on invoices and POs.",
      duration: "2 min",
      emoji: "🏦",
    },
    {
      title: "Tax Configuration",
      description: "Set up VAT, GST, or any custom tax rates for your documents.",
      duration: "3 min",
      emoji: "🧾",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tutorials</h1>
        <p className="text-gray-500 text-sm mt-1">Learn how to get the most out of DocDime.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tutorials.map((tutorial) => (
          <div
            key={tutorial.title}
            className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="text-3xl mb-3">{tutorial.emoji}</div>
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-gray-900">{tutorial.title}</h3>
              <span className="text-xs text-gray-400 whitespace-nowrap">{tutorial.duration}</span>
            </div>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">{tutorial.description}</p>
            <button className="mt-3 text-sm text-blue-600 hover:underline font-medium">
              Read guide →
            </button>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
        <h2 className="font-semibold text-blue-900 mb-1">Need more help?</h2>
        <p className="text-sm text-blue-700">
          Contact our support team at{" "}
          <a href="mailto:support@docdime.com" className="underline">
            support@docdime.com
          </a>
        </p>
      </div>
    </div>
  );
}
