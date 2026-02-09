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
  PROCESS_DATA: 'process_data',
  DRIVER_MASTER: 'driver_master'
};

// Storage bucket name (migration PENDING)
const STORAGE_BUCKET = 'alcohol-evidence';

// Cache for table existence checks (avoid repeated 404 errors)
const TABLE_EXISTS_CACHE = {
  driver_stops: null // null=unknown, true=exists, false=not exists
};

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

    // The first trip row contains shared info like vehicle, drivers, route/trip
    const sharedTripInfo = trips[0] || {};

    // Create jobdata rows from the processed STOPS array
    const jobdataRows = filteredStops.map(stop => {
      return {
        reference: reference,
        shipment_no: sharedTripInfo.shipment_no || stop.shipmentNo || '',
        ship_to_code: stop.shipToCode || '',
        ship_to_name: stop.shipToName || '',
        status: stop.status || 'PENDING',
        checkin_time: stop.checkInTime || null,
        checkout_time: stop.checkOutTime || null,
        fueling_time: stop.fuelingTime || null,
        unload_done_time: stop.unloadDoneTime || null,
        vehicle_desc: sharedTripInfo.vehicle_desc || sharedTripInfo.vehicle || '',
        drivers: sharedTripInfo.drivers || sharedTripInfo.driver_name || '',
        seq: stop.seq,
        route: sharedTripInfo.route || sharedTripInfo.trip || '',
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

            // Debug: Log raw checkout times from database
            console.log('🔍 Raw data from database:');
            filteredJobdataRows.forEach(row => {
              console.log(`  id=${row.id}, seq=${row.seq}, ship_to_code="${row.ship_to_code}", checkout_time=${row.checkout_time}`);
            });

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

      // ============================================
      // Step 2: Fallback - Search in driver_jobs table
      // ============================================
      console.log('🔍 Step 2: Searching in driver_jobs table as fallback...');

      let driverJobsRows = null;
      let driverJobsError = null;

      try {
        const result = await supabase
          .from('driver_jobs')
          .select('*')
          .eq('reference', reference)
          .order('shipment_item', { ascending: true, nullsFirst: false });

        driverJobsRows = result.data;
        driverJobsError = result.error;
      } catch (err) {
        console.warn('⚠️ driver_jobs query exception:', err.message);
        driverJobsError = err;
      }

      // If found in driver_jobs, use it
      if (!driverJobsError && driverJobsRows && driverJobsRows.length > 0) {
        console.log('✅ Found in driver_jobs:', driverJobsRows.length, 'rows');

        // Filter out "คลังศรีราชา" stops
        const filteredDriverJobsRows = driverJobsRows.filter(row => {
          const shipToName = row.ship_to || row.ship_to_name || row.receiving_plant || '';
          return shipToName && !shipToName.includes('คลังศรีราชา');
        });

        if (filteredDriverJobsRows.length === 0) {
          console.log('ℹ️ All driver_jobs rows were filtered out as "คลังศรีราชา".');
        } else {
          console.log('✅ Filtered to:', filteredDriverJobsRows.length, 'rows from driver_jobs');

          // Get alcohol checks
          const { data: alcoholData } = await supabase
            .from(TABLES.ALCOHOL_CHECKS)
            .select('driver_name')
            .eq('reference', reference);

          const checkedDrivers = alcoholData ? [...new Set(alcoholData.map(a => a.driver_name))] : [];

          // Convert driver_jobs rows to stops format
          const stops = filteredDriverJobsRows.map((row, index) => {
            const shipToName = row.ship_to_name || row.ship_to || row.receiving_plant || `จุดส่งที่ ${index + 1}`;
            const shipToCode = row.ship_to || row.receiving_plant || '';

            return {
              rowIndex: String(row.id),
              seq: index + 2, // Start from 2 because we'll add origin as seq 1
              shipToCode: shipToCode,
              shipToName: shipToName,
              address: row.ship_to_address || row.street_5 || shipToName,
              status: row.status === 'active' ? 'PENDING' : (row.status || 'PENDING').toUpperCase(),
              checkInTime: null, // driver_jobs schema doesn't have checkin_time
              checkOutTime: null, // driver_jobs schema doesn't have checkout_time
              fuelingTime: null,
              unloadDoneTime: null,
              isOriginStop: false, // None of these are origin stops
              destLat: null, // driver_jobs schema doesn't have destination coordinates
              destLng: null,
              radiusM: null,
              distanceKm: row.distance || null,
              totalQty: row.delivery_qty || null,
              materials: row.material_desc || row.material || row.delivery || ''
            };
          });

          // Use first row for other data
          const firstRow = filteredDriverJobsRows[0];
          const routeCode = firstRow.route || firstRow.trip || null;

          // Get origin name from origin table BEFORE creating stops
          const { getOriginConfig } = await import('./location-service.js');
          const originData = await getOriginConfig(routeCode);
          const originName = originData?.name || routeCode || 'ต้นทาง';

          // Add origin stop as the first stop (seq 1)
          const originStop = {
            rowIndex: 'origin',
            seq: 1,
            shipToCode: originData?.originKey || '',
            shipToName: originName,
            address: originName,
            status: 'PENDING',
            checkInTime: null,
            checkOutTime: null,
            fuelingTime: null,
            unloadDoneTime: null,
            isOriginStop: true,
            destLat: originData?.lat || null, // Use origin coordinates directly
            destLng: originData?.lng || null,
            radiusM: originData?.radiusMeters || null,
            distanceKm: null,
            totalQty: null,
            materials: ''
          };

          // Insert origin stop at the beginning
          stops.unshift(originStop);
          console.log('✅ Added origin stop as seq 1 with name:', originName, ', total stops:', stops.length);

          const drivers = firstRow.drivers ? firstRow.drivers.split('/').map(d => d.trim()) :
                          (firstRow.driver_name ? [firstRow.driver_name] : []);

          // Enrich remaining stops with coordinates (origin already has coordinates)
          const enrichedStops = await enrichStopsWithCoordinates(stops, routeCode);

          // Sync to jobdata for future queries
          await syncToJobdata(driverJobsRows, enrichedStops, reference);

          return {
            success: true,
            source: 'driver_jobs',
            data: {
              referenceNo: reference,
              vehicleDesc: firstRow.vehicle_desc || firstRow.vehicle || '',
              shipmentNos: firstRow.shipment_no ? [firstRow.shipment_no] : [],
              totalStops: enrichedStops.length,
              stops: enrichedStops,
              alcohol: {
                drivers: drivers,
                checkedDrivers: checkedDrivers
              },
              jobClosed: false, // driver_jobs schema doesn't have this field
              tripEnded: false   // driver_jobs schema doesn't have this field
            }
          };
        }
      }

      // Log driver_jobs result
      if (driverJobsError) {
        console.warn('⚠️ driver_jobs query error:', driverJobsError.message);
      }

      // No data found in both tables
      console.log('ℹ️ No data found in jobdata or driver_jobs for reference:', reference);
      return { success: false, message: 'ไม่พบข้อมูลงาน Reference: ' + reference };
    } catch (err) {
      console.error('❌ Supabase search error:', err);
      return { success: false, message: 'เกิดข้อผิดพลาดในการค้นหา: ' + err.message };
    }
  },

  /**
   * Update stop status
   * Requires DriverAuth verification before allowing updates
   * Updates ALL rows with the same shipToCode or shipToName (for grouped stops)
   */
  async updateStop({ reference, seq, shipToCode, shipToName, status, type, userId, lat, lng, odo, receiverName, receiverType, hasPumping, hasTransfer }) {
    console.log('🔄 Supabase: Updating stop status for ref', reference, 'type', type);

    // Phase 1.5: Verify driver has access to this job before updating
    // userId in LIFF auth IS the liffId
    const hasAccess = await DriverAuth.verifyCheckInAccess(userId, reference, shipToCode, shipToName);
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

      // Update jobdata table - by ship_to_code if available, otherwise by ship_to_name, otherwise by seq
      const query = supabase
        .from(TABLES.JOBDATA)
        .update(jobdataUpdate)
        .eq('reference', reference);

      if (shipToCode) {
        console.log(`...targeting ship_to_code: ${shipToCode}`);
        query.eq('ship_to_code', shipToCode);
      } else if (shipToName) {
        console.log(`...targeting ship_to_name: ${shipToName}`);
        query.eq('ship_to_name', shipToName);
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
        // Log details of updated rows for debugging
        data.forEach((row, i) => {
          console.log(`  Row ${i+1}: seq=${row.seq}, ship_to_code=${row.ship_to_code}, checkin_time=${row.checkin_time}, checkout_time=${row.checkout_time}`);
        });
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
   *
   * IMPORTANT: job_id is now nullable - alcohol checks can be saved even if jobdata doesn't exist yet.
   * This prevents orphaned files in storage when drivers check alcohol before job is created.
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
      // Get job_id from jobdata table (optional now - nullable)
      let tripId = null;
      const { data: jobdataData, error: jobdataError } = await supabase
        .from(TABLES.JOBDATA)
        .select('id')
        .eq('reference', reference)
        .limit(1)
        .maybeSingle();

      if (!jobdataError && jobdataData) {
        tripId = String(jobdataData.id);
        console.log('✅ Found jobdata.id for alcohol check:', tripId);
      } else {
        console.log('ℹ️ No jobdata found for', reference, '- will save alcohol check with job_id=null');
      }

      // Prepare image upload filename (do this BEFORE actual upload to validate)
      let imageUrl = null;
      let fileName = null;

      if (imageBase64) {
        // Sanitize filename: remove spaces and special characters, use only alphanumeric
        // Thai characters in driverName cause "Invalid key" error in Supabase Storage
        const safeDriverName = driverName
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
          .replace(/[^a-zA-Z0-9]/g, '') // Remove non-alphanumeric (including Thai)
          .substring(0, 20); // Limit length
        fileName = `${reference}_${safeDriverName || 'driver'}_${Date.now()}.jpg`;
      }

      // Insert alcohol check record FIRST (before uploading image)
      // This ensures we have a DB record even if upload fails
      const insertData = {
        reference: reference,
        driver_name: driverName,
        checked_by: userId,
        alcohol_value: parseFloat(alcoholValue),
        image_url: null, // Will update after upload
        location: { lat, lng },
        checked_at: new Date().toISOString(),
        job_id: tripId // Can be null now
      };

      const { data: insertedRecord, error: insertError } = await supabase
        .from(TABLES.ALCOHOL_CHECKS)
        .insert(insertData)
        .select()
        .single();

      if (insertError) {
        // If insert fails, don't upload image (prevents orphaned files)
        throw insertError;
      }

      console.log('✅ Alcohol check record inserted:', insertedRecord.id);

      // NOW upload the image (after successful DB insert)
      if (imageBase64 && fileName) {
        const base64Data = imageBase64.split(',')[1] || imageBase64;

        try {
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(fileName, decodeBase64(base64Data), {
              contentType: 'image/jpeg',
              upsert: true
            });

          if (uploadError) {
            console.warn('⚠️ Image upload failed:', uploadError.message);
            // Record is already saved, just without image - that's OK
          } else if (uploadData) {
            const { data: urlData } = supabase.storage
              .from(STORAGE_BUCKET)
              .getPublicUrl(fileName);
            imageUrl = urlData.publicUrl;
            console.log('✅ Image uploaded successfully:', imageUrl);

            // Update the record with the image URL
            await supabase
              .from(TABLES.ALCOHOL_CHECKS)
              .update({ image_url: imageUrl })
              .eq('id', insertedRecord.id);
          }
        } catch (storageErr) {
          console.warn('⚠️ Storage upload exception:', storageErr.message);
          // Record is already saved, just without image - that's OK
        }
      }

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
  async closeJob({ reference, userId, driverCount, driver1Name, driver2Name, vehicleStatus, vehicleDesc, hillFee, bkkFee, repairFee, isHolidayWork, holidayWorkNotes }) {
    console.log('📋 Supabase: Closing job', reference, 'with drivers:', { driver1Name, driver2Name });

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

      // Fetch job_id for logging - use jobdata table instead of non-existent driver_jobs
      const { data: jobdataId, error: idError } = await supabase
        .from(TABLES.JOBDATA)
        .select('id')
        .eq('reference', reference)
        .limit(1)
        .maybeSingle();

      if (idError) {
        console.warn('⚠️ Could not fetch jobdata.id for logging:', idError.message);
      }
      const tripIdForLog = jobdataId ? String(jobdataId.id) : null;

      // Prepare update data
      const updateData = {
        status: 'closed',
        job_closed: true,
        job_closed_at: new Date().toISOString(),
        driver_count: driverCount,
        confirmed_driver1: driver1Name,
        confirmed_driver2: driver2Name || null,
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
        confirmedDrivers: { driver1: driver1Name, driver2: driver2Name },
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
          job_id: tripIdForLog, // Use ID fetched from jobdata table (as TEXT string)
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
      // Fetch job_id for logging - use jobdata table directly (driver_jobs table doesn't exist)
      let tripIdForLog = null;

      const { data: jobdataData, error: jobdataError } = await supabase
        .from(TABLES.JOBDATA)
        .select('id')
        .eq('reference', reference)
        .limit(1)
        .maybeSingle();

      if (!jobdataError && jobdataData) {
        tripIdForLog = String(jobdataData.id); // Convert to string for TEXT type compatibility
        console.log('✅ Using jobdata.id for logging:', tripIdForLog);
      } else if (jobdataError) {
        console.warn('⚠️ Could not fetch jobdata.id for logging:', jobdataError.message);
      }

      // Log action if we have a trip_id
      if (tripIdForLog) {
        await supabase
          .from(TABLES.DRIVER_LOGS)
          .insert({
            job_id: tripIdForLog,
            reference: reference,
            action: 'endtrip',
            details: { endOdo, endPointName, location: { lat, lng } },
            location: { lat, lng },
            user_id: userId
          });
      } else {
        console.warn('⚠️ No trip_id available for logging, skipping log entry');
      }

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
   * Fetch all drivers from driver_master table
   * @returns {Promise<Array>} Array of driver objects with driver_name, employee_code, etc.
   */
  async fetchDrivers() {
    try {
      const { data, error } = await supabase
        .from(TABLES.DRIVER_MASTER)
        .select('employee_code, driver_name, driver_sap_code, section, truck_type, position')
        .order('driver_name', { ascending: true });

      if (error) throw error;

      console.log('✅ Fetched', data?.length || 0, 'drivers from driver_master');
      return { success: true, drivers: data || [] };
    } catch (err) {
      console.error('❌ Supabase fetchDrivers error:', err);
      return { success: false, message: err.message, drivers: [] };
    }
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
