console.log('debug-import.js loaded');
import { supabase } from '../shared/config.js';
window.sheetData = null;
window.importStopped = false;
window.availableSheets = [];

function sanitizeHTML(text) {
  if (text === null || text === undefined) return '';
  const temp = document.createElement('div');
  temp.textContent = String(text);
  return temp.innerHTML;
}


function getSheetCSVUrl(sheetId, sheetName) {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
}

// Load available sheet names from Google Sheets
// Note: Direct HTML scraping is blocked by CORS, so we use common defaults
window.loadSheetNames = async function() {
  const selectEl = document.getElementById('sheetName');

  // Populate with common sheet name defaults
  selectEl.innerHTML = `
    <option value="InputZoile30" selected>📊 InputZoile30 (Default)</option>
    <option value="Sheet1">Sheet1</option>
    <option value="Sheet2">Sheet2</option>
    <option value="" disabled>──────────</option>
    <option value="JobData">JobData</option>
    <option value="Data">Data</option>
    <option value="Report">Report</option>
  `;

  console.log('Sheet names loaded (defaults - manual entry available)');
};

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

function parseCSV(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim());
  const headers = parseCSVLine(lines[0]);
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    data.push(row);
  }

  return { headers, data };
}

function convertDateFormat(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;

  dateStr = dateStr.trim();

  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Convert DD/MM/YYYY to YYYY-MM-DD
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split('/');
    const converted = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    console.log(`Date converted: ${dateStr} → ${converted}`);
    return converted;
  }

  // Convert DD.MM.YYYY to YYYY-MM-DD
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split('.');
    const converted = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    console.log(`Date converted: ${dateStr} → ${converted}`);
    return converted;
  }

  // Try parsing with Date object
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const converted = date.toISOString().split('T')[0];
      console.log(`Date parsed: ${dateStr} → ${converted}`);
      return converted;
    }
  } catch (e) {
    console.warn('Failed to parse date:', dateStr, e);
  }

  console.warn('Date format not recognized:', dateStr);
  return null;
}

// Map row to database format with ALL columns
function mapRowToDatabase(row) {
  const mapped = {
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Column mapping
  const columnMapping = {
    'Shipment No.': 'shipment_no',
    'Reference': 'reference',
    'Sts': 'sts',
    'Sts Text': 'sts_text',
    'Vehicle': 'vehicle',
    'Vehicle Description': 'vehicle_desc',
    'Trip': 'trip',
    'Carrier': 'carrier',
    'Carrier Name': 'carrier_name',
    'Driver': 'driver',
    'Driver name': 'driver_name',
    'Route': 'route',
    'Distance': 'distance',
    'Distance UOM': 'distance_uom',
    'Scheduling end': 'scheduling_end',
    'Planned load start (Date)': 'planned_load_start_date',
    'Planned load start (Time)': 'planned_load_start_time',
    'Actual load start (Date)': 'actual_load_start_date',
    'Actual load start (Time)': 'actual_load_start_time',
    'Actual load end (Date)': 'actual_load_end_date',
    'Actual load end (Time)': 'actual_load_end_time',
    'Actual del.conf.end (Date)': 'actual_del_conf_end_date',
    'Transport Plan Pt': 'transport_plan_pt',
    'Transport Plan Pt Desc': 'transport_plan_pt_desc',
    'Shipment Type': 'shipment_type',
    'Shipment Type Desc': 'shipment_type_desc',
    'ShpCosting': 'shp_costing',
    'ShpCostSettl': 'shp_cost_settl',
    'Shipment Item': 'shipment_item',
    'Delivery': 'delivery',
    'Ship to': 'ship_to',
    'Ship to Name': 'ship_to_name',
    'Ship to Address': 'ship_to_address',
    'Street 5': 'street_5',
    'Receiving plant': 'receiving_plant',
    'Del Date': 'del_date',
    'Delivery Item': 'delivery_item',
    'Material': 'material',
    'Material Desc': 'material_desc',
    'Delivery Qty': 'delivery_qty',
    'Delivery UOM': 'delivery_uom',
    'Order': 'order_no',
    'Billing Doc': 'billing_doc',
    'Canceled': 'canceled',
    // Additional possible date columns
    'Actual del.conf.end (Time)': 'actual_del_conf_end_time'
  };

  // Map all columns
  Object.entries(columnMapping).forEach(([sheetCol, dbCol]) => {
    if (row[sheetCol] !== undefined && row[sheetCol] !== '') {
      let value = row[sheetCol];
      const originalValue = value;

      // Type conversions
      if (dbCol === 'distance' || dbCol === 'delivery_qty') {
        value = parseFloat(value) || null;
      } else if (dbCol.includes('_date') && value) {
        // Convert date format
        value = convertDateFormat(value);
        if (value === null) {
          console.warn(`Failed to convert date for ${dbCol} (${sheetCol}):`, originalValue);
        } else {
          console.log(`✓ Converted ${dbCol}: ${originalValue} → ${value}`);
        }
      } else if (dbCol === 'scheduling_end' && value) {
        // scheduling_end might be a date too
        if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(value)) {
          const converted = convertDateFormat(value);
          if (converted) {
            value = converted + 'T00:00:00Z'; // Make it a timestamp
            console.log(`✓ Converted scheduling_end: ${originalValue} → ${value}`);
          }
        }
      } else if (dbCol.includes('_time') && value) {
        value = value.trim() || null;
      } else if (dbCol === 'canceled') {
        value = value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'x';
      }

      // Only set if value is not null
      if (value !== null && value !== undefined) {
        mapped[dbCol] = value;
      }
    }
  });

  // IMPORTANT: Check if any unmapped columns contain dates
  Object.entries(row).forEach(([sheetCol, value]) => {
    if (value && typeof value === 'string' && /\d{1,2}\/\d{1,2}\/\d{4}/.test(value)) {
      if (!columnMapping[sheetCol]) {
        console.warn(`⚠️ Unmapped column with date format: "${sheetCol}" = "${value}"`);
      }
    }
  });

  // Ensure reference exists
  if (!mapped.reference && mapped.shipment_no) {
    mapped.reference = mapped.shipment_no;
  }

  // Set drivers field
  if (!mapped.drivers && mapped.driver_name) {
    mapped.drivers = mapped.driver_name;
  }

  return mapped;
}

