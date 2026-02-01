// =====================================================
// SUPABASE EDGE FUNCTION - SEND NOTIFICATION
// Send notifications via LINE Messaging API
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// =====================================================
// CONFIG & TYPES
// =====================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LINE_ACCESS_TOKEN = Deno.env.get('LINE_ACCESS_TOKEN')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface Message {
  type: string;
  text?: string;
  altText?: string;
  contents?: any;
  quickReply?: {
    items: QuickReplyItem[];
  };
}

interface QuickReplyItem {
  type: string;
  action: {
    type: string;
    label: string;
    text?: string;
    data?: string;
  };
}

interface NotificationRequest {
  user_id?: string;
  line_user_id?: string;
  clinic_id?: string;
  type: 'appointment' | 'queue' | 'reminder' | 'promotion' | 'system';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  quick_reply?: boolean;
}

// =====================================================
// LINE API HELPERS
// =====================================================

async function pushMessage(lineUserId: string, messages: Message[]): Promise<boolean> {
  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('LINE Push failed:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('LINE Push error:', error);
    return false;
  }
}

async function multicastMessage(lineUserIds: string[], messages: Message[]): Promise<boolean> {
  try {
    const response = await fetch('https://api.line.me/v2/bot/message/multicast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: lineUserIds,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('LINE Multicast failed:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('LINE Multicast error:', error);
    return false;
  }
}

// =====================================================
// NOTIFICATION TEMPLATES
// =====================================================

function createAppointmentNotification(data: {
  queueNumber: number;
  doctorName: string;
  date: string;
  time: string;
}): Message {
  return {
    type: 'text',
    text: `📅 การจองนัดหมายสำเร็จ\n\n` +
      `คิวหมายเลข: A${data.queueNumber}\n` +
      `แพทย์: ${data.doctorName}\n` +
      `วันที่: ${formatDateTh(data.date)}\n` +
      `เวลา: ${data.time}\n\n` +
      `กรุณามาตามนัด 15 นาทีล่วงหน้า`,
  };
}

function createQueueNotification(data: {
  queueNumber: number;
  doctorName: string;
  estimatedWaitTime: number;
}): Message {
  return {
    type: 'text',
    text: `🔔 อัปเดตคิว\n\n` +
      `คิวหมายเลข: A${data.queueNumber}\n` +
      `แพทย์: ${data.doctorName}\n` +
      `ค่อยอีกประมาณ ${data.estimatedWaitTime} นาที`,
  };
}

function createQueueCalledNotification(data: {
  queueNumber: number;
  doctorName: string;
  roomNumber?: string;
}): Message {
  let text = `🔔 ถึงคิวแล้ว!\n\nคิวหมายเลข: A${data.queueNumber}\nแพทย์: ${data.doctorName}`;
  if (data.roomNumber) {
    text += `\nห้องตรวจ: ${data.roomNumber}`;
  }
  text += `\n\nกรุณาเข้าห้องตรวจด้วยครับ/ค่ะ`;

  return {
    type: 'text',
    text,
  };
}

function createReminderNotification(data: {
  doctorName: string;
  date: string;
  time: string;
  symptoms?: string;
}): Message {
  return {
    type: 'text',
    text: `⏰ แจ้งเตือนนัดหมาย\n\n` +
      `วันพรุ่งนี้: ${formatDateTh(data.date)}\n` +
      `เวลา: ${data.time}\n` +
      `แพทย์: ${data.doctorName}\n` +
      (data.symptoms ? `หมายเหตุ: ${data.symptoms}\n` : '') +
      `\nหากไม่สามารถมาตามนัดได้ กรุณาแจ้งล่วงหน้า`,
  };
}

function createBroadcastNotification(clinicName: string, message: string): Message {
  return {
    type: 'text',
    text: `📢 ${clinicName}\n\n${message}`,
  };
}

// =====================================================
// DATABASE OPERATIONS
// =====================================================

async function saveNotification(notification: {
  clinic_id: string;
  user_id: string;
  line_user_id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  sent_via_line: boolean;
}): Promise<void> {
  await supabase.from('notifications').insert({
    clinic_id: notification.clinic_id,
    user_id: notification.user_id,
    line_user_id: notification.line_user_id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    data: notification.data,
    is_read: false,
    sent_via_line: notification.sent_via_line,
    sent_at: new Date().toISOString(),
  });
}

async function getUserLineId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('patients')
    .select('line_user_id')
    .eq('patient_id', userId)
    .single();

  return data?.line_user_id || null;
}

async function getClinicPatientsLineIds(clinicId: string): Promise<string[]> {
  const { data } = await supabase
    .from('patients')
    .select('line_user_id')
    .eq('clinic_id', clinicId)
    .not('line_user_id', 'is', null);

  return (data || []).map(p => p.line_user_id).filter(Boolean) as string[];
}

// =====================================================
// UTILITIES
// =====================================================

