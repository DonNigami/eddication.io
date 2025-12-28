/**
 * Sheet Actions Module - Adapted for Google Apps Script structure
 * Business logic for all API endpoints using Google Sheets
 */

const { v4: uuidv4 } = require('uuid');
const { ImageStorage } = require('./image-storage');
const SHEETS = require('./sheet-names');

class SheetActions {
  constructor(db, zoileDb) {
    this.db = db;
    this.zoileDb = zoileDb;
    this.imageStorage = new ImageStorage(process.env.DATA_DIR || './data');
  }

  /**
   * SEARCH: Find a job by reference number
   * Returns comprehensive job data with all stops and aggregated information
   */
  async search(keyword, userId) {
    try {
      const target = String(keyword || '').trim().toUpperCase();
      const now = new Date();

      // Step 1: Try jobdata first
      const jobdata = await this.db.readRange(SHEETS.JOBDATA, 'A:AZ');
      let jobRowsForRef = [];

      if (jobdata && jobdata.length > 1) {
        const headers = jobdata[0];
        const referenceIdx = headers.indexOf('referenceNo');
        
        if (referenceIdx !== -1) {
          // Exact match
          for (let i = 1; i < jobdata.length; i++) {
            const cell = jobdata[i][referenceIdx];
            if (!cell) continue;
            const value = String(cell).trim().toUpperCase();
            if (value === target) {
              jobRowsForRef.push({ rowIndex: i + 1, row: jobdata[i], headers });
            }
          }

          // Fallback: relaxed matching
          if (jobRowsForRef.length === 0) {
            for (let i = 1; i < jobdata.length; i++) {
              const cell = jobdata[i][referenceIdx];
              if (!cell) continue;
              const value = String(cell).trim().toUpperCase();
              if (value.includes(target) || target.includes(value)) {
                jobRowsForRef.push({ rowIndex: i + 1, row: jobdata[i], headers });
              }
            }
          }
        }
      }

      // If found in jobdata, use it directly
      if (jobRowsForRef.length > 0) {
        const stops = [];
        const shipmentSet = {};

        jobRowsForRef.forEach((obj, idx) => {
          const row = obj.row;
          const headers = obj.headers;
          
          stops.push({
            seq: idx + 1,
            ...this._rowToObject(headers, row)
          });

          const shipmentNo = String(row[headers.indexOf('shipmentNo')] || '').trim();
          if (shipmentNo) shipmentSet[shipmentNo] = true;
        });

        const firstStop = jobRowsForRef[0];
        const firstStopObj = this._rowToObject(firstStop.headers, firstStop.row);
        const alcoholData = await this._getAlcoholForReference(target);
        const shipmentList = Object.keys(shipmentSet);

        return {
          success: true,
          data: {
            referenceNo: target,
            shipmentNos: shipmentList,
            shipmentNo: shipmentList.length === 1 ? shipmentList[0] : '',
            totalStops: stops.length,
            stops: stops,
            alcohol: alcoholData || { drivers: [], checkedDrivers: [] },
            jobClosed: !!firstStopObj.jobClosedAt,
            tripEnded: !!firstStopObj.tripEndedAt
          }
        };
      }

      // Step 2: If not in jobdata, search Zoile sheets
      if (!this.zoileDb) {
        return { success: false, message: 'Job not found' };
      }

      let zoileMatches = [];
      let sourceType = null;

      // Search InputZoile30 first (column 31 = Reference, 0-based index = 30)
      const inputZoile = await this.zoileDb.readRange(SHEETS.ZOILE_INPUT, 'A:AZ');
      if (inputZoile && inputZoile.length > 1) {
        const refColIdx = 30;
        for (let i = 1; i < inputZoile.length; i++) {
          if (inputZoile[i][refColIdx] && 
              String(inputZoile[i][refColIdx]).toUpperCase() === target) {
            zoileMatches.push({ index: i, row: inputZoile[i] });
          }
        }
        if (zoileMatches.length > 0) {
          sourceType = 'InputZoile30';
        }
      }

      // If not found, search data sheet (column 13 = Reference, 0-based index = 12)
      if (zoileMatches.length === 0) {
        const zoileData = await this.zoileDb.readRange(SHEETS.ZOILE_DATA, 'A:AZ');
        if (zoileData && zoileData.length > 1) {
          const refColIdx = 12;
          for (let i = 1; i < zoileData.length; i++) {
            if (zoileData[i][refColIdx] && 
                String(zoileData[i][refColIdx]).toUpperCase() === target) {
              zoileMatches.push({ index: i, row: zoileData[i] });
            }
          }
          if (zoileMatches.length > 0) {
            sourceType = 'ZoileData';
          }
        }
      }

      if (zoileMatches.length === 0) {
        return { success: false, message: 'Job not found' };
      }

      console.log(`✅ Found ${zoileMatches.length} matches in ${sourceType} for ${target}`);

      // ============================================================
      // Build comprehensive response from Zoile data
      // ============================================================
      const firstRow = zoileMatches[0].row;

      // Extract core info from first matching row
      const shipmentNo = this._getZoileColumnByIndex(firstRow, 1) || ''; // Column B = Shipment No.
      const driverName = sourceType === 'InputZoile30' 
        ? this._getZoileColumnByIndex(firstRow, 11) || '' // Column L for input
        : this._getZoileColumnByIndex(firstRow, 4) || '';  // Column E for data
      const vehicleDesc = sourceType === 'InputZoile30'
        ? this._getZoileColumnByIndex(firstRow, 5) || ''  // Column F
        : '';
      const routeValue = this._getZoileColumnByIndex(firstRow, 13) || ''; // Column N

      // Parse drivers
      const drivers = driverName
        ? driverName.split('/').map(d => d.trim()).filter(d => d)
        : [];

      // ============================================================
      // Aggregate destination data
      // ============================================================
      const stationAgg = {};

      zoileMatches.forEach(obj => {
        const row = obj.row;
        
        // Different column indices for different source types
        let shipToCode, shipToName;
        if (sourceType === 'InputZoile30') {
          shipToCode = this._getZoileColumnByIndex(row, 33) || ''; // Column AH
          shipToName = this._getZoileColumnByIndex(row, 34) || '';  // Column AI
        } else {
          // ZoileData
          shipToCode = this._getZoileColumnByIndex(row, 13) || ''; // Column N
          shipToName = this._getZoileColumnByIndex(row, 14) || '';  // Column O
        }

        const material = this._getZoileColumnByIndex(row, 15) || '';   // Column P (same in both)
        const materialDesc = this._getZoileColumnByIndex(row, 16) || ''; // Column Q (same in both)
        const qtyStr = sourceType === 'InputZoile30'
          ? this._getZoileColumnByIndex(row, 17) || ''      // For InputZoile30
          : this._getZoileColumnByIndex(row, 17) || '';     // For ZoileData
        const qty = parseFloat(qtyStr) || 0;
        const distance = this._getZoileColumnByIndex(row, 14) || '';  // Column O

        const stationKey = shipToCode || ('NAME:' + shipToName);

        if (!stationAgg[stationKey]) {
          stationAgg[stationKey] = {
            shipToCode,
            shipToName,
            totalQty: 0,
            linesCount: 0,
            distance: distance,
            materials: {}
          };
        }

        stationAgg[stationKey].totalQty += qty;
        stationAgg[stationKey].linesCount += 1;

        const matKey = material || materialDesc || 'UNKNOWN';
        if (!stationAgg[stationKey].materials[matKey]) {
          stationAgg[stationKey].materials[matKey] = {
            material,
            materialDesc,
            totalQty: 0
          };
        }
        stationAgg[stationKey].materials[matKey].totalQty += qty;
      });

      // ============================================================
      // Build stops array (origin + destinations)
      // ============================================================
      const stops = [];

      // Origin stop (empty sourceRow)
      const originLat = '13.1100258';  // Default Sriracha
      const originLng = '100.9144418';
      const originRadius = 200;

      stops.push({
        seq: 1,
        shipmentNo: shipmentNo,
        referenceNo: target,
        destination1: 'TOP_SR',
        destination2: 'ไทยออยล์ ศรีราชา',
        status: 'NEW',
        totalQty: null,
        linesCount: 0,
        materials: [],
        destLat: originLat,
        destLng: originLng,
        radiusMeters: originRadius,
        isOriginStop: true
      });

      // Destination stops
      let seq = 2;
      Object.keys(stationAgg).forEach(key => {
        const agg = stationAgg[key];
        const materialsArray = Object.keys(agg.materials).map(k => agg.materials[k]);

        stops.push({
          seq: seq++,
          shipmentNo: shipmentNo,
          referenceNo: target,
          destination1: agg.shipToCode,
          destination2: agg.shipToName,
          status: 'NEW',
          totalQty: agg.totalQty,
          linesCount: agg.linesCount,
          materials: materialsArray,
          distanceKm: agg.distance,
          isOriginStop: false
        });
      });

      // Get alcohol data
      const alcoholData = await this._getAlcoholForReference(target);

      return {
        success: true,
        data: {
          referenceNo: target,
          shipmentNos: [shipmentNo],
          shipmentNo: shipmentNo,
          vehicleDescription: vehicleDesc,
          totalStops: stops.length,
          stops: stops,
          alcohol: {
            drivers: drivers,
            checkedDrivers: alcoholData?.checkedDrivers || []
          },
          jobClosed: false,
          tripEnded: false,
          source: sourceType
        }
      };
    } catch (err) {
      console.error('❌ Search error:', err);
      return { 
        success: false, 
        message: err.message || 'Search failed' 
      };
    }
  }

