# Open brain system development plan
_Exported on 3/2/2026 at 15:10:08 PST from Cursor (2.5.26)_

---

**User**

Go through this vid - I want to build an open brain where any models can pull from. I have cursor, route llm and also claude. I believe he uses postgres and hosts a mcp server where we can do a 2 way comm . Let's make a plan to do this.
 https://www.youtube.com/watch?v=2JiMmye2ezg 

I currently have nothing built so it will be brand new

---

**Cursor**

Researching the video and the open-brain architecture (Postgres + MCP) so we can draft a plan.


Checking Nate's guide and MCP + pgvector implementation options for a concrete plan.


Checking how Cursor configures MCP servers so we can include connection steps:


Creating a plan to build your Open Brain from scratch, based on the video and implementation options.


---

**User**

do we not store the notes in a vector db ? So wouldn't the capture pipeline be linked between server and then the postgres db?

---

**Cursor**

Short answers:

**1. Do we store notes in a vector DB?**  
Yes. In this design the “vector DB” is **Postgres with the pgvector extension**. There’s one database that holds:
- The note text and metadata (normal columns)
- The embedding (a `vector` column)

So notes are stored in a vector-capable DB; we’re just using Postgres+pgvector instead of a separate system like Pinecone or Qdrant.

**2. Is the capture pipeline linked between the server and Postgres?**  
Yes. The MCP server sits in the middle for both capture and read:

- **Capture (write):**  
  Client (Cursor/Claude/etc.) calls the MCP tool (e.g. `capture_thought`) → **MCP server** receives the text → server gets an embedding (and optionally metadata) → server **writes to Postgres** (INSERT into the `thoughts` table, including the vector). So the link is: **client → MCP server → Postgres**.

- **Retrieval (read):**  
  Client calls e.g. `search_brain` → **MCP server** receives the query → server embeds the query and runs a vector similarity search **in Postgres** → server returns results to the client. So: **client → MCP server → Postgres**.

So the capture pipeline is indeed “linked” between the server and the Postgres DB: the server runs the capture logic and is the only thing that talks to Postgres (for both writes and reads). A more precise picture is:

```
Capture:  [Client] --capture_thought--> [MCP Server] --embed + metadata--> [Postgres + pgvector]
Retrieval: [Client] --search_brain-->   [MCP Server] --query vectors-->     [Postgres + pgvector]
```

If you’d like, we can update the plan doc to say explicitly that “the vector DB is Postgres (pgvector)” and that “the capture pipeline is: client → MCP server → Postgres.”

---

**User**

Yeah cuz the target architecture has embed + classify to the capture pipe line but then it doesn't link that back to postgres?

---

**Cursor**

Good catch. In that diagram the capture pipeline (Embed + Meta) is drawn as separate, and there’s no edge showing that their outputs end up in Postgres. So it doesn’t show the full capture path.

**Intended flow**

1. Client calls MCP (e.g. `capture_thought` with raw text).
2. MCP server calls Embed (and optionally Meta) and gets back vector + metadata.
3. **MCP server writes that result into Postgres** (one INSERT: content + embedding + metadata).

So the “link back to Postgres” is: **MCP server** uses the outputs of Embed and Meta and performs the INSERT. The diagram just doesn’t draw that.

**Clearer diagram**

Either:

- **Option A – Single box for capture:** Treat “capture pipeline” as one step inside the server that does “embed + classify → write to Postgres,” and show one arrow from MCP to Postgres labeled e.g. “capture (embed + metadata + insert).”

- **Option B – Explicit data flow:** Keep Embed and Meta as separate nodes, but add an arrow from them (or from MCP after it has their results) into Postgres, e.g.  
  `Embed --> PG` and `Meta --> PG`  
  or  
  `MCP -->|"embed + metadata"| Embed`, `MCP -->|"embed + metadata"| Meta`, then `Embed --> PG`, `Meta --> PG`  
  with a note that in practice MCP does one INSERT using both outputs.

So yes: the capture pipeline is linked back to Postgres by the MCP server writing the embedding and metadata into the DB; the plan’s diagram should be updated to show that (either by a single “capture → Postgres” arrow or by explicit “embed/classify outputs → Postgres” arrows). If you switch to Agent mode, I can apply that change to the plan file.

---

**User**

ok cool let's update the diagram to correctly reflect it

---

**Cursor**

Updating the plan's diagram to show the capture pipeline (embed + classify) feeding results into Postgres.


Adding a one-line note under the diagram clarifying that MCP orchestrates the write:


Summary of changes:

