const path = require("path");
const { Writable } = require("stream");
const PDFDocument = require("pdfkit");
const { resolveDocumentType, COMPOSITION_DISCLOSURE } = require("./invoiceType");
const { amountInWords } = require("./amountInWords");

// --- Page geometry (A4 = 595 x 842 pt) ---
const MARGIN = 36;
const LEFT = MARGIN;
const RIGHT = 595 - MARGIN;
const WIDTH = RIGHT - LEFT;
const PAGE_BOTTOM = 842 - MARGIN;

// Brand palette - same greens as the storefront (storefront/tailwind.config.js "brand").
const C = {
  brandDark: "#2d5016", // brand-700: title bar, headings
  brand: "#3d6923", // brand-600: table header
  brandTint: "#f2f7ee", // brand-50: shaded boxes
  brandLine: "#c3d8b1", // brand-200: borders
  rowAlt: "#f8faf6",
  text: "#1f2937",
  muted: "#6b7280",
  white: "#ffffff",
};

const LOGO_PATH = path.join(__dirname, "..", "assets", "invoice-logo.png");

const TITLES = { bill_of_supply: "BILL OF SUPPLY", tax_invoice: "TAX INVOICE", receipt: "RECEIPT" };
const NUMBER_LABELS = { bill_of_supply: "Bill No", tax_invoice: "Invoice No", receipt: "Receipt No" };

// Helvetica has no ₹ glyph, so amounts use "Rs." with Indian digit grouping (1,25,000.00).
const money = (value) =>
  `Rs. ${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const round2 = (value) => Math.round(value * 100) / 100;

// DD-MM-YYYY in Indian time, whatever timezone the server runs in.
const formatDate = (date) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date(date));
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get("day")}-${get("month")}-${get("year")}`;
};

const PAYMENT_STATUS = {
  pending: "Pending (pay on delivery)",
  paid: "Paid",
  refund_requested: "Refund requested",
  refunded: "Refunded",
};

const itemName = (lineItem) => lineItem.name + (lineItem.variantLabel ? ` (${lineItem.variantLabel})` : "");

// --- Sections ------------------------------------------------------------------------------

function drawHeader(doc, type, order, settings) {
  const top = MARGIN;
  const storeName = settings.storeName || "Ashoka Traders";

  // Left: business details
  doc.fillColor(C.brandDark).font("Helvetica-Bold").fontSize(20).text(storeName, LEFT, top, { width: 320 });
  doc.fillColor(C.text).font("Helvetica").fontSize(9);
  const lines = [
    settings.storeAddress,
    type !== "receipt" && `GSTIN: ${settings.gstNumber}`,
    settings.panNumber && `PAN: ${settings.panNumber}`,
    [settings.supportEmail && `Email: ${settings.supportEmail}`, settings.supportPhone && `Phone: ${settings.supportPhone}`]
      .filter(Boolean)
      .join("   "),
  ].filter(Boolean);
  doc.moveDown(0.2);
  lines.forEach((line) => doc.text(line, LEFT, doc.y + 1, { width: 320 }));
  const leftBottom = doc.y;

  // Right: logo, with the bill number/date box beside it
  const logoSize = 68;
  try {
    doc.image(LOGO_PATH, RIGHT - logoSize, top - 4, { width: logoSize, height: logoSize });
  } catch {
    // Missing logo file shouldn't stop a customer getting their bill.
  }

  const boxW = 150;
  const boxX = RIGHT - logoSize - 10 - boxW;
  const boxY = top + 6;
  doc.roundedRect(boxX, boxY, boxW, 44, 3).lineWidth(0.8).strokeColor(C.brandLine).stroke();
  const infoRow = (label, value, y) => {
    doc.font("Helvetica").fontSize(8).fillColor(C.muted).text(label, boxX + 8, y, { width: 55 });
    doc.font("Helvetica-Bold").fontSize(9).fillColor(C.text).text(value, boxX + 60, y - 0.5, { width: boxW - 66, align: "right" });
  };
  infoRow(`${NUMBER_LABELS[type]}:`, order.billNumber || "-", boxY + 9);
  infoRow("Date:", formatDate(order.createdAt), boxY + 26);

  // Title bar
  const barY = Math.max(leftBottom, top + logoSize) + 10;
  doc.rect(LEFT, barY, WIDTH, 24).fill(C.brandDark);
  doc.fillColor(C.white).font("Helvetica-Bold").fontSize(13).text(TITLES[type], LEFT, barY + 6.5, {
    width: WIDTH,
    align: "center",
    characterSpacing: 2,
  });
  return barY + 24 + 12;
}

