// Script to check driver_logs for alcohol check related errors
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Use service key to bypass RLS and see all logs
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY);

async function checkDriverLogs() {
  console.log('🔍 Checking driver_logs for alcohol check issues...\n');

  // 1. Check total alcohol check records
  console.log('📊 1. Total records in driver_alcohol_checks:');
  try {
    const { count, error } = await supabase
      .from('driver_alcohol_checks')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`   ❌ Error: ${error.message}`);
    } else {
      console.log(`   ✅ Total: ${count} records`);
    }
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
  }

  // 2. Check driver_logs for alcohol action
  console.log('\n📊 2. Driver logs with action="alcohol":');
  try {
    const { data, error } = await supabase
      .from('driver_logs')
      .select('*')
      .eq('action', 'alcohol')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.log(`   ❌ Error: ${error.message}`);
    } else if (data && data.length > 0) {
      console.log(`   ✅ Found ${data.length} alcohol logs\n`);

      data.forEach((log, idx) => {
        console.log(`   [${idx + 1}] Reference: ${log.reference}`);
        console.log(`       User ID: ${log.user_id}`);
        console.log(`       Created: ${log.created_at}`);
        if (log.details) {
          console.log(`       Details:`, JSON.stringify(log.details, null, 10).split('\n').map(l => '                ' + l).join('\n'));
        }
        console.log('');
      });
    } else {
      console.log('   ⚠️  No alcohol logs found');
    }
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
  }

  // 3. Check for failed attempts (action='error' or details contains error)
  console.log('\n📊 3. Driver logs with errors (action="error"):');
  try {
    const { data, error } = await supabase
      .from('driver_logs')
      .select('*')
      .or('action.eq.error,details.ilike.%error%,details.ilike.%failed%')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.log(`   ❌ Error: ${error.message}`);
    } else if (data && data.length > 0) {
      console.log(`   ✅ Found ${data.length} error logs\n`);

      // Filter for alcohol-related errors
      const alcoholErrors = data.filter(log =>
        log.details && JSON.stringify(log.details).toLowerCase().includes('alcohol')
      );

      if (alcoholErrors.length > 0) {
        console.log(`   🍺 Alcohol-related errors (${alcoholErrors.length}):\n`);
        alcoholErrors.forEach((log, idx) => {
          console.log(`   [${idx + 1}] Reference: ${log.reference}`);
          console.log(`       Action: ${log.action}`);
          console.log(`       Created: ${log.created_at}`);
          if (log.details) {
            console.log(`       Details:`, JSON.stringify(log.details, null, 10));
          }
          console.log('');
        });
      } else {
        console.log('   ℹ️  No alcohol-specific errors found');
      }
    } else {
      console.log('   ⚠️  No error logs found');
    }
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
  }

  // 4. Check RLS policies on driver_alcohol_checks
  console.log('\n📊 4. RLS Policies on driver_alcohol_checks:');
  try {
    const { data, error } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'driver_alcohol_checks');

    if (error) {
      console.log(`   ❌ Error: ${error.message} (may need service key)`);
    } else if (data && data.length > 0) {
      console.log(`   ✅ Found ${data.length} policies:`);
      data.forEach(policy => {
        console.log(`      - ${policy.policyname}`);
        console.log(`        Command: ${policy.cmd}`);
      });
    } else {
      console.log('   ⚠️  No policies found (RLS may be disabled)');
    }
  } catch (err) {
    console.log(`   ❌ Error: ${err.message} (need to check in Supabase Dashboard)`);
  }

  // 5. Check all driver logs summary
  console.log('\n📊 5. Summary of all driver_logs by action:');
  try {
    const { data, error } = await supabase
      .from('driver_logs')
      .select('action')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) {
      console.log(`   ❌ Error: ${error.message}`);
    } else if (data && data.length > 0) {
      const summary = {};
      data.forEach(log => {
        summary[log.action] = (summary[log.action] || 0) + 1;
      });
      console.log(`   Total logs: ${data.length}\n`);
      Object.entries(summary).forEach(([action, count]) => {
        console.log(`      ${action}: ${count}`);
      });
    } else {
      console.log('   ⚠️  No logs found');
    }
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
  }

  // 6. Check recent alcohol check samples
  console.log('\n📊 6. Sample records from driver_alcohol_checks:');
  try {
    const { data, error } = await supabase
      .from('driver_alcohol_checks')
      .select('*')
      .order('checked_at', { ascending: false })
      .limit(10);

    if (error) {
      console.log(`   ❌ Error: ${error.message}`);
    } else if (data && data.length > 0) {
      console.log(`   ✅ Found ${data.length} records:\n`);
      data.forEach((check, idx) => {
        console.log(`   [${idx + 1}] Reference: ${check.reference}`);
        console.log(`       Driver: ${check.driver_name}`);
        console.log(`       Value: ${check.alcohol_value}`);
        console.log(`       Checked At: ${check.checked_at}`);
        console.log(`       Created At: ${check.created_at}`);
        console.log('');
      });
    } else {
      console.log('   ⚠️  No alcohol check records found');
    }
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
  }
}

checkDriverLogs().catch(console.error);
