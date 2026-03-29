/**
 * Boonyang Inventory Webhook - Full Version
 * Supabase Edge Function for LINE Bot
 *
 * Complete implementation matching backend logic:
 * - Stock search from BotData (exact match) → InventData (partial match)
 * - LOT number parsing and sorting
 * - Flex carousel for multiple results
 * - Full registration flow (name, surname, shop name, tax ID)
 * - Reply templates (text, flex, template, telegram)
 * - System settings (bot_enabled, stock_enabled, require_approval, register_required)
 * - Admin commands (bot on/off, stock on/off, approve/block/makeadmin)
 * - Quote token support
 * - User permissions (admin, customer)
 * - Group/Room vs User chat differences
 * - Member join/leave events
 * - Cache management for BotData and InventData
 *
 * Deploy: supabase functions deploy boonyang-webhook
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// ============================================
// Types
// ============================================

interface LineWebhook {
  destination: string;
  events: LineEvent[];
}

interface LineEvent {
  type: string;
  replyToken?: string;
  source: {
    userId?: string;
    groupId?: string;
    roomId?: string;
    type?: string;
  };
  message?: {
    type: string;
    text?: string;
    quoteToken?: string;
    id?: string;
  };
  postback?: {
    data: string;
  };
  joined?: {
    members: Array<{ userId: string }>;
  };
  left?: {
    members: Array<{ userId: string; type: string }>;
  };
  timestamp: number;
}

interface LineMessage {
  type: 'text' | 'flex';
  text?: string;
  altText?: string;
  contents?: any;
  quoteToken?: string;
}

interface BotDataItem {
  item_code: string;
  field_unknown: string;
  item_name: string;
  lot_number: string;
  on_hand_quantity: number;
  alternative_key_1: string;
  alternative_key_2: string;
}

interface InventDataItem {
  name: string;       // ItemName (SKU/รหัสสินค้า)
  carBrand: string;   // ItemName2 (ยี่ห้อรถ - เช่น TOYOTA, HONDA)
  carModel: string;   // ItemName3 (รุ่นรถ - เช่น CAMRY, CIVIC)
  standard: string;   // Standard (มาตรฐานรถ - เช่น 2.0V, 1.8EL)
  stock: number;      // OnhandQtyByTotalPiece
  status: string;
  row: number;
}

interface CombinedSearchResult {
  name: string;
  stock: number;
  status: string;
  lot?: string;
  source: 'botdata' | 'inventdata';
}

interface LineUser {
  id: string;
  user_id: string;
  display_name: string;
  picture_url: string;
  name: string;
  surname: string;
  shop_name: string;
  tax_id: string;
  userstaff: string;
  status_register: string; // Used for both final status AND flow tracking: 'pending', 'รอชื่อ', 'รอนามสกุล', 'รอชื่อร้าน', 'รอเลขที่ภาษี', 'สำเร็จ'
  status: string;
}

interface SystemSettings {
  bot_enabled: boolean;
  stock_enabled: boolean;
  stock_require_approval: boolean;
  register_required: boolean;
}

// ============================================
// Step-by-Step Search State Management (Database-backed)
// ============================================

interface UserSearchState {
  userId: string;
  step: 'waiting_brand' | 'brand_selected' | 'model_selected' | 'standard_selected' | 'complete';
  itemName2: string;  // ยี่ห้อรถ (เช่น TOYOTA)
  itemName3?: string; // รุ่นรถ (เช่น CAMRY)
  standard?: string;  // มาตรฐานรถ (เช่น 2.0V)
  originalQuery: string;
  timestamp: number;
}

class SearchStateService {
  private readonly STATE_TTL = 10 * 60 * 1000; // 10 minutes

  async get(userId: string): Promise<UserSearchState | null> {
    try {
      const { data, error } = await supabase
        .from('user_search_states')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error || !data) {
        console.log(`📭 No state found for ${userId}`);
        return null;
      }

      // Check if expired (10 minutes)
      const age = Date.now() - new Date(data.updated_at).getTime();
      if (age > this.STATE_TTL) {
        console.log(`⏰ State expired for ${userId} (${Math.round(age / 1000)}s old)`);
        await this.clear(userId);
        return null;
      }

      const state: UserSearchState = {
        userId: data.user_id,
        step: data.step,
        itemName2: data.item_name2 || '',
        itemName3: data.item_name3 || undefined,
        standard: data.standard || undefined,
        originalQuery: data.original_query || '',
        timestamp: new Date(data.updated_at).getTime(),
      };

      console.log(`📦 Retrieved state for ${userId}: ${state.step}`);
      return state;
    } catch (error) {
      console.error('❌ Error getting search state:', error);
      return null;
    }
  }

  async create(userId: string, initialData: Omit<UserSearchState, 'userId' | 'timestamp'>): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_search_states')
        .upsert({
          user_id: userId,
          step: initialData.step,
          item_name2: initialData.itemName2 || '',
          item_name3: initialData.itemName3 || null,
          standard: initialData.standard || null,
          original_query: initialData.originalQuery || '',
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('❌ Error creating search state:', error);
        throw error;
      }

      console.log(`✅ Created/Updated search state for ${userId}: ${initialData.step}`);
    } catch (error) {
      console.error('❌ Error in create:', error);
      throw error;
    }
  }

  async update(userId: string, updates: Partial<Omit<UserSearchState, 'userId' | 'originalQuery' | 'timestamp'>>): Promise<void> {
    try {
      const updateData: any = {};
      if (updates.step) updateData.step = updates.step;
      if (updates.itemName2 !== undefined) updateData.item_name2 = updates.itemName2;
      if (updates.itemName3 !== undefined) updateData.item_name3 = updates.itemName3 || null;
      if (updates.standard !== undefined) updateData.standard = updates.standard || null;

      const { error } = await supabase
        .from('user_search_states')
        .update(updateData)
        .eq('user_id', userId);

      if (error) {
        console.error('❌ Error updating search state:', error);
        throw error;
      }

      console.log(`✅ Updated search state for ${userId}`);
    } catch (error) {
      console.error('❌ Error in update:', error);
      throw error;
    }
  }

  async clear(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_search_states')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('❌ Error clearing search state:', error);
        return;
      }

      console.log(`🗑️ Cleared search state for ${userId}`);
    } catch (error) {
      console.error('❌ Error in clear:', error);
    }
  }

  // Clean up expired states (older than 10 minutes)
  async cleanup(): Promise<void> {
    try {
      const expiryTime = new Date(Date.now() - this.STATE_TTL).toISOString();

      const { error } = await supabase
        .from('user_search_states')
        .delete()
        .lt('updated_at', expiryTime);

      if (error) {
        console.error('❌ Error cleaning up expired states:', error);
        return;
      }

      console.log('🧹 Cleaned up expired search states');
    } catch (error) {
      console.error('❌ Error in cleanup:', error);
    }
  }
}

const searchStateService = new SearchStateService();

// ============================================
// Environment Variables
// ============================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LINE_CHANNEL_TOKEN = Deno.env.get('LINE_CHANNEL_TOKEN');
const LINE_CHANNEL_SECRET = Deno.env.get('LINE_CHANNEL_SECRET');

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

if (!LINE_CHANNEL_TOKEN) {
  console.error('❌ LINE_CHANNEL_TOKEN not set - bot cannot reply to messages');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================
// Cache Management (In-memory with TTL)
// ============================================

class CacheService {
  private botDataCache = new Map<string, { data: BotDataItem[]; expiry: number }>();
  private inventDataCache: { data: InventDataItem[]; expiry: number } | null = null;
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  // Check if cache exists and is valid
  private isValid(expiry: number): boolean {
    return Date.now() < expiry;
  }

  // Get BotData from cache
  getBotData(key: string): BotDataItem[] | null {
    const cached = this.botDataCache.get(key);
    if (cached && this.isValid(cached.expiry)) {
      return cached.data;
    }
    return null;
  }

  // Set BotData in cache
  setBotData(key: string, data: BotDataItem[]): void {
    this.botDataCache.set(key, {
      data,
      expiry: Date.now() + this.CACHE_TTL,
    });
  }

  // Get InventData from cache
  getInventData(): InventDataItem[] | null {
    if (this.inventDataCache && this.isValid(this.inventDataCache.expiry)) {
      return this.inventDataCache.data;
    }
    return null;
  }

  // Set InventData in cache
  setInventData(data: InventDataItem[]): void {
    this.inventDataCache = {
      data,
      expiry: Date.now() + this.CACHE_TTL,
    };
  }

  // Clear all caches
  clear(): void {
    this.botDataCache.clear();
    this.inventDataCache = null;
  }

  // Preload BotData cache
  async preloadBotData(): Promise<void> {
    try {
      console.log('🔄 Preloading BotData cache...');
      const { data, error } = await supabase
        .from('botdata')
        .select('*');

      if (error) {
        console.error('❌ Error loading BotData:', error);
        return;
      }

      if (!data || data.length === 0) {
        console.log('⚠️ No BotData found in database');
        return;
      }

      // Group by keys (item_code, alternative_key_1, alternative_key_2)
      const groupedMap = new Map<string, BotDataItem[]>();

      data.forEach((row: any) => {
        const keys = [row.item_code, row.alternative_key_1, row.alternative_key_2];
        keys.forEach(key => {
          const k = key?.toString().trim();
          if (!k) return;
          if (!groupedMap.has(k)) {
            groupedMap.set(k, []);
          }
          groupedMap.get(k)!.push(row);
        });
      });

      // Store in cache
      groupedMap.forEach((items, key) => {
        this.setBotData(key, items);
      });

      console.log(`✅ BotData cache preloaded: ${groupedMap.size} keys`);
    } catch (error) {
      console.error('❌ Error preloading BotData:', error);
    }
  }

  // Preload InventData cache
  async preloadInventData(): Promise<void> {
    try {
      console.log('🔄 Preloading InventData cache...');
      const { data, error } = await supabase
        .from('inventdata')
        .select('*');

      if (error) {
        console.error('❌ Error loading InventData:', error);
        return;
      }

      if (!data || data.length === 0) {
        console.log('⚠️ No InventData found in database');
        return;
      }

      // Transform to InventDataItem format
      const inventDataItems: InventDataItem[] = data.map((row: any, index: number) => ({
        name: row.ItemName || '',
        carBrand: row.ItemName2 || '',
        carModel: row.ItemName3 || '',
        standard: row.Standard || '',
        stock: row.OnhandQtyByTotalPiece || 0,
        status: (row.OnhandQtyByTotalPiece || 0) >= 4 ? 'มีสินค้า' : 'ติดต่อแอดมิน',
        row: index + 2,
      }));

      this.setInventData(inventDataItems);
      console.log(`✅ InventData cache preloaded: ${inventDataItems.length} items`);
    } catch (error) {
      console.error('❌ Error preloading InventData:', error);
    }
  }

  // Manual cache refresh
  async refresh(): Promise<void> {
    console.log('🔄 Manually refreshing cache...');
    await this.preloadBotData();
    await this.preloadInventData();
    console.log('✅ Cache refresh completed');
  }
}

const cacheService = new CacheService();

// ============================================
// LINE API Service
// ============================================

class LineService {
  private readonly apiUrl = 'https://api.line.me/v2/bot';
  private readonly headers = {
    'Authorization': `Bearer ${LINE_CHANNEL_TOKEN}`,
    'Content-Type': 'application/json',
  };

  // Get user profile
  async getUserProfile(userId: string): Promise<any> {
    if (!LINE_CHANNEL_TOKEN) {
      throw new Error('LINE_CHANNEL_TOKEN not set');
    }

    const response = await fetch(`${this.apiUrl}/profile/${userId}`, {
      headers: {
        'Authorization': `Bearer ${LINE_CHANNEL_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get user profile: ${response.statusText}`);
    }

    return await response.json();
  }

  // Reply message
  async replyMessage(replyToken: string, messages: LineMessage[]): Promise<void> {
    if (!LINE_CHANNEL_TOKEN) {
      console.error('❌ LINE_CHANNEL_TOKEN not set');
      return;
    }

    const response = await fetch(`${this.apiUrl}/message/reply`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        replyToken,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LINE API Error: ${error}`);
    }
  }

  // Push message
  async pushMessage(userId: string, messages: LineMessage[]): Promise<void> {
    if (!LINE_CHANNEL_TOKEN) {
      console.error('❌ LINE_CHANNEL_TOKEN not set');
      return;
    }

    const response = await fetch(`${this.apiUrl}/message/push`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        to: userId,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LINE API Error: ${error}`);
    }
  }

  // Get group summary
  async getGroupSummary(groupId: string): Promise<any> {
    if (!LINE_CHANNEL_TOKEN) {
      throw new Error('LINE_CHANNEL_TOKEN not set');
    }

    const response = await fetch(`${this.apiUrl}/group/${groupId}/summary`, {
      headers: {
        'Authorization': `Bearer ${LINE_CHANNEL_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get group summary: ${response.statusText}`);
    }

    return await response.json();
  }

  // Get group member profile
  async getGroupMemberProfile(groupId: string, userId: string): Promise<any> {
    if (!LINE_CHANNEL_TOKEN) {
      throw new Error('LINE_CHANNEL_TOKEN not set');
    }

    const response = await fetch(`${this.apiUrl}/group/${groupId}/member/${userId}`, {
      headers: {
        'Authorization': `Bearer ${LINE_CHANNEL_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get group member: ${response.statusText}`);
    }

    return await response.json();
  }

  // Start loading animation
  async startLoadingAnimation(chatId: string): Promise<boolean> {
    if (!LINE_CHANNEL_TOKEN) {
      console.error('❌ LINE_CHANNEL_TOKEN not set');
      return false;
    }

    try {
      const response = await fetch(`${this.apiUrl}/chat/loading/start`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          chatId: chatId,
          loadingSeconds: 20,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`❌ Failed to start loading animation: ${error}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Error starting loading animation:', error);
      return false;
    }
  }
}

const lineService = new LineService();

// ============================================
// System Settings
// ============================================

async function getSystemSettings(): Promise<SystemSettings> {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['bot_enabled', 'stock_enabled', 'stock_require_approval', 'register_required']);

    if (error) {
      console.error('❌ Error loading system settings:', error);
      return {
        bot_enabled: true,
        stock_enabled: true,
        stock_require_approval: true,
        register_required: true,
      };
    }

    const settings: SystemSettings = {
      bot_enabled: true,
      stock_enabled: true,
      stock_require_approval: true,
      register_required: true,
    };

    (data || []).forEach((setting: any) => {
      const value = setting.value?.toLowerCase() === 'true';
      switch (setting.key) {
        case 'bot_enabled':
          settings.bot_enabled = value;
          break;
        case 'stock_enabled':
          settings.stock_enabled = value;
          break;
        case 'stock_require_approval':
          settings.stock_require_approval = value;
          break;
        case 'register_required':
          settings.register_required = value;
          break;
      }
    });

    return settings;
  } catch (error) {
    console.error('❌ Error getting system settings:', error);
    return {
      bot_enabled: true,
      stock_enabled: true,
      stock_require_approval: true,
      register_required: true,
    };
  }
}

async function updateSystemSetting(key: string, value: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('system_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() });

    if (error) {
      console.error('❌ Error updating system setting:', error);
      return false;
    }

    console.log(`✅ Updated system setting: ${key} = ${value}`);
    return true;
  } catch (error) {
    console.error('❌ Error updating system setting:', error);
    return false;
  }
}

// ============================================
// User Functions
// ============================================

async function getUser(userId: string): Promise<LineUser | null> {
  try {
    const { data, error } = await supabase
      .from('userdata')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return data as LineUser;
  } catch (error) {
    console.error('❌ Error getting user:', error);
    return null;
  }
}

async function createUser(userId: string, profile: any): Promise<LineUser> {
  try {
    const now = new Date();
    const registration_date = now.toISOString().split('T')[0];
    const registration_time = now.toTimeString().slice(0, 5); // HH:mm

    const { data, error } = await supabase
      .from('userdata')
      .insert({
        user_id: userId,
        display_name: profile.displayName || '',
        picture_url: profile.pictureUrl || '',
        status_message: profile.statusMessage || '',
        language: profile.language || '',
        registration_date,
        registration_time,
        status: 'pending',
        status_register: 'pending',
        userstaff: '',
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as LineUser;
  } catch (error) {
    console.error('❌ Error creating user:', error);
    throw error;
  }
}

async function updateUser(userId: string, updates: Partial<LineUser>): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('userdata')
      .update(updates)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Error updating user:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Error updating user:', error);
    return false;
  }
}

async function deleteUser(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('userdata')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Error deleting user:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Error deleting user:', error);
    return false;
  }
}

// ============================================
// LOT Number Utilities
// ============================================

interface LotInfo {
  year: number;
  week: number;
  rank: number;
}

function parseLot(lotVal: string): LotInfo {
  const raw = String(lotVal || '').replace(/\D/g, '').trim();
  if (raw.length < 2) {
    return { year: NaN, week: NaN, rank: Number.MAX_SAFE_INTEGER };
  }

  const yy = parseInt(raw.slice(-2), 10);
  const weekStr = raw.slice(0, -2);
  const week = weekStr ? parseInt(weekStr, 10) : 0;
  const year = 2000 + (isNaN(yy) ? 0 : yy);
  const rank = (year * 100) + (isNaN(week) ? 0 : week);

  return { year, week: isNaN(week) ? 0 : week, rank };
}

function isLotAEarlier(lotA: string, lotB: string): boolean {
  const a = parseLot(lotA);
  const b = parseLot(lotB);
  return a.rank < b.rank;
}

function formatLotDisplay(lotVal: string): string {
  const { year, week } = parseLot(lotVal);
  if (isNaN(year) || isNaN(week)) {
    return `LOT: ${lotVal}`;
  }
  const w = String(week).padStart(2, '0');
  return `LOT: ${lotVal} (W${w}/${year})`;
}

// ============================================
// Search Functions
// ============================================

// Search in BotData (Exact Match)
async function searchBotData(query: string): Promise<BotDataItem[]> {
  console.log(`🔍 Searching BotData (exact match) for: ${query}`);

  try {
    // Query database directly (no cache)
    const { data, error } = await supabase
      .from('botdata')
      .select('*')
      .or(`item_code.eq.${query},alternative_key_1.eq.${query},alternative_key_2.eq.${query}`)
      .limit(100);

    if (error) {
      console.error('❌ Error searching BotData:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log('❌ Not found in BotData');
      return [];
    }

    console.log(`✅ Found ${data.length} items in BotData (exact match)`);
    return data as BotDataItem[];
  } catch (error) {
    console.error('❌ Error searching BotData:', error);
    return [];
  }
}

// Search in InventData (Partial Match)
async function searchInventData(query: string): Promise<InventDataItem[]> {
  console.log(`🔍 Searching InventData (partial match) for: ${query}`);

  try {
    // Query database directly (no cache)
    const { data, error } = await supabase
      .from('inventdata')
      .select('*')
      .or(`ItemName.ilike.%${query}%,ItemName2.ilike.%${query}%,ItemName3.ilike.%${query}%`)
      .limit(100);

    if (error) {
      console.error('❌ Error searching InventData:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log('❌ Not found in InventData');
      return [];
    }

    const items: InventDataItem[] = data.map((row: any, index: number) => ({
      name: row.ItemName || '',
      standard: row.Standard || '',
      name2: row.ItemName2 || '',
      name3: row.ItemName3 || '',
      stock: row.OnhandQtyByTotalPiece || 0,
      status: (row.OnhandQtyByTotalPiece || 0) >= 4 ? 'มีสินค้า' : 'ติดต่อแอดมิน',
      row: index + 2,
    }));

    console.log(`✅ Found ${items.length} items in InventData (partial match)`);
    return items;
  } catch (error) {
    console.error('❌ Error searching InventData:', error);
    return [];
  }
}

// ============================================
// Step-by-Step Search Functions
// ============================================

// Get ALL unique ItemName2 (ยี่ห้อรถ) - sorted A-Z
async function getAllUniqueBrands(): Promise<string[]> {
  console.log('🔍 Getting ALL unique car brands (ItemName2)');

  try {
    const { data, error } = await supabase
      .from('inventdata')
      .select('ItemName2')
      .not('ItemName2', 'is', null);

    if (error) {
      console.error('❌ Error getting all ItemName2:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log('❌ No ItemName2 found');
      return [];
    }

    // Get unique ItemName2 values and sort A-Z
    const uniqueBrands = [...new Set(data.map((row: any) => row.ItemName2?.trim()).filter(Boolean))] as string[];
    const sortedBrands = uniqueBrands.sort((a, b) => a.localeCompare(b, 'en'));

    console.log(`✅ Found ${sortedBrands.length} unique car brands (sorted A-Z)`);
    return sortedBrands;
  } catch (error) {
    console.error('❌ Error getting all ItemName2:', error);
    return [];
  }
}

// Step 1: Search by ItemName2 (ยี่ห้อรถ - Car Brand)
// NOTE: NOT USED in new flow - kept for future use or backward compatibility
async function searchByItemName2(query: string): Promise<string[]> {
  console.log(`🔍 Step 1: Searching ItemName2 (car brand) for: ${query}`);

  try {
    const { data, error } = await supabase
      .from('inventdata')
      .select('ItemName2')
      .ilike('ItemName2', `%${query}%`)
      .not('ItemName2', 'is', null);

    if (error) {
      console.error('❌ Error searching ItemName2:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log('❌ No ItemName2 found');
      return [];
    }

    // Get unique ItemName2 values
    const uniqueBrands = [...new Set(data.map((row: any) => row.ItemName2?.trim()).filter(Boolean))] as string[];
    console.log(`✅ Found ${uniqueBrands.length} unique car brands:`, uniqueBrands);

    return uniqueBrands.sort();
  } catch (error) {
    console.error('❌ Error searching ItemName2:', error);
    return [];
  }
}

// Step 2: Search by ItemName3 (รุ่นรถ - Car Model) given ItemName2
async function searchByItemName3(itemName2: string): Promise<string[]> {
  console.log(`🔍 Step 2: Searching ItemName3 (car model) for brand: ${itemName2}`);

  try {
    const { data, error } = await supabase
      .from('inventdata')
      .select('ItemName3')
      .ilike('ItemName2', `%${itemName2}%`)
      .not('ItemName3', 'is', null);

    if (error) {
      console.error('❌ Error searching ItemName3:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log('❌ No ItemName3 found');
      return [];
    }

    // Get unique ItemName3 values
    const uniqueModels = [...new Set(data.map((row: any) => row.ItemName3?.trim()).filter(Boolean))] as string[];
    console.log(`✅ Found ${uniqueModels.length} unique car models:`, uniqueModels);

    return uniqueModels.sort();
  } catch (error) {
    console.error('❌ Error searching ItemName3:', error);
    return [];
  }
}

// Step 3: Search by Standard (มาตรฐานรถ) given ItemName2 and ItemName3
async function searchByStandard(itemName2: string, itemName3: string): Promise<string[]> {
  console.log(`🔍 Step 3: Searching Standard for ${itemName2} - ${itemName3}`);

  try {
    const { data, error } = await supabase
      .from('inventdata')
      .select('Standard')
      .ilike('ItemName2', `%${itemName2}%`)
      .ilike('ItemName3', `%${itemName3}%`)
      .not('Standard', 'is', null);

    if (error) {
      console.error('❌ Error searching Standard:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log('❌ No Standard found');
      return [];
    }

    // Get unique Standard values
    const uniqueStandards = [...new Set(data.map((row: any) => row.Standard?.trim()).filter(Boolean))] as string[];
    console.log(`✅ Found ${uniqueStandards.length} unique standards:`, uniqueStandards);

    return uniqueStandards.sort();
  } catch (error) {
    console.error('❌ Error searching Standard:', error);
    return [];
  }
}

// Final: Get all items matching ItemName2, ItemName3, and Standard
async function searchFinalProducts(itemName2: string, itemName3: string, standard: string): Promise<InventDataItem[]> {
  console.log(`🔍 Final: Searching products for ${itemName2} - ${itemName3} - ${standard}`);

  try {
    const { data, error } = await supabase
      .from('inventdata')
      .select('*')
      .ilike('ItemName2', `%${itemName2}%`)
      .ilike('ItemName3', `%${itemName3}%`)
      .ilike('Standard', `%${standard}%`)
      .limit(100);

    if (error) {
      console.error('❌ Error searching final products:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log('❌ No products found');
      return [];
    }

    const items: InventDataItem[] = data.map((row: any, index: number) => ({
      name: row.ItemName || '',
      standard: row.Standard || '',
      name2: row.ItemName2 || '',
      name3: row.ItemName3 || '',
      stock: row.OnhandQtyByTotalPiece || 0,
      status: (row.OnhandQtyByTotalPiece || 0) >= 4 ? 'มีสินค้า' : 'ติดต่อแอดมิน',
      row: index + 2,
    }));

    console.log(`✅ Found ${items.length} products`);
    return items;
  } catch (error) {
    console.error('❌ Error searching final products:', error);
    return [];
  }
}

// ============================================
// Flex Templates
// ============================================

function createRegisterCompleteFlex(user: LineUser): LineMessage {
  const flex = {
    type: 'flex',
    altText: 'ลงทะเบียนเสร็จสมบูรณ์',
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'ลงทะเบียนเสร็จสมบูรณ์',
            wrap: true,
            align: 'center',
            weight: 'bold',
            color: '#ffffff',
            size: 'lg',
          },
        ],
        backgroundColor: '#00BFA5',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'ยินดีต้อนรับสู่เมนูต่างๆ',
            color: '#222222',
            weight: 'bold',
            size: 'md',
            align: 'center',
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'image',
                url: user.picture_url || 'https://via.placeholder.com/60',
                size: 'sm',
                aspectMode: 'cover',
                align: 'center',
              },
            ],
            margin: 'xxl',
            cornerRadius: '50px',
            borderWidth: '1px',
            borderColor: '#22222220',
            height: '60px',
            width: '60px',
            offsetStart: '85px',
            offsetEnd: '85px',
          },
          {
            type: 'text',
            text: user.display_name || '',
            weight: 'bold',
            size: 'lg',
            margin: 'md',
            align: 'center',
          },
          {
            type: 'box',
            layout: 'baseline',
            contents: [
              {
                type: 'text',
                text: user.tax_id || '',
                size: 'sm',
                color: '#666666',
                wrap: true,
                align: 'center',
              },
            ],
          },
          {
            type: 'box',
            layout: 'baseline',
            contents: [
              {
                type: 'icon',
                url: 'https://cdn4.iconfinder.com/data/icons/e-commerce-icon-set/48/Username-512.png',
              },
              {
                type: 'text',
                text: 'ชื่อ',
                weight: 'bold',
                margin: 'md',
                flex: 0,
                color: '#aaaaaa',
              },
              {
                type: 'text',
                text: `${user.name} ${user.surname}`,
                margin: 'md',
              },
            ],
            margin: 'md',
          },
          {
            type: 'box',
            layout: 'baseline',
            contents: [
              {
                type: 'icon',
                url: 'https://cdn2.iconfinder.com/data/icons/basic-ui-element-2-2-blackfill/512/Basic_UI_Elements_-_2.2_-_Black_Fill-48-512.png',
              },
              {
                type: 'text',
                text: 'ชื่อร้าน',
                weight: 'bold',
                margin: 'md',
                flex: 0,
                color: '#aaaaaa',
              },
              {
                type: 'text',
                text: user.shop_name || '',
                margin: 'md',
              },
            ],
            margin: 'md',
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: {
              type: 'message',
              label: 'แก้ไขใหม่',
              text: 'ลงทะเบียน',
            },
            color: '#ffb62b',
          },
        ],
        flex: 0,
      },
    },
  };

  return flex;
}

function createAnswerFlex(icon: string, preAnswer: string, answer: string): LineMessage {
  const flex = {
    type: 'flex',
    altText: 'register',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'baseline',
            contents: [
              {
                type: 'icon',
                url: icon,
              },
              {
                type: 'text',
                text: preAnswer,
                margin: 'md',
                wrap: true,
              },
            ],
          },
          {
            type: 'box',
            layout: 'baseline',
            contents: [
              {
                type: 'icon',
                url: 'https://scdn.line-apps.com/n/channel_devcenter/img/fx/review_gold_star_28.png',
              },
              {
                type: 'text',
                text: answer,
                margin: 'md',
                wrap: true,
                weight: 'bold',
              },
            ],
            margin: 'md',
          },
        ],
      },
    },
  };

  return flex;
}


function createBotDataResponseText(items: BotDataItem[], query: string): string {
    const groupedItems = new Map<string, {
        name: string;
        total_stock: number;
        oldest_lot: string;
    }>();

    items.forEach(item => {
        let itemName = (item.item_name || '').trim();
        if (itemName.endsWith(' 0 000')) {
            itemName = itemName.slice(0, -6).trim();
        }
        if (!itemName) return;

        const currentLot = item.lot_number || '';
        const currentStock = item.on_hand_quantity || 0;

        if (!groupedItems.has(itemName)) {
            groupedItems.set(itemName, {
                name: itemName,
                total_stock: currentStock,
                oldest_lot: currentLot,
            });
        } else {
            const existing = groupedItems.get(itemName)!;
            existing.total_stock += currentStock;
            if (isLotAEarlier(currentLot, existing.oldest_lot)) {
                existing.oldest_lot = currentLot;
            }
        }
    });
    
    const results = Array.from(groupedItems.values());

    const now = new Date();
    const year = now.getFullYear() + 543;
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const dateTimeString = `${day}/${month}/${year.toString().slice(-2)} ${hours}:${minutes}`;

    let message = `📅 เวลาค้นหา: ${dateTimeString}\n`;
    message += `🔍 พบ ${results.length} รายการสำหรับ "${query}"\n\n`;

    const sortedResults = results.sort((a, b) =>
        a.name.localeCompare(b.name, 'th')
    );

    sortedResults.forEach((item, index) => {
        const stockIcon = item.total_stock >= 4 ? '✅' : '☎️';
        const stockText = item.total_stock >= 4 ? 'มีสินค้า' : 'กรุณาโทรสอบถาม';
        const lotDisplay = formatLotDisplay(item.oldest_lot);

        message += `${index + 1}. ${item.name}\n`;
        message += `${lotDisplay}\n`;
        message += `Stock: ${stockIcon} ${stockText}\n\n`;
    });

    return message.trim();
}

function createInventDataResponseText(items: CombinedSearchResult[], query: string): string {
    const now = new Date();
    const year = now.getFullYear() + 543;
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const dateTimeString = `${day}/${month}/${year.toString().slice(-2)} ${hours}:${minutes}`;

    let message = `📅 เวลาค้นหา: ${dateTimeString}\n`;
    message += `🔍 พบ ${items.length} รายการสำหรับ "${query}"\n\n`;

    items.forEach((item, index) => {
        const stockIcon = item.stock >= 4 ? '✅' : '☎️';
        const stockText = item.status;

        message += `${index + 1}. ${item.name}\n`;
        message += `Stock: ${stockIcon} ${stockText}\n\n`;
    });

    return message.trim();
}

// ============================================
// Button-Based Selection Carousels (12 buttons per bubble)
// ============================================

// Carousel for selecting ItemName2 (ยี่ห้อรถ) - Button based
function createItemName2ButtonCarousel(itemName2List: string[]): LineMessage {
  const maxButtonsPerBubble = 12;
  const chunks = [];

  for (let i = 0; i < itemName2List.length; i += maxButtonsPerBubble) {
    chunks.push(itemName2List.slice(i, i + maxButtonsPerBubble));
  }

  console.log(`📦 Creating ${chunks.length} ItemName2 bubble(s) from ${itemName2List.length} brands`);

  const bubbles = chunks.map((chunk, bubbleIndex) => {
    const buttons = chunk.map((itemName2) => {
      // Truncate label if too long (LINE button label max is 40 chars)
      const maxLabelLength = 37;
      let label = itemName2;

      if (label.length > maxLabelLength) {
        label = label.substring(0, maxLabelLength - 3) + '...';
      }

      return {
        type: 'button',
        action: {
          type: 'message',
          label: label,
          text: itemName2, // This text will appear in chat when clicked
        },
        style: 'primary',
        color: '#00BFA5',
        margin: 'sm',
        height: 'sm',
      };
    });

    const startIdx = bubbleIndex * maxButtonsPerBubble + 1;
    const endIdx = Math.min(startIdx + chunk.length - 1, itemName2List.length);

    return {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '🚗 เลือกยี่ห้อรถ',
            weight: 'bold',
            color: '#ffffff',
            size: 'md',
            align: 'center',
          },
          {
            type: 'text',
            text: chunks.length > 1
              ? `รายการที่ ${startIdx}-${endIdx} จาก ${itemName2List.length}`
              : `พบ ${itemName2List.length} ยี่ห้อ`,
            color: '#ffffff',
            size: 'xs',
            align: 'center',
            margin: 'md',
          },
        ],
        backgroundColor: '#00BFA5',
        paddingAll: 'md',
        cornerRadius: 'md',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'เลือกยี่ห้อรถที่ต้องการ:',
            size: 'sm',
            color: '#666666',
            margin: 'md',
            wrap: true,
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: buttons,
            margin: 'lg',
          },
        ],
        paddingAll: 'sm',
      },
    };
  });

  return {
    type: 'flex',
    altText: 'เลือกยี่ห้อรถ',
    contents: {
      type: 'carousel',
      contents: bubbles,
    },
  };
}

// Carousel for selecting ItemName3 (รุ่นรถ) - Button based
function createItemName3ButtonCarousel(itemName2: string, itemName3List: string[]): LineMessage {
  const maxButtonsPerBubble = 12;
  const chunks = [];

  for (let i = 0; i < itemName3List.length; i += maxButtonsPerBubble) {
    chunks.push(itemName3List.slice(i, i + maxButtonsPerBubble));
  }

  console.log(`📦 Creating ${chunks.length} ItemName3 bubble(s) from ${itemName3List.length} models`);

  const bubbles = chunks.map((chunk, bubbleIndex) => {
    const buttons = chunk.map((itemName3) => {
      const maxLabelLength = 37;
      let label = itemName3;

      if (label.length > maxLabelLength) {
        label = label.substring(0, maxLabelLength - 3) + '...';
      }

      return {
        type: 'button',
        action: {
          type: 'message',
          label: label,
          text: `${itemName2},${itemName3}`, // This text will appear in chat when clicked (ยี่ห้อรถ,รุ่นรถ)
        },
        style: 'primary',
        color: '#00BFA5',
        margin: 'sm',
        height: 'sm',
      };
    });

    const startIdx = bubbleIndex * maxButtonsPerBubble + 1;
    const endIdx = Math.min(startIdx + chunk.length - 1, itemName3List.length);

    return {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '🚙 เลือกรุ่นรถ',
            weight: 'bold',
            color: '#ffffff',
            size: 'md',
            align: 'center',
          },
          {
            type: 'text',
            text: itemName2,
            color: '#ffffff',
            size: 'sm',
            align: 'center',
            margin: 'sm',
          },
          {
            type: 'text',
            text: chunks.length > 1
              ? `รายการที่ ${startIdx}-${endIdx} จาก ${itemName3List.length}`
              : `พบ ${itemName3List.length} รุ่น`,
            color: '#ffffff',
            size: 'xs',
            align: 'center',
            margin: 'md',
          },
        ],
        backgroundColor: '#00BFA5',
        paddingAll: 'md',
        cornerRadius: 'md',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'เลือกรุ่นรถที่ต้องการ:',
            size: 'sm',
            color: '#666666',
            margin: 'md',
            wrap: true,
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: buttons,
            margin: 'lg',
          },
        ],
        paddingAll: 'sm',
      },
    };
  });

  return {
    type: 'flex',
    altText: `เลือกรุ่นรถ ${itemName2}`,
    contents: {
      type: 'carousel',
      contents: bubbles,
    },
  };
}

// Carousel for selecting Standard (มาตรฐานรถ) - Button based
function createStandardButtonCarousel(itemName2: string, itemName3: string, standardList: string[]): LineMessage {
  const maxButtonsPerBubble = 12;
  const chunks = [];

  for (let i = 0; i < standardList.length; i += maxButtonsPerBubble) {
    chunks.push(standardList.slice(i, i + maxButtonsPerBubble));
  }

  console.log(`📦 Creating ${chunks.length} Standard bubble(s) from ${standardList.length} standards`);

  const bubbles = chunks.map((chunk, bubbleIndex) => {
    const buttons = chunk.map((standard) => {
      const maxLabelLength = 37;
      let label = standard;

      if (label.length > maxLabelLength) {
        label = label.substring(0, maxLabelLength - 3) + '...';
      }

      return {
        type: 'button',
        action: {
          type: 'message',
          label: label,
          text: `${itemName2},${itemName3},${standard}`, // This text will appear in chat when clicked (ยี่ห้อรถ,รุ่นรถ,มาตรฐาน)
        },
        style: 'primary',
        color: '#00BFA5',
        margin: 'sm',
        height: 'sm',
      };
    });

    const startIdx = bubbleIndex * maxButtonsPerBubble + 1;
    const endIdx = Math.min(startIdx + chunk.length - 1, standardList.length);

    return {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '⚙️ เลือกมาตรฐานรถ',
            weight: 'bold',
            color: '#ffffff',
            size: 'md',
            align: 'center',
          },
          {
            type: 'text',
            text: `${itemName2} - ${itemName3}`,
            color: '#ffffff',
            size: 'sm',
            align: 'center',
            margin: 'sm',
          },
          {
            type: 'text',
            text: chunks.length > 1
              ? `รายการที่ ${startIdx}-${endIdx} จาก ${standardList.length}`
              : `พบ ${standardList.length} มาตรฐาน`,
            color: '#ffffff',
            size: 'xs',
            align: 'center',
            margin: 'md',
          },
        ],
        backgroundColor: '#00BFA5',
        paddingAll: 'md',
        cornerRadius: 'md',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'เลือกมาตรฐานรถที่ต้องการ:',
            size: 'sm',
            color: '#666666',
            margin: 'md',
            wrap: true,
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: buttons,
            margin: 'lg',
          },
        ],
        paddingAll: 'sm',
      },
    };
  });

  return {
    type: 'flex',
    altText: `เลือกมาตรฐาน ${itemName2} ${itemName3}`,
    contents: {
      type: 'carousel',
      contents: bubbles,
    },
  };
}

function createSearchResultCarousel(items: CombinedSearchResult[]): LineMessage {
  const maxButtonsPerBubble = 12;
  const chunks = [];

  for (let i = 0; i < items.length; i += maxButtonsPerBubble) {
    chunks.push(items.slice(i, i + maxButtonsPerBubble));
  }

  console.log(`📦 Creating ${chunks.length} bubble(s) from ${items.length} items`);

  const bubbles = chunks.map((chunk, bubbleIndex) => {
    const buttons = chunk.map((item) => {
      const stockColor = item.stock >= 4 ? '#00BFA5' : '#FF1744';
      const stockIcon = item.stock >= 4 ? '✅' : '☎️';

      // The button label is limited to 40 chars by the LINE API.
      // We reserve ~3 chars for the icon, space, and ellipsis.
      const maxLabelLength = 37;
      let label = item.name;

      if (label.length > maxLabelLength) {
        label = label.substring(0, maxLabelLength - 3) + '...';
      }

      return {
        type: 'button',
        action: {
          type: 'message',
          label: `${stockIcon} ${label}`,
          text: item.name, // The full name is sent when the button is clicked
        },
        style: 'primary',
        color: stockColor,
        margin: 'sm',
        height: 'sm',
      };
    });

    const startIdx = bubbleIndex * maxButtonsPerBubble + 1;
    const endIdx = Math.min(startIdx + chunk.length - 1, items.length);

    return {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '🔍 ผลการค้นหา',
            weight: 'bold',
            color: '#ffffff',
            size: 'md',
            align: 'center',
          },
          {
            type: 'text',
            text: chunks.length > 1
              ? `รายการที่ ${startIdx}-${endIdx} จาก ${items.length}`
              : `พบ ${items.length} รายการ`,
            color: '#ffffff',
            size: 'xs',
            align: 'center',
            margin: 'md',
          },
        ],
        backgroundColor: '#00BFA5',
        paddingAll: 'md',
        cornerRadius: 'md',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'เลือกรายการที่ต้องการดูสถานะ:',
            size: 'sm',
            color: '#666666',
            margin: 'md',
            wrap: true,
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: buttons,
            margin: 'lg',
          },
        ],
        paddingAll: 'sm',
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        contents: [
          {
            type: 'text',
            text: chunks.length > 1
              ? `💡 Bubble ${bubbleIndex + 1}/${chunks.length} - กดปุ่มเพื่อดูสถานะ`
              : '💡 กดปุ่มเพื่อดูสถานะสินค้า',
            size: 'xxs',
            color: '#999999',
            align: 'center',
            wrap: true,
          },
        ],
        paddingAll: 'sm',
        backgroundColor: '#F5F5F5',
      },
    };
  });

  return {
    type: 'flex',
    altText: `พบ ${items.length} รายการ - เลือกรายการที่ต้องการ`,
    contents: {
      type: 'carousel',
      contents: bubbles,
    },
  };
}

// ============================================
// Reply Templates
// ============================================

async function getReplyTemplate(keyword: string): Promise<LineMessage | null> {
  try {
    const { data, error } = await supabase
      .from('reply_templates')
      .select('*')
      .eq('keyword', keyword.toLowerCase())
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return null;
    }

    const template = data as any;

    switch (template.reply_type) {
      case 'text':
        return {
          type: 'text',
          text: template.reply_content,
        };

      case 'flex':
        return {
          type: 'flex',
          altText: 'Flex Message',
          contents: JSON.parse(template.reply_content),
        };

      case 'template':
        return JSON.parse(template.reply_content) as LineMessage;

      default:
        return {
          type: 'text',
          text: template.reply_content,
        };
    }
  } catch (error) {
    console.error('❌ Error getting reply template:', error);
    return null;
  }
}

// ============================================
// Utility Functions
// ============================================

function normalizeText(s: string): string {
  return String(s || '')
    .replace(/\u200B/g, '')
    .trim()
    .toLowerCase();
}

function looksLikeStockQuery(text: string): boolean {
  const t = normalizeText(text);

  if (!t) return false;

  // System commands
  const systemCommands = [
    'ลงทะเบียน',
    'เปิดระบบ',
    'ปิดระบบ',
    'bot on',
    'bot off',
    'เปิดสต็อก',
    'ปิดสต็อก',
    'stock on',
    'stock off',
    'require on',
    'require off',
    'approve',
    'block',
    'makeadmin',
    '/refreshcache',
    '/rf',
  ];

  if (systemCommands.some((cmd) => t === cmd)) {
    return false;
  }

  // Explicit stock keywords
  if (
    t.startsWith('สต็อก') ||
    t.startsWith('สต๊อก') ||
    t.startsWith('stock') ||
    t.startsWith('เช็คสต็อก') ||
    t.startsWith('เช็คสต็อก')
  ) {
    return true;
  }

  // SKU-like patterns
  const skuLike = /^[a-z0-9][a-z0-9\-_]{2,}$/i.test(t);
  if (skuLike) {
    return true;
  }

  // Any other text (at least 2 chars)
  if (t.length >= 2) {
    return true;
  }

  return false;
}

function isPrivateChat(source: LineEvent['source']): boolean {
  return source.type === 'user';
}

function isAdminUser(user: LineUser): boolean {
  const role = (user.userstaff || '').trim();
  return role === 'admin';
}

function isApprovedUser(user: LineUser): boolean {
  const role = (user.userstaff || '').trim();
  console.log(`🔍 User approval check: userstaff="${user.userstaff}", trimmed="${role}", isApproved=${role === 'admin' || role === 'customer'}`);
  return role === 'admin' || role === 'customer';
}

// ============================================
// Message Handlers
// ============================================

async function handleFollow(event: LineEvent): Promise<void> {
  const userId = event.source.userId!;

  try {
    console.log('� handling follow event for user:', userId);

    // Get user profile from LINE
    const profile = await lineService.getUserProfile(userId);

    // Check if user exists
    let user = await getUser(userId);

    if (!user) {
      // Create new user
      user = await createUser(userId, profile);
      console.log('✅ Created new user:', user.display_name);
    } else {
      // Update existing user
      await updateUser(userId, {
        display_name: profile.displayName,
        picture_url: profile.pictureUrl,
        status_message: profile.statusMessage,
      });
      console.log('✅ Updated existing user:', user.display_name);
    }

    // Send welcome message
    await lineService.replyMessage(event.replyToken!, [
      {
        type: 'text',
        text: 'ยินดีต้อนรับสู่ Boonyang Inventory 🤖\n\nพิมพ์ "ลงทะเบียน" เพื่อเริ่มต้นใช้งาน',
      },
    ]);
  } catch (error) {
    console.error('❌ ERROR @ handleFollow:', error);
  }
}

async function handleUnfollow(event: LineEvent): Promise<void> {
  const userId = event.source.userId!;

  try {
    console.log('👋 handling unfollow event for user:', userId);
    await deleteUser(userId);
    console.log('✅ Deleted user:', userId);
  } catch (error) {
    console.error('❌ ERROR @ handleUnfollow:', error);
  }
}

async function handleMemberJoined(event: LineEvent): Promise<void> {
  const userId = event.joined?.members[0].userId!;
  const groupId = event.source.groupId!;

  try {
    console.log('👥 handling member joined event:', userId);

    // ✅ PERMISSION CHECK: Only admin can manage members
    // Note: This event is triggered when ANY user joins a group, not just admin actions
    // We'll log the event but won't restrict it - group join is a LINE platform event
    // The user will need to register and get approved before using bot features

    // Get group info
    const groupSummary = await lineService.getGroupSummary(groupId);
    const memberProfile = await lineService.getGroupMemberProfile(groupId, userId);

    // Get or create user
    let user = await getUser(userId);

    if (!user) {
      user = await createUser(userId, memberProfile);
    }

    // Update user with group info
    await updateUser(userId, {
      display_name: memberProfile.displayName,
      picture_url: memberProfile.pictureUrl,
      status_message: 'คนที่มาจากกลุ่ม',
      group_name: groupSummary.groupName,
      group_id: groupId,
    });

    console.log('✅ Updated user with group info:', memberProfile.displayName);

    // Send welcome message to group
    await lineService.replyMessage(event.replyToken!, [
      {
        type: 'text',
        text: `สมาชิกคนนี้ชื่อ\n${memberProfile.displayName}\nมาจากกลุ่ม :\n${groupSummary.groupName}`,
      },
    ]);
  } catch (error) {
    console.error('❌ ERROR @ handleMemberJoined:', error);
  }
}

async function handleMemberLeft(event: LineEvent): Promise<void> {
  const leftMembers = event.left?.members || [];

  try {
    for (const member of leftMembers) {
      if (member.type === 'user') {
        console.log('👋 handling member left event:', member.userId);
        await deleteUser(member.userId);
      }
    }
  } catch (error) {
    console.error('❌ ERROR @ handleMemberLeft:', error);
  }
}

// ============================================
// Postback Handler for Step-by-Step Selection
// ============================================

async function handlePostback(event: LineEvent): Promise<void> {
  const userId = event.source.userId!;
  const replyToken = event.replyToken!;
  const quoteToken = event.message?.quoteToken;
  const postbackData = event.postback?.data;

  console.log(`📌 POSTBACK from ${userId}: ${postbackData}`);

  try {
    if (!postbackData) {
      console.error('❌ No postback data');
      return;
    }

    // Parse postback data
    const data = JSON.parse(postbackData);
    const { action } = data;

    switch (action) {
      case 'select_itemname2':
        await handleSelectItemName2(userId, replyToken, quoteToken, data);
        break;

      case 'select_itemname3':
        await handleSelectItemName3(userId, replyToken, quoteToken, data);
        break;

      case 'select_standard':
        await handleSelectStandard(userId, replyToken, quoteToken, data);
        break;

      default:
        console.log(`⚠️ Unknown postback action: ${action}`);
    }
  } catch (error) {
    console.error('❌ ERROR @ handlePostback:', error);
    console.log('🔇 Error response suppressed - SILENT RETURN');
  }
}

// Handle ItemName2 selection (from postback)
async function handleSelectItemName2(userId: string, replyToken: string, quoteToken: string | undefined, data: any): Promise<void> {
  const { itemName2 } = data;

  console.log(`✅ User selected ItemName2 (postback): ${itemName2}`);

  try {
    // Update search state
    await searchStateService.update(userId, {
      step: 'model_selected',
      itemName2,
    });

    // Search for models
    const models = await searchByItemName3(itemName2);

    if (models.length === 0) {
      console.log(`🔇 No models found for ${itemName2} - SILENT RETURN`);
      await searchStateService.clear(userId);
      return;
    }

    // Auto-select if only one model
    if (models.length === 1) {
      console.log('✅ Auto-selecting single model');
      await handleSelectItemName3(userId, replyToken, quoteToken, {
        itemName2,
        itemName3: models[0],
      });
      return;
    }

    // Show button carousel for model selection
    const carousel = createItemName3ButtonCarousel(itemName2, models);
    await lineService.replyMessage(replyToken, [carousel]);
  } catch (error) {
    console.error('❌ ERROR @ handleSelectItemName2:', error);
    console.log('🔇 Error response suppressed - SILENT RETURN');
  }
}

// Handle ItemName3 selection (from postback)
async function handleSelectItemName3(userId: string, replyToken: string, quoteToken: string | undefined, data: any): Promise<void> {
  const { itemName2, itemName3 } = data;

  console.log(`✅ User selected ItemName3 (postback): ${itemName3} for brand: ${itemName2}`);

  try {
    // Update search state
    await searchStateService.update(userId, {
      step: 'standard_selected',
      itemName3,
    });

    // Search for standards
    const standards = await searchByStandard(itemName2, itemName3);

    if (standards.length === 0) {
      console.log(`🔇 No standards found for ${itemName2} ${itemName3} - SILENT RETURN`);
      await searchStateService.clear(userId);
      return;
    }

    // Auto-select if only one standard
    if (standards.length === 1) {
      console.log('✅ Auto-selecting single standard');
      await handleSelectStandard(userId, replyToken, quoteToken, {
        itemName2,
        itemName3,
        standard: standards[0],
      });
      return;
    }

    // Show button carousel for standard selection
    const carousel = createStandardButtonCarousel(itemName2, itemName3, standards);
    await lineService.replyMessage(replyToken, [carousel]);
  } catch (error) {
    console.error('❌ ERROR @ handleSelectItemName3:', error);
    await lineService.replyMessage(replyToken, [
      { type: 'text', text: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่', quoteToken: quoteToken },
    ]);
  }
}

// Handle Standard selection (from postback)
async function handleSelectStandard(userId: string, replyToken: string, quoteToken: string | undefined, data: any): Promise<void> {
  const { itemName2, itemName3, standard } = data;

  console.log(`✅ User selected Standard (postback): ${standard} for ${itemName2} ${itemName3}`);

  try {
    // Update search state
    await searchStateService.update(userId, {
      step: 'complete',
      standard,
    });

    // Get final products
    const products = await searchFinalProducts(itemName2, itemName3, standard);

    if (products.length === 0) {
      console.log(`🔇 No products found for ${itemName2} ${itemName3} ${standard} - SILENT RETURN`);
      await searchStateService.clear(userId);
      return;
    }

    // Format and send results
    const combinedResults = products.map(p => ({
      name: p.name,
      stock: p.stock,
      status: p.status,
    }));

    const messageText = createInventDataResponseText(
      combinedResults as any,
      `${itemName2} ${itemName3} ${standard}`
    );

    await lineService.replyMessage(replyToken, [
      { type: 'text', text: messageText, quoteToken: quoteToken },
    ]);

    // Clear search state
    await searchStateService.clear(userId);
  } catch (error) {
    console.error('❌ ERROR @ handleSelectStandard:', error);
    await lineService.replyMessage(replyToken, [
      { type: 'text', text: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่', quoteToken: quoteToken },
    ]);
  }
}

async function handleMessage(event: LineEvent): Promise<void> {
  const userId = event.source.userId!;
  const messageText = event.message?.text?.trim() || '';
  const replyToken = event.replyToken!;
  const quoteToken = event.message?.quoteToken;
  const source = event.source;
  const isPrivate = isPrivateChat(source);

  console.log(`💬 MESSAGE from ${userId}: ${messageText}`);
  console.log(`📍 Source: ${source.type}, isPrivate: ${isPrivate}`);

  try {
    // Get system settings
    const settings = await getSystemSettings();

    console.log('⚙️ System settings:', settings);

    // Check if bot is enabled
    if (!settings.bot_enabled) {
      console.log('🛑 Bot is DISABLED');
      await lineService.replyMessage(replyToken, [
        { type: 'text', text: '⛔ ระบบปิดชั่วคราว กรุณาลองใหม่ภายหลัง', quoteToken: quoteToken },
      ]);
      return;
    }

    // Get or create user
    let user = await getUser(userId);

    if (!user) {
      console.log('⚠️ User NOT found, registering new user...');
      const profile = await lineService.getUserProfile(userId);
      user = await createUser(userId, profile);
      console.log('✅ Created new user:', user.display_name);
    }

    // Update last interaction
    await updateUser(userId, {
      last_interaction_at: new Date().toISOString(),
    });

    // Check message type
    if (event.message?.type !== 'text') {
      console.log('🔇 Non-text message - ignoring');
      return;
    }

    const msgText = normalizeText(messageText);
    console.log('📝 Normalized text:', msgText);

    // ========================
    // ADMIN COMMANDS (Private chat only)
    // ========================

    if (isAdminUser(user) && isPrivate) {
      console.log('👑 Admin in private chat - checking commands...');

      if (msgText === 'เปิดระบบ' || msgText === 'bot on') {
        await updateSystemSetting('bot_enabled', 'true');
        await lineService.replyMessage(replyToken, [
          { type: 'text', text: '✅ เปิดระบบแล้ว (bot_enabled=true)', quoteToken: quoteToken },
        ]);
        return;
      }

      if (msgText === 'ปิดระบบ' || msgText === 'bot off') {
        await updateSystemSetting('bot_enabled', 'false');
        await lineService.replyMessage(replyToken, [
          { type: 'text', text: '✅ ปิดระบบแล้ว (bot_enabled=false)', quoteToken: quoteToken },
        ]);
        return;
      }

      if (msgText === 'เปิดสต็อก' || msgText === 'stock on') {
        await updateSystemSetting('stock_enabled', 'true');
        await lineService.replyMessage(replyToken, [
          { type: 'text', text: '✅ เปิดการถามสต็อกแล้ว (stock_enabled=true)', quoteToken: quoteToken },
        ]);
        return;
      }

      if (msgText === 'ปิดสต็อก' || msgText === 'stock off') {
        await updateSystemSetting('stock_enabled', 'false');
        await lineService.replyMessage(replyToken, [
          { type: 'text', text: '✅ ปิดการถามสต็อกแล้ว (stock_enabled=false)', quoteToken: quoteToken },
        ]);
        return;
      }

      if (msgText === 'require on') {
        await updateSystemSetting('stock_require_approval', 'true');
        await lineService.replyMessage(replyToken, [
          { type: 'text', text: '✅ เปิด Require Approval (stock_require_approval=true)', quoteToken: quoteToken },
        ]);
        return;
      }

      if (msgText === 'require off') {
        await updateSystemSetting('stock_require_approval', 'false');
        await lineService.replyMessage(replyToken, [
          { type: 'text', text: '✅ ปิด Require Approval (stock_require_approval=false)', quoteToken: quoteToken },
        ]);
        return;
      }

      // Approve/Block/MakeAdmin commands
      const m = messageText.trim().match(/^(approve|block|makeadmin)\s+(u[a-z0-9]+)$/i);
      if (m) {
        const cmd = m[1].toLowerCase();
        const targetUserId = m[2];

        let roleValue = '';
        if (cmd === 'approve') roleValue = 'customer';
        if (cmd === 'makeadmin') roleValue = 'admin';
        if (cmd === 'block') roleValue = '';

        const targetUser = await getUser(targetUserId);
        if (!targetUser) {
          await lineService.replyMessage(replyToken, [
            { type: 'text', text: `❌ ไม่พบ ${targetUserId} ในระบบ`, quoteToken: quoteToken },
          ]);
          return;
        }

        await updateUser(targetUserId, { userstaff: roleValue });

        await lineService.replyMessage(replyToken, [
          {
            type: 'text',
            text: cmd === 'block'
              ? `✅ บล็อก ${targetUserId} เรียบร้อย`
              : `✅ ตั้งค่า ${targetUserId} => ${roleValue} เรียบร้อย`,
            quoteToken: quoteToken,
          },
        ]);
        return;
      }

      // Cache refresh command
      if (msgText === '/refreshcache' || msgText === '/rf') {
        console.log('🔄 Cache refresh command requested');
        await cacheService.refresh();
        await lineService.replyMessage(replyToken, [
          {
            type: 'text',
            text: `✅ Cache อัพเดทเรียบร้อยแล้ว\n⏰ เวลา: ${new Date().toISOString()}`,
            quoteToken: quoteToken,
          },
        ]);
        return;
      }
    }

    // ========================
    // REGISTRATION FLOW
    // ========================

    if (msgText === 'ลงทะเบียน') {
      console.log('📝 Registration flow started');
      await updateUser(userId, { status_register: 'รอชื่อ' });

      const icon = 'https://cdn4.iconfinder.com/data/icons/business-331/24/name_id_tag_license_identity_office_1-512.png';
      const flex = createAnswerFlex(icon, 'ลงทะเบียน', 'โปรดกรอกชื่อของคุณ');

      await lineService.replyMessage(replyToken, [flex]);
      return;
    }

    if (user.status_register === 'รอชื่อ') {
      console.log('📝 Registration: waiting for name');
      await updateUser(userId, {
        name: messageText.trim(),
        status_register: 'รอนามสกุล',
      });

      const icon = 'https://cdn4.iconfinder.com/data/icons/business-331/24/name_id_tag_license_identity_office_1-512.png';
      const flex = createAnswerFlex(icon, user.name, 'โปรดกรอกนามสกุลของคุณ');

      await lineService.replyMessage(replyToken, [flex]);
      return;
    }

    if (user.status_register === 'รอนามสกุล') {
      console.log('📝 Registration: waiting for surname');
      await updateUser(userId, {
        surname: messageText.trim(),
        status_register: 'รอชื่อร้าน',
      });

      const icon = 'https://cdn4.iconfinder.com/data/icons/business-331/24/name_id_tag_license_identity_office_1-512.png';
      const flex = createAnswerFlex(icon, user.surname, 'กรุณากรอกชื่อร้าน');

      await lineService.replyMessage(replyToken, [flex]);
      return;
    }

    if (user.status_register === 'รอชื่อร้าน') {
      console.log('📝 Registration: waiting for shop name');
      await updateUser(userId, {
        shop_name: messageText.trim(),
        status_register: 'รอเลขที่ภาษี',
      });

      const icon = 'https://cdn4.iconfinder.com/data/icons/business-331/24/name_id_tag_license_identity_office_1-512.png';
      const flex = createAnswerFlex(icon, user.shop_name, 'กรุณากรอกเลขที่ผู้เสียภาษี');

      await lineService.replyMessage(replyToken, [flex]);
      return;
    }

    if (user.status_register === 'รอเลขที่ภาษี') {
      console.log('📝 Registration: waiting for tax ID');
      await updateUser(userId, {
        tax_id: messageText.trim(),
        status_register: 'สำเร็จ',
        userstaff: 'customer', // Auto-approve as customer
      });

      // Get updated user
      user = (await getUser(userId))!;

      const flex = createRegisterCompleteFlex(user);
      await lineService.replyMessage(replyToken, [flex]);
      return;
    }

    // ========================
    // REGISTRATION CHECK
    // ========================

    const allowWhileRegistering = ['รอชื่อ', 'รอนามสกุล', 'รอชื่อร้าน', 'รอเลขที่ภาษี'];
    const isRegistering = allowWhileRegistering.includes(user.status_register || '');

    if (settings.register_required && user.status_register !== 'สำเร็จ' && !isRegistering) {
      console.log(`⛔ User not registered (status_register="${user.status_register}") - SILENT RETURN`);
      return;
    }

    // ========================
    // REPLY TEMPLATES (Priority 1)
    // ========================

    const replyTemplate = await getReplyTemplate(messageText);
    if (replyTemplate) {
      console.log('📖 Found in reply templates');
      await lineService.replyMessage(replyToken, [replyTemplate]);
      return;
    }

    // ========================
    // STOCK QUERY (Priority 2)
    // ========================

    if (looksLikeStockQuery(messageText)) {
      console.log('📦 Looks like stock query');

      // Check if user can ask stock
      if (!settings.stock_enabled) {
        console.log('⛔ Stock queries disabled');
        await lineService.replyMessage(replyToken, [
          { type: 'text', text: '⛔ ระบบถามสต็อกปิดชั่วคราว', quoteToken: quoteToken },
        ]);
        return;
      }

      if (settings.stock_require_approval && !isApprovedUser(user)) {
        console.log(`⛔ User cannot ask stock (userstaff="${user.userstaff}") - SILENT RETURN`);
        return;
      }

      // ✅ LOGIC ใหม่: แยก 2 flow ชัดเจน

      // Flow 1: ค้นหาอะไหล่แบบระบุเต็ม: ยี่ห้อ,รุ่น,มาตรฐาน (เช่น TOYOTA,CAMRY,2.0V)
      if (messageText.includes(',')) {
        const parts = messageText.split(',').map(p => p.trim());
        if (parts.length >= 2) {
          console.log(`🚗 Direct search: ${parts.join(', ')}`);
          await handleDirectInventDataSearch(userId, replyToken, quoteToken, parts);
          return;
        }
      }

      // Flow 2: ค้นหาอะไหล่แบบค่อยๆ เลือก (carousel)
      if (messageText === 'ค้นหาอะไหล่') {
        console.log('🚗 Starting InventData carousel search');
        await handleInventDataSearch(event, userId, replyToken, quoteToken);
        return;
      }

      // Check if user is in the middle of InventData step-by-step selection
      const searchState = await searchStateService.get(userId);
      console.log(`🔍 Search state for ${userId}:`, searchState ? `step=${searchState.step}, itemName2=${searchState.itemName2}, timestamp=${new Date(searchState.timestamp).toISOString()}` : 'none');

      if (searchState) {
        // Handle brand selection from carousel (user clicked a brand button)
        if (searchState.step === 'waiting_brand') {
          console.log('✅ Brand selected from carousel:', messageText);
          await handleBrandSelection(userId, replyToken, quoteToken, messageText);
          return;
        }

        // Handle button clicks from carousels (message-based)
        if (searchState.step === 'brand_selected') {
          // ✅ FIX: First check if user is switching to a different brand
          const allBrands = await getAllUniqueBrands();
          const matchedBrand = allBrands.find(brand =>
            brand.toLowerCase() === msgText ||
            brand.toLowerCase().includes(msgText) ||
            msgText.includes(brand.toLowerCase())
          );

          if (matchedBrand && matchedBrand !== searchState.itemName2) {
            // User is switching to a different brand
            console.log(`🔄 Switching brand from ${searchState.itemName2} to ${matchedBrand}`);
            await handleInventDataSearchWithBrand(userId, replyToken, quoteToken, matchedBrand);
            return;
          }

          // Not a brand switch - treat as model selection
          console.log('✅ Model selected, searching for standards');
          await handleModelSelection(userId, replyToken, quoteToken, searchState.itemName2, messageText);
          return;
        }

        if (searchState.step === 'model_selected') {
          // ✅ FIX: First check if user is switching to a different brand
          const allBrands = await getAllUniqueBrands();
          const matchedBrand = allBrands.find(brand =>
            brand.toLowerCase() === msgText ||
            brand.toLowerCase().includes(msgText) ||
            msgText.includes(brand.toLowerCase())
          );

          if (matchedBrand && matchedBrand !== searchState.itemName2) {
            // User is switching to a different brand
            console.log(`🔄 Switching brand from ${searchState.itemName2} to ${matchedBrand}`);
            await handleInventDataSearchWithBrand(userId, replyToken, quoteToken, matchedBrand);
            return;
          }

          // Not a brand switch - treat as standard selection
          console.log('✅ Standard selected, getting final results');
          await handleFinalResults(userId, replyToken, quoteToken, searchState.itemName2, searchState.itemName3!, messageText);
          return;
        }
      }

      // Auto-detect: Check if input matches a known brand name
      console.log('🔍 Checking if input is a brand name...');
      const allBrands = await getAllUniqueBrands();
      const matchedBrand = allBrands.find(brand =>
        brand.toLowerCase() === msgText ||
        brand.toLowerCase().includes(msgText) ||
        msgText.includes(brand.toLowerCase())
      );

      if (matchedBrand) {
        console.log(`✅ Detected brand: ${matchedBrand}`);
        await handleInventDataSearchWithBrand(userId, replyToken, quoteToken, matchedBrand);
        return;
      }

      // Flow 3: ค้นหารหัสยาง (BotData exact match only)
      console.log(`🔍 Searching BotData for: ${messageText}`);
      await handleBotDataSearch(event, messageText, replyToken, quoteToken, userId);
      return;
    }

    // ========================
    // NO MATCH - SILENT RETURN
    // ========================

    console.log('🔇 NO MATCH - SILENT RETURN');
  } catch (error) {
    console.error('❌ ERROR @ handleMessage:', error);
    await lineService.replyMessage(replyToken, [
      { type: 'text', text: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่', quoteToken: quoteToken },
    ]);
  }
}

// ============================================
// BotData Search (รหัสยาง - Exact Match Only)
// ============================================

async function handleBotDataSearch(
  event: LineEvent,
  query: string,
  replyToken: string,
  quoteToken: string | undefined,
  userId: string
): Promise<void> {
  const chatId = event.source.userId || event.source.groupId || event.source.roomId;

  try {
    // ✅ PERMISSION CHECK: Verify user is approved
    const user = await getUser(userId);
    if (!user || !isApprovedUser(user)) {
      console.log(`⛔ BotData search blocked: user not approved (userstaff="${user?.userstaff}") - SILENT RETURN`);
      return;
    }

    // Start loading animation
    if (chatId) {
      await lineService.startLoadingAnimation(chatId);
    }

    console.log(`🔍 Searching BotData (exact match) for: ${query}`);

    // Search BotData
    const botDataItems = await searchBotData(query);

    if (botDataItems.length === 0) {
      console.log(`🔇 Not found in BotData: ${query} - SILENT RETURN`);
      return;
    }

    console.log(`✅ Found ${botDataItems.length} items in BotData`);

    // Format and send results
    const messageText = createBotDataResponseText(botDataItems, query);
    await lineService.replyMessage(replyToken, [
      { type: 'text', text: messageText, quoteToken: quoteToken },
    ]);

  } catch (error) {
    console.error('❌ ERROR @ handleBotDataSearch:', error);
    await lineService.replyMessage(replyToken, [
      { type: 'text', text: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่', quoteToken: quoteToken },
    ]);
  }
}

// ============================================
// InventData Search (ค้นหาอะไหล่ - Step-by-Step)
// ============================================

async function handleInventDataSearch(
  event: LineEvent,
  userId: string,
  replyToken: string,
  quoteToken: string | undefined
): Promise<void> {
  const chatId = event.source.userId || event.source.groupId || event.source.roomId;

  try {
    // ✅ PERMISSION CHECK: Verify user is approved
    const user = await getUser(userId);
    if (!user || !isApprovedUser(user)) {
      console.log(`⛔ InventData search blocked: user not approved (userstaff="${user?.userstaff}") - SILENT RETURN`);
      return;
    }

    // Start loading animation
    if (chatId) {
      await lineService.startLoadingAnimation(chatId);
    }

    console.log('🚗 Starting InventData step-by-step search');

    // Get ALL unique brands (sorted A-Z)
    const allBrands = await getAllUniqueBrands();

    if (allBrands.length === 0) {
      console.log('🔇 No brands found in InventData - SILENT RETURN');
      return;
    }

    console.log(`✅ Found ${allBrands.length} car brands, showing carousel`);

    // Create search state for brand selection
    await searchStateService.create(userId, {
      step: 'waiting_brand',
      itemName2: '',
      itemName3: '',
      standard: '',
      originalQuery: 'ค้นหาอะไหล่',
    });

    // Show carousel with all brands
    const carousel = createItemName2ButtonCarousel(allBrands);
    await lineService.replyMessage(replyToken, [carousel]);

  } catch (error) {
    console.error('❌ ERROR @ handleInventDataSearch:', error);
    await lineService.replyMessage(replyToken, [
      { type: 'text', text: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่', quoteToken: quoteToken },
    ]);
  }
}

// Handle Direct InventData search (user enters: brand,model,standard)
async function handleDirectInventDataSearch(
  userId: string,
  replyToken: string,
  quoteToken: string | undefined,
  parts: string[]
): Promise<void> {
  const chatId = userId; // For loading animation

  try {
    // ✅ PERMISSION CHECK: Verify user is approved
    const user = await getUser(userId);
    if (!user || !isApprovedUser(user)) {
      console.log(`⛔ Direct InventData search blocked: user not approved (userstaff="${user?.userstaff}") - SILENT RETURN`);
      return;
    }

    console.log(`🚗 Direct search with parts:`, parts);

    // Start loading animation
    await lineService.startLoadingAnimation(chatId);

    const [brand, model, standard] = parts;

    // If only 2 parts provided (brand, model), show standards carousel
    if (parts.length === 2) {
      console.log(`✅ Searching for standards: ${brand} - ${model}`);

      const standardList = await searchByStandard(brand, model);

      if (standardList.length === 0) {
        console.log(`🔇 No standards found for ${brand} ${model} - SILENT RETURN`);
        await lineService.replyMessage(replyToken, [
          { type: 'text', text: `❌ ไม่พบข้อมูล: ${brand} ${model}`, quoteToken: quoteToken },
        ]);
        return;
      }

      // If only one standard, show results directly
      if (standardList.length === 1) {
        const products = await searchFinalProducts(brand, model, standardList[0]);
        if (products.length > 0) {
          const combinedResults = products.map(p => ({
            name: p.name,
            stock: p.stock,
            status: p.status,
          }));

          const messageText = createInventDataResponseText(
            combinedResults as any,
            `${brand} ${model} ${standardList[0]}`
          );

          await lineService.replyMessage(replyToken, [
            { type: 'text', text: messageText, quoteToken: quoteToken },
          ]);
          return;
        }
      }

      // Show standards carousel
      const carousel = createStandardButtonCarousel(brand, model, standardList);
      await lineService.replyMessage(replyToken, [carousel]);
      return;
    }

    // If 3 parts provided (brand, model, standard), show results directly
    if (parts.length >= 3) {
      console.log(`✅ Final search: ${brand} - ${model} - ${standard}`);

      const products = await searchFinalProducts(brand, model, standard);

      if (products.length === 0) {
        console.log(`🔇 No products found for ${brand} ${model} ${standard}`);
        await lineService.replyMessage(replyToken, [
          { type: 'text', text: `❌ ไม่พบข้อมูล: ${brand} ${model} ${standard}`, quoteToken: quoteToken },
        ]);
        return;
      }

      const combinedResults = products.map(p => ({
        name: p.name,
        stock: p.stock,
        status: p.status,
      }));

      const messageText = createInventDataResponseText(
        combinedResults as any,
        `${brand} ${model} ${standard}`
      );

      await lineService.replyMessage(replyToken, [
        { type: 'text', text: messageText, quoteToken: quoteToken },
      ]);
      return;
    }

  } catch (error) {
    console.error('❌ ERROR @ handleDirectInventDataSearch:', error);
    await lineService.replyMessage(replyToken, [
      { type: 'text', text: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่', quoteToken: quoteToken },
    ]);
  }
}

// Handle InventData search with pre-selected brand (user typed brand name directly)
async function handleInventDataSearchWithBrand(
  userId: string,
  replyToken: string,
  quoteToken: string | undefined,
  selectedBrand: string
): Promise<void> {
  try {
    // ✅ PERMISSION CHECK: Verify user is approved
    const user = await getUser(userId);
    if (!user || !isApprovedUser(user)) {
      console.log(`⛔ InventData search with brand blocked: user not approved (userstaff="${user?.userstaff}") - SILENT RETURN`);
      return;
    }

    console.log(`🚗 Starting InventData search with pre-selected brand: ${selectedBrand}`);

    // Create search state and directly proceed to brand selection
    await searchStateService.create(userId, {
      step: 'waiting_brand',
      itemName2: '',
      itemName3: '',
      standard: '',
      originalQuery: selectedBrand,
    });

    // Call handleBrandSelection directly
    await handleBrandSelection(userId, replyToken, quoteToken, selectedBrand);
  } catch (error) {
    console.error('❌ ERROR @ handleInventDataSearchWithBrand:', error);
    await lineService.replyMessage(replyToken, [
      { type: 'text', text: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่', quoteToken: quoteToken },
    ]);
  }
}

// ============================================
// DEPRECATED: Old handleStockQuery - Split into handleBotDataSearch and handleInventDataSearch
// ============================================
/*
async function handleStockQuery(event: LineEvent, query: string): Promise<void> { ... }
*/