window.fetchSheetData = async function() {
  const result = document.getElementById('fetchResult');
  result.innerHTML = '<span class="warning">Fetching...</span>';

  try {
    const sheetId = document.getElementById('sheetId').value;
    const sheetName = document.getElementById('sheetName').value;

    if (!sheetName) {
      throw new Error('Please select a sheet name');
    }

    const url = getSheetCSVUrl(sheetId, sheetName);

    const response = await fetch(url);
    if (!response.ok) throw new Error('Cannot access sheet');

    const csvText = await response.text();
    const { headers, data } = parseCSV(csvText);

    window.sheetData = { headers, data };

    // Populate row select
    const rowSelect = document.getElementById('rowSelect');
    rowSelect.innerHTML = '';
    data.forEach((row, i) => {
      const option = document.createElement('option');
      option.value = i;
      option.text = `Row ${i + 2}: ${row['Shipment No.'] || row['Reference'] || 'No ID'}`;
      rowSelect.appendChild(option);
    });

    result.innerHTML = `<span class="success">✓ Success!</span>\n\n` +
      `Total Rows: ${data.length}\n` +
      `Columns: ${headers.length}\n\n` +
      `Headers:\n${sanitizeHTML(JSON.stringify(headers, null, 2))}`;
  } catch (error) {
    result.innerHTML = `<span class="error">✗ Error:</span>\n${sanitizeHTML(error.message)}\n${sanitizeHTML(error.stack)}`;
  }
};

window.checkSchema = async function() {
  const result = document.getElementById('schemaResult');
  result.innerHTML = '<span class="warning">Checking...</span>';

  try {
    const { data, error } = await supabase
      .from('driver_jobs')
      .select('*')
      .limit(1);

    if (error) throw error;

    const columns = data.length > 0 ? Object.keys(data[0]) : [];

    result.innerHTML = `<span class="success">✓ Table exists!</span>\n\n` +
      `Columns (${columns.length}):\n${sanitizeHTML(JSON.stringify(columns, null, 2))}`;
  } catch (error) {
    result.innerHTML = `<span class="error">✗ Error:</span>\n${sanitizeHTML(error.message)}\n\n` +
      `Details: ${sanitizeHTML(JSON.stringify(error, null, 2))}`;
  }
};

window.testMapping = function() {
  const result = document.getElementById('mappingResult');

  if (!window.sheetData) {
    result.innerHTML = '<span class="error">✗ Please fetch sheet data first!</span>';
    return;
  }

  const rowIndex = parseInt(document.getElementById('rowSelect').value);
  const row = window.sheetData.data[rowIndex];

  const mapped = mapRowToDatabase(row);

  result.innerHTML = `<span class="success">✓ Mapped!</span>\n\n` +
    `Original Row (first 5 fields):\n${sanitizeHTML(JSON.stringify(Object.fromEntries(Object.entries(row).slice(0, 5)), null, 2))}\n\n` +
    `Mapped Data:\n${sanitizeHTML(JSON.stringify(mapped, null, 2))}`;

  window.testMappedData = mapped;
};

