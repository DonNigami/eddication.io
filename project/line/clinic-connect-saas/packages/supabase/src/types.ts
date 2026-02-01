/**
 * ClinicConnect SaaS - Database Types
 *
 * TypeScript types matching the Supabase database schema
 */

// =====================================================
// USER & AUTH TYPES
// =====================================================

export interface User {
  user_id: string;
  clinic_id: string;
  line_user_id?: string;
  email?: string;
  phone?: string;
  name?: string;
  role: 'patient' | 'doctor' | 'admin';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LineUser {
  line_user_id: string;
  user_id?: string;
  display_name?: string;
  picture_url?: string;
  status_message?: string;
  linked_at: string;
  updated_at: string;
}

// =====================================================
// CLINIC TYPES
// =====================================================

export interface Clinic {
  clinic_id: string;
  name: string;
  name_en?: string;
  slug: string;
  phone: string;
  email?: string;
  address?: string;
  province?: string;
  district?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  logo_url?: string;
  description?: string;
  operating_hours?: Record<string, { open: string; close: string }>;
  subscription_tier: 'basic' | 'pro' | 'clinic';
  subscription_status: 'active' | 'cancelled' | 'expired' | 'trial';
  subscription_expires_at?: string;
  created_at: string;
  updated_at: string;
}

// =====================================================
// DOCTOR TYPES
// =====================================================

export interface Doctor {
  doctor_id: string;
  clinic_id: string;
  user_id?: string;
  license_no: string;
  name: string;
  name_en?: string;
  specialty?: string;
  qualifications?: string[];
  photo_url?: string;
  biography?: string;
  is_available: boolean;
  consultation_fee: number;
  consultation_duration: number;
  working_days: number[];
  working_hours: { start: string; end: string };
  created_at: string;
  updated_at: string;
}

export interface DoctorBlockedDate {
  block_id: string;
  doctor_id: string;
  block_date: string;
  block_type: 'full_day' | 'time_range';
  start_time?: string;
  end_time?: string;
  reason?: string;
  created_at: string;
  created_by: string;
}

// =====================================================
// PATIENT TYPES
// =====================================================

export interface Patient {
  patient_id: string;
  clinic_id: string;
  user_id?: string;
  line_user_id?: string;
  hn_id?: string; // Hospital Number
  name: string;
  phone: string;
  email?: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other';
  id_card?: string;
  address?: string;
  blood_type?: string;
  allergies?: string;
  chronic_diseases?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  total_visits: number;
  last_visit_date?: string;
  created_at: string;
  updated_at: string;
}

// =====================================================
// APPOINTMENT TYPES
// =====================================================

export interface Appointment {
  appointment_id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  appointment_time: string;
  end_time?: string;
  status: 'pending' | 'confirmed' | 'checked_in' | 'in_consultation' | 'completed' | 'cancelled' | 'no_show';
  queue_number?: number;
  notes?: string;
  symptoms?: string;
  check_in_time?: string;
  start_time?: string;
  completion_time?: string;
  cancellation_reason?: string;
  cancelled_at?: string;
  cancelled_by?: string;
  created_at: string;
  updated_at: string;
  // Joined relations
  patient?: Patient;
  doctor?: Doctor;
}

export interface AppointmentSlot {
  slot_id: string;
  doctor_id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
  appointment_id?: string;
  created_at: string;
  updated_at: string;
}

// =====================================================
// QUEUE TYPES
// =====================================================

export interface QueueManagement {
  queue_id: string;
  clinic_id: string;
  doctor_id: string;
  date: string;
  current_queue: number;
  waiting_count: number;
  in_consultation_count: number;
  completed_count: number;
  estimated_wait_time: number;
  last_updated: string;
  created_at: string;
  updated_at: string;
}

// =====================================================
// MEDICAL RECORD TYPES
// =====================================================

export interface MedicalRecord {
  record_id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id?: string;
  visit_date: string;
  chief_complaint?: string;
  symptoms?: string;
  diagnosis?: string;
  treatment?: string;
  notes?: string;
  vital_signs?: {
    blood_pressure_systolic?: number;
    blood_pressure_diastolic?: number;
    heart_rate?: number;
    temperature?: number;
    weight?: number;
    height?: number;
  };
  follow_up_date?: string;
  created_at: string;
  updated_at: string;
}

// =====================================================
// PRESCRIPTION TYPES
// =====================================================

export interface Prescription {
  prescription_id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id?: string;
  prescribed_at: string;
  notes?: string;
  created_at: string;
  // Joined relations
  items?: PrescriptionItem[];
}

export interface PrescriptionItem {
  item_id: string;
  prescription_id: string;
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions?: string;
}

// =====================================================
// PAYMENT TYPES
// =====================================================

export interface Payment {
  payment_id: string;
  clinic_id: string;
  appointment_id?: string;
  patient_id: string;
  amount: number;
  method: 'line_pay' | 'credit_card' | 'promptpay' | 'cash' | 'other';
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  transaction_id?: string;
  paid_at?: string;
  refunded_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// =====================================================
// NOTIFICATION TYPES
// =====================================================

export interface Notification {
  notification_id: string;
  clinic_id: string;
  user_id?: string;
  line_user_id?: string;
  type: 'appointment_reminder' | 'queue_update' | 'payment_request' | 'promotional' | 'system';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  is_read: boolean;
  sent_via_line: boolean;
  sent_at?: string;
  created_at: string;
}

// =====================================================
// CONTENT TYPES
// =====================================================

export interface Article {
  article_id: string;
  clinic_id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  featured_image_url?: string;
  category?: string;
  tags?: string[];
  author_id: string;
  is_published: boolean;
  published_at?: string;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface Review {
  review_id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id?: string;
  appointment_id?: string;
  rating: number;
  comment?: string;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

// =====================================================
// SUBSCRIPTION TYPES
// =====================================================

export interface Subscription {
  subscription_id: string;
  clinic_id: string;
  tier: 'basic' | 'pro' | 'clinic';
  status: 'active' | 'cancelled' | 'expired' | 'trial';
  start_date: string;
  end_date?: string;
  billing_cycle: 'monthly' | 'yearly';
  amount: number;
  auto_renew: boolean;
  created_at: string;
  updated_at: string;
}

// =====================================================
// LOG TYPES
// =====================================================

export interface UsageLog {
  log_id: string;
  clinic_id: string;
  user_id?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface AdminLog {
  log_id: string;
  clinic_id: string;
  admin_id: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  changes?: Record<string, { from: unknown; to: unknown }>;
  ip_address?: string;
  created_at: string;
}

// =====================================================
// LINE CONFIG TYPES
// =====================================================

export interface LineConfig {
  config_id: string;
  clinic_id: string;
  channel_id: string;
  channel_secret: string;
  liff_id: string;
  webhook_url: string;
  rich_menu_default?: string;
  rich_menu_patient?: string;
  rich_menu_doctor?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConversationState {
  state_id: string;
  line_user_id: string;
  clinic_id: string;
  state: 'booking_doctor' | 'booking_date' | 'booking_time' | 'booking_confirm' | 'cancel_appointment' | 'none';
  data?: Record<string, unknown>;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface MessageLog {
  log_id: string;
  clinic_id: string;
  line_user_id: string;
  direction: 'inbound' | 'outbound';
  event_type: string;
  message_id?: string;
  reply_token?: string;
  content?: Record<string, unknown>;
  status: 'pending' | 'sent' | 'failed';
  error_message?: string;
  created_at: string;
}

export interface RichMenuAssignment {
  assignment_id: string;
  line_user_id: string;
  rich_menu_id: string;
  menu_type: 'default' | 'patient' | 'doctor';
  assigned_at: string;
  expires_at?: string;
}

export interface BroadcastCampaign {
  campaign_id: string;
  clinic_id: string;
  name: string;
  message_type: 'text' | 'flex' | 'image';
  content: Record<string, unknown>;
  target_type: 'all' | 'patients' | 'doctors' | 'custom';
  target_filter?: Record<string, unknown>;
  scheduled_at?: string;
  sent_at?: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// =====================================================
// API RESPONSE TYPES
// =====================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// =====================================================
// FORM TYPES
// =====================================================

export interface BookingFormData {
  doctor_id: string;
  date: string;
  time: string;
  symptoms?: string;
  notes?: string;
}

export interface PatientFormData {
  name: string;
  phone: string;
  email?: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other';
  id_card?: string;
  blood_type?: string;
  allergies?: string;
  chronic_diseases?: string;
}

export interface DoctorFormData {
  license_no: string;
  name: string;
  specialty?: string;
  qualifications?: string[];
  consultation_fee: number;
  consultation_duration?: number;
  working_days?: number[];
  working_hours?: { start: string; end: string };
  biography?: string;
}

export interface ClinicFormData {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  province?: string;
  district?: string;
  postal_code?: string;
  operating_hours?: Record<string, { open: string; close: string }>;
}

// =====================================================
// EXPORT ALL
// =====================================================

export type {
  User,
  LineUser,
  Clinic,
  Doctor,
  DoctorBlockedDate,
  Patient,
  Appointment,
  AppointmentSlot,
  QueueManagement,
  MedicalRecord,
  Prescription,
  PrescriptionItem,
  Payment,
  Notification,
  Article,
  Review,
  Subscription,
  UsageLog,
  AdminLog,
  LineConfig,
  ConversationState,
  MessageLog,
  RichMenuAssignment,
  BroadcastCampaign,
  ApiResponse,
  PaginatedResponse,
  BookingFormData,
  PatientFormData,
  DoctorFormData,
  ClinicFormData,
};
