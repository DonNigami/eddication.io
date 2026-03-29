/**
 * JETSETGO - Agentic AI System
 * Multi-Agent Architecture for Intelligent Parts Catalog Search
 *
 * This system implements a multi-agent approach where different specialist agents
 * handle different aspects of the user query:
 *
 * 1. Orchestrator Agent - Routes queries to appropriate agents
 * 2. Search Agent - Handles parts/tire searches
 * 3. Compatibility Agent - Checks vehicle compatibility
 * 4. Recommendation Agent - Suggests alternatives and upgrades
 * 5. Price Advisor Agent - Provides pricing and deal information
 * 6. Conversation Agent - Maintains conversation context
 */

// ==================== AGENT INTERFACE ====================

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

export interface AgentContext {
  userId?: string;
  sessionId: string;
  conversationHistory: AgentMessage[];
  searchResults?: SearchResult[];
  vehicleContext?: VehicleContext;
  preferences?: UserPreferences;
}

export interface VehicleContext {
  make?: string;
  model?: string;
  year?: number;
  engine?: string;
  trim?: string;
  submodel?: string;
}

export interface UserPreferences {
  language: 'th' | 'en';
  budgetMin?: number;
  budgetMax?: number;
  preferredBrands?: string[];
  prioritizePrice?: boolean;
  prioritizeQuality?: boolean;
}

export interface SearchResult {
  id: string;
  partNumber?: string;
  brand?: string;
  nameTh?: string;
  nameEn?: string;
  description?: string;
  price?: number;
  stock?: number;
  similarity: number;
  category?: string;
  subcategory?: string;
}

export interface AgentResponse {
  success: boolean;
  message: string;
  data?: unknown;
  followUpSuggestions?: string[];
  agentName: string;
  confidence: number;
  needsHumanIntervention?: boolean;
}

export interface AgentCapability {
  name: string;
  description: string;
  canHandle: (query: string, context: AgentContext) => Promise<number>; // Returns confidence 0-1
  execute: (query: string, context: AgentContext) => Promise<AgentResponse>;
}

// ==================== AGENT TYPES ====================

export enum AgentType {
  ORCHESTRATOR = 'orchestrator',
  SEARCH = 'search',
  COMPATIBILITY = 'compatibility',
  RECOMMENDATION = 'recommendation',
  PRICE_ADVISOR = 'price_advisor',
  CONVERSATION = 'conversation',
  TECHNICAL_SPEC = 'technical_spec'
}

export interface AgentConfig {
  name: AgentType;
  enabled: boolean;
  priority: number;
  maxExecutionTime: number; // milliseconds
}

// ==================== INTENT EXTRACTION ====================

export enum IntentType {
  SEARCH = 'search',
  COMPATIBILITY_CHECK = 'compatibility_check',
  PRICE_INQUIRY = 'price_inquiry',
  AVAILABILITY_CHECK = 'availability_check',
  RECOMMENDATION = 'recommendation',
  COMPARISON = 'comparison',
  TECHNICAL_SPEC = 'technical_spec',
  GENERAL_INQUIRY = 'general_inquiry',
  ORDER_REQUEST = 'order_request',
  COMPLAINT = 'complaint',
  GREETING = 'greeting',
  UNKNOWN = 'unknown'
}

export interface ExtractedIntent {
  intent: IntentType;
  confidence: number;
  entities: {
    partNumbers?: string[];
    brands?: string[];
    vehicleInfo?: VehicleContext;
    tireSize?: string;
    priceRange?: { min?: number; max?: number };
    categories?: string[];
    oemNumbers?: string[];
  };
  language: 'th' | 'en';
  requiresContext: boolean;
  suggestedAgent: AgentType;
}

// ==================== CONVERSATION STATE ====================

export enum ConversationState {
  GREETING = 'greeting',
  SEARCHING = 'searching',
  REFINING = 'refining',
  COMPARING = 'comparing',
  ADVISORY = 'advisory',
  CLOSING = 'closing',
  ESCALATED = 'escalated'
}

export interface ConversationStateData {
  state: ConversationState;
  previousState?: ConversationState;
  stateHistory: ConversationState[];
  stateTransitions: number;
  lastInteraction: number;
  inactivityThreshold: number; // milliseconds
}

// ==================== AGENT COORDINATION ====================

export interface AgentTask {
  id: string;
  agentType: AgentType;
  query: string;
  context: AgentContext;
  priority: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: AgentResponse;
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface AgentCoordinationResult {
  primaryResponse: AgentResponse;
  secondaryResponses?: AgentResponse[];
  taskHistory: AgentTask[];
  totalExecutionTime: number;
  involvedAgents: AgentType[];
}

// ==================== AGENT MEMORY ====================

export interface AgentMemoryEntry {
  type: 'user_preference' | 'search_result' | 'conversation_turn' | 'correction';
  timestamp: number;
  data: unknown;
  importance: number; // 0-1
  expiresAt?: number;
}

export interface AgentMemory {
  userId?: string;
  sessionId: string;
  entries: AgentMemoryEntry[];
  maxEntries: number;
  maxAge: number; // milliseconds
}

// ==================== RESPONSE FORMATTING ====================

export enum ResponseStyle {
  CONVERSATIONAL = 'conversational',
  PROFESSIONAL = 'professional',
  CONCISE = 'concise',
  DETAILED = 'detailed',
  FRIENDLY = 'friendly',
  TECHNICAL = 'technical'
}

export interface ResponseFormat {
  style: ResponseStyle;
  includeEmojis: boolean;
  includePartNumbers: boolean;
  includePrices: boolean;
  includeStockStatus: boolean;
  includeSuggestions: boolean;
  maxResults: number;
  language: 'th' | 'en';
}
