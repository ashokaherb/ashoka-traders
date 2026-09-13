/**
 * Small inline SVG icon set, so the storefront gets crisp icons without pulling in
 * an icon library. Every icon takes a className (size + colour come from Tailwind
 * classes, e.g. <Search className="w-5 h-5 text-brand-700" />) and inherits the
 * current text colour.
 */

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  viewBox: "0 0 24 24",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": "true",
};

export const Search = ({ className = "" }) => (
  <svg {...base} className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

/** Heart - `filled` swaps the outline for a solid shape (wishlisted state). */
export const Heart = ({ className = "", filled = false }) => (
  <svg {...base} className={className} fill={filled ? "currentColor" : "none"}>
    <path d="M12 20s-7-4.6-7-9.4A3.9 3.9 0 0 1 12 7.9a3.9 3.9 0 0 1 7 2.7c0 4.8-7 9.4-7 9.4Z" />
  </svg>
);

export const Cart = ({ className = "" }) => (
  <svg {...base} className={className}>
    <path d="M5 6h15l-1.5 8.5a2 2 0 0 1-2 1.6H9a2 2 0 0 1-2-1.6L5 4H2.5" />
    <circle cx="9.5" cy="19.5" r="1.4" />
    <circle cx="16.5" cy="19.5" r="1.4" />
  </svg>
);

export const User = ({ className = "" }) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" />
  </svg>
);

export const Menu = ({ className = "" }) => (
  <svg {...base} className={className}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const Close = ({ className = "" }) => (
  <svg {...base} className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const ChevronDown = ({ className = "" }) => (
  <svg {...base} className={className}>
    <path d="m6 9.5 6 6 6-6" />
  </svg>
);

export const ChevronRight = ({ className = "" }) => (
  <svg {...base} className={className}>
    <path d="m9.5 6 6 6-6 6" />
  </svg>
);

export const ChevronLeft = ({ className = "" }) => (
  <svg {...base} className={className}>
    <path d="m14.5 6-6 6 6 6" />
  </svg>
);

export const Truck = ({ className = "" }) => (
  <svg {...base} className={className}>
    <path d="M2.5 7h10v9h-10z" />
    <path d="M12.5 10.5h4l3 3v2.5h-7z" />
    <circle cx="6" cy="18" r="1.6" />
    <circle cx="16.5" cy="18" r="1.6" />
  </svg>
);

export const Leaf = ({ className = "" }) => (
  <svg {...base} className={className}>
    <path d="M5 19c0-8 5.5-12.5 14-13-.5 9-5 14-13 14" />
    <path d="M5 19c2.5-4 5.5-6.5 9-8" />
  </svg>
);

export const ShieldCheck = ({ className = "" }) => (
  <svg {...base} className={className}>
    <path d="M12 3.5l7 2.5v5.5c0 4.3-2.9 7.6-7 9-4.1-1.4-7-4.7-7-9V6z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </svg>
);

export const Award = ({ className = "" }) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="9" r="5.5" />
    <path d="M8.5 14 7 21l5-2.5L17 21l-1.5-7" />
  </svg>
);

/** Star - `fill` is 0-1, so 0.5 renders a half star (used by StarRating). */
export const Star = ({ className = "", fill = 1, id = "" }) => {
  const clipId = `star-clip-${id}`;
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width={24 * Math.max(0, Math.min(1, fill))} height="24" />
        </clipPath>
      </defs>
      <path
        d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z"
        fill="currentColor"
        clipPath={`url(#${clipId})`}
      />
    </svg>
  );
};
