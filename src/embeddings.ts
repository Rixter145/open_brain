import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

const OPENAI_MODEL = "text-embedding-3-small";
const OPENAI_DIMS = 1536;
const OLLAMA_MODEL = "nomic-embed-text";
const OLLAMA_DIMS = 768;
const GOOGLE_MODEL = "gemini-embedding-001";
const GOOGLE_DIMS = 768;

let openaiClient: OpenAI | null = null;
let googleClient: GoogleGenAI | null = null;

function useGoogle(): boolean {
  const p = process.env.EMBEDDING_PROVIDER;
  return p === "google" || p === "gemini";
}

function useOllama(): boolean {
  if (process.env.EMBEDDING_PROVIDER === "ollama") return true;
  if (!useGoogle() && !process.env.OPENAI_API_KEY?.trim() && process.env.OLLAMA_HOST?.trim()) return true;
  return false;
}

function getOpenAIClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is required for embeddings");
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: key });
  return openaiClient;
}

function getGoogleClient(): GoogleGenAI {
  const key = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!key?.trim()) throw new Error("GOOGLE_API_KEY or GEMINI_API_KEY is required when EMBEDDING_PROVIDER=google");
  if (!googleClient) googleClient = new GoogleGenAI({ apiKey: key });
  return googleClient;
}

async function embedGoogle(text: string): Promise<number[]> {
  const ai = getGoogleClient();
  const response = await ai.models.embedContent({
    model: GOOGLE_MODEL,
    contents: text.slice(0, 8192),
    config: { outputDimensionality: GOOGLE_DIMS },
  });
  const vec = response.embeddings?.[0]?.values;
  if (!vec || !Array.isArray(vec) || vec.length !== GOOGLE_DIMS) {
    throw new Error(`Invalid Google embedding response (expected ${GOOGLE_DIMS} dimensions)`);
  }
  return vec;
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
  if (useGoogle()) return embedGoogle(text);
  if (useOllama()) return embedOllama(text);
  return embedOpenAI(text);
}

function getEmbeddingDims(): number {
  if (useGoogle()) return GOOGLE_DIMS;
  if (useOllama()) return OLLAMA_DIMS;
  return OPENAI_DIMS;
}

export const EMBEDDING_DIMS = getEmbeddingDims();
