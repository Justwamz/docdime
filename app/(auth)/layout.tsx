import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="mb-8">
        <Link href="/">
          <img src="/logo.png" alt="DocDime" className="h-9 w-auto" />
        </Link>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
