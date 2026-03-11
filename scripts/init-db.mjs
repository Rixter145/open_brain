#!/usr/bin/env node
/**
 * Create the thoughts table (and pgvector extension) in the database.
 * Chooses schema from EMBEDDING_PROVIDER: OpenAI (default) → schema.sql (1536 dims),
 * Ollama/Google → schema-ollama.sql (768 dims).
 * Usage: node scripts/init-db.mjs
 * Requires: .env with DATABASE_URL set.
 */
import "dotenv/config";
import pg from "pg";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const provider = (process.env.EMBEDDING_PROVIDER || "").toLowerCase();
const use768 =
  provider === "ollama" || provider === "google" || provider === "gemini";
const schemaFile = use768 ? "schema-ollama.sql" : "schema.sql";
const schemaPath = join(__dirname, "..", schemaFile);
const dims = use768 ? 768 : 1536;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url?.trim()) {
    console.error("FAIL: DATABASE_URL is missing. Set it in .env");
    process.exit(1);
  }

  const sql = readFileSync(schemaPath, "utf8");
  const client = new pg.Client({ connectionString: url });

  try {
    await client.connect();
    await client.query(sql);
    console.log(`OK: thoughts table created (${dims} dimensions, ${schemaFile}).`);
  } catch (err) {
    console.error("FAIL:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
