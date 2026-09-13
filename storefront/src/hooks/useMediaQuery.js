import { useEffect, useState } from "react";

/**
 * Subscribes to a CSS media query from JS.
 *
 * Used to keep the desktop-only hero genuinely OUT of the DOM on phones and
 * tablets, rather than merely `display: none`. That matters because a
 * display-none <img> is still fetched by most browsers - so CSS alone would
 * make mobile visitors download a hero image they never see.
 *
 * Starts false on the very first render (before we can measure), so the mobile
 * layout is what renders by default - the hero appears a tick later on desktop.
 */
export default function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (!window.matchMedia) return;
    const mediaQuery = window.matchMedia(query);
    const handleChange = (e) => setMatches(e.matches);

    setMatches(mediaQuery.matches); // resync in case it changed before we subscribed
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}

/** Tailwind's `lg` breakpoint - the desktop/laptop cutoff used for the hero. */
export const LG_BREAKPOINT = "(min-width: 1024px)";
