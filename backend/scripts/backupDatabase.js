#!/usr/bin/env node
/**
 * Exports every collection to JSON files, so there is always a restore point before the
 * launch cleanup.
 *
 *   npm run db:backup              -> backend/backups/<timestamp>/<collection>.json
 *   npm run db:backup -- /some/dir -> writes there instead
 *
 * Read-only: it never changes the database. Keep the folder somewhere safe (it contains
 * customer data), and do not commit it - backend/backups/ is git-ignored.
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set - nothing to back up.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = process.argv[2] || path.join(__dirname, "..", "backups", stamp);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`Database: ${db.databaseName}`);
  console.log(`Writing to: ${outDir}\n`);

  const collections = await db.listCollections().toArray();
  let total = 0;
  for (const { name } of collections) {
    const docs = await db.collection(name).find({}).toArray();
    fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(docs, null, 2));
    total += docs.length;
    console.log(`  ${String(docs.length).padStart(6)} documents  ${name}`);
  }

  console.log(`\nDone - ${total} documents from ${collections.length} collections.`);
  await mongoose.disconnect();
})().catch((err) => {
  console.error("Backup failed:", err.message);
  process.exit(1);
});
