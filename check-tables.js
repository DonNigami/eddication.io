// Script to check all tables in Supabase database
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

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
