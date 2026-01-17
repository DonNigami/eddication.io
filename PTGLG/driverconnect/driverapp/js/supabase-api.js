/**
 * Driver Tracking App - Supabase API Functions
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { decodeBase64 } from './utils.js';

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
 * Sync driver_jobs data to jobdata table
 */
async function syncToJobdata(jobs, stops, reference) {
  try {
    console.log('🔄 Syncing driver_jobs to jobdata...', jobs.length, 'jobs');
    
    // Delete existing jobdata rows for this reference
    await supabase
      .from('jobdata')
      .delete()
      .eq('reference', reference);
    
    // Insert new rows (each job row = 1 stop in jobdata)
    const jobdataRows = jobs.map((job, index) => {
      const stop = stops[index] || {};
      
      return {
        reference: reference,
        shipment_no: job.shipment_no || '',
        ship_to_code: job.ship_to || stop.shipToCode || '',
        ship_to_name: job.ship_to_name || stop.shipToName || '',
        status: stop.status || 'PENDING',
        checkin_time: stop.checkInTime || null,
        checkout_time: stop.checkOutTime || null,
        fueling_time: stop.fuelingTime || null,
        unload_done_time: stop.unloadDoneTime || null,
        vehicle_desc: job.vehicle_desc || '',
        drivers: job.drivers || '',
        seq: index + 1,
        route: job.route || '',
        is_origin_stop: index === 0,
        materials: job.material_desc || stop.materials || '',
        total_qty: job.delivery_qty || stop.totalQty || null,
        dest_lat: stop.destLat || null,
        dest_lng: stop.destLng || null,
        job_closed: job.status === 'closed',
        trip_ended: job.status === 'completed',
        vehicle_status: job.vehicle_status || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    });
    
    if (jobdataRows.length > 0) {
      const { error } = await supabase
        .from('jobdata')
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
          .from('jobdata')
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
        
        // Get alcohol checks from driver_alcohol_checks table
        const { data: alcoholData } = await supabase
          .from('driver_alcohol_checks')
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
      // Step 2: Search in driver_jobs (fallback)
      // ============================================
      console.log('🔍 Step 2: Searching in driver_jobs...');
      
      let jobs = null;
      let jobError = null;
      
      try {
        const result = await supabase
          .from('driver_jobs')
          .select('*')
          .eq('reference', reference)
          .order('created_at', { ascending: true });
        
        jobs = result.data;
        jobError = result.error;
      } catch (err) {
        console.error('❌ driver_jobs query exception:', err.message);
        jobError = err;
      }

      // Handle driver_jobs error
      if (jobError) {
        console.error('❌ driver_jobs query error:', jobError);
        
        // If it's an RLS or permission error, show helpful message
        const errorMsg = jobError.message || '';
        if (jobError.code === 'PGRST116' || errorMsg.includes('406') || errorMsg.includes('permission') || errorMsg.includes('policy')) {
          return { 
            success: false, 
            message: '⚠️ ไม่พบข้อมูลในระบบ\n\nReference: ' + reference + '\n\nกรุณาตรวจสอบ:\n1. เลข Reference ถูกต้องหรือไม่\n2. งานถูกสร้างในระบบแล้วหรือยัง\n\n(หมายเหตุ: ตรวจสอบทั้ง jobdata และ driver_jobs แล้ว)' 
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
          message: 'ไม่พบข้อมูลงาน Reference: ' + reference + '\n\n(ค้นหาทั้ง jobdata และ driver_jobs แล้ว)' 
        };
      }
      
      console.log('✅ Found in driver_jobs:', jobs.length, 'rows');
      
      // Use first job for header info
      const job = jobs[0];

      // Get stops from driver_stops table
      const { data: stopsData, error: stopsError } = await supabase
        .from('driver_stops')
        .select('*')
        .eq('reference', reference)
        .order('stop_number', { ascending: true });

      // Get alcohol checks from driver_alcohol_checks table
      const { data: alcoholData } = await supabase
        .from('driver_alcohol_checks')
        .select('driver_name')
        .eq('reference', reference);

      const checkedDrivers = alcoholData ? [...new Set(alcoholData.map(a => a.driver_name))] : [];

      // If driver_stops has data, use it. Otherwise, create stops from each job row
      let stops = [];
      
      if (stopsData && stopsData.length > 0) {
        // Use driver_stops data
        stops = stopsData.map(row => ({
          rowIndex: row.id,
          seq: row.stop_number,
          shipToCode: row.stop_number.toString(),
          shipToName: row.stop_name || `จุดส่งที่ ${row.stop_number}`,
          address: row.address,
          status: row.status || 'pending',
          checkInTime: row.checkin_time,
          checkOutTime: row.checkout_time,
          fuelingTime: row.fuel_time,
          unloadDoneTime: row.unload_time,
          isOriginStop: row.stop_number === 1,
          destLat: row.checkin_location?.lat || null,
          destLng: row.checkin_location?.lng || null,
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

      // Step 3: Sync data to jobdata table (found in driver_jobs, copy to jobdata)
      console.log('🔄 Step 3: Syncing from driver_jobs to jobdata...');
      await syncToJobdata(jobs, enrichedStops, reference);

      return {
        success: true,
        source: 'driver_jobs',
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
  async updateStop({ rowIndex, status, type, userId, lat, lng, odo, receiverName, receiverType, hasPumping, hasTransfer }) {
    console.log('🔄 Supabase: Updating stop', rowIndex, type);

    try {
      const updates = {
        status: status,
        updated_at: new Date().toISOString()
      };

      const location = { lat, lng };

      if (type === 'checkin') {
        updates.checkin_time = new Date().toISOString();
        updates.checkin_location = location;
        updates.checkin_by = userId;
        if (receiverName) updates.unload_receiver = receiverName;
      } else if (type === 'checkout') {
        updates.checkout_time = new Date().toISOString();
        updates.checkout_location = location;
        updates.checkout_by = userId;
        if (odo) updates.checkout_odo = parseInt(odo);
      } else if (type === 'fuel') {
        updates.fuel_time = new Date().toISOString();
        updates.fuel_location = location;
        updates.fuel_by = userId;
        if (odo) updates.fuel_odo = parseInt(odo);
      } else if (type === 'unload') {
        updates.unload_time = new Date().toISOString();
        updates.unload_location = location;
        updates.unload_by = userId;
        if (receiverName) updates.unload_receiver = receiverName;
      }

      const { data, error } = await supabase
        .from('driver_stops')
        .update(updates)
        .eq('id', rowIndex)
        .select()
        .single();

      if (error) throw error;

      // Also update jobdata table (sync)
      const jobdataUpdate = {
        status: status === 'checkin' ? 'CHECKIN' : 
                status === 'checkout' ? 'CHECKOUT' : 'PENDING',
        updated_at: new Date().toISOString()
      };

      if (type === 'checkin') {
        jobdataUpdate.checkin_time = updates.checkin_time;
        jobdataUpdate.checkin_lat = lat;
        jobdataUpdate.checkin_lng = lng;
        if (receiverName) jobdataUpdate.receiver_name = receiverName;
      } else if (type === 'checkout') {
        jobdataUpdate.checkout_time = updates.checkout_time;
        jobdataUpdate.checkout_lat = lat;
        jobdataUpdate.checkout_lng = lng;
        if (odo) jobdataUpdate.checkin_odo = parseInt(odo);
      } else if (type === 'fuel') {
        jobdataUpdate.fueling_time = updates.fuel_time;
      } else if (type === 'unload') {
        jobdataUpdate.unload_done_time = updates.unload_time;
        if (receiverName) jobdataUpdate.receiver_name = receiverName;
      }

      // Update jobdata by reference and seq
      await supabase
        .from('jobdata')
        .update(jobdataUpdate)
        .eq('reference', data.reference)
        .eq('seq', data.stop_number);

      // Log the action
      await supabase
        .from('driver_logs')
        .insert({
          job_id: data.job_id,
          reference: data.reference,
          action: type,
          details: updates,
          location: location,
          user_id: userId
        });

      return {
        success: true,
        message: getSuccessMessage(type),
        stop: {
          rowIndex: data.id,
          seq: data.stop_number,
          status: data.status,
          checkInTime: data.checkin_time,
          checkOutTime: data.checkout_time
        }
      };
    } catch (err) {
      console.error('❌ Supabase updateStop error:', err);
      return { success: false, message: 'อัปเดตสถานะไม่สำเร็จ: ' + err.message };
    }
  },

  /**
   * Upload alcohol check
   */
  async uploadAlcohol({ reference, driverName, userId, alcoholValue, imageBase64, lat, lng }) {
    console.log('🍺 Supabase: Uploading alcohol check for', driverName);

    try {
      // Get job_id first
      const { data: job } = await supabase
        .from('driver_jobs')
        .select('id')
        .eq('reference', reference)
        .single();

      if (!job) throw new Error('ไม่พบงาน');

      // Upload image to Storage (alcohol-checks bucket)
      let imageUrl = null;
      if (imageBase64) {
        const fileName = `${reference}_${driverName}_${Date.now()}.jpg`;
        const base64Data = imageBase64.split(',')[1] || imageBase64;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('alcohol-checks')
          .upload(fileName, decodeBase64(base64Data), {
            contentType: 'image/jpeg'
          });

        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage
            .from('alcohol-checks')
            .getPublicUrl(fileName);
          imageUrl = urlData.publicUrl;
        }
      }

      // Insert alcohol check record
      const { data, error } = await supabase
        .from('driver_alcohol_checks')
        .insert({
          job_id: job.id,
          reference: reference,
          driver_name: driverName,
          alcohol_value: parseFloat(alcoholValue),
          image_url: imageUrl,
          location: { lat, lng },
          checked_by: userId,
          checked_at: new Date().toISOString()
        })
        .select();

      if (error) throw error;

      // Log action
      await supabase
        .from('driver_logs')
        .insert({
          job_id: job.id,
          reference: reference,
          action: 'alcohol',
          details: { driverName, alcoholValue, imageUrl },
          location: { lat, lng },
          user_id: userId
        });

      // Get updated checked drivers
      const { data: allChecks } = await supabase
        .from('driver_alcohol_checks')
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
   */
  async closeJob({ reference, userId, vehicleStatus, vehicleDesc, hillFee, bkkFee, repairFee }) {
    console.log('📋 Supabase: Closing job', reference);

    try {
      const totalFees = (
        (hillFee === 'yes' ? 500 : 0) + 
        (bkkFee === 'yes' ? 300 : 0) + 
        (repairFee === 'yes' ? 1000 : 0)
      );

      // Update job status
      const { data, error } = await supabase
        .from('driver_jobs')
        .update({
          status: 'closed',
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
        .from('jobdata')
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
        .from('driver_logs')
        .insert({
          job_id: data.id,
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
   */
  async endTrip({ reference, userId, endOdo, endPointName, lat, lng }) {
    console.log('🏁 Supabase: Ending trip', reference);

    try {
      const { data, error } = await supabase
        .from('driver_jobs')
        .update({
          status: 'completed',
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
        .from('jobdata')
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
        .from('driver_logs')
        .insert({
          job_id: data.id,
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
        .from('user_profiles')
        .select('id, total_visits')
        .eq('user_id', profile.userId)
        .single();

      if (existing) {
        // Update existing user
        const { error } = await supabase
          .from('user_profiles')
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
          .from('user_profiles')
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
        .from('user_profiles')
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
          table: 'jobdata',
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
