/**
 * Debug script to check origin table data in Supabase
 * Run with: node check-origin-data.js
 */

const SUPABASE_URL = 'https://myplpshpcordggbbtblg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15cGxwc2hwY29yZGdnYmJidGJsZyIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzY4NDAyNjg4LCJleHAiOjIwODM5Nzg2ODh9.UC42xLgqSdqgaogHmyRpES_NMy5t1j7YhdEZVwWUsJ8';

async function checkOriginData() {
  console.log('🔍 Fetching origin table data from Supabase...\n');

  try {
    // Fetch all origins
    const response = await fetch(`${SUPABASE_URL}/rest/v1/origin?select=*`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (!response.ok) {
      console.error('❌ Error:', response.status, response.statusText);
      const text = await response.text();
      console.error('Response:', text);
      return;
    }

    const data = await response.json();

    console.log(`✅ Found ${data.length} rows in origin table:\n`);

    // Display all data
    console.log('='.repeat(100));
    console.log('ALL ORIGINS:');
    console.log('='.repeat(100));
    data.forEach((row, index) => {
      console.log(`\n[${index + 1}] ${JSON.stringify(row, null, 2)}`);
    });

    console.log('\n' + '='.repeat(100));
    console.log('ROUTE CODES LIST:');
    console.log('='.repeat(100));
    data.forEach((row) => {
      const routeCode = row.routeCode || '(null)';
      const originKey = row.originKey || '(null)';
      const name = row.name || '(null)';
      console.log(`routeCode: "${routeCode}" -> originKey: "${originKey}", name: "${name}"`);
    });

    // Check for Z26 specifically
    console.log('\n' + '='.repeat(100));
    console.log('SEARCHING FOR "Z26":');
    console.log('='.repeat(100));

    const z26ByRouteCode = data.find(row => row.routeCode === 'Z26');
    const z26ByOriginKey = data.find(row => row.originKey === 'Z26');
    const z26Fuzzy = data.find(row =>
      row.routeCode && row.routeCode.trim().toUpperCase() === 'Z26'
    );

    console.log(`\nBy exact routeCode match: ${z26ByRouteCode ? '✅ FOUND' : '❌ NOT FOUND'}`);
    if (z26ByRouteCode) {
      console.log(JSON.stringify(z26ByRouteCode, null, 2));
    }

    console.log(`\nBy exact originKey match: ${z26ByOriginKey ? '✅ FOUND' : '❌ NOT FOUND'}`);
    if (z26ByOriginKey) {
      console.log(JSON.stringify(z26ByOriginKey, null, 2));
    }

    console.log(`\nBy fuzzy routeCode match (trim + uppercase): ${z26Fuzzy ? '✅ FOUND' : '❌ NOT FOUND'}`);
    if (z26Fuzzy) {
      console.log(JSON.stringify(z26Fuzzy, null, 2));
    }

    // Show all routeCodes with length for debugging
    console.log('\n' + '='.repeat(100));
    console.log('ROUTE CODES WITH LENGTH DEBUG:');
    console.log('='.repeat(100));
    data.forEach((row) => {
      const routeCode = row.routeCode || '';
      console.log(`routeCode: "${routeCode}" (length: ${routeCode.length}, bytes: ${Buffer.from(routeCode).length})`);
    });

  } catch (error) {
    console.error('❌ Exception:', error.message);
  }
}

checkOriginData();
