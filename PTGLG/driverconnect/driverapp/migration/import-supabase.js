/**
 * =====================================================
 * NODE.JS SCRIPT: IMPORT DATA TO SUPABASE
 * =====================================================
 *
 * วิธีใช้:
 * 1. npm install @supabase/supabase-js
 * 2. แก้ไข SUPABASE_URL และ SUPABASE_SERVICE_KEY ด้านล่าง
 * 3. วางไฟล์ JSON ที่ export มาไว้ในโฟลเดอร์ ./data/
 * 4. node import-supabase.js
 *
 * หมายเหตุ: ใช้ SERVICE_KEY (ไม่ใช่ ANON_KEY) เพื่อ bypass RLS
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// =====================================================
// CONFIG - แก้ไขตรงนี้
// =====================================================
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_SERVICE_KEY = 'YOUR_SERVICE_ROLE_KEY'; // ใช้ service_role key สำหรับ migration

const DATA_FOLDER = './data'; // โฟลเดอร์ที่เก็บไฟล์ JSON ที่ export มา

// =====================================================
// SUPABASE CLIENT
// =====================================================
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

// =====================================================
// IMPORT FUNCTIONS
// =====================================================

/**
 * Import jobdata
 */
async function importJobdata(data) {
  console.log(`\n📦 Importing ${data.length} jobdata records...`);

  // Group by reference to assign seq numbers
  const byReference = {};
  data.forEach(row => {
    const ref = row.reference;
    if (!byReference[ref]) byReference[ref] = [];
    byReference[ref].push(row);
  });

  const records = [];
  for (const [reference, rows] of Object.entries(byReference)) {
    rows.forEach((row, index) => {
      records.push({
        reference: row.reference,
        seq: index + 1,
        vehicle_desc: row.vehicle_desc || null,
        shipment_no: row.shipment_no || null,
        ship_to_code: row.ship_to_code || null,
        ship_to_name: row.ship_to_name || null,
        status: row.status || 'PENDING',
        dest_lat: row.dest_lat || null,
        dest_lng: row.dest_lng || null,
        radius_m: row.radius_m || 200,
        checkin_time: parseDate(row.checkin_time),
        checkin_lat: row.checkin_lat || null,
        checkin_lng: row.checkin_lng || null,
        odo_start: row.odo_start || null,
        fueling_time: parseDate(row.fueling_time),
        unload_done_time: parseDate(row.unload_done_time),
        checkout_time: parseDate(row.checkout_time),
        checkout_lat: row.checkout_lat || null,
        checkout_lng: row.checkout_lng || null,
        job_closed: row.job_closed || false,
        closed_at: parseDate(row.job_closed_at),
        trip_ended: row.trip_ended || false,
        end_odo: row.end_odo || null,
        end_point_name: row.end_point_name || null,
        end_lat: row.end_lat || null,
        end_lng: row.end_lng || null,
        ended_at: parseDate(row.ended_at),
        created_at: parseDate(row.created_at) || new Date().toISOString(),
        updated_at: parseDate(row.updated_at) || new Date().toISOString(),
        updated_by: row.updated_by || null
      });
    });
  }

  // Insert in batches of 100
  const batchSize = 100;
  let inserted = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error } = await supabase.from('jobdata').insert(batch);

    if (error) {
      console.error(`❌ Error at batch ${i}: ${error.message}`);
      // Try inserting one by one to find problematic record
      for (const record of batch) {
        const { error: singleError } = await supabase.from('jobdata').insert(record);
        if (singleError) {
          console.error(`  Failed record: ${record.reference} - ${singleError.message}`);
        } else {
          inserted++;
        }
      }
    } else {
      inserted += batch.length;
      process.stdout.write(`\r  Inserted: ${inserted}/${records.length}`);
    }
  }

  console.log(`\n✅ Imported ${inserted} jobdata records`);
  return inserted;
}

/**
 * Import alcohol_checks
 */
async function importAlcoholChecks(data) {
  console.log(`\n🍺 Importing ${data.length} alcohol_checks records...`);

  const records = data.map(row => ({
    reference: row.reference || null,
    driver_name: row.driver_name || row.drivername || null,
    alcohol_value: parseFloat(row.alcohol_value || row.alcoholvalue || row.result) || null,
    image_url: row.image_url || row.imageurl || null,
    lat: parseFloat(row.lat) || null,
    lng: parseFloat(row.lng) || null,
    user_id: row.user_id || row.userid || null,
    created_at: parseDate(row.created_at || row.timestamp) || new Date().toISOString()
  }));

  const { error } = await supabase.from('alcohol_checks').insert(records);

  if (error) {
    console.error(`❌ Error importing alcohol_checks: ${error.message}`);
    return 0;
  }

  console.log(`✅ Imported ${records.length} alcohol_checks records`);
  return records.length;
}

