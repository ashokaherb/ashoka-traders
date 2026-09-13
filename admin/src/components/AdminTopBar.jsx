import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { MenuIcon, ChevronDownIcon, UserIcon } from "./icons";

/**
 * Slim top bar next to the sidebar: hamburger (mobile only) + current page title on
 * the left, admin name with a Profile/Logout dropdown on the right. Everything that
 * used to live here (Products/Orders/etc. links) has moved into Sidebar.jsx.
 */
export default function AdminTopBar({ title, onOpenSidebar }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-gray-200">
      <div className="h-14 px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onOpenSidebar}
            aria-label="Open menu"
            className="lg:hidden text-gray-500 hover:text-gray-700 -ml-1 p-1"
          >
            <MenuIcon className="w-6 h-6" />
          </button>
          <h1 className="text-base sm:text-lg font-semibold text-gray-800 truncate">{title}</h1>
        </div>

        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-haspopup="true"
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <UserIcon className="w-4 h-4" />
            </span>
            <span className="hidden sm:inline max-w-[9rem] truncate">{user?.name || "Admin"}</span>
            <ChevronDownIcon className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-44 bg-white rounded-md shadow-lg border border-gray-100 py-1 z-50 text-sm">
              <Link
                to="/profile"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Profile
              </Link>
              <button
                onClick={handleLogout}
                className="block w-full text-left px-4 py-2 text-red-600 hover:bg-gray-50 border-t border-gray-100 mt-1 pt-2"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
