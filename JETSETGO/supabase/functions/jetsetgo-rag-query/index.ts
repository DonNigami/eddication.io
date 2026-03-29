/**
 * JETSETGO - RAG Query Orchestrator Edge Function
 * Semantic search + LLM response using Groq FREE API
 *
 * Architecture:
 * 1. Receive user query (Thai/English)
 * 2. Generate embedding for query
 * 3. Vector search in pgvector
 * 4. Context building from results
 * 5. LLM response via Groq (FREE)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ==================== CONFIGURATION ====================
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')!;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const HF_API_URL = 'https://api-inference.huggingface.co/models/KoonJamesZ/nina-thai-v3';
const HF_API_KEY = Deno.env.get('HUGGINGFACE_API_KEY') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== TYPES ====================
interface RAGQueryRequest {
  query: string;
  catalogType?: 'parts' | 'tires' | 'all';
  maxResults?: number;
  threshold?: number;
  hybridMode?: boolean; // Combine semantic + keyword search
  userId?: string;
  sessionId?: string;
}

interface RAGQueryResponse {
  success: boolean;
  results?: SearchResult[];
  response?: string;
  sources?: string[];
  responseTime?: number;
  error?: string;
}

interface SearchResult {
  id: string;
  partNumber?: string;
  brand?: string;
  nameTh?: string;
  nameEn?: string;
  description?: string;
  price?: number;
  stock?: number;
  similarity: number;
}

// ==================== THAI SYSTEM PROMPT ====================
const THAI_SYSTEM_PROMPT = `คุณคือผู้ช่วย AI สำหรับระบบค้นหาอะไหล่รถยนต์และยางรถยนต์ของ JETSETGO

หน้าที่ของคุณ:
1. ตอบคำถามเกี่ยวกับอะไหล่รถยนต์และยางรถยนต์
2. แนะนำอะไหล่ที่เหมาะสมกับรถของลูกค้า
3. บอกข้อมูลคลังสินค้าและราคา
4. อธิบายข้อดีและข้อเสียของอะไหล่
5. เช็คความเข้ากันได้กับรถยนต์ (Vehicle Compatibility)

กฎการตอบ:
- ตอบเป็นภาษาไทยที่เป็นมิตรและเข้าใจง่าย
- อ้างอิง part number ทุกครั้งที่แนะนำอะไหล่
- แจ้งสถานะคลังสินค้า (มีสินค้า/หมด/สั่งพิเศษ)
- ถ้าไม่พบอะไหล่ที่ตรงกัน แนะนำทางเลือกอื่นที่ใกล้เคียง
- อย่าแก้ข้อมูลสเปกที่ได้จากฐานข้อมูล
- ให้ราคาเป็นบาทไทย (THB)
- ถ้าลูกค้าถามเรื่องที่ไม่เกี่ยวกับอะไหล่ ให้แนะนำให้ถามใหม่ในหัวข้อที่เกี่ยวข้อง

รูปแบบการตอบ:
🔍 ผลการค้นหา: [สรุปสิ่งที่ค้นหา]

📦 อะไหล่ที่แนะนำ:
• [Part Number] - [ชื่ออะไหล่]
  ยี่ห้อ: [Brand]
  ราคา: [ราคา] THB
  สถานะ: [มีสินค้า/หมด]
  รายละเอียด: [คำอธิบาย]

💡 คำแนะนำเพิ่มเติม: [ข้อมูลเพิ่มเติมถ้ามี]

❓ ต้องการข้อมูลเพิ่มเติมไหม?`;

const ENGLISH_SYSTEM_PROMPT = `You are an AI assistant for JETSETGO automotive parts and tire catalog system.

Your responsibilities:
1. Answer questions about car parts and tires
2. Recommend suitable parts for customer's vehicle
3. Provide inventory and pricing information
4. Explain pros and cons of parts
5. Check vehicle compatibility

Answer rules:
- Answer in friendly and easy to understand English
- Always reference part number when recommending parts
- Inform inventory status (in stock/out of stock/special order)
- If exact part not found, suggest closest alternatives
- Do not modify spec data from database
- Show prices in THB (Thai Baht)
- If customer asks unrelated questions, politely redirect to parts-related topics

Response format:
🔍 Search Results: [summary]

📦 Recommended Parts:
• [Part Number] - [Part Name]
  Brand: [Brand]
  Price: [price] THB
  Status: [in stock/out of stock]
  Details: [description]

💡 Additional Tips: [extra info if available]

❓ Need more information?`;

// ==================== THAI TEXT NORMALIZATION ====================
function normalizeThaiText(text: string): string {
  return text
    .replace(/\u0E33\u0E33/g, '\u0E4D')
    .replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 512);
}

// ==================== GENERATE QUERY EMBEDDING ====================
async function generateQueryEmbedding(query: string): Promise<number[]> {
  const normalized = normalizeThaiText(query);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (HF_API_KEY) {
    headers['Authorization'] = `Bearer ${HF_API_KEY}`;
  }

  const response = await fetch(HF_API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      inputs: normalized,
      options: { wait_for_model: true },
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding API error: ${response.status}`);
  }

  const result = await response.json();

  if (Array.isArray(result) && Array.isArray(result[0])) {
    return result[0];
  }

  if (result.embeddings && Array.isArray(result.embeddings[0])) {
    return result.embeddings[0];
  }

  throw new Error('Unexpected embedding response');
}

// ==================== VECTOR SEARCH ====================
async function vectorSearch(
  embedding: number[],
  catalogType: string = 'parts',
  maxResults: number = 10,
  threshold: number = 0.7
): Promise<SearchResult[]> {
  const table = catalogType === 'tires' ? 'tires_catalog' : 'parts_catalog';
  const embeddingStr = `[${embedding.join(',')}]`;

  // Use cosine similarity search with pgvector
  const { data, error } = await supabase.rpc('jetsetgo_semantic_search', {
    query_embedding: embeddingStr,
    match_threshold: threshold,
    result_count: maxResults,
    catalog_table: table,
  });

  if (error) {
    // Fallback to direct query if RPC not available
    const { data: fallbackData, error: fallbackError } = await supabase
      .from(table)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(maxResults);

    if (fallbackError) {
      throw new Error(`Search failed: ${fallbackError.message}`);
    }

    return (fallbackData || []).map((row) => ({
      id: row.id,
      partNumber: row.part_number,
      brand: row.brand,
      nameTh: row.part_name_th,
      nameEn: row.part_name_en,
      description: row.description,
      price: row.price,
      stock: row.stock_quantity,
      similarity: 0.8, // Default similarity for fallback
    }));
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    partNumber: row.part_number,
    brand: row.brand,
    nameTh: row.part_name_th,
    nameEn: row.part_name_en,
    description: row.description,
    price: row.price,
    stock: row.stock_quantity,
    similarity: row.similarity || row.cosine_similarity || 0,
  }));
}

// ==================== KEYWORD SEARCH (HYBRID) ====================
async function keywordSearch(
  query: string,
  catalogType: string = 'parts',
  maxResults: number = 10
): Promise<SearchResult[]> {
  const table = catalogType === 'tires' ? 'tires_catalog' : 'parts_catalog';

  const { data, error } = await supabase
    .from(table)
    .select('*')
    .or(`part_number.ilike.%${query}%,part_name_th.ilike.%${query}%,part_name_en.ilike.%${query}%,brand.ilike.%${query}%`)
    .limit(maxResults);

  if (error) {
    throw new Error(`Keyword search failed: ${error.message}`);
  }

  return (data || []).map((row) => ({
    id: row.id,
    partNumber: row.part_number,
    brand: row.brand,
    nameTh: row.part_name_th,
    nameEn: row.part_name_en,
    description: row.description,
    price: row.price,
    stock: row.stock_quantity,
    similarity: 0.5, // Lower similarity for keyword matches
  }));
}

// ==================== LLM RESPONSE GENERATION ====================
async function generateLLMResponse(
  query: string,
  results: SearchResult[],
  language: 'th' | 'en' = 'th'
): Promise<string> {
  if (!GROQ_API_KEY) {
    // Fallback to template-based response
    return generateTemplateResponse(results, language);
  }

  const systemPrompt = language === 'th' ? THAI_SYSTEM_PROMPT : ENGLISH_SYSTEM_PROMPT;

  // Build context from results
  const context = results.map((r, i) => {
    const lines = [
      `${i + 1}. Part Number: ${r.partNumber || 'N/A'}`,
      `   Name: ${r.nameTh || r.nameEn || 'N/A'}`,
      `   Brand: ${r.brand || 'N/A'}`,
    ];

    if (r.price) lines.push(`   Price: ${r.price} THB`);
    if (r.stock !== undefined) lines.push(`   Stock: ${r.stock} units`);
    if (r.description) lines.push(`   Description: ${r.description}`);

    return lines.join('\n');
  }).join('\n\n');

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: language === 'th'
            ? `คำถาม: ${query}\n\nข้อมูลอะไหล่ที่ค้นพบ:\n${context}`
            : `Question: ${query}\n\nParts found:\n${context}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    console.error('Groq API error:', await response.text());
    return generateTemplateResponse(results, language);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || generateTemplateResponse(results, language);
}

// ==================== TEMPLATE-BASED RESPONSE (Fallback) ====================
function generateTemplateResponse(results: SearchResult[], language: 'th' | 'en'): string {
  if (results.length === 0) {
    return language === 'th'
      ? '😕 ขออภัย ไม่พบอะไหล่ที่ค้นหา ลองใช้คำค้นหาอื่น หรือติดต่อเราสอบถามได้ครับ'
      : '😕 Sorry, no parts found. Try a different search term or contact us.';
  }

  const summary = language === 'th'
    ? `พบ ${results.length} รายการที่ตรงกับการค้นหา`
    : `Found ${results.length} items matching your search`;

  const partsList = results.slice(0, 5).map((r) => {
    const inStock = r.stock && r.stock > 0;
    const statusText = language === 'th'
      ? (inStock ? '✅ มีสินค้า' : '❌ หมด')
      : (inStock ? '✅ In Stock' : '❌ Out of Stock');

    return `• ${r.partNumber || 'N/A'} - ${r.nameTh || r.nameEn || 'N/A'}
  ${language === 'th' ? 'ยี่ห้อ' : 'Brand'}: ${r.brand || 'N/A'}
  ${r.price ? `${language === 'th' ? 'ราคา' : 'Price'}: ${r.price} THB` : ''}
  ${statusText}`;
  }).join('\n\n');

  const footer = language === 'th'
    ? '\n\n❓ ต้องการข้อมูลเพิ่มเติมไหม?'
    : '\n\n❓ Need more information?';

  return `🔍 ${summary}\n\n📦 ${language === 'th' ? 'อะไหล่ที่แนะนำ' : 'Recommended Parts'}:\n\n${partsList}${footer}`;
}

// ==================== DETECT LANGUAGE ====================
function detectLanguage(text: string): 'th' | 'en' {
  const thaiChars = text.match(/[\u0E00-\u0E7F]/g);
  return (thaiChars && thaiChars.length > 3) ? 'th' : 'en';
}

// ==================== LOG SEARCH ====================
async function logSearch(
  query: string,
  resultsCount: number,
  userId?: string,
  sessionId?: string
): Promise<void> {
  try {
    await supabase.from('search_logs').insert({
      query,
      results_count: resultsCount,
      user_id: userId,
      session_id: sessionId,
      language: detectLanguage(query),
    });
  } catch (error) {
    console.error('Failed to log search:', error);
  }
}

// ==================== HTTP HANDLER ====================
serve(async (req) => {
  const startTime = Date.now();

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
    const {
      query,
      catalogType = 'parts',
      maxResults = 10,
      threshold = 0.7,
      hybridMode = false,
      userId,
      sessionId,
    }: RAGQueryRequest = await req.json();

    if (!query || query.trim().length === 0) {
      throw new Error('Query is required');
    }

    // Detect language
    const language = detectLanguage(query);

    // Generate embedding for semantic search
    const embedding = await generateQueryEmbedding(query);

    // Perform vector search
    let results = await vectorSearch(embedding, catalogType, maxResults, threshold);

    // Hybrid mode: combine with keyword search
    if (hybridMode && results.length < maxResults) {
      const keywordResults = await keywordSearch(query, catalogType, maxResults);

      // Merge results, removing duplicates
      const existingIds = new Set(results.map((r) => r.id));
      for (const kr of keywordResults) {
        if (!existingIds.has(kr.id) && results.length < maxResults) {
          results.push(kr);
          existingIds.add(kr.id);
        }
      }
    }

    // Sort by similarity
    results.sort((a, b) => b.similarity - a.similarity);

    // Generate LLM response
    const llmResponse = await generateLLMResponse(query, results, language);

    // Extract part numbers for sources
    const sources = results.map((r) => r.partNumber || r.id).slice(0, 5);

    // Log the search
    await logSearch(query, results.length, userId, sessionId);

    const responseTime = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        results: results.map((r) => ({
          ...r,
          similarity: Math.round(r.similarity * 1000) / 1000, // Round to 3 decimals
        })),
        response: llmResponse,
        sources,
        responseTime,
      } as RAGQueryResponse),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('RAG query error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error',
      } as RAGQueryResponse),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
