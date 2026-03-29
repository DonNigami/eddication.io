/**
 * JETSETGO - Thai Text Embedding Generation
 * FREE options: Hugging Face API or Transformers.js (client-side)
 */

import { normalizeThaiText, truncateToMaxTokens } from './thai-normalizer.ts';

// Embedding configuration
export const EMBEDDING_DIMENSION = 768; // nina-thai-v3 dimension
export const MAX_TOKENS = 512;

// Embedding mode
export type EmbeddingMode = 'huggingface' | 'transformersjs';

/**
 * Generate embedding using Hugging Face FREE API
 * 1000 requests/month free tier
 */
export async function generateEmbeddingHF(
  text: string,
  apiKey?: string
): Promise<number[]> {
  const HF_API_URL = 'https://api-inference.huggingface.co/models/KoonJamesZ/nina-thai-v3';

  // Prepare text
  const normalized = normalizeThaiText(text);
  const truncated = truncateToMaxTokens(normalized, MAX_TOKENS);

  try {
    const response = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { 'Authorization': `Bearer ${apiKey}` })
      },
      body: JSON.stringify({
        inputs: truncated,
        options: {
          wait_for_model: true
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }

    const result = await response.json();

    // Handle different response formats
    if (Array.isArray(result) && Array.isArray(result[0])) {
      return result[0]; // [[0.1, 0.2, ...]]
    } else if (result.embeddings && Array.isArray(result.embeddings[0])) {
      return result.embeddings[0];
    } else {
      throw new Error('Unexpected response format');
    }

  } catch (error) {
    console.error('Hugging Face embedding error:', error);
    throw error;
  }
}

/**
 * Generate embedding using Transformers.js (client-side, completely FREE)
 * Runs in browser - no API calls needed
 */
export async function generateEmbeddingClient(text: string): Promise<number[]> {
  // Prepare text
  const normalized = normalizeThaiText(text);
  const truncated = truncateToMaxTokens(normalized, MAX_TOKENS);

  try {
    // Dynamic import of Transformers.js
    const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2');

    // Configure Transformers.js
    env.allowLocalModels = false;

    // Load feature extraction pipeline
    const extractor = await pipeline(
      'feature-extraction',
      'Xenova/nina-thai-v3' // Quantized version for browser
    );

    // Generate embedding
    const output = await extractor(truncated, {
      pooling: 'mean',
      normalize: true
    });

    // Convert tensor to array
    const embedding = Array.from(output.data);

    return embedding;

  } catch (error) {
    console.error('Transformers.js embedding error:', error);
    throw error;
  }
}

/**
 * Generate embedding using the preferred mode
 */
export async function generateEmbedding(
  text: string,
  mode: EmbeddingMode = 'transformersjs',
  apiKey?: string
): Promise<number[]> {
  switch (mode) {
    case 'huggingface':
      return generateEmbeddingHF(text, apiKey);
    case 'transformersjs':
    default:
      return generateEmbeddingClient(text);
  }
}

/**
 * Generate embeddings for a batch of texts
 * Processes in parallel for speed
 */
export async function generateBatchEmbeddings(
  texts: string[],
  mode: EmbeddingMode = 'transformersjs',
  apiKey?: string,
  batchSize: number = 5
): Promise<number[][]> {
  const results: number[][] = [];

  // Process in batches to avoid overwhelming the client/API
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(text => generateEmbedding(text, mode, apiKey))
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Find most similar embeddings from a list
 */
export interface SimilarityResult {
  index: number;
  similarity: number;
}

export function findMostSimilar(
  query: number[],
  candidates: number[][],
  topK: number = 10,
  threshold: number = 0.7
): SimilarityResult[] {
  const results: SimilarityResult[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const similarity = cosineSimilarity(query, candidates[i]);

    if (similarity >= threshold) {
      results.push({ index: i, similarity });
    }
  }

  // Sort by similarity descending
  results.sort((a, b) => b.similarity - a.similarity);

  // Return top K
  return results.slice(0, topK);
}

/**
 * Validate embedding dimension
 */
export function validateEmbedding(embedding: number[]): boolean {
  return (
    Array.isArray(embedding) &&
    embedding.length === EMBEDDING_DIMENSION &&
    embedding.every(v => typeof v === 'number' && !isNaN(v))
  );
}

/**
 * Normalize embedding vector (L2 normalization)
 */
export function normalizeEmbedding(embedding: number[]): number[] {
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));

  if (norm === 0) {
    return embedding;
  }

  return embedding.map(val => val / norm);
}

/**
 * Convert embedding to pgvector format for Supabase
 */
export function toPgVector(embedding: number[]): string {
  if (!validateEmbedding(embedding)) {
    throw new Error('Invalid embedding');
  }

  return `[${embedding.join(',')}]`;
}

/**
 * Parse pgvector string to array
 */
export function fromPgVector(vectorString: string): number[] {
  // Remove brackets and split by comma
  const cleaned = vectorString.replace(/[\[\]]/g, '');
  return cleaned.split(',').map(v => parseFloat(v.trim()));
}

/**
 * Create a simple fallback embedding (for when services are unavailable)
 * Uses character frequency as a very basic embedding
 */
export function createFallbackEmbedding(text: string): number[] {
  const normalized = normalizeThaiText(text);
  const embedding = new Array(EMBEDDING_DIMENSION).fill(0);

  // Simple character frequency hashing
  for (let i = 0; i < normalized.length; i++) {
    const charCode = normalized.charCodeAt(i);
    const index = charCode % EMBEDDING_DIMENSION;
    embedding[index] += 1;
  }

  // Normalize
  return normalizeEmbedding(embedding);
}

/**
 * Hybrid search: Combine semantic and keyword scores
 */
export function hybridScore(
  semanticSimilarity: number,
  keywordScore: number,
  semanticWeight: number = 0.7,
  keywordWeight: number = 0.3
): number {
  return (semanticSimilarity * semanticWeight) + (keywordScore * keywordWeight);
}

/**
 * Rerank results using cross-encoder (optional enhancement)
 * For now, just returns the same results sorted by similarity
 */
export function rerankResults(
  query: string,
  results: SimilarityResult[],
  embeddings: number[][]
): SimilarityResult[] {
  // For now, just return as-is
  // Could add cross-encoder reranking here for better results
  return results;
}
