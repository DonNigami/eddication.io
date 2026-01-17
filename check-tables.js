// Script to check all tables in Supabase database
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://myplpshpcordggbbtblg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15cGxwc2hwY29yZGdnYmJ0YmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MDI2ODgsImV4cCI6MjA4Mzk3ODY4OH0.UC42xLgqSdqgaogHmyRpES_NMy5t1j7YhdEZVwWUsJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkTables() {
  console.log('🔍 Checking Supabase tables...\n');

  const tablesToCheck = [
    'profiles',
    'tiers',
    'news_promotions',
    'customer_segments',
    'news_metrics',
    'broadcast_queue',
    'audit_logs',
    'points_history',
    'driver_jobs',
    'driver_stops',
    'driver_alcohol_checks',
    'driver_logs',
    'jobdata'
  ];

  for (const table of tablesToCheck) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`❌ ${table}: ไม่พบตาราง (${error.message})`);
      } else {
        console.log(`✅ ${table}: มีทั้งหมด ${count} แถว`);
      }
    } catch (err) {
      console.log(`❌ ${table}: เกิดข้อผิดพลาด (${err.message})`);
    }
  }

  console.log('\n📊 Checking sample data from driver_jobs...');
  try {
    const { data, error } = await supabase
      .from('driver_jobs')
      .select('*')
      .limit(3);

    if (error) {
      console.log(`❌ Error: ${error.message}`);
    } else if (data && data.length > 0) {
      console.log('\n📝 Sample data:');
      data.forEach((row, idx) => {
        console.log(`\nRow ${idx + 1}:`);
        console.log(`  Reference: ${row.reference}`);
        console.log(`  Vehicle: ${row.vehicle_desc}`);
        console.log(`  Drivers: ${row.drivers}`);
        console.log(`  Status: ${row.status}`);
      });
    } else {
      console.log('⚠️  No data found');
    }
  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
  }
}

checkTables().catch(console.error);
