import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Slim bar under the header after a customer's login session times out, so being logged
 * out is explained instead of just finding a "Log in" link where their name used to be.
 * Hidden on the login/register pages themselves (Login.jsx shows its own message).
 */
export default function SessionExpiredNotice() {
  const { sessionExpired, dismissSessionExpired, user } = useAuth();
  const { pathname } = useLocation();

  if (!sessionExpired || user || pathname === "/login" || pathname === "/register") return null;

  return (
    <div role="status" className="bg-amber-50 border-b border-amber-200 text-amber-900 text-sm">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <p>
          Your session has expired for your security.{" "}
          <Link
            to={`/login?redirect=${encodeURIComponent(pathname)}`}
            className="font-semibold underline underline-offset-2"
          >
            Log in again
          </Link>{" "}
          - your cart is still saved.
        </p>
        <button
          type="button"
          onClick={dismissSessionExpired}
          aria-label="Dismiss"
          className="shrink-0 px-2 text-lg leading-none text-amber-700 hover:text-amber-900"
        >
          ×
        </button>
      </div>
    </div>
  );
}
