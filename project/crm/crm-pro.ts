/**
 * CRM Pro - Supabase Edge Function
 * 
 * Features:
 * - Update customer points
 * - Send Telegram notifications
 * - LINE broadcast (text, image, flex messages)
 * - Segment-based targeting
 * - Tag-based filtering
 * 
 * @version 1.0.0
 * @author iton5
 * @date 2025-12-30
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ===== ENVIRONMENT VARIABLES =====
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID')
const LINE_CHANNEL_ACCESS_TOKEN = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const FUNCTION_API_KEY = Deno.env.get('FUNCTION_API_KEY') // Optional API Key for auth
const LINE_CHUNK_SIZE = parseInt(Deno.env.get('LINE_CHUNK_SIZE') || '500')
const CHUNK_DELAY_MS = parseInt(Deno.env.get('CHUNK_DELAY_MS') || '200')
const MAX_POINTS_CHANGE = parseInt(Deno.env.get('MAX_POINTS_CHANGE') || '10000')

// ===== CORS HEADERS =====
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ===== MAIN HANDLER =====
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    const body = await req.json()
    const { action, message, target, msgType, flexJson, imageUrl, testUserId, userId, points } = body
    
    // Logging
    const requestId = crypto.randomUUID().split('-')[0]
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      requestId,
      action,
      method: req.method
    }))

    // ===== ACTION: UPDATE POINTS =====
    if (action === 'update-points') {
        // Validation
        if (!userId) throw new Error('userId is required');
        if (typeof points !== 'number' || isNaN(points)) {
            throw new Error('Invalid points value');
        }
        if (Math.abs(points) > MAX_POINTS_CHANGE) {
            throw new Error(`Points change exceeds maximum allowed (${MAX_POINTS_CHANGE})`);
        }

        const { data: user, error: fetchError } = await supabase
            .from('profiles')
            .select('points')
            .eq('line_user_id', userId)
            .single();
        
        if (fetchError || !user) throw new Error('User not found');

        let newPoints = (user.points || 0) + (points || 0);
        if (newPoints < 0) newPoints = 0;

        const { error: updateError } = await supabase
            .from('profiles')
            .update({ 
                points: newPoints, 
                last_activity: new Date().toISOString()
            })
            .eq('line_user_id', userId);

        if (updateError) throw updateError;

        return new Response(
            JSON.stringify({ success: true, newPoints }), 
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // ===== ACTION: NOTIFY TELEGRAM =====
    if (action === 'notify-telegram') {
        if (!TELEGRAM_BOT_TOKEN) throw new Error('Telegram Secrets not set');
        await sendTelegram(message);
        return new Response(
            JSON.stringify({ success: true }), 
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // ===== ACTION: BROADCAST =====
    if (action === 'broadcast') {
        if (!LINE_CHANNEL_ACCESS_TOKEN) throw new Error('LINE Channel Access Token not set');

        let userIds: string[] = [];
        let debugInfo = "";

        // --- Target: Test User ---
        if (target === 'test') {
            if (testUserId) userIds = [testUserId];
        } 
        // --- Target: All Users ---
        else if (target === 'all') {
            const { data } = await supabase.from('profiles').select('line_user_id');
            userIds = data?.map((u: any) => u.line_user_id) || [];
        } 
        // --- Target: By Tag ---
        else if (target.startsWith('tag:')) {
            const tagName = target.split('tag:')[1].trim();
            const { data } = await supabase
                .from('profiles')
                .select('line_user_id')
                .contains('tags', [tagName]);
            userIds = data?.map((u: any) => u.line_user_id) || [];
        }
        // --- Target: By Segment ---
        else if (target.startsWith('segment:')) {
            const segmentId = target.split('segment:')[1].trim();
            const { data: segment, error: segError } = await supabase
                .from('customer_segments')
                .select('*')
                .eq('id', segmentId)
                .single();
            
            if (segError) throw new Error(`Segment Not Found: ${segError.message}`);

            if (segment) {
                let query = supabase.from('profiles').select('line_user_id');
                const cond = segment.conditions;
                
                debugInfo = JSON.stringify(cond);

                // Apply max_points condition
                if (cond.max_points !== undefined && cond.max_points !== null) {
                    query = query.lte('points', cond.max_points);
                }
                
                // Apply min_days_joined condition
                if (cond.min_days_joined) {
                    const d = new Date();
                    d.setDate(d.getDate() - cond.min_days_joined);
                    query = query.lt('created_at', d.toISOString());
                }

                // Apply inactive_days condition
                if (cond.inactive_days) {
                    const d = new Date();
                    d.setDate(d.getDate() - cond.inactive_days);
                    query = query.or(`last_activity.lt.${d.toISOString()},last_activity.is.null`);
                }

                const { data: profiles, error: queryError } = await query;
                
                if (queryError) {
                    throw new Error(`Database Query Error: ${queryError.message}`);
                }

                userIds = profiles?.map((u: any) => u.line_user_id) || [];
            }
        }

        // Remove duplicates and filter empty IDs
        userIds = [...new Set(userIds)].filter(id => id);

        // Check if we have any users to send to
        if (userIds.length === 0) {
            return new Response(JSON.stringify({ 
                success: false,
                message: `ไม่พบผู้ใช้งานในกลุ่มเป้าหมายนี้ (0 คน)`,
                debug: debugInfo ? `Conditions: ${debugInfo}` : 'No conditions'
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // Build LINE message based on type
        let lineMessages: any[] = [];

        if (msgType === 'text') {
            lineMessages.push({ type: 'text', text: message });
        } 
        else if (msgType === 'image') {
            lineMessages.push({ 
                type: 'image', 
                originalContentUrl: imageUrl, 
                previewImageUrl: imageUrl 
            });
        } 
        else if (msgType === 'flex') {
            try {
                const parsedFlex = JSON.parse(flexJson);
                if (parsedFlex.type === 'bubble' || parsedFlex.type === 'carousel') {
                    lineMessages.push({
                        type: 'flex',
                        altText: 'คุณได้รับข้อความใหม่',
                        contents: parsedFlex
                    });
                } else if (parsedFlex.type === 'flex') {
                    if (!parsedFlex.altText) parsedFlex.altText = 'คุณได้รับข้อความใหม่';
                    lineMessages.push(parsedFlex);
                } else {
                    lineMessages.push(parsedFlex);
                }
            } catch (e) {
                throw new Error('Invalid Flex Message JSON');
            }
        }

        // Send in chunks to avoid LINE API limits
        const chunkSize = LINE_CHUNK_SIZE;
        const delayBetweenChunks = CHUNK_DELAY_MS;
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < userIds.length; i += chunkSize) {
            const chunk = userIds.slice(i, i + chunkSize);
            const result = await sendLineMulticast(chunk, lineMessages);
            
            if (result) successCount += chunk.length;
            else failCount += chunk.length;
            
            // Delay between chunks to avoid rate limiting
            if (i + chunkSize < userIds.length) {
                await new Promise(resolve => setTimeout(resolve, delayBetweenChunks));
            }
        }

        return new Response(JSON.stringify({ 
            success: true, 
            count: userIds.length, 
            sent: successCount,
            failed: failCount,
            message: `ส่งสำเร็จ ${successCount} คน (ล้มเหลว ${failCount})` 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Unknown action
    return new Response(
        JSON.stringify({ error: 'Unknown action' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error("Function Error:", error);
    
    // Sanitize error message to prevent information leakage
    let safeErrorMessage = 'An error occurred';
    const err = error as Error;
    if (err.message && !err.message.toLowerCase().includes('profiles') && !err.message.toLowerCase().includes('database')) {
      safeErrorMessage = err.message;
    } else {
      safeErrorMessage = 'Database operation failed';
    }
    
    return new Response(
        JSON.stringify({ error: safeErrorMessage }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ===== HELPER: SEND TELEGRAM MESSAGE =====
async function sendTelegram(htmlMessage: string) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: htmlMessage,
            parse_mode: 'HTML'
        })
    });
}

// ===== HELPER: SEND LINE MULTICAST (WITH RETRY) =====
async function sendLineMulticast(userIds: string[], messages: any[], maxRetries = 3) {
    const url = 'https://api.line.me/v2/bot/message/multicast';
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const resp = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
                    'X-Line-Retry-Key': crypto.randomUUID()
                },
                body: JSON.stringify({
                    to: userIds,
                    messages: messages
                })
            });
            
            if (resp.ok) {
                return true;
            }
            
            const err = await resp.text();
            console.error(`LINE API Error (attempt ${attempt}/${maxRetries}):`, err);
            
            // Don't retry on client errors (4xx)
            if (resp.status >= 400 && resp.status < 500) {
                return false;
            }
            
            // Exponential backoff for retries
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        } catch (e) {
            console.error(`Network Error (attempt ${attempt}/${maxRetries}):`, e);
            if (attempt === maxRetries) {
                return false;
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
    
    return false;
}
