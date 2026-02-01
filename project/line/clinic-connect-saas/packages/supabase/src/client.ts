/**
 * ClinicConnect SaaS - Supabase Client
 *
 * Unified Supabase client creation for browser and server environments
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { supabaseConfig } from '@clinic/config';

// Database type interface - will be populated by type generation
export interface Database {
  public: {
    Tables: {
      users: any;
      clinics: any;
      doctors: any;
      patients: any;
      appointments: any;
      appointment_slots: any;
      queue_management: any;
      medical_records: any;
      prescriptions: any;
      payments: any;
      notifications: any;
      articles: any;
      reviews: any;
      subscriptions: any;
      usage_logs: any;
      admin_logs: any;
      line_configs: any;
      line_users: any;
      conversation_states: any;
      message_logs: any;
      rich_menu_assignments: any;
      broadcast_campaigns: any;
      doctor_blocked_dates: any;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_role: 'patient' | 'doctor' | 'admin';
      appointment_status: 'pending' | 'confirmed' | 'checked_in' | 'in_consultation' | 'completed' | 'cancelled' | 'no_show';
      queue_status: 'waiting' | 'in_queue' | 'in_room' | 'completed' | 'skipped';
      payment_method: 'line_pay' | 'credit_card' | 'promptpay' | 'cash' | 'other';
      payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
      notification_type: 'appointment_reminder' | 'queue_update' | 'payment_request' | 'promotional' | 'system';
      subscription_tier: 'basic' | 'pro' | 'clinic';
      subscription_status: 'active' | 'cancelled' | 'expired' | 'trial';
    };
  };
}

/**
 * Create a browser Supabase client
 * For use in React components, LIFF apps, and client-side code
 */
export function createBrowserClient() {
  const url = import.meta.env?.VITE_SUPABASE_URL ||
              process.env?.VITE_SUPABASE_URL ||
              supabaseConfig.url;

  const key = import.meta.env?.VITE_SUPABASE_ANON_KEY ||
              process.env?.VITE_SUPABASE_ANON_KEY ||
              supabaseConfig.anonKey;

  if (!url || !key) {
    throw new Error('Missing Supabase URL or Anon Key');
  }

  return createSupabaseClient<Database>(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce', // Use PKCE for better security in LIFF
    },
  });
}

/**
 * Create a server Supabase client
 * For use in Next.js server components, API routes, and Edge Functions
 */
export function createServerClient() {
  const url = process.env.SUPABASE_URL || supabaseConfig.url;
  const key = process.env.SUPABASE_ANON_KEY || supabaseConfig.anonKey;

  if (!url || !key) {
    throw new Error('Missing Supabase URL or Anon Key');
  }

  return createSupabaseClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Create a service role Supabase client
 * WARNING: Bypasses RLS - use only in trusted server environments
 */
export function createServiceClient() {
  const url = process.env.SUPABASE_URL || supabaseConfig.url;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!url || !key) {
    throw new Error('Missing Supabase URL or Service Role Key');
  }

  return createSupabaseClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// Singleton instance for browser
let browserClientInstance: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Get or create singleton browser client
 */
export function getBrowserClient() {
  if (!browserClientInstance) {
    browserClientInstance = createBrowserClient();
  }
  return browserClientInstance;
}

// Export types
export type { Database };
export type SupabaseClient = ReturnType<typeof createBrowserClient>;
