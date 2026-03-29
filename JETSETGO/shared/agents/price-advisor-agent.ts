/**
 * JETSETGO - Price Advisor Agent
 * Provides pricing information, deals, and value analysis
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

// ==================== PRICE ADVISOR AGENT ====================

export class PriceAdvisorAgent {
  /**
   * Check if this agent can handle the query
   */
  async canHandle(query: string, context: AgentContext): Promise<number> {
    const lowerQuery = query.toLowerCase();

    // High confidence for price keywords
    const priceKeywords = [
      'ราคา', 'price', 'เท่าไหร่', 'how much', 'cost', 'ราคาเท่าไร',
      'ลดราคา', 'discount', 'โปรโมชั่น', 'promotion', 'deals', 'แถม', 'free',
      'ราคาถูก', 'cheap', 'budget', 'ประหยัด', 'คุ้มค่า', 'value',
      'ราคาแพง', 'expensive', 'premium', 'ราคาเดิม', 'original price'
    ];

    for (const keyword of priceKeywords) {
      if (new RegExp(keyword, 'i').test(query)) {
        return 0.95;
      }
    }

    return 0.1;
  }

  /**
   * Execute price advisor
   */
  async execute(query: string, context: AgentContext): Promise<AgentResponse> {
    try {
      const language = context.preferences?.language || this.detectLanguage(query);

      // Determine advisor type
      const advisorType = this.determineAdvisorType(query);

      // Get pricing information
      const pricingInfo = await this.getPricingInfo(advisorType, query, context);

      // Format response
      const message = this.formatPricingInfo(pricingInfo, advisorType, language);

      // Generate follow-up suggestions
      const followUpSuggestions = this.generateFollowUpSuggestions(
        pricingInfo,
        advisorType,
        language
      );

      return {
        success: true,
        message,
        data: { pricingInfo, advisorType },
        followUpSuggestions,
        agentName: 'PriceAdvisor',
        confidence: 0.9
      };

    } catch (error) {
      console.error('[PriceAdvisorAgent] Error:', error);

      return {
        success: false,
        message: this.getErrorMessage(context),
        agentName: 'PriceAdvisor',
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
   * Determine advisor type
   */
  private determineAdvisorType(query: string): 'standard' | 'discount' | 'comparison' | 'value_analysis' {
    const lowerQuery = query.toLowerCase();

    if (/(ลดราคา|discount|โปรโมชั่น|promotion|deals|แถม|free|แลก|โค้ด|code)/i.test(query)) {
      return 'discount';
    }

    if (/(เปรียบเทียบ|compare|versus|vs|กับ.*แบบไหน|different|ต่าง)/i.test(query)) {
      return 'comparison';
    }

    if (/(คุ้มค่า|value|ประหยัด|budget|คุ้มไหม|worth)/i.test(query)) {
      return 'value_analysis';
    }

    return 'standard';
  }

  /**
   * Get pricing information
   */
  async getPricingInfo(
    advisorType: string,
    query: string,
    context: AgentContext
  ): Promise<any> {
    const baseResults = context.searchResults || [];

    if (baseResults.length === 0) {
      return await this.getMarketPricing(query, context);
    }

    switch (advisorType) {
      case 'discount':
        return await this.getDiscountInfo(baseResults);
      case 'comparison':
        return await this.getPriceComparison(baseResults);
      case 'value_analysis':
        return await this.getValueAnalysis(baseResults);
      default:
        return await this.getStandardPricing(baseResults);
    }
  }

  /**
   * Get market pricing for query
   */
  private async getMarketPricing(query: string, context: AgentContext): Promise<any> {
    const category = this.inferCategory(query);

    const { data } = await supabase
      .from('parts_catalog')
      .select('part_number, brand, part_name_th, part_name_en, price, stock_quantity')
      .eq('category', category)
      .not('price', 'is', null)
      .order('price', { ascending: true })
      .limit(10);

    if (!data || data.length === 0) {
      return { hasData: false };
    }

    const prices = data.map(r => r.price).filter(p => p !== null);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

    return {
      hasData: true,
      category,
      minPrice,
      maxPrice,
      avgPrice: Math.round(avgPrice),
      priceRange: `${minPrice} - ${maxPrice}`,
      items: data.slice(0, 5)
    };
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
      'battery': ['แบต', 'battery'],
      'suspension': ['ช่วงล่าง', 'suspension', 'shock', 'absorber']
    };

    for (const [category, keywords] of Object.entries(categoryMap)) {
      if (keywords.some(k => lowerQuery.includes(k))) {
        return category;
      }
    }

    return 'tires';
  }

  /**
   * Get standard pricing
   */
  private async getStandardPricing(results: SearchResult[]): Promise<any> {
    const withPrice = results.filter(r => r.price !== undefined && r.price !== null);

    if (withPrice.length === 0) {
      return { hasData: false, message: 'No pricing data available' };
    }

    const prices = withPrice.map(r => r.price!);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

    return {
      hasData: true,
      itemCount: withPrice.length,
      minPrice,
      maxPrice,
      avgPrice: Math.round(avgPrice),
      items: withPrice.map(r => ({
        partNumber: r.partNumber,
        brand: r.brand,
        name: r.nameTh || r.nameEn,
        price: r.price,
        stock: r.stock
      }))
    };
  }

  /**
   * Get discount information
   */
  private async getDiscountInfo(results: SearchResult[]): Promise<any> {
    // Check for active promotions
    const { data: promotions } = await supabase
      .from('promotions')
      .select('*')
      .eq('active', true)
      .gt('end_date', new Date().toISOString());

    const applicablePromos = (promotions || []).filter((promo: any) => {
      // Check if promo applies to any of the results
      return results.some(r =>
        promo.categories?.includes(r.category) ||
        promo.brands?.includes(r.brand)
      );
    });

    return {
      hasData: true,
      promotions: applicablePromos,
      hasActivePromo: applicablePromos.length > 0,
      message: applicablePromos.length > 0
        ? `Found ${applicablePromos.length} active promotion(s)`
        : 'No active promotions for these items'
    };
  }

  /**
   * Get price comparison
   */
  private async getPriceComparison(results: SearchResult[]): Promise<any> {
    const withPrice = results.filter(r => r.price !== undefined && r.price !== null);

    if (withPrice.length < 2) {
      return { hasData: false, message: 'Need at least 2 items with prices' };
    }

    const sorted = [...withPrice].sort((a, b) => (a.price || 0) - (b.price || 0));
    const cheapest = sorted[0];
    const mostExpensive = sorted[sorted.length - 1];
    const savings = (mostExpensive.price || 0) - (cheapest.price || 0);
    const savingsPercent = Math.round((savings / (mostExpensive.price || 1)) * 100);

    return {
      hasData: true,
      cheapest: {
        partNumber: cheapest.partNumber,
        brand: cheapest.brand,
        name: cheapest.nameTh || cheapest.nameEn,
        price: cheapest.price
      },
      mostExpensive: {
        partNumber: mostExpensive.partNumber,
        brand: mostExpensive.brand,
        name: mostExpensive.nameTh || mostExpensive.nameEn,
        price: mostExpensive.price
      },
      priceDifference: savings,
      savingsPercent,
      allPrices: sorted.map(r => ({
        partNumber: r.partNumber,
        brand: r.brand,
        price: r.price,
        isCheapest: r.partNumber === cheapest.partNumber
      }))
    };
  }

  /**
   * Get value analysis
   */
  private async getValueAnalysis(results: SearchResult[]): Promise<any> {
    const withPrice = results.filter(r => r.price !== undefined && r.price !== null);

    if (withPrice.length === 0) {
      return { hasData: false };
    }

    // Calculate value score (consider price, brand, stock)
    const scoredItems = withPrice.map(r => {
      let score = 50; // Base score

      // Price consideration (lower is better for value)
      const prices = withPrice.map(i => i.price!);
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      const priceRatio = avgPrice / (r.price || avgPrice);
      score += priceRatio > 1 ? 10 : -10;

      // Stock consideration
      if (r.stock && r.stock > 5) score += 10;
      else if (r.stock && r.stock > 0) score += 5;

      // Brand consideration (premium brands get higher score)
      const premiumBrands = ['Michelin', 'Bridgestone', 'Goodyear'];
      if (r.brand && premiumBrands.some(b => r.brand?.toLowerCase().includes(b.toLowerCase()))) {
        score += 15;
      }

      return {
        ...r,
        valueScore: Math.min(100, Math.max(0, score))
      };
    });

    // Sort by value score
    scoredItems.sort((a, b) => b.valueScore - a.valueScore);

    return {
      hasData: true,
      bestValue: scoredItems[0],
      rankedItems: scoredItems.slice(0, 5).map(item => ({
        partNumber: item.partNumber,
        brand: item.brand,
        name: item.nameTh || item.nameEn,
        price: item.price,
        valueScore: item.valueScore
      }))
    };
  }

  /**
   * Format pricing information
   */
  private formatPricingInfo(
    pricingInfo: any,
    advisorType: string,
    language: 'th' | 'en'
  ): string {
    if (!pricingInfo.hasData) {
      return language === 'th'
        ? '😕 ขออภัย ไม่พบข้อมูลราคาสำหรับสินค้าที่ค้นหา'
        : '😕 Sorry, no pricing data found for the searched items';
    }

    switch (advisorType) {
      case 'discount':
        return this.formatDiscountInfo(pricingInfo, language);
      case 'comparison':
        return this.formatPriceComparison(pricingInfo, language);
      case 'value_analysis':
        return this.formatValueAnalysis(pricingInfo, language);
      case 'standard':
        return this.formatStandardPricing(pricingInfo, language);
      default:
        return this.formatStandardPricing(pricingInfo, language);
    }
  }

  /**
   * Format standard pricing
   */
  private formatStandardPricing(info: any, language: 'th' | 'en'): string {
    let message = language === 'th'
      ? `💰 ข้อมูลราคา\n\n`
      : `💰 Pricing Information\n\n`;

    if (info.avgPrice) {
      message += language === 'th'
        ? `• ราคาเฉลี่ย: ${info.avgPrice} บาท\n`
        : `• Average price: ${info.avgPrice} THB\n`;
    }

    if (info.minPrice && info.maxPrice) {
      message += language === 'th'
        ? `• ช่วงราคา: ${info.minPrice} - ${info.maxPrice} บาท\n\n`
        : `• Price range: ${info.minPrice} - ${info.maxPrice} THB\n\n`;
    }

    if (info.items && info.items.length > 0) {
      message += language === 'th'
        ? `รายการสินค้า:\n\n`
        : `Items:\n\n`;

      message += info.items.map((item: any, i: number) =>
        `${i + 1}. ${item.part_number || 'N/A'} - ${item.name || item.part_name_th || item.part_name_en}
   ${language === 'th' ? 'ยี่ห้อ' : 'Brand'}: ${item.brand || 'N/A'}
   ${language === 'th' ? 'ราคา' : 'Price'}: ${item.price} บาท
   ${item.stock > 0 ? '✅' : '❌'} ${language === 'th' ? 'มีสินค้า' : 'In Stock'}`
      ).join('\n\n');
    }

    return message;
  }

  /**
   * Format discount info
   */
  private formatDiscountInfo(info: any, language: 'th' | 'en'): string {
    let message = language === 'th'
      ? `🏷️ ข้อมูลโปรโมชั่นและส่วนลด\n\n`
      : `🏷️ Promotions & Discounts\n\n`;

    if (info.hasActivePromo && info.promotions?.length > 0) {
      for (const promo of info.promotions) {
        message += language === 'th'
          ? `✨ ${promo.name_th || promo.name}\n`
          : `✨ ${promo.name}\n`;

        message += language === 'th'
          ? `   ${promo.description_th || promo.description}\n`
          : `   ${promo.description}\n`;

        if (promo.discount_percent) {
          message += language === 'th'
            ? `   ส่วนลด ${promo.discount_percent}%\n`
            : `   ${promo.discount_percent}% off\n`;
        }

        message += '\n';
      }
    } else {
      message += language === 'th'
        ? '😕 ขณะนี้ยังไม่มีโปรโมชั่นสำหรับสินค้าที่ค้นหา\n\n'
        : '😕 No active promotions for the searched items\n\n';
    }

    message += language === 'th'
      ? '💡 แนะนำ: ติดตามโปรโมชั่นพิเศษได้ที่หน้าเพจของเรา'
      : '💡 Tip: Follow our page for special promotions';

    return message;
  }

  /**
   * Format price comparison
   */
  private formatPriceComparison(info: any, language: 'th' | 'en'): string {
    let message = language === 'th'
      ? `📊 เปรียบเทียบราคา\n\n`
      : `📊 Price Comparison\n\n`;

    if (info.cheapest) {
      message += language === 'th'
        ? `💵 ราคาถูกที่สุด:\n`
        : `💵 Lowest Price:\n`;

      message += `   ${info.cheapest.partNumber} - ${info.cheapest.name}
   ${info.cheapest.brand}
   ${language === 'th' ? 'ราคา' : 'Price'}: ${info.cheapest.price} บาท\n\n`;
    }

    if (info.mostExpensive && info.savingsPercent) {
      message += language === 'th'
        ? `💸 ประหยัดได้: ${info.priceDifference} บาท (${info.savingsPercent}%)\n\n`
        : `💸 Savings: ${info.priceDifference} THB (${info.savingsPercent}%)\n\n`;
    }

    if (info.allPrices && info.allPrices.length > 0) {
      message += language === 'th'
        ? `รายการเปรียบเทียบ:\n\n`
        : `Comparison List:\n\n`;

      message += info.allPrices.map((item: any, i: number) =>
        `${i + 1}. ${item.partNumber}
   ${item.brand} - ${item.price} บาท
   ${item.isCheapest ? '💵 ราคาถูกสุด' : ''}`
      ).join('\n\n');
    }

    return message;
  }

  /**
   * Format value analysis
   */
  private formatValueAnalysis(info: any, language: 'th' | 'en'): string {
    let message = language === 'th'
      ? `🏆 วิเคราะห์ความคุ้มค่า\n\n`
      : `🏆 Value Analysis\n\n`;

    if (info.bestValue) {
      message += language === 'th'
        ? `⭐ คุ้มค่าที่สุด:\n`
        : `⭐ Best Value:\n`;

      message += `   ${info.bestValue.partNumber} - ${info.bestValue.name}
   ${info.bestValue.brand}
   ${language === 'th' ? 'ราคา' : 'Price'}: ${info.bestValue.price} บาท
   ${language === 'th' ? 'คะแนน' : 'Score'}: ${info.bestValue.valueScore}/100\n\n`;
    }

    if (info.rankedItems && info.rankedItems.length > 1) {
      message += language === 'th'
        ? `อันดับความคุ้มค่า:\n\n`
        : `Value Rankings:\n\n`;

      message += info.rankedItems.map((item: any, i: number) =>
        `${i + 1}. ${item.partNumber} (${item.brand})
   ${language === 'th' ? 'ราคา' : 'Price'}: ${item.price} บาท
   ${language === 'th' ? 'คะแนน' : 'Score'}: ${item.valueScore}/100`
      ).join('\n\n');
    }

    return message;
  }

  /**
   * Generate follow-up suggestions
   */
  private generateFollowUpSuggestions(
    pricingInfo: any,
    advisorType: string,
    language: 'th' | 'en'
  ): string[] {
    const suggestions: string[] = [];

    if (language === 'th') {
      suggestions.push('ดูรายละเอียดสินค้า');
      suggestions.push('เช็คความเข้ากันกับรถ');

      if (advisorType === 'comparison') {
        suggestions.push('เปรียบเทียบยี่ห้ออื่น');
      }

      if (advisorType === 'value_analysis') {
        suggestions.push('ดูตัวเลือกราคาประหยัดกว่า');
      }
    } else {
      suggestions.push('View product details');
      suggestions.push('Check vehicle compatibility');

      if (advisorType === 'comparison') {
        suggestions.push('Compare other brands');
      }

      if (advisorType === 'value_analysis') {
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
      ? '😕 ขออภัย การดึงข้อมูลราคาล้มเหลว กรุณาลองใหม่อีกครั้ง'
      : '😕 Sorry, failed to fetch pricing information. Please try again.';
  }
}

// ==================== AGENT CAPABILITY EXPORT ====================

export const priceAdvisorAgentCapability: AgentCapability = {
  name: 'PriceAdvisor',
  description: 'Provides pricing information and deals',
  canHandle: (query: string, context: AgentContext) => new PriceAdvisorAgent().canHandle(query, context),
  execute: (query: string, context: AgentContext) => new PriceAdvisorAgent().execute(query, context)
};
