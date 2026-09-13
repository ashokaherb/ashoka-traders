import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { CartProvider } from "./context/CartContext.jsx";
import { WishlistProvider } from "./context/WishlistContext.jsx";
import { AppDataProvider } from "./context/AppDataContext.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* HelmetProvider lets any page set its own <title>/meta tags via <Helmet> (SEO) */}
    <HelmetProvider>
      <BrowserRouter>
        {/* AuthProvider makes the logged-in user available to every page via useAuth().
            CartProvider makes the cart available via useCart() - it works independently
            of login, which is what lets guests add to cart before signing in.
            WishlistProvider needs AuthProvider (it reloads whenever the user changes).
            AppDataProvider fetches categories + settings once for every page (useAppData). */}
        <AppDataProvider>
          <AuthProvider>
            <CartProvider>
              <WishlistProvider>
                <App />
              </WishlistProvider>
            </CartProvider>
          </AuthProvider>
        </AppDataProvider>
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);
