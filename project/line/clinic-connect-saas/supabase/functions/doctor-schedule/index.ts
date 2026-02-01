// =====================================================
// SUPABASE EDGE FUNCTION - DOCTOR SCHEDULE
// Manage doctor availability and schedules
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// =====================================================
// CONFIG & TYPES
// =====================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface DoctorSchedule {
  schedule_id?: string;
  doctor_id: string;
  clinic_id: string;
  day_of_week: number; // 0 = Sunday, 6 = Saturday
  start_time: string; // HH:MM format
  end_time: string; // HH:MM format
  slot_duration: number; // minutes
  break_start_time?: string;
  break_end_time?: string;
  max_patients?: number;
  is_available: boolean;
  notes?: string;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
  };
}

const DAY_NAMES = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

// =====================================================
// CRUD OPERATIONS
// =====================================================

// GET - Fetch schedules
async function getSchedules(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const doctorId = url.searchParams.get('doctor_id');
  const clinicId = url.searchParams.get('clinic_id');

  let query = supabase
    .from('doctor_schedules')
    .select(`
      *,
      doctor:doctors(name, title)
    `)
    .order('day_of_week')
    .order('start_time');

  if (doctorId) query = query.eq('doctor_id', doctorId);
  if (clinicId) query = query.eq('clinic_id', clinicId);

  const { data, error } = await query;

  if (error) {
    return Response.json({
      success: false,
      error: { message: error.message, code: error.code },
    }, { status: 400 });
  }

  return Response.json({ success: true, data: data || [] });
}

// GET - Fetch schedule for specific date
async function getScheduleForDate(doctorId: string, date: string): Promise<Response> {
  const dateObj = new Date(date);
  const dayOfWeek = dateObj.getDay();

  const { data, error } = await supabase
    .from('doctor_schedules')
    .select('*')
    .eq('doctor_id', doctorId)
    .eq('day_of_week', dayOfWeek)
    .single();

  if (error) {
    return Response.json({
      success: false,
      error: { message: 'Schedule not found', code: 'NOT_FOUND' },
    }, { status: 404 });
  }

  return Response.json({ success: true, data });
}

// POST - Create schedule
async function createSchedule(req: Request): Promise<Response> {
  const body = await req.json() as Partial<DoctorSchedule>[];

  // Validate
  for (const schedule of body) {
    if (!schedule.doctor_id || !schedule.clinic_id || schedule.day_of_week === undefined
        || !schedule.start_time || !schedule.end_time) {
      return Response.json({
        success: false,
        error: { message: 'Missing required fields', code: 'MISSING_FIELDS' },
      }, { status: 400 });
    }

    // Validate time format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(schedule.start_time!) || !timeRegex.test(schedule.end_time!)) {
      return Response.json({
        success: false,
        error: { message: 'Invalid time format (use HH:MM)', code: 'INVALID_TIME' },
      }, { status: 400 });
    }

    // Validate day of week
    if (schedule.day_of_week! < 0 || schedule.day_of_week! > 6) {
      return Response.json({
        success: false,
        error: { message: 'Invalid day_of_week (0-6)', code: 'INVALID_DAY' },
      }, { status: 400 });
    }
  }

  // Check for conflicts
  for (const schedule of body) {
    const { data: existing } = await supabase
      .from('doctor_schedules')
      .select('schedule_id')
      .eq('doctor_id', schedule.doctor_id!)
      .eq('day_of_week', schedule.day_of_week!)
      .maybeSingle();

    if (existing) {
      return Response.json({
        success: false,
        error: {
          message: `Schedule already exists for ${DAY_NAMES[schedule.day_of_week!]}`,
          code: 'CONFLICT'
        },
      }, { status: 409 });
    }
  }

  // Insert schedules
  const { data, error } = await supabase
    .from('doctor_schedules')
    .insert(body.map(s => ({
      doctor_id: s.doctor_id,
      clinic_id: s.clinic_id,
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      slot_duration: s.slot_duration || 30,
      break_start_time: s.break_start_time,
      break_end_time: s.break_end_time,
      max_patients: s.max_patients,
      is_available: s.is_available !== false,
      notes: s.notes,
    })))
    .select()
    .select(`
      *,
      doctor:doctors(name)
    `);

  if (error) {
    return Response.json({
      success: false,
      error: { message: error.message, code: error.code },
    }, { status: 500 });
  }

  return Response.json({ success: true, data }, { status: 201 });
}

// PATCH - Update schedule
async function updateSchedule(scheduleId: string, req: Request): Promise<Response> {
  const body = await req.json() as Partial<DoctorSchedule>;

  const updateData: Record<string, unknown> = {};

  const allowedFields = [
    'start_time', 'end_time', 'slot_duration',
    'break_start_time', 'break_end_time',
    'max_patients', 'is_available', 'notes'
  ];

  for (const field of allowedFields) {
    if (body[field as keyof DoctorSchedule] !== undefined) {
      updateData[field] = body[field as keyof DoctorSchedule];
    }
  }

  const { data, error } = await supabase
    .from('doctor_schedules')
    .update(updateData)
    .eq('schedule_id', scheduleId)
    .select()
    .single();

  if (error) {
    return Response.json({
      success: false,
      error: { message: error.message, code: error.code },
    }, { status: 500 });
  }

  return Response.json({ success: true, data });
}

