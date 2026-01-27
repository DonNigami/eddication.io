// get-schema.js - Check existing tables in Supabase
const supabaseUrl = 'https://myplpshpcordggbbtblg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15cGxwc2hwY29yZGdnYmJ0YmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MDI2ODgsImV4cCI6MjA4Mzk3ODY4OH0.UC42xLgqSdqgaogHmyRpES_NMy5t1j7YhdEZVwWUsJ8';

// Using fetch directly since we don't have supabase-js installed in this environment
async function checkTable(tableName) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${tableName}?limit=1`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });

  if (response.status === 404 || response.status === 406) {
    return { exists: false, error: response.status };
  }
  return { exists: response.ok, status: response.status };
}

async function getTableSchema(tableName) {
  // Try to get one row to see the columns
  const response = await fetch(`${supabaseUrl}/rest/v1/${tableName}?limit=1`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Accept': 'application/vnd.pgrst.object+json'
    }
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Checking Supabase Database Schema');
  console.log('Project: myplpshpcordggbbtblg');
  console.log('='.repeat(60));
  console.log();

  const knownTables = [
    // Core Jobs
    'jobdata',
    'trips',
    'trip_stops',
    'driver_jobs',
    'driver_stops',
    'driver_stop',

    // User Management
    'user_profiles',
    'profiles',

    // Location
    'station',
    'customer',
    'origin',
    'stations',

    // Tracking
    'driver_live_locations',
    'driver_logs',

    // Safety
    'alcohol_checks',
    'driver_alcohol_checks',
    'fuel_siphoning',

    // Monitoring
    'admin_alerts',
    'triggered_alerts',
    'app_settings',
    'report_schedules',
    'google_chat_webhooks',

    // CRM
    'tiers',
    'news_promotions',
    'customer_segments',

    // Other
    'processdata',
    'review_data',
    'admin_logs'
  ];

  const existingTables = [];
  const notFoundTables = [];

  console.log('Checking tables...\n');

  for (const tableName of knownTables) {
    const result = await checkTable(tableName);
    if (result.exists) {
      existingTables.push(tableName);
      console.log(`  ✓ ${tableName}`);
    } else {
      notFoundTables.push(tableName);
      console.log(`  ✗ ${tableName} (not found)`);
    }
  }

  console.log();
  console.log('='.repeat(60));
  console.log(`Summary: ${existingTables.length} tables found out of ${knownTables.length} checked`);
  console.log('='.repeat(60));

  if (existingTables.length > 0) {
    console.log();
    console.log('Existing tables:');
    existingTables.forEach(t => console.log(`  - ${t}`));
  }

  if (notFoundTables.length > 0) {
    console.log();
    console.log('Tables NOT found (may have been renamed or removed):');
    notFoundTables.forEach(t => console.log(`  - ${t}`));
  }

  // Get sample data from a few tables to show structure
  console.log();
  console.log('='.repeat(60));
  console.log('Sample data from existing tables:');
  console.log('='.repeat(60));

  for (const tableName of existingTables.slice(0, 5)) {
    const sample = await getTableSchema(tableName);
    if (sample) {
      console.log();
      console.log(`${tableName}:`);
      console.log(`  Columns: ${Object.keys(sample).join(', ')}`);
    }
  }
}

main().catch(console.error);
