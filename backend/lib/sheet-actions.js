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
   */
  async search(keyword, userId) {
    try {
      // Step 1: Try to find reference in Zoile30Connect sheets
      let zoileReference = null;
      if (this.zoileDb) {
        try {
          // Search in InputZoile30 first (column 31 = Reference, 0-based index = 30)
          const inputZoile = await this.zoileDb.readRange(SHEETS.ZOILE_INPUT, 'A:AZ');
          if (inputZoile && inputZoile.length > 1) {
            const refColIdx = 30; // 0-based index for column 31 (Reference)
            for (let i = 1; i < inputZoile.length; i++) {
              if (inputZoile[i][refColIdx] && 
                  String(inputZoile[i][refColIdx]).toUpperCase() === String(keyword).toUpperCase()) {
                zoileReference = String(inputZoile[i][refColIdx]);
                console.log('✅ Found in InputZoile30:', zoileReference);
                break;
              }
            }
          }

          // If not found in InputZoile30, search in data sheet (column 13 = Reference, 0-based index = 12)
          if (!zoileReference) {
            const zoileData = await this.zoileDb.readRange(SHEETS.ZOILE_DATA, 'A:AZ');
            if (zoileData && zoileData.length > 1) {
              const refColIdx = 12; // 0-based index for column M (Reference)
              for (let i = 1; i < zoileData.length; i++) {
                if (zoileData[i][refColIdx] && 
                    String(zoileData[i][refColIdx]).toUpperCase() === String(keyword).toUpperCase()) {
                  zoileReference = String(zoileData[i][refColIdx]);
                  console.log('✅ Found in data sheet:', zoileReference);
                  break;
                }
              }
            }
          }
        } catch (zoileErr) {
          console.warn('⚠️ Could not search zoile sheets:', zoileErr.message);
        }
      }

      // Step 2: If not found in zoile, search in jobdata
      const searchRef = zoileReference || keyword;

      // Step 3: Read jobdata sheet (contains all stops)
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
            String(jobdata[i][referenceIdx]).toUpperCase() === String(searchRef).toUpperCase()) {
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
          tripEnded: !!firstStop.tripEndedAt,
          foundInZoile: !!zoileReference
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
