/**
 * Doctor Queries
 * Helper functions for doctor operations
 */

import { getBrowserClient } from '../client';
import type { Doctor, ApiResponse } from '../types';

const supabase = getBrowserClient();

// =====================================================
// GET DOCTORS
// =====================================================

export async function getDoctors({
  clinicId,
  isAvailable,
  sortBy = 'name',
  sortOrder = 'asc',
}: {
  clinicId?: string;
  isAvailable?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
} = {}): Promise<Doctor[]> {
  let query = supabase
    .from('doctors')
    .select('*')
    .eq('is_active', true);

  if (clinicId) query = query.eq('clinic_id', clinicId);
  if (isAvailable !== undefined) query = query.eq('is_available', isAvailable);

  const { data, error } = await query.order(sortBy as any, { ascending: sortOrder === 'asc' });

  if (error) {
    console.error('Error fetching doctors:', error);
    return [];
  }

  return data || [];
}

export async function getDoctorById(doctorId: string): Promise<Doctor | null> {
  const { data, error } = await supabase
    .from('doctors')
    .select('*')
    .eq('doctor_id', doctorId)
    .single();

  if (error) {
    console.error('Error fetching doctor:', error);
    return null;
  }

  return data;
}

export async function getDoctorByUserId(userId: string): Promise<Doctor | null> {
  const { data, error } = await supabase
    .from('doctors')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching doctor by user ID:', error);
    return null;
  }

  return data;
}

// =====================================================
// CREATE DOCTOR
// =====================================================

export async function createDoctor(params: {
  clinicId: string;
  licenseNo: string;
  name: string;
  nameEn?: string;
  specialty?: string;
  qualifications?: string[];
  consultationFee: number;
  consultationDuration?: number;
  workingDays?: number[];
  workingHours?: { start: string; end: string };
  biography?: string;
  userId?: string;
}): Promise<ApiResponse<Doctor>> {
  const { data, error } = await supabase
    .from('doctors')
    .insert({
      clinic_id: params.clinicId,
      user_id: params.userId,
      license_no: params.licenseNo,
      name: params.name,
      name_en: params.nameEn,
      specialty: params.specialty,
      qualifications: params.qualifications,
      consultation_fee: params.consultationFee,
      consultation_duration: params.consultationDuration || 30,
      working_days: params.workingDays || [1, 2, 3, 4, 5],
      working_hours: params.workingHours || { start: '09:00', end: '17:00' },
      biography: params.biography,
      is_available: true,
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

// =====================================================
// UPDATE DOCTOR
// =====================================================

export async function updateDoctor(
  doctorId: string,
  updates: Partial<Omit<Doctor, 'doctor_id' | 'clinic_id' | 'created_at' | 'updated_at'>>
): Promise<ApiResponse<Doctor>> {
  const { data, error } = await supabase
    .from('doctors')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('doctor_id', doctorId)
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

export async function toggleDoctorAvailability(doctorId: string): Promise<ApiResponse<Doctor>> {
  const { data: current } = await supabase
    .from('doctors')
    .select('is_available')
    .eq('doctor_id', doctorId)
    .single();

  if (!current) {
    return {
      success: false,
      error: { message: 'Doctor not found', code: 'NOT_FOUND' },
    };
  }

  return updateDoctor(doctorId, { is_available: !current.is_available });
}

// =====================================================
// DELETE DOCTOR
// =====================================================

export async function deleteDoctor(doctorId: string): Promise<ApiResponse<void>> {
  // Soft delete - just mark as inactive
  const { error } = await supabase
    .from('doctors')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('doctor_id', doctorId);

  if (error) {
    return {
      success: false,
      error: { message: error.message, code: error.code },
    };
  }

  return { success: true };
}

// =====================================================
// DOCTOR SCHEDULE & AVAILABILITY
// =====================================================

export async function getDoctorSchedule(doctorId: string, startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('appointment_slots')
    .select('*')
    .eq('doctor_id', doctorId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date')
    .order('start_time');

  if (error) {
    console.error('Error fetching doctor schedule:', error);
    return [];
  }

  return data || [];
}

export async function getDoctorBlockedDates(doctorId: string, startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('doctor_blocked_dates')
    .select('*')
    .eq('doctor_id', doctorId)
    .gte('block_date', startDate)
    .lte('block_date', endDate)
    .order('block_date');

  if (error) {
    console.error('Error fetching blocked dates:', error);
    return [];
  }

  return data || [];
}

export async function blockDoctorDate(params: {
  doctorId: string;
  date: string;
  blockType: 'full_day' | 'time_range';
  startTime?: string;
  endTime?: string;
  reason?: string;
  createdBy: string;
}): Promise<ApiResponse> {
  const { error } = await supabase
    .from('doctor_blocked_dates')
    .insert({
      doctor_id: params.doctorId,
      block_date: params.date,
      block_type: params.blockType,
      start_time: params.startTime,
      end_time: params.endTime,
      reason: params.reason,
      created_by: params.createdBy,
    });

  if (error) {
    return {
      success: false,
      error: { message: error.message, code: error.code },
    };
  }

  // If blocking full day or time range, remove corresponding slots
  if (params.blockType === 'full_day') {
    await supabase
      .from('appointment_slots')
      .delete()
      .eq('doctor_id', params.doctorId)
      .eq('date', params.date);
  } else if (params.startTime && params.endTime) {
    await supabase
      .from('appointment_slots')
      .delete()
      .eq('doctor_id', params.doctorId)
      .eq('date', params.date)
      .gte('start_time', params.startTime)
      .lte('end_time', params.endTime);
  }

  return { success: true };
}

export async function removeBlockedDate(blockId: string): Promise<ApiResponse<void>> {
  const { error } = await supabase
    .from('doctor_blocked_dates')
    .delete()
    .eq('block_id', blockId);

  if (error) {
    return {
      success: false,
      error: { message: error.message, code: error.code },
    };
  }

  return { success: true };
}

// =====================================================
// DOCTOR STATS
// =====================================================

export async function getDoctorStats(doctorId: string, startDate?: string, endDate?: string) {
  let query = supabase
    .from('appointments')
    .select('status, appointment_date', { count: 'exact' })
    .eq('doctor_id', doctorId);

  if (startDate) query = query.gte('appointment_date', startDate);
  if (endDate) query = query.lte('appointment_date', endDate);

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching doctor stats:', error);
    return {
      total: 0,
      completed: 0,
      cancelled: 0,
      noShow: 0,
    };
  }

  return {
    total: data?.length || 0,
    completed: data?.filter(a => a.status === 'completed').length || 0,
    cancelled: data?.filter(a => a.status === 'cancelled').length || 0,
    noShow: data?.filter(a => a.status === 'no_show').length || 0,
  };
}

export async function getDoctorTodayQueue(doctorId: string) {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('appointments')
    .select(`
      appointment_id,
      queue_number,
      status,
      patient:patients(name, phone)
    `)
    .eq('doctor_id', doctorId)
    .eq('appointment_date', today)
    .in('status', ['confirmed', 'checked_in', 'in_consultation'])
    .order('queue_number');

  if (error) {
    console.error('Error fetching doctor queue:', error);
    return [];
  }

  return data || [];
}