**Diagram updates**
- **MCP → PG**: Label set to `query search list` so the arrow is clearly for read operations (search_brain, list_recent, etc.).
- **MCP → Embed / Meta**: Split into `embed` and `classify` so capture has two explicit steps.
- **Embed → PG** and **Meta → PG**: New arrows showing that the capture pipeline sends the **vector** and **metadata** into Postgres (MCP does the INSERT using these results).

**Caption**
- Short note that MCP runs the capture flow (calls Embed and Meta, then writes content + vector + metadata to Postgres) and that retrieval is MCP querying Postgres.

So the diagram now shows:
1. Clients talk to MCP.
2. MCP reads from Postgres (query/search/list).
3. For capture, MCP calls Embed and Meta, and their outputs (vector and metadata) are stored in Postgres.
4. Postgres is the single store for both retrieval and capture.

---

**User**

With the embeddings  <-> vector ... how do we ensure that the vector db is correct? is the embedding architecture different through different embedding calls?

---

**Cursor**

Here’s how this works and how to keep the vector DB correct.

## Same model, same space

Embeddings only make sense for search when they live in the **same vector space**:

- **Indexing (capture):** when you store a thought, you run it through an embedding model → you get a vector (e.g. 1536 floats for OpenAI `text-embedding-3-small`).
- **Querying (search):** when someone runs `search_brain`, you embed the **query** with the **same** model → you get a vector in the same space. Similarity (e.g. cosine) between query vector and stored vectors is then meaningful.

If you use **different** models or different dimensions for some calls:

- Vectors from model A and model B are in **different** spaces.
- Similarity between a vector from A and a vector from B is **not** meaningful.
- So the vector DB would be “wrong” in the sense that search results would be unreliable.

So the embedding “architecture” is: **one chosen model and one dimension size** for both capture and search. Different embedding APIs/models → different architectures → not comparable unless you treat them as separate (e.g. separate table or column per model).

## How to keep the vector DB correct

1. **Pick one embedding model and stick to it**  
   e.g. OpenAI `text-embedding-3-small`, or one Cohere/local model. Use it for:
   - every `capture_thought` (embed the new thought before INSERT),
   - every `search_brain` (embed the query before similarity search).

2. **Fix the vector dimension in the schema**  
   Create the pgvector column with that model’s size (e.g. `vector(1536)`). Never put vectors from a different-sized model in that column.

3. **Centralize embedding in one place**  
   All “embed this text” calls go through one service/config (e.g. inside your MCP server or a small shared library) that always calls the same model and returns the same dimension. Then the vector DB stays consistent.

4. **Optional: record which model was used**  
   Add something like `embedding_model` (e.g. `"text-embedding-3-small"`) so you can detect if anything was ever stored with a different model. For a single-model setup you can still enforce “only one model” in code.

5. **If you ever change models**  
   You have to re-embed all existing rows with the new model and from then on use the new model for both capture and search. Old and new vectors are not comparable.

So: the vector DB is “correct” when every stored vector and every query vector is produced by the **same** embedding model and dimension. The embedding architecture is the same for every embedding call in your system; if it differed by call (e.g. different APIs or models), you’d break that consistency and search would be wrong.

---

**User**

ok so basically the embedding has to be the same no matter what BUT the mcp tools can interpret it at the end since it will be in text? 

---

**Cursor**

Yes. You’ve got it.

- **Embedding layer (internal):** One fixed embedding model for both storing thoughts and running search. Vectors stay in one space so similarity search is meaningful. This is hidden from the tools and the user.

- **What MCP tools expose:** They return **text** (and optional metadata): the `content` of the matched thoughts, plus things like `people`, `topics`, `created_at`. No vectors are sent to the client.

So: **same embedding everywhere under the hood**, and **at the end everything is text** (and maybe JSON metadata). Cursor, Claude, Route LLM, etc. all get the same text results; each model then interprets that text in its own way. The vector DB is just the retrieval engine; the interface to every AI is plain text.

---

**User**

So what embedding model should i choose? Any trade offs?

---

**Cursor**

Here’s a concise way to choose and the main trade-offs.

## Common choices

| Option | Typical use | Cost | Quality | Dimensions |
|--------|-------------|------|--------|------------|
| **OpenAI `text-embedding-3-small`** | Default for most apps | ~$0.02 / 1M tokens | Very good | 1536 (or less via dimensions param) |
| **OpenAI `text-embedding-3-large`** | When you want max quality | ~$0.13 / 1M tokens | Best among these | 3072 |
| **OpenAI `text-embedding-ada-002`** | Legacy, still fine | Similar to 3-small | Good | 1536 |
| **Cohere `embed-english-v3.0`** | Strong quality, different vendor | Similar tier to OpenAI | Very good | 1024 |
| **Voyage AI** | Often top on benchmarks | Paid | Very good | 1024+ |
| **Local (e.g. `all-MiniLM-L6-v2`)** | Free, private, no API | $0 | Good for English | 384 |
| **Ollama (e.g. `nomic-embed-text`)** | Local, easy to run | $0 | Good | 768 |

