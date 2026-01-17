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
      // Get job from driver_jobs table
      const { data: job, error: jobError } = await supabase
        .from('driver_jobs')
        .select('*')
        .eq('reference', reference)
        .single();

      if (jobError || !job) {
        return { success: false, message: 'ไม่พบข้อมูลงาน Reference: ' + reference };
      }

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

      // Transform stops data to match existing format
      const stops = (stopsData || []).map(row => ({
        rowIndex: row.id,
        seq: row.stop_number,
        shipToCode: row.stop_number.toString(),
        shipToName: row.stop_name || `จุดส่งที่ ${row.stop_number}`,
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

      const drivers = job.drivers ? job.drivers.split(',').map(d => d.trim()) : [];

      return {
        success: true,
        data: {
          referenceNo: reference,
          vehicleDesc: job.vehicle_desc || '',
          shipmentNos: [],
          totalStops: stops.length,
          stops: stops,
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
