/**
 * Patient Queries
 * Helper functions for patient operations
 */

import { getBrowserClient } from '../client';
import type { Patient, ApiResponse } from '../types';

const supabase = getBrowserClient();

// =====================================================
// GET PATIENTS
// =====================================================

export async function getPatients({
  clinicId,
  search,
  sortBy = 'last_visit_date',
  sortOrder = 'desc',
  page = 1,
  pageSize = 20,
}: {
  clinicId?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}) {
  let query = supabase
    .from('patients')
    .select('*', { count: 'exact' });

  if (clinicId) query = query.eq('clinic_id', clinicId);
  if (search) {
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,hn_id.ilike.%${search}%`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query
    .order(sortBy as any, { ascending: sortOrder === 'asc', nullsFirst: false })
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

export async function getPatientById(patientId: string): Promise<Patient | null> {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('patient_id', patientId)
    .single();

  if (error) {
    console.error('Error fetching patient:', error);
    return null;
  }

  return data;
}

export async function getPatientByLineUserId(lineUserId: string): Promise<Patient | null> {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('line_user_id', lineUserId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching patient by LINE user ID:', error);
    return null;
  }

  return data;
}

export async function getPatientByPhone(phone: string, clinicId?: string): Promise<Patient | null> {
  let query = supabase
    .from('patients')
    .select('*')
    .eq('phone', phone);

  if (clinicId) {
    query = query.eq('clinic_id', clinicId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error('Error fetching patient by phone:', error);
    return null;
  }

  return data;
}

// =====================================================
// CREATE PATIENT
// =====================================================

export async function createPatient(params: {
  clinicId: string;
  name: string;
  phone: string;
  email?: string;
  lineUserId?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  idCard?: string;
  bloodType?: string;
  allergies?: string;
  chronicDiseases?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}): Promise<ApiResponse<Patient>> {
  // Generate HN ID if not provided
  const hnId = await generateHnId(params.clinicId);

  const { data, error } = await supabase
    .from('patients')
    .insert({
      clinic_id: params.clinicId,
      name: params.name,
      phone: params.phone,
      email: params.email,
      line_user_id: params.lineUserId,
      hn_id: hnId,
      date_of_birth: params.dateOfBirth,
      gender: params.gender,
      id_card: params.idCard,
      blood_type: params.bloodType,
      allergies: params.allergies,
      chronic_diseases: params.chronicDiseases,
      emergency_contact_name: params.emergencyContactName,
      emergency_contact_phone: params.emergencyContactPhone,
      total_visits: 0,
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
// UPDATE PATIENT
// =====================================================

export async function updatePatient(
  patientId: string,
  updates: Partial<Omit<Patient, 'patient_id' | 'clinic_id' | 'created_at' | 'updated_at'>>
): Promise<ApiResponse<Patient>> {
  const { data, error } = await supabase
    .from('patients')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('patient_id', patientId)
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

export async function linkLineAccount(
  patientId: string,
  lineUserId: string
): Promise<ApiResponse<Patient>> {
  return updatePatient(patientId, { line_user_id: lineUserId });
}

export async function incrementVisitCount(patientId: string): Promise<void> {
  await supabase.rpc('increment_total_visits', { p_patient_id: patientId });
}

// =====================================================
// DELETE PATIENT
// =====================================================

export async function deletePatient(patientId: string): Promise<ApiResponse<void>> {
  const { error } = await supabase
    .from('patients')
    .delete()
    .eq('patient_id', patientId);

  if (error) {
    return {
      success: false,
      error: { message: error.message, code: error.code },
    };
  }

  return { success: true };
}

// =====================================================
// PATIENT HISTORY
// =====================================================

export async function getPatientAppointments(patientId: string, limit = 10) {
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      doctor:doctors(name, specialty)
    `)
    .eq('patient_id', patientId)
    .order('appointment_date', { ascending: false })
    .order('appointment_time', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching patient appointments:', error);
    return [];
  }

  return data || [];
}

export async function getPatientMedicalRecords(patientId: string, limit = 10) {
  const { data, error } = await supabase
    .from('medical_records')
    .select(`
      *,
      doctor:doctors(name)
    `)
    .eq('patient_id', patientId)
    .order('visit_date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching patient medical records:', error);
    return [];
  }

  return data || [];
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

async function generateHnId(clinicId: string): Promise<string> {
  const today = new Date();
  const year = today.getFullYear().toString().slice(-2);
  const month = (today.getMonth() + 1).toString().padStart(2, '0');

  // Get the last HN ID for this month
  const { data } = await supabase
    .from('patients')
    .select('hn_id')
    .eq('clinic_id', clinicId)
    .like('hn_id', `${year}${month}%`)
    .order('hn_id', { ascending: false })
    .limit(1)
    .maybeSingle();

  let sequence = 1;
  if (data?.hn_id) {
    const lastSequence = parseInt(data.hn_id.slice(-4), 10);
    sequence = lastSequence + 1;
  }

  return `${year}${month}${sequence.toString().padStart(4, '0')}`;
}
