/**
 * Apply Migration Script
 * Run this script with: node apply-migration.js <DATABASE_URL>
 * Or with npx: npx -y dotenv-cli -- apply-migration.js
 *
 * To get your DATABASE_URL:
 * 1. Go to Supabase Dashboard > Settings > Database
 * 2. Copy "Connection string" (Transaction pool mode)
 * 3. Replace [YOUR-PASSWORD] with your database password
 */

const fs = require('fs');
const path = require('path');

const migrationSQL = fs.readFileSync(
  path.join(__dirname, 'migrations', '20260126010000_create_location_tables.sql'),
  'utf8'
);

console.log('=== LOCATION TABLES MIGRATION ===\n');
console.log('Copy this SQL and run it in Supabase Dashboard > SQL Editor:\n');
console.log('--- COPY BELOW THIS LINE ---');
console.log(migrationSQL);
console.log('--- END OF SQL ---\n');
console.log('\nInstructions:');
console.log('1. Open https://supabase.com/dashboard/project/myplpshpcordggbbtblg/sql/new');
console.log('2. Paste the SQL above');
console.log('3. Click "Run" to apply the migration');
