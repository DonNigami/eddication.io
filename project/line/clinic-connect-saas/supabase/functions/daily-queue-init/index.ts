// =====================================================
// SUPABASE EDGE FUNCTION - DAILY QUEUE INIT (CRON)
// Initialize queue management for each doctor daily
// Scheduled: Every day at 00:01
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// =====================================================
// CONFIG & TYPES
// =====================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface Doctor {
  doctor_id: string;
  clinic_id: string;
  name: string;
  is_available: boolean;
}

interface QueueInitialization {
  doctor_id: string;
  clinic_id: string;
  date: string;
  status: 'success' | 'skipped' | 'failed';
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
// QUEUE INITIALIZATION
// =====================================================

async function initializeDoctorQueue(doctor: Doctor, date: string): Promise<QueueInitialization> {
  // Check if doctor is available
  if (!doctor.is_available) {
    return {
      doctor_id: doctor.doctor_id,
      clinic_id: doctor.clinic_id,
      date,
      status: 'skipped',
      error: 'Doctor not available',
    };
  }

  // Check if queue already exists
  const { data: existing } = await supabase
    .from('queue_management')
    .select('queue_id')
    .eq('doctor_id', doctor.doctor_id)
    .eq('date', date)
    .maybeSingle();

  if (existing) {
    return {
      doctor_id: doctor.doctor_id,
      clinic_id: doctor.clinic_id,
      date,
      status: 'skipped',
      error: 'Queue already exists',
    };
  }

  // Get appointment count for the day
  const { count } = await supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .eq('doctor_id', doctor.doctor_id)
    .eq('appointment_date', date)
    .in('status', ['confirmed', 'pending']);

  // Create queue management entry
  const { error } = await supabase
    .from('queue_management')
    .insert({
      clinic_id: doctor.clinic_id,
      doctor_id: doctor.doctor_id,
      date: date,
      current_queue: 0,
      waiting_count: count || 0,
      in_consultation_count: 0,
      completed_count: 0,
      estimated_wait_time: 0,
      last_updated: new Date().toISOString(),
    });

  if (error) {
    return {
      doctor_id: doctor.doctor_id,
      clinic_id: doctor.clinic_id,
      date,
      status: 'failed',
      error: error.message,
    };
  }

  return {
    doctor_id: doctor.doctor_id,
    clinic_id: doctor.clinic_id,
    date,
    status: 'success',
  };
}

async function getAppointmentsCount(date: string): Promise<number> {
  const { count } = await supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .eq('appointment_date', date)
    .in('status', ['pending', 'confirmed']);

  return count || 0;
}

async function getDoctorsWithClinics(): Promise<Doctor[]> {
  const { data, error } = await supabase
    .from('doctors')
    .select('doctor_id, clinic_id, name, is_available')
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching doctors:', error);
    return [];
  }

  return data || [];
}

// =====================================================
// CLEANUP OLD QUEUE DATA
// =====================================================

async function cleanupOldQueues(daysToKeep = 90): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

  const { error } = await supabase
    .from('queue_management')
    .delete()
    .lt('date', cutoffDateStr);

  if (error) {
    console.error('Error cleaning up old queues:', error);
    return 0;
  }

  return 1; // Success
}

// =====================================================
// SLOT GENERATION
// =====================================================

async function generateDailySlots(date: string): Promise<number> {
  // Get all available doctors
  const { data: doctors } = await supabase
    .from('doctors')
    .select('doctor_id, clinic_id')
    .eq('is_active', true)
    .eq('is_available', true);

  if (!doctors || doctors.length === 0) {
    return 0;
  }

  let slotsCreated = 0;

  for (const doctor of doctors) {
    // Get doctor's schedule
    const { data: schedule } = await supabase
      .from('doctor_schedules')
      .select('*')
      .eq('doctor_id', doctor.doctor_id)
      .eq('day_of_week', new Date(date).getDay())
      .maybeSingle();

    if (!schedule || !schedule.is_available) {
      continue;
    }

    // Check if slots already exist
    const { data: existingSlots } = await supabase
      .from('appointment_slots')
      .select('slot_id')
      .eq('doctor_id', doctor.doctor_id)
      .eq('date', date)
      .limit(1);

    if (existingSlots && existingSlots.length > 0) {
      continue; // Slots already generated
    }

    // Generate time slots based on schedule
    const startTime = schedule.start_time; // e.g., '09:00'
    const endTime = schedule.end_time; // e.g., '17:00'
    const slotDuration = schedule.slot_duration || 30; // minutes

    slotsCreated += await generateTimeSlots(
      doctor.doctor_id,
      doctor.clinic_id,
      date,
      startTime,
      endTime,
      slotDuration
    );
  }

  return slotsCreated;
}

