# Open Brain – MCP server

One shared memory layer for Cursor, Claude, and any MCP client: thoughts stored in **Postgres + pgvector**, exposed via an **MCP server** with semantic search and capture.

- **Capture**: Save thoughts from any client; each is embedded (OpenAI `text-embedding-3-small`) and stored.
- **Retrieve**: Semantic search by meaning, list recent thoughts, or view stats.
- **Same brain everywhere**: One Postgres DB and one MCP server; point Cursor, Claude Desktop, and other clients at it.

## Prerequisites

- **Node.js** 18+
- **Postgres** 15+ with the **pgvector** extension (e.g. [Supabase](https://supabase.com) free tier, or self‑hosted).
- **OpenAI API key** (for embeddings).

## 1. Database setup

Create a Postgres database and run the schema once:

```bash
# If using Supabase: use the SQL editor in the dashboard and paste schema.sql.
# If using psql:
psql $DATABASE_URL -f schema.sql
```

Or paste the contents of [schema.sql](schema.sql) into your Postgres client. This creates the `thoughts` table and an HNSW index for vector search.

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

The server uses **OpenAI `text-embedding-3-small`** (1536 dimensions) for every capture and every search query so the vector space is consistent. Do not change the embedding model without re-embedding existing rows.

## Project layout

- `schema.sql` – Postgres + pgvector schema (run once).
- `src/index.ts` – MCP server and tool handlers.
- `src/db.ts` – Postgres + pgvector access (insert, search, list, stats).
- `src/embeddings.ts` – OpenAI embedding calls.

## Optional: metadata extraction

The plan mentioned optional metadata (people, topics, type, action items) via an LLM call. The current schema and table support these columns; the server currently only stores `content`, `embedding`, and `source`. You can extend `capture_thought` to call an LLM, parse the response, and fill `people`, `topics`, `type`, and `action_items` in `insertThought`.
