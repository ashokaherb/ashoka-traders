import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  DashboardIcon,
  BoxIcon,
  TagIcon,
  ClipboardIcon,
  PercentIcon,
  ImageIcon,
  TicketIcon,
  UploadIcon,
  SettingsIcon,
  LogoutIcon,
  CloseIcon,
} from "./icons";

// Single source of truth for the sidebar's links - also reused by AdminLayout to
// work out the current page's title, so the two never drift apart.
export const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: DashboardIcon, end: true },
  { to: "/products", label: "Products", icon: BoxIcon },
  { to: "/categories", label: "Categories", icon: TagIcon },
  { to: "/orders", label: "Orders", icon: ClipboardIcon },
  { to: "/offers", label: "Offers & Sales", icon: PercentIcon },
  { to: "/banners", label: "Banners", icon: ImageIcon },
  { to: "/coupons", label: "Coupons", icon: TicketIcon },
  { to: "/bulk-upload", label: "Bulk Upload", icon: UploadIcon },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

/**
 * Fixed full-height left sidebar on desktop; a slide-out drawer (controlled by
 * `open`/`onClose`) below the `lg` breakpoint, opened via the hamburger in AdminTopBar.
 */
export default function Sidebar({ open, onClose }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    onClose();
    logout();
    navigate("/login");
  };

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-2.5 text-sm rounded-lg mx-2 transition-colors ${
      isActive
        ? "bg-emerald-600 text-white font-medium"
        : "text-gray-300 hover:bg-gray-800 hover:text-white"
    }`;

  const content = (
    <div className="flex flex-col h-full bg-gray-900">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <NavLink to="/" className="text-white font-bold leading-tight" onClick={onClose}>
          Ashoka Traders
          <span className="block text-[11px] font-normal text-gray-400 tracking-wide">
            ADMIN PANEL
          </span>
        </NavLink>
        {/* Close button - mobile drawer only, the desktop sidebar has nothing to close */}
        <button onClick={onClose} aria-label="Close menu" className="lg:hidden text-gray-400">
          <CloseIcon className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={linkClass} onClick={onClose}>
            <Icon className="w-5 h-5 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-gray-800 p-2">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <LogoutIcon className="w-5 h-5 shrink-0" />
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: fixed, always visible */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 z-30">{content}</aside>

      {/* Mobile/tablet: slide-out drawer, only mounted while open */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 w-64 shadow-xl">{content}</aside>
        </div>
      )}
    </>
  );
}
