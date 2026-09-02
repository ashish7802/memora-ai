import { GoogleGenAI } from '@google/genai';

const EMBEDDING_DIM = 64;

/**
 * Deterministic fallback embedding generator based on word/character n-grams.
 * Produces unit-length vectors suitable for cosine similarity.
 */
function generateDeterministicEmbedding(text: string): number[] {
  const clean = text.toLowerCase().trim();
  const vector = new Array<number>(EMBEDDING_DIM).fill(0);

  // Bag of words and character tri-grams
  const words = clean.split(/[\s,.-_]+/);
  for (const word of words) {
    if (!word) continue;
    let h = 0;
    for (let i = 0; i < word.length; i++) {
      h = (Math.imul(31, h) + word.charCodeAt(i)) | 0;
    }
    const idx = Math.abs(h) % EMBEDDING_DIM;
    vector[idx] += 1.0;
  }

  // Character tri-grams for subword semantic capture
  for (let i = 0; i <= clean.length - 3; i++) {
    const gram = clean.slice(i, i + 3);
    let h = 0;
    for (let j = 0; j < gram.length; j++) {
      h = (Math.imul(37, h) + gram.charCodeAt(j)) | 0;
    }
    const idx = Math.abs(h) % EMBEDDING_DIM;
    vector[idx] += 0.5;
  }

  // L2 Normalize
  let norm = 0;
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      vector[i] = Number((vector[i] / norm).toFixed(6));
    }
  } else {
    vector[0] = 1.0;
  }

  return vector;
}

/**
 * Compute cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0) return 0;
  const len = Math.min(a.length, b.length);
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

/**
 * Compute cosine distance (1 - similarity, bounded >= 0)
 */
export function cosineDistance(a: number[], b: number[]): number {
  const sim = cosineSimilarity(a, b);
  return Math.max(0, 1 - sim);
}

/**
 * Generates an embedding vector for the text.
 * Prefers Gemini embedding if API key is present; otherwise uses deterministic fallback.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const res = await ai.models.embedContent({
        model: 'text-embedding-004',
        contents: text,
      });
      const resAny = res as any;
      if (resAny?.embedding?.values && Array.isArray(resAny.embedding.values)) {
        return resAny.embedding.values;
      }
      if (resAny?.embeddings?.[0]?.values && Array.isArray(resAny.embeddings[0].values)) {
        return resAny.embeddings[0].values;
      }
    } catch {
      // Fallback gracefully to deterministic embedding
    }
  }

  return generateDeterministicEmbedding(text);
}
