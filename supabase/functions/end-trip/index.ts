// ============================================
// END TRIP EDGE FUNCTION
// ============================================
// Purpose: จบทริป พร้อมบันทึกตำแหน่งและเลขไมล์สิ้นสุด
// Endpoint: /end-trip
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { EndTripRequest } from '../_shared/types.ts';
import {
  corsHeaders,
  successResponse,
  errorResponse,
  validateRequired,
  validateOdo,
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
    const body = await parseRequestBody<EndTripRequest>(req);
    if (!body) {
      return errorResponse('Invalid request body');
    }

    // Validate required fields
    const validationError = validateRequired(body, ['reference', 'userId', 'endPointName']);
    if (validationError) {
      return errorResponse(validationError);
    }

    const { reference, userId, endOdo, endPointName, lat, lng } = body;

    // Validate ODO if provided
    if (endOdo && !validateOdo(endOdo)) {
      return errorResponse('เลขไมล์ไม่ถูกต้อง (0-9,999,999)');
    }

    log(`Ending trip: ${reference} by user: ${userId}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update job with trip end information
    const { error } = await supabase
      .from('jobdata')
      .update({
        trip_ended: true,
        end_odo: endOdo || null,
        end_point_name: endPointName,
        end_lat: lat,
        end_lng: lng,
        ended_at: getCurrentTimestamp(),
        ended_by: userId,
      })
      .eq('reference', reference);

    if (error) {
      log('Database error:', error);
      return errorResponse('จบทริปไม่สำเร็จ', 500);
    }

    log(`Trip ended successfully: ${reference}`);
    return successResponse(null, 'จบทริปสำเร็จ');

  } catch (err) {
    log('Unexpected error:', err);
    return errorResponse('เกิดข้อผิดพลาด: ' + (err as Error).message, 500);
  }
});
