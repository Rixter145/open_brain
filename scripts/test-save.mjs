#!/usr/bin/env node
/**
 * Save a single thought to the Open Brain DB (embed + insert).
 * Uses the same path as the MCP server. Run after: npm run build
 * Usage: node scripts/test-save.mjs "Your thought here"
 *    or: node scripts/test-save.mjs   (uses default text)
 */
import "dotenv/config";
import { embed } from "../dist/embeddings.js";
import { insertThought } from "../dist/db.js";

const content = process.argv[2]?.trim() || "Test thought from Open Brain script";

async function main() {
  const vector = await embed(content);
  const row = await insertThought({
    content,
    embedding: vector,
    source: "test-script",
  });
  console.log("Saved:", row.id, row.content);
  console.log("created_at:", row.created_at);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
