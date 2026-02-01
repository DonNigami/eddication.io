/**
 * Queue Queries
 * Helper functions for queue management operations
 */

import { getBrowserClient } from '../client';
import type { QueueManagement, ApiResponse } from '../types';

const supabase = getBrowserClient();

// =====================================================
// GET QUEUE STATUS
// =====================================================

export async function getQueueStatus(doctorId: string, date: string): Promise<QueueManagement | null> {
  const { data, error } = await supabase
    .from('queue_management')
    .select('*')
    .eq('doctor_id', doctorId)
    .eq('date', date)
    .single();

  if (error) {
    // If not found, create initial queue status
    if (error.code === 'PGRST116') {
      return await initializeQueue(doctorId, date);
    }
    console.error('Error fetching queue status:', error);
    return null;
  }

  return data;
}

export async function getTodayQueues(clinicId: string): Promise<QueueManagement[]> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('queue_management')
    .select(`
      *,
      doctor:doctors(name)
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

// =====================================================
// INITIALIZE QUEUE
// =====================================================

async function initializeQueue(doctorId: string, date: string): Promise<QueueManagement | null> {
  // Get doctor info to find clinic_id
  const { data: doctor } = await supabase
    .from('doctors')
    .select('clinic_id')
    .eq('doctor_id', doctorId)
    .single();

  if (!doctor) return null;

  // Get count of appointments for the day
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
      estimated_wait_time: 0,
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

// =====================================================
// UPDATE QUEUE
// =====================================================

export async function updateQueueStatus(
  doctorId: string,
  date: string
): Promise<ApiResponse<QueueManagement>> {
  // Get actual counts from appointments
  const { data: appointments } = await supabase
    .from('appointments')
    .select('status, queue_number')
    .eq('doctor_id', doctorId)
    .eq('appointment_date', date);

  const waitingCount = appointments?.filter(a => a.status === 'confirmed').length || 0;
  const inConsultationCount = appointments?.filter(a => a.status === 'in_consultation').length || 0;
  const completedCount = appointments?.filter(a => a.status === 'completed').length || 0;

  // Find current queue (highest in consultation or checked_in)
  const currentQueue = appointments?.filter(a =>
    a.status === 'in_consultation' || a.status === 'checked_in'
  ).sort((a, b) => (a.queue_number || 0) - (b.queue_number || 0))[0]?.queue_number || 0;

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
    return {
      success: false,
      error: { message: error.message, code: error.code },
    };
  }

  return { success: true, data };
}

export async function callNextQueue(doctorId: string, date: string): Promise<ApiResponse> {
  // Get next waiting patient
  const { data: nextAppointment } = await supabase
    .from('appointments')
    .select('appointment_id, queue_number, patient_id')
    .eq('doctor_id', doctorId)
    .eq('appointment_date', date)
    .eq('status', 'confirmed')
    .order('queue_number')
    .limit(1)
    .maybeSingle();

  if (!nextAppointment) {
    return {
      success: false,
      error: { message: 'ไม่มีคนไข้รอในคิว', code: 'NO_QUEUE' },
    };
  }

  // Update appointment status to checked_in
  const { error } = await supabase
    .from('appointments')
    .update({
      status: 'checked_in',
      check_in_time: new Date().toISOString(),
    })
    .eq('appointment_id', nextAppointment.appointment_id);

  if (error) {
    return {
      success: false,
      error: { message: error.message, code: error.code },
    };
  }

  // Update queue status
  await updateQueueStatus(doctorId, date);

  return {
    success: true,
    data: {
      appointmentId: nextAppointment.appointment_id,
      queueNumber: nextAppointment.queue_number,
      patientId: nextAppointment.patient_id,
    },
  };
}

export async function skipQueue(
  appointmentId: string,
  doctorId: string,
  date: string
): Promise<ApiResponse> {
  const { error } = await supabase
    .from('appointments')
    .update({ status: 'skipped' })
    .eq('appointment_id', appointmentId);

  if (error) {
    return {
      success: false,
      error: { message: error.message, code: error.code },
    };
  }

  await updateQueueStatus(doctorId, date);

  return { success: true };
}

// =====================================================
// QUEUE NOTIFICATIONS
// =====================================================

export async function notifyQueueUpdate(
  appointmentId: string,
  queueNumber: number,
  estimatedWaitTime: number
): Promise<ApiResponse> {
  // Get appointment with patient info
  const { data: appointment } = await supabase
    .from('appointments')
    .select(`
      patient_id,
      patient:patients(name, line_user_id, phone),
      doctor:doctors(name)
    `)
    .eq('appointment_id', appointmentId)
    .single();

  if (!appointment) {
    return {
      success: false,
      error: { message: 'Appointment not found', code: 'NOT_FOUND' },
    };
  }

  // Create notification
  const { error } = await supabase
    .from('notifications')
    .insert({
      clinic_id: '', // Will be filled from trigger
      user_id: appointment.patient_id,
      line_user_id: (appointment.patient as any)?.line_user_id,
      type: 'queue_update',
      title: 'อัปเดตคิว',
      message: `คิวหมายเลข A${queueNumber} ค่อยอีกประมาณ ${estimatedWaitTime} นาที`,
      data: {
        appointment_id: appointmentId,
        queue_number: queueNumber,
        estimated_wait_time: estimatedWaitTime,
      },
      is_read: false,
      sent_via_line: !!(appointment.patient as any)?.line_user_id,
      sent_at: new Date().toISOString(),
    });

  if (error) {
    return {
      success: false,
      error: { message: error.message, code: error.code },
    };
  }

  return { success: true };
}

// =====================================================
// QUEUE STATISTICS
// =====================================================

export async function getQueueStatistics(doctorId: string, startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('queue_management')
    .select('*')
    .eq('doctor_id', doctorId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date');

  if (error) {
    console.error('Error fetching queue statistics:', error);
    return null;
  }

  if (!data || data.length === 0) {
    return {
      totalDays: 0,
      totalPatients: 0,
      averageWaitTime: 0,
      peakDay: null,
    };
  }

  const totalPatients = data.reduce((sum, day) => sum + day.completed_count, 0);
  const averageWaitTime = data.reduce((sum, day) => sum + day.estimated_wait_time, 0) / data.length;
  const peakDay = data.reduce((max, day) =>
    day.completed_count > max.completed_count ? day : max
  );

  return {
    totalDays: data.length,
    totalPatients,
    averageWaitTime: Math.round(averageWaitTime),
    peakDay: {
      date: peakDay.date,
      count: peakDay.completed_count,
    },
  };
}
