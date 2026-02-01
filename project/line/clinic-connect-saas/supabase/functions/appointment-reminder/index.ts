// =====================================================
// SUPABASE EDGE FUNCTION - APPOINTMENT REMINDER (CRON)
// Sends appointment reminders to patients
// Scheduled: Every day at 08:00 and 17:00
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

interface AppointmentReminder {
  appointment_id: string;
  patient_id: string;
  line_user_id?: string;
  phone?: string;
  patient_name: string;
  doctor_name: string;
  appointment_date: string;
  appointment_time: string;
  symptoms?: string;
  clinic_name?: string;
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

async function sendLINEReminder(lineUserId: string, appointment: AppointmentReminder): Promise<boolean> {
  const date = new Date(appointment.appointment_date);
  const isTomorrow = isNextDay(date);
  const dayName = date.toLocaleDateString('th-TH', { weekday: 'long' });
  const dateFormatted = date.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  let message = '';

  if (isTomorrow) {
    message = `⏰ แจ้งเตือนนัดหมายวันพรุ่งนี้\n\n`;
  } else {
    message = `⏰ แจ้งเตือนนัดหมาย\n\n`;
  }

  message += `📅 วัน${dayName}ที่ ${dateFormatted}\n`;
  message += `⏰ เวลา: ${appointment.appointment_time}\n`;
  message += `👨‍⚕️ แพทย์: ${appointment.doctor_name}\n`;

  if (appointment.symptoms) {
    message += `📝 หมายเหตุ: ${appointment.symptoms}\n`;
  }

  message += `\nกรุณามาตามนัด 15 นาทีล่วงหน้า`;
  message += `\nหากไม่สามารถมาได้ กรุณาแจ้งล่วงหน้าด้วยครับ/ค่ะ`;

  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: lineUserId,
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

async function sendSMSReminder(phone: string, appointment: AppointmentReminder): Promise<boolean> {
  // TODO: Integrate with SMS gateway (e.g., AIS, TRUE, dtac)
  // For now, just log
  console.log(`SMS reminder would be sent to ${phone}`);
  return true;
}

function isNextDay(date: Date): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);

  return checkDate.getTime() === tomorrow.getTime();
}

function isToday(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);

  return checkDate.getTime() === today.getTime();
}

// =====================================================
// APPOINTMENT QUERIES
// =====================================================

async function getAppointmentsForReminder(): Promise<AppointmentReminder[]> {
  // Get appointments for tomorrow and today (afternoon check)
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayStr = today.toISOString().split('T')[0];
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const hour = today.getHours();

  let dateFilter: string[] = [];

  // Morning run (08:00) - remind for tomorrow
  if (hour < 12) {
    dateFilter = [tomorrowStr];
  }
  // Afternoon run (17:00) - remind for tomorrow AND today's evening appointments
  else {
    dateFilter = [tomorrowStr, todayStr];
  }

  const { data, error } = await supabase
    .from('appointments')
    .select(`
      appointment_id,
      patient_id,
      appointment_date,
      appointment_time,
      symptoms,
      patient:patients(name, phone, line_user_id),
      doctor:doctors(name),
      clinic:clinics(name)
    `)
    .in('appointment_date', dateFilter)
    .in('status', ['pending', 'confirmed'])
    .gte('appointment_time', hour >= 12 ? '17:00' : '00:00')
    .order('appointment_date')
    .order('appointment_time');

  if (error) {
    console.error('Error fetching appointments:', error);
    return [];
  }

  return (data || []).map(a => ({
    appointment_id: a.appointment_id,
    patient_id: a.patient_id,
    line_user_id: (a.patient as any)?.line_user_id,
    phone: (a.patient as any)?.phone,
    patient_name: (a.patient as any)?.name || 'คนไข้',
    doctor_name: (a.doctor as any)?.name || 'แพทย์',
    appointment_date: a.appointment_date,
    appointment_time: a.appointment_time,
    symptoms: a.symptoms,
    clinic_name: (a.clinic as any)?.name,
  }));
}

// =====================================================
// REMINDER LOGGING
// =====================================================

async function logReminder(
  appointmentId: string,
  channel: 'line' | 'sms',
  success: boolean,
  error?: string
): Promise<void> {
  await supabase.from('appointment_reminders').insert({
    appointment_id: appointmentId,
    reminder_type: 'appointment',
    sent_via: channel,
    sent_at: new Date().toISOString(),
    status: success ? 'sent' : 'failed',
    error_message: error,
  });
}

async function updateLastReminder(appointmentId: string): Promise<void> {
  await supabase
    .from('appointments')
    .update({ last_reminder_at: new Date().toISOString() })
    .eq('appointment_id', appointmentId);
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

  console.log('Starting appointment reminder cron job...');

  const now = new Date();
  const hour = now.getHours();
  const timeLabel = hour < 12 ? '08:00' : '17:00';

  // Get appointments that need reminders
  const appointments = await getAppointmentsForReminder();

  console.log(`Found ${appointments.length} appointments for reminder at ${timeLabel}`);

  const results = {
    total: appointments.length,
    lineSent: 0,
    lineFailed: 0,
    smsSent: 0,
    smsFailed: 0,
    skipped: 0,
  };

  for (const appointment of appointments) {
    const appointmentDate = new Date(appointment.appointment_date);
    const isTodayAppointment = isToday(appointmentDate);

    // Skip today's appointments for morning reminder
    if (hour < 12 && isTodayAppointment) {
      results.skipped++;
      continue;
    }

    let sent = false;

    // Try LINE first
    if (appointment.line_user_id) {
      const success = await sendLINEReminder(appointment.line_user_id, appointment);

      if (success) {
        results.lineSent++;
        sent = true;
        await logReminder(appointment.appointment_id, 'line', true);
        await updateLastReminder(appointment.appointment_id);
      } else {
        results.lineFailed++;
        await logReminder(appointment.appointment_id, 'line', false, 'LINE API error');
      }
    }

    // Fallback to SMS if LINE failed and phone is available
    if (!sent && appointment.phone) {
      const success = await sendSMSReminder(appointment.phone, appointment);

      if (success) {
        results.smsSent++;
        await logReminder(appointment.appointment_id, 'sms', true);
        await updateLastReminder(appointment.appointment_id);
      } else {
        results.smsFailed++;
        await logReminder(appointment.appointment_id, 'sms', false, 'SMS API error');
      }
    }

    // No contact method available
    if (!sent && !appointment.line_user_id && !appointment.phone) {
      await logReminder(appointment.appointment_id, 'line', false, 'No contact method');
      console.log(`No contact method for appointment ${appointment.appointment_id}`);
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('Appointment reminder cron job completed:', results);

  return Response.json({
    success: true,
    time: timeLabel,
    date: now.toISOString().split('T')[0],
    results,
  });
});