function drawParties(doc, y, order) {
  const gap = 12;
  const billW = WIDTH * 0.58;
  const metaX = LEFT + billW + gap;
  const metaW = RIGHT - metaX;

  const customer = [
    order.address.addressLine,
    order.address.landmark && `Landmark: ${order.address.landmark}`,
    `${order.address.city}, ${order.address.state} - ${order.address.pincode}`,
    `Phone: ${order.address.phone}`,
    order.user?.email && `Email: ${order.user.email}`,
  ].filter(Boolean);

  // Measure first so both boxes share one height.
  doc.font("Helvetica").fontSize(9);
  const textW = billW - 20;
  const bodyH = customer.reduce((h, line) => h + doc.heightOfString(line, { width: textW }) + 1.5, 0);
  const boxH = Math.max(18 + 14 + bodyH + 10, 88);

  // Bill To (shaded)
  doc.rect(LEFT, y, billW, boxH).fill(C.brandTint);
  doc.fillColor(C.brandDark).font("Helvetica-Bold").fontSize(8).text("BILL TO", LEFT + 10, y + 9, { characterSpacing: 1 });
  doc.fillColor(C.text).font("Helvetica-Bold").fontSize(10.5).text(order.address.name, LEFT + 10, y + 22, { width: textW });
  doc.font("Helvetica").fontSize(9);
  customer.forEach((line) => doc.text(line, LEFT + 10, doc.y + 1.5, { width: textW }));

  // Order details
  doc.rect(metaX, y, metaW, boxH).lineWidth(0.8).strokeColor(C.brandLine).stroke();
  doc.fillColor(C.brandDark).font("Helvetica-Bold").fontSize(8).text("ORDER DETAILS", metaX + 10, y + 9, { characterSpacing: 1 });
  const rows = [
    ["Order ID", `#${order._id.toString().slice(-8).toUpperCase()}`],
    ["Payment Mode", order.paymentMethod === "COD" ? "Cash on Delivery" : "Online (Razorpay)"],
    ["Payment Status", PAYMENT_STATUS[order.paymentStatus] || order.paymentStatus],
    ["Place of Supply", order.address.state],
  ];
  let rowY = y + 24;
  rows.forEach(([label, value]) => {
    doc.font("Helvetica").fontSize(8.5).fillColor(C.muted).text(label, metaX + 10, rowY, { width: 75 });
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(C.text).text(value, metaX + 85, rowY, { width: metaW - 95, align: "right" });
    rowY += 14;
  });

  return y + boxH + 14;
}

/**
 * Item table. Composition bills and receipts: #, Description, HSN, Qty, Rate, Amount - and
 * deliberately NO tax columns. Regular tax invoices add Taxable Value / GST % / tax columns.
 */
