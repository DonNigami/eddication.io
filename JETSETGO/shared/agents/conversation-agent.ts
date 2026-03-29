/**
 * JETSETGO - Conversation Agent
 * Maintains conversation context and handles general inquiries
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type {
  AgentCapability,
  AgentContext,
  AgentResponse,
  ConversationState
} from './agent-types.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== CONVERSATION AGENT ====================

export class ConversationAgent {
  private conversationStates: Map<string, ConversationStateData> = new Map();

  /**
   * Check if this agent can handle the query
   */
  async canHandle(query: string, context: AgentContext): Promise<number> {
    const lowerQuery = query.toLowerCase();

    // Always handle greetings with high confidence
    if (this.isGreeting(query)) {
      return 0.95;
    }

    // High confidence for conversational queries
    if (this.isConversational(query)) {
      return 0.85;
    }

    // Medium confidence for clarification
    if (this.isClarification(query)) {
      return 0.7;
    }

    // Always available as fallback
    return 0.2;
  }

  /**
   * Execute conversation handling
   */
  async execute(query: string, context: AgentContext): Promise<AgentResponse> {
    try {
      const language = context.preferences?.language || this.detectLanguage(query);

      // Get or create conversation state
      const state = this.getConversationState(context.sessionId);

      // Determine conversation type
      const convType = this.determineConversationType(query, state);

      // Generate response based on type
      const message = await this.generateConversationalResponse(
        query,
        convType,
        state,
        context,
        language
      );

      // Update conversation state
      this.updateConversationState(context.sessionId, convType);

      // Generate follow-up suggestions based on context
      const followUpSuggestions = this.generateContextualSuggestions(
        state,
        context,
        language
      );

      // Save conversation to database
      await this.saveConversation(context.sessionId, query, message, language);

      return {
        success: true,
        message,
        data: { convType, state: state.state },
        followUpSuggestions,
        agentName: 'Conversation',
        confidence: 0.9
      };

    } catch (error) {
      console.error('[ConversationAgent] Error:', error);

      return {
        success: false,
        message: this.getErrorMessage(context),
        agentName: 'Conversation',
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
   * Check if query is a greeting
   */
  private isGreeting(query: string): boolean {
    const greetings = [
      'สวัสดี', 'หวัดดี', 'ดีจ้า', 'ดีครับ', 'ดีค่ะ', 'เฮ็ลโล',
      'hello', 'hi', 'hey', 'greetings'
    ];

    const lowerQuery = query.toLowerCase();
    return greetings.some(g => lowerQuery.includes(g.toLowerCase()));
  }

  /**
   * Check if query is conversational
   */
  private isConversational(query: string): boolean {
    const conversational = [
      'ขอบคุณ', 'thank', 'ขอบใจ', 'thanks', 'ช่วยดูหน่อย', 'help me',
      'มีไหม', 'have', 'do you have', 'หรือยัง', 'or not',
      'ใช่ไหม', 'right', 'correct', 'เข้าใจ', 'understand'
    ];

    const lowerQuery = query.toLowerCase();
    return conversational.some(c => lowerQuery.includes(c.toLowerCase()));
  }

  /**
   * Check if query is clarification
   */
  private isClarification(query: string): boolean {
    const clarification = [
      'อะไร', 'what', 'อย่างไร', 'how', 'ทำไม', 'why', 'ใคร', 'who',
      'เมื่อไหร่', 'when', 'ที่ไหน', 'where', 'อย่างไร', 'which one',
      'ตัวไหน', 'แบบไหน', 'what kind', 'which type'
    ];

    const lowerQuery = query.toLowerCase();
    return clarification.some(c => lowerQuery.includes(c.toLowerCase()));
  }

  /**
   * Get conversation state for session
   */
  private getConversationState(sessionId: string): ConversationStateData {
    if (!this.conversationStates.has(sessionId)) {
      this.conversationStates.set(sessionId, {
        state: ConversationState.GREETING,
        stateHistory: [ConversationState.GREETING],
        stateTransitions: 0,
        lastInteraction: Date.now(),
        inactivityThreshold: 30 * 60 * 1000 // 30 minutes
      });
    }

    return this.conversationStates.get(sessionId)!;
  }

  /**
   * Update conversation state
   */
  private updateConversationState(sessionId: string, newState: ConversationState): void {
    const state = this.getConversationState(sessionId);

    if (state.state !== newState) {
      state.previousState = state.state;
      state.state = newState;
      state.stateHistory.push(newState);
      state.stateTransitions++;
    }

    state.lastInteraction = Date.now();
  }

  /**
   * Determine conversation type
   */
  private determineConversationType(
    query: string,
    state: ConversationStateData
  ): 'greeting' | 'help' | 'thanks' | 'clarification' | 'continuation' | 'closing' {
    if (this.isGreeting(query)) return 'greeting';

    const lowerQuery = query.toLowerCase();

    if (/(ขอบคุณ|thank|ขอบใจ|thanks)/i.test(query)) return 'thanks';
    if (/(ช่วย|help|อย่างไร|how.*do|ทำอย่างไร)/i.test(query)) return 'help';
    if (this.isClarification(query)) return 'clarification';

    // Check for closing indicators
    if (/(พอแล้ว|that'?s all|เพียงพอ|enough|ถึงแล้ว|done)/i.test(query)) {
      return 'closing';
    }

    // If continuing conversation
    if (state.stateHistory.length > 2) return 'continuation';

    return 'continuation';
  }

  /**
   * Generate conversational response
   */
  private async generateConversationalResponse(
    query: string,
    convType: string,
    state: ConversationStateData,
    context: AgentContext,
    language: 'th' | 'en'
  ): Promise<string> {
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

1️⃣ ค้นหาอะไหล่
   • พิมพ์ชื่ออะไหล่ หรือ Part Number
   • เช่น "ยาง Michelin 205/55R16" หรือ "น้ำมันเครื่อง 5W-30"

2️⃣ เช็คความเข้ากัน
   • บอกยี่ห้อและรุ่นรถ
   • เช่น "ยาง 205/55R16 ใส่ Honda City ได้ไหม"

3️⃣ สอบถามราคา
   • ถาม "ราคาเท่าไหร่" หรือ "มีโปรโมชั่นไหม"

4️⃣ ขอแนะนำ
   • ถาม "แนะนำยี่ห้อที่ดี" หรือ "มีตัวไหนถูกกว่าไหม"

━━━━━━━━━━━━━━━━━━━━━━━━
👇 ลองพิมพ์คำถามของคุณได้เลยครับ!`,
        en: `🔍 How to use JETSETGO:

1️⃣ Search for parts
   • Type part name or Part Number
   • Example: "Michelin tire 205/55R16" or "Engine oil 5W-30"

2️⃣ Check compatibility
   • Tell me your vehicle make and model
   • Example: "Does tire 205/55R16 fit Honda City?"

3️⃣ Ask about pricing
   • Ask "How much?" or "Any promotions?"

4️⃣ Get recommendations
   • Ask "Which brand is best?" or "Any cheaper options?"

━━━━━━━━━━━━━━━━━━━━━━━━
👇 Go ahead and ask your question!`
      },
      'clarification': {
        th: `🤔 ต้องการความช่วยเหลือหรือครับ?

ลองบอกรายละเอียดเพิ่มเติม:
• ชื่ออะไหล่หรือ Part Number
• ยี่ห้อและรุ่นรถ
• ปัญหาที่พบหรือสิ่งที่ต้องการ

เช่น:
• "ต้องการยางสำหรับ Honda City ปี 2020"
• "Part Number ABC-1234 ราคาเท่าไหรี่"
• "มีน้ำมันเครื่องสำหรับรถกระบะไหม"`,
        en: `🤔 How can I help you better?

Please provide more details:
• Part name or Part Number
• Vehicle make and model
• Your problem or requirement

Examples:
• "Need tires for Honda City 2020"
• "How much is Part Number ABC-1234?"
• "Do you have engine oil for pickup trucks?"`
      },
      'continuation': {
        th: `🔄 ดำเนินการต่อครับ

กรุณาบอกรายละเอียดเพิ่มเติมที่ต้องการ:
• Part Number หรือชื่ออะไหล่
• ยี่ห้อและรุ่นรถ
• งบประมาณหรือความต้องการพิเศษ`,
        en: `🔄 Please continue

Please provide more details:
• Part Number or part name
• Vehicle make and model
• Budget or special requirements`
      },
      'closing': {
        th: `👋 ขอบคุณที่ใช้บริการ JETSETGO ครับ

หวังว่าจะช่วยคุณได้แล้วนะครับ!
มีอะไรให้ช่วยอีกตลอด 24 ชั่วโมงได้เลยครับ

━━━━━━━━━━━━━━━━━━━━━━━━
📞 ติดต่อเรา:
• LINE: @JETSETGO
• โทร: 02-XXX-XXXX
• เว็บ: www.jetsetgo.com

🙏 ขอให้วันนี้เป็นวันที่ดีครับ!`,
        en: `👋 Thank you for using JETSETGO!

Hope I was able to help you today!
Feel free to reach out anytime 24/7.

━━━━━━━━━━━━━━━━━━━━━━━━
📞 Contact us:
• LINE: @JETSETGO
• Phone: 02-XXX-XXXX
• Web: www.jetsetgo.com

🙏 Have a great day!`
      }
    };

    const response = responses[convType] || responses['continuation'];

    // Add context awareness if available
    let contextualAddition = '';

    if (context.searchResults && context.searchResults.length > 0) {
      if (convType === 'continuation') {
        contextualAddition = language === 'th'
          ? `\n\n📦 จากการค้นหาล่าสุด พบ ${context.searchResults.length} รายการ`
          : `\n\n📦 From your last search, found ${context.searchResults.length} items`;
      }
    }

    if (context.vehicleContext) {
      const v = context.vehicleContext;
      contextualAddition += language === 'th'
        ? `\n\n🚗 รถของคุณ: ${v.make} ${v.model} ${v.year || ''}`
        : `\n\n🚗 Your vehicle: ${v.make} ${v.model} ${v.year || ''}`;
    }

    return response[language] + contextualAddition;
  }

  /**
   * Generate contextual suggestions
   */
  private generateContextualSuggestions(
    state: ConversationStateData,
    context: AgentContext,
    language: 'th' | 'en'
  ): string[] {
    const suggestions: string[] = [];

    if (language === 'th') {
      // Based on conversation state
      if (state.state === ConversationState.GREETING) {
        suggestions.push('ค้นหาอะไหล่');
        suggestions.push('เช็คความเข้ากัน');
        suggestions.push('สอบถามราคา');
      } else if (state.state === ConversationState.SEARCHING) {
        suggestions.push('ดูรายละเอียดเพิ่มเติม');
        suggestions.push('เปรียบเทียบรุ่น');
        suggestions.push('เช็คความเข้ากัน');
      } else if (state.state === ConversationState.COMPARING) {
        suggestions.push('เลือกรุ่นที่สนใจ');
        suggestions.push('ถามเรื่องการติดตั้ง');
      } else {
        suggestions.push('ค้นหาอะไหล่เพิ่ม');
        suggestions.push('สอบถามข้อมูลรถ');
      }

      // Add vehicle-specific suggestions if context available
      if (context.vehicleContext?.make) {
        suggestions.push('ดูอะไหล่สำหรับรถคันนี้');
      }
    } else {
      if (state.state === ConversationState.GREETING) {
        suggestions.push('Search for parts');
        suggestions.push('Check compatibility');
        suggestions.push('Ask about pricing');
      } else if (state.state === ConversationState.SEARCHING) {
        suggestions.push('View more details');
        suggestions.push('Compare models');
        suggestions.push('Check compatibility');
      } else {
        suggestions.push('Search more parts');
        suggestions.push('Ask about vehicle info');
      }

      if (context.vehicleContext?.make) {
        suggestions.push('View parts for this vehicle');
      }
    }

    return suggestions.slice(0, 4);
  }

  /**
   * Save conversation to database
   */
  private async saveConversation(
    sessionId: string,
    query: string,
    response: string,
    language: 'th' | 'en'
  ): Promise<void> {
    try {
      // Save user message
      await supabase.from('conversation_history').insert({
        session_id: sessionId,
        role: 'user',
        content: query,
        intent: 'general_inquiry',
        metadata: { language }
      });

      // Save assistant response
      await supabase.from('conversation_history').insert({
        session_id: sessionId,
        role: 'assistant',
        content: response,
        intent: 'general_inquiry',
        metadata: { language, agent: 'Conversation' }
      });
    } catch (error) {
      console.error('[ConversationAgent] Failed to save conversation:', error);
    }
  }

  /**
   * Get error message
   */
  private getErrorMessage(context: AgentContext): string {
    const language = context.preferences?.language || 'th';

    return language === 'th'
      ? '😕 ขออภัย ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง'
      : '😕 Sorry, system temporarily unavailable. Please try again.';
  }
}

// ==================== CONVERSATION STATE DATA ====================

interface ConversationStateData {
  state: ConversationState;
  previousState?: ConversationState;
  stateHistory: ConversationState[];
  stateTransitions: number;
  lastInteraction: number;
  inactivityThreshold: number;
}

// ==================== AGENT CAPABILITY EXPORT ====================

export const conversationAgentCapability: AgentCapability = {
  name: 'Conversation',
  description: 'Handles conversation context and general inquiries',
  canHandle: (query: string, context: AgentContext) => new ConversationAgent().canHandle(query, context),
  execute: (query: string, context: AgentContext) => new ConversationAgent().execute(query, context)
};
