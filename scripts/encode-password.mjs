#!/usr/bin/env node
/**
 * URL-encode a database password for use in DATABASE_URL.
 * Usage: node scripts/encode-password.mjs "your#pass@word"
 * Then in .env use: DATABASE_URL=postgresql://user:ENCODED_OUTPUT@host:5432/db
 */
const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/encode-password.mjs \"your-password\"");
  process.exit(1);
}
console.log(encodeURIComponent(password));