function drawItems(doc, y, order, type, settings) {
  const isTax = type === "tax_invoice";
  const rate = Number(settings.gstRate) || 0;
  const storeState = (settings.storeState || "").trim().toLowerCase();
  const intraState = storeState !== "" && order.address.state.trim().toLowerCase() === storeState;

  const columns = isTax
    ? [
        { key: "n", label: "#", w: 18, align: "center" },
        { key: "desc", label: "Description", w: 150, align: "left" },
        { key: "hsn", label: "HSN", w: 42, align: "center" },
        { key: "qty", label: "Qty", w: 28, align: "right" },
        { key: "taxable", label: "Taxable Value", w: 72, align: "right" },
        { key: "rate", label: "GST%", w: 40, align: "right" },
        { key: "tax", label: intraState ? "CGST + SGST" : "IGST", w: 81, align: "right" },
        { key: "amount", label: "Amount", w: 0, align: "right" },
      ]
    : [
        { key: "n", label: "#", w: 24, align: "center" },
        { key: "desc", label: "Description", w: 245, align: "left" },
        { key: "hsn", label: "HSN Code", w: 60, align: "center" },
        { key: "qty", label: "Qty", w: 40, align: "right" },
        { key: "rate", label: "Rate", w: 75, align: "right" },
        { key: "amount", label: "Amount", w: 0, align: "right" },
      ];
  // Last column takes whatever width is left.
  const fixed = columns.reduce((sum, col) => sum + col.w, 0);
  columns[columns.length - 1].w = WIDTH - fixed;
  let x = LEFT;
  columns.forEach((col) => {
    col.x = x;
    x += col.w;
  });

  const PAD = 5;
  const headerRow = (atY) => {
    doc.rect(LEFT, atY, WIDTH, 20).fill(C.brand);
    doc.fillColor(C.white).font("Helvetica-Bold").fontSize(8.5);
    columns.forEach((col) => doc.text(col.label, col.x + PAD, atY + 6, { width: col.w - PAD * 2, align: col.align }));
    return atY + 20;
  };

  y = headerRow(y);
  let taxableSum = 0;
  let taxSum = 0;

  order.items.forEach((lineItem, i) => {
    const amount = lineItem.price * lineItem.quantity;
    const cells = {
      n: String(i + 1),
      desc: itemName(lineItem),
      hsn: lineItem.hsnCode || "",
      qty: String(lineItem.quantity),
      rate: money(lineItem.price),
      amount: money(amount),
    };
    if (isTax) {
      const taxable = round2(amount / (1 + rate / 100));
      const tax = round2(amount - taxable);
      taxableSum += taxable;
      taxSum += tax;
      Object.assign(cells, { taxable: money(taxable), rate: `${rate}%`, tax: money(tax) });
    }

    doc.font("Helvetica").fontSize(9);
    const descCol = columns.find((col) => col.key === "desc");
    const rowH = Math.max(doc.heightOfString(cells.desc, { width: descCol.w - PAD * 2 }) + 12, 22);

    // Long orders: continue the table on a new page with its header repeated.
    if (y + rowH > PAGE_BOTTOM - 40) {
      doc.addPage();
      y = headerRow(MARGIN);
    }

    if (i % 2 === 1) doc.rect(LEFT, y, WIDTH, rowH).fill(C.rowAlt);
    doc.fillColor(C.text).font("Helvetica").fontSize(9);
    columns.forEach((col) => doc.text(cells[col.key] ?? "", col.x + PAD, y + 6, { width: col.w - PAD * 2, align: col.align }));
    y += rowH;
  });

  doc.moveTo(LEFT, y).lineTo(RIGHT, y).lineWidth(1).strokeColor(C.brand).stroke();
  return { y: y + 10, taxableSum, taxSum, intraState };
}

function drawTotals(doc, y, order, type, taxInfo) {
  const boxW = 230;
  const boxX = RIGHT - boxW;
  const rows = [
    ["Subtotal", money(order.subtotal)],
    ["Shipping Fee", order.shippingFee > 0 ? money(order.shippingFee) : "Free"],
  ];
  if (order.discount > 0) {
    rows.push([`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`, `- ${money(order.discount)}`]);
  }

  rows.forEach(([label, value]) => {
    doc.font("Helvetica").fontSize(9.5).fillColor(C.text).text(label, boxX + 8, y, { width: 130 });
    doc.text(value, boxX + 8, y, { width: boxW - 16, align: "right" });
    y += 16;
  });

  y += 2;
  doc.rect(boxX, y, boxW, 24).fill(C.brandDark);
  doc.fillColor(C.white).font("Helvetica-Bold").fontSize(11).text("Grand Total", boxX + 8, y + 7, { width: 110 });
  doc.text(money(order.total), boxX + 8, y + 7, { width: boxW - 16, align: "right" });
  y += 24;

  // Regular-scheme only: how much of the total is GST.
  if (type === "tax_invoice") {
    const { taxableSum, taxSum, intraState } = taxInfo;
    const half = round2(taxSum / 2);
    doc.fillColor(C.muted).font("Helvetica").fontSize(8).text(
      `Includes GST ${money(taxSum)}` +
        (intraState ? ` (CGST ${money(half)} + SGST ${money(round2(taxSum - half))})` : " (IGST)") +
        ` on taxable value ${money(taxableSum)}`,
      LEFT,
      y + 4,
      { width: WIDTH, align: "right" }
    );
    y += 14;
  }
  return y + 12;
}

