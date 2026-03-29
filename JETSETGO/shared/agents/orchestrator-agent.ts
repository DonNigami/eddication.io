/**
 * JETSETGO - Orchestrator Agent
 * Routes user queries to appropriate specialist agents
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type {
  AgentCapability,
  AgentContext,
  AgentCoordinationResult,
  AgentResponse,
  AgentTask,
  AgentType,
  ExtractedIntent,
  IntentType
} from './agent-types.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== ORCHESTRATOR AGENT ====================

export class OrchestratorAgent {
  private agents: Map<AgentType, AgentCapability> = new Map();
  private taskQueue: AgentTask[] = [];
  private activeTasks: Map<string, AgentTask> = new Map();

  /**
   * Register an agent capability
   */
  registerAgent(agentType: AgentType, capability: AgentCapability): void {
    this.agents.set(agentType, capability);
  }

  /**
   * Process user query through the agent system
   */
  async processQuery(
    query: string,
    context: AgentContext
  ): Promise<AgentCoordinationResult> {
    const startTime = Date.now();
    const involvedAgents: AgentType[] = [];
    const taskHistory: AgentTask[] = [];

    try {
      // Step 1: Extract intent from query
      const intent = await this.extractIntent(query, context);
      console.log('[Orchestrator] Extracted intent:', intent);

      // Step 2: Select primary agent based on intent
      const primaryAgentType = intent.suggestedAgent;
      involvedAgents.push(primaryAgentType);

      // Step 3: Execute primary agent
      const primaryTask = await this.createTask(
        primaryAgentType,
        query,
        context,
        1 // Highest priority
      );

      this.activeTasks.set(primaryTask.id, primaryTask);
      const primaryResult = await this.executeTask(primaryTask);
      taskHistory.push(primaryTask);

      // Step 4: Determine if secondary agents are needed
      const secondaryAgents = this.selectSecondaryAgents(intent, primaryResult);

      // Step 5: Execute secondary agents in parallel
      const secondaryResponses: AgentResponse[] = [];

      if (secondaryAgents.length > 0) {
        const secondaryTasks = await Promise.all(
          secondaryAgents.map(agentType =>
            this.createTask(agentType, query, context, 2)
          )
        );

        for (const task of secondaryTasks) {
          this.activeTasks.set(task.id, task);
        }

        const secondaryResults = await Promise.allSettled(
          secondaryTasks.map(task => this.executeTask(task))
        );

        secondaryResults.forEach((result, index) => {
          taskHistory.push(secondaryTasks[index]);
          if (result.status === 'fulfilled') {
            secondaryResponses.push(result.value);
            involvedAgents.push(secondaryTasks[index].agentType);
          }
        });
      }

      // Step 6: Synthesize final response
      const finalResponse = this.synthesizeResponse(
        primaryResult,
        secondaryResponses,
        intent
      );

      // Step 7: Update conversation context
      await this.updateConversationContext(
        context.sessionId,
        query,
        finalResponse,
        intent
      );

      const totalExecutionTime = Date.now() - startTime;

      return {
        primaryResponse: finalResponse,
        secondaryResponses: secondaryResponses.length > 0 ? secondaryResponses : undefined,
        taskHistory,
        totalExecutionTime,
        involvedAgents
      };

    } catch (error) {
      console.error('[Orchestrator] Error processing query:', error);

      // Return fallback response
      return {
        primaryResponse: {
          success: false,
          message: this.getFallbackMessage(context),
          agentName: 'Orchestrator',
          confidence: 0,
          needsHumanIntervention: true
        },
        taskHistory,
        totalExecutionTime: Date.now() - startTime,
        involvedAgents
      };
    }
  }

  /**
   * Extract intent from user query using LLM
   */
  private async extractIntent(
    query: string,
    context: AgentContext
  ): Promise<ExtractedIntent> {
    // If no Groq API key, use rule-based extraction
    if (!GROQ_API_KEY) {
      return this.ruleBasedIntentExtraction(query, context);
    }

    try {
      const prompt = this.buildIntentExtractionPrompt(query, context);
      const response = await this.callGroqAPI(prompt);

      return this.parseIntentResponse(response, query);

    } catch (error) {
      console.error('[Orchestrator] Intent extraction error, falling back to rules:', error);
      return this.ruleBasedIntentExtraction(query, context);
    }
  }

  /**
   * Build prompt for intent extraction
   */
  private buildIntentExtractionPrompt(query: string, context: AgentContext): string {
    const vehicleInfo = context.vehicleContext
      ? `Vehicle: ${context.vehicleContext.make} ${context.vehicleContext.model} ${context.vehicleContext.year || ''}`
      : 'Vehicle: Not specified';

    const history = context.conversationHistory
      .slice(-3)
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    return `You are an intent classifier for an auto parts catalog system.

Previous conversation:
${history || 'No previous messages'}

Current user query: "${query}"

${vehicleInfo}

Classify the intent and extract entities. Respond in JSON format:
{
  "intent": "search|compatibility_check|price_inquiry|availability_check|recommendation|comparison|technical_spec|general_inquiry|order_request|complaint|greeting|unknown",
  "confidence": 0.0-1.0,
  "entities": {
    "partNumbers": ["string"],
    "brands": ["string"],
    "vehicleInfo": {"make": "string", "model": "string", "year": number},
    "tireSize": "string",
    "priceRange": {"min": number, "max": number},
    "categories": ["string"],
    "oemNumbers": ["string"]
  },
  "language": "th|en",
  "requiresContext": true/false,
  "suggestedAgent": "search|compatibility|recommendation|price_advisor|conversation|technical_spec"
}

Important:
- If user mentions a specific vehicle, extract make/model/year
- If user asks about fitment/compatibility, use "compatibility_check"
- If user asks for recommendations/better options, use "recommendation"
- If user asks about price/deals, use "price_inquiry"
- For Thai queries, detect "language": "th"
- Only include entities that are explicitly mentioned`;
  }

  /**
   * Call Groq API for intent extraction
   */
  private async callGroqAPI(prompt: string): Promise<string> {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that always responds with valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '{}';
  }

  /**
   * Parse intent response from LLM
   */
  private parseIntentResponse(response: string, query: string): ExtractedIntent {
    try {
      const parsed = JSON.parse(response);

      // Validate and normalize the response
      return {
        intent: this.validateIntent(parsed.intent),
        confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
        entities: {
          partNumbers: parsed.entities?.partNumbers || [],
          brands: parsed.entities?.brands || [],
          vehicleInfo: parsed.entities?.vehicleInfo || undefined,
          tireSize: parsed.entities?.tireSize || undefined,
          priceRange: parsed.entities?.priceRange || undefined,
          categories: parsed.entities?.categories || [],
          oemNumbers: parsed.entities?.oemNumbers || []
        },
        language: parsed.language || (query.match(/[\u0E00-\u0E7F]/) ? 'th' : 'en'),
        requiresContext: parsed.requiresContext || false,
        suggestedAgent: this.validateAgentType(parsed.suggestedAgent)
      };
    } catch (error) {
      console.error('[Orchestrator] Failed to parse intent response:', error);
      return this.ruleBasedIntentExtraction(query, { sessionId: '' });
    }
  }

  /**
   * Rule-based intent extraction (fallback)
   */
  private ruleBasedIntentExtraction(query: string, context: AgentContext): ExtractedIntent {
    const lowerQuery = query.toLowerCase();
    const thaiQuery = query;

    // Detect language
    const hasThai = /[\u0E00-\u0E7F]/.test(query);
    const language: 'th' | 'en' = hasThai ? 'th' : 'en';

    // Intent detection patterns
    const intentPatterns: Array<{ pattern: RegExp; intent: IntentType; agent: AgentType }> = [
      // Compatibility patterns
      [/(ใส่.*ได้ไหม|ใส่.*ได้|fit|compatib|เข้ากัน|compatible)/i, IntentType.COMPATIBILITY_CHECK, AgentType.COMPATIBILITY],
      [/(ใส่รถ.*ได้ไหม|สำหรับรถ|for.*car|vehicle.*fit)/i, IntentType.COMPATIBILITY_CHECK, AgentType.COMPATIBILITY],

      // Price inquiry patterns
      [/(ราคา|price|เท่าไหร่|how much|cost|ราคาเท่าไร)/i, IntentType.PRICE_INQUIRY, AgentType.PRICE_ADVISOR],
      [/(ลดราคา|discount|โปรโมชั่น|promotion|deals|แถม|free)/i, IntentType.PRICE_INQUIRY, AgentType.PRICE_ADVISOR],

      // Availability patterns
      [/(มีสินค้า|stock|available|มีไหม|have|หมด|out of stock|เหลือ)/i, IntentType.AVAILABILITY_CHECK, AgentType.SEARCH],

      // Recommendation patterns
      [/(แนะนำ|recommend|suggest|ดีที่สุด|best|top|ควร|should)/i, IntentType.RECOMMENDATION, AgentType.RECOMMENDATION],
      [/(ทางเลือก|alternative|option|ตัวอื่น|other)/i, IntentType.RECOMMENDATION, AgentType.RECOMMENDATION],

      // Technical spec patterns
      [/(สเปก|spec|specification|ขนาด|size|น้ำหนัก|weight|dimension)/i, IntentType.TECHNICAL_SPEC, AgentType.TECHNICAL_SPEC],

      // Comparison patterns
      [/(เปรียบเทียบ|compare|versus|vs|กับ.*แบบไหนดี|difference|ต่าง)/i, IntentType.COMPARISON, AgentType.RECOMMENDATION],

      // Order patterns
      [/(สั่ง|order|buy|ซื้อ|จอง|reserve|ขอเบอร์)/i, IntentType.ORDER_REQUEST, AgentType.SEARCH],
    ];

    // Check patterns
    for (const [pattern, intent, agent] of intentPatterns) {
      if (pattern.test(query)) {
        return {
          intent,
          confidence: 0.8,
          entities: this.extractEntities(query, language),
          language,
          requiresContext: intent === IntentType.COMPARISON || intent === IntentType.RECOMMENDATION,
          suggestedAgent: agent
        };
      }
    }

    // Greeting detection
    if (/(สวัสดี|หวัดดี|hello|hi|hey|ขอบคุณ|thank|ทดสอบ|test)/i.test(query)) {
      return {
        intent: IntentType.GREETING,
        confidence: 0.9,
        entities: {},
        language,
        requiresContext: false,
        suggestedAgent: AgentType.CONVERSATION
      };
    }

    // Default to search
    return {
      intent: IntentType.SEARCH,
      confidence: 0.6,
      entities: this.extractEntities(query, language),
      language,
      requiresContext: false,
      suggestedAgent: AgentType.SEARCH
    };
  }

  /**
   * Extract entities from query
   */
  private extractEntities(query: string, language: 'th' | 'en'): ExtractedIntent['entities'] {
    const entities: ExtractedIntent['entities'] = {};

    // Extract brands (common automotive brands)
    const brands = [
      'Michelin', 'Bridgestone', 'Goodyear', 'Dunlop', 'Pirelli', 'Continental',
      'Hankook', 'Yokohama', 'Toyo', 'Khumo', 'Nitto', 'Falken',
      'มิชลิน', 'บริดจสโตน', 'กู๊ดเยียร์', 'ดันล็อป', 'ไพเรลลี', 'คอนติเนนตัล',
      'ฮังกุก', 'โยโกฮาม่า', 'โตโยะ', 'คูโม', 'นิตโต้', 'ฟัลเケน',
      'Toyota', 'Honda', 'Nissan', 'Mazda', 'Mitsubishi', 'Ford', 'Isuzu',
      'โตโยต้า', 'ฮอนด้า', 'นิสสัน', 'มาสด้า', 'มิตซูบิชิ', 'ฟอร์ด', 'อิซูซุ'
    ];

    const foundBrands = brands.filter(brand =>
      query.toLowerCase().includes(brand.toLowerCase())
    );

    if (foundBrands.length > 0) {
      entities.brands = foundBrands;
    }

    // Extract tire size pattern (e.g., 205/55R16, 195/65R15)
    const tireSizeMatch = query.match(/\d{2,3}\/\d{2,3}[Rr]?\d{2}/);
    if (tireSizeMatch) {
      entities.tireSize = tireSizeMatch[0];
    }

    // Extract price range
    const priceMatches = query.match(/(\d+)\s*(บาท|baht|฿)?/g);
    if (priceMatches) {
      const prices = priceMatches.map(p => parseInt(p.replace(/\D/g, ''))).filter(p => !isNaN(p));
      if (prices.length > 0) {
        entities.priceRange = {
          min: Math.min(...prices),
          max: Math.max(...prices)
        };
      }
    }

    return entities;
  }

  /**
   * Validate intent enum
   */
  private validateIntent(intent: string): IntentType {
    const validIntents: IntentType[] = [
      IntentType.SEARCH, IntentType.COMPATIBILITY_CHECK, IntentType.PRICE_INQUIRY,
      IntentType.AVAILABILITY_CHECK, IntentType.RECOMMENDATION, IntentType.COMPARISON,
      IntentType.TECHNICAL_SPEC, IntentType.GENERAL_INQUIRY, IntentType.ORDER_REQUEST,
      IntentType.COMPLAINT, IntentType.GREETING, IntentType.UNKNOWN
    ];

    if (validIntents.includes(intent as IntentType)) {
      return intent as IntentType;
    }

    return IntentType.SEARCH;
  }

  /**
   * Validate agent type enum
   */
  private validateAgentType(agent: string): AgentType {
    const validAgents: AgentType[] = [
      AgentType.SEARCH, AgentType.COMPATIBILITY, AgentType.RECOMMENDATION,
      AgentType.PRICE_ADVISOR, AgentType.CONVERSATION, AgentType.TECHNICAL_SPEC
    ];

    if (validAgents.includes(agent as AgentType)) {
      return agent as AgentType;
    }

    return AgentType.SEARCH;
  }

  /**
   * Select secondary agents based on intent and primary result
   */
  private selectSecondaryAgents(
    intent: ExtractedIntent,
    primaryResult: AgentResponse
  ): AgentType[] {
    const secondaryAgents: AgentType[] = [];

    // If search found results, add recommendation agent for suggestions
    if (intent.intent === IntentType.SEARCH && primaryResult.success) {
      secondaryAgents.push(AgentType.RECOMMENDATION);
    }

    // If compatibility check, also add search agent
    if (intent.intent === IntentType.COMPATIBILITY_CHECK) {
      secondaryAgents.push(AgentType.SEARCH);
    }

    // If price inquiry, add recommendation agent
    if (intent.intent === IntentType.PRICE_INQUIRY) {
      secondaryAgents.push(AgentType.RECOMMENDATION);
    }

    // Always include conversation agent for context building
    secondaryAgents.push(AgentType.CONVERSATION);

    return secondaryAgents;
  }

  /**
   * Create a new task
   */
  private async createTask(
    agentType: AgentType,
    query: string,
    context: AgentContext,
    priority: number
  ): Promise<AgentTask> {
    return {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      agentType,
      query,
      context,
      priority,
      status: 'pending',
      createdAt: Date.now()
    };
  }

  /**
   * Execute a task using the appropriate agent
   */
  private async executeTask(task: AgentTask): Promise<AgentResponse> {
    const capability = this.agents.get(task.agentType);

    if (!capability) {
      return {
        success: false,
        message: `Agent ${task.agentType} not registered`,
        agentName: task.agentType,
        confidence: 0
      };
    }

    task.status = 'in_progress';
    task.startedAt = Date.now();

    try {
      const result = await capability.execute(task.query, task.context);
      task.result = result;
      task.status = 'completed';
      task.completedAt = Date.now();
      return result;
    } catch (error) {
      task.status = 'failed';
      task.error = error.message;
      return {
        success: false,
        message: `Agent execution failed: ${error.message}`,
        agentName: task.agentType,
        confidence: 0
      };
    }
  }

  /**
   * Synthesize final response from primary and secondary responses
   */
  private synthesizeResponse(
    primaryResult: AgentResponse,
    secondaryResponses: AgentResponse[],
    intent: ExtractedIntent
  ): AgentResponse {
    // If only primary response, return as-is
    if (secondaryResponses.length === 0) {
      return primaryResult;
    }

    // Combine responses
    let combinedMessage = primaryResult.message;

    // Add recommendations if available
    const recommendation = secondaryResponses.find(r => r.agentName === 'Recommendation');
    if (recommendation && recommendation.data) {
      combinedMessage += '\n\n💡 ' + recommendation.message;
    }

    // Add price advice if relevant
    if (intent.intent === IntentType.PRICE_INQUIRY) {
      const priceAdvisor = secondaryResponses.find(r => r.agentName === 'PriceAdvisor');
      if (priceAdvisor) {
        combinedMessage += '\n\n💰 ' + priceAdvisor.message;
      }
    }

    // Collect all follow-up suggestions
    const allSuggestions = [
      ...(primaryResult.followUpSuggestions || []),
      ...secondaryResponses.flatMap(r => r.followUpSuggestions || [])
    ];

    // Remove duplicates and limit to 4 suggestions
    const uniqueSuggestions = [...new Set(allSuggestions)].slice(0, 4);

    return {
      ...primaryResult,
      message: combinedMessage,
      followUpSuggestions: uniqueSuggestions
    };
  }

  /**
   * Update conversation context in database
   */
  private async updateConversationContext(
    sessionId: string,
    query: string,
    response: AgentResponse,
    intent: ExtractedIntent
  ): Promise<void> {
    try {
      await supabase.from('conversation_history').insert({
        session_id: sessionId,
        role: 'user',
        content: query,
        intent: intent.intent,
        metadata: {
          entities: intent.entities,
          language: intent.language,
          agent: response.agentName
        }
      });

      await supabase.from('conversation_history').insert({
        session_id: sessionId,
        role: 'assistant',
        content: response.message,
        intent: intent.intent,
        metadata: {
          agent: response.agentName,
          confidence: response.confidence,
          suggestions: response.followUpSuggestions
        }
      });
    } catch (error) {
      console.error('[Orchestrator] Failed to update conversation context:', error);
    }
  }

  /**
   * Get fallback message for errors
   */
  private getFallbackMessage(context: AgentContext): string {
    const language = context.preferences?.language || 'th';

    if (language === 'th') {
      return '😕 ขออภัย ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง หรือติดต่อเจ้าหน้าที่';
    }

    return '😕 Sorry, the system is temporarily unavailable. Please try again or contact our staff.';
  }
}

// ==================== SINGLETON EXPORT ====================

export const orchestratorAgent = new OrchestratorAgent();
