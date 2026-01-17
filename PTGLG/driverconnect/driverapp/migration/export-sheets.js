/**
 * =====================================================
 * GOOGLE APPS SCRIPT: EXPORT DATA FROM GOOGLE SHEETS
 * =====================================================
 *
 * วิธีใช้:
 * 1. ไปที่ Google Sheets ของคุณ
 * 2. Extensions > Apps Script
 * 3. Copy โค้ดนี้ไปวาง
 * 4. Run function: exportAllData()
 * 5. ไฟล์ JSON จะถูกสร้างใน Google Drive
 *
 * หรือใช้ doGet() เพื่อดึงข้อมูลผ่าน Web App
 */

// =====================================================
// CONFIG - แก้ไขตามข้อมูลจริงของคุณ
// =====================================================
const SHEET_ID = '1UK6pdRrCGEjXmdtGe2FeSFflSimz0JhhGxAei_OKyLU';

// Sheet names
const SHEETS_TO_EXPORT = {
  jobdata: 'jobdata',
  userprofile: 'userprofile',
  alcoholcheck: 'alcoholcheck',
  station: 'Station',
  origin: 'Origin',
  processdata: 'processdata',
  reviewdata: 'reviewdata'
};

// Column mappings for jobdata (1-based index)
const JOBDATA_COLUMNS = {
  reference: 1,        // A
  shipment_no: 2,      // B
  ship_to_code: 3,     // C
  ship_to_name: 4,     // D
  status: 5,           // E
  checkin_time: 6,     // F
  checkout_time: 7,    // G
  updated_by: 8,       // H
  source_row: 9,       // I
  created_at: 10,      // J
  updated_at: 11,      // K
  dest_lat: 12,        // L
  dest_lng: 13,        // M
  radius_m: 14,        // N
  checkin_lat: 15,     // O
  checkin_lng: 16,     // P
  checkout_lat: 17,    // Q
  checkout_lng: 18,    // R
  fueling_time: 19,    // S
  unload_done_time: 20, // T
  reviewed_time: 21,   // U
  job_closed_at: 22,   // V
  distance_km: 23,     // W
  checkin_odo: 24,     // X
  trip_end_odo: 25,    // Y
  trip_end_lat: 26,    // Z
  trip_end_lng: 27,    // AA
  trip_end_place: 28,  // AB
  trip_ended_at: 29,   // AC
  vehicle_desc: 30,    // AD
  processdata_time: 31 // AE
};

// =====================================================
// EXPORT FUNCTIONS
// =====================================================

/**
 * Export all sheets to JSON files in Google Drive
 */
function exportAllData() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const folder = DriveApp.createFolder('DriverConnect_Export_' + new Date().toISOString().slice(0,10));

  const results = {};

  for (const [key, sheetName] of Object.entries(SHEETS_TO_EXPORT)) {
    try {
      const data = exportSheet(ss, sheetName, key);
      results[key] = { count: data.length, status: 'success' };

      // Save to file
      const file = folder.createFile(
        key + '.json',
        JSON.stringify(data, null, 2),
        'application/json'
      );
      Logger.log('Created: ' + file.getName() + ' (' + data.length + ' rows)');
    } catch (err) {
      results[key] = { count: 0, status: 'error', message: err.message };
      Logger.log('Error exporting ' + key + ': ' + err.message);
    }
  }

  // Create summary
  folder.createFile(
    '_export_summary.json',
    JSON.stringify({
      exportedAt: new Date().toISOString(),
      sheetId: SHEET_ID,
      results: results
    }, null, 2),
    'application/json'
  );

  Logger.log('Export completed! Folder: ' + folder.getUrl());
  return folder.getUrl();
}

/**
 * Export a single sheet to array of objects
 */
function exportSheet(ss, sheetName, key) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet not found: ' + sheetName);
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow < 2) {
    return [];
  }

  // Get headers from row 1
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  // Get data from row 2 onwards
  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  // Convert to array of objects
  const result = data.map((row, index) => {
    const obj = { _row_index: index + 2 }; // Keep original row number

    if (key === 'jobdata') {
      // Use specific column mapping for jobdata
      return mapJobdataRow(row);
    } else {
      // Generic mapping using headers
      headers.forEach((header, i) => {
        if (header) {
          const cleanHeader = String(header).toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
          obj[cleanHeader] = formatValue(row[i]);
        }
      });
    }
    return obj;
  });

  // Filter out empty rows
  return result.filter(row => {
    const values = Object.values(row);
    return values.some(v => v !== null && v !== '' && v !== undefined);
  });
}

