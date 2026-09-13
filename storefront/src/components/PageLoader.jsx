/** Shown for the split second a lazily-loaded page's code is downloading (see App.jsx). */
export default function PageLoader() {
  return (
    <div className="flex justify-center py-20" role="status" aria-label="Loading">
      <span className="w-8 h-8 rounded-full border-4 border-brand-100 border-t-brand-600 animate-spin" />
    </div>
  );
}
