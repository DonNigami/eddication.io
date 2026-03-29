/**
 * JETSETGO - Database Check Script
 * Run with: node check-database.js
 */

const SUPABASE_URL = 'https://icgtllieipahixesllux.supabase.co';

// Update these keys from your Supabase Dashboard
// Settings > API > Project API keys
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljZ3RsbGllaXBhaGl4ZXNzbHV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MTczNjEsImV4cCI6MjA4NjI5MzM2MX0._9U_u91RaJ3B6k5iPxI0AKUL8DZ8m5zmpi9hJQAyX1U';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljZ3RsbGllaXBhaGl4ZXNzbHV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDcxNzM2MSwiZXhwIjoyMDg2MjkzMzYxfQ.e3plhEUVTPcxyPMmAdiV4ywv8T1SLU6IARSPGfeWt6U';

async function checkDatabase() {
  console.log('🔍 JETSETGO - Database Check\n');

  const checks = [
    { name: 'parts_catalog', url: '/rest/v1/parts_catalog?select=id&limit=1' },
    { name: 'tires_catalog', url: '/rest/v1/tires_catalog?select=id&limit=1' },
    { name: 'catalog_sources', url: '/rest/v1/catalog_sources?select=id&limit=1' },
    { name: 'linebot_sessions', url: '/rest/v1/linebot_sessions?select=id&limit=1' },
    { name: 'search_logs', url: '/rest/v1/search_logs?select=id&limit=1' },
    { name: 'ingestion_jobs', url: '/rest/v1/ingestion_jobs?select=id&limit=1' },
    { name: 'vehicle_compatibility', url: '/rest/v1/vehicle_compatibility?select=id&limit=1' },
  ];

  let successCount = 0;
  let failCount = 0;

  for (const check of checks) {
    try {
      const response = await fetch(SUPABASE_URL + check.url, {
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        }
      });

      if (response.ok) {
        console.log(`✅ ${check.name.padEnd(25)} - OK`);
        successCount++;
      } else {
        const error = await response.json();
        console.log(`❌ ${check.name.padEnd(25)} - Error: ${error.message || response.status}`);
        failCount++;
      }
    } catch (err) {
      console.log(`❌ ${check.name.padEnd(25)} - Connection Error`);
      failCount++;
    }
  }

  // Check pgvector extension
  console.log('\n📦 Extensions:');
  try {
    const response = await fetch(SUPABASE_URL + '/rest/v1/', {
      method: 'POST',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: "SELECT extname FROM pg_extension WHERE extname = 'vector'"
      })
    });
    console.log('⚠️  pgvector check - Use SQL Editor to verify');
  } catch (err) {
    console.log('❌ pgvector check failed');
  }

  // Check storage bucket
  console.log('\n📁 Storage:');
  console.log('⚠️  jetsetgo-catalogs bucket - Use SQL Editor to verify');

  console.log(`\n📊 Summary: ${successCount} OK, ${failCount} Failed\n`);

  if (successCount === checks.length) {
    console.log('🎉 All database tables are ready!\n');
    console.log('Next steps:');
    console.log('1. Open Admin Panel: admin/index.html');
    console.log('2. Upload catalog files');
    console.log('3. Test search functionality\n');
  } else {
    console.log('⚠️  Some tables are missing. Check Supabase SQL Editor.\n');
  }
}

// Run check
checkDatabase().catch(console.error);
