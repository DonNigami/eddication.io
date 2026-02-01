// =====================================================
// SUPABASE EDGE FUNCTION - APPOINTMENTS
// CRUD operations for appointment management
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

interface Appointment {
  appointment_id?: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  appointment_time: string;
  queue_number?: number;
  status: 'pending' | 'confirmed' | 'checked_in' | 'in_consultation' | 'completed' | 'cancelled' | 'no_show';
  symptoms?: string;
  notes?: string;
  check_in_time?: string;
  start_time?: string;
  completion_time?: string;
  cancellation_reason?: string;
  cancelled_by?: string;
  cancelled_at?: string;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
  };
}

// =====================================================
// VALIDATION
// =====================================================

function validateAppointmentDate(date: string, time: string): { valid: boolean; error?: string } {
  const appointmentDateTime = new Date(`${date}T${time}`);
  const now = new Date();

  if (appointmentDateTime < now) {
    return { valid: false, error: 'ไม่สามารถจองนัดหมายในอดีตได้' };
  }

  return { valid: true };
}

async function checkDoctorAvailability(doctorId: string, date: string, time: string): Promise<boolean> {
  const { data } = await supabase
    .from('appointment_slots')
    .select('is_available')
    .eq('doctor_id', doctorId)
    .eq('date', date)
    .eq('start_time', time)
    .eq('is_available', true)
    .single();

  return !!data;
}

async function getNextQueueNumber(doctorId: string, date: string): Promise<number> {
  const { data } = await supabase
    .from('appointments')
    .select('queue_number')
    .eq('doctor_id', doctorId)
    .eq('appointment_date', date)
    .order('queue_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.queue_number || 0) + 1;
}

// =====================================================
// CRUD OPERATIONS
// =====================================================

// GET - Fetch appointments
async function getAppointments(req: Request) {
  const url = new URL(req.url);
  const clinicId = url.searchParams.get('clinic_id');
  const patientId = url.searchParams.get('patient_id');
  const doctorId = url.searchParams.get('doctor_id');
  const startDate = url.searchParams.get('start_date');
  const endDate = url.searchParams.get('end_date');
  const status = url.searchParams.get('status');
  const page = parseInt(url.searchParams.get('page') || '1');
  const pageSize = parseInt(url.searchParams.get('page_size') || '20');

  let query = supabase
    .from('appointments')
    .select(`
      *,
      patient:patients(*),
      doctor:doctors(*)
    `, { count: 'exact' });

  if (clinicId) query = query.eq('clinic_id', clinicId);
  if (patientId) query = query.eq('patient_id', patientId);
  if (doctorId) query = query.eq('doctor_id', doctorId);
  if (startDate) query = query.gte('appointment_date', startDate);
  if (endDate) query = query.lte('appointment_date', endDate);
  if (status) query = query.eq('status', status);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query
    .order('appointment_date', { ascending: false })
    .order('appointment_time')
    .range(from, to);

  if (error) {
    return Response.json({
      success: false,
      error: { message: error.message, code: error.code },
    }, { status: 400 });
  }

  return Response.json({
    success: true,
    data: {
      data: data || [],
      count: count || 0,
      page,
      pageSize,
      hasMore: (count || 0) > to + 1,
    },
  });
}

// GET - Fetch single appointment
async function getAppointment(appointmentId: string): Promise<Response> {
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      patient:patients(*),
      doctor:doctors(*),
      clinic:clinics(*)
    `)
    .eq('appointment_id', appointmentId)
    .single();

  if (error) {
    return Response.json({
      success: false,
      error: { message: error.message, code: error.code },
    }, { status: 404 });
  }

  return Response.json({ success: true, data });
}

// POST - Create appointment
async function createAppointment(req: Request): Promise<Response> {
  const body = await req.json() as Partial<Appointment>;

  // Validate required fields
  if (!body.clinic_id || !body.patient_id || !body.doctor_id || !body.appointment_date || !body.appointment_time) {
    return Response.json({
      success: false,
      error: { message: 'Missing required fields', code: 'MISSING_FIELDS' },
    }, { status: 400 });
  }

  // Validate date/time
  const dateValidation = validateAppointmentDate(body.appointment_date, body.appointment_time);
  if (!dateValidation.valid) {
    return Response.json({
      success: false,
      error: { message: dateValidation.error, code: 'INVALID_DATE' },
    }, { status: 400 });
  }

  // Check availability
  const isAvailable = await checkDoctorAvailability(body.doctor_id, body.appointment_date, body.appointment_time);
  if (!isAvailable) {
    return Response.json({
      success: false,
      error: { message: 'ช่วงเวลานี้ไม่ว่าง', code: 'SLOT_NOT_AVAILABLE' },
    }, { status: 409 });
  }

  // Get queue number
  const queueNumber = await getNextQueueNumber(body.doctor_id, body.appointment_date);

  // Create appointment
  const { data, error } = await supabase
    .from('appointments')
    .insert({
      clinic_id: body.clinic_id,
      patient_id: body.patient_id,
      doctor_id: body.doctor_id,
      appointment_date: body.appointment_date,
      appointment_time: body.appointment_time,
      queue_number: queueNumber,
      symptoms: body.symptoms,
      notes: body.notes,
      status: 'pending',
    })
    .select(`
      *,
      patient:patients(*),
      doctor:doctors(*)
    `)
    .single();

  if (error) {
    return Response.json({
      success: false,
      error: { message: error.message, code: error.code },
    }, { status: 500 });
  }

  // Mark slot as unavailable
  await supabase
    .from('appointment_slots')
    .update({ is_available: false, appointment_id: data.appointment_id })
    .eq('doctor_id', body.doctor_id)
    .eq('date', body.appointment_date)
    .eq('start_time', body.appointment_time);

  // Send notification if patient has LINE
  if (data.patient?.line_user_id) {
    await sendLineNotification(
      data.patient.line_user_id,
      `✅ ยืนยันการจองนัดหมาย\n\nคิวหมายเลข: A${queueNumber}\nแพทย์: ${data.doctor?.name || '-'}\nวันที่: ${formatDateTh(data.appointment_date)}\nเวลา: ${data.appointment_time}\n\nกรุณามาตามนัด 15 นาทีล่วงหน้า`
    );
  }

  return Response.json({
    success: true,
    data,
  }, { status: 201 });
}

// PATCH - Update appointment
async function updateAppointment(appointmentId: string, req: Request): Promise<Response> {
  const body = await req.json() as Partial<Appointment>;

  const updateData: Record<string, unknown> = {};

  if (body.status) {
    updateData.status = body.status;

    // Auto-set timestamps based on status
    if (body.status === 'checked_in') {
      updateData.check_in_time = new Date().toISOString();
    } else if (body.status === 'in_consultation') {
      updateData.start_time = new Date().toISOString();
    } else if (body.status === 'completed') {
      updateData.completion_time = new Date().toISOString();
    }
  }

  if (body.symptoms !== undefined) updateData.symptoms = body.symptoms;
  if (body.notes !== undefined) updateData.notes = body.notes;
  if (body.cancellation_reason) {
    updateData.cancellation_reason = body.cancellation_reason;
    updateData.cancelled_at = new Date().toISOString();
  }
  if (body.cancelled_by) updateData.cancelled_by = body.cancelled_by;

  const { data, error } = await supabase
    .from('appointments')
    .update(updateData)
    .eq('appointment_id', appointmentId)
    .select(`
      *,
      patient:patients(*),
      doctor:doctors(*)
    `)
    .single();

  if (error) {
    return Response.json({
      success: false,
      error: { message: error.message, code: error.code },
    }, { status: 500 });
  }

  return Response.json({ success: true, data });
}

// DELETE - Delete appointment (soft delete by cancelling)
async function deleteAppointment(appointmentId: string): Promise<Response> {
  const { error } = await supabase
    .from('appointments')
    .update({
      status: 'cancelled',
      cancellation_reason: 'Deleted by system',
      cancelled_at: new Date().toISOString(),
    })
    .eq('appointment_id', appointmentId);

  if (error) {
    return Response.json({
      success: false,
      error: { message: error.message, code: error.code },
    }, { status: 500 });
  }

  return Response.json({ success: true });
}

// GET - Today's appointments for a clinic
async function getTodayAppointments(clinicId: string): Promise<Response> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      patient:patients(name, phone, line_user_id),
      doctor:doctors(name, title)
    `)
    .eq('clinic_id', clinicId)
    .eq('appointment_date', today)
    .in('status', ['confirmed', 'checked_in', 'in_consultation'])
    .order('appointment_time');

  if (error) {
    return Response.json({
      success: false,
      error: { message: error.message, code: error.code },
    }, { status: 500 });
  }

  return Response.json({ success: true, data: data || [] });
}

