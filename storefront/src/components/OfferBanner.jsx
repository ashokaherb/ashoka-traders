import { useEffect, useState } from "react";
import api from "../api/axios";

// Animated scrolling banner of currently-active offers, shown at the top of Home.
// Renders nothing if there are no active offers.
export default function OfferBanner() {
  const [offers, setOffers] = useState([]);

  useEffect(() => {
    api
      .get("/offers/active")
      .then((res) => setOffers(res.data))
      .catch(() => {}); // a failed fetch here just means no banner, not a broken page
  }, []);

  if (offers.length === 0) return null;

  const message = offers.map((o) => `${o.title} - Flat ${o.discountPercent}% off!`).join("     •     ");

  return (
    // Accent (not brand green) so this strip reads as its own thing rather than
    // blending into the green nav bar directly above it on desktop.
    <div className="bg-accent/15 text-brand-800 border-y border-accent/30 overflow-hidden whitespace-nowrap py-1.5 text-sm">
      {/* The message is duplicated so the marquee loop has no visible seam. */}
      <div className="inline-block animate-marquee">
        <span className="mx-4 font-medium">{message}</span>
        <span className="mx-4 font-medium">{message}</span>
      </div>
    </div>
  );
}
