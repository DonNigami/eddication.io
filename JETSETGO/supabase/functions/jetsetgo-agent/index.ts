/**
 * JETSETGO - Agentic AI Orchestrator Edge Function
 * Multi-Agent System for Intelligent Parts Catalog Search
 *
 * This function routes queries through multiple specialist agents:
 * - Search Agent: Parts and tire catalog search
 * - Compatibility Agent: Vehicle compatibility checks
 * - Recommendation Agent: Product recommendations and alternatives
 * - Price Advisor Agent: Pricing and promotions
 * - Conversation Agent: Context and general inquiries
 *
 * Architecture:
 * 1. Receive query from LINE or Web
 * 2. Orchestrator extracts intent
 * 3. Route to appropriate agent(s)
 * 4. Synthesize responses
 * 5. Return formatted response
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ==================== CONFIGURATION ====================
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== TYPES ====================
interface AgentRequest {
  query: string;
  userId?: string;
  sessionId?: string;
  preferences?: {
    language?: 'th' | 'en';
    budgetMin?: number;
    budgetMax?: number;
    preferredBrands?: string[];
  };
  vehicleContext?: {
    make?: string;
    model?: string;
    year?: number;
    engine?: string;
  };
  contextData?: {
    searchResults?: any[];
    conversationHistory?: Array<{ role: string; content: string }>;
  };
}

interface AgentResponse {
  success: boolean;
  message: string;
  data?: any;
  followUpSuggestions?: string[];
  involvedAgents: string[];
  executionTime: number;
  intent?: string;
  confidence?: number;
}

// ==================== INTENT EXTRACTION (Rule-Based) ====================

function detectIntent(query: string): {
  intent: string;
  suggestedAgent: string;
  confidence: number;
  language: 'th' | 'en';
} {
  const lowerQuery = query.toLowerCase();
  const hasThai = /[\u0E00-\u0E7F]/.test(query);

  // Greeting patterns
  if (/(สวัสดี|หวัดดี|hello|hi|hey|ดีจ้า|ดีครับ)/i.test(query)) {
    return {
      intent: 'greeting',
      suggestedAgent: 'conversation',
      confidence: 0.95,
      language: hasThai ? 'th' : 'en'
    };
  }

  // Compatibility patterns
  if (/(ใส่.*ได้ไหม|ใส่.*ได้|fit|compatib|เข้ากัน|ใส่รถ.*ได้|for.*car|vehicle.*fit)/i.test(query)) {
    return {
      intent: 'compatibility_check',
      suggestedAgent: 'compatibility',
      confidence: 0.9,
      language: hasThai ? 'th' : 'en'
    };
  }

  // Price patterns
  if (/(ราคา|price|เท่าไหร่|how much|cost|ลดราคา|discount|โปรโมชั่น|promotion)/i.test(query)) {
    return {
      intent: 'price_inquiry',
      suggestedAgent: 'price_advisor',
      confidence: 0.9,
      language: hasThai ? 'th' : 'en'
    };
  }

  // Recommendation patterns
  if (/(แนะนำ|recommend|suggest|ดีที่สุด|best|ควร|ทางเลือก|alternative|option)/i.test(query)) {
    return {
      intent: 'recommendation',
      suggestedAgent: 'recommendation',
      confidence: 0.85,
      language: hasThai ? 'th' : 'en'
    };
  }

  // Availability patterns
  if (/(มีสินค้า|stock|available|มีไหม|have|หมด|out of stock)/i.test(query)) {
    return {
      intent: 'availability_check',
      suggestedAgent: 'search',
      confidence: 0.8,
      language: hasThai ? 'th' : 'en'
    };
  }

  // Thanks/closing
  if (/(ขอบคุณ|thank|thanks|พอแล้ว|that'?s all)/i.test(query)) {
    return {
      intent: 'thanks',
      suggestedAgent: 'conversation',
      confidence: 0.9,
      language: hasThai ? 'th' : 'en'
    };
  }

  // Default to search
  return {
    intent: 'search',
    suggestedAgent: 'search',
    confidence: 0.6,
    language: hasThai ? 'th' : 'en'
  };
}

// ==================== AGENT HANDLERS ====================

/**
 * Generate embedding for semantic search
 */
