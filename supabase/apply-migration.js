/**
 * Apply Migration Script
 * Usage: node apply-migration.js <DATABASE_URL>
 *
 * To get your DATABASE_URL:
 * 1. Go to Supabase Dashboard > Settings > Database
 * 2. Copy "Connection string" (Transaction pool mode)
 * 3. Replace [YOUR-PASSWORD] with your database password
 */

import pg from 'pg';
import { readFileSync } from 'fs';

const { Client } = pg;

// Load DATABASE_URL from environment or argument
const DATABASE_URL = process.env.DATABASE_URL || process.argv[2];

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL not provided');
  console.log('\nUsage:');
  console.log('  node apply-migration.js <DATABASE_URL>');
  console.log('  Or set DATABASE_URL environment variable\n');
  console.log('To get DATABASE_URL:');
  console.log('1. Go to Supabase Dashboard > Settings > Database');
  console.log('2. Copy "Connection string" (Transaction pool mode)');
  console.log("3. Replace [YOUR-PASSWORD] with your database password\n");
  process.exit(1);
}

const migrationSQL = readFileSync('./supabase/migrations/20260126020000_alter_location_tables.sql', 'utf-8');

async function applyMigration() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    console.log('Connecting to database...');
    await client.connect();

    console.log('Applying migration...');
    await client.query(migrationSQL);

    console.log('\n✅ Migration applied successfully!\n');

    // Verify the tables were created
    const result = await client.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_name IN ('station', 'customer', 'origin')
      AND table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `);

    console.log('Created schema:');
    console.table(result.rows);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
