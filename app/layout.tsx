import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: {
    default: "DocDime — Professional Business Document Generator",
    template: "%s | DocDime",
  },
  description:
    "Create professional invoices, quotes, and purchase orders in minutes. Pay only $0.10/doc or go Pro for $2/month.",
  keywords: [
    "invoice generator",
    "quote generator",
    "purchase order",
    "business documents",
    "SME tools",
    "invoice software",
    "free invoice",
  ],
  authors: [{ name: "DocDime" }],
  creator: "DocDime",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://docdime.com"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "DocDime",
    title: "DocDime — Professional Business Document Generator",
    description:
      "Create professional invoices, quotes, and purchase orders in minutes. Pay only $0.10/doc or go Pro for $2/month.",
  },
  twitter: {
    card: "summary_large_image",
    title: "DocDime — Professional Business Document Generator",
    description: "Create professional invoices, quotes, and purchase orders in minutes.",
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DocDime",
    startupImage: "/icons/apple-touch-icon.png",
  },
  icons: {
    shortcut: "/favicon.png",
    apple: "/icons/apple-touch-icon.png",
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  formatDetection: { telephone: false },
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2563eb" },
    { media: "(prefers-color-scheme: dark)", color: "#1d4ed8" },
  ],
  other: { "mobile-web-app-capable": "yes" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
