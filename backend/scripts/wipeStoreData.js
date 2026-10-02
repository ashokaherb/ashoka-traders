#!/usr/bin/env node
/**
 * Clears the shop's trial data so the real catalogue can be loaded for launch.
 *
 *   npm run db:wipe                 - DRY RUN: prints exactly what would be deleted
 *   npm run db:wipe -- --confirm    - actually deletes (asks you to type the database name)
 *
 * Deliberately awkward to run by accident:
 *   - a dry run is the default;
 *   - --confirm needs CONFIRM_DB to match the database it is connected to;
 *   - it refuses to touch anything until a backup exists, unless --skip-backup-check.
 *
 * What it deletes: products, categories, banners, offers, coupons, orders, payment
 * intents and bill counters.
 * What it KEEPS: user accounts (so the admin login still works) and store settings.
 * Customer accounts can be cleared too with --include-customers (admins are always kept).
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const args = process.argv.slice(2);
const confirm = args.includes("--confirm");
const includeCustomers = args.includes("--include-customers");
const skipBackupCheck = args.includes("--skip-backup-check");

const COLLECTIONS = ["products", "categories", "banners", "offers", "coupons", "orders", "paymentintents", "counters"];

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const dbName = db.databaseName;

  console.log(`Database: ${dbName}`);
  console.log(confirm ? "Mode: DELETE\n" : "Mode: dry run (nothing will be deleted)\n");

  const existing = (await db.listCollections().toArray()).map((c) => c.name);
  const targets = COLLECTIONS.filter((name) => existing.includes(name));

  let totalDocs = 0;
  for (const name of targets) {
    const count = await db.collection(name).countDocuments();
    totalDocs += count;
    console.log(`  ${String(count).padStart(6)} documents  ${name}`);
  }

  const customerFilter = { isAdmin: { $ne: true } };
  const customerCount = existing.includes("users") ? await db.collection("users").countDocuments(customerFilter) : 0;
  const adminCount = existing.includes("users") ? await db.collection("users").countDocuments({ isAdmin: true }) : 0;
  console.log(`  ${String(customerCount).padStart(6)} customer accounts  ${includeCustomers ? "(will be deleted)" : "(kept - pass --include-customers to clear)"}`);
  console.log(`  ${String(adminCount).padStart(6)} admin accounts      (always kept)`);
  console.log("         store settings      (kept)\n");

  if (!confirm) {
    console.log(`Dry run only. ${totalDocs} documents would be deleted.`);
    console.log(`To do it for real:\n  npm run db:backup\n  CONFIRM_DB=${dbName} npm run db:wipe -- --confirm`);
    await mongoose.disconnect();
    return;
  }

  if (process.env.CONFIRM_DB !== dbName) {
    console.error(`Refusing to delete: set CONFIRM_DB=${dbName} to confirm you mean THIS database.`);
    process.exit(1);
  }

  if (!skipBackupCheck) {
    const backupsDir = path.join(__dirname, "..", "backups");
    const hasBackup = fs.existsSync(backupsDir) && fs.readdirSync(backupsDir).length > 0;
    if (!hasBackup) {
      console.error("Refusing to delete: no backup found in backend/backups.");
      console.error("Run `npm run db:backup` first (or pass --skip-backup-check if it is stored elsewhere).");
      process.exit(1);
    }
  }

  for (const name of targets) {
    const { deletedCount } = await db.collection(name).deleteMany({});
    console.log(`  deleted ${deletedCount} from ${name}`);
  }
  if (includeCustomers && existing.includes("users")) {
    const { deletedCount } = await db.collection("users").deleteMany(customerFilter);
    console.log(`  deleted ${deletedCount} customer accounts`);
  }

  console.log("\nDone. Next steps:");
  console.log("  1. npm run seed:admin        (create the launch admin account)");
  console.log("  2. Admin > Settings          (GST scheme, real GSTIN, PAN, shipping)");
  console.log("  3. Load the real catalogue   (admin > Products, or Bulk Upload)");
  await mongoose.disconnect();
})().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
