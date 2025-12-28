/**
 * Sheet Actions Module - Adapted for Google Apps Script structure
 * Business logic for all API endpoints using Google Sheets
 */

const { v4: uuidv4 } = require('uuid');
const { ImageStorage } = require('./image-storage');
const SHEETS = require('./sheet-names');

class SheetActions {
  constructor(db) {
    this.db = db;
    this.imageStorage = new ImageStorage(process.env.DATA_DIR || './data');
  }

  /**
   * SEARCH: Find a job by reference number
   */
  async search(keyword, userId) {
    try {
      // Read jobdata sheet (contains all stops)
      const jobdata = await this.db.readRange(SHEETS.JOBDATA, 'A:AZ');
      if (!jobdata || jobdata.length === 0) {
        return { success: false, message: 'No jobs found' };
      }

      // Parse headers
      const headers = jobdata[0];
      const referenceIdx = headers.indexOf('referenceNo');
      
      if (referenceIdx === -1) {
        return { success: false, message: 'Invalid sheet structure - missing referenceNo column' };
      }

      // Find all matching stops for this reference
      const matchingStops = [];
      for (let i = 1; i < jobdata.length; i++) {
        if (jobdata[i][referenceIdx] && 
            String(jobdata[i][referenceIdx]).toUpperCase() === String(keyword).toUpperCase()) {
          matchingStops.push(this._rowToObject(headers, jobdata[i]));
        }
      }

      if (matchingStops.length === 0) {
        return { success: false, message: 'Job not found' };
      }

      // Get first stop for main job info
      const firstStop = matchingStops[0];

      // Read alcohol data for this reference
      const alcoholData = await this._getAlcoholForReference(firstStop.referenceNo);

      return {
        success: true,
        data: {
          referenceNo: firstStop.referenceNo,
          shipmentNo: firstStop.shipmentNo || '',
          destination: firstStop.shipToName || '',
          totalStops: matchingStops.length,
          stops: matchingStops,
          alcohol: alcoholData || { drivers: [], checkedDrivers: [] },
          jobClosed: !!firstStop.jobClosedAt,
          tripEnded: !!firstStop.tripEndedAt
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
   * UPDATE_STOP: Update stop status (check-in, check-out, etc.)
   */
  async updateStop(payload) {
    try {
      const { rowIndex, status, type, userId, lat, lng, odo, accuracy } = payload;

      // Validate
      if (rowIndex === undefined || !status || !type) {
        return { success: false, message: 'Missing required fields' };
      }

      // Read jobdata sheet
      const jobdata = await this.db.readRange(SHEETS.JOBDATA, 'A:AZ');
      if (!jobdata || jobdata.length === 0) {
        return { success: false, message: 'Jobdata sheet not found' };
      }

      const headers = jobdata[0];
      const targetRow = rowIndex + 2; // +1 for header, +1 for 1-based

      // Determine column to update based on type
      let colName = '';
      if (type === 'checkin') {
        colName = 'checkInTime';
      } else if (type === 'checkout') {
        colName = 'checkOutTime';
      } else if (type === 'fuel') {
        colName = 'fuelingTime';
      } else if (type === 'unload') {
        colName = 'unloadDoneTime';
      } else if (type === 'review') {
        colName = 'reviewedTime';
      }

      const colIdx = headers.indexOf(colName);
      if (colIdx === -1) {
        return { success: false, message: `Column ${colName} not found` };
      }

      // Update the cell
      const timeStr = new Date().toLocaleTimeString('th-TH');
      const colLetter = this._getColumnLetter(colIdx);
      const updateRange = `${colLetter}${targetRow}`;
      
      await this.db.writeRange(SHEETS.JOBDATA, updateRange, [[timeStr]]);

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
   * Convert row array to object using headers
   */
  _rowToObject(headers, row) {
    const obj = {};
    headers.forEach((header, idx) => {
      if (header) {
        obj[header] = row[idx] || '';
      }
    });
    
    // Add mapped fields for frontend compatibility
    // destination1 = shipToCode or Station code
    // destination2 = shipToName or Station name
    if (!obj.destination1 && obj.shipToCode) {
      obj.destination1 = obj.shipToCode;
    }
    if (!obj.destination2 && obj.shipToName) {
      obj.destination2 = obj.shipToName;
    }
    
    // Also map common variations
    if (!obj.destination1 && obj.stationCode) {
      obj.destination1 = obj.stationCode;
    }
    if (!obj.destination2 && obj.stationName) {
      obj.destination2 = obj.stationName;
    }
    
    return obj;
  }

  /**
   * Convert column index to letter (0 = A, 1 = B, etc.)
   */
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