function formatDateTh(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

// =====================================================
// MAIN HANDLER
// =====================================================

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return Response.json({
      success: false,
      error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' },
    }, { status: 405 });
  }

  try {
    const body = await req.json() as NotificationRequest;
    const action = new URL(req.url).searchParams.get('action') || 'send';

    switch (action) {
      case 'appointment': {
        // Send appointment confirmation
        if (!body.line_user_id && body.user_id) {
          body.line_user_id = await getUserLineId(body.user_id!);
        }

        if (!body.line_user_id) {
          return Response.json({
            success: false,
            error: { message: 'LINE user ID not found', code: 'NO_LINE_ID' },
          }, { status: 404 });
        }

        const message = createAppointmentNotification(body.data as any);
        const sent = await pushMessage(body.line_user_id, [message]);

        await saveNotification({
          clinic_id: body.clinic_id || '',
          user_id: body.user_id || '',
          line_user_id: body.line_user_id,
          type: body.type,
          title: body.title,
          message: body.message,
          data: body.data,
          sent_via_line: sent,
        });

        return Response.json({ success: sent });
      }

      case 'queue': {
        // Send queue update
        if (!body.line_user_id && body.user_id) {
          body.line_user_id = await getUserLineId(body.user_id!);
        }

        if (!body.line_user_id) {
          return Response.json({
            success: false,
            error: { message: 'LINE user ID not found', code: 'NO_LINE_ID' },
          }, { status: 404 });
        }

        const message = createQueueNotification(body.data as any);
        const sent = await pushMessage(body.line_user_id, [message]);

        await saveNotification({
          clinic_id: body.clinic_id || '',
          user_id: body.user_id || '',
          line_user_id: body.line_user_id,
          type: body.type,
          title: body.title,
          message: body.message,
          data: body.data,
          sent_via_line: sent,
        });

        return Response.json({ success: sent });
      }

      case 'queue-called': {
        // Send queue called notification
        if (!body.line_user_id && body.user_id) {
          body.line_user_id = await getUserLineId(body.user_id!);
        }

        if (!body.line_user_id) {
          return Response.json({
            success: false,
            error: { message: 'LINE user ID not found', code: 'NO_LINE_ID' },
          }, { status: 404 });
        }

        const message = createQueueCalledNotification(body.data as any);
        const sent = await pushMessage(body.line_user_id, [message]);

        await saveNotification({
          clinic_id: body.clinic_id || '',
          user_id: body.user_id || '',
          line_user_id: body.line_user_id,
          type: body.type,
          title: body.title,
          message: body.message,
          data: body.data,
          sent_via_line: sent,
        });

        return Response.json({ success: sent });
      }

      case 'reminder': {
        // Send appointment reminder
        if (!body.line_user_id && body.user_id) {
          body.line_user_id = await getUserLineId(body.user_id!);
        }

        if (!body.line_user_id) {
          return Response.json({
            success: false,
            error: { message: 'LINE user ID not found', code: 'NO_LINE_ID' },
          }, { status: 404 });
        }

        const message = createReminderNotification(body.data as any);
        const sent = await pushMessage(body.line_user_id, [message]);

        await saveNotification({
          clinic_id: body.clinic_id || '',
          user_id: body.user_id || '',
          line_user_id: body.line_user_id,
          type: body.type,
          title: body.title,
          message: body.message,
          data: body.data,
          sent_via_line: sent,
        });

        return Response.json({ success: sent });
      }

      case 'broadcast': {
        // Send broadcast to all clinic patients
        if (!body.clinic_id) {
          return Response.json({
            success: false,
            error: { message: 'clinic_id required for broadcast', code: 'MISSING_CLINIC_ID' },
          }, { status: 400 });
        }

        const lineUserIds = await getClinicPatientsLineIds(body.clinic_id);

        if (lineUserIds.length === 0) {
          return Response.json({
            success: false,
            error: { message: 'No patients with LINE ID found', code: 'NO_RECIPIENTS' },
          }, { status: 404 });
        }

        const message = createBroadcastNotification(body.data?.clinicName as string || 'คลินิก', body.message);
        const sent = await multicastMessage(lineUserIds, [message]);

        // Save notifications for each recipient
        for (const lineUserId of lineUserIds) {
          await saveNotification({
            clinic_id: body.clinic_id,
            user_id: '', // Would need lookup for each
            line_user_id: lineUserId,
            type: 'broadcast',
            title: body.title,
            message: body.message,
            data: body.data,
            sent_via_line: sent,
          });
        }

        return Response.json({
          success: sent,
          data: {
            recipientCount: lineUserIds.length,
          },
        });
      }

      case 'custom': {
        // Send custom message
        if (!body.line_user_id && body.user_id) {
          body.line_user_id = await getUserLineId(body.user_id!);
        }

        if (!body.line_user_id) {
          return Response.json({
            success: false,
            error: { message: 'LINE user ID not found', code: 'NO_LINE_ID' },
          }, { status: 404 });
        }

        const message: Message = { type: 'text', text: body.message };
        const sent = await pushMessage(body.line_user_id, [message]);

        await saveNotification({
          clinic_id: body.clinic_id || '',
          user_id: body.user_id || '',
          line_user_id: body.line_user_id,
          type: body.type,
          title: body.title,
          message: body.message,
          data: body.data,
          sent_via_line: sent,
        });

        return Response.json({ success: sent });
      }

      default:
        return Response.json({
          success: false,
          error: { message: 'Invalid action', code: 'INVALID_ACTION' },
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in send-notification function:', error);
    return Response.json({
      success: false,
      error: { message: 'Internal server error', code: 'INTERNAL_ERROR' },
    }, { status: 500 });
  }
});
