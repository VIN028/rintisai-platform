import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-main flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-6xl font-black text-indigo-400 mb-4">404</p>
        <h1 className="text-xl font-bold text-white mb-2">Page Not Found</h1>
        <p className="text-sm text-gray-400 mb-6">The page you are looking for does not exist or has been moved.</p>
        <Link href="/" className="inline-flex px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold">Go Home</Link>
      </div>
    </main>
  );
}
