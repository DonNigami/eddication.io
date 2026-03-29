/**
 * MLSTMS - Sheet Manager
 *
 * Modernized Google Sheets operations with ES6+ features
 */

// ============================================
// SHEET MANAGER CLASS
// ============================================

class SheetManager {
  constructor(configManager) {
    this.configManager = configManager;
    this.ss = SpreadsheetApp.getActiveSpreadsheet();
  }

  /**
   * Refresh spreadsheet reference
   */
  refreshSpreadsheet() {
    this.ss = SpreadsheetApp.getActiveSpreadsheet();
  }

  /**
   * Get or create sheet
   * @param {string} sheetName - Sheet name
   * @param {boolean} createIfNotExists - Create sheet if not exists
   * @returns {Sheet} Sheet object or null
   */
  getSheet(sheetName, createIfNotExists = true) {
    let sheet = this.ss.getSheetByName(sheetName);

    if (!sheet && createIfNotExists) {
      Logger.log(`   → Creating new sheet: "${sheetName}"`);
      sheet = this.ss.insertSheet(sheetName);
    }

    return sheet;
  }

  /**
   * Prepare sheet with headers
   * @param {string} sheetName - Sheet name
   * @param {string[]} headers - Header array
   * @param {boolean} clearData - Clear existing data
   * @returns {Sheet} Prepared sheet
   */
  prepareSheet(sheetName, headers, clearData = true) {
    Logger.log(`📝 prepareSheet: "${sheetName}" (clearData=${clearData})`);

    const sheet = this.getSheet(sheetName);

    if (!sheet) {
      throw new Error(`Failed to get or create sheet: "${sheetName}"`);
    }

    // Clear data if requested
    if (clearData) {
      sheet.clear();
      Logger.log(`   → Cleared all data`);
    } else {
      Logger.log(`   → Using existing sheet (last row: ${sheet.getLastRow()})`);
    }

    // Check if headers exist
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    const existingHeader = headerRange.getValues()[0];
    const needsHeader = existingHeader[0] !== headers[0] || existingHeader.every(h => !h);

    if (needsHeader) {
      Logger.log(`   → Creating new headers`);

      // Set headers
      headerRange.setValues([headers]);

      // Format headers
      headerRange
        .setFontWeight('bold')
        .setBackground('#4285F4')
        .setFontColor('#FFFFFF')
        .setHorizontalAlignment('center');

      // Freeze header row
      sheet.setFrozenRows(1);

      Logger.log(`   → Headers created: ${headers.length} columns`);
    } else {
      Logger.log(`   → Headers already exist, skipping`);
    }

    Logger.log(`   → Sheet ready: "${sheet.getName()}"`);

    return sheet;
  }

  /**
   * Get trip headers
   * @param {Object} trip - Sample trip object
   * @returns {string[]} Header array
   */
  getTripHeaders(trip = {}) {
    return [
      'Trip ID',
      'Trip Name',
      'License No',
      'Status ID',
      'Status Name',
      'Trip Open DateTime',
      'Trip Close DateTime',
      'Total Distance (km)',
      'Created At',
      'Updated At',
    ];
  }

  /**
   * Get trip detail headers with waypoints
   * @param {Object} tripDetail - Sample trip detail object
   * @returns {string[]} Header array
   */
  getTripDetailHeaders(tripDetail = {}) {
    const baseHeaders = [
      'Trip ID',
      'Trip Name',
      'License No',
      'Status ID',
      'Status Name',
      'Trip Open DateTime',
      'Trip Close DateTime',
      'Total Distance (km)',
      'Driver Name',
      'Driver Phone',
      'Vehicle Type',
      'Created At',
      'Updated At',
    ];

    // Add waypoint headers (up to 20)
    const waypointHeaders = [];
    for (let i = 1; i <= 20; i++) {
      waypointHeaders.push(
        `WP${i} Sequence`,
        `WP${i} Reference ID`,
        `WP${i} Name`,
        `WP${i} Address`,
        `WP${i} Latitude`,
        `WP${i} Longitude`,
        `WP${i} Arrival DateTime`,
        `WP${i} Departure DateTime`,
        `WP${i} Status`
      );
    }

    return [...baseHeaders, ...waypointHeaders];
  }

