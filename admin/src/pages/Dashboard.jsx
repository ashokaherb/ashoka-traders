import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import api from "../api/axios";

// Default landing page after admin login - a quick overview of the shop's health.
export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/dashboard").then((res) => setStats(res.data));
  }, []);

  if (!stats) {
    return (
      <div>
        <p className="text-center mt-10 text-gray-500">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-gray-800 mb-4">Dashboard</h1>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <StatCard label="Orders Today" value={stats.ordersToday} />
          <StatCard label="Orders This Week" value={stats.ordersWeek} />
          <StatCard label="Orders This Month" value={stats.ordersMonth} />
          <StatCard label="Revenue Today" value={`₹${stats.revenueToday}`} />
          <StatCard label="Revenue This Week" value={`₹${stats.revenueWeek}`} />
          <StatCard label="Revenue This Month" value={`₹${stats.revenueMonth}`} />
          <StatCard
            label="WhatsApp Opted-In"
            value={`${stats.whatsappOptInCount} customer${stats.whatsappOptInCount === 1 ? "" : "s"}`}
          />
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="font-semibold text-gray-700 mb-3">Revenue - Last 7 Days</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={stats.revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => `₹${value}`} />
                <Line type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="font-semibold text-gray-700 mb-3">Top 5 Best-Selling Products</h2>
            {stats.topProducts.length === 0 ? (
              <p className="text-sm text-gray-500">No sales yet.</p>
            ) : (
              <ul className="text-sm divide-y">
                {stats.topProducts.map((p) => (
                  <li key={p._id} className="flex justify-between py-2">
                    <span>{p.name}</span>
                    <span className="font-medium">{p.totalQuantity} sold</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-700">Low Stock</h2>
              <Link to="/products" className="text-xs text-emerald-700 hover:underline">
                Manage products
              </Link>
            </div>
            {stats.lowStockProducts.length === 0 ? (
              <p className="text-sm text-gray-500">Nothing low on stock right now.</p>
            ) : (
              <ul className="text-sm divide-y">
                {stats.lowStockProducts.map((p) => (
                  <li key={p._id} className="flex justify-between py-2">
                    <span>{p.name}</span>
                    <span className="text-red-500 font-medium">
                      {p.variants?.length > 0
                        ? p.variants
                            .filter((v) => v.stock <= p.lowStockThreshold)
                            .map((v) => `${v.label}: ${v.stock}`)
                            .join(", ")
                        : `${p.stock} left`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="font-semibold text-gray-700 mb-3">Recent Orders</h2>
            {stats.recentOrders.length === 0 ? (
              <p className="text-sm text-gray-500">No orders yet.</p>
            ) : (
              <ul className="text-sm divide-y">
                {stats.recentOrders.map((o) => (
                  <li key={o._id} className="flex justify-between py-2">
                    <Link to={`/orders/${o._id}`} className="text-emerald-700 hover:underline">
                      #{o._id.slice(-8).toUpperCase()}
                    </Link>
                    <span>{o.user?.name}</span>
                    <span className="font-medium">₹{o.total}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
    </div>
  );
}
