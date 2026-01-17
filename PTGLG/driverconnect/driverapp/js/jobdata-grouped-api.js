/**
 * =====================================================
 * JOBDATA GROUPED API
 * =====================================================
 * Frontend API สำหรับจัดการ jobdata แบบรวมจุด
 * - Query: ใช้ jobdata_grouped view
 * - Update: อัพเดททุกแถวที่มี ship_to_code เดียวกัน
 * =====================================================
 */

import { supabase } from './supabase-client.js';

/**
 * ดึงข้อมูล jobs แบบรวมจุด (สำหรับแสดงใน Frontend)
 * @param {string} reference - Reference number
 * @returns {Promise<Array>} - Array of grouped stops
 */
export async function getGroupedJobs(reference) {
  const { data, error } = await supabase
    .from('jobdata_grouped')
    .select('*')
    .eq('reference', reference)
    .order('seq', { ascending: true });

  if (error) {
    console.error('Error fetching grouped jobs:', error);
    throw error;
  }

  return data;
}

/**
 * ดึงข้อมูล stop เดียว (แบบรวม)
 * @param {string} reference - Reference number
 * @param {string} shipToCode - Ship to code
 * @returns {Promise<Object>} - Grouped stop object
 */
export async function getGroupedStop(reference, shipToCode) {
  const { data, error } = await supabase
    .from('jobdata_grouped')
    .select('*')
    .eq('reference', reference)
    .eq('ship_to_code', shipToCode)
    .single();

  if (error) {
    console.error('Error fetching grouped stop:', error);
    throw error;
  }

  return data;
}

/**
 * Check-in ที่จุดส่ง (อัพเดททุกแถวที่มี ship_to_code เดียวกัน)
 * @param {Object} params - Check-in parameters
 * @returns {Promise<Object>} - Result with updated count
 */
export async function checkinGroupedStop({
  reference,
  shipToCode,
  checkinTime = new Date().toISOString(),
  checkinLat,
  checkinLng,
  checkinOdo = null,
  accuracy = null,
  updatedBy = null
}) {
  const { data, error } = await supabase
    .rpc('update_grouped_stop_checkin', {
      p_reference: reference,
      p_ship_to_code: shipToCode,
      p_checkin_time: checkinTime,
      p_checkin_lat: checkinLat,
      p_checkin_lng: checkinLng,
      p_checkin_odo: checkinOdo,
      p_accuracy: accuracy,
      p_updated_by: updatedBy
    });

  if (error) {
    console.error('Error checking in:', error);
    throw error;
  }

  return data[0]; // { updated_count, updated_ids, message }
}

/**
 * Check-out ที่จุดส่ง (อัพเดททุกแถวที่มี ship_to_code เดียวกัน)
 * @param {Object} params - Check-out parameters
 * @returns {Promise<Object>} - Result with updated count
 */
export async function checkoutGroupedStop({
  reference,
  shipToCode,
  checkoutTime = new Date().toISOString(),
  checkoutLat,
  checkoutLng,
  checkoutOdo = null,
  receiverName = null,
  receiverType = null,
  updatedBy = null
}) {
  const { data, error } = await supabase
    .rpc('update_grouped_stop_checkout', {
      p_reference: reference,
      p_ship_to_code: shipToCode,
      p_checkout_time: checkoutTime,
      p_checkout_lat: checkoutLat,
      p_checkout_lng: checkoutLng,
      p_checkout_odo: checkoutOdo,
      p_receiver_name: receiverName,
      p_receiver_type: receiverType,
      p_updated_by: updatedBy
    });

  if (error) {
    console.error('Error checking out:', error);
    throw error;
  }

  return data[0];
}

/**
 * บันทึกเวลาเติมน้ำมัน (อัพเดททุกแถวที่มี ship_to_code เดียวกัน)
 * @param {Object} params - Fueling parameters
 * @returns {Promise<Object>} - Result with updated count
 */
export async function updateGroupedStopFueling({
  reference,
  shipToCode,
  fuelingTime = new Date().toISOString(),
  updatedBy = null
}) {
  const { data, error } = await supabase
    .rpc('update_grouped_stop_fueling', {
      p_reference: reference,
      p_ship_to_code: shipToCode,
      p_fueling_time: fuelingTime,
      p_updated_by: updatedBy
    });

  if (error) {
    console.error('Error updating fueling:', error);
    throw error;
  }

  return data[0];
}

/**
 * บันทึกเวลาขนสินค้าเสร็จ (อัพเดททุกแถวที่มี ship_to_code เดียวกัน)
 * @param {Object} params - Unload parameters
 * @returns {Promise<Object>} - Result with updated count
 */
