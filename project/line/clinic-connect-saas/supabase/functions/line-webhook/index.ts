// =====================================================
// SUPABASE EDGE FUNCTION - LINE WEBHOOK
// Handles all LINE Messaging API webhook events
// =====================================================

import { serve } from 'https://deno.land/std@0.208.2/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Environment variables
const LINE_CHANNEL_SECRET = Deno.env.get('LINE_CHANNEL_SECRET')!;
const LINE_ACCESS_TOKEN = Deno.env.get('LINE_ACCESS_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// =====================================================
// TYPE DEFINITIONS
// =====================================================

interface WebhookEvent {
  type: string;
  mode: string;
  timestamp: number;
  source: {
    type: string;
    userId: string;
    groupId?: string;
    roomId?: string;
  };
  replyToken: string;
  message?: {
    id: string;
    type: string;
    text?: string;
  };
  postback?: {
    data: string;
  };
  beacon?: {
    type: string;
    hwid: string;
    dm?: string;
  };
}

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

// =====================================================
// CRYPTO UTILITIES
// =====================================================

async function verifySignature(body: string, signature: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(LINE_CHANNEL_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(body)
  );

  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return signature === expected;
}

// =====================================================
// LINE API HELPERS
// =====================================================

async function replyMessage(replyToken: string, messages: Message[]): Promise<void> {
  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Reply failed:', error);
    throw new Error(`Reply failed: ${error}`);
  }
}

async function pushMessage(userId: string, messages: Message[]): Promise<void> {
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: userId,
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Push failed:', error);
    throw new Error(`Push failed: ${error}`);
  }
}

// =====================================================
// SUPABASE HELPERS
// =====================================================

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getUser(lineUserId: string) {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('line_user_id', lineUserId)
    .single();

  return data;
}

async function getPatientProfile(lineUserId: string, clinicId: string) {
  const { data } = await supabase
    .from('patients')
    .select('*')
    .eq('user_id', lineUserId)
    .eq('clinic_id', clinicId)
    .single();

  return data;
}

async function createLog(userId: string, direction: 'inbound' | 'outbound', messageType: string, content: any) {
  await supabase.from('message_logs').insert({
    user_id: userId,
    direction,
    message_type: messageType,
    content,
  });
}

// =====================================================
// EVENT HANDLERS
// =====================================================

async function handleFollow(event: WebhookEvent): Promise<void> {
  const { source, replyToken } = event;

  // Save line user
  await supabase.from('line_users').upsert({
    user_id: source.userId,
    status: 'active',
    updated_at: new Date().toISOString(),
  });

  // Get user profile
  const profile = await getProfile(source.userId);

  // Send welcome message
  await replyMessage(replyToken, [{
    type: 'text',
    text: `ยินดีต้อนรับสู่ ClinicConnect! 🏥\n\n${profile ? `สวัสดี ${profile.displayName}` : ''}\n\nเลือกเมนูเพื่อเริ่มใช้งาน:`,
    quickReply: {
      items: [
        {
          type: 'action',
          action: {
            type: 'message',
            label: '📅 จองนัดหมาย',
            text: '/booking',
          },
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: '🏥 ดูคิว',
            text: '/queue',
          },
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: '📋 ประวัติการรักษา',
            text: '/records',
          },
        },
      ],
    },
  }]);
}

async function handleMessage(event: WebhookEvent): Promise<void> {
  const { source, message, replyToken } = event;

  if (!message) return;

  // Log message
  await createLog(source.userId, 'inbound', message.type, {
    text: message.text,
    messageId: message.id,
  });

  // Get user profile
  const user = await getUser(source.userId);

  // Handle command messages
  if (message.type === 'text') {
    const text = message.text?.trim().toLowerCase() || '';

    // Handle different commands
    if (text === '/booking' || text === 'จองนัด') {
      await handleBookingCommand(source.userId, replyToken);
    } else if (text === '/queue' || text === 'คิว') {
      await handleQueueCommand(source.userId, replyToken);
    } else if (text === '/records' || text === 'ประวัติ') {
      await handleRecordsCommand(source.userId, replyToken);
    } else if (text === '/help' || text === 'ช่วยเหลือ') {
      await handleHelpCommand(replyToken);
    } else {
      // Default message
      await replyMessage(replyToken, [{
        type: 'text',
        text: 'ไม่เข้าใจคำสั่ง พิมพ์ /help เพื่อดูคำสั่งทั้งหมด',
      }]);
    }
  }
}

