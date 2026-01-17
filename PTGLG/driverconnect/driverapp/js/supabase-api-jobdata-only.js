/**
 * Driver Tracking App - Supabase API Functions (JOBDATA ONLY VERSION)
 * Use this if driver_jobs table is not ready
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
    console.log('✅ Supabase client initialized (JOBDATA ONLY MODE)');
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
   * Search job by reference - JOBDATA ONLY
   */
  async search(reference, userId) {
    console.log('🔍 Supabase: Searching in jobdata for', reference);

    try {
      const { data: jobdataRows, error: jobdataError } = await supabase
        .from('jobdata')
        .select('*')
        .eq('reference', reference)
        .order('seq', { ascending: true });

      if (jobdataError) {
        console.error('❌ jobdata query error:', jobdataError);
        return { 
          success: false, 
          message: 'เกิดข้อผิดพลาด: ' + jobdataError.message 
        };
      }

      if (!jobdataRows || jobdataRows.length === 0) {
        return { success: false, message: 'ไม่พบข้อมูลงาน Reference: ' + reference };
      }
      
      console.log('✅ Found in jobdata:', jobdataRows.length, 'rows');
      
      const firstRow = jobdataRows[0];
      
      // Get alcohol checks
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

      const drivers = firstRow.drivers ? firstRow.drivers.split(',').map(d => d.trim()) : [];

      return {
        success: true,
        data: {
          referenceNo: reference,
          vehicleDesc: firstRow.vehicle_desc || '',
          shipmentNos: [],
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
        updated_at: new Date().toISOString()
      };

      if (type === 'checkin') {
        updates.checkin_time = new Date().toISOString();
        updates.checkin_lat = lat;
        updates.checkin_lng = lng;
        updates.checkin_by = userId;
        if (receiverName) updates.receiver_name = receiverName;
        if (odo) updates.checkin_odo = parseInt(odo);
      } else if (type === 'checkout') {
        updates.checkout_time = new Date().toISOString();
        updates.checkout_lat = lat;
        updates.checkout_lng = lng;
        updates.checkout_by = userId;
        if (odo) updates.checkout_odo = parseInt(odo);
        if (hasPumping) updates.has_pumping = hasPumping;
        if (hasTransfer) updates.has_transfer = hasTransfer;
      } else if (type === 'fuel') {
        updates.fueling_time = new Date().toISOString();
        updates.fueling_lat = lat;
        updates.fueling_lng = lng;
        updates.fueling_by = userId;
      } else if (type === 'unload') {
        updates.unload_done_time = new Date().toISOString();
        updates.unload_lat = lat;
        updates.unload_lng = lng;
        updates.unload_by = userId;
        if (receiverName) updates.receiver_name = receiverName;
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
      const { data, error } = await supabase
        .from('jobdata')
        .update({
          job_closed: true,
          job_closed_at: new Date().toISOString(),
          vehicle_status: vehicleStatus,
          closed_by: userId,
          updated_at: new Date().toISOString()
        })
        .eq('reference', reference)
        .select();

      if (error) throw error;

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
        .eq('reference', reference)
        .select();

      if (error) throw error;

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
      const { data: existing } = await supabase
        .from('user_profiles')
        .select('id, total_visits')
        .eq('user_id', profile.userId)
        .single();

      if (existing) {
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
      } else {
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
