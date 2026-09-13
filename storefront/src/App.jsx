import { Routes, Route } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import Header from "./components/Header";
import Footer from "./components/Footer";
import RequireAuth from "./components/RequireAuth";
import SessionExpiredNotice from "./components/SessionExpiredNotice";
import GoogleAnalytics from "./components/GoogleAnalytics";
import Home from "./pages/Home";
import Shop from "./pages/Shop";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import OrderSuccess from "./pages/OrderSuccess";
import MyOrders from "./pages/MyOrders";
import Wishlist from "./pages/Wishlist";
import Profile from "./pages/Profile";
import AboutUs from "./pages/AboutUs";
import ContactUs from "./pages/ContactUs";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Returns from "./pages/Returns";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-cream">
      {/* Site-wide default title/description - individual pages override these with
          their own <Helmet> (react-helmet-async merges, most specific wins). */}
      <Helmet>
        <title>Ashoka Traders — Natural Herbs &amp; Dry Fruits</title>
        <meta
          name="description"
          content="Ashoka Traders - your local shop for premium dry fruits, herbs and everyday essentials, now online. Fast delivery, cash on delivery available."
        />
      </Helmet>

      {/* Storefront-only GA4 tracking - never mounted in the admin app */}
      <GoogleAnalytics />

      <Header />
      <SessionExpiredNotice />
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/category/:slug" element={<Shop />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/product/:slug" element={<ProductDetail />} />

          {/* Cart and wishlist both work without an account - guests' items live in
              localStorage and get merged into the account at login. */}
          <Route path="/cart" element={<Cart />} />
          <Route path="/wishlist" element={<Wishlist />} />

          {/* Login/signup is only required from here on */}
          <Route
            path="/checkout"
            element={
              <RequireAuth>
                <Checkout />
              </RequireAuth>
            }
          />
          <Route
            path="/order-success/:id"
            element={
              <RequireAuth>
                <OrderSuccess />
              </RequireAuth>
            }
          />
          <Route
            path="/my-orders"
            element={
              <RequireAuth>
                <MyOrders />
              </RequireAuth>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <Profile />
              </RequireAuth>
            }
          />

          {/* Footer/legal pages - public, no login required */}
          <Route path="/about" element={<AboutUs />} />
          <Route path="/contact" element={<ContactUs />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/returns" element={<Returns />} />
        </Routes>
      </div>
      <Footer />
    </div>
  );
}
