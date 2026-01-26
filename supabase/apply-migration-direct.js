/**
 * Direct Migration Script
 * Run with: node apply-migration-direct.js
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://myplpshpcordggbbtblg.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15cGxwc2hwY29yZGdnYnJ0YmxnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImFudSI6ImFudSIsInNjb3BlcyI6ImFsbCIsImp0aSI6IjEyMzQ1Njc4OTAifQ.example'; // Replace with actual key

const sql = readFileSync('./supabase/migrations/20260126020000_alter_location_tables.sql', 'utf-8');

console.log('Applying migration...');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Split SQL by semicolons and execute each statement
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

async function executeMigration() {
  for (const statement of statements) {
    try {
      // Use rpc to execute raw SQL
      const { data, error } = await supabase.rpc('exec_sql', { sql_query: statement });
      if (error) console.error('Error:', error);
    } catch (err) {
      console.error('Exception:', err.message);
    }
  }
  console.log('Migration applied!');
}

executeMigration();