export async function updateGroupedStopUnload({
  reference,
  shipToCode,
  unloadDoneTime = new Date().toISOString(),
  updatedBy = null
}) {
  const { data, error } = await supabase
    .rpc('update_grouped_stop_unload', {
      p_reference: reference,
      p_ship_to_code: shipToCode,
      p_unload_done_time: unloadDoneTime,
      p_updated_by: updatedBy
    });

  if (error) {
    console.error('Error updating unload:', error);
    throw error;
  }

  return data[0];
}

/**
 * ตรวจสอบว่าอยู่ในรัศมีของจุดส่งหรือไม่
 * @param {number} currentLat - ละติจูดปัจจุบัน
 * @param {number} currentLng - ลองจิจูดปัจจุบัน
 * @param {number} destLat - ละติจูดปลายทาง
 * @param {number} destLng - ลองจิจูดปลายทาง
 * @param {number} radiusM - รัศมีเป็นเมตร (default: 200)
 * @returns {boolean} - true ถ้าอยู่ในรัศมี
 */
export function isWithinRadius(currentLat, currentLng, destLat, destLng, radiusM = 200) {
  const R = 6371000; // รัศมีโลกเป็นเมตร
  const dLat = (destLat - currentLat) * Math.PI / 180;
  const dLng = (destLng - currentLng) * Math.PI / 180;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(currentLat * Math.PI / 180) * Math.cos(destLat * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // ระยะทางเป็นเมตร
  
  return distance <= radiusM;
}

/**
 * คำนวณระยะทางระหว่าง 2 จุด (เมตร)
 * @param {number} lat1 - ละติจูดจุดที่ 1
 * @param {number} lng1 - ลองจิจูดจุดที่ 1
 * @param {number} lat2 - ละติจูดจุดที่ 2
 * @param {number} lng2 - ลองจิจูดจุดที่ 2
 * @returns {number} - ระยะทางเป็นเมตร
 */
export function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // รัศมีโลกเป็นเมตร
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  return Math.round(distance); // ปัดเป็นเมตร
}

/**
 * Format materials string สำหรับแสดงผล
 * @param {string} materials - Materials string (comma-separated)
 * @param {number} maxItems - จำนวนสูงสุดที่แสดง
 * @returns {string} - Formatted string
 */
export function formatMaterials(materials, maxItems = 3) {
  if (!materials) return '';
  
  const items = materials.split(',').map(m => m.trim());
  
  if (items.length <= maxItems) {
    return materials;
  }
  
  const shown = items.slice(0, maxItems).join(', ');
  const remaining = items.length - maxItems;
  return `${shown} +${remaining} อื่นๆ`;
}

/**
 * ตัวอย่างการใช้งาน
 */
export const examples = {
  // ดึงข้อมูล jobs
  async fetchJobs() {
    const jobs = await getGroupedJobs('2601M01559');
    console.log('Grouped jobs:', jobs);
    // jobs = [
    //   { group_id: '2601M01559_11000973', ship_to_code: '11000973', materials: 'DIESEL, GASOHOL 95', total_qty: 11, ... },
    //   { group_id: '2601M01559_ZSF76', ship_to_code: 'ZSF76', materials: 'DIESEL, GASOHOL 95', total_qty: 7, ... }
    // ]
  },
  
  // Check-in
  async doCheckin() {
    const position = await getCurrentPosition();
    
    const result = await checkinGroupedStop({
      reference: '2601M01559',
      shipToCode: '11000973',
      checkinLat: position.coords.latitude,
      checkinLng: position.coords.longitude,
      checkinOdo: 12500,
      accuracy: position.coords.accuracy,
      updatedBy: 'U001'
    });
    
    console.log('Check-in result:', result);
    // result = { updated_count: 2, updated_ids: [1, 2], message: 'Updated 2 row(s)...' }
  },
  
  // Check-out
  async doCheckout() {
    const position = await getCurrentPosition();
    
    const result = await checkoutGroupedStop({
      reference: '2601M01559',
      shipToCode: '11000973',
      checkoutLat: position.coords.latitude,
      checkoutLng: position.coords.longitude,
      checkoutOdo: 12550,
      receiverName: 'นายสมชาย',
      receiverType: 'พนักงาน',
      updatedBy: 'U001'
    });
    
    console.log('Check-out result:', result);
  }
};

// Helper function
function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject);
  });
}

export default {
  getGroupedJobs,
  getGroupedStop,
  checkinGroupedStop,
  checkoutGroupedStop,
  updateGroupedStopFueling,
  updateGroupedStopUnload,
  isWithinRadius,
  calculateDistance,
  formatMaterials
};
