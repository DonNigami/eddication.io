/**
 * Apply register_data table migration
 * Usage: node apply-register-migration.js
 * Then copy the SQL output and run in Supabase Dashboard > SQL Editor
 */

const fs = require('fs');
const path = require('path');

const migrationFile = path.join(__dirname, 'migrations', '20260131000001_create_register_data_table.sql');

console.log('═══════════════════════════════════════════════════════════════');
console.log('  DriverConnect - Registration Data Migration');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log('Migration File: ' + migrationFile);
console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

try {
    const sql = fs.readFileSync(migrationFile, 'utf8');
    console.log(sql);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('✓ Migration SQL generated successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Copy the SQL above');
    console.log('  2. Go to: https://supabase.com/dashboard/project/myplpshpcordggbbtblg/sql/new');
    console.log('  3. Paste and run the SQL');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
} catch (error) {
    console.error('Error reading migration file:', error.message);
    console.error('');
    console.error('Make sure the file exists: ' + migrationFile);
}