  /**
   * Helper: Get Zoile column value by index
   */
  _getZoileColumnByIndex(row, index) {
    if (!row || index < 0 || index >= row.length) return '';
    return String(row[index] || '').trim();
  }

  /**
   * UPDATE_STOP: Update stop status (check-in, check-out, etc.)
   */
  async updateStop(payload) {
    try {
      const { rowIndex, status, type, userId, lat, lng, odo, accuracy } = payload;

      // Validate
      if (rowIndex === undefined || !status || !type) {
        return { success: false, message: 'Missing required fields: rowIndex, status, or type' };
      }

      // Read jobdata sheet
      const jobdata = await this.db.readRange(SHEETS.JOBDATA, 'A:AZ');
      if (!jobdata || jobdata.length === 0) {
        return { success: false, message: 'Jobdata sheet not found' };
      }

      const headers = jobdata[0];
      const targetRow = rowIndex + 2; // +1 for header, +1 for 1-based

      // Generate unique UUID for this update
      const updateId = uuidv4();
      
      // Determine column to update based on type
      let colName = '';
      let uuidColName = '';
      if (type === 'checkin') {
        colName = 'checkIn';
        uuidColName = 'checkInId';
      } else if (type === 'checkout') {
        colName = 'checkOut';
        uuidColName = 'checkOutId';
      } else if (type === 'fuel') {
        colName = 'fuelingTime';
        uuidColName = 'fuelingId';
      } else if (type === 'unload') {
        colName = 'unloadDoneTime';
        uuidColName = 'unloadDoneId';
      } else if (type === 'review') {
        colName = 'reviewedTime';
        uuidColName = 'reviewedId';
      }

      const colIdx = headers.indexOf(colName);
      if (colIdx === -1) {
        return { success: false, message: `Column ${colName} not found` };
      }

      // Get current row to check if origin stop
      const currentRow = jobdata[rowIndex + 1];
      const sourceRowIdx = headers.indexOf('sourceRow');
      const isOriginStop = !currentRow[sourceRowIdx];

      // ✅ NEW: If checkin on origin stop, must have at least one alcohol checked
      if (type === 'checkin' && isOriginStop) {
        const reference = String(currentRow[headers.indexOf('referenceNo')] || '').trim();
        const hasAlcohol = await this.hasAtLeastOneAlcoholChecked(reference);
        if (!hasAlcohol) {
          return { 
            success: false, 
            message: 'กรุณาเป่าแอลกอฮอล์อย่างน้อย 1 คนก่อนเช็คอินต้นทาง' 
          };
        }
      }

      // Update the cell with timestamp
      const timeStr = new Date().toLocaleTimeString('th-TH');
      const colLetter = this._getColumnLetter(colIdx);
      const updateRange = `${colLetter}${targetRow}`;
      
      await this.db.writeRange(SHEETS.JOBDATA, updateRange, [[timeStr]]);
      
      // Store UUID if column exists
      const uuidColIdx = headers.indexOf(uuidColName);
      if (uuidColIdx !== -1) {
        const uuidLetter = this._getColumnLetter(uuidColIdx);
        const uuidRange = `${uuidLetter}${targetRow}`;
        await this.db.writeRange(SHEETS.JOBDATA, uuidRange, [[updateId]]);
      }

      // ✅ Check distance to destination before updating
      if (lat && lng) {
        const destLatIdx = headers.indexOf('destLat');
        const destLngIdx = headers.indexOf('destLng');
        const radiusIdx = headers.indexOf('radiusMeters');

        let finalRadius = 50;
        if (radiusIdx !== -1) {
          const r = parseFloat(currentRow[radiusIdx]);
          finalRadius = !isNaN(r) && r > 0 ? r : 50;
        }

        if (destLatIdx !== -1 && destLngIdx !== -1) {
          const destLat = parseFloat(currentRow[destLatIdx]);
          const destLng = parseFloat(currentRow[destLngIdx]);

          if (!isNaN(destLat) && !isNaN(destLng)) {
            const distance = this._haversineDistance(destLat, destLng, lat, lng);
            if (distance > finalRadius) {
              return {
                success: false,
                message: `คุณอยู่นอกพื้นที่ที่กำหนด (ห่างจากจุดหมาย ${Math.round(distance)} เมตร / รัศมีอนุญาต ${Math.round(finalRadius)} เมตร)`
              };
            }
          }
        }
      }

      // Store odometer if check-in
      if (type === 'checkin' && odo) {
        const odoColIdx = headers.indexOf('checkInOdo');
        if (odoColIdx !== -1) {
          const odoLetter = this._getColumnLetter(odoColIdx);
          const odoRange = `${odoLetter}${targetRow}`;
          await this.db.writeRange(SHEETS.JOBDATA, odoRange, [[String(odo)]]);
        }
      }

      // Update GPS coordinates if provided
      if (lat && lng) {
        let latCol = '';
        let lngCol = '';
        
        if (type === 'checkin') {
          latCol = 'checkInLat';
          lngCol = 'checkInLng';
        } else if (type === 'checkout') {
          latCol = 'checkOutLat';
          lngCol = 'checkOutLng';
        }

        if (latCol && lngCol) {
          const latIdx = headers.indexOf(latCol);
          const lngIdx = headers.indexOf(lngCol);
          
          if (latIdx !== -1) {
            const latLetter = this._getColumnLetter(latIdx);
            await this.db.writeRange(SHEETS.JOBDATA, `${latLetter}${targetRow}`, [[String(lat)]]);
          }
          if (lngIdx !== -1) {
            const lngLetter = this._getColumnLetter(lngIdx);
            await this.db.writeRange(SHEETS.JOBDATA, `${lngLetter}${targetRow}`, [[String(lng)]]);
          }
        }
      }

      // Update status column
      const statusIdx = headers.indexOf('status');
      if (statusIdx !== -1) {
        const statusLetter = this._getColumnLetter(statusIdx);
        await this.db.writeRange(SHEETS.JOBDATA, `${statusLetter}${targetRow}`, [[status]]);
      }

      // Read updated row
      const updatedRow = jobdata[rowIndex + 1];
      const stop = this._rowToObject(headers, updatedRow);

      return {
        success: true,
        data: { stop }
      };
    } catch (err) {
      console.error('❌ Update stop error:', err);
      return { 
        success: false, 
        message: err.message || 'Update failed' 
      };
    }
  }

