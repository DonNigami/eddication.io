/**
 * Appointment Queries
 * Helper functions for appointment operations
 */

import { getBrowserClient } from '../client';
import type { Appointment, ApiResponse, PaginatedResponse } from '../types';

const supabase = getBrowserClient();

// =====================================================
// GET APPOINTMENTS
// =====================================================

export async function getAppointments({
  clinicId,
  patientId,
  doctorId,
  startDate,
  endDate,
  status,
  page = 1,
  pageSize = 20,
}: {
  clinicId?: string;
  patientId?: string;
  doctorId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResponse<Appointment>> {
  let query = supabase
    .from('appointments')
    .select(`
      *,
      patient:patients(*),
      doctor:doctors(*)
    `);

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
    throw new Error(error.message);
  }

  return {
    data: data || [],
    count: count || 0,
    page,
    pageSize,
    hasMore: (count || 0) > to + 1,
  };
}

export async function getAppointmentById(appointmentId: string): Promise<Appointment | null> {
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      patient:patients(*),
      doctor:doctors(*)
    `)
    .eq('appointment_id', appointmentId)
    .single();

  if (error) {
    console.error('Error fetching appointment:', error);
    return null;
  }

  return data;
}

export async function getTodayAppointments(clinicId: string): Promise<Appointment[]> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      patient:patients(name, phone),
      doctor:doctors(name)
    `)
    .eq('clinic_id', clinicId)
    .eq('appointment_date', today)
    .in('status', ['confirmed', 'checked_in', 'in_consultation'])
    .order('appointment_time');

  if (error) {
    console.error('Error fetching today appointments:', error);
    return [];
  }

  return data || [];
}

export async function getUpcomingAppointments(
  patientId: string,
  limit = 5
): Promise<Appointment[]> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      doctor:doctors(name, specialty)
    `)
    .eq('patient_id', patientId)
    .gte('appointment_date', today)
    .in('status', ['pending', 'confirmed'])
    .order('appointment_date')
    .order('appointment_time')
    .limit(limit);

  if (error) {
    console.error('Error fetching upcoming appointments:', error);
    return [];
  }

  return data || [];
}

// =====================================================
// CREATE APPOINTMENT
// =====================================================

export async function createAppointment(params: {
  clinicId: string;
  patientId: string;
  doctorId: string;
  date: string;
  time: string;
  symptoms?: string;
  notes?: string;
}): Promise<ApiResponse<Appointment>> {
  // Check if slot is available
  const { data: existingSlot } = await supabase
    .from('appointment_slots')
    .select('*')
    .eq('doctor_id', params.doctorId)
    .eq('date', params.date)
    .eq('start_time', params.time)
    .eq('is_available', true)
    .single();

  if (!existingSlot) {
    return {
      success: false,
      error: { message: 'ช่วงเวลานี้ไม่ว่าง', code: 'SLOT_NOT_AVAILABLE' },
    };
  }

  // Get queue number
  const { data: queueData } = await supabase
    .from('appointments')
    .select('queue_number')
    .eq('doctor_id', params.doctorId)
    .eq('appointment_date', params.date)
    .order('queue_number', { ascending: false })
    .limit(1)
    .single();

  const nextQueueNumber = (queueData?.queue_number || 0) + 1;

  // Create appointment
  const { data, error } = await supabase
    .from('appointments')
    .insert({
      clinic_id: params.clinicId,
      patient_id: params.patientId,
      doctor_id: params.doctorId,
      appointment_date: params.date,
      appointment_time: params.time,
      queue_number: nextQueueNumber,
      symptoms: params.symptoms,
      notes: params.notes,
      status: 'pending',
    })
    .select(`
      *,
      patient:patients(*),
      doctor:doctors(*)
    `)
    .single();

  if (error) {
    return {
      success: false,
      error: { message: error.message, code: error.code },
    };
  }

  // Mark slot as unavailable
  await supabase
    .from('appointment_slots')
    .update({ is_available: false, appointment_id: data.appointment_id })
    .eq('slot_id', existingSlot.slot_id);

  return { success: true, data };
}

// =====================================================
// UPDATE APPOINTMENT
// =====================================================

export async function updateAppointmentStatus(
  appointmentId: string,
  status: string,
  metaData?: {
    checkInTime?: string;
    startTime?: string;
    completionTime?: string;
    cancellationReason?: string;
  }
): Promise<ApiResponse<Appointment>> {
  const updateData: Record<string, unknown> = { status };

  if (metaData?.checkInTime) updateData.check_in_time = metaData.checkInTime;
  if (metaData?.startTime) updateData.start_time = metaData.startTime;
  if (metaData?.completionTime) updateData.completion_time = metaData.completionTime;
  if (metaData?.cancellationReason) {
    updateData.cancellation_reason = metaData.cancellationReason;
    updateData.cancelled_at = new Date().toISOString();
  }

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
    return {
      success: false,
      error: { message: error.message, code: error.code },
    };
  }

  return { success: true, data };
}

export async function cancelAppointment(
  appointmentId: string,
  reason: string,
  cancelledBy: string
): Promise<ApiResponse<Appointment>> {
  const { data, error } = await supabase
    .from('appointments')
    .update({
      status: 'cancelled',
      cancellation_reason: reason,
      cancelled_by: cancelledBy,
      cancelled_at: new Date().toISOString(),
    })
    .eq('appointment_id', appointmentId)
    .select(`
      *,
      patient:patients(*),
      doctor:doctors(*)
    `)
    .single();

  if (error) {
    return {
      success: false,
      error: { message: error.message, code: error.code },
    };
  }

  // Free up the slot
  await supabase
    .from('appointment_slots')
    .update({ is_available: true, appointment_id: null })
    .eq('appointment_id', appointmentId);

  return { success: true, data };
}

// =====================================================
// DELETE APPOINTMENT
// =====================================================

export async function deleteAppointment(appointmentId: string): Promise<ApiResponse<void>> {
  const { error } = await supabase
    .from('appointments')
    .delete()
    .eq('appointment_id', appointmentId);

  if (error) {
    return {
      success: false,
      error: { message: error.message, code: error.code },
    };
  }

  return { success: true };
}

// =====================================================
// CHECK AVAILABILITY
// =====================================================

export async function checkSlotAvailability(
  doctorId: string,
  date: string,
  time: string
): Promise<boolean> {
  const { data } = await supabase
    .from('appointment_slots')
    .select('is_available')
    .eq('doctor_id', doctorId)
    .eq('date', date)
    .eq('start_time', time)
    .single();

  return data?.is_available ?? false;
}

export async function getAvailableSlots(
  doctorId: string,
  date: string
): Promise<Array<{ start_time: string; end_time: string }>> {
  const { data } = await supabase
    .from('appointment_slots')
    .select('start_time, end_time')
    .eq('doctor_id', doctorId)
    .eq('date', date)
    .eq('is_available', true)
    .order('start_time');

  return data || [];
}
