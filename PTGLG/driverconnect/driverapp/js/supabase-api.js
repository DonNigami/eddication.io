/**
 * Driver Tracking App - Supabase API Functions
 *
 * Schema aligned with app/PLAN.md:
 * - trips (formerly driver_jobs)
 * - trip_stops (formerly driver_stops)
 * - alcohol_checks (formerly driver_alcohol_checks)
 * - driver_logs (audit trail)
 * - Storage: alcohol-evidence bucket
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { decodeBase64 } from './utils.js';
import { DriverAuth } from '../../shared/driver-auth.js';
import { enrichStopsWithCoordinates, getOriginConfig, haversineDistanceMeters } from './location-service.js';

// Table names (aligned with app/PLAN.md migration status - PENDING)
const TABLES = {
  TRIPS: 'driver_jobs',
  TRIP_STOPS: 'driver_stops',
  ALCOHOL_CHECKS: 'driver_alcohol_checks',
  DRIVER_LOGS: 'driver_logs',
  JOBDATA: 'jobdata',
  USER_PROFILES: 'user_profiles',
  PROCESS_DATA: 'process_data'
};

// Storage bucket name (migration PENDING)
const STORAGE_BUCKET = 'alcohol-evidence';

// Initialize Supabase client
let supabase = null;
let realtimeSubscription = null;

/**
 * Initialize Supabase client
 */
export function initSupabase() {
  if (window.supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase client initialized');
  } else {
    console.error('❌ Supabase SDK not loaded');
  }
  return supabase;
}

/**
 * Get Supabase client
 */
export function getSupabase() {
  return supabase;
}

/**
 * Sync trips data to jobdata table
 */
