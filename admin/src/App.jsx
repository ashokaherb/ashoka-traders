import { lazy } from "react";
import { Routes, Route } from "react-router-dom";
import PrivateRoute from "./components/PrivateRoute";
import AdminLayout from "./components/AdminLayout";
import Login from "./pages/Login";

// Every page behind the login loads as its own chunk (audit M7). The login screen no longer
// downloads recharts (Dashboard) or any other page's code first. The Suspense fallback
// lives inside AdminLayout, so the sidebar stays put while a page loads.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ProductList = lazy(() => import("./pages/ProductList"));
const ProductForm = lazy(() => import("./pages/ProductForm"));
const CategoryManagement = lazy(() => import("./pages/CategoryManagement"));
const OfferManagement = lazy(() => import("./pages/OfferManagement"));
const BannerManagement = lazy(() => import("./pages/BannerManagement"));
const BulkUpload = lazy(() => import("./pages/BulkUpload"));
const OrderList = lazy(() => import("./pages/OrderList"));
const OrderDetail = lazy(() => import("./pages/OrderDetail"));
const CouponManagement = lazy(() => import("./pages/CouponManagement"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const AdminProfile = lazy(() => import("./pages/AdminProfile"));

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Every route below requires a logged-in admin, and renders inside the shared
          sidebar/top-bar shell (AdminLayout) via its <Outlet /> - see that file. */}
      <Route
        element={
          <PrivateRoute>
            <AdminLayout />
          </PrivateRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/products" element={<ProductList />} />
        <Route path="/products/new" element={<ProductForm />} />
        <Route path="/products/:id/edit" element={<ProductForm />} />
        <Route path="/categories" element={<CategoryManagement />} />
        <Route path="/offers" element={<OfferManagement />} />
        <Route path="/banners" element={<BannerManagement />} />
        <Route path="/bulk-upload" element={<BulkUpload />} />
        <Route path="/orders" element={<OrderList />} />
        <Route path="/orders/:id" element={<OrderDetail />} />
        <Route path="/coupons" element={<CouponManagement />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profile" element={<AdminProfile />} />
      </Route>
    </Routes>
  );
}
