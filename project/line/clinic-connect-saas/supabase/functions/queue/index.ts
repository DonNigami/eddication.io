// =====================================================
// SUPABASE EDGE FUNCTION - QUEUE MANAGEMENT
// Queue operations: call next, skip, update status
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

interface QueueStatus {
  clinic_id: string;
  doctor_id: string;
  date: string;
  current_queue: number;
  waiting_count: number;
  in_consultation_count: number;
  completed_count: number;
  estimated_wait_time: number;
  last_updated: string;
}

interface QueueInfo {
  appointment_id: string;
  queue_number: number;
  patient_id: string;
  patient_name?: string;
  status: string;
  wait_time?: number;
}

// =====================================================
// QUEUE STATUS
// =====================================================

async function getQueueStatus(doctorId: string, date: string): Promise<QueueStatus | null> {
  const { data, error } = await supabase
    .from('queue_management')
    .select('*')
    .eq('doctor_id', doctorId)
    .eq('date', date)
    .single();

  if (error) {
    // Create initial queue status if not exists
    if (error.code === 'PGRST116') {
      return await initializeQueue(doctorId, date);
    }
    console.error('Error fetching queue status:', error);
    return null;
  }

  return data;
}

async function getTodayQueues(clinicId: string): Promise<QueueStatus[]> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('queue_management')
    .select(`
      *,
      doctor:doctors(name, title, specialty)
    `)
    .eq('clinic_id', clinicId)
    .eq('date', today)
    .order('created_at');

  if (error) {
    console.error('Error fetching today queues:', error);
    return [];
  }

  return data || [];
}