async function generateEmbedding(query: string): Promise<number[]> {
  const HF_API_URL = 'https://api-inference.huggingface.co/models/KoonJamesZ/nina-thai-v3';
  const HF_API_KEY = Deno.env.get('HUGGINGFACE_API_KEY') || '';

  const normalized = query
    .replace(/\u0E33\u0E33/g, '\u0E4D')
    .replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 512);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (HF_API_KEY) {
    headers['Authorization'] = `Bearer ${HF_API_KEY}`;
  }

  try {
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
  } catch (error) {
    console.error('Embedding error:', error);
    // Return zero vector as fallback
    return new Array(768).fill(0);
  }
}

/**
 * Search Agent Handler
 */
async function handleSearchAgent(request: AgentRequest, intent: any): Promise<AgentResponse> {
  const startTime = Date.now();
  const language = request.preferences?.language || intent.language;

  try {
    // Generate embedding
    const embedding = await generateEmbedding(request.query);

    // Determine catalog type
    const isTireQuery = /ยาง|tire|tyre|ล้อ|205|195|185|215/i.test(request.query);
    const catalogType = isTireQuery ? 'tires_catalog' : 'parts_catalog';

    // Perform vector search
    const embeddingStr = `[${embedding.join(',')}]`;
    const { data: searchResults, error } = await supabase.rpc('jetsetgo_semantic_search', {
      query_embedding: embeddingStr,
      match_threshold: 0.65,
      result_count: 10,
      catalog_table: catalogType,
    });

    let results = searchResults || [];

    // Fallback to keyword search if vector search fails
    if (error || results.length === 0) {
      const { data: keywordResults } = await supabase
        .from(catalogType)
        .select('*')
        .or(`part_number.ilike.%${request.query}%,part_name_th.ilike.%${request.query}%,brand.ilike.%${request.query}%`)
        .limit(10);

      results = keywordResults || [];
    }

    // Format response
    if (results.length === 0) {
      return {
        success: true,
        message: language === 'th'
          ? `😕 ไม่พบสินค้าที่ค้นหา "${request.query}"`
          : `😕 No products found for "${request.query}"`,
        data: { results: [] },
        followUpSuggestions: language === 'th'
          ? ['ลองค้นหาด้วยชื่อยี่ห้อ', 'ติดต่อเราเพื่อสอบถาม']
          : ['Try searching by brand', 'Contact us for assistance'],
        involvedAgents: ['search'],
        executionTime: Date.now() - startTime,
        intent: intent.intent,
        confidence: 0.4
      };
    }

    const items = results.slice(0, 5).map((r: any) => {
      const name = language === 'th'
        ? (r.part_name_th || r.part_name_en || 'N/A')
        : (r.part_name_en || r.part_name_th || 'N/A');
      const stock = r.stock_quantity || r.stock || 0;
      const stockStatus = stock > 0
        ? (language === 'th' ? '✅ มีสินค้า' : '✅ In Stock')
        : (language === 'th' ? '❌ หมด' : '❌ Out of Stock');
      const price = r.price
        ? (language === 'th' ? `ราคา ${r.price} บาท` : `Price: ${r.price} THB`)
        : '';

      return `${r.part_number || 'N/A'} - ${name}\n   ${r.brand || 'N/A'}\n   ${price}\n   ${stockStatus}`;
    }).join('\n\n');

    const message = language === 'th'
      ? `🔍 พบ ${results.length} รายการ\n\n${items}`
      : `🔍 Found ${results.length} items\n\n${items}`;

    return {
      success: true,
      message,
      data: { results, count: results.length },
      followUpSuggestions: language === 'th'
        ? ['ดูรายละเอียดเพิ่มเติม', 'เช็คความเข้ากันกับรถ', 'สอบถามราคาพิเศษ']
        : ['View more details', 'Check vehicle compatibility', 'Ask about special offers'],
      involvedAgents: ['search'],
      executionTime: Date.now() - startTime,
      intent: intent.intent,
      confidence: 0.85
    };

  } catch (error) {
    console.error('[SearchAgent] Error:', error);
    return {
      success: false,
      message: language === 'th'
        ? '😕 การค้นหาล้มเหลว กรุณาลองใหม่'
        : '😕 Search failed, please try again',
      involvedAgents: ['search'],
      executionTime: Date.now() - startTime,
      intent: intent.intent,
      confidence: 0
    };
  }
}

/**
 * Compatibility Agent Handler
 */
