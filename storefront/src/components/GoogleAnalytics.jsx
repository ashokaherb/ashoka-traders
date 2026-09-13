import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

/**
 * Loads Google Analytics 4 (gtag.js) once, if VITE_GA_MEASUREMENT_ID is set, and sends
 * a page_view event on every route change (since this is a single-page app - gtag's
 * automatic page_view on script load only ever sees the very first URL).
 *
 * Storefront only - this component is never mounted in the admin app. Renders nothing.
 * With no Measurement ID configured, every effect below is a no-op, so it's safe to
 * leave in place until a real ID is ready to plug in.
 */
export default function GoogleAnalytics() {
  const location = useLocation();

  // Inject the gtag.js script + init it, once.
  useEffect(() => {
    if (!GA_ID || window.gtag) return;

    const script = document.createElement("script");
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    script.async = true;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    function gtag() {
      window.dataLayer.push(arguments);
    }
    window.gtag = gtag;
    gtag("js", new Date());
    gtag("config", GA_ID);
  }, []);

  // Track each subsequent route change as its own page_view.
  useEffect(() => {
    if (!GA_ID || !window.gtag) return;
    window.gtag("event", "page_view", {
      page_path: location.pathname + location.search,
    });
  }, [location]);

  return null;
}