async function initializeQueue(doctorId: string, date: string): Promise<QueueStatus | null> {
  // Get doctor info
  const { data: doctor } = await supabase
    .from('doctors')
    .select('clinic_id')
    .eq('doctor_id', doctorId)
    .single();

  if (!doctor) return null;

  // Get appointment counts
  const { count } = await supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .eq('doctor_id', doctorId)
    .eq('appointment_date', date)
    .in('status', ['confirmed', 'checked_in', 'in_consultation']);

  const { data, error } = await supabase
    .from('queue_management')
    .insert({
      clinic_id: doctor.clinic_id,
      doctor_id: doctorId,
      date: date,
      current_queue: 0,
      waiting_count: count || 0,
      in_consultation_count: 0,
      completed_count: 0,
      estimated_wait_time: (count || 0) * 30,
      last_updated: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error initializing queue:', error);
    return null;
  }

  return data;
}

async function updateQueueStatus(doctorId: string, date: string): Promise<QueueStatus | null> {
  // Get actual counts from appointments
  const { data: appointments } = await supabase
    .from('appointments')
    .select('status, queue_number')
    .eq('doctor_id', doctorId)
    .eq('appointment_date', date);

  const waitingCount = appointments?.filter(a => a.status === 'confirmed').length || 0;
  const inConsultationCount = appointments?.filter(a => a.status === 'in_consultation').length || 0;
  const completedCount = appointments?.filter(a => a.status === 'completed').length || 0;

  // Find current queue (lowest checked_in)
  const currentQueue = appointments
    ?.filter(a => a.status === 'in_consultation' || a.status === 'checked_in')
    .sort((a, b) => (a.queue_number || 0) - (b.queue_number || 0))[0]?.queue_number || 0;

  // Calculate estimated wait time (30 min per waiting patient)
  const estimatedWaitTime = waitingCount * 30;

  // Get clinic_id
  const { data: doctor } = await supabase
    .from('doctors')
    .select('clinic_id')
    .eq('doctor_id', doctorId)
    .single();

  // Upsert queue status
  const { data, error } = await supabase
    .from('queue_management')
    .upsert({
      clinic_id: doctor?.clinic_id || '',
      doctor_id: doctorId,
      date: date,
      current_queue: currentQueue,
      waiting_count: waitingCount,
      in_consultation_count: inConsultationCount,
      completed_count: completedCount,
      estimated_wait_time: estimatedWaitTime,
      last_updated: new Date().toISOString(),
    }, {
      onConflict: 'doctor_id,date',
    })
    .select()
    .single();

  if (error) {
    console.error('Error updating queue status:', error);
    return null;
  }

  return data;
}

// =====================================================
// QUEUE OPERATIONS
// =====================================================

async function callNextQueue(doctorId: string, date: string): Promise<QueueInfo | null> {
  // Get next waiting patient
  const { data: nextAppointment } = await supabase
    .from('appointments')
    .select(`
      appointment_id,
      queue_number,
      patient_id,
      patient:patients(name, line_user_id, phone),
      doctor:doctors(name)
    `)
    .eq('doctor_id', doctorId)
    .eq('appointment_date', date)
    .eq('status', 'confirmed')
    .order('queue_number')
    .limit(1)
    .maybeSingle();

  if (!nextAppointment) {
    return null;
  }

  // Update appointment status to in_consultation
  const { error } = await supabase
    .from('appointments')
    .update({
      status: 'in_consultation',
      start_time: new Date().toISOString(),
    })
    .eq('appointment_id', nextAppointment.appointment_id);

  if (error) {
    console.error('Error updating appointment:', error);
    return null;
  }

  // Update queue status
  await updateQueueStatus(doctorId, date);

  // Send LINE notification
  if (nextAppointment.patient?.line_user_id) {
    await sendLineNotification(
      nextAppointment.patient.line_user_id,
      `🔔 ถึงคิวแล้ว!\n\nคิวหมายเลข: A${nextAppointment.queue_number}\nแพทย์: ${nextAppointment.doctor?.name || '-'}\n\nกรุณาเข้าห้องตรวจ`
    );
  }

  return {
    appointment_id: nextAppointment.appointment_id,
    queue_number: nextAppointment.queue_number,
    patient_id: nextAppointment.patient_id,
    patient_name: (nextAppointment.patient as any)?.name,
    status: 'in_consultation',
  };
}

async function skipQueue(appointmentId: string, doctorId: string, date: string, reason?: string): Promise<boolean> {
  const { error } = await supabase
    .from('appointments')
    .update({
      status: 'skipped',
      notes: reason ? `Skipped: ${reason}` : 'Skipped by doctor',
    })
    .eq('appointment_id', appointmentId);

  if (error) {
    console.error('Error skipping queue:', error);
    return false;
  }

  await updateQueueStatus(doctorId, date);
  return true;
}

async function completeQueue(appointmentId: string, doctorId: string, date: string): Promise<boolean> {
  const { data: appointment } = await supabase
    .from('appointments')
    .select('patient_id, patient:patients(line_user_id)')
    .eq('appointment_id', appointmentId)
    .single();

  const { error } = await supabase
    .from('appointments')
    .update({
      status: 'completed',
      completion_time: new Date().toISOString(),
    })
    .eq('appointment_id', appointmentId);

  if (error) {
    console.error('Error completing queue:', error);
    return false;
  }

  await updateQueueStatus(doctorId, date);

  // Send thank you message
  if (appointment?.patient?.line_user_id) {
    await sendLineNotification(
      appointment.patient.line_user_id,
      `✅ การพบแพทย์เสร็จสิ้น\n\nขอบคุณที่ใช้บริการ หากมีอาการผิดปกติ สามารถติดต่อแพทย์ได้`
    );
  }

  return true;
}

async function getWaitingList(doctorId: string, date: string): Promise<QueueInfo[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      appointment_id,
      queue_number,
      patient_id,
      patient:patients(name, phone),
      status,
      appointment_time
    `)
    .eq('doctor_id', doctorId)
    .eq('appointment_date', date)
    .in('status', ['confirmed', 'checked_in', 'in_consultation'])
    .order('queue_number');

  if (error) {
    console.error('Error fetching waiting list:', error);
    return [];
  }

  return (data || []).map(a => ({
    appointment_id: a.appointment_id,
    queue_number: a.queue_number || 0,
    patient_id: a.patient_id,
    patient_name: (a.patient as any)?.name,
    status: a.status,
  }));
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

  try {
    // GET /queue - Get queue status
    if (req.method === 'GET') {
      const doctorId = url.searchParams.get('doctor_id');
      const clinicId = url.searchParams.get('clinic_id');
      const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];

      if (clinicId && !doctorId) {
        const queues = await getTodayQueues(clinicId);
        return Response.json({ success: true, data: queues });
      }

      if (doctorId) {
        const queue = await getQueueStatus(doctorId, date);

        if (url.searchParams.has('waiting')) {
          const waitingList = await getWaitingList(doctorId, date);
          return Response.json({
            success: true,
            data: {
              status: queue,
              waiting: waitingList,
            },
          });
        }

        return Response.json({ success: true, data: queue });
      }

      return Response.json({
        success: false,
        error: { message: 'Missing doctor_id or clinic_id', code: 'MISSING_PARAM' },
      }, { status: 400 });
    }

    // POST /queue/call - Call next queue
    if (req.method === 'POST' && url.pathname.endsWith('/call')) {
      const body = await req.json();
      const { doctor_id, date } = body;

      if (!doctor_id) {
        return Response.json({
          success: false,
          error: { message: 'Missing doctor_id', code: 'MISSING_PARAM' },
        }, { status: 400 });
      }

      const result = await callNextQueue(doctor_id, date || new Date().toISOString().split('T')[0]);

      if (!result) {
        return Response.json({
          success: false,
          error: { message: 'ไม่มีคนไข้รอในคิว', code: 'NO_QUEUE' },
        }, { status: 404 });
      }

      return Response.json({ success: true, data: result });
    }

    // POST /queue/skip - Skip queue
    if (req.method === 'POST' && url.pathname.endsWith('/skip')) {
      const body = await req.json();
      const { appointment_id, doctor_id, date, reason } = body;

      if (!appointment_id || !doctor_id) {
        return Response.json({
          success: false,
          error: { message: 'Missing appointment_id or doctor_id', code: 'MISSING_PARAM' },
        }, { status: 400 });
      }

      const success = await skipQueue(
        appointment_id,
        doctor_id,
        date || new Date().toISOString().split('T')[0],
        reason
      );

      return Response.json({ success });
    }

    // POST /queue/complete - Complete queue
    if (req.method === 'POST' && url.pathname.endsWith('/complete')) {
      const body = await req.json();
      const { appointment_id, doctor_id, date } = body;

      if (!appointment_id || !doctor_id) {
        return Response.json({
          success: false,
          error: { message: 'Missing appointment_id or doctor_id', code: 'MISSING_PARAM' },
        }, { status: 400 });
      }

      const success = await completeQueue(
        appointment_id,
        doctor_id,
        date || new Date().toISOString().split('T')[0]
      );

      return Response.json({ success });
    }

    // POST /queue/update - Update queue status
    if (req.method === 'POST' && url.pathname.endsWith('/update')) {
      const body = await req.json();
      const { doctor_id, date } = body;

      if (!doctor_id) {
        return Response.json({
          success: false,
          error: { message: 'Missing doctor_id', code: 'MISSING_PARAM' },
        }, { status: 400 });
      }

      const result = await updateQueueStatus(
        doctor_id,
        date || new Date().toISOString().split('T')[0]
      );

      return Response.json({ success: true, data: result });
    }

    return Response.json({
      success: false,
      error: { message: 'Not found', code: 'NOT_FOUND' },
    }, { status: 404 });

  } catch (error) {
    console.error('Error in queue function:', error);
    return Response.json({
      success: false,
      error: { message: 'Internal server error', code: 'INTERNAL_ERROR' },
    }, { status: 500 });
  }
});
