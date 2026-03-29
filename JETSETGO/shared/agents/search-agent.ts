/**
 * JETSETGO - Search Agent
 * Handles parts and tire catalog searches with semantic and keyword search
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type {
  AgentCapability,
  AgentContext,
  AgentResponse,
  SearchResult
} from './agent-types.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const HF_API_KEY = Deno.env.get('HUGGINGFACE_API_KEY') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== SEARCH AGENT ====================

export class SearchAgent {
  /**
   * Check if this agent can handle the query
   */
  async canHandle(query: string, context: AgentContext): Promise<number> {
    const lowerQuery = query.toLowerCase();

    // High confidence for explicit search keywords
    const searchKeywords = [
      'หา', 'ค้น', 'search', 'find', 'look for', 'มีไหม', 'have',
      'ต้องการ', 'want', 'need', 'อยากได้', 'part number', 'p/n'
    ];

    for (const keyword of searchKeywords) {
      if (lowerQuery.includes(keyword)) {
        return 0.9;
      }
    }

    // Medium confidence for part-like queries
    if (context.vehicleContext || this.hasPartKeywords(query)) {
      return 0.7;
    }

    // Low confidence - can be a fallback
    return 0.3;
  }

  /**
   * Execute search
   */
  async execute(query: string, context: AgentContext): Promise<AgentResponse> {
    try {
      const language = context.preferences?.language || this.detectLanguage(query);

      // Normalize query
      const normalizedQuery = this.normalizeQuery(query);

      // Determine catalog type
      const catalogType = this.determineCatalogType(query);

      // Generate embedding for semantic search
      const embedding = await this.generateEmbedding(normalizedQuery);

      // Perform hybrid search (semantic + keyword)
      const results = await this.hybridSearch(
        normalizedQuery,
        embedding,
        catalogType,
        context
      );

      // Format response
      const message = this.formatSearchResults(results, language, query);

      // Generate follow-up suggestions
      const followUpSuggestions = this.generateFollowUpSuggestions(
        query,
        results,
        language
      );

      return {
        success: true,
        message,
        data: { results, catalogType },
        followUpSuggestions,
        agentName: 'Search',
        confidence: results.length > 0 ? 0.85 : 0.4
      };

    } catch (error) {
      console.error('[SearchAgent] Error:', error);

      return {
        success: false,
        message: this.getErrorMessage(context),
        agentName: 'Search',
        confidence: 0,
        needsHumanIntervention: false
      };
    }
  }

  /**
   * Check if query has part-related keywords
   */
  private hasPartKeywords(query: string): boolean {
    const partKeywords = [
      'ยาง', 'tire', 'น้ำมัน', 'oil', 'ปะกลงงพร้อม', 'brake', 'กรองอากาศ', 'filter',
      'หัวเทียน', 'spark plug', 'สายพาน', 'belt', 'ดิสก์เบรก', 'brake disc',
      'แบตเตอรี่', 'battery', 'คลัตช์', 'clutch', 'ช่วงล่าง', 'suspension'
    ];

    const lowerQuery = query.toLowerCase();
    return partKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  /**
   * Detect language from query
   */
  private detectLanguage(query: string): 'th' | 'en' {
    return /[\u0E00-\u0E7F]/.test(query) ? 'th' : 'en';
  }

  /**
   * Normalize query for search
   */
  private normalizeQuery(query: string): string {
    return query
      .replace(/\u0E33\u0E33/g, '\u0E4D') // Fix double Sara Am
      .replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g, '') // Remove tone marks (optional)
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 512);
  }

  /**
   * Determine catalog type from query
   */
  private determineCatalogType(query: string): 'parts' | 'tires' | 'all' {
    const lowerQuery = query.toLowerCase();
    const tireKeywords = [
      'ยาง', 'tire', 'tyre', 'รถยนต์', 'ล้อ', 'wheel', 'ขอบ',
      '205', '195', '185', '215', // Tire width indicators
      '/55', '/65', '/60', '/50' // Aspect ratio patterns
    ];

    const hasTireKeyword = tireKeywords.some(k => lowerQuery.includes(k));

    return hasTireKeyword ? 'tires' : 'all';
  }

  /**
   * Generate embedding for query
   */
  private async generateEmbedding(query: string): Promise<number[]> {
    const HF_API_URL = 'https://api-inference.huggingface.co/models/KoonJamesZ/nina-thai-v3';

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
        inputs: query,
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

    // Fallback: return zero vector
    console.warn('[SearchAgent] Unexpected embedding response, using fallback');
    return new Array(768).fill(0);
  }

  /**
   * Perform hybrid search (semantic + keyword)
   */
  private async hybridSearch(
    query: string,
    embedding: number[],
    catalogType: 'parts' | 'tires' | 'all',
    context: AgentContext
  ): Promise<SearchResult[]> {
    const allResults: SearchResult[] = [];
    const maxResults = 10;

    // Semantic search for parts
    if (catalogType === 'parts' || catalogType === 'all') {
      try {
        const partsResults = await this.semanticSearch('parts_catalog', embedding, maxResults);
        allResults.push(...partsResults);
      } catch (error) {
        console.error('[SearchAgent] Parts search error:', error);
      }
    }

    // Semantic search for tires
    if (catalogType === 'tires' || catalogType === 'all') {
      try {
        const tiresResults = await this.semanticSearch('tires_catalog', embedding, maxResults);
        allResults.push(...tiresResults);
      } catch (error) {
        console.error('[SearchAgent] Tires search error:', error);
      }
    }

    // If semantic search returns few results, add keyword search
    if (allResults.length < 3) {
      const keywordResults = await this.keywordSearch(query, catalogType, maxResults);
      for (const kr of keywordResults) {
        if (!allResults.find(r => r.id === kr.id)) {
          allResults.push(kr);
        }
      }
    }

    // Apply vehicle context filter
    let filteredResults = allResults;
    if (context.vehicleContext?.make || context.vehicleContext?.model) {
      filteredResults = this.filterByVehicle(allResults, context.vehicleContext);
    }

    // Sort by similarity and limit
    return filteredResults
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10);
  }

  /**
   * Semantic search using pgvector
   */
  private async semanticSearch(
    table: string,
    embedding: number[],
    maxResults: number
  ): Promise<SearchResult[]> {
    const embeddingStr = `[${embedding.join(',')}]`;

    // Try RPC function first
    const { data, error } = await supabase.rpc('jetsetgo_semantic_search', {
      query_embedding: embeddingStr,
      match_threshold: 0.65,
      result_count: maxResults,
      catalog_table: table,
    });

    if (!error && data) {
      return (data || []).map((row: any) => ({
        id: row.id,
        partNumber: row.part_number,
        brand: row.brand,
        nameTh: row.part_name_th || row.name_th,
        nameEn: row.part_name_en || row.name_en,
        description: row.description,
        price: row.price,
        stock: row.stock_quantity || row.stock,
        similarity: row.similarity || row.cosine_similarity || 0.7,
        category: row.category,
        subcategory: row.subcategory,
      }));
    }

    // Fallback: direct similarity search
    const { data: fallbackData, error: fallbackError } = await supabase
      .from(table)
      .select('*')
      .limit(maxResults);

    if (fallbackError) {
      throw new Error(`Search failed: ${fallbackError.message}`);
    }

    return (fallbackData || []).map((row: any) => ({
      id: row.id,
      partNumber: row.part_number,
      brand: row.brand,
      nameTh: row.part_name_th || row.name_th,
      nameEn: row.part_name_en || row.name_en,
      description: row.description,
      price: row.price,
      stock: row.stock_quantity || row.stock,
      similarity: this.cosineSimilarity(embedding, row.embedding),
      category: row.category,
      subcategory: row.subcategory,
    }));
  }

  /**
   * Keyword search fallback
   */
  private async keywordSearch(
    query: string,
    catalogType: 'parts' | 'tires' | 'all',
    maxResults: number
  ): Promise<SearchResult[]> {
    const allResults: SearchResult[] = [];

    const searchTable = async (table: string) => {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .or(`part_number.ilike.%${query}%,part_name_th.ilike.%${query}%,part_name_en.ilike.%${query}%,brand.ilike.%${query}%`)
        .limit(maxResults);

      if (!error && data) {
        return data.map((row: any) => ({
          id: row.id,
          partNumber: row.part_number,
          brand: row.brand,
          nameTh: row.part_name_th || row.name_th,
          nameEn: row.part_name_en || row.name_en,
          description: row.description,
          price: row.price,
          stock: row.stock_quantity || row.stock,
          similarity: 0.5, // Lower similarity for keyword matches
          category: row.category,
          subcategory: row.subcategory,
        }));
      }
      return [];
    };

    if (catalogType === 'parts' || catalogType === 'all') {
      allResults.push(...await searchTable('parts_catalog'));
    }

    if (catalogType === 'tires' || catalogType === 'all') {
      allResults.push(...await searchTable('tires_catalog'));
    }

    return allResults;
  }

  /**
   * Filter results by vehicle context
   */
  private filterByVehicle(results: SearchResult[], vehicle: any): SearchResult[] {
    if (!vehicle.make && !vehicle.model) {
      return results;
    }

    return results.filter(result => {
      // Check if result has vehicle compatibility info
      if (!result.description) return true; // Don't filter if no data

      const descLower = result.description.toLowerCase();
      const nameLower = (result.nameTh + result.nameEn + result.brand || '').toLowerCase();

      // Check if result mentions the vehicle
      const makeMatch = !vehicle.make ||
        descLower.includes(vehicle.make.toLowerCase()) ||
        nameLower.includes(vehicle.make.toLowerCase());

      const modelMatch = !vehicle.model ||
        descLower.includes(vehicle.model.toLowerCase()) ||
        nameLower.includes(vehicle.model.toLowerCase());

      return makeMatch && modelMatch;
    });
  }

  /**
   * Calculate cosine similarity
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * (b[i] || 0);
      normA += a[i] * a[i];
      normB += (b[i] || 0) * (b[i] || 0);
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Format search results for response
   */
  private formatSearchResults(
    results: SearchResult[],
    language: 'th' | 'en',
    originalQuery: string
  ): string {
    if (results.length === 0) {
      return language === 'th'
        ? `😕 ขออภัย ไม่พบสินค้าที่ค้นหา "${originalQuery}"`
        : `😕 Sorry, no products found for "${originalQuery}"`;
    }

    const summary = language === 'th'
      ? `🔍 พบ ${results.length} รายการที่ตรงกับการค้นหา`
      : `🔍 Found ${results.length} items matching your search`;

    const items = results.slice(0, 5).map((r, i) => {
      const stockStatus = r.stock && r.stock > 0
        ? (language === 'th' ? '✅ มีสินค้า' : '✅ In Stock')
        : (language === 'th' ? '❌ หมด' : '❌ Out of Stock');

      const name = language === 'th'
        ? (r.nameTh || r.nameEn || 'N/A')
        : (r.nameEn || r.nameTh || 'N/A');

      const price = r.price
        ? (language === 'th' ? `ราคา ${r.price} บาท` : `Price: ${r.price} THB`)
        : '';

      return `${i + 1}. ${r.partNumber || 'N/A'} - ${name}
   ${language === 'th' ? 'ยี่ห้อ' : 'Brand'}: ${r.brand || 'N/A'}
   ${price}
   ${stockStatus}`;
    }).join('\n\n');

    const footer = results.length > 5
      ? (language === 'th'
        ? `\n\n...และอีก ${results.length - 5} รายการ`
        : `\n\n...and ${results.length - 5} more items`)
      : '';

    return `${summary}\n\n${items}${footer}`;
  }

  /**
   * Generate follow-up suggestions
   */
  private generateFollowUpSuggestions(
    query: string,
    results: SearchResult[],
    language: 'th' | 'en'
  ): string[] {
    const suggestions: string[] = [];

    if (language === 'th') {
      if (results.length === 0) {
        suggestions.push('ลองค้นหาด้วยชื่อยี่ห้อ');
        suggestions.push('ติดต่อเราเพื่อสอบถาม');
      } else {
        suggestions.push('ตรวจสอบความเข้ากันได้กับรถ');
        suggestions.push('ดูรายละเอียดเพิ่มเติม');
        if (results.some(r => r.price)) {
          suggestions.push('เช็คโปรโมชั่นราคาพิเศษ');
        }
      }
    } else {
      if (results.length === 0) {
        suggestions.push('Try searching by brand');
        suggestions.push('Contact us for assistance');
      } else {
        suggestions.push('Check compatibility with your vehicle');
        suggestions.push('View more details');
        if (results.some(r => r.price)) {
          suggestions.push('Check for special offers');
        }
      }
    }

    return suggestions;
  }

  /**
   * Get error message
   */
  private getErrorMessage(context: AgentContext): string {
    const language = context.preferences?.language || 'th';

    return language === 'th'
      ? '😕 ขออภัย การค้นหาล้มเหลว กรุณาลองใหม่อีกครั้ง'
      : '😕 Sorry, search failed. Please try again.';
  }
}

// ==================== AGENT CAPABILITY EXPORT ====================

export const searchAgentCapability: AgentCapability = {
  name: 'Search',
  description: 'Searches parts and tire catalog',
  canHandle: (query: string, context: AgentContext) => new SearchAgent().canHandle(query, context),
  execute: (query: string, context: AgentContext) => new SearchAgent().execute(query, context)
};
