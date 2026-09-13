const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const sumTotals = (orders) => orders.reduce((sum, o) => sum + o.total, 0);

/**
 * @route   GET /api/dashboard
 * @desc    Everything the admin Dashboard page needs in one call: order/revenue
 *          counters, a 7-day revenue trend, top sellers, recent orders, and
 *          low-stock products.
 * @access  Private/Admin
 */
const getDashboardStats = async (req, res) => {
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6); // last 7 days including today
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    ordersToday,
    ordersWeek,
    ordersMonth,
    recentOrders,
    topProductsAgg,
    trendAgg,
    allProducts,
    whatsappOptInCount,
  ] = await Promise.all([
      Order.find({ createdAt: { $gte: todayStart } }),
      Order.find({ createdAt: { $gte: weekStart } }),
      Order.find({ createdAt: { $gte: monthStart } }),
      Order.find().populate("user", "name").sort({ createdAt: -1 }).limit(10),
      // Top 5 best-selling products by quantity sold, all-time
      Order.aggregate([
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.product",
            name: { $first: "$items.name" },
            totalQuantity: { $sum: "$items.quantity" },
          },
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: 5 },
      ]),
      // Revenue grouped by day, for the last 7 days
      Order.aggregate([
        { $match: { createdAt: { $gte: weekStart } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            revenue: { $sum: "$total" },
          },
        },
      ]),
      Product.find({ isActive: true }),
      // Lets the admin gauge broadcast reach before sending an offer/new-arrival WhatsApp update.
      User.countDocuments({ whatsappOptIn: true }),
    ]);

  // Fill in every day of the last 7 (even ones with zero orders) so the chart has no gaps.
  const trendMap = Object.fromEntries(trendAgg.map((t) => [t._id, t.revenue]));
  const revenueTrend = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(todayStart);
    day.setDate(day.getDate() - i);
    const key = day.toISOString().slice(0, 10);
    revenueTrend.push({ date: key, revenue: trendMap[key] || 0 });
  }

  const lowStockProducts = allProducts.filter((p) =>
    p.variants && p.variants.length > 0
      ? p.variants.some((v) => v.stock <= p.lowStockThreshold)
      : p.stock <= p.lowStockThreshold
  );

  res.json({
    ordersToday: ordersToday.length,
    ordersWeek: ordersWeek.length,
    ordersMonth: ordersMonth.length,
    revenueToday: sumTotals(ordersToday),
    revenueWeek: sumTotals(ordersWeek),
    revenueMonth: sumTotals(ordersMonth),
    topProducts: topProductsAgg,
    revenueTrend,
    recentOrders,
    lowStockProducts,
    whatsappOptInCount,
  });
};

module.exports = { getDashboardStats };
