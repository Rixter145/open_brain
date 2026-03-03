# Open Brain – MCP server

One shared memory layer for Cursor, Claude, and any MCP client: thoughts stored in **Postgres + pgvector**, exposed via an **MCP server** with semantic search and capture.

- **Capture**: Save thoughts from any client; each is embedded (OpenAI `text-embedding-3-small`) and stored.
- **Retrieve**: Semantic search by meaning, list recent thoughts, or view stats.
- **Same brain everywhere**: One Postgres DB and one MCP server; point Cursor, Claude Desktop, and other clients at it.

## Prerequisites

- **Node.js** 18+
- **Postgres** 15+ with the **pgvector** extension (e.g. [Supabase](https://supabase.com) free tier, or self‑hosted).
- **OpenAI API key** (for embeddings), or **Ollama** for free local embeddings (see [Using Ollama](#using-ollama-free-embeddings) below).

## Finish setup on this machine

1. **Build** (in a terminal where Node/npm are available):
   ```powershell
   cd "c:\Users\rix\OneDrive\open-brain"
   npm install
   npm run build
   ```
2. **Env**: Edit `.env` in the project root and set `DATABASE_URL` and `OPENAI_API_KEY`.
3. **Database**: If you don’t have a DB yet, follow [Database setup](#1-database-setup) below (Supabase free tier is the easiest). Then run [schema.sql](schema.sql) once.
4. **Cursor**: Add the Open Brain MCP server in Cursor Settings → MCP (see [Connect clients](#3-connect-clients) below), then reload the window.

---

## Using Ollama (free embeddings)

To avoid paying for OpenAI, you can use **Ollama** with **nomic-embed-text** (runs locally, no API key).

1. **Install Ollama** from [ollama.com](https://ollama.com) and start it.
2. **Pull the embedding model:**  
   `ollama pull nomic-embed-text`
3. **In `.env`:** set `EMBEDDING_PROVIDER=ollama`. Optionally set `OLLAMA_HOST=http://localhost:11434` if Ollama runs elsewhere. You do **not** need `OPENAI_API_KEY`.
4. **Database:** The Ollama model uses **768 dimensions** (not 1536). If you already have a `thoughts` table from the OpenAI schema, drop it and re-run the Ollama schema:  
   In Supabase SQL Editor, run `DROP TABLE IF EXISTS thoughts;` then paste and run the contents of [schema-ollama.sql](schema-ollama.sql).
5. **Cursor MCP:** In the Open Brain server env, include `EMBEDDING_PROVIDER=ollama` (and optionally `OLLAMA_HOST`). No `OPENAI_API_KEY` needed.
6. Restart Cursor (or reload the window).

After that, capture and search use your local Ollama embeddings. You cannot mix OpenAI (1536) and Ollama (768) in the same table.

---

## 1. Database setup

Open Brain needs **Postgres 15+** with the **pgvector** extension. The easiest way is [Supabase](https://supabase.com) (free tier, pgvector included).

### Option A: Supabase (recommended, free)

1. **Create an account**  
   Go to [supabase.com](https://supabase.com) and sign up (GitHub or email).

2. **Create a project**  
   - Click **New project**.  
   - Choose your **organization** (or create one).  
   - Set **Name** (e.g. `open-brain`), **Database password** (save it somewhere safe), and **Region**.  
   - Click **Create new project** and wait until it’s ready.

3. **Get the connection string**  
   - In the left sidebar: **Project Settings** (gear) → **Database**.  
   - Under **Connection string** choose **URI**.  
   - Copy the URI. It looks like:  
     `postgresql://postgres.[ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres`  
   - Replace `[YOUR-PASSWORD]` with the database password you set in step 2.  
   - **If your password has special characters** (`@`, `#`, `/`, `%`, etc.), they must be URL-encoded in the URI. Run:  
     `node scripts/encode-password.mjs "YourPassword"`  
     and use the output in place of the password in the URL.  
   - Put this full URI in your `.env` as `DATABASE_URL`.

4. **Run the schema**  
   - In the left sidebar: **SQL Editor**.  
   - Click **New query**.  
   - Open [schema.sql](schema.sql) in this repo, copy its **entire** contents, paste into the editor, and click **Run** (or Ctrl+Enter).  
   - You should see “Success. No rows returned.” The `thoughts` table and vector index are now created.

5. **Use the same `DATABASE_URL`** in your `.env` and in Cursor’s MCP config for the Open Brain server.

### Option B: Other Postgres (with pgvector)

If you use another host (e.g. Neon, Railway, or your own server):

- Ensure **pgvector** is enabled (run `CREATE EXTENSION IF NOT EXISTS vector;` if needed).
- Connection string format: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE`.
- Run the contents of [schema.sql](schema.sql) once (e.g. via `psql $DATABASE_URL -f schema.sql` or your host’s SQL runner).

## 2. Install and run the MCP server

```bash
cd open-brain
npm install
npm run build
```

Set environment variables (or use a `.env` file with something like `dotenv` if you add it):

- **`DATABASE_URL`** – Postgres connection string (e.g. `postgresql://user:pass@host:5432/dbname`).
- **`OPENAI_API_KEY`** – OpenAI API key for embeddings.

Run the server (stdio; clients will start it as a subprocess):

```bash
npm start
# or for development: npm run dev
```

## 3. Connect clients

### Cursor

1. Open Cursor Settings → **MCP** (or edit your MCP config file).
2. Add a server entry for Open Brain, for example:

```json
{
  "mcpServers": {
    "open-brain": {
      "command": "node",
      "args": ["C:\\Users\\rix\\OneDrive\\open-brain\\dist\\index.js"],
      "env": {
        "DATABASE_URL": "postgresql://...",
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

Use the real path to `dist/index.js` on your machine. Restart Cursor so it picks up the new server.

### Claude Desktop

In Claude Desktop’s MCP config (e.g. `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "open-brain": {
      "command": "node",
      "args": ["C:\\Users\\rix\\OneDrive\\open-brain\\dist\\index.js"],
      "env": {
        "DATABASE_URL": "postgresql://...",
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

Again, use your actual path and env values. Restart Claude Desktop.

## MCP tools

| Tool | Purpose |
|------|--------|
| **capture_thought** | Save a thought (content + optional source). It is embedded and stored. |
| **search_brain** | Semantic search by meaning (e.g. “career change”, “meeting with Sarah”). |
| **list_recent** | List recent thoughts (optional: last N days). |
| **brain_stats** | Count of thoughts and activity in the last 7 and 30 days. |

All tools return plain text (and optional metadata) so any model can interpret the results.

## Embedding model

By default the server uses **OpenAI `text-embedding-3-small`** (1536 dimensions). If `EMBEDDING_PROVIDER=ollama` (or `OPENAI_API_KEY` is unset and `OLLAMA_HOST` is set), it uses **Ollama `nomic-embed-text`** (768 dimensions) instead. Use the matching schema ([schema.sql](schema.sql) for OpenAI, [schema-ollama.sql](schema-ollama.sql) for Ollama). Do not change the embedding model without re-embedding existing rows.

## Project layout

- `schema.sql` – Postgres + pgvector schema for OpenAI (1536 dims). `schema-ollama.sql` for Ollama (768 dims).
- `src/index.ts` – MCP server and tool handlers.
- `src/db.ts` – Postgres + pgvector access (insert, search, list, stats).
- `src/embeddings.ts` – Embedding calls (OpenAI or Ollama, env-driven).

## Optional: metadata extraction

The plan mentioned optional metadata (people, topics, type, action items) via an LLM call. The current schema and table support these columns; the server currently only stores `content`, `embedding`, and `source`. You can extend `capture_thought` to call an LLM, parse the response, and fill `people`, `topics`, `type`, and `action_items` in `insertThought`.
