import { createContext, useContext, useEffect, useRef, useState } from "react";
import api from "../api/axios";
import { useAuth } from "./AuthContext";

/**
 * The cart works in two modes, switching automatically with login state:
 *
 *  - GUEST: kept in localStorage under "guest_cart", so browsing/adding never
 *    requires an account and survives a page refresh.
 *  - LOGGED IN: kept in MongoDB via /api/cart, so it follows the customer
 *    between devices.
 *
 * On login the guest cart is merged up into the account (POST /api/cart/merge)
 * and the localStorage copy is deleted. On logout the displayed cart is emptied
 * outright - the account's cart stays safe in the database, and we deliberately
 * do NOT fall back to localStorage, so the next person using the browser doesn't
 * inherit someone else's cart.
 */
const CartContext = createContext(null);

const GUEST_CART_KEY = "guest_cart";
const LEGACY_CART_KEY = "cart"; // key used before this was guest/account aware

// A cart line is uniquely identified by productId + variantId (variantId is
// null for a product with no variants).
const sameLine = (a, b) =>
  a.productId === b.productId && (a.variantId || null) === (b.variantId || null);

const readGuestCart = () => {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    if (raw) return JSON.parse(raw);

    // One-time migration from the older key, so carts saved before this change
    // aren't silently lost.
    const legacy = localStorage.getItem(LEGACY_CART_KEY);
    if (legacy) {
      localStorage.setItem(GUEST_CART_KEY, legacy);
      localStorage.removeItem(LEGACY_CART_KEY);
      return JSON.parse(legacy);
    }
    return [];
  } catch {
    return []; // private browsing / corrupted value - start empty
  }
};

const writeGuestCart = (items) => {
  try {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
  } catch {
    // localStorage can throw in private-browsing mode - not fatal, just skip persisting.
  }
};

const clearGuestCart = () => {
  try {
    localStorage.removeItem(GUEST_CART_KEY);
    localStorage.removeItem(LEGACY_CART_KEY);
  } catch {
    /* ignore */
  }
};

export const CartProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);

  // Mirrors `items` but updated synchronously, so two mutations fired in the same
  // tick both build on the latest array instead of a stale render's copy.
  const itemsRef = useRef([]);
  // undefined = we haven't observed auth state yet; null = definitely a guest.
  const prevUserIdRef = useRef(undefined);

  const apply = (next) => {
    itemsRef.current = next;
    setItems(next);
  };

  // Load the right cart whenever login state settles or changes.
  useEffect(() => {
    if (authLoading) return;

    const previousUserId = prevUserIdRef.current;
    const currentUserId = user?._id || null;
    prevUserIdRef.current = currentUserId;

    let cancelled = false;

    const load = async () => {
      try {
        if (currentUserId) {
          // Logged in - merge anything added as a guest first, then use the account cart.
          const guestItems = readGuestCart();
          const { data } = guestItems.length
            ? await api.post("/cart/merge", { items: guestItems })
            : await api.get("/cart");
          clearGuestCart();
          if (!cancelled) apply(data);
        } else if (previousUserId) {
          // Just logged out - show an empty cart, and leave nothing behind locally.
          clearGuestCart();
          if (!cancelled) apply([]);
        } else {
          // First load as a guest.
          if (!cancelled) apply(readGuestCart());
        }
      } catch (error) {
        console.error("Could not load cart:", error.message);
      } finally {
        if (!cancelled) setReady(true);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  // The single place a new cart gets saved - localStorage for guests, the API when
  // logged in. Every mutation below routes through here.
  const persist = (next) => {
    apply(next);
    if (user) {
      api.put("/cart", { items: next }).catch((error) => {
        console.error("Could not save cart:", error.message);
      });
    } else {
      writeGuestCart(next);
    }
  };

  // `line` looks like { productId, variantId, name, variantLabel, price, image, stock }
  const addItem = (line, quantity = 1) => {
    const current = itemsRef.current;
    const existing = current.find((i) => sameLine(i, line));
    const next = existing
      ? current.map((i) => (sameLine(i, line) ? { ...i, quantity: i.quantity + quantity } : i))
      : [...current, { ...line, quantity }];
    persist(next);
  };

  const removeItem = (productId, variantId) => {
    persist(itemsRef.current.filter((i) => !sameLine(i, { productId, variantId })));
  };

  const updateQuantity = (productId, variantId, quantity) => {
    if (quantity <= 0) {
      removeItem(productId, variantId);
      return;
    }
    persist(
      itemsRef.current.map((i) => (sameLine(i, { productId, variantId }) ? { ...i, quantity } : i))
    );
  };

  const clearCart = () => persist([]);

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, ready, addItem, removeItem, updateQuantity, clearCart, subtotal, itemCount }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
