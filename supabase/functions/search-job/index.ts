// ============================================
// SEARCH JOB EDGE FUNCTION
// ============================================
// Purpose: ค้นหางานด้วย reference และดึงข้อมูลทั้งหมด
// Endpoint: /search-job
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { SearchJobRequest, JobData, StopInfo } from '../_shared/types.ts';
import { 
  corsHeaders, 
  successResponse, 
  errorResponse, 
  validateRequired,
  validateReference,
  parseRequestBody,
  log 
} from '../_shared/utils.ts';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body
    const body = await parseRequestBody<SearchJobRequest>(req);
    if (!body) {
      return errorResponse('Invalid request body');
    }

    // Validate required fields
    const validationError = validateRequired(body, ['reference', 'userId']);
    if (validationError) {
      return errorResponse(validationError);
    }

    const { reference, userId } = body;

    // Validate reference format
    if (!validateReference(reference)) {
      return errorResponse('เลข Reference ไม่ถูกต้อง');
    }

    log(`Searching job: ${reference} by user: ${userId}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('PROJECT_URL') || 'https://myplpshpcordggbbtblg.supabase.co';
    const supabaseKey = Deno.env.get('SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch job data
    const { data: jobData, error: jobError } = await supabase
      .from('jobdata')
      .select('*')
      .eq('reference', reference)
      .order('seq', { ascending: true });

    if (jobError) {
      log('Database error:', jobError);
      return errorResponse('เกิดข้อผิดพลาดในการค้นหา', 500);
    }

    if (!jobData || jobData.length === 0) {
      return errorResponse('ไม่พบข้อมูลงาน', 404);
    }

    // Fetch alcohol checks
    const { data: alcoholData } = await supabase
      .from('alcohol_checks')
      .select('driver_name')
      .eq('reference', reference);

    const checkedDrivers = alcoholData ? alcoholData.map((a) => a.driver_name) : [];

    // Transform data to match frontend format
    const stops: StopInfo[] = jobData.map((row) => ({
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
      materials: row.materials,
    }));

    // Extract job metadata
    const firstRow = jobData[0];
    const drivers = firstRow.drivers ? firstRow.drivers.split(',').map((d: string) => d.trim()) : [];

    const result: JobData = {
      referenceNo: reference,
      vehicleDesc: firstRow.vehicle_desc || '',
      shipmentNos: firstRow.shipment_no ? [firstRow.shipment_no] : [],
      totalStops: stops.length,
      stops,
      alcohol: {
        drivers,
        checkedDrivers,
      },
      jobClosed: firstRow.job_closed || false,
      tripEnded: firstRow.trip_ended || false,
    };

    log(`Job found: ${reference}, ${stops.length} stops`);
    return successResponse(result, 'ค้นหางานสำเร็จ');

  } catch (err) {
    log('Unexpected error:', err);
    return errorResponse('เกิดข้อผิดพลาด: ' + (err as Error).message, 500);
  }
});
