import pg from "pg";
import pgvector from "pgvector/pg";
import type { Pool } from "pg";

export interface ThoughtRow {
  id: string;
  content: string;
  embedding: number[];
  people: string[];
  topics: string[];
  type: string | null;
  action_items: string[];
  source: string | null;
  created_at: Date;
}

let pool: Pool | null = null;

function getPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  if (!pool) {
    pool = new pg.Pool({ connectionString: url, max: 5 });
    pgvector.registerTypes(pool as unknown as pg.Client);
  }
  return pool;
}

export async function insertThought(params: {
  content: string;
  embedding: number[];
  people?: string[];
  topics?: string[];
  type?: string | null;
  action_items?: string[];
  source?: string | null;
}): Promise<ThoughtRow> {
  const client = await getPool().connect();
  try {
    const embeddingSql = pgvector.toSql(params.embedding);
    const res = await client.query<ThoughtRow>(
      `INSERT INTO thoughts (content, embedding, people, topics, type, action_items, source)
       VALUES ($1, $2::vector, $3::text[], $4::text[], $5, $6::text[], $7)
       RETURNING id, content, embedding::text, people, topics, type, action_items, source, created_at`,
      [
        params.content,
        embeddingSql,
        params.people ?? [],
        params.topics ?? [],
        params.type ?? null,
        params.action_items ?? [],
        params.source ?? null,
      ]
    );
    const row = res.rows[0];
    if (!row) throw new Error("Insert failed");
    return parseThoughtRow(row as unknown as Record<string, unknown>);
  } finally {
    client.release();
  }
}

function parseThoughtRow(row: Record<string, unknown>): ThoughtRow {
  let vec: number[] = [];
  const e = row.embedding;
  if (Array.isArray(e)) vec = e as number[];
  else if (typeof e === "string") vec = e.startsWith("[") ? JSON.parse(e) : parsePgVector(e);
  return {
    id: row.id as string,
    content: row.content as string,
    embedding: vec,
    people: (row.people as string[]) ?? [],
    topics: (row.topics as string[]) ?? [],
    type: (row.type as string | null) ?? null,
    action_items: (row.action_items as string[]) ?? [],
    source: (row.source as string | null) ?? null,
    created_at: new Date(row.created_at as string),
  };
}

function parsePgVector(s: string): number[] {
  if (typeof s !== "string") return [];
  const trimmed = s.replace(/^\[|\]$/g, "").trim();
  if (!trimmed) return [];
  return trimmed.split(",").map((n) => parseFloat(n.trim()));
}

export async function searchThoughts(
  queryEmbedding: number[],
  limit: number = 10
): Promise<ThoughtRow[]> {
  const client = await getPool().connect();
  try {
    const embeddingSql = pgvector.toSql(queryEmbedding);
    const res = await client.query<Record<string, unknown>>(
      `SELECT id, content, embedding::text, people, topics, type, action_items, source, created_at
       FROM thoughts
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      [embeddingSql, limit]
    );
    return res.rows.map(parseThoughtRow);
  } finally {
    client.release();
  }
}

export async function listRecentThoughts(
  limit: number = 20,
  days?: number
): Promise<ThoughtRow[]> {
  const client = await getPool().connect();
  try {
    if (days != null) {
      const res = await client.query<Record<string, unknown>>(
        `SELECT id, content, embedding::text, people, topics, type, action_items, source, created_at
         FROM thoughts
         WHERE created_at >= now() - ($2::text || ' days')::interval
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit, days]
      );
      return res.rows.map(parseThoughtRow);
    }
    const res = await client.query<Record<string, unknown>>(
      `SELECT id, content, embedding::text, people, topics, type, action_items, source, created_at
       FROM thoughts
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    return res.rows.map(parseThoughtRow);
  } finally {
    client.release();
  }
}

export async function getBrainStats(): Promise<{
  total: number;
  last_7_days: number;
  last_30_days: number;
}> {
  const client = await getPool().connect();
  try {
    const res = await client.query<{ total: string; last_7: string; last_30: string }>(
      `SELECT
         count(*)::text AS total,
         count(*) FILTER (WHERE created_at >= now() - interval '7 days')::text AS last_7,
         count(*) FILTER (WHERE created_at >= now() - interval '30 days')::text AS last_30
       FROM thoughts`
    );
    const row = res.rows[0];
    return {
      total: parseInt(row?.total ?? "0", 10),
      last_7_days: parseInt(row?.last_7 ?? "0", 10),
      last_30_days: parseInt(row?.last_30 ?? "0", 10),
    };
  } finally {
    client.release();
  }
}

export function formatThoughtForOutput(t: ThoughtRow): string {
  const meta: string[] = [];
  if (t.people?.length) meta.push(`People: ${t.people.join(", ")}`);
  if (t.topics?.length) meta.push(`Topics: ${t.topics.join(", ")}`);
  if (t.type) meta.push(`Type: ${t.type}`);
  if (t.action_items?.length) meta.push(`Action items: ${t.action_items.join("; ")}`);
  const metaLine = meta.length ? `[${meta.join(" | ")}]\n` : "";
  return `${metaLine}${t.content}\n— ${t.created_at.toISOString().slice(0, 10)}${t.source ? ` (${t.source})` : ""}`;
}