async function handleCompatibilityAgent(request: AgentRequest, intent: any): Promise<AgentResponse> {
  const startTime = Date.now();
  const language = request.preferences?.language || intent.language;

  // Extract vehicle info from query
  const vehicleInfo = request.vehicleContext || extractVehicleInfo(request.query);

  if (!vehicleInfo.make) {
    return {
      success: true,
      message: language === 'th'
        ? '🚗 เพื่อตรวจสอบความเข้ากันได้ กรุณาระบุยี่ห้อและรุ่นรถ\n\nเช่น: Toyota Vios ปี 2020'
        : '🚗 To check compatibility, please specify your vehicle make and model\n\nExample: Toyota Vios 2020',
      data: { needsVehicleInfo: true },
      followUpSuggestions: [],
      involvedAgents: ['compatibility'],
      executionTime: Date.now() - startTime,
      intent: intent.intent,
      confidence: 0.5
    };
  }

  const vehicleStr = language === 'th'
    ? `${vehicleInfo.make} ${vehicleInfo.model} ${vehicleInfo.year ? `ปี ${vehicleInfo.year}` : ''}`
    : `${vehicleInfo.make} ${vehicleInfo.model} ${vehicleInfo.year || ''}`;

  // Check compatibility database
  const { data: compatData } = await supabase
    .from('vehicle_compatibility')
    .select('*')
    .ilike('make', `%${vehicleInfo.make}%`)
    .limit(10);

  if (!compatData || compatData.length === 0) {
    return {
      success: true,
      message: language === 'th'
        ? `🚗 ตรวจสอบความเข้ากันได้สำหรับ ${vehicleStr}\n\n❌ ไม่พบข้อมูลความเข้ากันได้โดยตรง\n\n💡 แนะนำ: หากไม่มั่นใจ สามารถส่งรูปซีลีย์หรือเลขตัวถังมาให้เราตรวจสอบได้ครับ`
        : `🚗 Compatibility Check for ${vehicleStr}\n\n❌ No direct compatibility data found\n\n💡 Tip: If unsure, send us a photo of the seal or engine number for verification`,
      data: { vehicleInfo },
      followUpSuggestions: language === 'th'
        ? ['ดูอะไหล่ที่เหมาะสมกับรถคันนี้', 'ติดต่อเจ้าหน้าที่']
        : ['View parts suitable for this vehicle', 'Contact our staff'],
      involvedAgents: ['compatibility'],
      executionTime: Date.now() - startTime,
      intent: intent.intent,
      confidence: 0.7
    };
  }

  // Format compatible parts
  const compatibleParts = compatData
    .filter((row: any) => {
      const makeMatch = row.make.toLowerCase() === vehicleInfo.make?.toLowerCase();
      const modelMatch = !vehicleInfo.model || row.model.toLowerCase() === vehicleInfo.model?.toLowerCase();
      return makeMatch && modelMatch;
    })
    .slice(0, 5);

  const partsList = compatibleParts.map((row: any) =>
    `✅ ${row.part_number}: ${row.make} ${row.model}`
  ).join('\n');

  return {
    success: true,
    message: language === 'th'
      ? `🚗 ผลการตรวจสอบความเข้ากันได้สำหรับ ${vehicleStr}\n\n${partsList}\n\n💡 แนะนำ: หากไม่มั่นใจ สามารถส่งรูปซีลีย์มาให้เราตรวจสอบได้ครับ`
      : `🚗 Compatibility Check for ${vehicleStr}\n\n${partsList}\n\n💡 Tip: Send us a photo of the seal for verification`,
    data: { vehicleInfo, compatibleParts },
    followUpSuggestions: language === 'th'
      ? ['ดูอะไหล่ที่เหมาะสมกับรถคันนี้', 'สอบถามราคาพร้อมติดตั้ง']
      : ['View parts suitable for this vehicle', 'Ask about installed price'],
    involvedAgents: ['compatibility'],
    executionTime: Date.now() - startTime,
    intent: intent.intent,
    confidence: 0.9
  };
}

/**
 * Recommendation Agent Handler
 */