// =====================================================
// NOTIFICATIONS
// =====================================================

async function sendLineNotification(userId: string, message: string): Promise<void> {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: 'text', text: message }],
    }),
  });
}

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
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const appointmentId = pathParts[pathParts.length - 1] !== 'appointments'
    ? pathParts[pathParts.length - 1]
    : null;

  // Route handling
  try {
    // GET /appointments - List appointments
    if (req.method === 'GET' && !appointmentId && url.searchParams.has('today')) {
      const clinicId = url.searchParams.get('clinic_id');
      if (clinicId) return await getTodayAppointments(clinicId);
    }

    if (req.method === 'GET' && !appointmentId) {
      return await getAppointments(req);
    }

    // GET /appointments/:id - Get single appointment
    if (req.method === 'GET' && appointmentId) {
      return await getAppointment(appointmentId);
    }

    // POST /appointments - Create appointment
    if (req.method === 'POST' && !appointmentId) {
      return await createAppointment(req);
    }

    // PATCH /appointments/:id - Update appointment
    if (req.method === 'PATCH' && appointmentId) {
      return await updateAppointment(appointmentId, req);
    }

    // DELETE /appointments/:id - Delete appointment
    if (req.method === 'DELETE' && appointmentId) {
      return await deleteAppointment(appointmentId);
    }

    return Response.json({
      success: false,
      error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' },
    }, { status: 405 });

  } catch (error) {
    console.error('Error in appointments function:', error);
    return Response.json({
      success: false,
      error: { message: 'Internal server error', code: 'INTERNAL_ERROR' },
    }, { status: 500 });
  }
});
