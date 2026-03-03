#!/usr/bin/env node
/**
 * Test that .env is loaded, DATABASE_URL is set, database is reachable,
 * thoughts table exists, and embeddings work (OpenAI or Ollama per EMBEDDING_PROVIDER).
 * Does not print secret values.
 */
import "dotenv/config";
import pg from "pg";
import OpenAI from "openai";

const has = (v) => typeof v === "string" && v.trim().length > 0;

function useOllama() {
  if (process.env.EMBEDDING_PROVIDER === "ollama") return true;
  if (!has(process.env.OPENAI_API_KEY) && has(process.env.OLLAMA_HOST)) return true;
  return false;
}

function main() {
  console.log("Checking .env and database...\n");

  const dbUrl = process.env.DATABASE_URL;
  const openaiKey = process.env.OPENAI_API_KEY;
  const ollama = useOllama();

  if (!has(dbUrl)) {
    console.error("FAIL: DATABASE_URL is missing or empty in .env");
    process.exit(1);
  }
  const connectionString = dbUrl.trim().replace(/^["']|["']$/g, "");
  if (!connectionString.startsWith("postgresql://") && !connectionString.startsWith("postgres://")) {
    console.error("FAIL: DATABASE_URL should start with postgresql:// or postgres://");
    process.exit(1);
  }
  console.log("OK: DATABASE_URL is set (length " + connectionString.length + ", format OK)");
  if (process.argv.includes("--debug")) {
    const redacted = connectionString.replace(
      /:\/\/([^:]+):([^@]+)@/,
      (_, user, _pass) => `://${user}:***@`
    );
    console.log("    (debug) " + redacted);
  }

  if (ollama) {
    const host = process.env.OLLAMA_HOST || "http://localhost:11434";
    console.log("OK: Using Ollama for embeddings (" + host + ")");
  } else {
    if (!has(openaiKey)) {
      console.error("FAIL: OPENAI_API_KEY is missing or empty. Set it in .env or use EMBEDDING_PROVIDER=ollama.");
      process.exit(1);
    }
    console.log("OK: OPENAI_API_KEY is set");
  }

  const pool = new pg.Pool({ connectionString });
  pool
    .query("SELECT 1 as ok")
    .then(() => pool.query(
      "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'thoughts') as exists"
    ))
    .then((res) => {
      const tableExists = res.rows[0]?.exists;
      console.log("OK: Database connection works");
      if (tableExists) {
        console.log("OK: thoughts table exists");
      } else {
        console.log("WARN: thoughts table not found. Run schema.sql or schema-ollama.sql in your database.");
      }
      return ollama ? testOllama() : testOpenAI(openaiKey);
    })
    .then(() => {
      console.log("\nEnv check passed.");
      pool.end();
    })
    .catch((err) => {
      if (err.code === "ERR_INVALID_URL" || err.message?.includes("Invalid URL")) {
        console.error("FAIL: DATABASE_URL is not a valid URL. In .env use exactly:");
        console.error("   DATABASE_URL=postgresql://user:password@host:5432/dbname");
        console.error("   - No quotes around the value");
        console.error("   - If your password has special chars (@ # / % etc), URL-encode them");
        console.error("   - No spaces before/after the = or at line end");
      } else if (err.message?.includes("429") || err.message?.includes("quota")) {
        console.error("FAIL: OpenAI API:", err.message);
        console.error("   (Check billing/quota at https://platform.openai.com/account/billing)");
      } else {
        console.error("FAIL:", err.message);
      }
      pool.end();
      process.exit(1);
    });
}

async function testOllama() {
  const base = (process.env.OLLAMA_HOST || "http://localhost:11434").replace(/\/$/, "");
  const res = await fetch(base + "/api/embed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "nomic-embed-text", input: "test" }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error("Ollama embeddings failed: " + res.status + " " + err);
  }
  const data = await res.json();
  const vec = data.embeddings?.[0];
  if (!vec || !Array.isArray(vec) || vec.length !== 768) {
    throw new Error("Ollama returned invalid embedding (expected 768 dimensions)");
  }
  console.log("OK: Ollama API works (embedding test passed)");
}

async function testOpenAI(apiKey) {
  const openai = new OpenAI({ apiKey });
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: "test",
    dimensions: 1536,
  });
  const vec = res.data[0]?.embedding;
  if (!vec || vec.length !== 1536) {
    throw new Error("OpenAI embeddings returned invalid response");
  }
  console.log("OK: OpenAI API key works (embedding test passed)");
}

main();
