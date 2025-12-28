/**
 * Sheet Actions Module
 * Business logic for all API endpoints using Google Sheets
 */

const { v4: uuidv4 } = require('uuid');
const { ImageStorage } = require('./image-storage');

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
      // Read Jobs sheet
      const jobs = await this.db.readRange('Jobs', 'A:Z');
      if (!jobs || jobs.length === 0) {
        return { success: false, message: 'No jobs found' };
      }

      // Parse headers
      const headers = jobs[0];
      const referenceIdx = headers.indexOf('Reference');
      
      if (referenceIdx === -1) {
        return { success: false, message: 'Invalid sheet structure' };
      }

      // Find matching job
      const jobRow = jobs.find(row => 
        row[referenceIdx] && 
        String(row[referenceIdx]).toUpperCase() === String(keyword).toUpperCase()
      );

      if (!jobRow) {
        return { success: false, message: 'Job not found' };
      }

      // Convert row to object
      const job = this._rowToObject(headers, jobRow);

      // Read stops for this job
      const stopsData = await this._getStopsForReference(job.Reference);

      return {
        success: true,
        data: {
          job,
          stops: stopsData || []
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
      if (!rowIndex || !status || !type) {
        return { success: false, message: 'Missing required fields' };
      }

      // Read Stops sheet
      const stops = await this.db.readRange('Stops', 'A:Z');
      if (!stops || stops.length === 0) {
        return { success: false, message: 'Stops sheet not found' };
      }

      const headers = stops[0];
      const targetRow = rowIndex + 1; // Account for header

      // Determine column to update based on type
      let colName = '';
      if (type === 'checkin') {
        colName = 'CheckInTime';
      } else if (type === 'checkout') {
        colName = 'CheckOutTime';
      }

      const colIdx = headers.indexOf(colName);
      if (colIdx === -1) {
        return { success: false, message: `Column ${colName} not found` };
      }

      // Update the cell
      const timeStr = new Date().toLocaleTimeString('th-TH');
      const updateRange = `Stops!${String.fromCharCode(65 + colIdx)}${targetRow}`;
      
      await this.db.writeRange('Stops', updateRange, [[timeStr]]);

      // Store odometer if check-in
      if (type === 'checkin' && odo) {
        const odoColIdx = headers.indexOf('CheckInOdo');
        if (odoColIdx !== -1) {
          const odoRange = `Stops!${String.fromCharCode(65 + odoColIdx)}${targetRow}`;
          await this.db.writeRange('Stops', odoRange, [[String(odo)]]);
        }
      }

      // Get updated stop
      const updatedStop = await this._getStopByIndex(rowIndex);

      return {
        success: true,
        message: `Stop ${colName} updated successfully`,
        data: { stop: updatedStop }
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
      const { driverName, result, timestamp, userId, reference, imageBuffer } = payload;

      if (!driverName || !result) {
        return { success: false, message: 'Missing driver name or result' };
      }

      // Save image if provided
      let imageUrl = null;
      if (imageBuffer) {
        imageUrl = await this.imageStorage.saveImage(
          imageBuffer,
          `alcohol_${driverName}_${Date.now()}`
        );
      }

      // Append to Alcohol sheet
      const row = [
        timestamp || new Date().toISOString(),
        userId || '',
        reference || '',
        driverName,
        result,
        imageUrl || ''
      ];

      await this.db.appendRange('Alcohol', [row]);

      return {
        success: true,
        message: 'Alcohol check saved',
        data: { checkedDrivers: [driverName] }
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

      if (!userId || !reference) {
        return { success: false, message: 'Missing userId or reference' };
      }

      // Append to Awareness sheet
      const row = [
        timestamp || new Date().toISOString(),
        userId,
        reference,
        acknowledged ? 'YES' : 'NO'
      ];

      await this.db.appendRange('Awareness', [row]);

      return {
        success: true,
        message: 'Awareness saved'
      };
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
      const { rowIndex, shipmentNo, userId, reference, timestamp, imageBuffer } = payload;

      if (!shipmentNo) {
        return { success: false, message: 'Missing shipment number' };
      }

      // Save image if provided
      let imageUrl = null;
      if (imageBuffer) {
        imageUrl = await this.imageStorage.saveImage(
          imageBuffer,
          `pod_${shipmentNo}_${Date.now()}`
        );
      }

      // Append to POD sheet
      const row = [
        timestamp || new Date().toISOString(),
        userId || '',
        reference || '',
        shipmentNo,
        'COMPLETED',
        imageUrl || ''
      ];

      await this.db.appendRange('POD', [row]);

      return {
        success: true,
        message: 'POD saved'
      };
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
      const { type, description, userId, lat, lng, timestamp, imageBuffer } = payload;

      // Save image if provided
      let imageUrl = null;
      if (imageBuffer) {
        imageUrl = await this.imageStorage.saveImage(
          imageBuffer,
          `sos_${type}_${Date.now()}`
        );
      }

      // Append to SOS sheet
      const row = [
        timestamp || new Date().toISOString(),
        userId || '',
        type || 'UNKNOWN',
        description || '',
        lat || '',
        lng || '',
        imageUrl || 'REPORTED'
      ];

      await this.db.appendRange('SOS', [row]);

      return {
        success: true,
        message: 'Emergency SOS reported'
      };
    } catch (err) {
      console.error('❌ SOS error:', err);
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
      const { reference, userId, endOdo, endPointName, lat, lng, accuracy, timestamp } = payload;

      if (!reference) {
        return { success: false, message: 'Missing reference' };
      }

      // Append to EndTrip sheet
      const row = [
        timestamp || new Date().toISOString(),
        userId || '',
        reference,
        endOdo || '',
        endPointName || '',
        lat || '',
        lng || '',
        accuracy || ''
      ];

      await this.db.appendRange('EndTrip', [row]);

      return {
        success: true,
        message: 'Trip ended successfully'
      };
    } catch (err) {
      console.error('❌ End trip error:', err);
      return { 
        success: false, 
        message: err.message || 'End trip failed' 
      };
    }
  }

  /**
   * CLOSE_JOB: Mark job as completed
   */
  async closeJob(reference, userId) {
    try {
      if (!reference) {
        return { success: false, message: 'Missing reference' };
      }

      // Find job row and update status
      const jobs = await this.db.readRange('Jobs', 'A:Z');
      if (!jobs || jobs.length === 0) {
        return { success: false, message: 'No jobs found' };
      }

      const headers = jobs[0];
      const refIdx = headers.indexOf('Reference');
      const statusIdx = headers.indexOf('JobStatus');

      if (refIdx === -1) {
        return { success: false, message: 'Invalid sheet structure' };
      }

      const jobRowIdx = jobs.findIndex(row => 
        row[refIdx] && 
        String(row[refIdx]).toUpperCase() === String(reference).toUpperCase()
      );

      if (jobRowIdx === -1) {
        return { success: false, message: 'Job not found' };
      }

      // Update status
      if (statusIdx !== -1) {
        const updateRange = `Jobs!${String.fromCharCode(65 + statusIdx)}${jobRowIdx + 1}`;
        await this.db.writeRange('Jobs', updateRange, [['CLOSED']]);
      }

      return {
        success: true,
        message: 'Job closed successfully'
      };
    } catch (err) {
      console.error('❌ Close job error:', err);
      return { 
        success: false, 
        message: err.message || 'Close job failed' 
      };
    }
  }

  /**
   * FILL_MISSING: Fill missing steps data
   */
  async fillMissing(payload) {
    try {
      const { reference, userId, missingData, lat, lng } = payload;

      if (!reference || !missingData) {
        return { success: false, message: 'Missing required data' };
      }

      // Append to MissingSteps sheet for audit trail
      const row = [
        new Date().toISOString(),
        userId || '',
        reference,
        JSON.stringify(missingData),
        lat || '',
        lng || ''
      ];

      await this.db.appendRange('MissingSteps', [row]);

      return {
        success: true,
        message: 'Missing data saved'
      };
    } catch (err) {
      console.error('❌ Fill missing error:', err);
      return { 
        success: false, 
        message: err.message || 'Fill missing failed' 
      };
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Convert sheet row to object using headers
   */
  _rowToObject(headers, row) {
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = row[idx] || '';
    });
    return obj;
  }

  /**
   * Get stops for a specific reference
   */
  async _getStopsForReference(reference) {
    try {
      const stops = await this.db.readRange('Stops', 'A:Z');
      if (!stops || stops.length === 0) return [];

      const headers = stops[0];
      const refIdx = headers.indexOf('Reference');
      if (refIdx === -1) return [];

      return stops
        .slice(1)
        .filter(row => row[refIdx] === reference)
        .map((row, idx) => {
          const obj = this._rowToObject(headers, row);
          obj.rowIndex = idx;
          return obj;
        });
    } catch (err) {
      console.error('Error getting stops:', err);
      return [];
    }
  }

  /**
   * Get stop by row index
   */
  async _getStopByIndex(rowIndex) {
    try {
      const stops = await this.db.readRange('Stops', 'A:Z');
      if (!stops || stops.length <= rowIndex + 1) return null;

      const headers = stops[0];
      const row = stops[rowIndex + 1];

      return this._rowToObject(headers, row);
    } catch (err) {
      console.error('Error getting stop:', err);
      return null;
    }
  }
}

module.exports = { SheetActions };
