// ============================================
// UPLOAD ALCOHOL EDGE FUNCTION
// ============================================
// Purpose: บันทึกการตรวจแอลกอฮอล์ + upload รูปภาพ
// Endpoint: /upload-alcohol
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { UploadAlcoholRequest } from '../_shared/types.ts';
import {
  corsHeaders,
  successResponse,
  errorResponse,
  validateRequired,
  validateAlcoholValue,
  getCurrentTimestamp,
  decodeBase64,
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
    const body = await parseRequestBody<UploadAlcoholRequest>(req);
    if (!body) {
      return errorResponse('Invalid request body');
    }

    // Validate required fields
    const validationError = validateRequired(body, ['reference', 'driverName', 'userId', 'alcoholValue']);
    if (validationError) {
      return errorResponse(validationError);
    }

    const { reference, driverName, userId, alcoholValue, imageBase64, lat, lng } = body;

    // Validate alcohol value
    if (!validateAlcoholValue(alcoholValue)) {
      return errorResponse('ค่าแอลกอฮอล์ไม่ถูกต้อง (0-5)');
    }

    log(`Uploading alcohol check: ${driverName}, value: ${alcoholValue}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('PROJECT_URL') || 'https://myplpshpcordggbbtblg.supabase.co';
    const supabaseKey = Deno.env.get('SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Upload image to Supabase Storage (if provided)
    let imageUrl: string | null = null;
    if (imageBase64) {
      try {
        const fileName = `alcohol/${Date.now()}_${userId}.jpg`;
        const imageBytes = decodeBase64(imageBase64);

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('images')
          .upload(fileName, imageBytes, {
            contentType: 'image/jpeg',
            upsert: false,
          });

        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage.from('images').getPublicUrl(fileName);
          imageUrl = urlData.publicUrl;
          log(`Image uploaded: ${imageUrl}`);
        } else {
          log('Image upload warning:', uploadError);
        }
      } catch (err) {
        log('Image upload error (non-critical):', err);
        // Continue without image
      }
    }

    // Insert alcohol check record
    const { data, error } = await supabase
      .from('alcohol_checks')
      .insert({
        reference,
        driver_name: driverName,
        alcohol_value: alcoholValue,
        image_url: imageUrl,
        lat,
        lng,
        user_id: userId,
        created_at: getCurrentTimestamp(),
      })
      .select();

    if (error) {
      log('Database error:', error);
      return errorResponse('บันทึกการตรวจแอลกอฮอล์ไม่สำเร็จ', 500);
    }

    // Get updated checked drivers list
    const { data: allChecks } = await supabase
      .from('alcohol_checks')
      .select('driver_name')
      .eq('reference', reference);

    const checkedDrivers = allChecks
      ? [...new Set(allChecks.map((a) => a.driver_name))]
      : [driverName];

    const result = {
      checkedDrivers,
      imageUrl,
    };

    log(`Alcohol check recorded for ${driverName}`);
    return successResponse(result, 'บันทึกการตรวจแอลกอฮอล์สำเร็จ');

  } catch (err) {
    log('Unexpected error:', err);
    return errorResponse('เกิดข้อผิดพลาด: ' + (err as Error).message, 500);
  }
});