async function generateTimeSlots(
  doctorId: string,
  clinicId: string,
  date: string,
  startTime: string,
  endTime: string,
  durationMinutes: number
): Promise<number> {
  const slots = [];
  let [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const endTimeMinutes = endHour * 60 + endMin;

  while (true) {
    const currentMinutes = startHour * 60 + startMin;

    if (currentMinutes + durationMinutes > endTimeMinutes) {
      break;
    }

    const slotTime = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
    const endSlotMinutes = currentMinutes + durationMinutes;
    const endSlotTime = `${String(Math.floor(endSlotMinutes / 60)).padStart(2, '0')}:${String(endSlotMinutes % 60).padStart(2, '0')}`;

    slots.push({
      doctor_id: doctorId,
      clinic_id: clinicId,
      date: date,
      start_time: slotTime,
      end_time: endSlotTime,
      is_available: true,
      appointment_id: null,
    });

    // Move to next slot
    startMin += durationMinutes;
    while (startMin >= 60) {
      startMin -= 60;
      startHour++;
    }
  }

  if (slots.length === 0) {
    return 0;
  }

  const { error } = await supabase
    .from('appointment_slots')
    .insert(slots);

  if (error) {
    console.error('Error generating slots:', error);
    return 0;
  }

  return slots.length;
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

  console.log('Starting daily queue initialization cron job...');

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // Get all active doctors
  const doctors = await getDoctorsWithClinics();

  console.log(`Found ${doctors.length} active doctors`);

  // Initialize queues for today and tomorrow
  const results = {
    date: today,
    todayQueues: [] as QueueInitialization[],
    tomorrowQueues: [] as QueueInitialization[],
    slotsCreated: 0,
    cleanupResult: '',
  };

  // Initialize today's queues
  for (const doctor of doctors) {
    const result = await initializeDoctorQueue(doctor, today);
    results.todayQueues.push(result);
  }

  // Initialize tomorrow's queues
  for (const doctor of doctors) {
    const result = await initializeDoctorQueue(doctor, tomorrowStr);
    results.tomorrowQueues.push(result);
  }

  // Generate slots for tomorrow
  const slotsCreated = await generateDailySlots(tomorrowStr);
  results.slotsCreated = slotsCreated;

  // Cleanup old data (weekly)
  const dayOfWeek = new Date().getDay();
  if (dayOfWeek === 0) { // Sunday
    const cleanupResult = await cleanupOldQueues(90);
    results.cleanupResult = 'Cleanup completed';
  }

  // Summary
  const todaySuccess = results.todayQueues.filter(r => r.status === 'success').length;
  const todaySkipped = results.todayQueues.filter(r => r.status === 'skipped').length;
  const todayFailed = results.todayQueues.filter(r => r.status === 'failed').length;

  const tomorrowSuccess = results.tomorrowQueues.filter(r => r.status === 'success').length;
  const tomorrowSkipped = results.tomorrowQueues.filter(r => r.status === 'skipped').length;
  const tomorrowFailed = results.tomorrowQueues.filter(r => r.status === 'failed').length;

  console.log('Daily queue initialization completed:', {
    today: { success: todaySuccess, skipped: todaySkipped, failed: todayFailed },
    tomorrow: { success: tomorrowSuccess, skipped: tomorrowSkipped, failed: tomorrowFailed },
    slotsCreated,
  });

  return Response.json({
    success: true,
    date: today,
    summary: {
      today: { success: todaySuccess, skipped: todaySkipped, failed: todayFailed },
      tomorrow: { success: tomorrowSuccess, skipped: tomorrowSkipped, failed: tomorrowFailed },
      slotsCreated,
      cleanup: results.cleanupResult,
    },
    results,
  });
});
