/**
 * Single source of truth for the facts search engines and social previews need.
 *
 * Canonical URLs and structured data must point at the PRODUCTION domain even when the
 * site is being viewed on localhost or a Vercel preview URL - otherwise Google indexes
 * the preview. So SITE_URL is a fixed constant (overridable with VITE_SITE_URL for a
 * staging deployment that genuinely should canonicalise to itself).
 *
 * Anything here that the client still has to supply is marked CLIENT TODO in a comment.
 * Never invent a value: an empty/absent field is dropped from the JSON-LD, while a wrong
 * one (a phone number nobody answers, a social profile that isn't theirs) is a real
 * problem in Google's eyes and the client's.
 */

/** Production origin, no trailing slash. */
export const SITE_URL = (import.meta.env.VITE_SITE_URL || "https://ashokaherbs.com").replace(/\/$/, "");

/** Builds an absolute URL from a site-relative path, for canonicals and og:url. */
export const absoluteUrl = (path = "/") => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

/** Fallback social-share card (1200x630). Product pages use the product photo instead. */
export const OG_IMAGE = absoluteUrl("/og-image.png");

/** Logo used in the Organization / LocalBusiness schema. */
export const LOGO_URL = absoluteUrl("/apple-touch-icon.png");

export const SITE = {
  /** Trading name. Admin > Settings can change the on-page name; this is the SEO default. */
  name: "Ashoka Traders",
  tagline: "Buy Dry Fruits, Herbs & Natural Grocery Online",
  description:
    "Buy premium dry fruits, herbs, spices and natural grocery online from Ashoka Traders, Dehradun. Honest quality, fair prices and delivery across India with cash on delivery.",

  // Postal address - matches the Google Business Profile and the invoice footer.
  address: {
    street: "3 Dhamawala Bazaar",
    city: "Dehradun",
    state: "Uttarakhand",
    postalCode: "248001",
    country: "IN",
  },

  /**
   * Public social profiles, emitted as schema.org "sameAs". Only real, live profiles
   * belong here - a placeholder would point Google at a 404.
   * CLIENT TODO: add the real Instagram/Facebook URLs (and update Footer.jsx to match).
   */
  socialProfiles: [],
};

/** The niche this shop competes in - used in the homepage description and keywords. */
export const PRIMARY_CATEGORIES = ["dry fruits", "herbs", "spices", "natural grocery"];
