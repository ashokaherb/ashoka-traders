/**
 * Previous / "Page X of Y" / Next controls for paginated admin tables (audit M3).
 * Renders nothing when everything fits on one page.
 */
export default function Pager({ page, totalPages, totalCount, itemLabel = "items", onChange, disabled = false }) {
  if (totalPages <= 1) {
    return totalCount > 0 ? <p className="mt-3 text-xs text-gray-500">{totalCount} {itemLabel}</p> : null;
  }
  const buttonClass =
    "px-3 py-1.5 rounded border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white";
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
      <p className="text-xs text-gray-500">
        {totalCount} {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <button type="button" className={buttonClass} disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </button>
        <span className="text-gray-600 tabular-nums">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className={buttonClass}
          disabled={disabled || page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