async function handleRecommendationAgent(request: AgentRequest, intent: any): Promise<AgentResponse> {
  const startTime = Date.now();
  const language = request.preferences?.language || intent.language;

  // Get base results from context or search
  let baseResults = request.contextData?.searchResults || [];

  if (baseResults.length === 0) {
    // Do a quick search
    const embedding = await generateEmbedding(request.query);
    const embeddingStr = `[${embedding.join(',')}]`;

    const { data } = await supabase.rpc('jetsetgo_semantic_search', {
      query_embedding: embeddingStr,
      match_threshold: 0.6,
      result_count: 5,
      catalog_table: 'parts_catalog',
    });

    baseResults = data || [];
  }

  if (baseResults.length === 0) {
    return {
      success: true,
      message: language === 'th'
        ? '😕 ขออภัย ไม่พบทางเลือกแนะนำสำหรับสินค้านี้'
        : '😕 Sorry, no recommendations found for this product',
      data: {},
      followUpSuggestions: [],
      involvedAgents: ['recommendation'],
      executionTime: Date.now() - startTime,
      intent: intent.intent,
      confidence: 0.4
    };
  }

  // Get alternatives (different brands)
  const baseItem = baseResults[0];
  const { data: alternatives } = await supabase
    .from('parts_catalog')
    .select('*')
    .eq('category', baseItem.category)
    .neq('brand', baseItem.brand)
    .gt('stock_quantity', 0)
    .order('price', { ascending: false })
    .limit(3);

  const message = language === 'th'
    ? `💡 ทางเลือกอื่นที่แนะนำ:\n\n` +
      (alternatives?.map((r: any, i: number) =>
        `${i + 1}. ${r.part_number} - ${r.part_name_th || r.part_name_en}\n` +
        `   ${r.brand}\n` +
        `   ${r.price ? `ราคา ${r.price} บาท` : ''}`
      ).join('\n\n') || 'ไม่พบทางเลือกอื่น')
    : `💡 Other Options:\n\n` +
      (alternatives?.map((r: any, i: number) =>
        `${i + 1}. ${r.part_number} - ${r.part_name_en || r.part_name_th}\n` +
        `   ${r.brand}\n` +
        `   ${r.price ? `Price: ${r.price} THB` : ''}`
      ).join('\n\n') || 'No other options found');

  return {
    success: true,
    message,
    data: { alternatives },
    followUpSuggestions: language === 'th'
      ? ['ดูรายละเอียดเพิ่มเติม', 'เปรียบเทียบราคา']
      : ['View more details', 'Compare prices'],
    involvedAgents: ['recommendation'],
    executionTime: Date.now() - startTime,
    intent: intent.intent,
    confidence: 0.85
  };
}

/**
 * Price Advisor Agent Handler
 */