window.testInsert = async function() {
  const result = document.getElementById('insertResult');

  if (!window.testMappedData) {
    result.innerHTML = '<span class="error">✗ Please test mapping first!</span>';
    return;
  }

  result.innerHTML = '<span class="warning">Inserting...</span>';

  console.log('=== TEST INSERT ===');
  console.log('Mapped data:', window.testMappedData);

  // Check ALL fields for date formats that aren't converted
  const problematicFields = [];
  Object.entries(window.testMappedData).forEach(([key, value]) => {
    if (value && typeof value === 'string') {
      // Check if value looks like a date in DD/MM/YYYY format
      if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(value)) {
        problematicFields.push({ field: key, value: value });
        console.error(`❌ UNCONVERTED DATE FOUND: ${key} = "${value}"`);
      }
    }
  });

  if (problematicFields.length > 0) {
    result.innerHTML = `<span class="error">❌ Found unconverted dates!</span>\n\n` +
      `These fields still have DD/MM/YYYY format:\n` +
      problematicFields.map(f => `- ${sanitizeHTML(f.field)}: "${sanitizeHTML(f.value)}"`).join('\n') + 
      `\nPlease check the column mapping and convert these fields.`;
    return;
  }

  // Check for date fields
  const dateFields = Object.entries(window.testMappedData)
    .filter(([key, value]) => key.includes('_date') && value);

  console.log('Date fields:', dateFields);

  try {
    const { data, error } = await supabase
      .from('driver_jobs')
      .upsert(window.testMappedData, {
        onConflict: 'reference'
      })
      .select();

    if (error) throw error;

    result.innerHTML = `<span class="success">✓ Insert Success!</span>\n\n` +
      `Inserted Data:\n${sanitizeHTML(JSON.stringify(data, null, 2))}`;
  } catch (error) {
    console.error('Insert error:', error);
    result.innerHTML = `<span class="error">✗ Insert Failed!</span>\n\n` +
      `Error Message: ${sanitizeHTML(error.message)}\n\n` +
      `Error Code: ${sanitizeHTML(error.code)}\n\n` +
      `Error Details:\n${sanitizeHTML(JSON.stringify(error, null, 2))}\n\n` +
      `Data Attempted:\n${sanitizeHTML(JSON.stringify(window.testMappedData, null, 2))}`;
  }
};

window.clearDriverJobsTable = async function() {
  const result = document.getElementById('clearTableResult');
  result.innerHTML = '<span class="warning">Clearing table...</span>';

  if (!confirm('Are you absolutely sure you want to clear ALL data from the driver_jobs table? This action cannot be undone.')) {
    result.innerHTML = '<span class="warning">Table clear cancelled.</span>';
    return;
  }

  try {
    const { error } = await supabase
      .from('driver_jobs')
      .delete()
      .not('id', 'is', null); // Use a condition that always matches to delete all rows

    if (error) throw error;

    result.innerHTML = '<span class="success">✓ driver_jobs table cleared successfully!</span>';
    console.log('driver_jobs table cleared.');
  } catch (error) {
    console.error('Error clearing driver_jobs table:', error);
    result.innerHTML = `<span class="error">✗ Error clearing table:</span>\n${sanitizeHTML(error.message)}`;
  }
};

window.checkData = async function() {
  const result = document.getElementById('dataResult');
  result.innerHTML = '<span class="warning">Loading...</span>';

  try {
    const { data, error } = await supabase
      .from('driver_jobs')
      .select('id, reference, shipment_no, vehicle_desc, driver_name, delivery, material')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    result.innerHTML = `<span class="success">✓ Found ${data.length} rows!</span>\n\n` +
      sanitizeHTML(JSON.stringify(data, null, 2));
  } catch (error) {
    result.innerHTML = `<span class="error">✗ Error:</span>\n${sanitizeHTML(error.message)}\n\n` +
      sanitizeHTML(JSON.stringify(error, null, 2));
  }
};

