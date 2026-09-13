import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import api from "../api/axios";

/**
 * Store-wide data that almost never changes - the category list and store settings
 * (name, shipping rule, minimum order). Fetched ONCE for the whole app and shared, instead
 * of the header, home page, shop and checkout each requesting their own copy (audit M8).
 *
 * If the data is older than STALE_AFTER_MS it's quietly re-fetched the next time the
 * customer comes back to the tab, so an admin's change still shows up mid-session.
 * Components keep showing the old copy until the new one arrives.
 */
const STALE_AFTER_MS = 10 * 60 * 1000;

const AppDataContext = createContext(null);

export function AppDataProvider({ children }) {
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const fetchedAt = useRef(0);
  const inFlight = useRef(null);

  const refresh = useCallback(() => {
    // One request at a time - a second caller just waits for the same one.
    if (inFlight.current) return inFlight.current;

    inFlight.current = Promise.all([
      api
        .get("/categories")
        .then((res) => setCategories(res.data))
        .catch(() => {}) // keep whatever we had; an empty list is the initial state anyway
        .finally(() => setCategoriesLoading(false)),
      api
        .get("/settings")
        .then((res) => setSettings(res.data))
        .catch(() => {})
        .finally(() => setSettingsLoading(false)),
    ]).finally(() => {
      fetchedAt.current = Date.now();
      inFlight.current = null;
    });
    return inFlight.current;
  }, []);

  useEffect(() => {
    refresh();

    const refreshIfStale = () => {
      if (document.visibilityState === "visible" && Date.now() - fetchedAt.current > STALE_AFTER_MS) {
        refresh();
      }
    };
    document.addEventListener("visibilitychange", refreshIfStale);
    return () => document.removeEventListener("visibilitychange", refreshIfStale);
  }, [refresh]);

  return (
    <AppDataContext.Provider value={{ categories, categoriesLoading, settings, settingsLoading, refresh }}>
      {children}
    </AppDataContext.Provider>
  );
}

/** { categories, categoriesLoading, settings, settingsLoading, refresh } */
export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) throw new Error("useAppData must be used inside <AppDataProvider>");
  return context;
}
