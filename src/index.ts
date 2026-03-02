#!/usr/bin/env node
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { embed } from "./embeddings.js";
import {
  insertThought,
  searchThoughts,
  listRecentThoughts,
  getBrainStats,
  formatThoughtForOutput,
} from "./db.js";

const server = new McpServer({
  name: "open-brain",
  version: "1.0.0",
});

// capture_thought: add a thought (content + optional source); embed and store in Postgres
server.registerTool(
  "capture_thought",
  {
    title: "Capture thought",
    description:
      "Save a thought into your Open Brain. The content is embedded and stored so it can be found by semantic search later. Optional: set source (e.g. 'cursor', 'claude', 'slack').",
    inputSchema: z.object({
      content: z.string().describe("The thought or note to save"),
      source: z.string().optional().describe("Where this thought came from (e.g. cursor, claude)"),
    }),
  },
  async ({ content, source }) => {
    try {
      const vector = await embed(content);
      const row = await insertThought({
        content,
        embedding: vector,
        source: source ?? null,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `Captured thought (id: ${row.id}). You can find it later with search_brain or list_recent.`,
          },
        ],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Error: ${msg}` }],
        isError: true,
      };
    }
  }
);

// search_brain: semantic search by meaning
server.registerTool(
  "search_brain",
  {
    title: "Search brain",
    description:
      "Search your Open Brain by meaning. Give a natural language query (e.g. 'career change', 'meeting with Sarah'); returns the most relevant thoughts.",
    inputSchema: z.object({
      query: z.string().describe("What to search for (by meaning)"),
      limit: z.number().min(1).max(50).optional().default(10),
    }),
  },
  async ({ query, limit }) => {
    try {
      const queryVector = await embed(query);
      const thoughts = await searchThoughts(queryVector, limit);
      const text =
        thoughts.length === 0
          ? "No matching thoughts found."
          : thoughts.map(formatThoughtForOutput).join("\n\n---\n\n");
      return {
        content: [{ type: "text" as const, text }],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Error: ${msg}` }],
        isError: true,
      };
    }
  }
);

// list_recent: list recent thoughts (optionally filter by days)
server.registerTool(
  "list_recent",
  {
    title: "List recent thoughts",
    description:
      "List thoughts you captured recently. Optionally limit to the last N days (e.g. 7 for this week).",
    inputSchema: z.object({
      limit: z.number().min(1).max(100).optional().default(20),
      days: z.number().min(1).optional().describe("Only show thoughts from the last N days"),
    }),
  },
  async ({ limit, days }) => {
    try {
      const thoughts = await listRecentThoughts(limit, days);
      const text =
        thoughts.length === 0
          ? "No thoughts in this range."
          : thoughts.map(formatThoughtForOutput).join("\n\n---\n\n");
      return {
        content: [{ type: "text" as const, text }],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Error: ${msg}` }],
        isError: true,
      };
    }
  }
);

// brain_stats: counts and activity
server.registerTool(
  "brain_stats",
  {
    title: "Brain stats",
    description: "See how many thoughts are in your Open Brain and recent activity (last 7 and 30 days).",
    inputSchema: z.object({}),
  },
  async () => {
    try {
      const stats = await getBrainStats();
      const text = `Total thoughts: ${stats.total}\nLast 7 days: ${stats.last_7_days}\nLast 30 days: ${stats.last_30_days}`;
      return {
        content: [{ type: "text" as const, text }],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Error: ${msg}` }],
        isError: true,
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Open Brain MCP server error:", err);
  process.exit(1);
});
