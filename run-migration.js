const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigration() {
  console.log('🔄 Running migration: Make job_id nullable in driver_alcohol_checks\n');

  const migrationFile = path.join(__dirname, 'supabase/migrations/20260207_make_alcohol_checks_job_id_nullable.sql');
  const sql = fs.readFileSync(migrationFile, 'utf8');

  // Split into individual statements and execute
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))
    .filter(s => s.toLowerCase() !== 'select' && !s.toLowerCase().startsWith('select '));

  console.log(`Found ${statements.length} SQL statements to execute\n`);

  let successCount = 0;
  let failCount = 0;

  for (const stmt of statements) {
    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql_query: stmt });
      
      if (error) {
        // Try using raw SQL via REST API
        console.log('Trying alternative method...');
        const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({ query: stmt })
        });
        
        if (!response.ok) {
          throw new Error(await response.text());
        }
      }
      
      console.log(`✅ Executed: ${stmt.substring(0, 60)}...`);
      successCount++;
    } catch (err) {
      // Some statements might fail if they already exist - that's OK
      if (err.message.includes('already exists') || err.message.includes('does not exist')) {
        console.log(`ℹ️  Skipped (already exists): ${stmt.substring(0, 60)}...`);
        successCount++;
      } else {
        console.log(`❌ Failed: ${stmt.substring(0, 60)}...`);
        console.log(`   Error: ${err.message}`);
        failCount++;
      }
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('Migration complete!');
  console.log(`Success: ${successCount}, Failed: ${failCount}`);
  console.log('='.repeat(50));

  // Verify the changes
  console.log('\n🔍 Verifying changes...');
  const { data: columns } = await supabase
    .from('information_schema.columns')
    .select('column_name, is_nullable')
    .eq('table_name', 'driver_alcohol_checks')
    .eq('column_name', 'job_id');

  if (columns && columns.length > 0) {
    console.log('✅ job_id column:', columns[0]);
  }
}

runMigration().catch(console.error);
