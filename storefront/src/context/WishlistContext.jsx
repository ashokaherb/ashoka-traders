import { createContext, useContext, useEffect, useRef, useState } from "react";
import api from "../api/axios";
import { useAuth } from "./AuthContext";

/**
 * Wishlist, in the same two modes as the cart (see CartContext for the full
 * rationale):
 *
 *  - GUEST: product ids in localStorage under "guest_wishlist" - the heart icon
 *    works without an account.
 *  - LOGGED IN: stored on the user in MongoDB via /api/wishlist.
 *
 * Merged up into the account on login, emptied (without re-reading localStorage)
 * on logout.
 *
 * Holding the ids centrally means every heart icon across the app stays in sync
 * the instant one of them is toggled.
 */
const WishlistContext = createContext(null);

const GUEST_WISHLIST_KEY = "guest_wishlist";

const readGuestWishlist = () => {
  try {
    const raw = localStorage.getItem(GUEST_WISHLIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeGuestWishlist = (ids) => {
  try {
    localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(ids));
  } catch {
    /* ignore - private browsing */
  }
};

const clearGuestWishlist = () => {
  try {
    localStorage.removeItem(GUEST_WISHLIST_KEY);
  } catch {
    /* ignore */
  }
};

export const WishlistProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [wishlistIds, setWishlistIds] = useState([]);

  const idsRef = useRef([]);
  const prevUserIdRef = useRef(undefined);

  const apply = (ids) => {
    idsRef.current = ids;
    setWishlistIds(ids);
  };

  useEffect(() => {
    if (authLoading) return;

    const previousUserId = prevUserIdRef.current;
    const currentUserId = user?._id || null;
    prevUserIdRef.current = currentUserId;

    let cancelled = false;

    const load = async () => {
      try {
        if (currentUserId) {
          const guestIds = readGuestWishlist();
          const { data } = guestIds.length
            ? await api.post("/wishlist/merge", { productIds: guestIds })
            : await api.get("/wishlist");
          clearGuestWishlist();
          if (!cancelled) apply(data.map((p) => p._id));
        } else if (previousUserId) {
          // Just logged out - clear what's on screen, leave nothing behind locally.
          clearGuestWishlist();
          if (!cancelled) apply([]);
        } else {
          if (!cancelled) apply(readGuestWishlist());
        }
      } catch (error) {
        console.error("Could not load wishlist:", error.message);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  const isWishlisted = (productId) => wishlistIds.includes(productId);

  const toggleWishlist = async (productId) => {
    const current = idsRef.current;
    const alreadySaved = current.includes(productId);
    const next = alreadySaved ? current.filter((id) => id !== productId) : [...current, productId];

    apply(next); // optimistic - the heart responds instantly either way

    try {
      if (user) {
        if (alreadySaved) {
          await api.delete(`/wishlist/${productId}`);
        } else {
          await api.post(`/wishlist/${productId}`);
        }
      } else {
        writeGuestWishlist(next);
      }
    } catch (error) {
      console.error("Could not update wishlist:", error.message);
      apply(current); // roll back so the icon reflects reality
    }
  };

  return (
    <WishlistContext.Provider value={{ wishlistIds, isWishlisted, toggleWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => useContext(WishlistContext);
