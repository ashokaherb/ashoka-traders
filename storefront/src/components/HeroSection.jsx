import { Link } from "react-router-dom";
import { ChevronRight } from "./icons";
import heroImage from "../assets/hero.webp";

/**
 * Desktop/laptop-only hero banner.
 *
 * `hidden lg:flex` means this is genuinely absent from the DOM on phones and
 * tablets (not just visually shrunk), so mobile visitors land straight on the
 * category/product sections as specified.
 */

/** EDIT ME: hero copy and image. */
const HERO = {
  eyebrow: "Pure · Natural · Healthy",
  heading: "Goodness from Nature",
  subtext:
    "Premium dry fruits, herbs and natural products, sourced with care and delivered fresh to your door.",
  ctaLabel: "Shop Now",
  ctaHref: "/shop",
  // Real product photo, provided in src/assets and compressed to webp on the way in
  // (originals were a 474KB PNG-labelled JPEG and a 2.1MB PNG - see note below).
  image: heroImage,
};

export default function HeroSection({ storeName }) {
  return (
    <section className="hidden lg:flex bg-gradient-to-r from-cream via-brand-50 to-brand-100 border-b border-cream-dark">
      <div className="max-w-7xl mx-auto w-full px-4 py-14 grid grid-cols-2 gap-10 items-center">
        {/* Left: copy */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-500 mb-3">
            {HERO.eyebrow}
          </p>
          <h1 className="text-5xl xl:text-6xl font-bold text-brand-700 leading-[1.08] tracking-tight">
            {HERO.heading}
          </h1>
          <p className="mt-5 text-gray-600 text-lg max-w-md leading-relaxed">{HERO.subtext}</p>
          <Link
            to={HERO.ctaHref}
            className="mt-8 inline-flex items-center gap-1.5 bg-brand-600 text-white rounded-full px-7 py-3 font-medium hover:bg-brand-700 transition-colors"
          >
            {HERO.ctaLabel}
            <ChevronRight className="w-4 h-4" />
          </Link>
          {storeName && (
            <p className="mt-6 text-sm text-brand-600/70">
              Shopping with <span className="font-medium">{storeName}</span>
            </p>
          )}
        </div>

        {/* Right: product image */}
        <div className="relative">
          <img
            src={HERO.image}
            alt=""
            className="w-full rounded-2xl object-cover shadow-md"
            loading="eager"
          />
          <div className="absolute -bottom-4 -left-4 bg-white rounded-full w-24 h-24 shadow-lg flex flex-col items-center justify-center text-center border-4 border-brand-100">
            <span className="text-[10px] uppercase tracking-wider text-brand-500 leading-tight">
              Nature&apos;s
            </span>
            <span className="text-sm font-bold text-brand-700 leading-tight">Goodness</span>
          </div>
        </div>
      </div>
    </section>
  );
}