  /**
   * Convert trip to row data
   * @param {Object} trip - Trip object
   * @returns {*[]} Row data array
   */
  tripToRow(trip) {
    const tripStatus = trip.tripStatus || {};

    return [
      getTripField(trip, ['tripId', 'id', 'trip_code', 'tripCode', 'trip_id']),
      getTripField(trip, ['tripName', 'name', 'trip_name']),
      getTripField(trip, ['licenseNo', 'plateNo', 'license_no', 'plate_no', 'vehicleLicenseNo']),
      tripStatus.statusId || tripStatus.id || getTripField(trip, ['statusId', 'status_id', 'status']),
      tripStatus.statusName || tripStatus.name || getTripField(trip, ['statusName', 'status_name']),
      getTripField(trip, ['openDateTime', 'tripOpenDateTime', 'startDateTime', 'trip_open_date_time']),
      getTripField(trip, ['closeDateTime', 'tripCloseDateTime', 'endDateTime', 'trip_close_date_time']),
      getTripField(trip, ['distance', 'totalDistance', 'total_distance']),
      getTripField(trip, ['createdAt', 'created_at', 'createdDate']),
      getTripField(trip, ['updatedAt', 'updated_at', 'updatedDate']),
    ];
  }

  /**
   * Convert trip detail to row data
   * @param {Object} detail - Trip detail object
   * @returns {*[]} Row data array
   */
  tripDetailToRow(detail) {
    const trip = detail.data || detail.trip || detail;
    const waypoints = trip.waypoints || [];
    const tripStatus = trip.tripStatus || {};

    // Trip data
    const tripData = [
      getTripField(trip, ['tripId', 'id', 'trip_code', 'tripCode', 'trip_id']),
      getTripField(trip, ['tripName', 'name', 'trip_name']),
      getTripField(trip, ['licenseNo', 'plateNo', 'license_no', 'plate_no', 'vehicleLicenseNo']),
      tripStatus.statusId || tripStatus.id || getTripField(trip, ['statusId', 'status_id', 'status']),
      tripStatus.statusName || tripStatus.name || getTripField(trip, ['statusName', 'status_name']),
      getTripField(trip, ['openDateTime', 'tripOpenDateTime', 'startDateTime', 'trip_open_date_time']),
      getTripField(trip, ['closeDateTime', 'tripCloseDateTime', 'endDateTime', 'trip_close_date_time']),
      getTripField(trip, ['distance', 'totalDistance', 'total_distance']),
      getTripField(trip, ['driverName', 'driver_name', 'driverFullName']),
      getTripField(trip, ['driverPhone', 'driver_phone', 'driverMobile']),
      getTripField(trip, ['vehicleType', 'vehicle_type', 'vehicleModel']),
      getTripField(trip, ['createdAt', 'created_at', 'createdDate']),
      getTripField(trip, ['updatedAt', 'updated_at', 'updatedDate']),
    ];

    // Waypoint data
    const waypointData = [];
    for (let i = 0; i < 20; i++) {
      if (i < waypoints.length) {
        const wp = waypoints[i];
        waypointData.push(
          wp.sequence || '',
          wp.reference || wp.waypointReferenceId || '',
          wp.waypointName || '',
          '', // address
          '', // latitude
          '', // longitude
          wp.actualArrivalDateTime || wp.planArrivalDateTime || '',
          wp.actualDepartureDateTime || wp.planDepartureDateTime || '',
          '' // status
        );
      } else {
        waypointData.push('', '', '', '', '', '', '', '', '');
      }
    }

    return [...tripData, ...waypointData];
  }

