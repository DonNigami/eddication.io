/**
 * Shared configuration and types for ClinicConnect apps
 */

/**
 * Appointment status enum
 */
export enum AppointmentStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked_in',
  IN_CONSULTATION = 'in_consultation',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}

/**
 * Clinic role types
 */
export enum ClinicRole {
  ADMIN = 'admin',
  DOCTOR = 'doctor',
  NURSE = 'nurse',
  RECEPTIONIST = 'receptionist',
}

/**
 * Queue status
 */
export enum QueueStatus {
  WAITING = 'waiting',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
}

/**
 * Notification types
 */
export enum NotificationType {
  APPOINTMENT_REMINDER = 'appointment_reminder',
  QUEUE_UPDATE = 'queue_update',
  PRESCRIPTION_READY = 'prescription_ready',
  ANNOUNCEMENT = 'announcement',
}

/**
 * Type guard for appointment status
 */
export function isValidAppointmentStatus(status: string): status is AppointmentStatus {
  return Object.values(AppointmentStatus).includes(status as AppointmentStatus);
}

/**
 * Type guard for clinic role
 */
export function isValidClinicRole(role: string): role is ClinicRole {
  return Object.values(ClinicRole).includes(role as ClinicRole);
}
