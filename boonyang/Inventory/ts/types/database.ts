/**
 * Database Table Type Definitions
 * Matches Google Sheets structure from Boonyang Inventory
 */

// ============================================
// BotData Table (from BotData sheet)
// ============================================
export interface BotDataRow {
  id: number;
  item_code: string;                    // Column A (0)
  field_unknown: string;                 // Column B (1)
  item_name: string;                     // Column C (2)
  lot_number: string;                    // Column D (3)
  on_hand_quantity: number;              // Column E (4)
  alternative_key_1: string;             // Column F (5)
  alternative_key_2: string;             // Column G (6)
  created_at: string;
  updated_at: string;
}

// ============================================
// InventData Table (from InventData sheet)
// ============================================
export interface InventDataItem {
  id: number;
  item_name: string;                     // Column A (0)
  stock_quantity: number;                // Column B (1)
  stock_status: 'มีสินค้า' | 'ติดต่อแอดมิน'; // Computed field
  created_at: string;
  updated_at: string;
}

// ============================================
// UserData Table (from UserData sheet)
// ============================================
export interface UserProfile {
  id: number;
  user_id: string;                       // Column B (1): LINE userId
  display_name: string;                  // Column C (2)
  picture_url: string;                   // Column D (3)
  status_message: string;                // Column E (4)
  image_formula: string;                 // Column F (5)
  registration_date: string;             // Column G (6): YYYY-MM-DD
  registration_time: string;             // Column H (7): HH:mm:ss
  language: string;                      // Column I (8)
  group_name: string;                    // Column J (9)
  group_id: string;                      // Column K (10)
  status_register: string;               // Column M (12): สำเร็จ, รอชื่อ, รอนามสกุล, รอชื่อร้าน, รอเลขที่ภาษี
  reference: string;                     // Column N (13): Reserved for future use
  name: string;                          // Column O (14)
  surname: string;                       // Column P (15)
  shop_name: string;                     // Column Q (16)
  tax_id: string;                        // Column R (17)
  created_at: string;
  updated_at: string;
  last_interaction_at: string;
}

// User role types
export type UserRole = 'admin' | 'customer' | null;

// Registration flow status
export type FlowStatus =
  | 'รอชื่อ'
  | 'รอนามสกุล'
  | 'รอชื่อร้าน'
  | 'รอเลขที่ภาษี'
  | null;

// Registration status
export type RegistrationStatus = 'สำเร็จ' | null;

// ============================================
// System Settings
// ============================================
export interface SystemSettings {
  id: number;
  bot_enabled: boolean;
  stock_enabled: boolean;
  stock_require_approval: boolean;
  register_required: boolean;
  line_channel_token: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// Reply Templates (from reply sheet)
// ============================================
export interface ReplyTemplate {
  id: number;
  keyword: string;
  reply_type: 'text' | 'flex' | 'template';
  reply_content: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// LOT Parsing Result
// ============================================
export interface LotInfo {
  raw: string;
  week: number;
  year: number;
  rank: number; // For sorting: (year * 100) + week
}

// ============================================
// Search Results
// ============================================
export interface StockSearchResult {
  item_name: string;
  lot_number: string;
  lot_display: string;
  on_hand_quantity: number;
  stock_status: string;
}

export interface FuzzySearchResult {
  name: string;
  stock: number;
  status: string;
  similarity?: number; // 0-1 score
}

// ============================================
// Cache Items
// ============================================
export interface CachedBotData {
  items: BotDataRow[];
  timestamp: number;
  ttl: number;
}

export interface CachedInventData {
  items: InventDataItem[];
  timestamp: number;
  ttl: number;
}
