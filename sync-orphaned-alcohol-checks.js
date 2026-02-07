/**
 * Script to sync orphaned alcohol check images from storage to database
 *
 * This script:
 * 1. Lists all files in alcohol-evidence bucket
 * 2. Extracts reference and driver name from filename
 * 3. Inserts records into driver_alcohol_checks for files not in DB
 * 4. Skips files that already have matching DB records
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Thai driver name mapping (safe filename -> actual name)
// Format: reference_driver_timestamp.jpg
const DRIVER_NAME_MAP = {
  // Add known mappings here if needed
  // 'safename': 'Actual Thai Name'
};

async function syncOrphanedAlcoholChecks() {
  console.log('🔍 Starting orphaned alcohol check sync...\n');

  // Step 1: List all files in storage
  console.log('📁 Step 1: Listing files from alcohol-evidence bucket...');
  const { data: files, error: listError } = await supabase
    .storage
    .from('alcohol-evidence')
    .list('', {
      limit: 1000,
      offset: 0,
      sortBy: { column: 'created_at', order: 'asc' }
    });

  if (listError) {
    console.error('❌ Error listing files:', listError.message);
    return;
  }

  console.log(`   ✅ Found ${files.length} files\n`);

  // Step 2: Get existing alcohol checks from DB
  console.log('📊 Step 2: Fetching existing alcohol checks from database...');
  const { data: existingChecks, error: checkError } = await supabase
    .from('driver_alcohol_checks')
    .select('reference, driver_name, image_url, checked_at');

  if (checkError) {
    console.error('❌ Error fetching existing checks:', checkError.message);
    return;
  }

  console.log(`   ✅ Found ${existingChecks.length} existing records\n`);

  // Create lookup map from DB
  const existingMap = new Map();
  existingChecks.forEach(check => {
    const key = `${check.reference}_${check.driver_name}`;
    existingMap.set(key, check);
  });

  // Step 3: Parse filenames and find orphaned files
  console.log('🔍 Step 3: Finding orphaned files...\n');

  // Filename format: reference_driver_timestamp.jpg
  const orphanedFiles = [];

  for (const file of files) {
    // Parse filename
    const match = file.name.match(/^([A-Z0-9\-]+)_driver_(\d+)\.jpg$/);
    if (!match) continue;

    const reference = match[1];
    const timestamp = match[2];

    // Build image URL
    const imageUrl = `${SUPABASE_URL}/storage/v1/object/public/alcohol-evidence/${file.name}`;

    // Check if this file already exists in DB
    const existing = Array.from(existingMap.values()).find(
      c => c.reference === reference && c.image_url === imageUrl
    );

    if (!existing) {
      orphanedFiles.push({
        reference,
        imageUrl,
        fileName: file.name,
        createdAt: file.created_at,
        timestamp: parseInt(timestamp)
      });
    }
  }

  console.log(`   Found ${orphanedFiles.length} orphaned files\n`);

  // Group by reference
  const grouped = {};
  orphanedFiles.forEach(file => {
    if (!grouped[file.reference]) grouped[file.reference] = [];
    grouped[file.reference].push(file);
  });

  // Step 4: Try to get driver names from jobdata
  console.log('🔍 Step 4: Fetching driver info from jobdata...\n');

  const referencesWithDrivers = new Map();

  for (const reference of Object.keys(grouped)) {
    const { data: jobdata } = await supabase
      .from('jobdata')
      .select('drivers, reference')
      .eq('reference', reference)
      .limit(1)
      .maybeSingle();

    if (jobdata && jobdata.drivers) {
      // Parse drivers: "driver1 / driver2" or just "driver1"
      const drivers = jobdata.drivers.split('/').map(d => d.trim()).filter(d => d);
      referencesWithDrivers.set(reference, drivers);
    }
  }

  // Step 5: Insert orphaned records
  console.log('💾 Step 5: Inserting orphaned records...\n');

  let insertedCount = 0;
  let skippedCount = 0;
  const errors = [];

  for (const [reference, files] of Object.entries(grouped)) {
    const drivers = referencesWithDrivers.get(reference) || ['Unknown Driver'];

    // Assign driver names to files (round-robin if multiple files per driver)
    files.forEach((file, index) => {
      const driverName = drivers[index % drivers.length];

      // Convert timestamp to ISO date
      const checkedAt = new Date(file.timestamp).toISOString();

      const record = {
        reference: file.reference,
        driver_name: driverName,
        alcohol_value: 0, // Default to 0 since we don't have actual value
        image_url: file.imageUrl,
        location: null, // No location data available
        checked_at: checkedAt,
        checked_by: null, // Unknown user
        job_id: null // Set to null since we're making it nullable
      };

      // Insert record
      supabase
        .from('driver_alcohol_checks')
        .insert(record)
        .then(({ data, error }) => {
          if (error) {
            errors.push({ file: file.fileName, error: error.message });
            console.log(`   ❌ Failed to insert ${file.fileName}: ${error.message}`);
          } else {
            insertedCount++;
            console.log(`   ✅ Inserted: ${file.fileName} (driver: ${driverName})`);
          }
        });
    });
  }

  // Wait for all inserts to complete
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 SYNC SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total orphaned files found: ${orphanedFiles.length}`);
  console.log(`Successfully inserted: ${insertedCount}`);
  console.log(`Failed: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(e => console.log(`   - ${e.file}: ${e.error}`));
  }

  console.log('\n✅ Sync complete!');
}

// Run the sync
syncOrphanedAlcoholChecks().catch(console.error);
