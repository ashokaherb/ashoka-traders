/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        /**
         * ============================================================
         *  BRAND PALETTE - this is the only place to change to rebrand
         * ============================================================
         * Every storefront component uses these semantic names (bg-brand-600,
         * text-brand-700, bg-cream, etc.) rather than raw Tailwind colours, so
         * swapping the client's colours later means editing just this block.
         *
         * Current palette: earthy/natural green + warm cream.
         */
        brand: {
          50: "#f2f7ee",
          100: "#e0ebd6",
          200: "#c3d8b1",
          300: "#9dbe83",
          400: "#77a259",
          500: "#568440",
          600: "#3d6923", // primary - nav bar, buttons
          700: "#2d5016", // dark - headings, hovers
          800: "#223d11",
          900: "#16290b", // deepest - top utility bar
        },
        cream: {
          DEFAULT: "#faf7f0", // page background
          dark: "#f0e9db", // subtle borders / hover fills
        },
        // Warm accent for badges, star ratings and "sale" flags.
        accent: {
          DEFAULT: "#d99b2d",
          dark: "#b87d18",
        },
      },
    },
  },
  plugins: [],
};
