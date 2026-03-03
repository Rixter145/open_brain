import OpenAI from "openai";

const OPENAI_MODEL = "text-embedding-3-small";
const OPENAI_DIMS = 1536;
const OLLAMA_MODEL = "nomic-embed-text";
const OLLAMA_DIMS = 768;

let openaiClient: OpenAI | null = null;

function useOllama(): boolean {
  if (process.env.EMBEDDING_PROVIDER === "ollama") return true;
  if (!process.env.OPENAI_API_KEY?.trim() && process.env.OLLAMA_HOST?.trim()) return true;
  return false;
}

function getOpenAIClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is required for embeddings");
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: key });
  return openaiClient;
}

async function embedOllama(text: string): Promise<number[]> {
  const base = (process.env.OLLAMA_HOST || "http://localhost:11434").replace(/\/$/, "");
  const res = await fetch(`${base}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: OLLAMA_MODEL, input: text.slice(0, 8192) }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama embeddings failed: ${res.status} ${err}`);
  }
  const data = (await res.json()) as { embeddings?: number[][] };
  const vec = data.embeddings?.[0];
  if (!vec || !Array.isArray(vec) || vec.length !== OLLAMA_DIMS) {
    throw new Error(`Invalid Ollama embedding response (expected ${OLLAMA_DIMS} dimensions)`);
  }
  return vec;
}

async function embedOpenAI(text: string): Promise<number[]> {
  const openai = getOpenAIClient();
  const res = await openai.embeddings.create({
    model: OPENAI_MODEL,
    input: text.slice(0, 8191),
    dimensions: OPENAI_DIMS,
  });
  const vec = res.data[0]?.embedding;
  if (!vec || vec.length !== OPENAI_DIMS) throw new Error("Invalid embedding response");
  return vec;
}

export async function embed(text: string): Promise<number[]> {
  if (useOllama()) return embedOllama(text);
  return embedOpenAI(text);
}

export const EMBEDDING_DIMS = useOllama() ? OLLAMA_DIMS : OPENAI_DIMS;
