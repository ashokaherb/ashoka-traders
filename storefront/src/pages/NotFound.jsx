import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

/**
 * Catch-all page for URLs that don't match any route (App.jsx path="*"). Vercel sends every
 * unknown path to index.html for client-side routing, so without this a mistyped or dead
 * link rendered the header and footer with nothing in between.
 */
export default function NotFound() {
  return (
    <div className="bg-cream min-h-screen">
      <Helmet>
        <title>Page not found - Aashoka Traders</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="max-w-xl mx-auto px-4 py-16 sm:py-24 text-center">
        <p className="text-6xl sm:text-7xl font-bold text-brand-200 tracking-tight">404</p>
        <h1 className="mt-3 text-2xl sm:text-3xl font-bold text-brand-700">Page not found</h1>
        <p className="mt-3 text-gray-600">
          The page you were looking for doesn&apos;t exist, or it may have been moved. The product
          might also be out of stock and no longer listed.
        </p>

        <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="bg-brand-600 text-white font-semibold rounded-full px-6 py-2.5 hover:bg-brand-700"
          >
            Back to Home
          </Link>
          <Link
            to="/shop"
            className="bg-white border border-brand-600 text-brand-700 font-semibold rounded-full px-6 py-2.5 hover:bg-brand-600 hover:text-white"
          >
            Continue Shopping
          </Link>
        </div>

        <p className="mt-8 text-sm text-gray-500">
          Need help finding something?{" "}
          <Link to="/contact" className="text-brand-700 underline">
            Contact us
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