  /**
   * Save trips to sheet with duplicate checking
   * @param {Object[]} trips - Array of trip objects
   * @param {boolean} append - Append to existing data
   * @param {boolean} checkDuplicates - Check for duplicates
   * @returns {Object} Save statistics
   */
  saveTrips(trips, append = false, checkDuplicates = true) {
    const config = this.configManager.getAll();
    const { tripsSheetName } = config;

    Logger.log(`📝 Saving trips to sheet "${tripsSheetName}"...`);
    Logger.log(`   - Trips count: ${trips?.length ?? 0}`);
    Logger.log(`   - Append mode: ${append}`);
    Logger.log(`   - Duplicate check: ${checkDuplicates}`);

    if (!trips?.length) {
      Logger.log('⚠️ No trips to save.');
      return { updated: 0, inserted: 0, total: 0 };
    }

    // Get headers
    const headers = this.getTripHeaders(trips[0]);
    const sheet = this.prepareSheet(tripsSheetName, headers, !append);

    // Convert to rows
    const data = trips.map(trip => this.tripToRow(trip));

    let rowsUpdated = 0;
    let rowsInserted = 0;

    if (checkDuplicates && sheet.getLastRow() > 1) {
      // Duplicate check mode
      Logger.log(`   - 🔍 Duplicate check enabled`);

      const lastRow = sheet.getLastRow();
      const existingData = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
      const tripIdToRow = new Map();

      // Build lookup map
      existingData.forEach((row, i) => {
        const tripId = String(row[0]);
        if (tripId) {
          tripIdToRow.set(tripId, i + 2);
        }
      });

      Logger.log(`   - Existing trips in sheet: ${tripIdToRow.size}`);

      // Separate updates and inserts
      const rowsToUpdate = [];
      const rowsToInsert = [];

      data.forEach((row, i) => {
        const tripId = String(row[0]);
        const rowNum = tripIdToRow.get(tripId);

        if (rowNum) {
          rowsToUpdate.push({ rowNum, data: row });
          Logger.log(`   - ♻️ Trip ID ${tripId} found at row ${rowNum} - will update`);
        } else {
          rowsToInsert.push(row);
          Logger.log(`   - ➕ Trip ID ${tripId} not found - will insert`);
        }
      });

      // Update existing rows
      rowsToUpdate.forEach(({ rowNum, data }) => {
        sheet.getRange(rowNum, 1, 1, data.length).setValues([data]);
        rowsUpdated++;
      });
      Logger.log(`   - ✅ Updated ${rowsUpdated} existing trips`);

      // Insert new rows
      if (rowsToInsert.length > 0) {
        const insertStartRow = lastRow + 1;
        sheet.getRange(insertStartRow, 1, rowsToInsert.length, rowsToInsert[0].length).setValues(rowsToInsert);
        rowsInserted = rowsToInsert.length;
        Logger.log(`   - ✅ Inserted ${rowsInserted} new trips`);
      }
    } else {
      // Normal mode: write or append
      let startRow = 2;

      if (append) {
        const lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          startRow = lastRow + 1;
        }
      }

      Logger.log(`   - Writing to range: Row ${startRow}, Col 1, ${data.length} rows, ${data[0].length} cols`);

      sheet.getRange(startRow, 1, data.length, data[0].length).setValues(data);
      rowsInserted = data.length;
      Logger.log(`   - ✅ Data written successfully`);
    }

    if (checkDuplicates) {
      Logger.log(`✅ ${data.length} trips processed: ${rowsUpdated} updated, ${rowsInserted} inserted`);
    } else {
      Logger.log(`✅ ${data.length} trips saved to sheet "${tripsSheetName}"`);
    }

