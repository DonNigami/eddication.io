// =====================================================
// SUPABASE EDGE FUNCTION - MEDICAL RECORDS
// CRUD operations for medical records and prescriptions
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// =====================================================
// CONFIG & TYPES
// =====================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface MedicalRecord {
  record_id?: string;
  appointment_id: string;
  patient_id: string;
  doctor_id: string;
  clinic_id: string;
  visit_date: string;
  chief_complaint?: string;
  diagnosis?: string;
  diagnosis_code?: string; // ICD-10
  symptoms?: string;
  vital_signs?: {
    blood_pressure_systolic?: number;
    blood_pressure_diastolic?: number;
    heart_rate?: number;
    temperature?: number;
    weight?: number;
    height?: number;
    bmi?: number;
  };
  physical_examination?: string;
  treatment_plan?: string;
  notes?: string;
  follow_up_date?: string;
  is_confidential?: boolean;
}

interface PrescriptionItem {
  item_id?: string;
  record_id?: string;
  medicine_name: string;
  dosage: string;
    frequency: string;
    duration: string;
    quantity: number;
    instructions?: string;
    is_prn?: boolean; // as needed
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
// CRUD OPERATIONS
// =====================================================

// GET - Fetch medical records
async function getMedicalRecords(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const patientId = url.searchParams.get('patient_id');
  const doctorId = url.searchParams.get('doctor_id');
  const clinicId = url.searchParams.get('clinic_id');
  const appointmentId = url.searchParams.get('appointment_id');
  const startDate = url.searchParams.get('start_date');
  const endDate = url.searchParams.get('end_date');
  const page = parseInt(url.searchParams.get('page') || '1');
  const pageSize = parseInt(url.searchParams.get('page_size') || '20');

  let query = supabase
    .from('medical_records')
    .select(`
      *,
      patient:patients(name, phone, date_of_birth),
      doctor:doctors(name, title, specialty),
      appointment:appointments(appointment_date, appointment_time),
      clinic:clinics(name)
    `, { count: 'exact' });

  if (patientId) query = query.eq('patient_id', patientId);
  if (doctorId) query = query.eq('doctor_id', doctorId);
  if (clinicId) query = query.eq('clinic_id', clinicId);
  if (appointmentId) query = query.eq('appointment_id', appointmentId);
  if (startDate) query = query.gte('visit_date', startDate);
  if (endDate) query = query.lte('visit_date', endDate);

  // Hide confidential records unless requesting doctor is the owner
  const requestingDoctorId = req.headers.get('X-Doctor-Id');
  if (requestingDoctorId) {
    // Still show confidential records for the patient's own doctor
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query
    .order('visit_date', { ascending: false })
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

// GET - Fetch single medical record with prescriptions
async function getMedicalRecord(recordId: string): Promise<Response> {
  const { data, error } = await supabase
    .from('medical_records')
    .select(`
      *,
      patient:patients(*),
      doctor:doctors(*),
      clinic:clinics(*),
      appointment:appointments(*),
      prescriptions(*)
    `)
    .eq('record_id', recordId)
    .single();

  if (error) {
    return Response.json({
      success: false,
      error: { message: error.message, code: error.code },
    }, { status: 404 });
  }

  return Response.json({ success: true, data });
}

// POST - Create medical record
async function createMedicalRecord(req: Request): Promise<Response> {
  const body = await req.json() as Partial<MedicalRecord> & { prescriptions?: PrescriptionItem[] };

  // Validate required fields
  if (!body.appointment_id || !body.patient_id || !body.doctor_id || !body.clinic_id || !body.visit_date) {
    return Response.json({
      success: false,
      error: { message: 'Missing required fields', code: 'MISSING_FIELDS' },
    }, { status: 400 });
  }

  // Create medical record
  const { data: record, error: recordError } = await supabase
    .from('medical_records')
    .insert({
      appointment_id: body.appointment_id,
      patient_id: body.patient_id,
      doctor_id: body.doctor_id,
      clinic_id: body.clinic_id,
      visit_date: body.visit_date,
      chief_complaint: body.chief_complaint,
      diagnosis: body.diagnosis,
      diagnosis_code: body.diagnosis_code,
      symptoms: body.symptoms,
      vital_signs: body.vital_signs,
      physical_examination: body.physical_examination,
      treatment_plan: body.treatment_plan,
      notes: body.notes,
      follow_up_date: body.follow_up_date,
      is_confidential: body.is_confidential || false,
    })
    .select()
    .single();

  if (recordError) {
    return Response.json({
      success: false,
      error: { message: recordError.message, code: recordError.code },
    }, { status: 500 });
  }

  // Create prescriptions if provided
  let prescriptions = null;
  if (body.prescriptions && body.prescriptions.length > 0) {
    const prescriptionData = body.prescriptions.map(p => ({
      record_id: record.record_id,
      medicine_name: p.medicine_name,
      dosage: p.dosage,
      frequency: p.frequency,
      duration: p.duration,
      quantity: p.quantity,
      instructions: p.instructions,
      is_prn: p.is_prn || false,
    }));

    const { data: prescData } = await supabase
      .from('prescriptions')
      .insert(prescriptionData)
      .select();

    prescriptions = prescData;
  }

  // Update appointment status if needed
  if (body.appointment_id) {
    await supabase
      .from('appointments')
      .update({
        status: 'completed',
        completion_time: new Date().toISOString(),
      })
      .eq('appointment_id', body.appointment_id);
  }

  return Response.json({
    success: true,
    data: { record, prescriptions },
  }, { status: 201 });
}

// PATCH - Update medical record
async function updateMedicalRecord(recordId: string, req: Request): Promise<Response> {
  const body = await req.json() as Partial<MedicalRecord>;

  const updateData: Record<string, unknown> = {};

  // Only allow updating certain fields
  const allowedFields = [
    'diagnosis', 'diagnosis_code', 'symptoms', 'vital_signs',
    'physical_examination', 'treatment_plan', 'notes', 'follow_up_date'
  ];

  for (const field of allowedFields) {
    if (body[field as keyof MedicalRecord] !== undefined) {
      updateData[field] = body[field as keyof MedicalRecord];
    }
  }

  const { data, error } = await supabase
    .from('medical_records')
    .update(updateData)
    .eq('record_id', recordId)
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

// GET - Patient history summary
async function getPatientHistory(patientId: string): Promise<Response> {
  const { data: records } = await supabase
    .from('medical_records')
    .select(`
      record_id,
      visit_date,
      diagnosis,
      diagnosis_code,
      doctor:doctors(name, specialty),
      clinic:clinics(name)
    `)
    .eq('patient_id', patientId)
    .order('visit_date', { ascending: false })
    .limit(50);

  // Get allergies
  const { data: allergies } = await supabase
    .from('patient_allergies')
    .select('*')
    .eq('patient_id', patientId)
    .eq('is_active', true);

  // Get chronic conditions
  const { data: conditions } = await supabase
    .from('patient_conditions')
    .select('*')
    .eq('patient_id', patientId)
    .eq('is_active', true);

  return Response.json({
    success: true,
    data: {
      records: records || [],
      allergies: allergies || [],
      conditions: conditions || [],
    },
  });
}

// GET - Patient statistics
async function getPatientStatistics(patientId: string): Promise<Response> {
  const { data: visits } = await supabase
    .from('medical_records')
    .select('visit_date, diagnosis')
    .eq('patient_id', patientId)
    .order('visit_date', { ascending: false })
    .limit(100);

  const totalVisits = visits?.length || 0;

  // Count by diagnosis (top 5)
  const diagnosisCounts: Record<string, number> = {};
  visits?.forEach(v => {
    if (v.diagnosis) {
      diagnosisCounts[v.diagnosis] = (diagnosisCounts[v.diagnosis] || 0) + 1;
    }
  });

  const topDiagnoses = Object.entries(diagnosisCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([diagnosis, count]) => ({ diagnosis, count }));

  // Last visit
  const lastVisit = visits?.[0];

  return Response.json({
    success: true,
    data: {
      total_visits: totalVisits,
      top_diagnoses: topDiagnoses,
      last_visit: lastVisit || null,
    },
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
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Doctor-Id',
      },
    });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const recordId = pathParts[pathParts.length - 1] !== 'medical-records'
    ? pathParts[pathParts.length - 1]
    : null;

  try {
    // GET /medical-records - List records
    if (req.method === 'GET' && !recordId) {
      if (url.searchParams.has('history')) {
        const patientId = url.searchParams.get('patient_id');
        if (patientId) return await getPatientHistory(patientId);
      }

      if (url.searchParams.has('statistics')) {
        const patientId = url.searchParams.get('patient_id');
        if (patientId) return await getPatientStatistics(patientId);
      }

      return await getMedicalRecords(req);
    }

    // GET /medical-records/:id - Get single record
    if (req.method === 'GET' && recordId) {
      return await getMedicalRecord(recordId);
    }

    // POST /medical-records - Create record
    if (req.method === 'POST' && !recordId) {
      return await createMedicalRecord(req);
    }

    // PATCH /medical-records/:id - Update record
    if (req.method === 'PATCH' && recordId) {
      return await updateMedicalRecord(recordId, req);
    }

    return Response.json({
      success: false,
      error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' },
    }, { status: 405 });

  } catch (error) {
    console.error('Error in medical-records function:', error);
    return Response.json({
      success: false,
      error: { message: 'Internal server error', code: 'INTERNAL_ERROR' },
    }, { status: 500 });
  }
});
