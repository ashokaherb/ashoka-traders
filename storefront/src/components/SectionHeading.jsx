import { Link } from "react-router-dom";
import { ChevronRight } from "./icons";

/**
 * Shared "Section title ............ View all →" header, used by the homepage
 * category and product sections so they stay visually consistent.
 */
export default function SectionHeading({ title, linkTo, linkLabel }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-4">
      <div>
        <h2 className="text-lg sm:text-2xl font-bold text-brand-700 tracking-tight">{title}</h2>
        <span className="block w-12 h-0.5 bg-accent mt-1.5 rounded-full" />
      </div>
      {linkTo && (
        <Link
          to={linkTo}
          className="shrink-0 inline-flex items-center gap-0.5 text-xs sm:text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          {linkLabel}
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}