window.importAllRows = async function() {
  const result = document.getElementById('importAllResult');
  const progressBar = document.getElementById('progressBar');
  const progressFill = document.getElementById('progressFill');
  const skipErrors = document.getElementById('skipErrors').checked;
  const importMode = document.querySelector('input[name="importMode"]:checked').value;

  if (!window.sheetData) {
    result.innerHTML = '<span class="error">✗ Please fetch sheet data first!</span>';
    return;
  }

  window.importStopped = false;
  progressBar.style.display = 'block';

  const data = window.sheetData.data;
  const stats = {
    total: data.length,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };

  const modeText = importMode === 'upsert' ? 'Upsert' : 'Insert All';
  result.innerHTML = `<span class="warning">⏳ Importing ${data.length} rows (${modeText} mode)...</span>\n\n`;

  for (let i = 0; i < data.length; i++) {
    if (window.importStopped) {
      result.innerHTML += `\n<span class="warning">⏹ Import stopped by user at row ${i + 2}</span>`;
      break;
    }

    try {
      const row = data[i];
      const mapped = mapRowToDatabase(row);

      // Check for unconverted dates (warning only, don't stop)
      const unconvertedDates = [];
      Object.entries(mapped).forEach(([key, value]) => {
        if (value && typeof value === 'string' && /\d{1,2}\/\d{1,2}\/\d{4}/.test(value)) {
          unconvertedDates.push({ field: key, value: value });
          // Convert it now instead of failing
          const converted = convertDateFormat(value);
          if (converted) {
            mapped[key] = converted;
          }
        }
      });

      if (unconvertedDates.length > 0) {
        console.warn(`Row ${i + 2}: Unconverted dates found and fixed:`, unconvertedDates);
      }

      // Auto-generate reference if missing
      if (!mapped.reference) {
        // Try to use shipment_no
        if (mapped.shipment_no) {
          mapped.reference = mapped.shipment_no;
        } else {
          // Use row number as reference
          mapped.reference = `ROW-${i + 2}`;
          console.log(`Generated reference for row ${i + 2}: ${mapped.reference}`);
        }
      }

      let insertData, error;

      if (importMode === 'upsert') {
        // Upsert mode - update if exists, insert if new
        ({ data: insertData, error } = await supabase
          .from('driver_jobs')
          .upsert(mapped, {
            onConflict: 'reference'
          })
          .select());
      } else {
        // Insert all mode - insert every row using original reference
        const insertPayload = { ...mapped };

        ({ data: insertData, error } = await supabase
          .from('driver_jobs')
          .insert(insertPayload)
          .select());
      }

      if (error) throw error;

      stats.success++;

    } catch (error) {
      stats.failed++;
      const errorMsg = error.message || String(error);
      const errorDetail = `Row ${i + 2} (${row['Reference'] || row['Shipment No.'] || 'Unknown'}): ${errorMsg}`;
      stats.errors.push(errorDetail);
      console.error(errorDetail, error);

      // Always continue to next row (skipErrors is always on for importing all rows)
      // Don't stop import even if skipErrors is unchecked
    }

    // Update progress
    const progress = ((i + 1) / data.length) * 100;
    progressFill.style.width = `${progress}%`;
    progressFill.textContent = `${Math.round(progress)}%`;

    // Update result every 10 rows
    if ((i + 1) % 10 === 0 || i === data.length - 1) {
      result.innerHTML = `<span class="warning">⏳ Importing (${modeText})...</span>\n\n` +
        `Progress: ${i + 1}/${data.length}\n` +
        `Success: ${stats.success}\n` +
        `Failed: ${stats.failed}\n` +
        (stats.skipped > 0 ? `Skipped: ${stats.skipped}\n` : '');
    }
  }

  // Final result
  const summaryStats = `Total: ${stats.total}\nSuccess: ${stats.success}\nFailed: ${stats.failed}` +
    (stats.skipped > 0 ? `\nSkipped: ${stats.skipped}` : '');

  if (stats.failed === 0 && stats.skipped === 0) {
    result.innerHTML = `<span class="success">✓ Import Complete!</span>\n\n` + summaryStats;
  } else {
    result.innerHTML = `<span class="warning">⚠ Import Complete with Issues</span>\n\n` +
      summaryStats + `\n\n` +
      `Errors (first 20):\n${sanitizeHTML(stats.errors.slice(0, 20).join('\n'))}\n` +
      (stats.errors.length > 20 ? `\n...and ${stats.errors.length - 20} more` : '');
  }

  progressFill.style.width = '100%';
  progressFill.textContent = '100%';
};

window.stopImport = function() {
  window.importStopped = true;
  document.getElementById('importAllResult').innerHTML += '\n<span class="warning">⏹ Stopping import...</span>';
};

// This init function will be called when the section is loaded
window.initDebugImport = async function() {
  console.log('initDebugImport called');
  // Load default sheet names
  await window.loadSheetNames();
  document.getElementById('fetchResult').innerHTML = '<span class="warning">Ready! Click "Fetch Sheet Data" to start</span>';
};
