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

// Table names (aligned with app/PLAN.md migration status - PENDING)
const TABLES = {
  TRIPS: 'driver_jobs',
  TRIP_STOPS: 'driver_stops',
  ALCOHOL_CHECKS: 'driver_alcohol_checks',
  DRIVER_LOGS: 'driver_logs',
  JOBDATA: 'jobdata',
  USER_PROFILES: 'user_profiles'
};

// Storage bucket name (migration PENDING)
const STORAGE_BUCKET = 'alcohol-checks';

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
 * Enrich stops with coordinates from master location tables
 * รองรับโครงสร้างตารางจริงใน Supabase
 */
async function enrichStopsWithCoordinates(stops, route = null) {
  if (!stops || stops.length === 0) return stops;

  try {
    console.log('🔍 Enriching coordinates for', stops.length, 'stops');

    // Step 1: Get origin coordinate if route is provided
    let originLat = null;
    let originLng = null;

    if (route) {
      const routePrefix = route.substring(0, 3).toUpperCase();
      
      try {
        // ตาราง origin ใช้ originKey, name, lat, lng, radiusMeters, routeCode
        const { data: originData } = await supabase
          .from('origin')
          .select('originKey, name, lat, lng, radiusMeters, routeCode')
          .or(`routeCode.ilike.${routePrefix}%,originKey.ilike.${routePrefix}%`)
          .limit(1)
          .maybeSingle();

        if (originData) {
          originLat = parseFloat(originData.lat);
          originLng = parseFloat(originData.lng);
          
          if (!isNaN(originLat) && !isNaN(originLng)) {
            console.log(`✅ Found origin: ${originData.name} (${originLat}, ${originLng})`);
          } else {
            originLat = null;
            originLng = null;
          }
        }
      } catch (error) {
        console.warn('⚠️ Error fetching origin:', error.message);
      }
    }

    // Step 2: Get all customer coordinates
    // ตาราง customer ใช้ stationKey เป็น primary key (เช่น 1102, 1202)
    const shipToCodes = stops
      .filter(s => s.shipToCode && !s.isOriginStop)
      .map(s => s.shipToCode)
      .filter((v, i, a) => a.indexOf(v) === i); // unique

    const customerMap = new Map();

    if (shipToCodes.length > 0) {
      try {
        const { data: customerData } = await supabase
          .from('customer')
          .select('stationKey, name, lat, lng, radiusMeters')
          .in('stationKey', shipToCodes);

        if (customerData) {
          customerData.forEach(c => {
            const lat = parseFloat(c.lat);
            const lng = parseFloat(c.lng);
            
            if (!isNaN(lat) && !isNaN(lng)) {
              customerMap.set(c.stationKey, { lat, lng });
            }
          });
          console.log(`✅ Found ${customerData.length} customers with coordinates`);
        }
      } catch (error) {
        console.warn('⚠️ Error fetching customers:', error.message);
      }
    }

    // Step 3: Get all station coordinates
    // ตาราง station ใช้ stationKey เป็น primary key (เช่น ZS184, ZS185)
    const stationMap = new Map();

    if (shipToCodes.length > 0) {
      try {
        const { data: stationData } = await supabase
          .from('station')
          .select('stationKey, station_name, lat, lng')
          .in('stationKey', shipToCodes);

        if (stationData) {
          stationData.forEach(s => {
            const lat = parseFloat(s.lat);
            const lng = parseFloat(s.lng);
            
            if (!isNaN(lat) && !isNaN(lng)) {
              stationMap.set(s.stationKey, { lat, lng });
            }
          });
          console.log(`✅ Found ${stationData.length} stations with coordinates`);
        }
      } catch (error) {
        console.warn('⚠️ Error fetching stations:', error.message);
      }
    }

    // Step 4: Enrich stops
    const enrichedStops = stops.map(stop => {
      // If already has coordinates, keep them
      if (stop.destLat && stop.destLng) {
        return stop;
      }

      // Origin stop - use origin coordinates
      if (stop.isOriginStop && originLat && originLng) {
        return {
          ...stop,
          destLat: originLat,
          destLng: originLng
        };
      }

      // Regular stop - lookup in customer or station
      if (stop.shipToCode) {
        // Try customer first (ใช้ shipToCode match กับ stationKey)
        const customer = customerMap.get(stop.shipToCode);
        if (customer && customer.lat && customer.lng) {
          return {
            ...stop,
            destLat: customer.lat,
            destLng: customer.lng
          };
        }

        // Try station (ใช้ shipToCode match กับ stationKey)
        const station = stationMap.get(stop.shipToCode);
        if (station && station.lat && station.lng) {
          return {
            ...stop,
            destLat: station.lat,
            destLng: station.lng
          };
        }
      }

      // No coordinates found
      return stop;
    });

    const enrichedCount = enrichedStops.filter(s => s.destLat && s.destLng).length;
    console.log(`✅ Enriched ${enrichedCount}/${stops.length} stops with coordinates`);

    return enrichedStops;

  } catch (error) {
    console.error('❌ Error enriching coordinates:', error);
    // Return original stops if enrichment fails
    return stops;
  }
}

