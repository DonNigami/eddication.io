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
   */
  async search(reference, userId) {
    console.log('🔍 Supabase: Searching for', reference);

    try {
      // Get job data
      const { data: jobData, error: jobError } = await supabase
        .from('jobdata')
        .select('*')
        .eq('reference', reference)
        .order('seq', { ascending: true });

      if (jobError) throw jobError;
      if (!jobData || jobData.length === 0) {
        return { success: false, message: 'ไม่พบข้อมูลงาน' };
      }

      // Get alcohol checks
      const { data: alcoholData } = await supabase
        .from('alcohol_checks')
        .select('driver_name')
        .eq('reference', reference);

      const checkedDrivers = alcoholData ? alcoholData.map(a => a.driver_name) : [];

      // Transform data
      const stops = jobData.map(row => ({
        rowIndex: row.id,
        seq: row.seq,
        shipToCode: row.ship_to_code,
        shipToName: row.ship_to_name,
        status: row.status,
        checkInTime: row.checkin_time,
        checkOutTime: row.checkout_time,
        fuelingTime: row.fueling_time,
        unloadDoneTime: row.unload_done_time,
        isOriginStop: row.is_origin_stop,
        destLat: row.dest_lat,
        destLng: row.dest_lng,
        totalQty: row.total_qty,
        materials: row.materials
      }));

      const firstRow = jobData[0];
      const drivers = firstRow.drivers ? firstRow.drivers.split(',').map(d => d.trim()) : [];

      return {
        success: true,
        data: {
          referenceNo: reference,
          vehicleDesc: firstRow.vehicle_desc || '',
          shipmentNos: firstRow.shipment_no ? [firstRow.shipment_no] : [],
          totalStops: stops.length,
          stops: stops,
          alcohol: {
            drivers: drivers,
            checkedDrivers: checkedDrivers
          },
          jobClosed: firstRow.job_closed || false,
          tripEnded: firstRow.trip_ended || false
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
        updated_at: new Date().toISOString(),
        updated_by: userId
      };

      if (type === 'checkin') {
        updates.checkin_time = new Date().toISOString();
        updates.checkin_lat = lat;
        updates.checkin_lng = lng;
        if (odo) updates.odo_start = odo;
        if (receiverName) updates.receiver_name = receiverName;
        if (receiverType) updates.receiver_type = receiverType;
      } else if (type === 'checkout') {
        updates.checkout_time = new Date().toISOString();
        updates.checkout_lat = lat;
        updates.checkout_lng = lng;
        if (hasPumping) updates.has_pumping = hasPumping === 'yes';
        if (hasTransfer) updates.has_transfer = hasTransfer === 'yes';
      } else if (type === 'fuel') {
        updates.fueling_time = new Date().toISOString();
      } else if (type === 'unload') {
        updates.unload_done_time = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('jobdata')
        .update(updates)
        .eq('id', rowIndex)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        message: getSuccessMessage(type),
        stop: {
          rowIndex: data.id,
          seq: data.seq,
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
      // Upload image to Storage
      let imageUrl = null;
      if (imageBase64) {
        const fileName = `alcohol/${Date.now()}_${userId}.jpg`;
        const base64Data = imageBase64.split(',')[1] || imageBase64;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('images')
          .upload(fileName, decodeBase64(base64Data), {
            contentType: 'image/jpeg'
          });

        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage
            .from('images')
            .getPublicUrl(fileName);
          imageUrl = urlData.publicUrl;
        }
      }

      // Insert alcohol check record
      const { data, error } = await supabase
        .from('alcohol_checks')
        .insert({
          reference: reference,
          driver_name: driverName,
          alcohol_value: parseFloat(alcoholValue),
          image_url: imageUrl,
          lat: lat,
          lng: lng,
          user_id: userId,
          created_at: new Date().toISOString()
        })
        .select();

      if (error) throw error;

      // Get updated checked drivers
      const { data: allChecks } = await supabase
        .from('alcohol_checks')
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
      // Update job status
      const { error: updateError } = await supabase
        .from('jobdata')
        .update({
          job_closed: true,
          vehicle_status: vehicleStatus,
          closed_at: new Date().toISOString(),
          closed_by: userId
        })
        .eq('reference', reference);

      if (updateError) throw updateError;

      // Insert close job record
      const { error: insertError } = await supabase
        .from('close_job_data')
        .insert({
          reference: reference,
          user_id: userId,
          vehicle_desc: vehicleDesc,
          vehicle_status: vehicleStatus,
          hill_fee: hillFee === 'yes',
          bkk_fee: bkkFee === 'yes',
          repair_fee: repairFee === 'yes',
          created_at: new Date().toISOString()
        });

      if (insertError) console.warn('Warning: Could not insert close_job_data', insertError);

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
      const { error } = await supabase
        .from('jobdata')
        .update({
          trip_ended: true,
          end_odo: endOdo ? parseInt(endOdo) : null,
          end_point_name: endPointName,
          end_lat: lat,
          end_lng: lng,
          ended_at: new Date().toISOString(),
          ended_by: userId
        })
        .eq('reference', reference);

      if (error) throw error;

      return { success: true, message: 'จบทริปสำเร็จ' };
    } catch (err) {
      console.error('❌ Supabase endTrip error:', err);
      return { success: false, message: 'จบทริปไม่สำเร็จ: ' + err.message };
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