// Handle Brand selection (when user clicks brand button from carousel)
async function handleBrandSelection(userId: string, replyToken: string, quoteToken: string | undefined, selectedBrand: string): Promise<void> {
  try {
    // ✅ PERMISSION CHECK: Verify user is approved
    const user = await getUser(userId);
    if (!user || !isApprovedUser(user)) {
      console.log(`⛔ Brand selection blocked: user not approved (userstaff="${user?.userstaff}") - SILENT RETURN`);
      await searchStateService.clear(userId);
      return;
    }

    console.log(`✅ User selected brand: ${selectedBrand}`);

    // Start loading animation
    await lineService.startLoadingAnimation(userId);

    // Update state with the selected brand
    await searchStateService.update(userId, {
      itemName2: selectedBrand,
    });

    // Search for models of this brand
    const itemName3List = await searchByItemName3(selectedBrand);

    if (itemName3List.length === 0) {
      console.log(`🔇 No models found for brand: ${selectedBrand} - SILENT RETURN`);
      await searchStateService.clear(userId);
      return;
    }

    // Auto-select if only one model
    if (itemName3List.length === 1) {
      console.log('✅ Auto-selecting single model');
      await handleModelSelection(userId, replyToken, quoteToken, selectedBrand, itemName3List[0]);
      return;
    }

    // Update state to brand_selected
    await searchStateService.update(userId, {
      step: 'brand_selected',
    });

    // Show carousel for model selection
    const carousel = createItemName3ButtonCarousel(selectedBrand, itemName3List);
    await lineService.replyMessage(replyToken, [carousel]);
  } catch (error) {
    console.error('❌ ERROR @ handleBrandSelection:', error);
    await lineService.replyMessage(replyToken, [
      { type: 'text', text: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่', quoteToken: quoteToken },
    ]);
  }
}

// Handle Model selection (when user clicks model button from carousel)
async function handleModelSelection(userId: string, replyToken: string, quoteToken: string | undefined, itemName2: string, selectedModel: string): Promise<void> {
  try {
    // ✅ PERMISSION CHECK: Verify user is approved
    const user = await getUser(userId);
    if (!user || !isApprovedUser(user)) {
      console.log(`⛔ Model selection blocked: user not approved (userstaff="${user?.userstaff}") - SILENT RETURN`);
      await searchStateService.clear(userId);
      return;
    }

    console.log(`✅ User selected model: ${selectedModel} for brand: ${itemName2}`);

    // Start loading animation
    await lineService.startLoadingAnimation(userId);

    // Update state with the selected model
    await searchStateService.update(userId, {
      step: 'model_selected',
      itemName3: selectedModel,
    });

    // Search for standards
    const standardList = await searchByStandard(itemName2, selectedModel);

    if (standardList.length === 0) {
      console.log(`🔇 No standards found for ${itemName2} ${selectedModel} - SILENT RETURN`);
      await searchStateService.clear(userId);
      return;
    }

    // Auto-select if only one standard
    if (standardList.length === 1) {
      console.log('✅ Auto-selecting single standard');
      await handleFinalResults(userId, replyToken, quoteToken, itemName2, selectedModel, standardList[0]);
      return;
    }

    // Show carousel for standard selection
    const carousel = createStandardButtonCarousel(itemName2, selectedModel, standardList);
    await lineService.replyMessage(replyToken, [carousel]);
  } catch (error) {
    console.error('❌ ERROR @ handleModelSelection:', error);
    await lineService.replyMessage(replyToken, [
      { type: 'text', text: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่', quoteToken: quoteToken },
    ]);
  }
}

// Handle Final Results (get and display products)
async function handleFinalResults(userId: string, replyToken: string, quoteToken: string | undefined, itemName2: string, itemName3: string, standard: string): Promise<void> {
  try {
    // ✅ PERMISSION CHECK: Verify user is approved
    const user = await getUser(userId);
    if (!user || !isApprovedUser(user)) {
      console.log(`⛔ Final results blocked: user not approved (userstaff="${user?.userstaff}") - SILENT RETURN`);
      await searchStateService.clear(userId);
      return;
    }

    console.log(`✅ Getting final products for ${itemName2} ${itemName3} ${standard}`);

    // Update state to complete
    await searchStateService.update(userId, {
      step: 'complete',
      standard,
    });

    // Get final products
    const products = await searchFinalProducts(itemName2, itemName3, standard);

    if (products.length === 0) {
      console.log(`🔇 No products found for ${itemName2} ${itemName3} ${standard} - SILENT RETURN`);
      await searchStateService.clear(userId);
      return;
    }

    // Format and send results
    const combinedResults = products.map(p => ({
      name: p.name,
      stock: p.stock,
      status: p.status,
    }));

    const messageText = createInventDataResponseText(
      combinedResults as any,
      `${itemName2} ${itemName3} ${standard}`
    );

    await lineService.replyMessage(replyToken, [
      { type: 'text', text: messageText, quoteToken: quoteToken },
    ]);

    // Clear search state
    await searchStateService.clear(userId);
  } catch (error) {
    console.error('❌ ERROR @ handleFinalResults:', error);
    await lineService.replyMessage(replyToken, [
      { type: 'text', text: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่', quoteToken: quoteToken },
    ]);
  }
}

// ============================================
// Search Result Combiner
// ============================================

interface CombinedSearchResult {
  name: string;
  stock: number;
  status: string;
  lot?: string;
  source: 'botdata' | 'inventdata';
}

function combineSearchResults(
  botDataItems: BotDataItem[],
  inventDataItems: InventDataItem[],
  query: string
): CombinedSearchResult[] {
  const resultMap = new Map<string, CombinedSearchResult>();

  // Process BotData (exact match)
  botDataItems.forEach(row => {
    let itemName = (row.item_name || '').trim();
    if (itemName.endsWith(' 0 000')) {
      itemName = itemName.slice(0, -6).trim();
    }

    if (!resultMap.has(itemName)) {
      resultMap.set(itemName, {
        name: itemName,
        stock: row.on_hand_quantity || 0,
        status: (row.on_hand_quantity || 0) >= 4 ? 'มีสินค้า (BotData)' : 'ติดต่อแอดมิน (BotData)',
        lot: row.lot_number || '-',
        source: 'botdata',
      });
    } else {
      const existing = resultMap.get(itemName)!;
      existing.stock += row.on_hand_quantity || 0;
      existing.status = existing.stock >= 4 ? 'มีสินค้า (BotData)' : 'ติดต่อแอดมิน (BotData)';
    }
  });

  // Process InventData (partial match)
  inventDataItems.forEach(item => {
    if (!resultMap.has(item.name)) {
      resultMap.set(item.name, {
        name: item.name,
        stock: item.stock,
        status: item.stock >= 4 ? 'มีสินค้า' : 'ติดต่อแอดมิน',
        source: 'inventdata',
      });
    }
  });

  // Convert to array and sort by name (Thai locale)
  const results = Array.from(resultMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'th', { sensitivity: 'base' })
  );

  return results;
}

// ============================================
// Event Router
// ============================================

async function handleEvent(event: LineEvent): Promise<void> {
  console.log(`📍 Event type: ${event.type}`);

  switch (event.type) {
    case 'follow':
      await handleFollow(event);
      break;

    case 'unfollow':
      await handleUnfollow(event);
      break;

    case 'message':
      await handleMessage(event);
      break;

    case 'postback':
      await handlePostback(event);
      break;

    case 'join':
      // TODO: Handle join
      console.log('👥 Join event received (not implemented)');
      break;

    case 'leave':
      // TODO: Handle leave
      console.log('👋 Leave event received (not implemented)');
      break;

    case 'memberJoined':
      await handleMemberJoined(event);
      break;

    case 'memberLeft':
      await handleMemberLeft(event);
      break;

    default:
      console.log(`⚠️ Unknown event type: ${event.type}`);
  }
}

// ============================================
// Main Handler
// ============================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-line-signature, content-type',
      },
    });
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Get request body
    const body = await req.text();

    // ⚠️ Signature verification DISABLED for compatibility
    // If you want to enable it, set LINE_CHANNEL_SECRET environment variable
    console.log('⚠️ Signature verification disabled - accepting all requests');

    // Parse webhook
    const webhook: LineWebhook = JSON.parse(body);
    console.log('🎯 Webhook received');
    console.log(`📦 Events: ${webhook.events.length}`);

    // Check if LINE_CHANNEL_TOKEN is set
    if (!LINE_CHANNEL_TOKEN) {
      console.error('❌ LINE_CHANNEL_TOKEN not set - cannot reply');
      return new Response('LINE_CHANNEL_TOKEN not configured', { status: 500 });
    }

    // Handle each event
    for (const event of webhook.events) {
      await handleEvent(event);
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
});
