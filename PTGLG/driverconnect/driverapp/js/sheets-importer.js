/**
 * Google Sheets Importer Module
 * Import SAP data from Google Sheets to Supabase driver_jobs table
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Column mapping configuration - ALL columns in driver_jobs table
export const COLUMN_MAPPING = {
  // Main identifiers
  'Shipment No.': 'shipment_no',
  'Reference': 'reference',
  
  // Status
  'Sts': 'sts',
  'Sts Text': 'sts_text',
  
  // Vehicle
  'Vehicle': 'vehicle',
  'Vehicle Description': 'vehicle_desc',
  'Trip': 'trip',
  
  // Carrier & Driver
  'Carrier': 'carrier',
  'Carrier Name': 'carrier_name',
  'Driver': 'driver',
  'Driver name': 'driver_name',
  
  // Route
  'Route': 'route',
  'Distance': 'distance',
  'Distance UOM': 'distance_uom',
  
  // Scheduling
  'Scheduling end': 'scheduling_end',
  'Planned load start (Date)': 'planned_load_start_date',
  'Planned load start (Time)': 'planned_load_start_time',
  'Actual load start (Date)': 'actual_load_start_date',
  'Actual load start (Time)': 'actual_load_start_time',
  'Actual load end (Date)': 'actual_load_end_date',
  'Actual load end (Time)': 'actual_load_end_time',
  'Actual del.conf.end (Date)': 'actual_del_conf_end_date',
  
  // Transport Plan
  'Transport Plan Pt': 'transport_plan_pt',
  'Transport Plan Pt Desc': 'transport_plan_pt_desc',
  
  // Shipment Type
  'Shipment Type': 'shipment_type',
  'Shipment Type Desc': 'shipment_type_desc',
  
  // Costing
  'ShpCosting': 'shp_costing',
  'ShpCostSettl': 'shp_cost_settl',
  
  // Delivery Item columns (now in driver_jobs table)
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
  'Canceled': 'canceled'
};

/**
 * Get Google Sheets CSV export URL
 */
export function getSheetCSVUrl(sheetId, sheetName) {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
}

/**
 * Parse CSV text to array of objects
 */
export function parseCSV(csvText) {
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

/**
 * Parse single CSV line (handles quoted values)
 */
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

/**
 * Map Google Sheets row to driver_jobs database format
 */
export function mapRowToDriverJob(row) {
  const mapped = {
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Map ALL columns (now includes delivery items)
  Object.entries(COLUMN_MAPPING).forEach(([sheetCol, dbCol]) => {
    if (row[sheetCol] !== undefined && row[sheetCol] !== '') {
      let value = row[sheetCol];

      // Type conversions
      if (dbCol === 'distance' || dbCol === 'delivery_qty') {
        value = parseFloat(value) || null;
      } else if (dbCol.includes('_date') && value) {
        // Keep date as string for now (database will parse)
        value = value.trim();
      } else if (dbCol.includes('_time') && value) {
        value = value.trim();
      } else if (dbCol === 'scheduling_end' && value) {
        // Convert to ISO timestamp if needed
        value = value.trim();
      } else if (dbCol === 'canceled') {
        // Convert to boolean
        value = value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'x';
      }

      mapped[dbCol] = value;
    }
  });

  // Ensure reference exists (use shipment_no if not provided)
  if (!mapped.reference && mapped.shipment_no) {
    mapped.reference = mapped.shipment_no;
  }

  // Set drivers field from driver_name if not exists
  if (!mapped.drivers && mapped.driver_name) {
    mapped.drivers = mapped.driver_name;
  }

  return mapped;
}

/**
 * Map row to driver_job_items format
 * DEPRECATED - Now all columns are in driver_jobs table
 */
export function mapRowToJobItem(row, jobId, reference) {
  // Kept for backward compatibility but not used
  console.warn('mapRowToJobItem is deprecated - all columns now in driver_jobs');
  return null;
}

/**
 * Group rows by shipment (for one-to-many relationship)
 * DEPRECATED - Now using flat structure
 */
export function groupRowsByShipment(rows) {
  // Kept for backward compatibility but not used
  console.warn('groupRowsByShipment is deprecated - using flat import');
  return new Map();
}

/**
 * Import data from Google Sheets
 * Now simplified - all columns go to driver_jobs table
 */
export async function importFromSheets(supabase, sheetId, sheetName, options = {}) {
  const {
    startRow = 2,
    onProgress = () => {}
  } = options;

  const stats = {
    total: 0,
    success: 0,
    failed: 0,
    errors: []
  };

  try {
    // Fetch CSV data
    const url = getSheetCSVUrl(sheetId, sheetName);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('Cannot access Google Sheet. Make sure it is public.');
    }

    const csvText = await response.text();
    const { headers, data } = parseCSV(csvText);

    stats.total = data.length;
    onProgress({ stage: 'parsing', current: 0, total: data.length });

    // Import all rows directly to driver_jobs
    for (let i = 0; i < data.length; i++) {
      try {
        const jobData = mapRowToDriverJob(data[i]);
        
        if (!jobData.reference) {
          throw new Error('Missing reference/shipment_no');
        }

        const { error } = await supabase
          .from('driver_jobs')
          .upsert(jobData, { 
            onConflict: 'reference',
            returning: 'minimal'
          });

        if (error) throw error;

        stats.success++;
      } catch (error) {
        stats.failed++;
        stats.errors.push(`Row ${i + startRow}: ${error.message}`);
      }

      onProgress({ 
        stage: 'importing', 
        current: i + 1, 
        total: data.length,
        stats 
      });
    }

    return stats;

  } catch (error) {
    stats.errors.push(`Import failed: ${error.message}`);
    throw error;
  }
}

export default {
  getSheetCSVUrl,
  parseCSV,
  mapRowToDriverJob,
  importFromSheets,
  COLUMN_MAPPING
};
