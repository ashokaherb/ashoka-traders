import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const WARN_BEFORE_MS = 10 * 60 * 1000; // start warning 10 minutes before the session ends

/**
 * Admin sessions last 24h and can't be extended (see backend/utils/generateToken.js).
 * Being logged out mid-edit would lose an unsaved product form, so this bar warns in
 * the last 10 minutes: save now, then log in again for a fresh 24 hours.
 */
export default function SessionTimeoutWarning() {
  const { expiresAt, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [now, setNow] = useState(Date.now());

  // Re-check every 15s - precise enough for a minutes countdown, cheap to run
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(interval);
  }, []);

  if (!expiresAt) return null;
  const remainingMs = expiresAt - now;
  if (remainingMs > WARN_BEFORE_MS || remainingMs <= 0) return null;

  const minutes = Math.max(1, Math.ceil(remainingMs / 60000));

  const loginAgain = () => {
    logout();
    navigate("/login", { replace: true, state: { from: location.pathname + location.search } });
  };

  return (
    <div role="alert" className="bg-amber-50 border-b border-amber-200 text-amber-900 text-sm">
      <div className="px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2">
        <p>
          <span className="font-semibold">
            Your admin session ends in {minutes} minute{minutes === 1 ? "" : "s"}.
          </span>{" "}
          Save any changes now - you&apos;ll need to log in again after that.
        </p>
        <button
          type="button"
          onClick={loginAgain}
          className="shrink-0 rounded border border-amber-300 bg-white px-3 py-1 font-medium hover:bg-amber-100"
        >
          Log in again now
        </button>
      </div>
    </div>
  );
}
