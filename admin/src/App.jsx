import { Routes, Route } from "react-router-dom";
import PrivateRoute from "./components/PrivateRoute";
import AdminLayout from "./components/AdminLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ProductList from "./pages/ProductList";
import ProductForm from "./pages/ProductForm";
import CategoryManagement from "./pages/CategoryManagement";
import OfferManagement from "./pages/OfferManagement";
import BannerManagement from "./pages/BannerManagement";
import BulkUpload from "./pages/BulkUpload";
import OrderList from "./pages/OrderList";
import OrderDetail from "./pages/OrderDetail";
import CouponManagement from "./pages/CouponManagement";
import SettingsPage from "./pages/SettingsPage";
import AdminProfile from "./pages/AdminProfile";

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
