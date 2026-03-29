/**
 * JETSETGO - Compatibility Agent
 * Checks vehicle compatibility for parts and tires
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type {
  AgentCapability,
  AgentContext,
  AgentResponse,
  VehicleContext
} from './agent-types.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== COMPATIBILITY AGENT ====================

export class CompatibilityAgent {
  /**
   * Check if this agent can handle the query
   */
  async canHandle(query: string, context: AgentContext): Promise<number> {
    const lowerQuery = query.toLowerCase();

    // High confidence for compatibility keywords
    const compatKeywords = [
      'ใส่.*ได้ไหม', 'ใส่.*ได้', 'fit', 'compatib', 'เข้ากัน',
      'compatible', 'ใส่รถ.*ได้', 'for.*car', 'vehicle.*fit',
      'สำหรับ.*รถ', 'suitable.*for', 'ใช้กับ.*ได้', 'use.*with'
    ];

    for (const keyword of compatKeywords) {
      if (new RegExp(keyword, 'i').test(query)) {
        return 0.95;
      }
    }

    // Medium confidence if vehicle context is present
    if (context.vehicleContext?.make || context.vehicleContext?.model) {
      return 0.6;
    }

    return 0.1;
  }

  /**
   * Execute compatibility check
   */
  async execute(query: string, context: AgentContext): Promise<AgentResponse> {
    try {
      const language = context.preferences?.language || this.detectLanguage(query);

      // Extract vehicle info from query or context
      const vehicleInfo = await this.extractVehicleInfo(query, context);

      if (!vehicleInfo.make) {
        return {
          success: false,
          message: this.getVehicleInfoRequestMessage(language),
          agentName: 'Compatibility',
          confidence: 0.3,
          data: { needsVehicleInfo: true }
        };
      }

      // Get the part(s) being checked (from context or extract from query)
      const partNumbers = this.extractPartNumbers(query);

      if (partNumbers.length === 0 && !context.searchResults?.length) {
        return {
          success: false,
          message: this.getPartNumberRequestMessage(language),
          agentName: 'Compatibility',
          confidence: 0.4
        };
      }

      // Perform compatibility check
      const compatibilityResults = await this.checkCompatibility(
        vehicleInfo,
        partNumbers,
        context.searchResults || []
      );

      // Format response
      const message = this.formatCompatibilityResults(
        vehicleInfo,
        compatibilityResults,
        language
      );

      // Generate follow-up suggestions
      const followUpSuggestions = this.generateFollowUpSuggestions(
        vehicleInfo,
        compatibilityResults,
        language
      );

      return {
        success: true,
        message,
        data: { vehicleInfo, compatibilityResults },
        followUpSuggestions,
        agentName: 'Compatibility',
        confidence: 0.9
      };

    } catch (error) {
      console.error('[CompatibilityAgent] Error:', error);

      return {
        success: false,
        message: this.getErrorMessage(context),
        agentName: 'Compatibility',
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
   * Extract vehicle information from query or context
   */
  private async extractVehicleInfo(
    query: string,
    context: AgentContext
  ): Promise<VehicleContext> {
    // Start with context vehicle info
    let vehicleInfo = { ...context.vehicleContext } || {};

    // Try to extract from query using LLM or patterns
    const extracted = await this.extractVehicleFromQuery(query);

    // Merge extracted info with context
    Object.assign(vehicleInfo, extracted);

    return vehicleInfo;
  }

  /**
   * Extract vehicle info from query text
   */
  private async extractVehicleFromQuery(query: string): Promise<VehicleContext> {
    const vehicleInfo: VehicleContext = {};

    // Common car makes
    const makes = [
      'Toyota', 'Honda', 'Nissan', 'Mazda', 'Mitsubishi', 'Ford', 'Isuzu',
      'Suzuki', 'Daihatsu', 'Subaru', 'Volvo', 'BMW', 'Mercedes', 'Audi',
      'Volkswagen', 'Chevrolet', 'Hyundai', 'Kia',
      'โตโยต้า', 'ฮอนด้า', 'นิสสัน', 'มาสด้า', 'มิตซูบิชิ', 'ฟอร์ด', 'อิซูซุ',
      'ซูซuki', 'ไดฮัทสุ', '�ุบaru', 'โฟล์กส์วาเกน', 'เชฟรอเลต', 'ฮุนได', 'เกีย'
    ];

    const lowerQuery = query.toLowerCase();

    for (const make of makes) {
      if (lowerQuery.includes(make.toLowerCase())) {
        vehicleInfo.make = make;
        break;
      }
    }

    // Common models (Thai variations)
    const modelPatterns = [
      { pattern: /city|ซิตี้|ซิตี/i, model: 'City' },
      { pattern: /vios|วิออส|ไวออส/i, model: 'Vios' },
      { pattern: /altis|อัลติส/i, model: 'Altis' },
      { pattern: /camry|แคมรี่|แคมรี/i, model: 'Camry' },
      { pattern: /yaris|ยาริส/i, model: 'Yaris' },
      { pattern: /honda.?jazz|แจ๊ส|จ๊าซ/i, model: 'Jazz' },
      { pattern: /civic|ซีวิค|ซีวิก/i, model: 'Civic' },
      { pattern: /accord|อัคคอร์ด/i, model: 'Accord' },
      { pattern: /brio|บริโอ/i, model: 'Brio' },
      { pattern: /march|มาร์ช/i, model: 'March' },
      { pattern: /note|โน้ต/i, model: 'Note' },
      { pattern: /navara|นาวารา/i, model: 'Navara' },
      { pattern: /terra|เทอร์ร่า/i, model: 'Terra' },
      { pattern: /2?.?(\s|\/)?cap|หัวเดียว|สองแถว/i, model: '2 Cap' },
      { pattern: /4?.?(\s|\/)?cap|สี่แถว/i, model: '4 Cap' },
      { pattern: /ranger|เรนเจอร์/i, model: 'Ranger' },
      { pattern: /fiesta|เฟียสต้า/i, model: 'Fiesta' },
      { pattern: /d-max|ดีแม็กซ์|ดีแม็ก/i, model: 'D-Max' },
      { pattern: /mux|มิวแอ็กซ์/i, model: 'MU-X' },
      { pattern: /swift|สวิฟท์/i, model: 'Swift' },
      { pattern: /carry|แครี่/i, model: 'Carry' },
    ];

    for (const { pattern, model } of modelPatterns) {
      if (pattern.test(query)) {
        vehicleInfo.model = model;
        break;
      }
    }

    // Extract year
    const yearMatch = query.match(/(?:ปี|year)?\s*(\d{4})/i);
    if (yearMatch) {
      const year = parseInt(yearMatch[1]);
      if (year >= 1980 && year <= new Date().getFullYear() + 1) {
        vehicleInfo.year = year;
      }
    }

    // Buddhist year conversion (2565 = 2022)
    if (!vehicleInfo.year) {
      const beYearMatch = query.match(/(\d{4})/);
      if (beYearMatch) {
        const year = parseInt(beYearMatch[1]);
        if (year >= 2500 && year <= 2600) {
          vehicleInfo.year = year - 543;
        }
      }
    }

    return vehicleInfo;
  }

  /**
   * Extract part numbers from query
   */
  private extractPartNumbers(query: string): string[] {
    // Pattern for part numbers (e.g., ABC-1234, 12345-67890, etc.)
    const patterns = [
      /[A-Z]{2,5}-?\d{3,5}/gi,
      /\d{5}-\d{5}/g,
      /p\/n[:\s]*([A-Z0-9-]+)/gi,
      /part\s*number[:\s]*([A-Z0-9-]+)/gi
    ];

    const partNumbers: string[] = [];

    for (const pattern of patterns) {
      const matches = query.match(pattern);
      if (matches) {
        partNumbers.push(...matches.map(m => m.toUpperCase()));
      }
    }

    return [...new Set(partNumbers)];
  }

  /**
   * Check compatibility in database
   */
  private async checkCompatibility(
    vehicleInfo: VehicleContext,
    partNumbers: string[],
    searchResults: any[]
  ): Promise<any[]> {
    const results: any[] = [];

    // If part numbers provided, check compatibility table
    if (partNumbers.length > 0) {
      for (const partNumber of partNumbers) {
        const { data } = await supabase
          .from('vehicle_compatibility')
          .select('*')
          .eq('part_number', partNumber);

        if (data && data.length > 0) {
          for (const row of data) {
            results.push({
              partNumber,
              make: row.make,
              model: row.model,
              yearStart: row.year_start,
              yearEnd: row.year_end,
              compatible: this.isVehicleCompatible(vehicleInfo, row),
              notes: row.notes
            });
          }
        } else {
          // No compatibility data found - use inference
          results.push({
            partNumber,
            compatible: 'unknown',
            notes: 'No compatibility data available'
          });
        }
      }
    }

    // Check search results for vehicle compatibility
    for (const result of searchResults) {
      const partNumber = result.partNumber;

      // Check if result mentions the vehicle
      const mentionsVehicle = this.doesResultMentionVehicle(result, vehicleInfo);

      results.push({
        partNumber,
        make: vehicleInfo.make,
        model: vehicleInfo.model,
        year: vehicleInfo.year,
        compatible: mentionsVehicle ? 'likely' : 'unknown',
        confidence: mentionsVehicle ? 0.7 : 0.3,
        source: 'inference'
      });
    }

    return results;
  }

  /**
   * Check if vehicle is compatible based on compatibility data
   */
  private isVehicleCompatible(vehicleInfo: VehicleContext, compatData: any): boolean | string {
    // Check make
    if (compatData.make.toLowerCase() !== vehicleInfo.make?.toLowerCase()) {
      return false;
    }

    // Check model
    if (compatData.model.toLowerCase() !== vehicleInfo.model?.toLowerCase()) {
      return 'possibly'; // Different model but same make
    }

    // Check year range
    if (vehicleInfo.year) {
      if (compatData.year_start && vehicleInfo.year < compatData.year_start) {
        return false;
      }
      if (compatData.year_end && vehicleInfo.year > compatData.year_end) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if search result mentions the vehicle
   */
  private doesResultMentionVehicle(result: any, vehicleInfo: VehicleContext): boolean {
    const text = [
      result.nameTh || '',
      result.nameEn || '',
      result.description || '',
      result.brand || ''
    ].join(' ').toLowerCase();

    const makeMatch = !vehicleInfo.make || text.includes(vehicleInfo.make.toLowerCase());
    const modelMatch = !vehicleInfo.model || text.includes(vehicleInfo.model.toLowerCase());

    return makeMatch && modelMatch;
  }

  /**
   * Format compatibility results
   */
  private formatCompatibilityResults(
    vehicleInfo: VehicleContext,
    results: any[],
    language: 'th' | 'en'
  ): string {
    const vehicleStr = language === 'th'
      ? `${vehicleInfo.make} ${vehicleInfo.model} ${vehicleInfo.year ? `ปี ${vehicleInfo.year}` : ''}`
      : `${vehicleInfo.make} ${vehicleInfo.model} ${vehicleInfo.year ? `${vehicleInfo.year}` : ''}`;

    let message = language === 'th'
      ? `🚗 ผลการตรวจสอบความเข้ากันได้สำหรับ ${vehicleStr}\n\n`
      : `🚗 Compatibility Check Results for ${vehicleStr}\n\n`;

    if (results.length === 0) {
      message += language === 'th'
        ? 'ไม่พบข้อมูลความเข้ากันได้ กรุณาติดต่อเจ้าหน้าที่'
        : 'No compatibility data found. Please contact our staff.';
      return message;
    }

    for (const result of results) {
      const partNumber = result.partNumber || 'N/A';

      if (result.compatible === true) {
        message += language === 'th'
          ? `✅ ${partNumber}: ใส่ได้\n`
          : `✅ ${partNumber}: Compatible\n`;
      } else if (result.compatible === 'possibly') {
        message += language === 'th'
          ? `⚠️ ${partNumber}: อาจใส่ได้ แนะนำให้ตรวจสอบเพิ่มเติม\n`
          : `⚠️ ${partNumber}: Possibly compatible, please verify\n`;
      } else if (result.compatible === 'likely') {
        message += language === 'th'
          ? `✅ ${partNumber}: น่าจะใส่ได้ (อ้างอิงจากข้อมูลสินค้า)\n`
          : `✅ ${partNumber}: Likely compatible (based on product info)\n`;
      } else if (result.compatible === false) {
        message += language === 'th'
          ? `❌ ${partNumber}: ไม่เข้ากัน\n`
          : `❌ ${partNumber}: Not compatible\n`;
      } else {
        message += language === 'th'
          ? `❓ ${partNumber}: ไม่แน่ใจ กรุณาติดต่อเจ้าหน้าที่\n`
          : `❓ ${partNumber}: Unknown, please contact our staff\n`;
      }

      if (result.notes) {
        message += `   ${result.notes}\n`;
      }
    }

    // Add recommendation
    message += '\n' + (language === 'th'
      ? '💡 แนะนำ: หากไม่มั่นใจ สามารถส่งรูปซีลีย์หรือเลขตัวถังมาให้เราตรวจสอบได้ครับ'
      : '💡 Tip: If unsure, you can send us a photo of the seal or engine number for verification.');

    return message;
  }

  /**
   * Generate follow-up suggestions
   */
  private generateFollowUpSuggestions(
    vehicleInfo: VehicleContext,
    results: any[],
    language: 'th' | 'en'
  ): string[] {
    const suggestions: string[] = [];

    if (language === 'th') {
      suggestions.push('ดูอะไหล่ที่เหมาะสมกับรถคันนี้');
      suggestions.push('สอบถามราคาพร้อมติดตั้ง');
      suggestions.push('ค้นหาอะไหล่ตามรุ่นรถ');
    } else {
      suggestions.push('View parts suitable for this vehicle');
      suggestions.push('Ask about installed price');
      suggestions.push('Search by vehicle model');
    }

    return suggestions;
  }

  /**
   * Get vehicle info request message
   */
  private getVehicleInfoRequestMessage(language: 'th' | 'en'): string {
    return language === 'th'
      ? '🚗 เพื่อตรวจสอบความเข้ากันได้ กรุณาระบุยี่ห้อและรุ่นรถของคุณ\n\nเช่น: Toyota Vios ปี 2020'
      : '🚗 To check compatibility, please specify your vehicle make and model\n\nExample: Toyota Vios 2020';
  }

  /**
   * Get part number request message
   */
  private getPartNumberRequestMessage(language: 'th' | 'en'): string {
    return language === 'th'
      ? '🔍 กรุณาระบุ Part Number หรือชื่ออะไหล่ที่ต้องการตรวจสอบ'
      : '🔍 Please specify the Part Number or part name to check';
  }

  /**
   * Get error message
   */
  private getErrorMessage(context: AgentContext): string {
    const language = context.preferences?.language || 'th';

    return language === 'th'
      ? '😕 ขออภัย การตรวจสอบความเข้ากันได้ล้มเหลว กรุณาลองใหม่อีกครั้ง'
      : '😕 Sorry, compatibility check failed. Please try again.';
  }
}

// ==================== AGENT CAPABILITY EXPORT ====================

export const compatibilityAgentCapability: AgentCapability = {
  name: 'Compatibility',
  description: 'Checks vehicle compatibility for parts and tires',
  canHandle: (query: string, context: AgentContext) => new CompatibilityAgent().canHandle(query, context),
  execute: (query: string, context: AgentContext) => new CompatibilityAgent().execute(query, context)
};
