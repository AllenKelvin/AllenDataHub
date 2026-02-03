import { Link } from "wouter";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4 p-8">
        <div className="flex justify-center">
          <AlertCircle className="h-24 w-24 text-primary/20" />
        </div>
        <h1 className="text-4xl font-bold font-display text-gray-900">404 Page Not Found</h1>
        <p className="text-lg text-gray-600 max-w-md mx-auto">
          The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
        </p>
        <Link href="/">
          <button className="px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-all mt-4">
            Return to Dashboard
          </button>
        </Link>
      </div>
    </div>
  );
}
