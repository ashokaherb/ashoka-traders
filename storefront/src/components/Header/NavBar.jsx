import { NavLink } from "react-router-dom";

// The nav bar is a single-line horizontal strip - there's only room for a handful of
// direct category links, so admins pick which ones via Category > "Show in nav bar"
// (see admin/src/pages/CategoryManagement.jsx). This slice is a backstop in case more
// than that are ever flagged; the admin form is what actually prevents picking a 5th.
const MAX_NAV_CATEGORIES = 4;

/**
 * The green navigation strip: Home, Shop, the admin-picked featured categories, then
 * About and Contact. Desktop only - on smaller screens these same links live in the
 * slide-out drawer (see Header/index.jsx), which lists ALL categories since a vertical
 * scrolling list doesn't have this bar's space constraint.
 */
export default function NavBar({ categories }) {
  const linkClass = ({ isActive }) =>
    `px-3 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${
      isActive
        ? "border-accent text-white font-medium"
        : "border-transparent text-brand-100 hover:text-white hover:border-brand-300"
    }`;

  const navCategories = categories.filter((c) => c.showInNav).slice(0, MAX_NAV_CATEGORIES);

  return (
    <nav className="hidden lg:block bg-brand-600">
      {/* justify-center - all links (including About/Contact) sit together in the
          middle of the bar, rather than being split with About/Contact pushed right. */}
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-center gap-1">
        <NavLink to="/" end className={linkClass}>
          Home
        </NavLink>
        <NavLink to="/shop" end className={linkClass}>
          Shop
        </NavLink>

        {navCategories.map((category) => (
          <NavLink key={category._id} to={`/category/${category.slug}`} className={linkClass}>
            {category.name}
          </NavLink>
        ))}

        <NavLink to="/about" className={linkClass}>
          About
        </NavLink>
        <NavLink to="/contact" className={linkClass}>
          Contact
        </NavLink>
      </div>
    </nav>
  );
}
