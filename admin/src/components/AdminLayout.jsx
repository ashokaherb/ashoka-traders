import { Suspense } from "react";
import PageLoader from "./PageLoader";
import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar, { NAV_ITEMS } from "./Sidebar";
import AdminTopBar from "./AdminTopBar";
import SessionTimeoutWarning from "./SessionTimeoutWarning";

/**
 * Works out the top bar's page title from the current path. Checked most-specific
 * first since some paths share a prefix (e.g. "/products/new" vs "/products/:id/edit"
 * vs the plain "/products" list).
 */
function getPageTitle(pathname) {
  if (pathname === "/products/new") return "Add Product";
  if (/^\/products\/[^/]+\/edit$/.test(pathname)) return "Edit Product";
  if (/^\/orders\/[^/]+$/.test(pathname)) return "Order Details";
  if (pathname === "/profile") return "Profile";

  // Otherwise it's one of the sidebar's own links - reuse its label so the two
  // never say different things for the same page.
  const match = NAV_ITEMS.find((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to)));
  return match?.label || "Admin";
}

/**
 * Shared shell for every logged-in admin page: fixed left sidebar (a slide-out
 * drawer below `lg`), a slim top bar, and the actual page content in between.
 * Wraps all admin routes in App.jsx - none of the pages themselves changed, just
 * where they render (see App.jsx for the route nesting, and the old top nav this
 * replaced in components/Navbar.jsx, now deleted).
 */
export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer whenever the route changes (e.g. after tapping a link).
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Stop the page behind the open drawer from scrolling.
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* lg:pl-64 leaves room for the fixed desktop sidebar */}
      <div className="lg:pl-64">
        <AdminTopBar title={getPageTitle(location.pathname)} onOpenSidebar={() => setSidebarOpen(true)} />
        <SessionTimeoutWarning />
        <main className="p-4 sm:p-6">
          {/* Pages are lazy-loaded (App.jsx) - show a spinner in the content area meanwhile */}
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
