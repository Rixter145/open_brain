import OpenAI from "openai";

const MODEL = "text-embedding-3-small";
const DIMS = 1536;

let client: OpenAI | null = null;

function getClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is required for embeddings");
  if (!client) client = new OpenAI({ apiKey: key });
  return client;
}

export async function embed(text: string): Promise<number[]> {
  const openai = getClient();
  const res = await openai.embeddings.create({
    model: MODEL,
    input: text.slice(0, 8191), // model limit
    dimensions: DIMS,
  });
  const vec = res.data[0]?.embedding;
  if (!vec || vec.length !== DIMS) throw new Error("Invalid embedding response");
  return vec;
}

export { DIMS as EMBEDDING_DIMS };