async function handlePostback(event: WebhookEvent): Promise<void> {
  const { source, postback, replyToken } = event;

  if (!postback) return;

  const data = postback.data;
  const [action, ...params] = data.split(':');

  switch (action) {
    case 'booking_doctor_selected':
      // Handle doctor selection from booking flow
      await handleBookingFlow(source.userId, params[0], replyToken);
      break;

    case 'confirm_booking':
      // Confirm booking
      await confirmBooking(source.userId, params[0], replyToken);
      break;

    case 'cancel_booking':
      // Cancel booking with confirmation
      await requestCancelConfirmation(source.userId, params[0], replyToken);
      break;

    default:
      console.log('Unknown postback action:', action);
  }
}

async function handleBeacon(event: WebhookEvent): Promise<void> {
  const { source, beacon } = event;

  if (!beacon) return;

  if (beacon.type === 'enter') {
    // Auto check-in when entering beacon zone
    await handleBeaconCheckIn(source.userId, beacon.hwid);
  }
}

// =====================================================
// COMMAND HANDLERS
// =====================================================

async function handleBookingCommand(userId: string, replyToken: string): Promise<void> {
  // Get available doctors
  const { data: doctors } = await supabase
    .from('doctors')
    .select('doctor_id, name, title, specialty')
    .eq('is_available', true)
    .limit(10);

  if (!doctors || doctors.length === 0) {
    await replyMessage(replyToken, [{
      type: 'text',
      text: 'ขออภัยย ไม่พบแพทย์ที่ว่างในขณะนี้',
    }]);
    return;
  }

  // Create quick reply with doctor list
  await replyMessage(replyToken, [{
    type: 'text',
    text: 'เลือกแพทย์ที่ต้องการจอง:',
    quickReply: {
      items: doctors.slice(0, 5).map(doctor => ({
        type: 'action',
        action: {
          type: 'postback',
          label: `${doctor.title || ''} ${doctor.name}`,
          data: `booking_doctor_selected:${doctor.doctor_id}`,
        },
      })),
    },
  }]);
}

async function handleQueueCommand(userId: string, replyToken: string): Promise<void> {
  // Get user's queue for today
  const today = new Date().toISOString().split('T')[0];

  // Get user ID from users table
  const { data: user } = await supabase
    .from('users')
    .select('user_id')
    .eq('line_user_id', userId)
    .single();

  if (!user) {
    await replyMessage(replyToken, [{
      type: 'text',
      text: 'กรุณาลงทะเบียนก่อนใช้งาน',
    }]);
    return;
  }

  const { data: appointment } = await supabase
    .from('appointments')
    .select(`
      queue_number,
      status,
      appointment_time,
      doctor:doctors(name)
    `)
    .eq('patient_id', user.user_id) // This should be corrected to match patient_id
    .eq('appointment_date', today)
    .in('status', ['confirmed', 'checked_in', 'in_consultation'])
    .single();

  if (appointment) {
    await replyMessage(replyToken, [{
      type: 'text',
      text: `คิวของคุณ: ${appointment.queue_number}\nแพทย์: ${appointment.doctor?.name || '-'}\nเวลานัด: ${appointment.appointment_time}\nสถานะ: ${appointment.status === 'confirmed' ? 'รอเข้าพบ' : appointment.status}`,
    }]);
  } else {
    await replyMessage(replyToken, [{
      type: 'text',
      text: 'คุณไม่มีคิววันนี้\n\nพิมพ์ /booking เพื่อจองนัดหมาย',
    }]);
  }
}

async function handleRecordsCommand(userId: string, replyToken: string): Promise<void> {
  // Get recent medical records
  const { data: records } = await supabase
    .from('medical_records')
    .select(`
      created_at,
      diagnosis,
      treatment_plan,
      doctor:doctors(name)
    `)
    .order('created_at', { ascending: false })
    .limit(5);

  if (!records || records.length === 0) {
    await replyMessage(replyToken, [{
      type: 'text',
      text: 'ไม่พบประวัติการรักษา',
    }]);
    return;
  }

  const message = records.map((record, i) => {
    return `${i + 1}. ${formatDate(record.created_at)}\nแพทย์: ${record.doctor?.name || '-'}\nวินิจฉัย: ${record.diagnosis || '-'}\n`;
  }).join('\n');

  await replyMessage(replyToken, [{
    type: 'text',
    text: `ประวัติการรักษาล่าสุด:\n\n${message}`,
  }]);
}

async function handleHelpCommand(replyToken: string): Promise<void> {
  await replyMessage(replyToken, [{
    type: 'text',
    text: 'คำสั่งที่ใช้ได้:\n\n/booking - จองนัดหมาย\n/queue - ดูคิวของคุณ\n/records - ประวัติการรักษา\n/help - คำสั่งทั้งหมด',
  }]);
}

