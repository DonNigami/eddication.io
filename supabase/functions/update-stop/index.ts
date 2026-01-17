// ============================================
// UPDATE STOP EDGE FUNCTION
// ============================================
// Purpose: อัปเดตสถานะของ stop (check-in, check-out, fuel, unload)
// Endpoint: /update-stop
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { UpdateStopRequest } from '../_shared/types.ts';
import {
  corsHeaders,
  successResponse,
  errorResponse,
  validateRequired,
  getCurrentTimestamp,
  parseRequestBody,
  getSuccessMessage,
  log,
} from '../_shared/utils.ts';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body
    const body = await parseRequestBody<UpdateStopRequest>(req);
    if (!body) {
      return errorResponse('Invalid request body');
    }

    // Validate required fields
    const validationError = validateRequired(body, ['rowIndex', 'status', 'type', 'userId']);
    if (validationError) {
      return errorResponse(validationError);
    }

    const {
      rowIndex,
      status,
      type,
      userId,
      lat,
      lng,
      odo,
      receiverName,
      receiverType,
      hasPumping,
      hasTransfer,
    } = body;

    log(`Updating stop: ${rowIndex}, type: ${type}, user: ${userId}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('PROJECT_URL') || 'https://myplpshpcordggbbtblg.supabase.co';
    const supabaseKey = Deno.env.get('SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build update object based on type
    const updates: Record<string, any> = {
      status,
      updated_at: getCurrentTimestamp(),
      updated_by: userId,
    };

    if (type === 'checkin') {
      updates.checkin_time = getCurrentTimestamp();
      if (lat) updates.checkin_lat = lat;
      if (lng) updates.checkin_lng = lng;
      if (odo) updates.odo_start = odo;
      if (receiverName) updates.receiver_name = receiverName;
      if (receiverType) updates.receiver_type = receiverType;
    } else if (type === 'checkout') {
      updates.checkout_time = getCurrentTimestamp();
      if (lat) updates.checkout_lat = lat;
      if (lng) updates.checkout_lng = lng;
      if (hasPumping) updates.has_pumping = hasPumping === 'yes';
      if (hasTransfer) updates.has_transfer = hasTransfer === 'yes';
    } else if (type === 'fuel') {
      updates.fueling_time = getCurrentTimestamp();
    } else if (type === 'unload') {
      updates.unload_done_time = getCurrentTimestamp();
    }

    // Update database
    const { data, error } = await supabase
      .from('jobdata')
      .update(updates)
      .eq('id', rowIndex)
      .select()
      .single();

    if (error) {
      log('Database error:', error);
      return errorResponse('อัปเดตสถานะไม่สำเร็จ', 500);
    }

    const result = {
      stop: {
        rowIndex: data.id,
        seq: data.seq,
        status: data.status,
        checkInTime: data.checkin_time,
        checkOutTime: data.checkout_time,
        fuelingTime: data.fueling_time,
        unloadDoneTime: data.unload_done_time,
      },
    };

    log(`Stop updated successfully: ${rowIndex}`);
    return successResponse(result, getSuccessMessage(type));

  } catch (err) {
    log('Unexpected error:', err);
    return errorResponse('เกิดข้อผิดพลาด: ' + (err as Error).message, 500);
  }
});
