// ============================================
// CLOSE JOB EDGE FUNCTION
// ============================================
// Purpose: ปิดงาน พร้อมบันทึกข้อมูลรถและค่าใช้จ่าย
// Endpoint: /close-job
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { CloseJobRequest } from '../_shared/types.ts';
import {
  corsHeaders,
  successResponse,
  errorResponse,
  validateRequired,
  getCurrentTimestamp,
  parseRequestBody,
  log,
} from '../_shared/utils.ts';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body
    const body = await parseRequestBody<CloseJobRequest>(req);
    if (!body) {
      return errorResponse('Invalid request body');
    }

    // Validate required fields
    const validationError = validateRequired(body, [
      'reference',
      'userId',
      'vehicleStatus',
      'vehicleDesc',
    ]);
    if (validationError) {
      return errorResponse(validationError);
    }

    const { reference, userId, vehicleStatus, vehicleDesc, hillFee, bkkFee, repairFee } = body;

    log(`Closing job: ${reference} by user: ${userId}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('PROJECT_URL') || 'https://myplpshpcordggbbtblg.supabase.co';
    const supabaseKey = Deno.env.get('SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update job status to closed
    const { error: updateError } = await supabase
      .from('jobdata')
      .update({
        job_closed: true,
        vehicle_status: vehicleStatus,
        closed_at: getCurrentTimestamp(),
        closed_by: userId,
      })
      .eq('reference', reference);

    if (updateError) {
      log('Database error:', updateError);
      return errorResponse('ปิดงานไม่สำเร็จ', 500);
    }

    // Insert close job record (optional table for history)
    try {
      await supabase.from('close_job_data').insert({
        reference,
        user_id: userId,
        vehicle_desc: vehicleDesc,
        vehicle_status: vehicleStatus,
        hill_fee: hillFee === 'yes',
        bkk_fee: bkkFee === 'yes',
        repair_fee: repairFee === 'yes',
        created_at: getCurrentTimestamp(),
      });
    } catch (err) {
      log('Warning: Could not insert close_job_data', err);
      // Non-critical, continue
    }

    log(`Job closed successfully: ${reference}`);
    return successResponse(null, 'ปิดงานสำเร็จ');

  } catch (err) {
    log('Unexpected error:', err);
    return errorResponse('เกิดข้อผิดพลาด: ' + (err as Error).message, 500);
  }
});
