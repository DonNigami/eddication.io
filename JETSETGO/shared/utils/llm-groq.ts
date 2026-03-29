/**
 * JETSETGO - LLM Integration with Groq FREE API
 * Uses Llama 3.1 8B via Groq (1 request/sec limit, but FREE)
 */

// Groq API configuration
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GroqOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface GroqResponse {
  content: string;
  finishReason: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// Thai system prompt for JETSETGO
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
ให้ตอบอย่างเป็นธรรมชาติเหมือนพนักงานขายที่เป็นมิตร
ใช้ bullet points หากมีหลายรายการ
จบด้วยคำถามเพื่อให้ลูกค้าตัดสินใจ`;

// English system prompt for JETSETGO
const ENGLISH_SYSTEM_PROMPT = `You are an AI assistant for the JETSETGO automotive parts and tire catalog search system.

Your responsibilities:
1. Answer questions about automotive parts and tires
2. Recommend parts suitable for the customer's vehicle
3. Provide inventory status and pricing information
4. Explain product features and pros/cons
5. Check vehicle compatibility

Response guidelines:
- Be friendly and easy to understand
- Always reference part numbers when recommending parts
- Inform inventory status (in stock/out of stock/special order)
- If exact match not found, suggest alternatives
- Never modify specification data from the database
- Display prices in Thai Baht (THB)
- For non-automotive questions, politely redirect

Response style:
- Be natural and conversational like a friendly salesperson
- Use bullet points for multiple items
- End with a question to help the customer decide`;

/**
 * Generate a response using Groq FREE API
 */
export async function generateGroqResponse(
  messages: GroqMessage[],
  apiKey: string,
  options: GroqOptions = {}
): Promise<GroqResponse> {
  const {
    model = 'llama-3.1-8b-instant', // Fast, free model
    temperature = 0.3,
    maxTokens = 1024,
    topP = 0.9
  } = options;

  if (!apiKey) {
    throw new Error('Groq API key is required. Get yours free at groq.com');
  }

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Groq API request failed');
    }

    const data = await response.json();

    return {
      content: data.choices[0].message.content,
      finishReason: data.choices[0].finish_reason,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      }
    };

  } catch (error) {
    console.error('Groq API error:', error);
    throw error;
  }
}

/**
 * Generate RAG response for Thai queries
 */
export async function generateThaiRAGResponse(
  query: string,
  context: string,
  apiKey: string,
  language: 'th' | 'en' = 'th',
  options: GroqOptions = {}
): Promise<string> {
  const systemPrompt = language === 'th' ? THAI_SYSTEM_PROMPT : ENGLISH_SYSTEM_PROMPT;

  const userContent = language === 'th'
    ? `คำถามจากลูกค้า: ${query}\n\nข้อมูลอะไหล่จากระบบ:\n${context}\n\nกรุณาตอบคำถามโดยใช้ข้อมูลข้างต้น หากข้อมูลไม่เพียงพอให้บอกลูกค้าด้วย`
    : `Customer question: ${query}\n\nProduct data from system:\n${context}\n\nPlease answer using the above data. If data is insufficient, please inform the customer.`;

  const messages: GroqMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent }
  ];

  const response = await generateGroqResponse(messages, apiKey, options);
  return response.content;
}

/**
 * Generate RAG response with conversation history
 */
export async function generateRAGResponseWithHistory(
  query: string,
  context: string,
  conversationHistory: GroqMessage[],
  apiKey: string,
  language: 'th' | 'en' = 'th',
  options: GroqOptions = {}
): Promise<{ response: string; updatedMessages: GroqMessage[] }> {
  const systemPrompt = language === 'th' ? THAI_SYSTEM_PROMPT : ENGLISH_SYSTEM_PROMPT;

  const userContent = language === 'th'
    ? `คำถามจากลูกค้า: ${query}\n\nข้อมูลอะไหล่จากระบบ:\n${context}`
    : `Customer question: ${query}\n\nProduct data from system:\n${context}`;

  // Build messages with history
  const messages: GroqMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-10), // Keep last 10 messages for context
    { role: 'user', content: userContent }
  ];

  const response = await generateGroqResponse(messages, apiKey, options);

  // Add assistant response to history
  const updatedMessages = [
    ...conversationHistory,
    { role: 'user', content: query },
    { role: 'assistant', content: response.content }
  ];

  return {
    response: response.content,
    updatedMessages
  };
}

/**
 * Extract intent from user query
 */
export interface IntentExtraction {
  intent: 'search' | 'compatibility' | 'price_inquiry' | 'availability' | 'general';
  entities: {
    partNumbers?: string[];
    brands?: string[];
    vehicleInfo?: {
      make?: string;
      model?: string;
      year?: number;
    };
    tireSize?: string;
  };
  language: 'th' | 'en';
}

export async function extractIntent(
  query: string,
  apiKey: string
): Promise<IntentExtraction> {
  const prompt = `Extract the intent and entities from this customer query for an auto parts catalog.

Query: "${query}"

Respond in JSON format:
{
  "intent": "search|compatibility|price_inquiry|availability|general",
  "entities": {
    "partNumbers": ["string"],
    "brands": ["string"],
    "vehicleInfo": {"make": "string", "model": "string", "year": number},
    "tireSize": "string"
  },
  "language": "th|en"
}

Only include entities that are explicitly mentioned in the query.`;

  try {
    const response = await generateGroqResponse(
      [
        { role: 'system', content: 'You are a helpful assistant that extracts structured data from text. Always respond with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      apiKey,
      { temperature: 0.1, maxTokens: 500 }
    );

    // Parse JSON from response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // Fallback if JSON parsing fails
    return {
      intent: 'general',
      entities: {},
      language: query.match(/[\u0E00-\u0E7F]/) ? 'th' : 'en'
    };

  } catch (error) {
    console.error('Intent extraction error:', error);
    return {
      intent: 'general',
      entities: {},
      language: query.match(/[\u0E00-\u0E7F]/) ? 'th' : 'en'
    };
  }
}

/**
 * Generate follow-up suggestions based on conversation
 */
export async function generateFollowUpSuggestions(
  lastQuery: string,
  lastResults: number,
  apiKey: string,
  language: 'th' | 'en' = 'th'
): Promise<string[]> {
  const prompt = language === 'th'
    ? `ลูกค้าเพิ่งค้นหา "${lastQuery}" และพบ ${lastResults} รายการ
แนะนำคำถามต่อไปที่ลูกค้าอาจสนใจ 3-4 คำถาม
ตอบเป็น list เท่านั้น เช่น:
1. คำถามที่ 1
2. คำถามที่ 2
3. คำถามที่ 3`
    : `Customer just searched for "${lastQuery}" and found ${lastResults} results
Suggest 3-4 follow-up questions the customer might be interested in.
Respond as a list only, e.g.:
1. Question 1
2. Question 2
3. Question 3`;

  try {
    const response = await generateGroqResponse(
      [
        { role: 'system', content: 'You are a helpful sales assistant.' },
        { role: 'user', content: prompt }
      ],
      apiKey,
      { temperature: 0.5, maxTokens: 200 }
    );

    // Parse suggestions from response
    const suggestions = response.content
      .split('\n')
      .filter(line => line.trim())
      .map(line => line.replace(/^\d+[\.\)]\s*/, '').trim())
      .filter(s => s.length > 0);

    return suggestions.slice(0, 4);

  } catch (error) {
    console.error('Follow-up generation error:', error);
    return [];
  }
}

/**
 * Format search results for LLM context
 */
export interface SearchResult {
  part_number: string;
  part_name_th?: string;
  part_name_en?: string;
  description?: string;
  brand?: string;
  category?: string;
  price?: number;
  stock_quantity?: number;
  similarity?: number;
}

export function formatResultsForContext(
  results: SearchResult[],
  language: 'th' | 'en' = 'th',
  maxResults: number = 5
): string {
  const topResults = results.slice(0, maxResults);

  if (topResults.length === 0) {
    return language === 'th'
      ? 'ไม่พบอะไหล่ที่ตรงกับการค้นหา'
      : 'No parts found matching the search criteria';
  }

  const formatted = topResults.map((r, i) => {
    const parts: string[] = [];

    parts.push(`${i + 1}. ${language === 'th' ? 'รหัสสินค้า' : 'Part Number'}: ${r.part_number}`);

    if (language === 'th') {
      if (r.part_name_th) parts.push(`   ชื่อ (ไทย): ${r.part_name_th}`);
      if (r.part_name_en) parts.push(`   ชื่อ (อังกฤษ): ${r.part_name_en}`);
      if (r.brand) parts.push(`   แบรนด์: ${r.brand}`);
      if (r.category) parts.push(`   หมวดหมู่: ${r.category}`);
      if (r.price) parts.push(`   ราคา: ${r.price} บาท`);
      if (r.stock_quantity !== undefined) {
        parts.push(`   สถานะคลัง: ${r.stock_quantity > 0 ? `มีสินค้า (${r.stock_quantity} ชิ้น)` : 'หมด'}`);
      }
    } else {
      if (r.part_name_en) parts.push(`   Name (EN): ${r.part_name_en}`);
      if (r.part_name_th) parts.push(`   Name (TH): ${r.part_name_th}`);
      if (r.brand) parts.push(`   Brand: ${r.brand}`);
      if (r.category) parts.push(`   Category: ${r.category}`);
      if (r.price) parts.push(`   Price: ${r.price} THB`);
      if (r.stock_quantity !== undefined) {
        parts.push(`   Stock: ${r.stock_quantity > 0 ? `In stock (${r.stock_quantity})` : 'Out of stock'}`);
      }
    }

    return parts.join('\n');
  });

  return formatted.join('\n\n');
}

/**
 * Groq rate limit handler (1 request/second for free tier)
 */
class RateLimiter {
  private lastRequestTime = 0;
  private minInterval = 1000; // 1 second

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }
}

// Export singleton rate limiter
export const groqRateLimiter = new RateLimiter();

/**
 * Generate response with automatic rate limit handling
 */
export async function generateGroqResponseWithRateLimit(
  messages: GroqMessage[],
  apiKey: string,
  options: GroqOptions = {}
): Promise<GroqResponse> {
  await groqRateLimiter.waitIfNeeded();
  return generateGroqResponse(messages, apiKey, options);
}