## Trade-offs

**API (OpenAI / Cohere / Voyage)**  
- **Pros:** Best or near-best quality, no GPU, no ops. Same model and dimensions everywhere so your vector DB stays consistent.  
- **Cons:** Cost per token, latency, and your text is sent to their servers (privacy/TOS).

**Local (sentence-transformers, Ollama)**  
- **Pros:** No per-call cost, data stays on your machine, no vendor lock-in.  
- **Cons:** You run and maintain it; dimensions and “space” are fixed by that model (e.g. 384 or 768). Quality is a bit below the best APIs but often fine for personal “second brain” search.

**Dimension size**  
- Smaller (384–768): less storage, faster index and search, sometimes slightly worse retrieval.  
- Larger (1536–3072): more storage and memory, often better retrieval.  
- Your pgvector column must match the model (e.g. `vector(1536)` for 3-small). Pick one and use it for both indexing and search.

## Practical recommendation for Open Brain

- **Default:** **OpenAI `text-embedding-3-small`** (1536 dims). Good quality, predictable cost at “~20 thoughts/day” scale, and you’re already in the OpenAI ecosystem with Cursor/Route LLM.  
- **If you care most about cost and privacy:** **Local** (e.g. **Ollama `nomic-embed-text`** or **sentence-transformers `all-MiniLM-L6-v2`**). Free, no data leaves your machine; quality is good enough for personal semantic search.  
- **If you want the best retrieval and don’t mind higher cost:** **OpenAI `text-embedding-3-large`** or a **Voyage** model.

Whatever you pick, use **that one model only** for every `capture_thought` and every `search_brain` so the vector DB stays correct. The MCP tools still only ever expose **text** (and metadata) to the models; the embedding model is an internal choice.

---

**User**

ok let's use open ai

---

**Cursor**

Updating the plan to lock in OpenAI for embeddings (text-embedding-3-small, 1536 dimensions).


Fixing the decisions table replace (quote character difference):


Summary of what was updated in the plan:

**Embedding model set to OpenAI**

1. **Diagram** – Capture pipeline node label is now **"OpenAI Embeddings"** instead of "Embedding API".

2. **Schema** – `embedding` is specified as **`vector(1536)`** for OpenAI `text-embedding-3-small`.

3. **Section 3 (Capture pipeline)** – States that embeddings use **OpenAI `text-embedding-3-small`** (1536 dims) for both indexing and query embedding, and that the OpenAI Embeddings API is used for capture.

4. **MCP server env** – Notes that **`OPENAI_API_KEY`** is required for embeddings (and optional metadata LLM).

5. **Decisions table** – Embedding model row now says: **OpenAI `text-embedding-3-small`** (1536 dims), used for every capture and every search query.

6. **Summary** – Summary line updated to mention OpenAI `text-embedding-3-small` for every thought and every search query.

The plan now consistently uses **OpenAI `text-embedding-3-small`** (1536 dimensions) for all embedding steps so the vector DB stays in a single, consistent space.

---

**User**

What is STDIO

---

**Cursor**

**STDIO** = **standard input** and **standard output**.

It’s the usual way a process talks to its parent:

- **stdin (standard input)** – the process reads from this (e.g. the terminal or the program that started it).
- **stdout (standard output)** – the process writes its normal output here.
- **stderr (standard error)** – separate stream for error/diagnostic messages.

So “STDIO” here means: the program doesn’t open a network port; it just reads messages from stdin and writes responses to stdout. The parent (e.g. Cursor or Claude Desktop) starts the MCP server as a subprocess and talks to it over those pipes.

**In MCP terms:**

- **STDIO transport:** The MCP server is a local process. The client spawns it (e.g. `node server.js`) and communicates via stdin/stdout using the MCP protocol (often JSON-RPC). No HTTP, no port.
- **SSE transport:** The server runs as a network service (HTTP + Server-Sent Events). The client connects to a URL. Better for remote or multi-user; needs a running server and sometimes a bridge for clients that only support STDIO (e.g. older Claude Desktop).

So when the plan says the MCP server “speaks STDIO,” it means: one process per client, started by the client, with all communication over stdin/stdout—simple and ideal for a local Open Brain server used by Cursor and Claude Desktop on your machine.

---

**User**

build it

---

**Cursor**

Building the Open Brain system per the plan: creating the project structure and implementing the MCP server and database schema.