/**
 * Map jobdata row using specific column indices
 */
function mapJobdataRow(row) {
  const getValue = (colIndex) => formatValue(row[colIndex - 1]);

  return {
    reference: getValue(JOBDATA_COLUMNS.reference),
    shipment_no: getValue(JOBDATA_COLUMNS.shipment_no),
    ship_to_code: getValue(JOBDATA_COLUMNS.ship_to_code),
    ship_to_name: getValue(JOBDATA_COLUMNS.ship_to_name),
    status: getValue(JOBDATA_COLUMNS.status),
    checkin_time: getValue(JOBDATA_COLUMNS.checkin_time),
    checkout_time: getValue(JOBDATA_COLUMNS.checkout_time),
    updated_by: getValue(JOBDATA_COLUMNS.updated_by),
    created_at: getValue(JOBDATA_COLUMNS.created_at),
    updated_at: getValue(JOBDATA_COLUMNS.updated_at),
    dest_lat: parseFloat(getValue(JOBDATA_COLUMNS.dest_lat)) || null,
    dest_lng: parseFloat(getValue(JOBDATA_COLUMNS.dest_lng)) || null,
    radius_m: parseInt(getValue(JOBDATA_COLUMNS.radius_m)) || 200,
    checkin_lat: parseFloat(getValue(JOBDATA_COLUMNS.checkin_lat)) || null,
    checkin_lng: parseFloat(getValue(JOBDATA_COLUMNS.checkin_lng)) || null,
    checkout_lat: parseFloat(getValue(JOBDATA_COLUMNS.checkout_lat)) || null,
    checkout_lng: parseFloat(getValue(JOBDATA_COLUMNS.checkout_lng)) || null,
    fueling_time: getValue(JOBDATA_COLUMNS.fueling_time),
    unload_done_time: getValue(JOBDATA_COLUMNS.unload_done_time),
    job_closed_at: getValue(JOBDATA_COLUMNS.job_closed_at),
    distance_km: parseFloat(getValue(JOBDATA_COLUMNS.distance_km)) || null,
    odo_start: parseInt(getValue(JOBDATA_COLUMNS.checkin_odo)) || null,
    end_odo: parseInt(getValue(JOBDATA_COLUMNS.trip_end_odo)) || null,
    end_lat: parseFloat(getValue(JOBDATA_COLUMNS.trip_end_lat)) || null,
    end_lng: parseFloat(getValue(JOBDATA_COLUMNS.trip_end_lng)) || null,
    end_point_name: getValue(JOBDATA_COLUMNS.trip_end_place),
    ended_at: getValue(JOBDATA_COLUMNS.trip_ended_at),
    vehicle_desc: getValue(JOBDATA_COLUMNS.vehicle_desc),
    job_closed: !!getValue(JOBDATA_COLUMNS.job_closed_at),
    trip_ended: !!getValue(JOBDATA_COLUMNS.trip_ended_at)
  };
}

/**
 * Format cell value for JSON export
 */
function formatValue(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  // Handle Date objects
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return value.toISOString();
  }

  return value;
}

// =====================================================
// WEB APP ENDPOINT (Optional)
// =====================================================

/**
 * Web App endpoint to get data via HTTP GET
 * Deploy as Web App to use this
 */
function doGet(e) {
  const action = e.parameter.action || 'all';
  const ss = SpreadsheetApp.openById(SHEET_ID);

  let result;

  if (action === 'all') {
    result = {};
    for (const [key, sheetName] of Object.entries(SHEETS_TO_EXPORT)) {
      try {
        result[key] = exportSheet(ss, sheetName, key);
      } catch (err) {
        result[key] = { error: err.message };
      }
    }
  } else if (SHEETS_TO_EXPORT[action]) {
    result = exportSheet(ss, SHEETS_TO_EXPORT[action], action);
  } else {
    result = { error: 'Unknown action: ' + action };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// =====================================================
// TEST FUNCTION
// =====================================================

function testExport() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const data = exportSheet(ss, 'jobdata', 'jobdata');
  Logger.log('Exported ' + data.length + ' rows');
  Logger.log('Sample row: ' + JSON.stringify(data[0], null, 2));
}
