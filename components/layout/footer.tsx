import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="mb-4">
              <img src="/logo.png" alt="DocDime" className="h-8 w-auto brightness-0 invert" />
            </div>
            <p className="text-sm leading-relaxed max-w-xs">
              Professional business document generation for SMEs. Create invoices, quotes, and purchase orders in minutes.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-white text-sm font-semibold mb-3">Product</h4>
            <ul className="space-y-2">
              <li><Link href="/#features" className="text-sm hover:text-white transition-colors">Features</Link></li>
              <li><Link href="/#pricing" className="text-sm hover:text-white transition-colors">Pricing</Link></li>
              <li><Link href="/signup" className="text-sm hover:text-white transition-colors">Get Started</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white text-sm font-semibold mb-3">Legal</h4>
            <ul className="space-y-2">
              <li><Link href="/privacy" className="text-sm hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-sm hover:text-white transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs">© {new Date().getFullYear()} DocDime. All rights reserved.</p>
          <p className="text-xs">Made for SMEs worldwide</p>
        </div>
      </div>
    </footer>
  );
}
