/**
 * Supabase API Helper for Driver Tracking App
 * 
 * Functions:
 * - searchJob(reference)
 * - updateStop(stopId, updates)
 * - uploadAlcohol(data)
 * - closeJob(reference, data)
 * - endTrip(reference, data)
 */

// Supabase Configuration
const SUPABASE_URL = 'https://myplpshpcordggbbtblg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15cGxwc2hwY29yZGdnYmJ0YmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MDI2ODgsImV4cCI6MjA4Mzk3ODY4OH0.UC42xLgqSdqgaogHmyRpES_NMy5t1j7YhdEZVwWUsJ8';

// Initialize Supabase client
const supabaseAPI = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Search Job by Reference
 * @param {string} reference - Job reference number
 * @returns {Object} Job data with stops and alcohol checks
 */
async function searchJob(reference) {
  try {
    // Get job details
    const { data: job, error: jobError } = await supabaseAPI
      .from('driver_jobs')
      .select('*')
      .eq('reference', reference)
      .single();

    if (jobError || !job) {
      throw new Error('ไม่พบงาน Reference: ' + reference);
    }

    // Get stops
    const { data: stops, error: stopsError } = await supabaseAPI
      .from('driver_stops')
      .select('*')
      .eq('reference', reference)
      .order('stop_number', { ascending: true });

    // Get alcohol checks
    const { data: alcoholChecks, error: alcoholError } = await supabaseAPI
      .from('driver_alcohol_checks')
      .select('*')
      .eq('reference', reference)
      .order('checked_at', { ascending: false });

    // Transform data
    const transformedStops = (stops || []).map((s) => ({
      id: s.id,
      rowIndex: s.id,
      stop_number: s.stop_number,
      stopName: s.stop_name || `จุดส่งที่ ${s.stop_number}`,
      address: s.address || '',
      destLat: s.checkin_location?.lat || null,
      destLng: s.checkin_location?.lng || null,
      checkinTime: s.checkin_time,
      checkinLat: s.checkin_location?.lat,
      checkinLng: s.checkin_location?.lng,
      fuelTime: s.fuel_time,
      fuelLat: s.fuel_location?.lat,
      fuelLng: s.fuel_location?.lng,
      fuelOdo: s.fuel_odo,
      unloadTime: s.unload_time,
      unloadLat: s.unload_location?.lat,
      unloadLng: s.unload_location?.lng,
      unloadReceiver: s.unload_receiver,
      checkoutTime: s.checkout_time,
      checkoutLat: s.checkout_location?.lat,
      checkoutLng: s.checkout_location?.lng,
      checkoutOdo: s.checkout_odo,
      status: s.status
    }));

    const driverNames = job.drivers ? job.drivers.split(',').map(d => d.trim()).filter(d => d) : [];
    const checkedDriverNames = alcoholChecks ? [...new Set(alcoholChecks.map(a => a.driver_name))] : [];

    return {
      success: true,
      data: {
        referenceNo: job.reference,
        vehicleDesc: job.vehicle_desc,
        alcohol: {
          drivers: driverNames,
          checkedDrivers: checkedDriverNames,
          checks: alcoholChecks || []
        },
        jobClosed: job.status === 'closed',
        tripEnded: job.status === 'completed',
        stops: transformedStops,
        job: job
      }
    };
  } catch (error) {
    console.error('Search error:', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Update Stop Status
 * @param {string} stopId - Stop UUID
 * @param {Object} updates - Fields to update
 */
async function updateStop(stopId, updates, userId) {
  try {
    const { data, error } = await supabaseAPI
      .from('driver_stops')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', stopId)
      .select()
      .single();

    if (error) throw error;

    // Log activity
    await supabaseAPI
      .from('driver_logs')
      .insert({
        job_id: data.job_id,
        reference: data.reference,
        action: getActionFromUpdates(updates),
        details: updates,
        user_id: userId,
        location: updates.checkin_location || updates.fuel_location || updates.unload_location || updates.checkout_location
      });

    return { success: true, data };
  } catch (error) {
    console.error('Update stop error:', error);
    return { success: false, message: error.message };
  }
}

function getActionFromUpdates(updates) {
  if (updates.checkin_time) return 'checkin';
  if (updates.fuel_time) return 'fuel';
  if (updates.unload_time) return 'unload';
  if (updates.checkout_time) return 'checkout';
  return 'update';
}

/**
 * Upload Alcohol Check
 * @param {Object} data - Alcohol check data
 */
async function uploadAlcohol(data) {
  try {
    const { reference, driverName, alcoholValue, lat, lng, imageBase64, userId } = data;

    // Get job_id
    const { data: job } = await supabaseAPI
      .from('driver_jobs')
      .select('id')
      .eq('reference', reference)
      .single();

    if (!job) throw new Error('ไม่พบงาน');

    // Upload image to Storage
    const fileName = `${reference}_${driverName}_${Date.now()}.jpg`;
    const { data: uploadData, error: uploadError } = await supabaseAPI
      .storage
      .from('alcohol-checks')
      .upload(fileName, dataURLtoBlob(imageBase64), {
        contentType: 'image/jpeg',
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = supabaseAPI
      .storage
      .from('alcohol-checks')
      .getPublicUrl(fileName);

    // Insert alcohol check record
    const { data: checkData, error: checkError } = await supabaseAPI
      .from('driver_alcohol_checks')
      .insert({
        job_id: job.id,
        reference: reference,
        driver_name: driverName,
        alcohol_value: parseFloat(alcoholValue),
        image_url: publicUrl,
        location: { lat, lng },
        checked_by: userId
      })
      .select()
      .single();

    if (checkError) throw checkError;

    // Get updated checked drivers list
    const { data: checks } = await supabaseAPI
      .from('driver_alcohol_checks')
      .select('driver_name')
      .eq('reference', reference);

    const checkedDrivers = [...new Set(checks.map(c => c.driver_name))];

    // Log activity
    await supabaseAPI
      .from('driver_logs')
      .insert({
        job_id: job.id,
        reference: reference,
        action: 'alcohol',
        details: { driverName, alcoholValue, imageUrl: publicUrl },
        location: { lat, lng },
        user_id: userId
      });

    return { success: true, checkedDrivers, data: checkData };
  } catch (error) {
    console.error('Upload alcohol error:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Close Job
 * @param {string} reference - Job reference
 * @param {Object} data - Close job data (vehicle status, fees, etc.)
 */
async function closeJob(reference, data, userId) {
  try {
    const { vehicleStatus, fees, lat, lng } = data;

    const { data: job, error } = await supabaseAPI
      .from('driver_jobs')
      .update({
        status: 'closed',
        vehicle_status: vehicleStatus,
        fees: fees,
        updated_at: new Date().toISOString(),
        updated_by: userId
      })
      .eq('reference', reference)
      .select()
      .single();

    if (error) throw error;

    // Log activity
    await supabaseAPI
      .from('driver_logs')
      .insert({
        job_id: job.id,
        reference: reference,
        action: 'close',
        details: { vehicleStatus, fees },
        location: { lat, lng },
        user_id: userId
      });

    return { success: true, data: job };
  } catch (error) {
    console.error('Close job error:', error);
    return { success: false, message: error.message };
  }
}

/**
 * End Trip
 * @param {string} reference - Job reference
 * @param {Object} data - End trip data (odo, location)
 */
async function endTrip(reference, data, userId) {
  try {
    const { odo, lat, lng } = data;

    const { data: job, error } = await supabaseAPI
      .from('driver_jobs')
      .update({
        status: 'completed',
        end_odo: odo,
        end_location: { lat, lng },
        updated_at: new Date().toISOString(),
        updated_by: userId
      })
      .eq('reference', reference)
      .select()
      .single();

    if (error) throw error;

    // Log activity
    await supabaseAPI
      .from('driver_logs')
      .insert({
        job_id: job.id,
        reference: reference,
        action: 'endtrip',
        details: { odo, location: { lat, lng } },
        location: { lat, lng },
        user_id: userId
      });

    return { success: true, data: job };
  } catch (error) {
    console.error('End trip error:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Helper: Convert base64 data URL to Blob
 */
function dataURLtoBlob(dataURL) {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

// Export for use in main app
window.SupabaseAPI = {
  searchJob,
  updateStop,
  uploadAlcohol,
  closeJob,
  endTrip
};

console.log('✅ Supabase API Helper loaded');