async function handlePriceAdvisorAgent(request: AgentRequest, intent: any): Promise<AgentResponse> {
  const startTime = Date.now();
  const language = request.preferences?.language || intent.language;

  // Get base results or search
  let baseResults = request.contextData?.searchResults || [];

  if (baseResults.length === 0) {
    const embedding = await generateEmbedding(request.query);
    const embeddingStr = `[${embedding.join(',')}]`;

    const { data } = await supabase.rpc('jetsetgo_semantic_search', {
      query_embedding: embeddingStr,
      match_threshold: 0.6,
      result_count: 10,
      catalog_table: 'parts_catalog',
    });

    baseResults = (data || []).filter((r: any) => r.price !== null);
  }

  const withPrice = baseResults.filter((r: any) => r.price !== null && r.price !== undefined);

  if (withPrice.length === 0) {
    return {
      success: true,
      message: language === 'th'
        ? '💰 ข้อมูลราคา\n\n😕 ไม่พบข้อมูลราคาสำหรับสินค้าที่ค้นหา\n\n💡 กรุณาติดต่อเราเพื่อสอบถามราคา'
        : '💰 Pricing Information\n\n😕 No pricing data found for the searched items\n\n💡 Please contact us for pricing',
      data: {},
      followUpSuggestions: language === 'th'
        ? ['ติดต่อเรา', 'สอบถาม Line']
        : ['Contact us', 'Ask on LINE'],
      involvedAgents: ['price_advisor'],
      executionTime: Date.now() - startTime,
      intent: intent.intent,
      confidence: 0.5
    };
  }

  const prices = withPrice.map((r: any) => r.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const avgPrice = Math.round(prices.reduce((a: number, b: number) => a + b, 0) / prices.length);

  const itemsList = withPrice.slice(0, 5).map((r: any) =>
    `• ${r.part_number || 'N/A'} - ${r.part_name_th || r.part_name_en || 'N/A'}\n` +
    `  ${r.brand || 'N/A'} - ${r.price} บาท`
  ).join('\n\n');

  const message = language === 'th'
    ? `💰 ข้อมูลราคา\n\n` +
      `• ราคาเฉลี่ย: ${avgPrice} บาท\n` +
      `• ช่วงราคา: ${minPrice} - ${maxPrice} บาท\n\n` +
      `รายการสินค้า:\n\n${itemsList}`
    : `💰 Pricing Information\n\n` +
      `• Average: ${avgPrice} THB\n` +
      `• Range: ${minPrice} - ${maxPrice} THB\n\n` +
      `Items:\n\n${itemsList}`;

  return {
    success: true,
    message,
    data: { avgPrice, minPrice, maxPrice, itemCount: withPrice.length },
    followUpSuggestions: language === 'th'
      ? ['ดูรายละเอียดเพิ่มเติม', 'เช็คโปรโมชั่น']
      : ['View more details', 'Check promotions'],
    involvedAgents: ['price_advisor'],
    executionTime: Date.now() - startTime,
    intent: intent.intent,
    confidence: 0.9
  };
}

/**
 * Conversation Agent Handler
 */
async function handleConversationAgent(request: AgentRequest, intent: any): Promise<AgentResponse> {
  const startTime = Date.now();
  const language = request.preferences?.language || intent.language;

  const responses: Record<string, { th: string; en: string }> = {
    'greeting': {
      th: `👋 สวัสดีครับ! ยินดีต้อนรับสู่ JETSETGO

🤖 ผมคือผู้ช่วย AI ที่จะช่วยคุณค้นหาอะไหล่รถยนต์และยางรถยนต์

💬 คุณสามารถถามผมได้ว่า:
• ค้นหาอะไหล่จากชื่อหรือ Part Number
• เช็คความเข้ากันกับรถของคุณ
• สอบถามราคาและโปรโมชั่น
• ขอคำแนะนำและทางเลือกอื่น

🚗 ต้องการให้ช่วยอะไรดีครับ?`,
      en: `👋 Hello! Welcome to JETSETGO

🤖 I'm your AI assistant for auto parts and tire catalog search.

💬 You can ask me about:
• Search parts by name or Part Number
• Check compatibility with your vehicle
• Pricing and promotions
• Recommendations and alternatives

🚗 How can I help you today?`
    },
    'thanks': {
      th: `🙏 ยินดีครับ! มีอะไรให้ช่วยอีกไหม?

💡 ลองถามเกี่ยวกับ:
• อะไหล่ที่ต้องการ
• ความเข้ากันได้กับรถ
• ราคาและโปรโมชั่น`,
      en: `🙏 You're welcome! Is there anything else I can help you with?

💡 You can ask about:
• Parts you're looking for
• Vehicle compatibility
• Pricing and promotions`
    },
    'help': {
      th: `🔍 วิธีการใช้งาน JETSETGO:

1️⃣ ค้นหาอะไหล่ - พิมพ์ชื่ออะไหล่หรือ Part Number
2️⃣ เช็คความเข้ากัน - บอกยี่ห้อและรุ่นรถ
3️⃣ สอบถามราคา - ถาม "ราคาเท่าไหร่"
4️⃣ ขอแนะนำ - ถาม "แนะนำยี่ห้อที่ดี"

👇 ลองพิมพ์คำถามของคุณได้เลยครับ!`,
      en: `🔍 How to use JETSETGO:

1️⃣ Search parts - Type part name or Part Number
2️⃣ Check compatibility - Tell me your vehicle make and model
3️⃣ Ask about pricing - Ask "How much?"
4️⃣ Get recommendations - Ask "Which brand is best?"

👇 Go ahead and ask your question!`
    },
    'default': {
      th: `😕 ไม่แน่ใจว่าคุณต้องการอะไรครับ

ลอง:
• ค้นหาอะไหล่ด้วยชื่อหรือ Part Number
• เช็คความเข้ากันกับรถ
• สอบถามราคา

หรือพิมพ์ "ช่วยเหลือ" เพื่อดูวิธีใช้งาน`,
      en: `😕 I'm not sure what you need. Try:
• Search parts by name or Part Number
• Check vehicle compatibility
• Ask about pricing

Or type "help" to see usage instructions`
    }
  };

  const response = responses[intent.intent] || responses['default'];

  return {
    success: true,
    message: response[language],
    data: {},
    followUpSuggestions: language === 'th'
      ? ['ค้นหาอะไหล่', 'เช็คความเข้ากัน', 'สอบถามราคา']
      : ['Search parts', 'Check compatibility', 'Ask pricing'],
    involvedAgents: ['conversation'],
    executionTime: Date.now() - startTime,
    intent: intent.intent,
    confidence: 0.9
  };
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Extract vehicle info from query
 */
function extractVehicleInfo(query: string): {
  make?: string;
  model?: string;
  year?: number;
} {
  const vehicleInfo: { make?: string; model?: string; year?: number } = {};

  const makes = [
    'Toyota', 'Honda', 'Nissan', 'Mazda', 'Mitsubishi', 'Ford', 'Isuzu',
    'Suzuki', 'Daihatsu', 'Subaru', 'BMW', 'Mercedes', 'Audi', 'Volkswagen',
    'โตโยต้า', 'ฮอนด้า', 'นิสสัน', 'มาสด้า', 'มิตซูบิชิ', 'ฟอร์ด'
  ];

  const lowerQuery = query.toLowerCase();
  for (const make of makes) {
    if (lowerQuery.includes(make.toLowerCase())) {
      vehicleInfo.make = make;
      break;
    }
  }

  const modelPatterns = [
    { pattern: /city|ซิตี้/i, model: 'City' },
    { pattern: /vios|วิออส/i, model: 'Vios' },
    { pattern: /altis|อัลติส/i, model: 'Altis' },
    { pattern: /camry|แคมรี่/i, model: 'Camry' },
    { pattern: /yaris|ยาริส/i, model: 'Yaris' },
    { pattern: /jazz|แจ๊ส/i, model: 'Jazz' },
    { pattern: /civic|ซีวิค/i, model: 'Civic' },
    { pattern: /accord|อัคคอร์ด/i, model: 'Accord' }
  ];

  for (const { pattern, model } of modelPatterns) {
    if (pattern.test(query)) {
      vehicleInfo.model = model;
      break;
    }
  }

  const yearMatch = query.match(/(?:ปี|year)?\s*(\d{4})/i);
  if (yearMatch) {
    const year = parseInt(yearMatch[1]);
    if (year >= 1980 && year <= new Date().getFullYear() + 1) {
      vehicleInfo.year = year;
    }
  }

  return vehicleInfo;
}

/**
 * Generate session ID if not provided
 */
function generateSessionId(): string {
  return `sess-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
    const request: AgentRequest = await req.json();

    // Validate request
    if (!request.query || request.query.trim().length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Query is required'
        } as AgentResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Generate session ID if not provided
    if (!request.sessionId) {
      request.sessionId = generateSessionId();
    }

    // Detect intent
    const intent = detectIntent(request.query);

    console.log('[AgentOrchestrator] Query:', request.query);
    console.log('[AgentOrchestrator] Intent:', intent);

    // Route to appropriate agent
    let response: AgentResponse;

    switch (intent.suggestedAgent) {
      case 'search':
        response = await handleSearchAgent(request, intent);
        break;

      case 'compatibility':
        response = await handleCompatibilityAgent(request, intent);
        break;

      case 'recommendation':
        response = await handleRecommendationAgent(request, intent);
        break;

      case 'price_advisor':
        response = await handlePriceAdvisorAgent(request, intent);
        break;

      case 'conversation':
      default:
        response = await handleConversationAgent(request, intent);
        break;
    }

    // Log the interaction
    try {
      await supabase.from('agent_logs').insert({
        session_id: request.sessionId,
        user_id: request.userId,
        query: request.query,
        intent: intent.intent,
        agent: intent.suggestedAgent,
        language: intent.language,
        confidence: intent.confidence,
        execution_time: response.executionTime,
        success: response.success,
        metadata: {
          involved_agents: response.involvedAgents,
          follow_up_suggestions: response.followUpSuggestions
        }
      });
    } catch (logError) {
      console.error('[AgentOrchestrator] Failed to log:', logError);
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[AgentOrchestrator] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error',
        message: '😕 เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        involvedAgents: [],
        executionTime: Date.now() - startTime
      } as AgentResponse),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