async function syncToJobdata(trips, stops, reference) {
  try {
    // Filter out "คลังศรีราชา" stops before syncing
    const filteredStops = stops.filter(stop => stop.shipToName && !stop.shipToName.includes('คลังศรีราชา'));
    console.log(`🔄 Syncing stops to jobdata... Total: ${stops.length}, After filtering 'คลังศรีราชา': ${filteredStops.length}`);

    // Delete existing jobdata rows for this reference
    await supabase
      .from(TABLES.JOBDATA)
      .delete()
      .eq('reference', reference);

    // The first trip row contains shared info like vehicle, drivers, route
    const sharedTripInfo = trips[0] || {};

    // Create jobdata rows from the processed STOPS array
    const jobdataRows = filteredStops.map(stop => {
      return {
        reference: reference,
        shipment_no: stop.shipmentNo || '',
        ship_to_code: stop.shipToCode || '',
        ship_to_name: stop.shipToName || '',
        status: stop.status || 'PENDING',
        checkin_time: stop.checkInTime || null,
        checkout_time: stop.checkOutTime || null,
        fueling_time: stop.fuelingTime || null,
        unload_done_time: stop.unloadDoneTime || null,
        vehicle_desc: sharedTripInfo.vehicle_desc || '',
        drivers: sharedTripInfo.drivers || '',
        seq: stop.seq,
        route: sharedTripInfo.route || '',
        is_origin_stop: stop.isOriginStop || false,
        materials: stop.materials || '',
        total_qty: stop.totalQty || null,
        dest_lat: stop.destLat || null,
        dest_lng: stop.destLng || null,
        radius_m: stop.radiusM || null,
        distance_km: stop.distanceKm || null,
        job_closed: false,
        trip_ended: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    });

    if (jobdataRows.length > 0) {
      const { error } = await supabase
        .from(TABLES.JOBDATA)
        .insert(jobdataRows);

      if (error) {
        console.error('❌ Error syncing to jobdata:', error);
      } else {
        console.log('✅ Synced', jobdataRows.length, 'rows to jobdata');
      }
    }
  } catch (err) {
    console.error('❌ syncToJobdata error:', err);
    // Don't throw - continue even if sync fails
  }
}

/**
 * Helper: Get success message by type
 */
function getSuccessMessage(type) {
  const messages = {
    checkin: 'Check-in สำเร็จ',
    checkout: 'Check-out สำเร็จ',
    fuel: 'ลงน้ำมันสำเร็จ',
    unload: 'ลงเสร็จสำเร็จ'
  };
  return messages[type] || 'อัปเดตสำเร็จ';
}

/**
 * Supabase API Functions
 */
export const SupabaseAPI = {
  /**
   * Search job by reference
   * Search priority: jobdata first, then driver_jobs
   * Phase 1.5: Verify driver has access to this job before returning details
   */
  async search(reference, userId) {
    console.log('🔍 Supabase: Searching for', reference);

    // Phase 1.5: Verify driver has access to this job (prevent unauthorized access)
    const hasAccess = await DriverAuth.verifyJobAccess(userId, reference);
    if (!hasAccess) {
      console.warn(`⚠️ Unauthorized search attempt by LIFF ID ${userId} on reference ${reference}`);
      return {
        success: false,
        message: DriverAuth.getUnauthorizedMessage(),
        unauthorized: true
      };
    }

    try {
      // ============================================
      // Step 1: Search in jobdata table first
      // ============================================
      console.log('🔍 Step 1: Searching in jobdata table...');

      let jobdataRows = null;
      let jobdataError = null;

      try {
        const result = await supabase
          .from(TABLES.JOBDATA)
          .select('*')
          .eq('reference', reference)
          .order('seq', { ascending: true });

        jobdataRows = result.data;
        jobdataError = result.error;
      } catch (err) {
        console.warn('⚠️ jobdata query exception:', err.message);
        jobdataError = err;
      }

      // If found in jobdata, use it
      if (!jobdataError && jobdataRows && jobdataRows.length > 0) {
        console.log('✅ Found in jobdata:', jobdataRows.length, 'rows');
        
        // Filter out "คลังศรีราชา" stops
        const filteredJobdataRows = jobdataRows.filter(row => row.ship_to_name && !row.ship_to_name.includes('คลังศรีราชา'));

        if (filteredJobdataRows.length === 0) {
            console.log('ℹ️ All stops were filtered out as "คลังศรีราชา". Proceeding to fallback search.');
        } else {
            console.log('✅ Filtered to:', filteredJobdataRows.length, 'rows after excluding "คลังศรีราชา"');
            const firstRow = filteredJobdataRows[0];
            
            // Get alcohol checks from alcohol_checks table
            const { data: alcoholData } = await supabase
              .from(TABLES.ALCOHOL_CHECKS)
              .select('driver_name')
              .eq('reference', reference);

            const checkedDrivers = alcoholData ? [...new Set(alcoholData.map(a => a.driver_name))] : [];
            
            // Convert jobdata rows to stops format
            const stops = filteredJobdataRows.map(row => ({
              rowIndex: String(row.id), // Ensure rowIndex is always a string
              seq: row.seq,
              shipToCode: row.ship_to_code || '',
              shipToName: row.ship_to_name || `จุดส่งที่ ${row.seq}`,
              address: row.ship_to_name || '',
              status: row.status || 'PENDING',
              checkInTime: row.checkin_time,
              checkOutTime: row.checkout_time,
              fuelingTime: row.fueling_time,
              unloadDoneTime: row.unload_done_time,
              isOriginStop: row.is_origin_stop || row.seq === 1,
              destLat: row.dest_lat || null,
              destLng: row.dest_lng || null,
              radiusM: row.radius_m || null,
              distanceKm: row.distance_km || null,
              totalQty: row.total_qty || null,
              materials: row.materials || ''
            }));

            // Enrich stops with coordinates from master location tables
            const enrichedStops = await enrichStopsWithCoordinates(stops, firstRow.route || null);

            const drivers = firstRow.drivers ? firstRow.drivers.split('/').map(d => d.trim()) : [];

            return {
              success: true,
              source: 'jobdata',
              data: {
                referenceNo: reference,
                vehicleDesc: firstRow.vehicle_desc || '',
                shipmentNos: [],
                totalStops: enrichedStops.length,
                stops: enrichedStops,
                alcohol: {
                  drivers: drivers,
                  checkedDrivers: checkedDrivers
                },
                jobClosed: firstRow.job_closed || false,
                tripEnded: firstRow.trip_ended || false
              }
            };
        }
      }

      // Log jobdata result
      if (jobdataError) {
        console.warn('⚠️ jobdata query error:', jobdataError.message);
      } else {
        console.log('ℹ️ No data found in jobdata');
      }

      // ============================================
      // Step 2: Search in trips table (fallback) & build from scratch
      // ============================================
      console.log('🔍 Step 2: Searching in trips table...');

      const { data: jobs, error: jobError } = await supabase
        .from(TABLES.TRIPS)
        .select('*')
        .eq('reference', reference)
        .order('created_at', { ascending: true });

      if (jobError) {
        console.error('❌ trips query error:', jobError);
        const errorMsg = jobError.message || '';
        if (jobError.code === 'PGRST116' || errorMsg.includes('406') || errorMsg.includes('permission') || errorMsg.includes('policy')) {
          return { success: false, message: '⚠️ ไม่พบข้อมูลในระบบ\n\nReference: ' + reference };
        }
        return { success: false, message: 'เกิดข้อผิดพลาด: ' + errorMsg };
      }

      if (!jobs || jobs.length === 0) {
        return { success: false, message: 'ไม่พบข้อมูลงาน Reference: ' + reference };
      }

      console.log('✅ Found in trips:', jobs.length, 'rows');
      const jobHeader = jobs[0];

      // --- Replicate driverjob.js logic: Create synthetic origin + destination stops ---
      
      // 1. Get Origin Config
      const originConfig = await getOriginConfig(jobHeader.route);
      if (!originConfig) {
        return { success: false, message: 'ไม่สามารถหาข้อมูลจุดต้นทาง (origin) ได้' };
      }

      // 2. Create Synthetic Origin Stop
      const originStop = {
        rowIndex: 'origin_0', // Synthetic ID
        seq: 1,
        shipmentNo: jobHeader.shipment_no || '',
        shipToCode: originConfig.originKey,
        shipToName: originConfig.name,
        address: originConfig.name,
        status: 'PENDING',
        isOriginStop: true,
        destLat: parseFloat(originConfig.lat) || null,
        destLng: parseFloat(originConfig.lng) || null,
        radiusM: parseFloat(originConfig.radiusMeters) || 200,
        checkInTime: null, checkOutTime: null, fuelingTime: null, unloadDoneTime: null,
        totalQty: null, materials: 'จุดต้นทาง'
      };

      // 3. Get Destination Stops from driver_stops or driver_jobs
      const { data: stopsData } = await supabase
        .from(TABLES.TRIP_STOPS)
        .select('*')
        .eq('reference', reference)
        .order('sequence', { ascending: true });

      let destinationStops = [];
      if (stopsData && stopsData.length > 0) {
        // Data exists in driver_stops, use it
        destinationStops = stopsData.map(row => ({
          rowIndex: String(row.id), // Ensure rowIndex is a string
          seq: row.sequence || row.stop_number,
          shipmentNo: jobHeader.shipment_no || '', // Inherit shipment_no from header
          shipToCode: row.ship_to_code || (row.sequence || row.stop_number).toString(),
          shipToName: row.destination_name || row.stop_name,
          address: row.address,
          status: row.status || 'pending',
          isOriginStop: false, // Force false, as we have a synthetic origin
          destLat: parseFloat(row.lat) || null,
          destLng: parseFloat(row.lng) || null,
          checkInTime: row.checkin_time, checkOutTime: row.checkout_time, fuelingTime: row.fuel_time, unloadDoneTime: row.unload_time,
        }));
      } else {
        // No data in driver_stops, create from driver_jobs rows
        destinationStops = jobs.map((jobRow) => ({
          rowIndex: String(jobRow.id), // Ensure rowIndex is a string
          seq: 0, // Will be re-sequenced later
          shipmentNo: jobRow.shipment_no || '', // Each row is a shipment
          shipToCode: jobRow.ship_to || '',
          shipToName: jobRow.ship_to_name,
          address: jobRow.ship_to_address || '',
          status: 'pending',
          isOriginStop: false,
          destLat: null, destLng: null,
          checkInTime: null, checkOutTime: null, fuelingTime: null, unloadDoneTime: null,
          totalQty: jobRow.delivery_qty || null,
          materials: jobRow.material_desc || '',
          distanceKm: jobRow.distance || null
        }));
      }

      // Filter out "คลังศรีราชา" from destination stops
      const filteredDestinationStops = destinationStops.filter(stop => stop.shipToName && !stop.shipToName.includes('คลังศรีราชา'));

      // 4. Combine and re-sequence
      let finalStops = [originStop, ...filteredDestinationStops];
      finalStops.forEach((s, i) => { s.seq = i + 1; });
      
      // 5. Enrich coordinates for destination stops
      const enrichedStops = await enrichStopsWithCoordinates(finalStops, jobHeader.route);

      // 6. Get other data
      const { data: alcoholData } = await supabase.from(TABLES.ALCOHOL_CHECKS).select('driver_name').eq('reference', reference);
      const checkedDrivers = alcoholData ? [...new Set(alcoholData.map(a => a.driver_name))] : [];
      const drivers = jobHeader.drivers ? jobHeader.drivers.split('/').map(d => d.trim()) : [];

      // 7. Sync to jobdata
      console.log('🔄 Step 3: Syncing from trips to jobdata...');
      await syncToJobdata(jobs, enrichedStops, reference);

      return {
        success: true,
        source: 'trips',
        data: {
          referenceNo: reference,
          vehicleDesc: jobHeader.vehicle_desc || '',
          shipmentNos: [],
          totalStops: enrichedStops.length,
          stops: enrichedStops,
          alcohol: {
            drivers: drivers,
            checkedDrivers: checkedDrivers
          },
          jobClosed: jobHeader.status === 'closed',
          tripEnded: jobHeader.status === 'completed'
        }
      };
    } catch (err) {
      console.error('❌ Supabase search error:', err);
      return { success: false, message: 'เกิดข้อผิดพลาดในการค้นหา: ' + err.message };
    }
  },

  /**
   * Update stop status
   * Requires DriverAuth verification before allowing updates
   */
  async updateStop({ reference, seq, shipToCode, status, type, userId, lat, lng, odo, receiverName, receiverType, hasPumping, hasTransfer }) {
    console.log('🔄 Supabase: Updating stop status for ref', reference, 'type', type);

    // Phase 1.5: Verify driver has access to this job before updating
    // userId in LIFF auth IS the liffId
    const hasAccess = await DriverAuth.verifyCheckInAccess(userId, reference, shipToCode);
    if (!hasAccess) {
      console.warn(`⚠️ Unauthorized update attempt by LIFF ID ${userId} on reference ${reference}`);
      return {
        success: false,
        message: DriverAuth.getUnauthorizedMessage(),
        unauthorized: true
      };
    }

    try {
      const now = new Date().toISOString();
      const jobdataUpdate = {
        status: status,
        updated_at: now,
        updated_by: userId,
        processdata_time: now
      };

      if (type === 'checkin') {
        jobdataUpdate.checkin_time = now;
        jobdataUpdate.checkin_lat = lat;
        jobdataUpdate.checkin_lng = lng;
        if (odo) jobdataUpdate.checkin_odo = parseInt(odo);
        if (receiverName) jobdataUpdate.receiver_name = receiverName;
        if (receiverType) jobdataUpdate.receiver_type = receiverType;
      } else if (type === 'checkout') {
        jobdataUpdate.checkout_time = now;
        jobdataUpdate.checkout_lat = lat;
        jobdataUpdate.checkout_lng = lng;
        if (hasPumping) jobdataUpdate.has_pumping = hasPumping === 'yes';
        if (hasTransfer) jobdataUpdate.has_transfer = hasTransfer === 'yes';
      } else if (type === 'fuel') {
        jobdataUpdate.fueling_time = now;
      } else if (type === 'unload') {
        jobdataUpdate.unload_done_time = now;
      }

      // Update jobdata table - by ship_to_code if available, otherwise by seq
      const query = supabase
        .from(TABLES.JOBDATA)
        .update(jobdataUpdate)
        .eq('reference', reference);

      if (shipToCode) {
        console.log(`...targeting ship_to_code: ${shipToCode}`);
        query.eq('ship_to_code', shipToCode);
      } else {
        console.log(`...targeting seq: ${seq}`);
        query.eq('seq', seq);
      }
      
      const { data, error } = await query.select();

      if (error) {
        // No rows found is not a critical error here, just means no match.
        if (error.code === 'PGRST116') {
          console.warn('⚠️ updateStop: 0 rows updated in jobdata.');
        } else {
          throw error;
        }
      } else {
        console.log(`✅ Updated ${data.length} rows in jobdata.`);
      }

      // Log the action to driver_logs (log once per action, not per row updated)
      try {
        await supabase
          .from(TABLES.DRIVER_LOGS)
          .insert({
            reference: reference,
            action: type,
            details: { ...jobdataUpdate, shipToCode: shipToCode || null, seq: seq },
            location: { lat, lng },
            user_id: userId
          });
      } catch (logError) {
        console.warn('⚠️ Could not write to driver_logs:', logError.message);
      }
      
      // Return the first updated row for UI feedback if available
      const firstUpdatedStop = Array.isArray(data) && data.length > 0 ? data[0] : null;

      return {
        success: true,
        message: getSuccessMessage(type),
        stop: firstUpdatedStop ? {
          rowIndex: firstUpdatedStop.id,
          seq: firstUpdatedStop.seq,
          status: firstUpdatedStop.status,
          checkInTime: firstUpdatedStop.checkin_time,
          checkOutTime: firstUpdatedStop.checkout_time,
          fuelingTime: firstUpdatedStop.fueling_time,
          unloadDoneTime: firstUpdatedStop.unload_done_time,
        } : null
      };
    } catch (err) {
      console.error('❌ Supabase updateStop error:', err);
      return { success: false, message: 'อัปเดตสถานะไม่สำเร็จ: ' + err.message };
    }
  },

  /**
   * Upload alcohol check
   * Schema aligned with app/PLAN.md: alcohol_checks table
   * Requires DriverAuth verification before allowing uploads
   */
  async uploadAlcohol({ reference, driverName, userId, alcoholValue, imageBase64, lat, lng }) {
    console.log('🍺 Supabase: Uploading alcohol check for', driverName);

    // Phase 1.5: Verify driver has access to this job before uploading alcohol test
    const hasAccess = await DriverAuth.verifyAlcoholTestAccess(userId, reference);
    if (!hasAccess) {
      console.warn(`⚠️ Unauthorized alcohol upload attempt by LIFF ID ${userId} on reference ${reference}`);
      return {
        success: false,
        message: DriverAuth.getUnauthorizedMessage(),
        unauthorized: true
      };
    }

    try {
      // Get trip_id first. A reference can have multiple rows, but they belong to the same trip.
      const { data: trips } = await supabase
        .from(TABLES.TRIPS)
        .select('id')
        .eq('reference', reference);

      if (!trips || trips.length === 0) throw new Error('ไม่พบงาน');
      const tripId = trips[0].id; // Use the ID from the first row

      // Upload image to Storage (alcohol-evidence bucket per PLAN.md)
      let imageUrl = null;
      if (imageBase64) {
        const fileName = `${reference}_${driverName}_${Date.now()}.jpg`;
        const base64Data = imageBase64.split(',')[1] || imageBase64;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(fileName, decodeBase64(base64Data), {
            contentType: 'image/jpeg'
          });

        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(fileName);
          imageUrl = urlData.publicUrl;
        }
      }

      // Insert alcohol check record (schema per PLAN.md)
      const { data, error } = await supabase
        .from(TABLES.ALCOHOL_CHECKS)
        .insert({
          job_id: tripId, // Corrected from trip_id to job_id
          reference: reference,
          driver_name: driverName,
          checked_by: userId,
          alcohol_value: parseFloat(alcoholValue),
          image_url: imageUrl,
          location: { lat, lng },
          checked_at: new Date().toISOString()
        })
        .select();

      if (error) throw error;

      // Log action
      await supabase
        .from(TABLES.DRIVER_LOGS)
        .insert({
          job_id: tripId,
          reference: reference,
          action: 'alcohol',
          details: { driverName, alcoholValue, imageUrl },
          location: { lat, lng },
          user_id: userId
        });

      // Get updated checked drivers
      const { data: allChecks } = await supabase
        .from(TABLES.ALCOHOL_CHECKS)
        .select('driver_name')
        .eq('reference', reference);

      const checkedDrivers = allChecks ? [...new Set(allChecks.map(a => a.driver_name))] : [driverName];

      return {
        success: true,
        checkedDrivers: checkedDrivers
      };
    } catch (err) {
      console.error('❌ Supabase uploadAlcohol error:', err);
      return { success: false, message: 'บันทึกการตรวจแอลกอฮอล์ไม่สำเร็จ: ' + err.message };
    }
  },

  async uploadProcessData(payload) {
    console.log('📝 Supabase: Uploading process data', payload);
    try {
      const { error } = await supabase
        .from(TABLES.PROCESS_DATA)
        .insert({
          reference: payload.reference,
          row_index: payload.rowIndex,
          ship_to_code: payload.shipToCode,
          ship_to_name: payload.shipToName,
          receiver_name: payload.receiverName,
          receiver_type: payload.receiverType,
          odo_value: payload.odo,
          user_id: payload.userId,
          lat: payload.lat,
          lng: payload.lng,
          timestamp: new Date().toISOString()
        });
      if (error) throw error;
      return { success: true, message: "บันทึก processdata สำเร็จ" };
    } catch (err) {
      console.error('❌ Supabase uploadProcessData error:', err);
      return { success: false, message: 'บันทึกข้อมูลผู้รับน้ำมันไม่สำเร็จ: ' + err.message };
    }
  },

  /**
   * Helper: Check if at least one alcohol test has been recorded for a reference
   * Replicates logic from driverjob.js
   */
  async hasAtLeastOneAlcoholChecked(reference) {
    try {
      const { data, error } = await supabase
        .from(TABLES.ALCOHOL_CHECKS)
        .select('id') // Just need to know if *any* exist
        .eq('reference', reference)
        .limit(1); // Optimize: only fetch one

      if (error) throw error;
      return data && data.length > 0;
    } catch (err) {
      console.error('❌ Supabase hasAtLeastOneAlcoholChecked error:', err);
      // Default to true to not block if there's an API error
      // This might need re-evaluation if the error should strictly block the action.
      // For now, fail-safe to allow, to avoid infinite blocking on API issues.
      return true; 
    }
  },

  /**
   * Close job
   * Schema aligned with app/PLAN.md: trips table with job_closed flag
   * Requires DriverAuth verification before allowing close
   */
  async closeJob({ reference, userId, driverCount, vehicleStatus, vehicleDesc, hillFee, bkkFee, repairFee, isHolidayWork, holidayWorkNotes }) {
    console.log('📋 Supabase: Closing job', reference);

    // Phase 1.5: Verify driver has access to this job before closing
    const hasAccess = await DriverAuth.verifyJobAccess(userId, reference);
    if (!hasAccess) {
      console.warn(`⚠️ Unauthorized close attempt by LIFF ID ${userId} on reference ${reference}`);
      return {
        success: false,
        message: DriverAuth.getUnauthorizedMessage(),
        unauthorized: true
      };
    }
    
    if (isHolidayWork) {
      console.log('🎊 Holiday work detected with notes:', holidayWorkNotes);
    }

    try {
      const totalFees = (
        (hillFee === 'yes' ? 500 : 0) +
        (bkkFee === 'yes' ? 300 : 0) +
        (repairFee === 'yes' ? 1000 : 0)
      );

      // Fetch trip_id for logging (read-only from TABLES.TRIPS)
      const { data: tripsData, error: tripsError } = await supabase
        .from(TABLES.TRIPS)
        .select('id')
        .eq('reference', reference);
      
      if (tripsError) throw tripsError;
      if (!tripsData || tripsData.length === 0) throw new Error("Trip not found for logging.");
      const tripIdForLog = tripsData[0].id;

      // Prepare update data
      const updateData = {
        status: 'closed',
        job_closed: true,
        job_closed_at: new Date().toISOString(),
        driver_count: driverCount,
        vehicle_status: vehicleStatus,
        closed_by: userId,
        updated_at: new Date().toISOString(),
        processdata_time: new Date().toISOString(),
        is_holiday_work: isHolidayWork
      };
      
      // Add holiday work notes if provided
      if (isHolidayWork && holidayWorkNotes) {
        updateData.holiday_work_notes = holidayWorkNotes;
        updateData.holiday_work_approved = false; // Default to not approved
        updateData.holiday_work_approved_by = null;
        updateData.holiday_work_approved_at = null;
      }

      // Update jobdata table (primary writable table for status)
      const { error } = await supabase
        .from(TABLES.JOBDATA)
        .update(updateData)
        .eq('reference', reference);

      if (error) throw error;

      // Log action
      const logDetails = { 
        vehicleStatus, 
        fees: totalFees, 
        hillFee, 
        bkkFee, 
        repairFee, 
        driverCount, 
        isHolidayWork 
      };
      
      // Add notes if holiday work
      if (isHolidayWork && holidayWorkNotes) {
        logDetails.holidayWorkNotes = holidayWorkNotes;
        logDetails.holidayWorkApproved = false; // Pending approval
      }
      
      await supabase
        .from(TABLES.DRIVER_LOGS)
        .insert({
          job_id: tripIdForLog, // Use ID fetched from TABLES.TRIPS
          reference: reference,
          action: 'close',
          details: logDetails,
          user_id: userId
        });

      return { 
        success: true, 
        message: isHolidayWork 
          ? 'ปิดงานสำเร็จ - รอการอนุมัติงานวันหยุด' 
          : 'ปิดงานสำเร็จ' 
      };
    } catch (err) {
      console.error('❌ Supabase closeJob error:', err);
      return { success: false, message: 'ปิดงานไม่สำเร็จ: ' + err.message };
    }
  },

  /**
   * End trip
   * Schema aligned with app/PLAN.md: trips table with trip_ended flag and end_time
   * Requires DriverAuth verification before allowing end
   */
  async endTrip({ reference, userId, endOdo, endPointName, lat, lng }) {
    console.log('🏁 Supabase: Ending trip', reference);

    // Phase 1.5: Verify driver has access to this job before ending trip
    const hasAccess = await DriverAuth.verifyJobAccess(userId, reference);
    if (!hasAccess) {
      console.warn(`⚠️ Unauthorized end trip attempt by LIFF ID ${userId} on reference ${reference}`);
      return {
        success: false,
        message: DriverAuth.getUnauthorizedMessage(),
        unauthorized: true
      };
    }

    try {
      // Fetch trip_id for logging (read-only from TABLES.TRIPS)
      const { data: tripsData, error: tripsError } = await supabase
        .from(TABLES.TRIPS)
        .select('id')
        .eq('reference', reference);
      
      if (tripsError) throw tripsError;
      if (!tripsData || tripsData.length === 0) throw new Error("Trip not found for logging.");
      const tripIdForLog = tripsData[0].id;

      // Update jobdata table (primary writable table for status)
      const { error } = await supabase
        .from(TABLES.JOBDATA)
        .update({
          status: 'completed',
          trip_ended: true, // This field is in jobdata, not driver_jobs
          trip_ended_at: new Date().toISOString(),
          trip_end_odo: endOdo ? parseInt(endOdo) : null,
          trip_end_lat: lat,
          trip_end_lng: lng,
          trip_end_place: endPointName,
          ended_by: userId,
          updated_at: new Date().toISOString(),
          processdata_time: new Date().toISOString()
        })
        .eq('reference', reference);

      if (error) throw error;

      // Log action
      await supabase
        .from(TABLES.DRIVER_LOGS)
        .insert({
          job_id: tripIdForLog, // Use ID fetched from TABLES.TRIPS
          reference: reference,
          action: 'endtrip',
          details: { endOdo, endPointName, location: { lat, lng } },
          location: { lat, lng },
          user_id: userId
        });

      return { success: true, message: 'บันทึกจบทริปสำเร็จ' };
    } catch (err) {
      console.error('❌ Supabase endTrip error:', err);
      return { success: false, message: 'บันทึกจบทริปไม่สำเร็จ: ' + err.message };
    }
  },

  /**
   * Save or update user profile
   * Phase 1.5: Already secure - updates only by user_id (which IS the liffId)
   * Users can only update their own profile
   */
  async saveUserProfile(profile) {
    console.log('👤 Supabase: Saving user profile', profile.userId);

    // Note: In LIFF auth, userId IS the liffId. The query below uses
    // .eq('user_id', profile.userId) so users can only update their own profile.
    // This is already secure at application layer.

    try {
      // Check if user exists
      const { data: existing } = await supabase
        .from(TABLES.USER_PROFILES)
        .select('id, total_visits')
        .eq('user_id', profile.userId)
        .single();

      if (existing) {
        // Update existing user
        const { error } = await supabase
          .from(TABLES.USER_PROFILES)
          .update({
            display_name: profile.displayName,
            picture_url: profile.pictureUrl,
            status_message: profile.statusMessage || null,
            last_seen_at: new Date().toISOString(),
            total_visits: (existing.total_visits || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', profile.userId);

        if (error) throw error;
        console.log('✅ User profile updated (visit #' + ((existing.total_visits || 0) + 1) + ')');
      } else {
        // Insert new user with PENDING status (requires admin approval)
        const { error } = await supabase
          .from(TABLES.USER_PROFILES)
          .insert({
            user_id: profile.userId,
            display_name: profile.displayName,
            picture_url: profile.pictureUrl,
            status_message: profile.statusMessage || null,
            first_seen_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
            total_visits: 1,
            user_type: 'DRIVER', // Default type for new users
            status: 'PENDING' // New users require admin approval
          });

        if (error) throw error;
        console.log('✅ New user profile created with PENDING status');
      }

      return { success: true };
    } catch (err) {
      console.error('❌ Supabase saveUserProfile error:', err);
      return { success: false, message: err.message };
    }
  },

  /**
   * Get a user's full profile from Supabase
   */
  async getUserProfile(userId) {
    if (!userId) return null;
    try {
      const { data, error } = await supabase
        .from(TABLES.USER_PROFILES)
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error) throw error;
      return data;
    } catch(err) {
      console.error('❌ Supabase getUserProfile error:', err);
      return null;
    }
  },

  /**
   * Update user's last searched reference
   */
  async updateUserLastReference(userId, reference) {
    try {
      const { error } = await supabase
        .from(TABLES.USER_PROFILES)
        .update({
          last_reference: reference,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) throw error;
    } catch (err) {
      console.error('❌ Update last reference error:', err);
    }
  },

  /**
   * Subscribe to realtime updates
   */
  subscribeToJob(reference, onUpdate) {
    console.log('📡 Supabase: Subscribing to realtime updates for', reference);

    // Unsubscribe from previous
    if (realtimeSubscription) {
      realtimeSubscription.unsubscribe();
    }

    realtimeSubscription = supabase
      .channel('jobdata-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: TABLES.JOBDATA,
          filter: `reference=eq.${reference}`
        },
        (payload) => {
          console.log('📡 Realtime update received:', payload);
          onUpdate(payload);
        }
      )
      .subscribe();

    return realtimeSubscription;
  },

  /**
   * Unsubscribe from realtime
   */
  unsubscribe() {
    if (realtimeSubscription) {
      realtimeSubscription.unsubscribe();
      realtimeSubscription = null;
    }
  }
};