    return { updated: rowsUpdated, inserted: rowsInserted, total: data.length };
  }

  /**
   * Save trip details to sheet
   * @param {Object[]} tripDetails - Array of trip detail objects
   * @param {boolean} append - Append to existing data
   * @param {boolean} checkDuplicates - Check for duplicates
   * @returns {Object} Save statistics
   */
  saveTripDetails(tripDetails, append = false, checkDuplicates = true) {
    const config = this.configManager.getAll();
    const { tripDetailsSheetName } = config;

    Logger.log(`📝 Saving trip details... (count: ${tripDetails.length}, checkDuplicates: ${checkDuplicates})`);

    if (!tripDetails?.length) {
      Logger.log('⚠️ No trip details to save.');
      return { updated: 0, inserted: 0, total: 0 };
    }

    // Get headers
    const headers = this.getTripDetailHeaders(tripDetails[0]);
    const sheet = this.prepareSheet(tripDetailsSheetName, headers, !append);

    // Convert to rows
    const data = tripDetails.map(detail => this.tripDetailToRow(detail));

    let rowsUpdated = 0;
    let rowsInserted = 0;

    if (checkDuplicates && sheet.getLastRow() > 1) {
      Logger.log(`   - 🔍 Duplicate check enabled for TripDetails`);

      const lastRow = sheet.getLastRow();
      const existingData = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
      const tripIdToRow = new Map();

      existingData.forEach((row, i) => {
        const tripId = String(row[0]);
        if (tripId) {
          tripIdToRow.set(tripId, i + 2);
        }
      });

      Logger.log(`   - Existing trip details in sheet: ${tripIdToRow.size}`);

      const rowsToUpdate = [];
      const rowsToInsert = [];

      data.forEach((row) => {
        const tripId = String(row[0]);
        const rowNum = tripIdToRow.get(tripId);

        if (rowNum) {
          rowsToUpdate.push({ rowNum, data: row });
          Logger.log(`   - ♻️ Trip ID ${tripId} found at row ${rowNum} - will update`);
        } else {
          rowsToInsert.push(row);
          Logger.log(`   - ➕ Trip ID ${tripId} not found - will insert`);
        }
      });

      rowsToUpdate.forEach(({ rowNum, data }) => {
        sheet.getRange(rowNum, 1, 1, data.length).setValues([data]);
        rowsUpdated++;
      });
      Logger.log(`   - ✅ Updated ${rowsUpdated} existing trip details`);

      if (rowsToInsert.length > 0) {
        const insertStartRow = lastRow + 1;
        sheet.getRange(insertStartRow, 1, rowsToInsert.length, rowsToInsert[0].length).setValues(rowsToInsert);
        rowsInserted = rowsToInsert.length;
        Logger.log(`   - ✅ Inserted ${rowsInserted} new trip details`);
      }
    } else {
      let startRow = 2;

      if (append) {
        const lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          startRow = lastRow + 1;
        }
      }

      sheet.getRange(startRow, 1, data.length, data[0].length).setValues(data);
      rowsInserted = data.length;
    }

    if (checkDuplicates) {
      Logger.log(`✅ ${data.length} trip details processed: ${rowsUpdated} updated, ${rowsInserted} inserted`);
    } else {
      Logger.log(`✅ ${data.length} trip details saved to sheet "${tripDetailsSheetName}"`);
    }

    return { updated: rowsUpdated, inserted: rowsInserted, total: data.length };
  }

  /**
   * Check sheets status
   * @returns {Object} Status object
   */
  checkStatus() {
    const config = this.configManager.getAll();
    const { tripsSheetName, tripDetailsSheetName } = config;

    const tripsSheet = this.ss.getSheetByName(tripsSheetName);
    const detailsSheet = this.ss.getSheetByName(tripDetailsSheetName);

    return {
      trips: tripsSheet ? { exists: true, rows: Math.max(0, tripsSheet.getLastRow() - 1) } : { exists: false, rows: 0 },
      details: detailsSheet ? { exists: true, rows: Math.max(0, detailsSheet.getLastRow() - 1) } : { exists: false, rows: 0 },
    };
  }
}

// ============================================
// GLOBAL INSTANCE
// ============================================

const sheetManager = new SheetManager(configManager);

// Backward compatibility functions
function prepareSheet(sheetName, headers, clearData) {
  return sheetManager.prepareSheet(sheetName, headers, clearData);
}

function getTripHeaders(trip) {
  return sheetManager.getTripHeaders(trip);
}

function getTripDetailHeaders(tripDetail) {
  return sheetManager.getTripDetailHeaders(tripDetail);
}

function saveTripsToSheet(trips, append, checkDuplicates) {
  return sheetManager.saveTrips(trips, append, checkDuplicates);
}

function saveTripDetailsToSheet(tripDetails, append, checkDuplicates) {
  return sheetManager.saveTripDetails(tripDetails, append, checkDuplicates);
}

function checkSheetsStatus() {
  const ui = SpreadsheetApp.getUi();
  const status = sheetManager.checkStatus();
  const config = configManager.getAll();

  let message = '📊 Sheets Status:\n\n';

  const { trips, details } = status;
  const { tripsSheetName, tripDetailsSheetName } = config;

  message += trips.exists
    ? `✅ "${tripsSheetName}": ${trips.rows} rows\n`
    : `⚠️ "${tripsSheetName}": Not created yet\n`;

  message += details.exists
    ? `✅ "${tripDetailsSheetName}": ${details.rows} rows\n`
    : `⚠️ "${tripDetailsSheetName}": Not created yet\n`;

  message += '\nSheets will be created automatically on first run.';

  ui.alert('Sheets Status', message, ui.ButtonSet.OK);
}