/**
 * Import user_profiles
 */
async function importUserProfiles(data) {
  console.log(`\n👤 Importing ${data.length} user_profiles records...`);

  const records = data.map(row => ({
    user_id: row.user_id || row.userid || row.lineuserid || null,
    display_name: row.display_name || row.displayname || null,
    picture_url: row.picture_url || row.pictureurl || null,
    status: row.status || 'active',
    role: row.usertype || row.role || 'driver',
    created_at: parseDate(row.created_at) || new Date().toISOString(),
    updated_at: parseDate(row.updated_at) || new Date().toISOString()
  })).filter(r => r.user_id);

  // Upsert to handle duplicates
  const { error } = await supabase.from('user_profiles').upsert(records, {
    onConflict: 'user_id'
  });

  if (error) {
    console.error(`❌ Error importing user_profiles: ${error.message}`);
    return 0;
  }

  console.log(`✅ Imported ${records.length} user_profiles records`);
  return records.length;
}

/**
 * Import stations
 */
async function importStations(data) {
  console.log(`\n📍 Importing ${data.length} stations records...`);

  const records = data.map(row => ({
    station_code: row.station_code || row.stationkey || row.key1 || null,
    station_code_alt: row.station_code_alt || row.key2 || null,
    name: row.name || row.stationname || null,
    lat: parseFloat(row.lat) || null,
    lng: parseFloat(row.lng) || null,
    radius_m: parseInt(row.radius_m || row.radiusmeters) || 200,
    is_active: true
  })).filter(r => r.station_code);

  const { error } = await supabase.from('stations').upsert(records, {
    onConflict: 'station_code'
  });

  if (error) {
    console.error(`❌ Error importing stations: ${error.message}`);
    return 0;
  }

  console.log(`✅ Imported ${records.length} stations records`);
  return records.length;
}

// =====================================================
// HELPERS
// =====================================================

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

function loadJsonFile(filename) {
  const filepath = path.join(DATA_FOLDER, filename);
  if (!fs.existsSync(filepath)) {
    console.log(`⚠️ File not found: ${filepath}`);
    return null;
  }
  const content = fs.readFileSync(filepath, 'utf8');
  return JSON.parse(content);
}

// =====================================================
// MAIN
// =====================================================

async function main() {
  console.log('=====================================================');
  console.log('  SUPABASE MIGRATION SCRIPT');
  console.log('=====================================================');
  console.log(`  Supabase URL: ${SUPABASE_URL}`);
  console.log(`  Data folder: ${path.resolve(DATA_FOLDER)}`);
  console.log('=====================================================\n');

  // Check connection
  const { data: test, error: testError } = await supabase.from('jobdata').select('count').limit(1);
  if (testError) {
    console.error('❌ Cannot connect to Supabase:', testError.message);
    console.log('\nPlease check:');
    console.log('  1. SUPABASE_URL is correct');
    console.log('  2. SUPABASE_SERVICE_KEY is correct (use service_role key)');
    console.log('  3. Tables have been created using supabase-schema.sql');
    process.exit(1);
  }
  console.log('✅ Connected to Supabase\n');

  const results = {
    startedAt: new Date().toISOString(),
    tables: {}
  };

  // Import each table
  const tables = [
    { file: 'jobdata.json', importer: importJobdata, name: 'jobdata' },
    { file: 'alcoholcheck.json', importer: importAlcoholChecks, name: 'alcohol_checks' },
    { file: 'userprofile.json', importer: importUserProfiles, name: 'user_profiles' },
    { file: 'station.json', importer: importStations, name: 'stations' }
  ];

  for (const { file, importer, name } of tables) {
    const data = loadJsonFile(file);
    if (data && Array.isArray(data)) {
      try {
        const count = await importer(data);
        results.tables[name] = { status: 'success', count };
      } catch (err) {
        console.error(`❌ Error importing ${name}:`, err.message);
        results.tables[name] = { status: 'error', message: err.message };
      }
    } else {
      results.tables[name] = { status: 'skipped', reason: 'file not found or invalid' };
    }
  }

  results.completedAt = new Date().toISOString();

  console.log('\n=====================================================');
  console.log('  MIGRATION COMPLETE');
  console.log('=====================================================');
  console.log(JSON.stringify(results, null, 2));

  // Save results
  fs.writeFileSync(
    path.join(DATA_FOLDER, '_import_results.json'),
    JSON.stringify(results, null, 2)
  );
}

main().catch(console.error);
