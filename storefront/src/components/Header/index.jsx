import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useAppData } from "../../context/AppDataContext";
import TopBar from "./TopBar";
import MainHeaderRow from "./MainHeaderRow";
import NavBar from "./NavBar";
import { Close } from "../icons";

/**
 * Composes the three header rows (TopBar / MainHeaderRow / NavBar) and owns the
 * mobile slide-out drawer. Categories and store settings come from the shared AppDataContext
 * (fetched once for the whole app) and are passed down to the rows.
 */
export default function Header() {
  const { categories, settings } = useAppData();
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Close the drawer whenever the route changes (e.g. after tapping a link).
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Stop the page behind the open drawer from scrolling.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate("/");
  };

  const drawerLinkClass = ({ isActive }) =>
    `block px-4 py-3 border-b border-cream-dark text-sm ${
      isActive ? "text-brand-700 font-semibold bg-cream" : "text-gray-700"
    }`;

  return (
    <header className="sticky top-0 z-40 shadow-sm">
      <TopBar settings={settings} />
      <MainHeaderRow
        settings={settings}
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((open) => !open)}
      />
      <NavBar categories={categories} />

      {/* --- Mobile slide-out drawer --- */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* Dimmed backdrop - tapping it closes the drawer */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />

          <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[85%] bg-white shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 bg-brand-700 text-white">
              <span className="font-semibold">{settings?.storeName || "Menu"}</span>
              <button onClick={() => setMenuOpen(false)} aria-label="Close menu">
                <Close className="w-5 h-5" />
              </button>
            </div>

            <NavLink to="/" end className={drawerLinkClass}>
              Home
            </NavLink>
            <NavLink to="/shop" end className={drawerLinkClass}>
              Shop All
            </NavLink>

            {categories.length > 0 && (
              <p className="px-4 pt-4 pb-1 text-[11px] uppercase tracking-wider text-gray-400">
                Categories
              </p>
            )}
            {categories.map((category) => (
              <NavLink
                key={category._id}
                to={`/category/${category.slug}`}
                className={drawerLinkClass}
              >
                {category.name}
              </NavLink>
            ))}

            <p className="px-4 pt-4 pb-1 text-[11px] uppercase tracking-wider text-gray-400">
              {user ? "My Account" : "More"}
            </p>
            {user ? (
              <>
                <NavLink to="/my-orders" className={drawerLinkClass}>
                  My Orders
                </NavLink>
                <NavLink to="/wishlist" className={drawerLinkClass}>
                  Wishlist
                </NavLink>
                <NavLink to="/profile" className={drawerLinkClass}>
                  Profile
                </NavLink>
              </>
            ) : (
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-3 border-b border-cream-dark text-sm text-brand-700 font-semibold"
              >
                Login / Signup
              </Link>
            )}
            <NavLink to="/about" className={drawerLinkClass}>
              About Us
            </NavLink>
            <NavLink to="/contact" className={drawerLinkClass}>
              Contact Us
            </NavLink>

            {user && (
              <button
                onClick={handleLogout}
                className="block w-full text-left px-4 py-3 text-sm text-red-600"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