  /**
   * UPLOAD_ALCOHOL: Save alcohol check result with image
   */
  async uploadAlcohol(payload) {
    try {
      const { reference, driverName, userId, alcoholValue, lat, lng, imageBase64, accuracy } = payload;

      // Save image
      let imageUrl = '';
      if (imageBase64) {
        const filename = `alcohol_${reference}_${driverName}_${Date.now()}.jpg`;
        imageUrl = await this.imageStorage.saveBase64Image(imageBase64, filename);
      }

      // Append to alcoholcheck sheet
      const timestamp = new Date().toISOString();
      const row = [
        timestamp,
        userId || '',
        reference || '',
        driverName || '',
        alcoholValue || '',
        lat || '',
        lng || '',
        accuracy || '',
        imageUrl || ''
      ];

      await this.db.appendRow(SHEETS.ALCOHOL, [row]);

      // Get updated list of checked drivers
      const checkedDrivers = await this._getCheckedDriversForReference(reference);

      return {
        success: true,
        data: { checkedDrivers }
      };
    } catch (err) {
      console.error('❌ Upload alcohol error:', err);
      return { 
        success: false, 
        message: err.message || 'Upload failed' 
      };
    }
  }

  /**
   * SAVE_AWARENESS: Save awareness acknowledgment
   */
  async saveAwareness(payload) {
    try {
      const { userId, reference, timestamp, acknowledged } = payload;

      const row = [
        timestamp || new Date().toISOString(),
        userId || '',
        reference || '',
        acknowledged ? 'YES' : 'NO'
      ];

      await this.db.appendRow(SHEETS.AWARENESS, [row]);

      return { success: true };
    } catch (err) {
      console.error('❌ Save awareness error:', err);
      return { 
        success: false, 
        message: err.message || 'Save failed' 
      };
    }
  }

  /**
   * UPLOAD_POD: Save proof of delivery with image
   */
  async uploadPOD(payload) {
    try {
      const { rowIndex, shipmentNo, userId, reference, timestamp, imageBase64 } = payload;

      // Save image
      let imageUrl = '';
      if (imageBase64) {
        const filename = `pod_${reference}_${shipmentNo}_${Date.now()}.jpg`;
        imageUrl = await this.imageStorage.saveBase64Image(imageBase64, filename);
      }

      const row = [
        timestamp || new Date().toISOString(),
        userId || '',
        reference || '',
        shipmentNo || '',
        'UPLOADED',
        imageUrl || ''
      ];

      await this.db.appendRow(SHEETS.POD, [row]);

      return { success: true };
    } catch (err) {
      console.error('❌ Upload POD error:', err);
      return { 
        success: false, 
        message: err.message || 'Upload failed' 
      };
    }
  }

  /**
   * EMERGENCY_SOS: Report emergency with image
   */
  async emergencySOS(payload) {
    try {
      const { userId, type, description, lat, lng, imageBase64, reference } = payload;

      // Save image
      let imageUrl = '';
      if (imageBase64) {
        const filename = `sos_${userId}_${Date.now()}.jpg`;
        imageUrl = await this.imageStorage.saveBase64Image(imageBase64, filename);
      }

      const timestamp = new Date().toISOString();
      const row = [
        timestamp,
        userId || '',
        type || 'SOS',
        description || '',
        lat || '',
        lng || '',
        imageUrl || '',
        reference || ''
      ];

      await this.db.appendRow(SHEETS.EMERGENCY, [row]);

      return { success: true };
    } catch (err) {
      console.error('❌ Emergency SOS error:', err);
      return { 
        success: false, 
        message: err.message || 'SOS failed' 
      };
    }
  }

  /**
   * END_TRIP: Save end of trip summary
   */
  async endTrip(payload) {
    try {
      const { reference, userId, endOdo, endPointName, lat, lng, accuracy } = payload;

      // Find all stops for this reference and update tripEndedAt
      const jobdata = await this.db.readRange(SHEETS.JOBDATA, 'A:AZ');
      if (!jobdata || jobdata.length === 0) {
        return { success: false, message: 'Jobdata not found' };
      }

      const headers = jobdata[0];
      const referenceIdx = headers.indexOf('referenceNo');
      const tripEndOdoIdx = headers.indexOf('tripEndOdo');
      const tripEndPlaceIdx = headers.indexOf('tripEndPlace');
      const tripEndLatIdx = headers.indexOf('tripEndLat');
      const tripEndLngIdx = headers.indexOf('tripEndLng');
      const tripEndedAtIdx = headers.indexOf('tripEndedAt');

      const timestamp = new Date().toISOString();

      // Update all matching rows
      for (let i = 1; i < jobdata.length; i++) {
        if (jobdata[i][referenceIdx] && 
            String(jobdata[i][referenceIdx]).toUpperCase() === String(reference).toUpperCase()) {
          
          const rowNum = i + 1;
          
          // Update multiple columns
          const updates = [];
          if (tripEndOdoIdx !== -1) {
            updates.push({
              range: `${this._getColumnLetter(tripEndOdoIdx)}${rowNum}`,
              value: String(endOdo || '')
            });
          }
          if (tripEndPlaceIdx !== -1) {
            updates.push({
              range: `${this._getColumnLetter(tripEndPlaceIdx)}${rowNum}`,
              value: endPointName || ''
            });
          }
          if (tripEndLatIdx !== -1 && lat) {
            updates.push({
              range: `${this._getColumnLetter(tripEndLatIdx)}${rowNum}`,
              value: String(lat)
            });
          }
          if (tripEndLngIdx !== -1 && lng) {
            updates.push({
              range: `${this._getColumnLetter(tripEndLngIdx)}${rowNum}`,
              value: String(lng)
            });
          }
          if (tripEndedAtIdx !== -1) {
            updates.push({
              range: `${this._getColumnLetter(tripEndedAtIdx)}${rowNum}`,
              value: timestamp
            });
          }

          // Execute all updates
          for (const update of updates) {
            await this.db.writeRange(SHEETS.JOBDATA, update.range, [[update.value]]);
          }
        }
      }

      // Also log to EndTrip sheet
      const row = [
        timestamp,
        userId || '',
        reference || '',
        endOdo || '',
        endPointName || '',
        lat || '',
        lng || '',
        accuracy || ''
      ];

      await this.db.appendRow(SHEETS.ENDTRIP, [row]);

      return { success: true };
    } catch (err) {
      console.error('❌ End trip error:', err);
      return { 
        success: false, 
        message: err.message || 'End trip failed' 
      };
    }
  }

  /**
   * FILL_MISSING_STEPS: Save missing steps data
   */
  async fillMissingSteps(payload) {
    try {
      const { userId, reference, data, lat, lng } = payload;

      const timestamp = new Date().toISOString();
      const row = [
        timestamp,
        userId || '',
        reference || '',
        JSON.stringify(data || {}),
        lat || '',
        lng || ''
      ];

      await this.db.appendRow(SHEETS.MISSING_STEPS, [row]);

      return { success: true };
    } catch (err) {
      console.error('❌ Fill missing steps error:', err);
      return { 
        success: false, 
        message: err.message || 'Fill missing steps failed' 
      };
    }
  }

