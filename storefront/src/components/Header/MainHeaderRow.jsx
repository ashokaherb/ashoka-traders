import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";
import { Search, Heart, Cart, Menu, Close } from "../icons";
import logo from "../../assets/logo.webp";

/** EDIT ME: the small line under the store name. */
const BRAND_TAGLINE = "Herbs & Dry Fruits";

/**
 * The main white header row: logo + brand name, search, and the wishlist/cart icons.
 *
 * Search is an always-visible input from `md` up. On mobile it collapses to an icon
 * that expands into a full-width search bar below the row, to save space.
 */
export default function MainHeaderRow({ settings, onToggleMenu, menuOpen }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const { itemCount } = useCart();
  const { wishlistIds } = useWishlist();
  const navigate = useNavigate();

  const storeName = settings?.storeName || "Ashoka Traders";

  const handleSearch = (e) => {
    e.preventDefault();
    const term = searchTerm.trim();
    navigate(term ? `/shop?search=${encodeURIComponent(term)}` : "/shop");
    setMobileSearchOpen(false);
  };

  const searchInput = (
    <form onSubmit={handleSearch} className="relative w-full">
      <input
        type="search"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search for dry fruits, herbs, spices..."
        aria-label="Search products"
        className="w-full border border-cream-dark bg-cream/60 rounded-full pl-4 pr-12 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
      />
      <button
        type="submit"
        aria-label="Search"
        className="absolute right-1 top-1 bottom-1 aspect-square rounded-full bg-brand-600 text-white flex items-center justify-center hover:bg-brand-700"
      >
        <Search className="w-4 h-4" />
      </button>
    </form>
  );

  return (
    <div className="bg-white border-b border-cream-dark">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 flex items-center gap-3 sm:gap-6">
        {/* Hamburger (mobile only). The open drawer covers this button, so it always
            shows the menu icon - closing happens via the drawer's own X or backdrop. */}
        <button
          onClick={onToggleMenu}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          className="lg:hidden text-brand-800 p-1 -ml-1"
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* Logo + brand name */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img src={logo} alt="" className="w-12 h-12 sm:w-16 sm:h-16 object-contain" />
          <span className="leading-tight">
            <span className="block text-lg sm:text-2xl font-bold text-brand-700 tracking-tight">
              {storeName}
            </span>
            <span className="hidden sm:block text-[10px] uppercase tracking-[0.18em] text-brand-500">
              {BRAND_TAGLINE}
            </span>
          </span>
        </Link>

        {/* Search - grows to fill the row on desktop */}
        <div className="hidden md:block flex-1 max-w-2xl mx-auto">{searchInput}</div>

        <div className="flex items-center gap-1 sm:gap-2 ml-auto">
          {/* Mobile search toggle */}
          <button
            onClick={() => setMobileSearchOpen((open) => !open)}
            aria-label="Search"
            className="md:hidden p-2 text-brand-800 hover:text-brand-600"
          >
            {mobileSearchOpen ? <Close className="w-5 h-5" /> : <Search className="w-5 h-5" />}
          </button>

          <Link
            to="/wishlist"
            className="relative p-2 text-brand-800 hover:text-brand-600 flex items-center gap-1.5"
          >
            <Heart className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="hidden lg:inline text-sm">Wishlist</span>
            {wishlistIds.length > 0 && (
              <span className="absolute top-0 right-0 lg:right-auto lg:left-6 bg-accent text-white text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                {wishlistIds.length}
              </span>
            )}
          </Link>

          <Link
            to="/cart"
            className="relative p-2 text-brand-800 hover:text-brand-600 flex items-center gap-1.5"
          >
            <Cart className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="hidden lg:inline text-sm">Cart</span>
            {itemCount > 0 && (
              <span className="absolute top-0 right-0 lg:right-auto lg:left-6 bg-accent text-white text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Expanded mobile search bar */}
      {mobileSearchOpen && (
        <div className="md:hidden px-3 pb-3">{searchInput}</div>
      )}
    </div>
  );
}
