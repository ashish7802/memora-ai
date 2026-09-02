import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FDFBF7] text-[#3C3C3B] p-4 font-sans">
      <h2 className="text-xl font-bold mb-2">Page Not Found</h2>
      <p className="text-sm text-[#8A817C] mb-4">The requested resource could not be found.</p>
      <Link
        href="/"
        className="px-4 py-2 bg-[#588157] text-white text-xs font-semibold rounded-xl hover:bg-[#466845] transition-colors"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}
