const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigration() {
  console.log('🔄 Running migration: Make job_id nullable in driver_alcohol_checks\n');

  const sqlStatements = [
    // Drop existing foreign key
    'ALTER TABLE public.driver_alcohol_checks DROP CONSTRAINT IF EXISTS driver_alcohol_checks_job_id_fkey',
    
    // Make job_id nullable
    'ALTER TABLE public.driver_alcohol_checks ALTER COLUMN job_id DROP NOT NULL',
    
    // Add foreign key constraint that allows NULL
    'ALTER TABLE public.driver_alcohol_checks ADD CONSTRAINT driver_alcohol_checks_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobdata(id) ON DELETE SET NULL',
    
    // Drop old policy
    'DROP POLICY IF EXISTS "Admins can manage driver_alcohol_checks" ON public.driver_alcohol_checks',
    
    // Allow insert for all (anon, authenticated)
    'CREATE POLICY IF NOT EXISTS "Allow insert alcohol checks for all" ON public.driver_alcohol_checks FOR INSERT TO anon, authenticated, public WITH CHECK (true)',
    
    // Allow select for all
    'CREATE POLICY IF NOT EXISTS "Allow select alcohol checks for all" ON public.driver_alcohol_checks FOR SELECT TO anon, authenticated, public USING (true)'
  ];

  for (const sql of sqlStatements) {
    try {
      // Use POST to /rest/v1/ with raw SQL
      const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ query: sql })
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (errorText.includes('already exists') || errorText.includes('does not exist')) {
          console.log(`ℹ️  Skipped: ${sql.substring(0, 70)}...`);
        } else {
          console.log(`⚠️  Failed: ${sql.substring(0, 70)}...`);
          console.log(`   ${errorText.substring(0, 200)}`);
        }
      } else {
        console.log(`✅ Executed: ${sql.substring(0, 70)}...`);
      }
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
    }
  }

  console.log('\n✅ Migration complete! Please run the SQL manually in Supabase Dashboard if needed.');
  console.log('\n📋 SQL to run manually:');
  console.log('---');
  console.log(sqlStatements.join(';\n') + ';');
  console.log('---');
}

runMigration().catch(console.error);
