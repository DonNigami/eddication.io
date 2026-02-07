const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY);

async function checkStorage() {
  console.log('🔍 Checking alcohol-evidence bucket...\n');

  // List all files in alcohol-evidence bucket
  const { data, error } = await supabase
    .storage
    .from('alcohol-evidence')
    .list('', {
      limit: 200,
      offset: 0,
      sortBy: { column: 'created_at', order: 'desc' }
    });

  if (error) {
    console.log('❌ Error:', error.message);
    return;
  }

  console.log(`✅ Found ${data.length} files in bucket\n`);

  // Group by reference
  const byReference = {};
  data.forEach(file => {
    const match = file.name.match(/^([A-Z0-9\-]+)_/);
    if (match) {
      const ref = match[1];
      if (!byReference[ref]) byReference[ref] = [];
      byReference[ref].push(file);
    }
  });

  // Get all references from alcohol_checks table
  const { data: checks, error: checkError } = await supabase
    .from('driver_alcohol_checks')
    .select('reference, image_url, driver_name, checked_at');

  if (checkError) {
    console.log('❌ Error fetching alcohol_checks:', checkError.message);
    return;
  }

  console.log(`📊 Database has ${checks.length} alcohol check records\n`);

  const dbRefs = new Set(checks.map(c => c.reference));
  const storageRefs = Object.keys(byReference);

  // Find orphaned files (files in storage but NOT in DB)
  const orphaned = storageRefs.filter(ref => !dbRefs.has(ref));

  // Find missing files (DB records but NO files in storage)
  const missingInStorage = Array.from(dbRefs).filter(ref => !storageRefs.includes(ref));

  console.log('📊 Comparison:\n');
  console.log(`  Files in storage: ${storageRefs.length} unique references`);
  console.log(`  Records in DB: ${dbRefs.size} unique references`);
  console.log(`  Orphaned files (storage but no DB): ${orphaned.length}`);
  console.log(`  Missing files (DB but no storage): ${missingInStorage.length}`);

  if (orphaned.length > 0) {
    console.log(`\n⚠️  Found ${orphaned.length} references with files but NO DB record:\n`);
    orphaned.forEach(ref => {
      console.log(`  - ${ref}: ${byReference[ref].length} file(s)`);
      byReference[ref].forEach(f => {
        const created = new Date(f.created_at).toLocaleString('th-TH');
        console.log(`      ${f.name} (${created})`);
      });
    });
  } else {
    console.log('\n✅ No orphaned files found');
  }

  if (missingInStorage.length > 0) {
    console.log(`\n⚠️  Found ${missingInStorage.length} references in DB but NO files:\n`);
    missingInStorage.forEach(ref => {
      const check = checks.find(c => c.reference === ref);
      console.log(`  - ${ref} (driver: ${check?.driver_name})`);
    });
  } else {
    console.log('\n✅ All DB records have matching files');
  }

  // Check B100-260207-003 specifically
  console.log('\n🔍 Checking B100-260207-003 specifically...\n');
  const b100Files = byReference['B100-260207-003'];
  if (b100Files) {
    console.log(`✅ Found ${b100Files.length} file(s) for B100-260207-003:`);
    b100Files.forEach(f => {
      console.log(`    - ${f.name}`);
      console.log(`      Created: ${new Date(f.created_at).toLocaleString('th-TH')}`);
    });
  } else {
    console.log('❌ No files found for B100-260207-003');
  }

  // Check if B100-260207-003 exists in jobdata
  console.log('\n🔍 Checking if B100-260207-003 exists in jobdata...\n');
  const { data: jobdata, error: jobError } = await supabase
    .from('jobdata')
    .select('id, reference, status')
    .eq('reference', 'B100-260207-003');

  if (jobError) {
    console.log('❌ Error:', jobError.message);
  } else if (jobdata && jobdata.length > 0) {
    console.log(`✅ Found ${jobdata.length} jobdata row(s):`);
    jobdata.forEach(j => {
      console.log(`    - id: ${j.id} (UUID), status: ${j.status}`);
    });
  } else {
    console.log('❌ No jobdata found for B100-260207-003');
    console.log('    This is likely why alcohol check insert failed! (job_id foreign key constraint)');
  }
}

checkStorage().catch(console.error);
