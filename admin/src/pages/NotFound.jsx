import { Link } from "react-router-dom";

/** Catch-all page for unknown admin URLs (App.jsx path="*"), inside the usual admin shell. */
export default function NotFound() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <p className="text-6xl font-bold text-gray-200">404</p>
      <h1 className="mt-3 text-xl font-bold text-gray-800">Page not found</h1>
      <p className="mt-2 text-sm text-gray-500">
        This admin page doesn&apos;t exist. It may have been renamed, or the link may be mistyped.
      </p>
      <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
        <Link to="/" className="bg-gray-900 text-white rounded px-4 py-2 text-sm hover:bg-gray-800">
          Go to Dashboard
        </Link>
        <Link
          to="/orders"
          className="bg-gray-200 text-gray-700 rounded px-4 py-2 text-sm hover:bg-gray-300"
        >
          View Orders
        </Link>
      </div>
    </div>
  );
}
