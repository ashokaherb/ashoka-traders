const PDFDocument = require("pdfkit");

// Fixed column x-positions for the simple item table below (in points, A4/Letter width ~612pt
// with 50pt margins either side leaves ~512pt of usable width).
const COL_X = { item: 50, qty: 320, price: 380, total: 460 };
const COL_WIDTH = { item: 260, qty: 50, price: 70, total: 100 };

const money = (value) => `Rs. ${Number(value).toFixed(2)}`;

/**
 * Streams a one-page PDF invoice/receipt straight to the given response.
 * Uses a GST "Tax Invoice" header if settings.gstNumber is set, otherwise a
 * plain receipt - same layout either way, just the header/GST line differ.
 *
 * @param {import("../models/Order")} order - populated with `user`
 * @param {import("../models/Settings")} settings
 * @param {import("express").Response} res
 */
function generateInvoicePDF(order, settings, res) {
  const isGST = Boolean(settings.gstNumber);
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="invoice-${order._id}.pdf"`);
  doc.pipe(res);

  // --- Header ---
  doc.fontSize(18).font("Helvetica-Bold").text(isGST ? "TAX INVOICE" : "RECEIPT", { align: "center" });
  doc.moveDown(0.5);

  doc.fontSize(14).text(settings.storeName || "Ashoka Traders", { align: "center" });
  doc.font("Helvetica").fontSize(10);
  if (isGST) doc.text(`GSTIN: ${settings.gstNumber}`, { align: "center" });
  const contactLine = [settings.supportEmail, settings.supportPhone].filter(Boolean).join("  |  ");
  if (contactLine) doc.text(contactLine, { align: "center" });
  doc.moveDown(1.5);

  // --- Order + customer info, side by side ---
  const infoTop = doc.y;
  doc.font("Helvetica-Bold").fontSize(11).text("Invoice Details", 50, infoTop);
  doc.font("Helvetica").fontSize(10);
  doc.text(`Order #: ${order._id}`, 50, doc.y + 4);
  doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString("en-IN")}`);
  doc.text(`Payment: ${order.paymentMethod} (${order.paymentStatus})`);

  doc.font("Helvetica-Bold").fontSize(11).text("Bill To", 320, infoTop);
  doc.font("Helvetica").fontSize(10);
  doc.text(order.address.name, 320, infoTop + 18);
  doc.text(order.address.addressLine, 320);
  doc.text(`${order.address.city}, ${order.address.state} - ${order.address.pincode}`, 320);
  doc.text(`Phone: ${order.address.phone}`, 320);

  doc.moveDown(2);
  doc.y = Math.max(doc.y, infoTop + 100);

  // --- Item table ---
  const drawTableRow = (y, { item, qty, price, total }, bold = false) => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10);
    doc.text(item, COL_X.item, y, { width: COL_WIDTH.item });
    doc.text(qty, COL_X.qty, y, { width: COL_WIDTH.qty, align: "right" });
    doc.text(price, COL_X.price, y, { width: COL_WIDTH.price, align: "right" });
    doc.text(total, COL_X.total, y, { width: COL_WIDTH.total, align: "right" });
  };

  let y = doc.y + 10;
  doc.moveTo(50, y - 4).lineTo(562, y - 4).strokeColor("#cccccc").stroke();
  drawTableRow(y, { item: "Item", qty: "Qty", price: "Price", total: "Amount" }, true);
  y += 20;
  doc.moveTo(50, y - 4).lineTo(562, y - 4).strokeColor("#cccccc").stroke();

  order.items.forEach((lineItem) => {
    const name = lineItem.name + (lineItem.variantLabel ? ` (${lineItem.variantLabel})` : "");
    drawTableRow(y, {
      item: name,
      qty: String(lineItem.quantity),
      price: money(lineItem.price),
      total: money(lineItem.price * lineItem.quantity),
    });
    y += 20;
  });

  doc.moveTo(50, y - 4).lineTo(562, y - 4).strokeColor("#cccccc").stroke();
  y += 10;

  // --- Totals ---
  const totalsX = 380;
  const totalLine = (label, value, bold = false) => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10);
    doc.text(label, totalsX, y, { width: 100 });
    doc.text(value, totalsX + 100, y, { width: 80, align: "right" });
    y += 16;
  };

  totalLine("Subtotal", money(order.subtotal));
  totalLine("Shipping", money(order.shippingFee));
  if (order.discount > 0) {
    totalLine(`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`, `-${money(order.discount)}`);
  }
  totalLine("Total", money(order.total), true);

  doc.moveDown(3);
  doc.font("Helvetica").fontSize(9).fillColor("#666666").text(
    isGST
      ? "This is a computer-generated tax invoice and does not require a signature."
      : "This is a computer-generated receipt.",
    50,
    doc.y,
    { align: "center", width: 512 }
  );

  doc.end();
}

module.exports = { generateInvoicePDF };
