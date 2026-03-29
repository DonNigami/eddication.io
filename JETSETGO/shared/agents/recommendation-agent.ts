/**
 * JETSETGO - Recommendation Agent
 * Provides product recommendations and alternatives
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

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== RECOMMENDATION AGENT ====================

export class RecommendationAgent {
  /**
   * Check if this agent can handle the query
   */
  async canHandle(query: string, context: AgentContext): Promise<number> {
    const lowerQuery = query.toLowerCase();

    // High confidence for recommendation keywords
    const recommendKeywords = [
      'แนะนำ', 'recommend', 'suggest', 'ดีที่สุด', 'best', 'top',
      'ควร', 'should', 'ทางเลือก', 'alternative', 'option', 'ตัวไหนดี',
      'อะไรดี', 'what.*good', 'which.*better', 'upgrade', 'เกรด.*กว่า'
    ];

    for (const keyword of recommendKeywords) {
      if (new RegExp(keyword, 'i').test(query)) {
        return 0.9;
      }
    }

    // Medium confidence if asking about quality/performance
    if (/(คุณภาพ|quality|performance|durability|ทนทาน|ใช้งานดี)/i.test(query)) {
      return 0.7;
    }

    return 0.2;
  }

  /**
   * Execute recommendation
   */
  async execute(query: string, context: AgentContext): Promise<AgentResponse> {
    try {
      const language = context.preferences?.language || this.detectLanguage(query);

      // Determine recommendation type
      const recType = this.determineRecommendationType(query, context);

      // Get recommendations based on type
      const recommendations = await this.getRecommendations(recType, query, context);

      // Format response
      const message = this.formatRecommendations(recommendations, recType, language);

      // Generate follow-up suggestions
      const followUpSuggestions = this.generateFollowUpSuggestions(
        recommendations,
        language
      );

      return {
        success: true,
        message,
        data: { recommendations, recType },
        followUpSuggestions,
        agentName: 'Recommendation',
        confidence: recommendations.length > 0 ? 0.85 : 0.4
      };

    } catch (error) {
      console.error('[RecommendationAgent] Error:', error);

      return {
        success: false,
        message: this.getErrorMessage(context),
        agentName: 'Recommendation',
        confidence: 0
      };
    }
  }

  /**
   * Detect language from query
   */
  private detectLanguage(query: string): 'th' | 'en' {
    return /[\u0E00-\u0E7F]/.test(query) ? 'th' : 'en';
  }

  /**
   * Determine recommendation type
   */
  private determineRecommendationType(
    query: string,
    context: AgentContext
  ): 'alternative' | 'upgrade' | 'best_seller' | 'value' | 'premium' | 'compatible' {
    const lowerQuery = query.toLowerCase();

    if (/(alternative|ทางเลือก|ตัวอื่น|other|แบบอื่น)/i.test(query)) {
      return 'alternative';
    }

    if (/(upgrade|เกรดสูงกว่า|ดีกว่า|better|premium|high.*end|top.*tier)/i.test(query)) {
      return 'upgrade';
    }

    if (/(ขายดี|popular|best.*seller|hot|ยอดนิยม)/i.test(query)) {
      return 'best_seller';
    }

    if (/(ราคาถูก|value|budget|ประหยัด|คุ้มค่า)/i.test(query)) {
      return 'value';
    }

    if (/(แพงดี|premium|high.*quality|รุ่นไฮเอนด์)/i.test(query)) {
      return 'premium';
    }

    // Default to alternatives based on search results
    return 'alternative';
  }

  /**
   * Get recommendations based on type
   */
  async getRecommendations(
    recType: string,
    query: string,
    context: AgentContext
  ): Promise<SearchResult[]> {
    const baseResults = context.searchResults || [];

    if (baseResults.length === 0) {
      // If no base results, get some from search
      return await this.getBaseRecommendations(query, context);
    }

    switch (recType) {
      case 'alternative':
        return await this.getAlternatives(baseResults, context);
      case 'upgrade':
        return await this.getUpgrades(baseResults, context);
      case 'best_seller':
        return await this.getBestSellers(query, context);
      case 'value':
        return await this.getValueOptions(baseResults, context);
      case 'premium':
        return await this.getPremiumOptions(baseResults, context);
      case 'compatible':
        return await this.getCompatibleOptions(query, context);
      default:
        return baseResults.slice(0, 3);
    }
  }

  /**
   * Get base recommendations when no search results exist
   */
  private async getBaseRecommendations(
    query: string,
    context: AgentContext
  ): Promise<SearchResult[]> {
    // Get popular items based on query category
    const { data } = await supabase
      .from('parts_catalog')
      .select('*')
      .eq('category', this.inferCategory(query))
      .order('stock_quantity', { ascending: false })
      .limit(5);

    return (data || []).map((row: any) => ({
      id: row.id,
      partNumber: row.part_number,
      brand: row.brand,
      nameTh: row.part_name_th,
      nameEn: row.part_name_en,
      description: row.description,
      price: row.price,
      stock: row.stock_quantity,
      similarity: 0.7,
      category: row.category
    }));
  }

  /**
   * Infer category from query
   */
  private inferCategory(query: string): string {
    const lowerQuery = query.toLowerCase();

    const categoryMap: Record<string, string[]> = {
      'tires': ['ยาง', 'tire', 'tyre', 'ล้อ'],
      'oil': ['น้ำมัน', 'oil', 'lubricant', 'น้ำมันเครื่อง'],
      'brakes': ['เบรก', 'brake', 'ปะกลงงพร้อม', 'disc', 'pad'],
      'filters': ['กรอง', 'filter', 'กรองอากาศ', 'oil filter'],
      'ignition': ['หัวเทียน', 'spark', 'plug', 'ignition'],
      'battery': ['แบต', 'battery', 'battery'],
      'suspension': ['ช่วงล่าง', 'suspension', 'shock', 'absorber']
    };

    for (const [category, keywords] of Object.entries(categoryMap)) {
      if (keywords.some(k => lowerQuery.includes(k))) {
        return category;
      }
    }

    return 'tires'; // Default
  }

  /**
   * Get alternative products
   */
  private async getAlternatives(
    baseResults: SearchResult[],
    context: AgentContext
  ): Promise<SearchResult[]> {
    const alternatives: SearchResult[] = [];

    for (const result of baseResults.slice(0, 2)) {
      // Find similar items with different brands
      const { data } = await supabase
        .from('parts_catalog')
        .select('*')
        .eq('category', result.category)
        .neq('brand', result.brand)
        .neq('part_number', result.partNumber)
        .gt('stock_quantity', 0)
        .limit(2);

      if (data) {
        alternatives.push(...data.map((row: any) => ({
          id: row.id,
          partNumber: row.part_number,
          brand: row.brand,
          nameTh: row.part_name_th,
          nameEn: row.part_name_en,
          description: row.description,
          price: row.price,
          stock: row.stock_quantity,
          similarity: 0.75,
          category: row.category,
          recReason: 'alternative_brand'
        })));
      }
    }

    return alternatives.slice(0, 5);
  }

  /**
   * Get upgrade options
   */
  private async getUpgrades(
    baseResults: SearchResult[],
    context: AgentContext
  ): Promise<SearchResult[]> {
    const upgrades: SearchResult[] = [];

    for (const result of baseResults.slice(0, 2)) {
      // Find higher-priced items in same category (premium options)
      const basePrice = result.price || 0;

      const { data } = await supabase
        .from('parts_catalog')
        .select('*')
        .eq('category', result.category)
        .gt('price', basePrice * 1.2) // At least 20% more expensive
        .order('price', { ascending: false })
        .limit(2);

      if (data) {
        upgrades.push(...data.map((row: any) => ({
          id: row.id,
          partNumber: row.part_number,
          brand: row.brand,
          nameTh: row.part_name_th,
          nameEn: row.part_name_en,
          description: row.description,
          price: row.price,
          stock: row.stock_quantity,
          similarity: 0.8,
          category: row.category,
          recReason: 'upgrade'
        })));
      }
    }

    return upgrades.slice(0, 5);
  }

  /**
   * Get best sellers
   */
  private async getBestSellers(
    query: string,
    context: AgentContext
  ): Promise<SearchResult[]> {
    const category = this.inferCategory(query);

    const { data } = await supabase
      .from('parts_catalog')
      .select('*')
      .eq('category', category)
      .gt('stock_quantity', 5) // Assuming high stock = popular
      .order('created_at', { ascending: false }) // Recently added
      .limit(5);

    return (data || []).map((row: any) => ({
      id: row.id,
      partNumber: row.part_number,
      brand: row.brand,
      nameTh: row.part_name_th,
      nameEn: row.part_name_en,
      description: row.description,
      price: row.price,
      stock: row.stock_quantity,
      similarity: 0.7,
      category: row.category,
      recReason: 'best_seller'
    }));
  }

  /**
   * Get value options (budget-friendly)
   */
  private async getValueOptions(
    baseResults: SearchResult[],
    context: AgentContext
  ): Promise<SearchResult[]> {
    const valueOptions: SearchResult[] = [];

    for (const result of baseResults.slice(0, 1)) {
      const basePrice = result.price || 999999;

      const { data } = await supabase
        .from('parts_catalog')
        .select('*')
        .eq('category', result.category)
        .lt('price', basePrice * 0.8) // At least 20% cheaper
        .gt('stock_quantity', 0)
        .order('price', { ascending: true })
        .limit(3);

      if (data) {
        valueOptions.push(...data.map((row: any) => ({
          id: row.id,
          partNumber: row.part_number,
          brand: row.brand,
          nameTh: row.part_name_th,
          nameEn: row.part_name_en,
          description: row.description,
          price: row.price,
          stock: row.stock_quantity,
          similarity: 0.75,
          category: row.category,
          recReason: 'value'
        })));
      }
    }

    return valueOptions.slice(0, 5);
  }

  /**
   * Get premium options
   */
  private async getPremiumOptions(
    baseResults: SearchResult[],
    context: AgentContext
  ): Promise<SearchResult[]> {
    // Find top-priced items in category
    const category = baseResults[0]?.category || 'tires';

    const { data } = await supabase
      .from('parts_catalog')
      .select('*')
      .eq('category', category)
      .gt('stock_quantity', 0)
      .order('price', { ascending: false })
      .limit(5);

    return (data || []).map((row: any) => ({
      id: row.id,
      partNumber: row.part_number,
      brand: row.brand,
      nameTh: row.part_name_th,
      nameEn: row.part_name_en,
      description: row.description,
      price: row.price,
      stock: row.stock_quantity,
      similarity: 0.8,
      category: row.category,
      recReason: 'premium'
    }));
  }

  /**
   * Get compatible options for vehicle
   */
  private async getCompatibleOptions(
    query: string,
    context: AgentContext
  ): Promise<SearchResult[]> {
    const vehicleInfo = context.vehicleContext;

    if (!vehicleInfo?.make) {
      return [];
    }

    // Search for parts mentioning the vehicle
    const { data } = await supabase
      .from('parts_catalog')
      .select('*')
      .or(`description.ilike.%${vehicleInfo.make}%,part_name_th.ilike.%${vehicleInfo.make}%`)
      .limit(5);

    return (data || []).map((row: any) => ({
      id: row.id,
      partNumber: row.part_number,
      brand: row.brand,
      nameTh: row.part_name_th,
      nameEn: row.part_name_en,
      description: row.description,
      price: row.price,
      stock: row.stock_quantity,
      similarity: 0.85,
      category: row.category,
      recReason: 'compatible'
    }));
  }

  /**
   * Format recommendations
   */
  private formatRecommendations(
    recommendations: SearchResult[],
    recType: string,
    language: 'th' | 'en'
  ): string {
    if (recommendations.length === 0) {
      return language === 'th'
        ? '😕 ขออภัย ไม่พบทางเลือกแนะนำสำหรับสินค้านี้'
        : '😕 Sorry, no recommendations found for this product';
    }

    const typeLabels: Record<string, { th: string; en: string }> = {
      'alternative': { th: 'ทางเลือกอื่น', en: 'Other Options' },
      'upgrade': { th: 'ตัวเลือกเกรดสูงกว่า', en: 'Premium Upgrades' },
      'best_seller': { th: 'ยอดนิยม', en: 'Best Sellers' },
      'value': { th: 'ราคาประหยัด', en: 'Budget-Friendly Options' },
      'premium': { th: 'รุ่นพรีเมียม', en: 'Premium Selection' },
      'compatible': { th: 'เข้ากันได้', en: 'Compatible Options' }
    };

    const typeLabel = typeLabels[recType] || typeLabels['alternative'];
    const header = language === 'th'
      ? `💡 ${typeLabel.th}ที่แนะนำ:\n\n`
      : `💡 ${typeLabel.en}:\n\n`;

    const items = recommendations.map((r, i) => {
      const name = language === 'th' ? r.nameTh || r.nameEn : r.nameEn || r.nameTh;
      const price = r.price ? (language === 'th' ? `${r.price} บาท` : `${r.price} THB`) : '';

      let badge = '';
      if (r.recReason === 'upgrade') badge = language === 'th' ? '⭐' : '⭐';
      if (r.recReason === 'value') badge = language === 'th' ? '💰' : '💰';
      if (r.recReason === 'premium') badge = language === 'th' ? '👑' : '👑';

      return `${i + 1}. ${badge} ${r.partNumber || 'N/A'} - ${name}
   ${language === 'th' ? 'ยี่ห้อ' : 'Brand'}: ${r.brand || 'N/A'}
   ${price}`;
    }).join('\n\n');

    return header + items;
  }

  /**
   * Generate follow-up suggestions
   */
  private generateFollowUpSuggestions(
    recommendations: SearchResult[],
    language: 'th' | 'en'
  ): string[] {
    const suggestions: string[] = [];

    if (language === 'th') {
      suggestions.push('ดูรายละเอียดเพิ่มเติม');
      suggestions.push('เช็คความเข้ากันกับรถ');
      suggestions.push('สอบถามราคาพร้อมติดตั้ง');

      if (recommendations.some(r => r.price && r.price > 3000)) {
        suggestions.push('ดูตัวเลือกราคาประหยัดกว่า');
      }
    } else {
      suggestions.push('View more details');
      suggestions.push('Check vehicle compatibility');
      suggestions.push('Ask about installed price');

      if (recommendations.some(r => r.price && r.price > 3000)) {
        suggestions.push('See budget-friendly options');
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
      ? '😕 ขออภัย การแนะนำล้มเหลว กรุณาลองใหม่อีกครั้ง'
      : '😕 Sorry, recommendation failed. Please try again.';
  }
}

// ==================== AGENT CAPABILITY EXPORT ====================

export const recommendationAgentCapability: AgentCapability = {
  name: 'Recommendation',
  description: 'Provides product recommendations and alternatives',
  canHandle: (query: string, context: AgentContext) => new RecommendationAgent().canHandle(query, context),
  execute: (query: string, context: AgentContext) => new RecommendationAgent().execute(query, context)
};