/**
 * Sync trips data to jobdata table
 */
async function syncToJobdata(trips, stops, reference) {
  try {
    console.log('🔄 Syncing trips to jobdata...', trips.length, 'trips');

    // Delete existing jobdata rows for this reference
    await supabase
      .from(TABLES.JOBDATA)
      .delete()
      .eq('reference', reference);

    // Insert new rows (each trip row = 1 stop in jobdata)
    const jobdataRows = trips.map((trip, index) => {
      const stop = stops[index] || {};

      return {
        reference: reference,
        shipment_no: trip.shipment_no || '',
        ship_to_code: trip.ship_to || stop.shipToCode || '',
        ship_to_name: trip.ship_to_name || stop.shipToName || '',
        status: stop.status || 'PENDING',
        checkin_time: stop.checkInTime || null,
        checkout_time: stop.checkOutTime || null,
        fueling_time: stop.fuelingTime || null,
        unload_done_time: stop.unloadDoneTime || null,
        vehicle_desc: trip.vehicle_desc || '',
        drivers: trip.drivers || '',
        seq: index + 1,
        route: trip.route || '',
        is_origin_stop: index === 0,
        materials: trip.material_desc || stop.materials || '',
        total_qty: trip.delivery_qty || stop.totalQty || null,
        dest_lat: stop.destLat || null,
        dest_lng: stop.destLng || null,
        job_closed: trip.job_closed || trip.status === 'closed',
        trip_ended: trip.trip_ended || trip.status === 'completed',
        vehicle_status: trip.vehicle_status || null,
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
   */
  async search(reference, userId) {
    console.log('🔍 Supabase: Searching for', reference);

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
        
        const firstRow = jobdataRows[0];
        
        // Get alcohol checks from alcohol_checks table
        const { data: alcoholData } = await supabase
          .from(TABLES.ALCOHOL_CHECKS)
          .select('driver_name')
          .eq('reference', reference);

        const checkedDrivers = alcoholData ? [...new Set(alcoholData.map(a => a.driver_name))] : [];
        
        // Convert jobdata rows to stops format
        const stops = jobdataRows.map(row => ({
          rowIndex: row.id,
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
          totalQty: row.total_qty || null,
          materials: row.materials || ''
        }));

        // Enrich stops with coordinates from master location tables
        const enrichedStops = await enrichStopsWithCoordinates(stops, firstRow.route || null);

        const drivers = firstRow.drivers ? firstRow.drivers.split(',').map(d => d.trim()) : [];

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

      // Log jobdata result
      if (jobdataError) {
        console.warn('⚠️ jobdata query error:', jobdataError.message);
      } else {
        console.log('ℹ️ No data found in jobdata');
      }

      // ============================================
      // Step 2: Search in trips table (fallback)
      // ============================================
      console.log('🔍 Step 2: Searching in trips table...');

      let jobs = null;
      let jobError = null;

      try {
        const result = await supabase
          .from(TABLES.TRIPS)
          .select('*')
          .eq('reference', reference)
          .order('created_at', { ascending: true });

        jobs = result.data;
        jobError = result.error;
      } catch (err) {
        console.error('❌ trips query exception:', err.message);
        jobError = err;
      }

      // Handle trips query error
      if (jobError) {
        console.error('❌ trips query error:', jobError);

        // If it's an RLS or permission error, show helpful message
        const errorMsg = jobError.message || '';
        if (jobError.code === 'PGRST116' || errorMsg.includes('406') || errorMsg.includes('permission') || errorMsg.includes('policy')) {
          return {
            success: false,
            message: '⚠️ ไม่พบข้อมูลในระบบ\n\nReference: ' + reference + '\n\nกรุณาตรวจสอบ:\n1. เลข Reference ถูกต้องหรือไม่\n2. งานถูกสร้างในระบบแล้วหรือยัง\n\n(หมายเหตุ: ตรวจสอบทั้ง jobdata และ trips แล้ว)'
          };
        }

        return {
          success: false,
          message: 'เกิดข้อผิดพลาด: ' + errorMsg
        };
      }

      if (!jobs || jobs.length === 0) {
        return {
          success: false,
          message: 'ไม่พบข้อมูลงาน Reference: ' + reference + '\n\n(ค้นหาทั้ง jobdata และ trips แล้ว)'
        };
      }

      console.log('✅ Found in trips:', jobs.length, 'rows');
      
      // Use first job for header info
      const job = jobs[0];

      // Get stops from trip_stops table
      const { data: stopsData, error: stopsError } = await supabase
        .from(TABLES.TRIP_STOPS)
        .select('*')
        .eq('reference', reference)
        .order('sequence', { ascending: true });

      // Get alcohol checks from alcohol_checks table
      const { data: alcoholData } = await supabase
        .from(TABLES.ALCOHOL_CHECKS)
        .select('driver_name')
        .eq('reference', reference);

      const checkedDrivers = alcoholData ? [...new Set(alcoholData.map(a => a.driver_name))] : [];

      // If trip_stops has data, use it. Otherwise, create stops from each trip row
      let stops = [];

      if (stopsData && stopsData.length > 0) {
        // Use trip_stops data (aligned with app/PLAN.md schema)
        stops = stopsData.map(row => ({
          rowIndex: row.id,
          seq: row.sequence || row.stop_number,
          shipToCode: (row.sequence || row.stop_number).toString(),
          shipToName: row.destination_name || row.stop_name || `จุดส่งที่ ${row.sequence || row.stop_number}`,
          address: row.address,
          status: row.status || 'pending',
          checkInTime: row.check_in_time || row.checkin_time,
          checkOutTime: row.check_out_time || row.checkout_time,
          fuelingTime: row.fueling_time || row.fuel_time,
          unloadDoneTime: row.unload_done_time || row.unload_time,
          isOriginStop: row.is_origin || row.sequence === 1 || row.stop_number === 1,
          destLat: row.lat || row.checkin_location?.lat || null,
          destLng: row.lng || row.checkin_location?.lng || null,
          checkInOdo: row.check_in_odo,
          receiverName: row.receiver_name,
          receiverType: row.receiver_type,
          checkInLat: row.check_in_lat,
          checkInLng: row.check_in_lng,
          totalQty: null,
          materials: row.address
        }));
      } else {
        // Create stops from each job row (each row = 1 stop/delivery item)
        stops = jobs.map((jobRow, index) => ({
          rowIndex: jobRow.id,
          seq: index + 1,
          shipToCode: jobRow.ship_to || '',
          shipToName: jobRow.ship_to_name || `จุดส่งที่ ${index + 1}`,
          address: jobRow.ship_to_address || '',
          status: 'pending',
          checkInTime: null,
          checkOutTime: null,
          fuelingTime: null,
          unloadDoneTime: null,
          isOriginStop: index === 0,
          destLat: null,
          destLng: null,
          totalQty: jobRow.delivery_qty || null,
          materials: jobRow.material_desc || '',
          delivery: jobRow.delivery || '',
          material: jobRow.material || '',
          deliveryItem: jobRow.delivery_item || ''
        }));
      }

      const drivers = job.drivers ? job.drivers.split(',').map(d => d.trim()) : [];

      // Enrich stops with coordinates from master location tables
      const enrichedStops = await enrichStopsWithCoordinates(stops, job.route || null);

      // Step 3: Sync data to jobdata table (found in trips, copy to jobdata)
      console.log('🔄 Step 3: Syncing from trips to jobdata...');
      await syncToJobdata(jobs, enrichedStops, reference);

      return {
        success: true,
        source: 'trips',
        data: {
          referenceNo: reference,
          vehicleDesc: job.vehicle_desc || '',
          shipmentNos: [],
          totalStops: enrichedStops.length,
          stops: enrichedStops,
          alcohol: {
            drivers: drivers,
            checkedDrivers: checkedDrivers
          },
          jobClosed: job.status === 'closed',
          tripEnded: job.status === 'completed'
        }
      };
    } catch (err) {
      console.error('❌ Supabase search error:', err);
      return { success: false, message: 'เกิดข้อผิดพลาดในการค้นหา: ' + err.message };
    }
  },

  /**
   * Update stop status
   */
  async updateStop({ reference, seq, shipToCode, status, type, userId, lat, lng, odo, receiverName, receiverType, hasPumping, hasTransfer }) {
    console.log('🔄 Supabase: Updating stop status for ref', reference, 'type', type);

    try {
      const now = new Date().toISOString();
      const jobdataUpdate = {
        status: status,
        updated_at: now,
        updated_by: userId
      };

      if (type === 'checkin') {
        jobdataUpdate.checkin_time = now;
        jobdataUpdate.checkin_lat = lat;
        jobdataUpdate.checkin_lng = lng;
        if (odo) jobdataUpdate.checkin_odo = parseInt(odo);
        if (receiverName) jobdataUpdate.receiver_name = receiverName;
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

      // Also update trip_stops for consistency, using sequence number
      try {
        const tripStopUpdate = { status: status, updated_at: now, updated_by: userId };
        if (type === 'checkin') {
          tripStopUpdate.check_in_time = now;
          tripStopUpdate.checkin_time = now; // backward compatibility
          tripStopUpdate.check_in_lat = lat;
          tripStopUpdate.check_in_lng = lng;
          if (odo) tripStopUpdate.check_in_odo = parseInt(odo);
          if (receiverName) tripStopUpdate.receiver_name = receiverName;
          if (receiverType) tripStopUpdate.receiver_type = receiverType;
        } else if (type === 'checkout') {
          tripStopUpdate.check_out_time = now;
          tripStopUpdate.checkout_time = now; // backward compatibility
        } else if (type === 'fuel') {
          tripStopUpdate.fueling_time = now;
          tripStopUpdate.fuel_time = now; // backward compatibility
        } else if (type === 'unload') {
          tripStopUpdate.unload_done_time = now;
          tripStopUpdate.unload_time = now; // backward compatibility
        }
        
        const { error: tripStopError } = await supabase
          .from(TABLES.TRIP_STOPS)
          .update(tripStopUpdate)
          .eq('reference', reference)
          .eq('sequence', seq);

        if (tripStopError) {
          console.warn(`⚠️ Could not sync update to trip_stops for seq ${seq}:`, tripStopError.message);
        } else {
          console.log(`✅ Synced update to trip_stops for seq ${seq}`);
        }
      } catch (syncError) {
        console.warn('⚠️ Error during trip_stops sync:', syncError.message);
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
   */
  async uploadAlcohol({ reference, driverName, userId, alcoholValue, imageBase64, lat, lng }) {
    console.log('🍺 Supabase: Uploading alcohol check for', driverName);

    try {
      // Get trip_id first
      const { data: trip } = await supabase
        .from(TABLES.TRIPS)
        .select('id')
        .eq('reference', reference)
        .single();

      if (!trip) throw new Error('ไม่พบงาน');

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
          trip_id: trip.id,
          reference: reference,
          driver_name: driverName,
          driver_user_id: userId,
          alcohol_value: parseFloat(alcoholValue),
          image_url: imageUrl,
          lat: lat,
          lng: lng,
          checked_at: new Date().toISOString()
        })
        .select();

      if (error) throw error;

      // Log action
      await supabase
        .from(TABLES.DRIVER_LOGS)
        .insert({
          trip_id: trip.id,
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

  /**
   * Close job
   * Schema aligned with app/PLAN.md: trips table with job_closed flag
   */
  async closeJob({ reference, userId, vehicleStatus, vehicleDesc, hillFee, bkkFee, repairFee }) {
    console.log('📋 Supabase: Closing job', reference);

    try {
      const totalFees = (
        (hillFee === 'yes' ? 500 : 0) +
        (bkkFee === 'yes' ? 300 : 0) +
        (repairFee === 'yes' ? 1000 : 0)
      );

      // Update trip status (per PLAN.md schema)
      const { data, error } = await supabase
        .from(TABLES.TRIPS)
        .update({
          status: 'closed',
          job_closed: true,
          vehicle_status: vehicleStatus,
          fees: totalFees,
          updated_at: new Date().toISOString(),
          updated_by: userId
        })
        .eq('reference', reference)
        .select()
        .single();

      if (error) throw error;

      // Also update jobdata table
      await supabase
        .from(TABLES.JOBDATA)
        .update({
          job_closed: true,
          job_closed_at: new Date().toISOString(),
          vehicle_status: vehicleStatus,
          closed_by: userId,
          updated_at: new Date().toISOString()
        })
        .eq('reference', reference);

      // Log action
      await supabase
        .from(TABLES.DRIVER_LOGS)
        .insert({
          trip_id: data.id,
          reference: reference,
          action: 'close',
          details: { vehicleStatus, fees: totalFees, hillFee, bkkFee, repairFee },
          user_id: userId
        });

      return { success: true, message: 'ปิดงานสำเร็จ' };
    } catch (err) {
      console.error('❌ Supabase closeJob error:', err);
      return { success: false, message: 'ปิดงานไม่สำเร็จ: ' + err.message };
    }
  },

  /**
   * End trip
   * Schema aligned with app/PLAN.md: trips table with trip_ended flag and end_time
   */
  async endTrip({ reference, userId, endOdo, endPointName, lat, lng }) {
    console.log('🏁 Supabase: Ending trip', reference);

    try {
      const { data, error } = await supabase
        .from(TABLES.TRIPS)
        .update({
          status: 'completed',
          trip_ended: true,
          end_time: new Date().toISOString(),
          end_odo: endOdo ? parseInt(endOdo) : null,
          end_location: { lat, lng },
          updated_at: new Date().toISOString(),
          updated_by: userId
        })
        .eq('reference', reference)
        .select()
        .single();

      if (error) throw error;

      // Also update jobdata table
      await supabase
        .from(TABLES.JOBDATA)
        .update({
          trip_ended: true,
          trip_ended_at: new Date().toISOString(),
          trip_end_odo: endOdo ? parseInt(endOdo) : null,
          trip_end_lat: lat,
          trip_end_lng: lng,
          trip_end_place: endPointName,
          ended_by: userId,
          updated_at: new Date().toISOString()
        })
        .eq('reference', reference);

      // Log action
      await supabase
        .from(TABLES.DRIVER_LOGS)
        .insert({
          trip_id: data.id,
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
   */
  async saveUserProfile(profile) {
    console.log('👤 Supabase: Saving user profile', profile.userId);

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
        // Insert new user
        const { error } = await supabase
          .from(TABLES.USER_PROFILES)
          .insert({
            user_id: profile.userId,
            display_name: profile.displayName,
            picture_url: profile.pictureUrl,
            status_message: profile.statusMessage || null,
            first_seen_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
            total_visits: 1
          });

        if (error) throw error;
        console.log('✅ New user profile created');
      }

      return { success: true };
    } catch (err) {
      console.error('❌ Supabase saveUserProfile error:', err);
      return { success: false, message: err.message };
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
