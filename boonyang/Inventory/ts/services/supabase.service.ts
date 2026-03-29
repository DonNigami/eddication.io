/**
 * Supabase Service
 * Handles all database operations for Boonyang Inventory
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BotDataRow, InventDataItem, UserProfile, SystemSettings, ReplyTemplate } from '../types';

export class SupabaseService {
  private client: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://cbxicbynxnprscwqnyld.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
    }

    this.client = createClient(supabaseUrl, supabaseKey);
  }

  // ============================================
  // BotData Operations
  // ============================================

  async getBotDataByItemCode(itemCode: string): Promise<BotDataRow[]> {
    const { data, error } = await this.client
      .from('botdata')
      .select('*')
      .eq('item_code', itemCode);

    if (error) throw error;
    return data || [];
  }

  async getBotDataByAnyKey(searchKey: string): Promise<BotDataRow[]> {
    const { data, error } = await this.client
      .from('botdata')
      .select('*')
      .or(`item_code.eq.${searchKey},alternative_key_1.eq.${searchKey},alternative_key_2.eq.${searchKey}`);

    if (error) throw error;
    return data || [];
  }

  async getAllBotData(): Promise<BotDataRow[]> {
    const { data, error } = await this.client
      .from('botdata')
      .select('*');

    if (error) throw error;
    return data || [];
  }

  // ============================================
  // InventData Operations
  // ============================================

  async getInventDataByItemName(itemName: string): Promise<InventDataItem[]> {
    const { data, error } = await this.client
      .from('inventdata')
      .select('*')
      .eq('item_name', itemName);

    if (error) throw error;
    return data || [];
  }

  async searchInventDataFuzzy(searchTerm: string): Promise<InventDataItem[]> {
    const { data, error } = await this.client
      .from('inventdata')
      .select('*')
      .ilike('item_name', `%${searchTerm}%`)
      .order('item_name');

    if (error) throw error;
    return data || [];
  }

  async getAllInventData(): Promise<InventDataItem[]> {
    const { data, error } = await this.client
      .from('inventdata')
      .select('*');

    if (error) throw error;
    return data || [];
  }

  // ============================================
  // User Operations
  // ============================================

  async getUserById(userId: string): Promise<UserProfile | null> {
    const { data, error } = await this.client
      .from('userdata')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data;
  }

  async createUser(profile: Partial<UserProfile>): Promise<UserProfile> {
    const { data, error } = await this.client
      .from('userdata')
      .insert(profile)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateUser(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    const { data, error } = await this.client
      .from('userdata')
      .update({ ...updates, updated_at: new Date().toISOString(), last_interaction_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteUser(userId: string): Promise<void> {
    const { error } = await this.client
      .from('userdata')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
  }

  async getUserStaff(userId: string): Promise<string | null> {
    const { data, error } = await this.client
      .from('userdata')
      .select('status_register')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    // Map status_register to user role
    if (!data) return null;

    const status = data.status_register;
    if (status === 'สำเร็จ') return 'customer'; // For now, all completed registrations are customers
    return null;
  }

  // ============================================
  // Settings Operations
  // ============================================

  async getSystemSettings(): Promise<SystemSettings | null> {
    const { data, error } = await this.client
      .from('system_settings')
      .select('*')
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  async updateSystemSetting(key: string, value: any): Promise<void> {
    const { error } = await this.client
      .from('system_settings')
      .update({ [key]: value, updated_at: new Date().toISOString() })
      .eq('id', 1);

    if (error) throw error;
  }

  // ============================================
  // Reply Templates
  // ============================================

  async getReplyTemplate(keyword: string): Promise<ReplyTemplate | null> {
    const { data, error } = await this.client
      .from('reply_templates')
      .select('*')
      .eq('keyword', keyword)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  // ============================================
  // Batch Operations
  // ============================================

  async batchInsertBotData(records: Partial<BotDataRow>[]): Promise<void> {
    const { error } = await this.client
      .from('botdata')
      .insert(records);

    if (error) throw error;
  }

  async batchInsertInventData(records: Partial<InventDataItem>[]): Promise<void> {
    const { error } = await this.client
      .from('inventdata')
      .insert(records);

    if (error) throw error;
  }
}

// Singleton instance
export const supabaseService = new SupabaseService();