// DELETE - Delete schedule
async function deleteSchedule(scheduleId: string): Promise<Response> {
  const { error } = await supabase
    .from('doctor_schedules')
    .delete()
    .eq('schedule_id', scheduleId);

  if (error) {
    return Response.json({
      success: false,
      error: { message: error.message, code: error.code },
    }, { status: 500 });
  }

  return Response.json({ success: true });
}

// =====================================================
// BATCH OPERATIONS
// =====================================================

async function setWeeklySchedule(doctorId: string, schedules: DoctorSchedule[]): Promise<Response> {
  // Delete existing schedules
  await supabase
    .from('doctor_schedules')
    .delete()
    .eq('doctor_id', doctorId);

  // Insert new schedules
  const { data, error } = await supabase
    .from('doctor_schedules')
    .insert(schedules.map(s => ({
      doctor_id: doctorId,
      clinic_id: s.clinic_id,
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      slot_duration: s.slot_duration || 30,
      break_start_time: s.break_start_time,
      break_end_time: s.break_end_time,
      max_patients: s.max_patients,
      is_available: s.is_available !== false,
      notes: s.notes,
    })))
    .select();

  if (error) {
    return Response.json({
      success: false,
      error: { message: error.message, code: error.code },
    }, { status: 500 });
  }

  return Response.json({ success: true, data });
}

// =====================================================
// AVAILABILITY CHECK
// =====================================================

async function checkAvailability(doctorId: string, startDate: string, endDate: string): Promise<Response> {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const availability = [];

  for (let date = start; date <= end; date.setDate(date.getDate() + 1)) {
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();

    const { data: schedule } = await supabase
      .from('doctor_schedules')
      .select('*')
      .eq('doctor_id', doctorId)
      .eq('day_of_week', dayOfWeek)
      .maybeSingle();

    // Check if date is a holiday
    const { data: holiday } = await supabase
      .from('holidays')
      .select('name')
      .eq('date', dateStr)
      .maybeSingle();

    // Count existing appointments
    const { count } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('doctor_id', doctorId)
      .eq('appointment_date', dateStr)
      .in('status', ['confirmed', 'pending']);

    availability.push({
      date: dateStr,
      day_of_week: dayOfWeek,
      day_name: DAY_NAMES[dayOfWeek],
      is_available: schedule?.is_available && !holiday,
      schedule: schedule || null,
      holiday: holiday?.name || null,
      appointments_count: count || 0,
      is_fully_booked: schedule && count >= (schedule.max_patients || 999),
    });
  }

  return Response.json({ success: true, data: availability });
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
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const scheduleId = pathParts[pathParts.length - 1] !== 'doctor-schedule'
    ? pathParts[pathParts.length - 1]
    : null;

  try {
    // GET /doctor-schedule - List schedules
    if (req.method === 'GET' && !scheduleId) {
      const action = url.searchParams.get('action');

      if (action === 'check') {
        const doctorId = url.searchParams.get('doctor_id');
        const startDate = url.searchParams.get('start_date');
        const endDate = url.searchParams.get('end_date');

        if (!doctorId || !startDate || !endDate) {
          return Response.json({
            success: false,
            error: { message: 'Missing doctor_id, start_date, or end_date', code: 'MISSING_PARAMS' },
          }, { status: 400 });
        }

        return await checkAvailability(doctorId, startDate, endDate);
      }

      if (action === 'date') {
        const doctorId = url.searchParams.get('doctor_id');
        const date = url.searchParams.get('date');

        if (!doctorId || !date) {
          return Response.json({
            success: false,
            error: { message: 'Missing doctor_id or date', code: 'MISSING_PARAMS' },
          }, { status: 400 });
        }

        return await getScheduleForDate(doctorId, date);
      }

      return await getSchedules(req);
    }

    // GET /doctor-schedule/:id - Get single schedule
    if (req.method === 'GET' && scheduleId) {
      const { data, error } = await supabase
        .from('doctor_schedules')
        .select(`
          *,
          doctor:doctors(name)
        `)
        .eq('schedule_id', scheduleId)
        .single();

      if (error) {
        return Response.json({
          success: false,
          error: { message: error.message, code: error.code },
        }, { status: 404 });
      }

      return Response.json({ success: true, data });
    }

    // POST /doctor-schedule - Create schedule(s)
    if (req.method === 'POST' && !scheduleId) {
      const action = url.searchParams.get('action');

      if (action === 'weekly') {
        const body = await req.json();
        const { doctor_id, schedules } = body;

        if (!doctor_id || !schedules || !Array.isArray(schedules)) {
          return Response.json({
            success: false,
            error: { message: 'Missing doctor_id or schedules array', code: 'MISSING_PARAMS' },
          }, { status: 400 });
        }

        return await setWeeklySchedule(doctor_id, schedules);
      }

      return await createSchedule(req);
    }

    // PATCH /doctor-schedule/:id - Update schedule
    if (req.method === 'PATCH' && scheduleId) {
      return await updateSchedule(scheduleId, req);
    }

    // DELETE /doctor-schedule/:id - Delete schedule
    if (req.method === 'DELETE' && scheduleId) {
      return await deleteSchedule(scheduleId);
    }

    return Response.json({
      success: false,
      error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' },
    }, { status: 405 });

  } catch (error) {
    console.error('Error in doctor-schedule function:', error);
    return Response.json({
      success: false,
      error: { message: 'Internal server error', code: 'INTERNAL_ERROR' },
    }, { status: 500 });
  }
});