  /**
   * CLOSE_JOB: Mark job as closed
   */
  async closeJob(reference, userId) {
    try {
      // Find all stops for this reference and update jobClosedAt
      const jobdata = await this.db.readRange(SHEETS.JOBDATA, 'A:AZ');
      if (!jobdata || jobdata.length === 0) {
        return { success: false, message: 'Jobdata not found' };
      }

      const headers = jobdata[0];
      const referenceIdx = headers.indexOf('referenceNo');
      const jobClosedAtIdx = headers.indexOf('jobClosedAt');

      if (referenceIdx === -1 || jobClosedAtIdx === -1) {
        return { success: false, message: 'Invalid sheet structure' };
      }

      const timestamp = new Date().toISOString();
      const closedLetter = this._getColumnLetter(jobClosedAtIdx);

      // Update all matching rows
      let updatedCount = 0;
      for (let i = 1; i < jobdata.length; i++) {
        if (jobdata[i][referenceIdx] && 
            String(jobdata[i][referenceIdx]).toUpperCase() === String(reference).toUpperCase()) {
          
          const rowNum = i + 1;
          await this.db.writeRange(SHEETS.JOBDATA, `${closedLetter}${rowNum}`, [[timestamp]]);
          updatedCount++;
        }
      }

      if (updatedCount === 0) {
        return { success: false, message: 'Reference not found' };
      }

      return { success: true, message: `Job closed (${updatedCount} stops updated)` };
    } catch (err) {
      console.error('❌ Close job error:', err);
      return { 
        success: false, 
        message: err.message || 'Close job failed' 
      };
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get alcohol data for a reference
   */
  async _getAlcoholForReference(reference) {
    try {
      const alcoholData = await this.db.readRange(SHEETS.ALCOHOL, 'A:Z');
      if (!alcoholData || alcoholData.length === 0) {
        return { drivers: [], checkedDrivers: [] };
      }

      const headers = alcoholData[0];
      const refIdx = headers.indexOf('reference') !== -1 ? headers.indexOf('reference') : 2;
      const driverIdx = headers.indexOf('driverName') !== -1 ? headers.indexOf('driverName') : 3;

      const checkedDrivers = [];
      for (let i = 1; i < alcoholData.length; i++) {
        if (alcoholData[i][refIdx] && 
            String(alcoholData[i][refIdx]).toUpperCase() === String(reference).toUpperCase()) {
          const driverName = alcoholData[i][driverIdx];
          if (driverName && !checkedDrivers.includes(driverName)) {
            checkedDrivers.push(driverName);
          }
        }
      }

      return {
        drivers: [],
        checkedDrivers
      };
    } catch (err) {
      console.error('❌ Get alcohol data error:', err);
      return { drivers: [], checkedDrivers: [] };
    }
  }

  /**
   * Get checked drivers for a reference
   */
  async _getCheckedDriversForReference(reference) {
    const data = await this._getAlcoholForReference(reference);
    return data.checkedDrivers || [];
  }

  /**
   * Helper: Get a value from Zoile row by column name
   */
  _getZoileColumn(headers, row, columnName) {
    const idx = headers.indexOf(columnName);
    if (idx === -1) return '';
    return row[idx] || '';
  }

  /**
   * Convert row array to object using headers
   */
  _rowToObject(headers, row) {
    const obj = {};
    headers.forEach((header, idx) => {
      if (header) {
        obj[header] = row[idx] || '';
      }
    });
    
    // Map Google Sheet column names to frontend expected field names
    // Frontend expects these field names (legacy compatibility)
    
    // Station/Destination mapping
    if (!obj.destination1 && obj.shipToCode) {
      obj.destination1 = obj.shipToCode;
    }
    if (!obj.destination2 && obj.shipToName) {
      obj.destination2 = obj.shipToName;
    }
    
    // Time field mapping (Sheet uses checkIn/checkOut, frontend expects checkInTime/checkOutTime)
    if (obj.checkIn && !obj.checkInTime) {
      obj.checkInTime = obj.checkIn;
    }
    if (obj.checkOut && !obj.checkOutTime) {
      obj.checkOutTime = obj.checkOut;
    }
    // Note: fuelingTime, unloadDoneTime, reviewedTime are already correct in sheet
    // No mapping needed for these fields
    
    // Distance mapping (Sheet uses "Distance" column, frontend expects distance)
    if (obj.Distance && !obj.distance) {
      obj.distance = obj.Distance;
    }
    
    // Coordinate mappings
    if (obj.destLat && !obj.destinationLat) {
      obj.destinationLat = obj.destLat;
    }
    if (obj.destLng && !obj.destinationLng) {
      obj.destinationLng = obj.destLng;
    }
    
    return obj;
  }

  /**
   * Convert column index to letter (0 = A, 1 = B, etc.)
   */  /**
   * Get Origin config by route (match first 3 characters)
   */
  async getOriginConfigByRoute(routeRaw) {
    if (!routeRaw || !this.db) return null;

    const route = String(routeRaw).trim();
    if (route.length < 3) return null;

    const prefix3 = route.substring(0, 3);

    try {
      const originData = await this.db.readRange(SHEETS.ORIGIN, 'A:F');
      if (!originData || originData.length < 2) return null;

      for (let i = 1; i < originData.length; i++) {
        const row = originData[i];
        const originKey = String(row[0] || '').trim();
        const originName = String(row[1] || '').trim();
        const lat = parseFloat(row[2]);
        const lng = parseFloat(row[3]);
        const radiusMeters = parseFloat(row[4]);
        const routeCode = String(row[5] || '').trim();

        if (!routeCode) continue;

        const routePrefix = routeCode.substring(0, 3);
        if (routePrefix === prefix3) {
          return {
            code: originKey,
            name: originName,
            lat: isNaN(lat) ? '' : lat,
            lng: isNaN(lng) ? '' : lng,
            radiusM: isNaN(radiusMeters) ? 200 : radiusMeters
          };
        }
      }
    } catch (err) {
      console.warn('⚠️ getOriginConfigByRoute error:', err.message);
    }

    return null;
  }

  /**
   * Get default origin config (first row of Origin sheet)
   */
  async getDefaultOriginConfig() {
    try {
      const originData = await this.db.readRange(SHEETS.ORIGIN, 'A:E');
      if (originData && originData.length >= 2) {
        const row = originData[1];
        const originKey = String(row[0] || '').trim();
        const originName = String(row[1] || '').trim();
        const lat = parseFloat(row[2]);
        const lng = parseFloat(row[3]);
        const radiusMeters = parseFloat(row[4]);

        return {
          code: originKey || 'TOP_SR',
          name: originName || 'ไทยออยล์ ศรีราชา',
          lat: isNaN(lat) ? '' : lat,
          lng: isNaN(lng) ? '' : lng,
          radiusM: isNaN(radiusMeters) ? 200 : radiusMeters
        };
      }
    } catch (err) {
      console.warn('⚠️ getDefaultOriginConfig error:', err.message);
    }

    // Fallback
    return {
      code: 'TOP_SR',
      name: 'ไทยออยล์ ศรีราชา',
      lat: 13.1100258,
      lng: 100.9144418,
      radiusM: 200
    };
  }

  /**
   * Check if at least one driver has alcohol checked for a reference
   */
  async hasAtLeastOneAlcoholChecked(reference) {
    const ref = String(reference || '').trim();
    if (!ref) return false;

    try {
      const alcoholData = await this._getAlcoholForReference(ref);
      return alcoholData && alcoholData.checkedDrivers && alcoholData.checkedDrivers.length > 0;
    } catch (err) {
      console.warn('⚠️ hasAtLeastOneAlcoholChecked error:', err.message);
      return false;
    }
  }

  /**
   * Check if user is admin (exists in userprofile sheet with usertype=ADMIN)
   */
  async isAdminUser(userId) {
    const uid = String(userId || '').trim();
    if (!uid) return false;

    try {
      const userdata = await this.db.readRange(SHEETS.USER_PROFILE, 'A:J');
      if (!userdata || userdata.length < 2) return false;

      // Column A = userId, Column J (10) = usertype
      for (let i = 1; i < userdata.length; i++) {
        const row = userdata[i];
        const id = String(row[0] || '').trim();
        const usertype = String(row[9] || '').trim();

        if (id === uid && usertype.toUpperCase() === 'ADMIN') {
          return true;
        }
      }
      return false;
    } catch (err) {
      console.warn('⚠️ isAdminUser error:', err.message);
      return false;
    }
  }

  /**
   * Get user status from userprofile sheet
   */
  async getUserStatus(userId) {
    const uid = String(userId || '').trim();
    if (!uid) return null;

    try {
      const userdata = await this.db.readRange(SHEETS.USER_PROFILE, 'A:J');
      if (!userdata || userdata.length < 2) return null;

      // Column A = userId, Column D (3) = status
      for (let i = 1; i < userdata.length; i++) {
        const row = userdata[i];
        const id = String(row[0] || '').trim();
        const status = row[3]; // Column D

        if (id === uid) {
          return status || null;
        }
      }
      return null;
    } catch (err) {
      console.warn('⚠️ getUserStatus error:', err.message);
      return null;
    }
  }

  /**
   * Haversine distance calculation
   */
  _haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  /**
   * ADMIN_ADD_STOP: Add extra stop for a reference
   */
  async adminAddStop(payload) {
    try {
      const { adminUserId, reference, shipToCode, shipToName, lat, lng, radiusM } = payload;

      if (!adminUserId) {
        return { success: false, message: 'ไม่พบ adminUserId' };
      }
      if (!reference) {
        return { success: false, message: 'กรุณาใส่เลข reference' };
      }
      if (!shipToName) {
        return { success: false, message: 'กรุณาใส่ชื่อจุด (shipToName)' };
      }

      // Check admin permission
      const isAdmin = await this.isAdminUser(adminUserId);
      if (!isAdmin) {
        return { success: false, message: 'คุณไม่มีสิทธิ์ admin' };
      }

      // Find reference in jobdata to get shipmentNo
      const jobdata = await this.db.readRange(SHEETS.JOBDATA, 'A:AZ');
      if (!jobdata || jobdata.length === 0) {
        return { success: false, message: 'ไม่พบชีท jobdata' };
      }

      const headers = jobdata[0];
      const refIdx = headers.indexOf('referenceNo');
      const shipIdx = headers.indexOf('shipmentNo');

      let baseShipmentNo = '';
      for (let i = 1; i < jobdata.length; i++) {
        if (String(jobdata[i][refIdx] || '').trim() === reference) {
          baseShipmentNo = String(jobdata[i][shipIdx] || '').trim();
          break;
        }
      }

      if (!baseShipmentNo) {
        return { success: false, message: 'ไม่พบ reference นี้ใน jobdata (ให้ค้น/สร้างงานก่อน)' };
      }

      const now = new Date();
      const latNum = lat !== undefined && lat !== '' ? parseFloat(lat) : '';
      const lngNum = lng !== undefined && lng !== '' ? parseFloat(lng) : '';
      const radiusMNum = radiusM !== undefined && radiusM !== '' ? parseFloat(radiusM) : '';
      const finalRadius = (radiusMNum !== '' && !isNaN(radiusMNum)) ? radiusMNum : 50;

      // Create new row
      const newRow = new Array(35).fill('');
      newRow[refIdx] = reference;
      newRow[shipIdx] = baseShipmentNo;
      newRow[headers.indexOf('shipToCode')] = shipToCode;
      newRow[headers.indexOf('shipToName')] = shipToName;
      newRow[headers.indexOf('status')] = 'NEW';
      newRow[headers.indexOf('sourceRow')] = 'ADMIN_EXTRA_STOP';

      const destLatIdx = headers.indexOf('destLat');
      const destLngIdx = headers.indexOf('destLng');
      const radiusIdx = headers.indexOf('radiusMeters');

      if (destLatIdx !== -1 && latNum !== '' && !isNaN(latNum)) newRow[destLatIdx] = latNum;
      if (destLngIdx !== -1 && lngNum !== '' && !isNaN(lngNum)) newRow[destLngIdx] = lngNum;
      if (radiusIdx !== -1) newRow[radiusIdx] = finalRadius;

      newRow[headers.indexOf('updatedBy')] = adminUserId;
      newRow[headers.indexOf('updatedAt')] = now;

      await this.db.appendRow(SHEETS.JOBDATA, [newRow]);

      return {
        success: true,
        message: 'เพิ่มจุดเพิ่มเรียบร้อย',
        data: {
          reference,
          shipmentNo: baseShipmentNo,
          shipToCode,
          shipToName,
          lat: latNum,
          lng: lngNum,
          radiusM: finalRadius
        }
      };
    } catch (err) {
      console.error('❌ Admin add stop error:', err);
      return { success: false, message: err.message || 'Admin add stop failed' };
    }
  }

  /**
   * CLOSE_JOB: Close job (all stops completed)
   */
  async closeJob(payload) {
    try {
      const { reference, userId } = payload;

      if (!reference) {
        return { success: false, message: 'ไม่พบเลข Reference สำหรับปิดงาน' };
      }
      if (!userId) {
        return { success: false, message: 'ไม่พบ userId' };
      }

      // Find all rows for this reference
      const jobdata = await this.db.readRange(SHEETS.JOBDATA, 'A:AZ');
      if (!jobdata || jobdata.length === 0) {
        return { success: false, message: 'ไม่พบชีท jobdata' };
      }

      const headers = jobdata[0];
      const refIdx = headers.indexOf('referenceNo');
      const statusIdx = headers.indexOf('status');
      const checkoutIdx = headers.indexOf('checkOut');
      const jobClosedIdx = headers.indexOf('jobClosedAt');

      const refRows = [];
      for (let i = 1; i < jobdata.length; i++) {
        if (String(jobdata[i][refIdx] || '').trim() === reference) {
          refRows.push({ rowIndex: i + 2, row: jobdata[i] });
        }
      }

      if (refRows.length === 0) {
        return { success: false, message: 'ไม่พบข้อมูลงาน Reference นี้ใน jobdata' };
      }

      // Check if already closed
      const alreadyClosed = refRows.every(r => {
        const status = String(r.row[statusIdx] || '').trim();
        const closedAt = r.row[jobClosedIdx];
        return status === 'JOB_DONE' || !!closedAt;
      });

      if (alreadyClosed) {
        return { success: false, message: 'งานนี้ถูกปิดงานเรียบร้อยแล้ว' };
      }

      // Check all checkout
      const notCheckout = refRows.filter(r => !r.row[checkoutIdx]);
      if (notCheckout.length > 0) {
        return { success: false, message: 'ยังมีจุดส่งที่ยังไม่ได้ Check-out ครบทุกจุด ไม่สามารถปิดงานได้' };
      }

      // Update all rows to JOB_DONE
      const now = new Date();
      for (const info of refRows) {
        const updateData = {};
        updateData[statusIdx] = 'JOB_DONE';
        updateData[jobClosedIdx] = now;
        updateData[headers.indexOf('updatedBy')] = userId;
        updateData[headers.indexOf('updatedAt')] = now;

        const range = `A${info.rowIndex}:AZ${info.rowIndex}`;
        const rowData = [...info.row];
        Object.keys(updateData).forEach(idx => {
          rowData[idx] = updateData[idx];
        });
        await this.db.writeRange(SHEETS.JOBDATA, range, [rowData]);
      }

      return {
        success: true,
        message: 'ปิดงานสำเร็จ รถพร้อมใช้งานแล้ว',
        stop: refRows[0]
      };
    } catch (err) {
      console.error('❌ Close job error:', err);
      return { success: false, message: err.message || 'Close job failed' };
    }
  }

  /**
   * END_TRIP_SUMMARY: Record end trip information
   */
  async endTripSummary(payload) {
    try {
      const { reference, userId, endOdo, endPointName, lat, lng } = payload;

      if (!reference) {
        return { success: false, message: 'ไม่พบเลข Reference สำหรับจบทริป' };
      }
      if (!userId) {
        return { success: false, message: 'ไม่พบ userId' };
      }
      if (!endOdo) {
        return { success: false, message: 'กรุณากรอกเลขไมล์จบทริป' };
      }
      if (!endPointName) {
        return { success: false, message: 'กรุณากรอกชื่อจุดจบทริป' };
      }

      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);

      // Find all rows for reference
      const jobdata = await this.db.readRange(SHEETS.JOBDATA, 'A:AZ');
      if (!jobdata || jobdata.length === 0) {
        return { success: false, message: 'ไม่พบชีท jobdata' };
      }

      const headers = jobdata[0];
      const refIdx = headers.indexOf('referenceNo');

      const refRows = [];
      for (let i = 1; i < jobdata.length; i++) {
        if (String(jobdata[i][refIdx] || '').trim() === reference) {
          refRows.push({ rowIndex: i + 2, row: jobdata[i] });
        }
      }

      if (refRows.length === 0) {
        return { success: false, message: 'ไม่พบข้อมูลงาน Reference นี้ใน jobdata' };
      }

      // Update all rows with end trip data
      const now = new Date();
      for (const info of refRows) {
        const rowData = [...info.row];
        const statusIdx = headers.indexOf('status');

        rowData[headers.indexOf('tripEndOdo')] = endOdo;
        rowData[headers.indexOf('tripEndLat')] = isNaN(latNum) ? '' : latNum;
        rowData[headers.indexOf('tripEndLng')] = isNaN(lngNum) ? '' : lngNum;
        rowData[headers.indexOf('tripEndPlace')] = endPointName;
        rowData[headers.indexOf('tripEndedAt')] = now;

        // Only update status if not JOB_DONE
        const currentStatus = String(rowData[statusIdx] || '').trim();
        if (currentStatus !== 'JOB_DONE') {
          rowData[statusIdx] = 'END_TRIP';
        }

        rowData[headers.indexOf('updatedBy')] = userId;
        rowData[headers.indexOf('updatedAt')] = now;

        const range = `A${info.rowIndex}:AZ${info.rowIndex}`;
        await this.db.writeRange(SHEETS.JOBDATA, range, [rowData]);
      }

      return { success: true, message: 'บันทึกข้อมูลจบทริปเรียบร้อยแล้ว' };
    } catch (err) {
      console.error('❌ End trip summary error:', err);
      return { success: false, message: err.message || 'End trip summary failed' };
    }
  }

  /**
   * ALCOHOL_UPLOAD: Record alcohol check
   */
  async alcoholUpload(payload) {
    try {
      const { reference, driverName, userId, alcoholValue, imageBase64, lat, lng } = payload;

      if (!reference || !driverName) {
        return { success: false, message: 'ข้อมูลไม่ครบ (reference/driverName)' };
      }
      if (!userId) {
        return { success: false, message: 'ไม่พบ userId' };
      }

      const alcoholNum = parseFloat(alcoholValue);
      if (isNaN(alcoholNum)) {
        return { success: false, message: 'ปริมาณแอลกอฮอล์ต้องเป็นตัวเลข' };
      }

      const now = new Date();

      // Save image if provided
      let imageUrl = '';
      try {
        if (imageBase64 && String(imageBase64).length > 0) {
          const cleaned = String(imageBase64).replace(/^data:image\/[a-zA-Z]+;base64,/, '');
          const buf = Buffer.from(cleaned, 'base64');
          const safeName = `alcohol_${String(reference).replace(/[^a-zA-Z0-9_-]/g, '-')}_${String(driverName).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
          imageUrl = await this.imageStorage.saveImage(buf, safeName);
        }
      } catch (imgErr) {
        console.warn('⚠️ Alcohol image save failed:', imgErr.message);
        imageUrl = '';
      }

      // Append to alcohol sheet
      const alcoholRow = [
        reference,
        driverName,
        alcoholNum,
        now,
        userId,
        lat || '',
        lng || '',
        imageUrl || ''
      ];

      await this.db.appendRow(SHEETS.ALCOHOL, [alcoholRow]);

      // Get checked drivers for this reference
      const alcoholData = await this._getAlcoholForReference(reference);

      return {
        success: true,
        message: 'บันทึกการตรวจแอลกอฮอล์สำเร็จ',
        checkedDrivers: alcoholData.checkedDrivers || []
      };
    } catch (err) {
      console.error('❌ Alcohol upload error:', err);
      return { success: false, message: err.message || 'Alcohol upload failed' };
    }
  }

  /**
   * REVIEW_UPLOAD: Record delivery review
   */
  async reviewUpload(payload) {
    try {
      const { reference, rowIndex, userId, score, lat, lng, signatureBase64 } = payload;

      if (!reference || !rowIndex) {
        return { success: false, message: 'ข้อมูลไม่ครบ (reference/rowIndex)' };
      }
      if (!userId) {
        return { success: false, message: 'ไม่พบ userId' };
      }
      if (!score) {
        return { success: false, message: 'กรุณาเลือกความพึงพอใจ' };
      }

      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);

      if (isNaN(latNum) || isNaN(lngNum)) {
        return { success: false, message: 'ไม่สามารถอ่านพิกัดจากอุปกรณ์ได้' };
      }

      // Get jobdata row
      const jobdata = await this.db.readRange(SHEETS.JOBDATA, 'A:AZ');
      if (!jobdata || jobdata.length === 0) {
        return { success: false, message: 'ไม่พบชีท jobdata' };
      }

      const headers = jobdata[0];
      const row = jobdata[rowIndex + 1];

      if (!row) {
        return { success: false, message: 'rowIndex ไม่ถูกต้อง' };
      }

      const refInRow = String(row[headers.indexOf('referenceNo')] || '').trim();
      if (refInRow !== reference) {
        return { success: false, message: 'อ้างอิงเลขงานไม่ตรงกับข้อมูลในระบบ' };
      }

      // Check distance
      const destLatIdx = headers.indexOf('destLat');
      const destLngIdx = headers.indexOf('destLng');
      const radiusIdx = headers.indexOf('radiusMeters');

      let finalRadius = 50;
      if (radiusIdx !== -1) {
        const r = parseFloat(row[radiusIdx]);
        finalRadius = !isNaN(r) && r > 0 ? r : 50;
      }

      if (destLatIdx !== -1 && destLngIdx !== -1) {
        const destLat = parseFloat(row[destLatIdx]);
        const destLng = parseFloat(row[destLngIdx]);

        if (!isNaN(destLat) && !isNaN(destLng)) {
          const distance = this._haversineDistance(destLat, destLng, latNum, lngNum);
          if (distance > finalRadius) {
            return {
              success: false,
              message: `คุณอยู่นอกพื้นที่ที่กำหนด (ห่างจากจุดหมาย ${Math.round(distance)} เมตร)`
            };
          }
        }
      }

      const now = new Date();

      // Save signature image if provided
      let signatureUrl = '';
      try {
        if (signatureBase64 && String(signatureBase64).length > 0) {
          const cleaned = String(signatureBase64).replace(/^data:image\/[a-zA-Z]+;base64,/, '');
          const buf = Buffer.from(cleaned, 'base64');
          const safeName = `signature_${String(reference).replace(/[^a-zA-Z0-9_-]/g, '-')}_${String(rowIndex).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
          signatureUrl = await this.imageStorage.saveImage(buf, safeName);
        }
      } catch (imgErr) {
        console.warn('⚠️ Review signature save failed:', imgErr.message);
        signatureUrl = '';
      }

      // Append to review sheet
      const shipmentNo = String(row[headers.indexOf('shipmentNo')] || '').trim();
      const destCode = String(row[headers.indexOf('shipToCode')] || '').trim();
      const destName = String(row[headers.indexOf('shipToName')] || '').trim();

      const reviewRow = [
        reference,
        rowIndex,
        shipmentNo,
        destCode,
        destName,
        score,
        now,
        userId,
        latNum,
        lngNum,
        signatureUrl || ''
      ];

      await this.db.appendRow(SHEETS.REVIEW, [reviewRow]);

      // Update jobdata status
      const rowData = [...row];
      rowData[headers.indexOf('status')] = 'REVIEWED';
      rowData[headers.indexOf('reviewedTime')] = now;
      rowData[headers.indexOf('updatedBy')] = userId;
      rowData[headers.indexOf('updatedAt')] = now;

      const targetRow = rowIndex + 2;
      const range = `A${targetRow}:AZ${targetRow}`;
      await this.db.writeRange(SHEETS.JOBDATA, range, [rowData]);

      return {
        success: true,
        message: 'บันทึกการประเมินสำเร็จ',
        stop: this._rowToObject(headers, rowData)
      };
    } catch (err) {
      console.error('❌ Review upload error:', err);
      return { success: false, message: err.message || 'Review upload failed' };
    }
  }

  /**
   * ADMIN LOG: Write admin actions to ADMIN_LOG sheet
   */
  async logAdminAction(adminUserId, action, detailObj = {}) {
    try {
      await this.db.ensureSheet(SHEETS.ADMIN_LOG, ['timestamp', 'adminUserId', 'action', 'detailJson']);
      const now = new Date().toISOString();
      const row = [now, String(adminUserId || ''), String(action || ''), JSON.stringify(detailObj || {})];
      await this.db.appendRow(SHEETS.ADMIN_LOG, [row]);
      return true;
    } catch (err) {
      console.warn('⚠️ logAdminAction error:', err.message);
      return false;
    }
  }

  /**
   * ADMIN: Check admin privileges
   */
  async adminCheck(userId) {
    const isAdmin = await this.isAdminUser(userId);
    return { success: true, isAdmin };
  }

  /**
   * ADMIN: List jobdata with optional filters
   */
  async adminJobdata(payload) {
    try {
      const { adminUserId, reference = '', status = '', limit = 200 } = payload || {};
      if (!(await this.isAdminUser(adminUserId))) {
        return { success: false, message: 'คุณไม่มีสิทธิ์เข้าใช้งาน (admin)' };
      }

      const jobdata = await this.db.readRange(SHEETS.JOBDATA, 'A:AZ');
      if (!jobdata || jobdata.length < 2) {
        return { success: true, rows: [] };
      }

      const headers = jobdata[0];
      const rows = [];

      for (let i = 1; i < jobdata.length; i++) {
        const row = jobdata[i];
        const obj = this._rowToObject(headers, row);

        const ref = String(obj.referenceNo || obj.reference || '').trim();
        const stat = String(obj.status || '').trim().toUpperCase();

        if (reference && ref.indexOf(reference) === -1) continue;
        if (status && stat !== String(status).toUpperCase()) continue;

        rows.push({
          rowIndex: i + 1,
          referenceNo: ref,
          shipmentNo: String(obj.shipmentNo || ''),
          destination1: String(obj.destination1 || obj.shipToCode || ''),
          destination2: String(obj.destination2 || obj.shipToName || ''),
          status: stat,
          checkInTime: obj.checkInTime || '',
          checkOutTime: obj.checkOutTime || '',
          checkInOdo: obj.checkInOdo || '',
          updatedBy: obj.updatedBy || '',
          updatedAtObj: obj.updatedAt || null,
          updatedAt: obj.updatedAt || ''
        });
      }

      rows.sort((a, b) => {
        const da = a.updatedAtObj ? new Date(a.updatedAtObj).getTime() : 0;
        const db = b.updatedAtObj ? new Date(b.updatedAtObj).getTime() : 0;
        return db - da;
      });

      const limited = rows.slice(0, Number(limit) || 200).map(r => {
        delete r.updatedAtObj;
        return r;
      });

      await this.logAdminAction(adminUserId, 'READ_JOBDATA', { reference, status, count: limited.length });
      return { success: true, rows: limited };
    } catch (err) {
      console.error('❌ adminJobdata error:', err);
      return { success: false, message: 'SERVER_ERROR: ' + (err.message || err) };
    }
  }

  /**
   * ADMIN: List alcohol checks
   */
  async adminAlcohol(payload) {
    try {
      const { adminUserId, reference = '', driver = '', limit = 200 } = payload || {};
      if (!(await this.isAdminUser(adminUserId))) {
        return { success: false, message: 'คุณไม่มีสิทธิ์เข้าใช้งาน (admin)' };
      }

      const data = await this.db.readRange(SHEETS.ALCOHOL, 'A:H');
      if (!data || data.length < 2) {
        return { success: true, rows: [] };
      }

      const rows = [];
      for (let i = 1; i < data.length; i++) {
        const r = data[i];
        const ref = String(r[0] || '').trim();
        const driverName = String(r[1] || '').trim();
        const alcoholVal = r[2];
        const checkedAt = r[3];
        const userId = String(r[4] || '').trim();
        const lat = r[5];
        const lng = r[6];
        const imageUrl = String(r[7] || '').trim();

        if (reference && ref.indexOf(reference) === -1) continue;
        if (driver && driverName.toLowerCase().indexOf(String(driver).toLowerCase()) === -1) continue;

        rows.push({
          rowIndex: i + 1,
          reference: ref,
          driverName,
          alcoholValue: alcoholVal,
          checkedAtObj: checkedAt,
          checkedAt: checkedAt ? new Date(checkedAt).toISOString() : '',
          userId,
          lat,
          lng,
          imageUrl
        });
      }

      rows.sort((a, b) => {
        const da = a.checkedAtObj ? new Date(a.checkedAtObj).getTime() : 0;
        const db = b.checkedAtObj ? new Date(b.checkedAtObj).getTime() : 0;
        return db - da;
      });

      const limited = rows.slice(0, Number(limit) || 200).map(r => {
        delete r.checkedAtObj;
        return r;
      });

      await this.logAdminAction(adminUserId, 'READ_ALCOHOL', { reference, driver, count: limited.length });
      return { success: true, rows: limited };
    } catch (err) {
      console.error('❌ adminAlcohol error:', err);
      return { success: false, message: 'SERVER_ERROR: ' + (err.message || err) };
    }
  }

  /**
   * ADMIN: List user profiles
   */
  async adminUserprofile(payload) {
    try {
      const { adminUserId, status = '', keyword = '' } = payload || {};
      if (!(await this.isAdminUser(adminUserId))) {
        return { success: false, message: 'คุณไม่มีสิทธิ์เข้าใช้งาน (admin)' };
      }

      const data = await this.db.readRange(SHEETS.USER_PROFILE, 'A:J');
      if (!data || data.length < 2) {
        return { success: true, rows: [] };
      }

      const rows = [];
      for (let i = 1; i < data.length; i++) {
        const r = data[i];
        const userId = String(r[0] || '').trim();
        const displayName = String(r[1] || '').trim();
        const pictureUrl = String(r[2] || '').trim();
        const stat = String(r[3] || '').trim().toUpperCase();
        const createdAt = r[4];
        const updatedAt = r[5];
        const userType = String(r[9] || '').trim().toUpperCase();

        if (status && stat !== String(status).toUpperCase()) continue;

        if (keyword) {
          const combined = (userId + ' ' + displayName).toLowerCase();
          if (combined.indexOf(String(keyword).toLowerCase()) === -1) continue;
        }

        rows.push({
          userId,
          displayName,
          pictureUrl,
          status: stat,
          userType,
          createdAtObj: createdAt,
          updatedAtObj: updatedAt,
          createdAt: createdAt ? new Date(createdAt).toISOString() : '',
          updatedAt: updatedAt ? new Date(updatedAt).toISOString() : ''
        });
      }

      rows.sort((a, b) => {
        const da = a.createdAtObj ? new Date(a.createdAtObj).getTime() : 0;
        const db = b.createdAtObj ? new Date(b.createdAtObj).getTime() : 0;
        return db - da;
      });

      const cleaned = rows.map(r => {
        delete r.createdAtObj;
        delete r.updatedAtObj;
        return r;
      });

      await this.logAdminAction(adminUserId, 'READ_USERPROFILE', { status, keyword, count: cleaned.length });
      return { success: true, rows: cleaned };
    } catch (err) {
      console.error('❌ adminUserprofile error:', err);
      return { success: false, message: 'SERVER_ERROR: ' + (err.message || err) };
    }
  }

  /**
   * ADMIN: Update jobdata status
   */
  async adminUpdateJob(payload) {
    try {
      const { adminUserId, rowIndex, status } = payload || {};
      if (!(await this.isAdminUser(adminUserId))) {
        return { success: false, message: 'คุณไม่มีสิทธิ์เข้าใช้งาน (admin)' };
      }
      const idx = parseInt(rowIndex, 10);
      const newStatus = String(status || '').trim();
      if (!idx || !newStatus) {
        return { success: false, message: 'ข้อมูลไม่ครบ (rowIndex/status)' };
      }

      const jobdata = await this.db.readRange(SHEETS.JOBDATA, 'A:AZ');
      if (!jobdata || jobdata.length < 2) {
        return { success: false, message: 'ไม่พบชีท jobdata ในไฟล์หลัก' };
      }
      const headers = jobdata[0];
      if (idx < 2 || idx > jobdata.length) {
        return { success: false, message: 'rowIndex ไม่ถูกต้อง' };
      }
      const now = new Date();
      const row = jobdata[idx - 1];
      const rowData = [...row];

      const statusIdx = headers.indexOf('status');
      const updatedAtIdx = headers.indexOf('updatedAt');
      const updatedByIdx = headers.indexOf('updatedBy');

      if (statusIdx !== -1) rowData[statusIdx] = newStatus;
      if (updatedAtIdx !== -1) rowData[updatedAtIdx] = now;
      if (updatedByIdx !== -1) rowData[updatedByIdx] = adminUserId;

      const range = `A${idx}:AZ${idx}`;
      await this.db.writeRange(SHEETS.JOBDATA, range, [rowData]);

      await this.logAdminAction(adminUserId, 'UPDATE_JOBDATA', { rowIndex: idx, newStatus });

      return {
        success: true,
        row: {
          rowIndex: idx,
          referenceNo: String(row[headers.indexOf('referenceNo')] || '').trim(),
          shipmentNo: String(row[headers.indexOf('shipmentNo')] || '').trim(),
          status: newStatus,
          updatedAt: now.toISOString(),
          updatedBy: String(adminUserId || '')
        }
      };
    } catch (err) {
      console.error('❌ adminUpdateJob error:', err);
      return { success: false, message: 'SERVER_ERROR: ' + (err.message || err) };
    }
  }

  /**
   * ADMIN: Update alcohol value
   */
  async adminUpdateAlcohol(payload) {
    try {
      const { adminUserId, rowIndex, alcoholValue } = payload || {};
      if (!(await this.isAdminUser(adminUserId))) {
        return { success: false, message: 'คุณไม่มีสิทธิ์เข้าใช้งาน (admin)' };
      }
      const idx = parseInt(rowIndex, 10);
      const valueNum = parseFloat(alcoholValue);
      if (!idx || isNaN(valueNum)) {
        return { success: false, message: 'ข้อมูลไม่ครบหรือค่าแอลกอฮอล์ไม่ถูกต้อง' };
      }

      const data = await this.db.readRange(SHEETS.ALCOHOL, 'A:H');
      if (!data || data.length < 2) {
        return { success: false, message: 'ไม่พบชีท alcoholcheck ในไฟล์หลัก' };
      }
      if (idx < 2 || idx > data.length) {
        return { success: false, message: 'rowIndex ไม่ถูกต้อง' };
      }
      const now = new Date();
      const row = data[idx - 1];
      const rowData = [...row];

      rowData[2] = valueNum; // C: alcoholValue
      rowData[3] = now;      // D: checkedAt

      const range = `A${idx}:H${idx}`;
      await this.db.writeRange(SHEETS.ALCOHOL, range, [rowData]);

      await this.logAdminAction(adminUserId, 'UPDATE_ALCOHOL', { rowIndex: idx, alcoholValue: valueNum });

      return {
        success: true,
        row: {
          rowIndex: idx,
          reference: String(row[0] || '').trim(),
          driverName: String(row[1] || '').trim(),
          alcoholValue: valueNum,
          checkedAt: now.toISOString()
        }
      };
    } catch (err) {
      console.error('❌ adminUpdateAlcohol error:', err);
      return { success: false, message: 'SERVER_ERROR: ' + (err.message || err) };
    }
  }

  /**
   * ADMIN: Update user status (and signal to link rich menu)
   */
  async adminUpdateUserStatus(payload) {
    try {
      const { adminUserId, userId, status } = payload || {};
      if (!(await this.isAdminUser(adminUserId))) {
        return { success: false, message: 'คุณไม่มีสิทธิ์เข้าใช้งาน (admin)' };
      }
      const uid = String(userId || '').trim();
      const newStatus = String(status || '').trim().toUpperCase();
      if (!uid || !newStatus) {
        return { success: false, message: 'ข้อมูลไม่ครบ (userId/status)' };
      }

      const data = await this.db.readRange(SHEETS.USER_PROFILE, 'A:J');
      if (!data || data.length < 2) {
        return { success: false, message: 'ยังไม่มีข้อมูล userprofile' };
      }

      let targetRow = -1;
      for (let i = 1; i < data.length; i++) {
        const id = String(data[i][0] || '').trim();
        if (id === uid) { targetRow = i + 1; break; }
      }
      if (targetRow === -1) {
        return { success: false, message: 'ไม่พบ userId นี้ใน userprofile' };
      }

      const now = new Date();
      const row = data[targetRow - 1];
      const rowData = [...row];

      rowData[3] = newStatus; // D: status
      rowData[5] = now;       // F: updatedAt

      const range = `A${targetRow}:J${targetRow}`;
      await this.db.writeRange(SHEETS.USER_PROFILE, range, [rowData]);

      await this.logAdminAction(adminUserId, 'UPDATE_USER_STATUS', { targetUserId: uid, newStatus });

      return {
        success: true,
        linkRichMenu: newStatus === 'APPROVED',
        userId: uid
      };
    } catch (err) {
      console.error('❌ adminUpdateUserStatus error:', err);
      return { success: false, message: 'SERVER_ERROR: ' + (err.message || err) };
    }
  }

  _getColumnLetter(index) {
    let letter = '';
    let temp = index;
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  }
}

module.exports = { SheetActions };
