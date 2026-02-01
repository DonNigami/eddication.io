// =====================================================
// SUPABASE EDGE FUNCTION - QUEUE REMINDER (CRON)
// Sends queue position reminders to waiting patients
// Scheduled: Every 15 minutes
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

interface QueueReminder {
  appointment_id: string;
  patient_id: string;
  line_user_id?: string;
  patient_name: string;
  queue_number: number;
  doctor_name: string;
  current_queue: number;
  estimated_wait_time: number;
  clinic_id: string;
  last_notified?: string;
}

interface ReminderResult {
  appointment_id: string;
  sent: boolean;
  channel: 'line' | 'none';
  error?: string;
}

// =====================================================
// CRON VERIFICATION
// =====================================================

function verifyCronSecret(req: Request): boolean {
  const authHeader = req.headers.get('Authorization');
  const providedSecret = authHeader?.replace('Bearer ', '');
  const cronSecret = Deno.env.get('CRON_SECRET');

  if (!cronSecret) {
    console.warn('CRON_SECRET not set, skipping verification');
    return true;
  }

  return providedSecret === cronSecret;
}

// =====================================================
// NOTIFICATION HELPERS
// =====================================================

async function sendQueueReminder(reminder: QueueReminder): Promise<boolean> {
  const message = `🔔 อัปเดตคิว\n\n` +
    `คิวหมายเลข: A${reminder.queue_number}\n` +
    `แพทย์: ${reminder.doctor_name}\n` +
    `คิวปัจจุบัน: A${reminder.current_queue}\n` +
    `ค่อยอีกประมาณ ${reminder.estimated_wait_time} นาที\n\n` +
    `กรุณาอยู่ในบริเวณคลินิกด้วยครับ/ค่ะ`;

  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: reminder.line_user_id,
        messages: [{ type: 'text', text: message }],
      }),
    });

    if (!response.ok) {
      console.error('LINE reminder failed:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('LINE reminder error:', error);
    return false;
  }
}

async function updateLastNotified(appointmentId: string): Promise<void> {
  await supabase
    .from('appointments')
    .update({ last_queue_notified: new Date().toISOString() })
    .eq('appointment_id', appointmentId);
}

// =====================================================
// QUEUE DATA FETCHING
// =====================================================

async function getWaitingPatientsNeedingReminder(): Promise<QueueReminder[]> {
  const today = new Date().toISOString().split('T')[0];

  // Get queue status for all active clinics
  const { data: queueStatus } = await supabase
    .from('queue_management')
    .select('*')
    .eq('date', today)
    .gt('current_queue', 0);

  if (!queueStatus || queueStatus.length === 0) {
    return [];
  }

  const reminders: QueueReminder[] = [];

  for (const queue of queueStatus) {
    // Get waiting patients for this doctor
    const { data: appointments } = await supabase
      .from('appointments')
      .select(`
        appointment_id,
        patient_id,
        queue_number,
        last_queue_notified,
        patient:patients(name, line_user_id),
        doctor:doctors(name),
        clinic_id
      `)
      .eq('doctor_id', queue.doctor_id)
      .eq('appointment_date', today)
      .eq('status', 'confirmed')
      .order('queue_number');

    if (!appointments || appointments.length === 0) {
      continue;
    }

    for (const appt of appointments || []) {
      // Check if patient needs reminder (hasn't been notified in last 30 minutes)
      const now = new Date();
      const lastNotified = appt.last_queue_notified ? new Date(appt.last_queue_notified) : null;
      const minutesSinceLastNotify = lastNotified
        ? (now.getTime() - lastNotified.getTime()) / (1000 * 60)
        : 999; // Never notified

      // Notify if:
      // 1. Never notified, OR
      // 2. Last notified more than 30 minutes ago, OR
      // 3. Current queue is within 3 positions of patient's queue
      const queueAhead = queue.current_queue - (appt.queue_number || 0);

      const needsReminder =
        minutesSinceLastNotify >= 30 ||
        (queueAhead >= 0 && queueAhead <= 3);

      if (!needsReminder) {
        continue;
      }

      reminders.push({
        appointment_id: appt.appointment_id,
        patient_id: appt.patient_id,
        line_user_id: (appt.patient as any)?.line_user_id,
        patient_name: (appt.patient as any)?.name || 'คนไข้',
        queue_number: appt.queue_number || 0,
        doctor_name: (appt.doctor as any)?.name || 'แพทย์',
        current_queue: queue.current_queue,
        estimated_wait_time: queue.estimated_wait_time,
        clinic_id: appt.clinic_id,
        last_notified: appt.last_queue_notified,
      });
    }
  }

  return reminders;
}

async function logReminder(
  appointmentId: string,
  channel: 'line' | 'none',
  success: boolean,
  error?: string
): Promise<void> {
  await supabase.from('queue_reminders').insert({
    appointment_id: appointmentId,
    sent_via: channel,
    sent_at: new Date().toISOString(),
    status: success ? 'sent' : 'failed',
    error_message: error,
  });
}

// =====================================================
// MAIN HANDLER
// =====================================================

serve(async (req) => {
  // Verify cron secret
  if (!verifyCronSecret(req)) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Only allow POST from cron
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  console.log('Starting queue reminder cron job...');

  const now = new Date();
  const timeLabel = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Get patients who need reminders
  const reminders = await getWaitingPatientsNeedingReminder();

  console.log(`Found ${reminders.length} patients needing queue reminders at ${timeLabel}`);

  const results = {
    time: timeLabel,
    date: now.toISOString().split('T')[0],
    total: reminders.length,
    sent: 0,
    failed: 0,
    no_line: 0,
    details: [] as ReminderResult[],
  };

  for (const reminder of reminders) {
    let sent = false;
    let channel: 'line' | 'none' = 'none';
    let error: string | undefined;

    if (reminder.line_user_id) {
      sent = await sendQueueReminder(reminder);
      channel = 'line';

      if (sent) {
        results.sent++;
        await updateLastNotified(reminder.appointment_id);
        await logReminder(reminder.appointment_id, 'line', true);
      } else {
        results.failed++;
        error = 'LINE API error';
        await logReminder(reminder.appointment_id, 'line', false, error);
      }
    } else {
      results.no_line++;
      await logReminder(reminder.appointment_id, 'none', false, 'No LINE ID');
    }

    results.details.push({
      appointment_id: reminder.appointment_id,
      sent,
      channel,
      error,
    });

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('Queue reminder cron job completed:', results);

  return Response.json({
    success: true,
    time: timeLabel,
    date: now.toISOString().split('T')[0],
    results,
  });
});
