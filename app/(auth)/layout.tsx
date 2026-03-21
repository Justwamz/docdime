import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="mb-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold">D</span>
          </div>
          <span className="font-bold text-gray-900 text-xl">DocDime</span>
        </Link>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