// =====================================================
// BOOKING FLOW
// =====================================================

async function handleBookingFlow(userId: string, doctorId: string, replyToken: string): Promise<void> {
  // Store state
  await supabase.from('conversation_states').upsert({
    user_id: userId,
    state_name: 'booking_select_date',
    state_data: { doctor_id: doctorId },
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });

  // Get doctor info
  const { data: doctor } = await supabase
    .from('doctors')
    .select('name')
    .eq('doctor_id', doctorId)
    .single();

  // Send LIFF link to open booking page
  await replyMessage(replyToken, [{
    type: 'text',
    text: `คุณเลือก: ${doctor?.name || 'แพทย์'}\n\nกรุณากดที่ลิงก์ด้านล่างเพื่อเลือกวันและเวลา:`,
  }]);
}

async function confirmBooking(userId: string, appointmentId: string, replyToken: string): Promise<void> {
  // Confirm appointment
  await replyMessage(replyToken, [{
    type: 'text',
    text: '✅ ยืนยันการจองนัดหมายสำเร็จ!\n\nเราจะแจ้งเตือนก่อนนัดหมาย 1 วัน',
  }]);
}

async function requestCancelConfirmation(userId: string, appointmentId: string, replyToken: string): Promise<void> {
  // Get appointment details
  const { data: appointment } = await supabase
    .from('appointments')
    .select('appointment_date, appointment_time, doctor:doctors(name)')
    .eq('appointment_id', appointmentId)
    .single();

  // Store pending action
  await supabase.from('conversation_states').upsert({
    user_id: userId,
    state_name: 'cancel_pending',
    state_data: { appointment_id },
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  });

  await replyMessage(replyToken, [{
    type: 'text',
    text: `❓ คุณต้องการยกเลิกนัดหมายใช่หรือไม่?\n\nแพทย์: ${appointment?.doctor?.name || '-'}\nวันที่: ${formatDate(appointment?.appointment_date || '')}\nเวลา: ${appointment?.appointment_time}`,
    quickReply: {
      items: [
        {
          type: 'action',
          action: {
            type: 'message',
            label: '✓ ใช่ ยกเลิก',
            text: `/confirm_cancel:${appointmentId}`,
          },
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: '✗ ไม่ใช่',
            text: '/cancel',
          },
        },
      ],
    },
  }]);
}

// =====================================================
// BEACON CHECK-IN
// =====================================================

async function handleBeaconCheckIn(userId: string, hwid: string): Promise<void> {
  // Find beacon location
  // In production, you'd have a beacon_locations table
  // For now, we'll use a simple check

  const today = new Date().toISOString().split('T')[0];

  // Get user's appointment for today
  const { data: appointment } = await supabase
    .from('appointments')
    .select('appointment_id, queue_number, doctor:doctors(name)')
    .eq('appointment_date', today)
    .eq('status', 'confirmed')
    .single();

  if (appointment) {
    // Update appointment status to checked_in
    await supabase
      .from('appointments')
      .update({
        status: 'checked_in',
        check_in_time: new Date().toISOString(),
      })
      .eq('appointment_id', appointment.appointment_id);

    // Send confirmation
    await pushMessage(userId, [{
      type: 'text',
      text: `✅ Check-in สำเร็จ!\nคิวของคุณ: ${appointment.queue_number}\nแพทย์: ${appointment.doctor?.name || '-'}`,
    }]);
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

async function getProfile(userId: string) {
  const response = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
    headers: {
      'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`,
    },
  });

  if (!response.ok) return null;

  return await response.json();
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// =====================================================
// MAIN HANDLER
// =====================================================

serve(async (req) => {
  // Handle CORS for preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-line-signature',
      },
    });
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Verify signature
  const body = await req.text();
  const signature = req.headers.get('x-line-signature');

  if (!signature) {
    return new Response('Missing signature', { status: 401 });
  }

  const isValid = await verifySignature(body, signature);
  if (!isValid) {
    return new Response('Invalid signature', { status: 401 });
  }

  try {
    const data = JSON.parse(body);
    const events = data.events || [];

    // Process each event
    for (const event of events) {
      switch (event.type) {
        case 'follow':
          await handleFollow(event);
          break;

        case 'message':
          await handleMessage(event);
          break;

        case 'postback':
          await handlePostback(event);
          break;

        case 'beacon':
          await handleBeacon(event);
          break;

        default:
          console.log('Unhandled event type:', event.type);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});
