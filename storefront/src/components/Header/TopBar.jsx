import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Truck, Leaf, Award, User, ChevronDown } from "../icons";

/**
 * Thin utility strip above the main header.
 * Left: rotating short offer/trust messages. Right: Track Order / Help, plus either
 * Login/Signup or the customer's name with an account dropdown.
 *
 * On mobile only the rotating message and the account control stay visible.
 */
export default function TopBar({ settings }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const menuRef = useRef(null);

  /**
   * EDIT ME: the rotating strip messages. The free-delivery threshold is pulled
   * from the admin's Settings, so it always matches the real shipping rule.
   * Add your own real numbers (e.g. "Trusted by 5,000+ customers") once you have them.
   */
  const messages = [
    {
      icon: Truck,
      text: settings?.freeShippingThreshold
        ? `Free delivery on orders above ₹${settings.freeShippingThreshold}`
        : "Fast delivery across India",
    },
    { icon: Leaf, text: "100% natural products" },
    { icon: Award, text: "Trusted by customers across India" },
  ];

  // Rotate the message every 4 seconds.
  useEffect(() => {
    const timer = setInterval(() => {
      setMessageIndex((i) => (i + 1) % messages.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [messages.length]);

  // Close the account dropdown on any outside click.
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
    navigate("/");
  };

  const active = messages[messageIndex];
  const ActiveIcon = active.icon;

  return (
    <div className="bg-brand-900 text-brand-100 text-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 h-9 flex items-center justify-between gap-3">
        {/* Rotating offer / trust message */}
        <div key={messageIndex} className="flex items-center gap-1.5 min-w-0">
          <ActiveIcon className="w-3.5 h-3.5 shrink-0 text-brand-200" />
          <span className="truncate">{active.text}</span>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          {/* Hidden on mobile to save room */}
          <Link to="/my-orders" className="hidden sm:inline hover:text-white">
            Track Order
          </Link>
          <Link to="/contact" className="hidden sm:inline hover:text-white">
            Help
          </Link>

          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((open) => !open)}
                className="flex items-center gap-1 hover:text-white"
                aria-expanded={menuOpen}
                aria-haspopup="true"
              >
                <User className="w-3.5 h-3.5" />
                <span className="max-w-[7rem] truncate">{user.name}</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white text-gray-700 rounded-md shadow-lg py-1 z-50 text-sm">
                  <Link
                    to="/my-orders"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 hover:bg-cream"
                  >
                    My Orders
                  </Link>
                  <Link
                    to="/wishlist"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 hover:bg-cream"
                  >
                    Wishlist
                  </Link>
                  <Link
                    to="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 hover:bg-cream"
                  >
                    Profile
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-red-600 hover:bg-cream border-t mt-1 pt-2"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="flex items-center gap-1 hover:text-white">
              <User className="w-3.5 h-3.5" />
              <span>Login / Signup</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
