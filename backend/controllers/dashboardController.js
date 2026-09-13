const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

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

  // Order count + revenue for today / last 7 days / this month, counted inside MongoDB in
  // ONE aggregation (audit M4) - only a single summary document comes back to Node,
  // instead of every order in the month. The $match uses the createdAt index; the
  // earlier of week/month start covers both windows (early in a month the 7-day window
  // reaches back into last month).
  const countAndSum = (since) => ({
    count: { $sum: { $cond: [{ $gte: ["$createdAt", since] }, 1, 0] } },
    revenue: { $sum: { $cond: [{ $gte: ["$createdAt", since] }, "$total", 0] } },
  });
  const periodsStart = weekStart < monthStart ? weekStart : monthStart;
  const periodTotalsPipeline = [
    { $match: { createdAt: { $gte: periodsStart } } },
    {
      $group: {
        _id: null,
        todayCount: countAndSum(todayStart).count,
        todayRevenue: countAndSum(todayStart).revenue,
        weekCount: countAndSum(weekStart).count,
        weekRevenue: countAndSum(weekStart).revenue,
        monthCount: countAndSum(monthStart).count,
        monthRevenue: countAndSum(monthStart).revenue,
      },
    },
  ];

  // Low stock, filtered by MongoDB instead of loading every active product (audit M4).
  // A product is low if it has no variants and stock <= its threshold, or if ANY variant is
  // at/below the threshold - the same rule the old in-JS filter applied.
  const lowStockFilter = {
    isActive: true,
    $expr: {
      $cond: [
        { $gt: [{ $size: { $ifNull: ["$variants", []] } }, 0] },
        {
          $anyElementTrue: [
            { $map: { input: "$variants", as: "v", in: { $lte: ["$$v.stock", "$lowStockThreshold"] } } },
          ],
        },
        { $lte: ["$stock", "$lowStockThreshold"] },
      ],
    },
  };

  const [
    periodTotals,
    recentOrders,
    topProductsAgg,
    trendAgg,
    lowStockProducts,
    whatsappOptInCount,
  ] = await Promise.all([
      Order.aggregate(periodTotalsPipeline),
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
      Product.find(lowStockFilter),
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

  const totals = periodTotals[0] || {}; // no orders in either window -> no group -> zeros

  res.json({
    ordersToday: totals.todayCount || 0,
    ordersWeek: totals.weekCount || 0,
    ordersMonth: totals.monthCount || 0,
    revenueToday: totals.todayRevenue || 0,
    revenueWeek: totals.weekRevenue || 0,
    revenueMonth: totals.monthRevenue || 0,
    topProducts: topProductsAgg,
    revenueTrend,
    recentOrders,
    lowStockProducts,
    whatsappOptInCount,
  });
};

module.exports = { getDashboardStats };