function drawFooter(doc, y, order, type, settings) {
  const storeName = settings.storeName || "Ashoka Traders";
  const terms = (settings.invoiceTerms || "")
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 3);

  // Estimate the footer's height; move it to a new page if it won't fit.
  const needed = 30 + (type === "bill_of_supply" ? 34 : 0) + 100;
  if (y + needed > PAGE_BOTTOM) {
    doc.addPage();
    y = MARGIN;
  }

  // Amount in words
  doc.rect(LEFT, y, WIDTH, 26).fill(C.brandTint);
  doc.fillColor(C.muted).font("Helvetica").fontSize(8).text("Total Amount (in words):", LEFT + 10, y + 9, { width: 110 });
  doc.fillColor(C.text).font("Helvetica-Bold").fontSize(9).text(amountInWords(order.total), LEFT + 118, y + 8.5, {
    width: WIDTH - 128,
  });
  y += 26 + 10;

  // Mandatory composition disclosure - boxed and bold so it can't be missed.
  if (type === "bill_of_supply") {
    doc.rect(LEFT, y, WIDTH, 24).lineWidth(1.2).strokeColor(C.brandDark).stroke();
    doc.fillColor(C.brandDark).font("Helvetica-Bold").fontSize(10).text(`${COMPOSITION_DISCLOSURE}.`, LEFT, y + 7.5, {
      width: WIDTH,
      align: "center",
    });
    y += 24 + 10;
  }

  // Terms (left) + signatory (right)
  const termsW = WIDTH * 0.58;
  doc.font("Helvetica").fontSize(8);
  const termsTextH = terms.reduce((h, t) => h + doc.heightOfString(`${t}`, { width: termsW - 30 }) + 2, 0);
  const blockH = Math.max(termsTextH + 26, 84);

  doc.rect(LEFT, y, termsW, blockH).lineWidth(0.8).strokeColor(C.brandLine).stroke();
  doc.fillColor(C.brandDark).font("Helvetica-Bold").fontSize(8).text("TERMS & CONDITIONS", LEFT + 10, y + 8, { characterSpacing: 1 });
  let termY = y + 22;
  doc.fillColor(C.text).font("Helvetica").fontSize(8);
  terms.forEach((term, i) => {
    doc.text(`${i + 1}.`, LEFT + 10, termY, { width: 12 });
    doc.text(term, LEFT + 22, termY, { width: termsW - 30 });
    termY = doc.y + 2;
  });

  const signX = LEFT + termsW + 12;
  const signW = RIGHT - signX;
  doc.fillColor(C.text).font("Helvetica-Bold").fontSize(9).text(`For ${storeName}`, signX, y + 8, { width: signW, align: "right" });
  doc.moveTo(signX + 20, y + blockH - 20).lineTo(RIGHT, y + blockH - 20).lineWidth(0.8).strokeColor(C.text).stroke();
  doc.font("Helvetica").fontSize(8.5).fillColor(C.muted).text("Authorised Signatory", signX, y + blockH - 14, {
    width: signW,
    align: "right",
  });
  y += blockH + 12;

  doc.fillColor(C.muted).font("Helvetica").fontSize(8).text(`Thank you for shopping with ${storeName}!`, LEFT, y, {
    width: WIDTH,
    align: "center",
  });
}

/**
 * Streams a single-page A4 bill for an order. The document type follows Settings.gstScheme
 * (see utils/invoiceType.js):
 *  - composition               -> "Bill of Supply": GSTIN + mandatory disclosure, no tax anywhere
 *  - regular                   -> "Tax Invoice": GST columns and a CGST/SGST or IGST summary
 *  - not_registered / no GSTIN -> plain "Receipt", no GST details
 *
 * @param {import("../models/Order")} order - populated with `user` (name, email); needs billNumber set
 * @param {import("../models/Settings")} settings
 * @param {import("stream").Writable & { setHeader?: Function }} res - HTTP response or any writable stream
 */
function generateInvoicePDF(order, settings, res) {
  const type = resolveDocumentType(settings);
  const doc = new PDFDocument({ size: "A4", margin: MARGIN, info: { Title: `${TITLES[type]} ${order.billNumber || ""}`.trim() } });

  if (typeof res.setHeader === "function") {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${invoiceFileName(order, settings)}"`);
  }
  doc.pipe(res);

  let y = drawHeader(doc, type, order, settings);
  y = drawParties(doc, y, order);
  const items = drawItems(doc, y, order, type, settings);
  y = drawTotals(doc, items.y, order, type, items);
  drawFooter(doc, y, order, type, settings);

  doc.end();
}

/** e.g. "bill-of-supply-AT-26-27-0001.pdf" - same name for downloads and email attachments. */
function invoiceFileName(order, settings) {
  const prefix = { bill_of_supply: "bill-of-supply", tax_invoice: "invoice", receipt: "receipt" }[resolveDocumentType(settings)];
  const fileId = (order.billNumber || order._id.toString()).replace(/\//g, "-");
  return `${prefix}-${fileId}.pdf`;
}

/**
 * Renders the same bill as generateInvoicePDF into memory, for attaching to emails.
 * @returns {Promise<Buffer>}
 */
function renderInvoicePDFBuffer(order, settings) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const sink = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(chunk);
        callback();
      },
    });
    sink.on("finish", () => resolve(Buffer.concat(chunks)));
    sink.on("error", reject);
    try {
      generateInvoicePDF(order, settings, sink);
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateInvoicePDF, renderInvoicePDFBuffer, invoiceFileName };
