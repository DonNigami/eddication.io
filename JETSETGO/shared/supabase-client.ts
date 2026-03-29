// JETSETGO Supabase Client
// Works in both Deno Edge Functions and Browser environments

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import config from './config.ts';

// Create client with appropriate context
export function createSupabaseClient() {
  // For Deno/Edge Functions - use service role key for admin operations
  if (typeof Deno !== 'undefined') {
    return createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey || config.supabase.anonKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  // For browser/admin panel - use anon key
  return createClient(
    config.supabase.url,
    config.supabase.anonKey,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
      },
    }
  );
}

// Singleton instance
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (!supabaseInstance) {
    supabaseInstance = createSupabaseClient();
  }
  return supabaseInstance;
}

// Re-export types
export type {
  Client,
  SupabaseClient,
} from 'https://esm.sh/@supabase/supabase-js@2';

// Database types (will be generated from migrations)
export interface Database {
  public: {
    Tables: {
      parts_catalog: {
        Row: PartCatalogRow;
        Insert: PartCatalogInsert;
        Update: PartCatalogUpdate;
      };
      tires_catalog: {
        Row: TireCatalogRow;
        Insert: TireCatalogInsert;
        Update: TireCatalogUpdate;
      };
      vehicle_compatibility: {
        Row: VehicleCompatibilityRow;
        Insert: VehicleCompatibilityInsert;
        Update: VehicleCompatibilityUpdate;
      };
      catalog_sources: {
        Row: CatalogSourceRow;
        Insert: CatalogSourceInsert;
        Update: CatalogSourceUpdate;
      };
      ingestion_jobs: {
        Row: IngestionJobRow;
        Insert: IngestionJobInsert;
        Update: IngestionJobUpdate;
      };
      linebot_sessions: {
        Row: LinebotSessionRow;
        Insert: LinebotSessionInsert;
        Update: LinebotSessionUpdate;
      };
      search_logs: {
        Row: SearchLogRow;
        Insert: SearchLogInsert;
        Update: SearchLogUpdate;
      };
    };
  };
}

// Type definitions
export interface PartCatalogRow {
  id: string;
  part_number: string;
  oem_number?: string;
  part_name_th?: string;
  part_name_en?: string;
  description?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  vehicle_make?: string[];
  vehicle_model?: string[];
  year_range?: string;
  specifications?: Record<string, unknown>;
  price?: number;
  stock_quantity?: number;
  warehouse_location?: string;
  image_url?: string;
  source_id?: string;
  confidence_score?: number;
  embedding?: number[];
  created_at: string;
  updated_at: string;
}

export interface TireCatalogRow {
  id: string;
  part_number: string;
  brand: string;
  model: string;
  size: string;
  width?: number;
  aspect_ratio?: number;
  rim_diameter?: number;
  load_index?: string;
  speed_rating?: string;
  tire_type?: 'summer' | 'winter' | 'all-season' | 'performance' | 'off-road';
  vehicle_type?: 'sedan' | 'suv' | 'truck' | 'van' | 'sports';
  vehicle_make?: string[];
  vehicle_model?: string[];
  price?: number;
  stock_quantity?: number;
  image_url?: string;
  embedding?: number[];
  created_at: string;
}

export interface VehicleCompatibilityRow {
  id: string;
  part_id: string;
  make: string;
  model: string;
  year_start?: number;
  year_end?: number;
  engine?: string;
  trim?: string;
  notes?: string;
}

export interface CatalogSourceRow {
  id: string;
  name: string;
  type: 'pdf' | 'excel' | 'csv' | 'api';
  file_path?: string;
  upload_date: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_records?: number;
  processed_records?: number;
  metadata?: Record<string, unknown>;
}

export interface IngestionJobRow {
  id: string;
  source_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  stage?: string;
  progress?: number;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  metadata?: Record<string, unknown>;
}

export interface LinebotSessionRow {
  id: string;
  user_id: string;
  display_name?: string;
  language?: 'th' | 'en';
  conversation_context?: Record<string, unknown>;
  last_interaction_at: string;
  created_at: string;
}

export interface SearchLogRow {
  id: string;
  session_id?: string;
  query: string;
  results_count?: number;
  top_result_id?: string;
  response_time_ms?: number;
  user_feedback?: 'positive' | 'negative' | 'neutral';
  created_at: string;
}

// Insert types (same as Row but with optional id)
export type PartCatalogInsert = Omit<PartCatalogRow, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};
export type TireCatalogInsert = Omit<TireCatalogRow, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};
export type VehicleCompatibilityInsert = Omit<VehicleCompatibilityRow, 'id'>;
export type CatalogSourceInsert = Omit<CatalogSourceRow, 'id'>;
export type IngestionJobInsert = Omit<IngestionJobRow, 'id'>;
export type LinebotSessionInsert = Omit<LinebotSessionRow, 'id' | 'created_at'>;
export type SearchLogInsert = Omit<SearchLogRow, 'id' | 'created_at'>;

// Update types (all optional)
export type PartCatalogUpdate = Partial<PartCatalogInsert>;
export type TireCatalogUpdate = Partial<TireCatalogInsert>;
export type VehicleCompatibilityUpdate = Partial<VehicleCompatibilityInsert>;
export type CatalogSourceUpdate = Partial<CatalogSourceInsert>;
export type IngestionJobUpdate = Partial<IngestionJobInsert>;
export type LinebotSessionUpdate = Partial<LinebotSessionInsert>;
export type SearchLogUpdate = Partial<SearchLogInsert>;