Checking SDK exports and a simple stdio server example:


Creating the project and implementing the server.


Implementing the server using the Server class and tools capability from the SDK, and checking the SDK repo for the exact API:


Implementing the server: checking the SDK's tool-list implementation and creating the app.


Implementing the server: we'll use the Server class and add tool handlers. Checking the SDK's request schemas:


Implementing the full server and DB layer.


Fixing the DB layer: pgvector may return the vector as an array when types are registered. Checking and fixing.


Checking SDK import paths: the package may not expose the `server/mcp` subpath.


Checking whether the SDK exposes the `server/mcp` subpath and fixing the DB query.


Adding optional dotenv support so we can use a `.env` file when running the server:


Summary of what’s in place:

## Open Brain project: `c:\Users\rix\OneDrive\open-brain\`

### 1. **Database**
- **`schema.sql`** – Run once on your Postgres (Supabase or self‑hosted). Creates:
  - `thoughts` table: `content`, `embedding vector(1536)`, `people`, `topics`, `type`, `action_items`, `source`, `created_at`
  - HNSW index on `embedding` for cosine similarity search

### 2. **MCP server (TypeScript)**
- **`src/index.ts`** – MCP server over **STDIO** with four tools:
  - **`capture_thought`** – Saves a thought, calls OpenAI for embedding, inserts into Postgres
  - **`search_brain`** – Embeds the query and runs vector similarity search
  - **`list_recent`** – Lists recent thoughts (optional: last N days)
  - **`brain_stats`** – Total count and counts for last 7 and 30 days
- **`src/db.ts`** – Postgres + pgvector (insert, search, list, stats)
- **`src/embeddings.ts`** – OpenAI `text-embedding-3-small` (1536 dims)

### 3. **Config and docs**
- **`.env.example`** – `DATABASE_URL` and `OPENAI_API_KEY`
- **`README.md`** – Setup, DB steps, Cursor/Claude MCP config examples, tool list

### 4. **Dependencies**
- `@modelcontextprotocol/sdk`, `openai`, `pg`, `pgvector`, `zod`, `dotenv`

---

**What you need to do**

1. **Postgres + pgvector**  
   Create a DB (e.g. Supabase), then run `schema.sql` in the SQL editor (or via `psql`).

2. **Install and build** (from a terminal where Node/npm are available):
   ```bash
   cd c:\Users\rix\OneDrive\open-brain
   npm install
   npm run build
   ```

3. **Env**  
   Set `DATABASE_URL` and `OPENAI_API_KEY` (e.g. copy `.env.example` to `.env` and fill in, or set them in your MCP config).

4. **Wire up clients**  
   In Cursor and Claude Desktop MCP settings, add the `open-brain` server:  
   `command`: `node`,  
   `args`: `["c:\\Users\\rix\\OneDrive\\open-brain\\dist\\index.js"]`,  
   and the same env vars.

After that, any MCP client (Cursor, Claude, etc.) can use **capture_thought** and **search_brain** against the same Postgres-backed brain. Metadata (people, topics, type, action items) is in the schema but not filled by the server yet; you can add an LLM step in **capture_thought** later to populate it.

---

**User**

run it

---

**Cursor**


`npm` isn’t available in the environment I’m using (Node/npm aren’t on PATH in this shell), so I can’t run the server from here. Use your own terminal where Node and npm work.

**In a terminal where `node` and `npm` work** (Cursor’s integrated terminal, PowerShell, or Command Prompt), run:

```powershell
cd "c:\Users\rix\OneDrive\open-brain"
npm install
npm run build
```

Then either:

**A) Run the server in the foreground** (for a quick test):

```powershell
$env:DATABASE_URL = "postgresql://USER:PASSWORD@HOST:5432/DATABASE"
$env:OPENAI_API_KEY = "sk-your-key"
npm start
```

**B) Or use a `.env` file** in `open-brain` with `DATABASE_URL` and `OPENAI_API_KEY`, then:

```powershell
npm start
```

The server will start and use **stdio** (stdin/stdout). It’s meant to be started by an MCP client (Cursor, Claude Desktop), not to “run and exit.” So:

- **To test that it starts:** run `npm start`; it should sit there waiting for input. Stop it with Ctrl+C.
- **To use it from Cursor:** add the Open Brain MCP server in Cursor settings (as in the README) with `command`: `node`, `args`: `["c:\\Users\\rix\\OneDrive\\open-brain\\dist\\index.js"]`, and the same env vars. Cursor will start the process when it needs the tools.

If you don’t have Node installed, install it from [nodejs.org](https://nodejs.org/) (LTS) and use a new terminal so `npm` is on PATH.

