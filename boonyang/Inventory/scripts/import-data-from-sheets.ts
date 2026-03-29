/**
 * Import Data from Google Sheets to Supabase
 *
 * Prerequisites:
 * 1. Google Sheets API enabled
 * 2. Service account JSON exported
 * 3. Sheet shared with service account email
 */

import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Configuration
const SUPABASE_URL = 'https://cbxicbynxnprscwqnyld.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const SHEET_ID = '1BGVpH5-VuDh4iQcZN8gD5pW0n3_EvoSjXXbFGEaLMg8';
const SERVICE_ACCOUNT_PATH = './service-account.json';

// Sheet Names
const SHEET_BOTDATA = 'BotData';
const SHEET_INVENTDATA = 'InventData';

interface BotDataRow {
  itemCode: string;
  fieldUnknown: string;
  itemName: string;
  lotNumber: string;
  onHandQuantity: number;
  alternativeKey1: string;
  alternativeKey2: string;
}

interface InventDataRow {
  itemName: string;
  stockQuantity: number;
}

/**
 * Initialize Google Sheets API
 */
async function initGoogleSheets() {
  const credentials = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8'));

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  return sheets;
}

/**
 * Fetch data from Google Sheets
 */
async function fetchSheetData(sheets: any, sheetName: string, range: string) {
  console.log(`📥 Fetching ${sheetName}...`);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!${range}`,
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    console.log(`⚠️ No data found in ${sheetName}`);
    return [];
  }

  console.log(`✅ Fetched ${rows.length - 1} rows from ${sheetName}`);
  return rows;
}

/**
 * Import BotData to Supabase
 */
async function importBotData(supabase: any, rows: any[][]) {
  console.log('\n📦 Importing BotData...');

  const data: any[] = [];

  // Skip header row, start from index 1
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    data.push({
      item_code: row[0] || null,
      field_unknown: row[1] || null,
      item_name: row[2] || null,
      lot_number: row[3] || null,
      on_hand_quantity: parseInt(row[4]) || 0,
      alternative_key_1: row[5] || null,
      alternative_key_2: row[6] || null,
    });
  }

  // Insert in batches of 1000
  const batchSize = 1000;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const { error } = await supabase.from('botdata').insert(batch);

    if (error) {
      console.error(`❌ Error inserting batch ${i / batchSize + 1}:`, error.message);
    } else {
      console.log(`✅ Inserted batch ${i / batchSize + 1} (${batch.length} rows)`);
    }
  }

  console.log(`\n✅ Total BotData imported: ${data.length} rows`);
}

/**
 * Import InventData to Supabase
 */
async function importInventData(supabase: any, rows: any[][]) {
  console.log('\n📊 Importing InventData...');

  const data: any[] = [];

  // Skip header row, start from index 1
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    data.push({
      item_name: row[0] || null,
      stock_quantity: parseInt(row[1]) || 0,
    });
  }

  // Insert in batches of 1000
  const batchSize = 1000;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const { error } = await supabase.from('inventdata').insert(batch);

    if (error) {
      console.error(`❌ Error inserting batch ${i / batchSize + 1}:`, error.message);
    } else {
      console.log(`✅ Inserted batch ${i / batchSize + 1} (${batch.length} rows)`);
    }
  }

  console.log(`\n✅ Total InventData imported: ${data.length} rows`);
}

/**
 * Main import function
 */
async function importFromSheets() {
  try {
    // Initialize Supabase client
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log('🔗 Connected to Supabase');

    // Initialize Google Sheets
    const sheets = await initGoogleSheets();
    console.log('🔗 Connected to Google Sheets');

    // Fetch BotData (Columns A-G = 7 columns)
    const botDataRows = await fetchSheetData(sheets, SHEET_BOTDATA, 'A:G');
    if (botDataRows.length > 0) {
      await importBotData(supabase, botDataRows);
    }

    // Fetch InventData (Columns A-B = 2 columns)
    const inventDataRows = await fetchSheetData(sheets, SHEET_INVENTDATA, 'A:B');
    if (inventDataRows.length > 0) {
      await importInventData(supabase, inventDataRows);
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ Import completed successfully!');
    console.log('='.repeat(50));

  } catch (error: any) {
    console.error('\n❌ Import failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  importFromSheets();
}

export { importFromSheets };
