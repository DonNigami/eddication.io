/**
 * JETSETGO - Embedding Generation Edge Function
 * Generates Thai embeddings using Hugging Face FREE API
 *
 * FREE TIER: 1000 requests/month on Hugging Face
 * Model: KoonJamesZ/nina-thai-v3 (768 dimensions)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ==================== CONFIGURATION ====================
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const HF_API_URL = 'https://api-inference.huggingface.co/models/KoonJamesZ/nina-thai-v3';
const HF_API_KEY = Deno.env.get('HUGGINGFACE_API_KEY') || ''; // Optional - free tier works without

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ==================== TYPES ====================
interface EmbedRequest {
  text: string;
  recordId?: string;
  table?: 'parts_catalog' | 'tires_catalog';
  batch?: boolean;
  records?: Array<{ id: string; text: string }>;
}

interface EmbedResponse {
  success: boolean;
  embedding?: number[];
  embeddings?: Array<{ id: string; embedding: number[] }>;
  error?: string;
  dimension?: number;
}

// ==================== THAI TEXT NORMALIZATION ====================
function normalizeThaiText(text: string): string {
  return text
    // Fix double Sara Am
    .replace(/\u0E33\u0E33/g, '\u0E4D')
    // Remove tone marks (optional - can improve matching)
    .replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g, '')
    // Normalize spaces
    .replace(/\s+/g, ' ')
    .trim();
}

// ==================== EMBEDDING GENERATION ====================
async function generateEmbedding(text: string): Promise<number[]> {
  const normalized = normalizeThaiText(text);

  // Prepare combined text for better semantic search
  // Include both original and normalized for context
  const searchInput = normalized.slice(0, 512); // Token limit

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add API key if provided (higher rate limit)
  if (HF_API_KEY) {
    headers['Authorization'] = `Bearer ${HF_API_KEY}`;
  }

  const response = await fetch(HF_API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      inputs: searchInput,
      options: {
        wait_for_model: true,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Hugging Face API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();

  // Handle different response formats
  if (Array.isArray(result) && Array.isArray(result[0])) {
    return result[0]; // First embedding
  }

  if (result.embeddings && Array.isArray(result.embeddings[0])) {
    return result.embeddings[0];
  }

  throw new Error('Unexpected API response format');
}

// ==================== BATCH EMBEDDING ====================
async function generateBatchEmbeddings(
  records: Array<{ id: string; text: string }>
): Promise<Array<{ id: string; embedding: number[] }>> {
  const results: Array<{ id: string; embedding: number[] }> = [];

  // Process in small batches to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    const batchResults = await Promise.allSettled(
      batch.map(async (record) => {
        const embedding = await generateEmbedding(record.text);
        return { id: record.id, embedding };
      })
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      }
    }

    // Rate limiting delay for free tier
    if (i + batchSize < records.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}

// ==================== UPDATE RECORD WITH EMBEDDING ====================
async function updateRecordEmbedding(
  table: string,
  recordId: string,
  embedding: number[]
): Promise<void> {
  const { error } = await supabase
    .from(table)
    .update({ embedding: `[${embedding.join(',')}]` })
    .eq('id', recordId);

  if (error) {
    throw new Error(`Failed to update ${table}: ${error.message}`);
  }
}

// ==================== SEARCH TEXT GENERATION ====================
function generateSearchText(
  record: Record<string, any>,
  table: string
): string {
  if (table === 'parts_catalog') {
    const parts = [
      record.part_number,
      record.oem_number,
      record.part_name_th,
      record.part_name_en,
      record.brand,
      record.category,
      record.subcategory,
      record.description,
      ...(record.vehicle_make || []),
      ...(record.vehicle_model || []),
    ];
    return parts.filter(Boolean).join(' ');
  }

  if (table === 'tires_catalog') {
    const parts = [
      record.part_number,
      record.brand,
      record.model,
      record.size,
      record.tire_type,
      record.vehicle_type,
      ...(record.vehicle_make || []),
      ...(record.vehicle_model || []),
    ];
    return parts.filter(Boolean).join(' ');
  }

  return '';
}

// ==================== HTTP HANDLER ====================
serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { text, recordId, table = 'parts_catalog', batch, records }: EmbedRequest =
      await req.json();

    // Single embedding generation
    if (!batch && text) {
      const embedding = await generateEmbedding(text);

      // Update record if recordId provided
      if (recordId) {
        await updateRecordEmbedding(table, recordId, embedding);
      }

      const response: EmbedResponse = {
        success: true,
        embedding,
        dimension: embedding.length,
      };

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Batch embedding generation for existing records
    if (batch) {
      // If records not provided, fetch from database
      let recordsToProcess = records;

      if (!recordsToProcess) {
        const targetTable = table || 'parts_catalog';
        const { data, error } = await supabase
          .from(targetTable)
          .select('id, part_number, part_name_th, part_name_en, brand, category, model, size')
          .is('embedding', null)
          .limit(100);

        if (error) throw error;

        recordsToProcess = (data || []).map((record) => ({
          id: record.id,
          text: generateSearchText(record, targetTable),
        }));
      }

      // Generate embeddings
      const embeddings = await generateBatchEmbeddings(recordsToProcess);

      // Update all records
      for (const { id, embedding } of embeddings) {
        await updateRecordEmbedding(table, id, embedding);
      }

      const response: EmbedResponse = {
        success: true,
        embeddings,
        dimension: 768,
      };

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Health check
    if (req.method === 'GET') {
      const response: EmbedResponse = {
        success: true,
        dimension: 768,
      };

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid request');

  } catch (error) {
    console.error('Embedding error:', error);

    const response: EmbedResponse = {
      success: false,
      error: error.message || 'Unknown error',
    };

    return new Response(JSON.stringify(response), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
