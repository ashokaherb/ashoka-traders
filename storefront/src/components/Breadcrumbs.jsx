import { Link } from "react-router-dom";

/**
 * The visible breadcrumb trail (Home / Category / Product).
 *
 * It exists for shoppers first - one tap back to the category they were browsing - but it
 * also backs the BreadcrumbList structured data. Both read the SAME array, because Google
 * requires the markup to match what the visitor can actually see.
 *
 * @param {{name: string, path?: string}[]} trail  last item is the current page (no path)
 */
export default function Breadcrumbs({ trail = [] }) {
  if (trail.length < 2) return null;

  return (
    <nav aria-label="Breadcrumb" className="text-xs sm:text-sm text-gray-500">
      <ol className="flex flex-wrap items-center gap-1">
        {trail.map((crumb, i) => {
          const isLast = i === trail.length - 1;
          return (
            <li key={`${crumb.name}-${i}`} className="flex items-center gap-1 min-w-0">
              {crumb.path && !isLast ? (
                <Link to={crumb.path} className="hover:text-brand-700 hover:underline">
                  {crumb.name}
                </Link>
              ) : (
                // The current page is text, not a link, and may be a long product name
                <span className="text-gray-700 font-medium truncate max-w-[16rem]" aria-current="page">
                  {crumb.name}
                </span>
              )}
              {!isLast && <span aria-hidden="true">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
