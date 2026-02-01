/**
 * Shared configuration and types for ClinicConnect apps
 */
/**
 * Appointment status enum
 */
export var AppointmentStatus;
(function (AppointmentStatus) {
    AppointmentStatus["PENDING"] = "pending";
    AppointmentStatus["CONFIRMED"] = "confirmed";
    AppointmentStatus["CHECKED_IN"] = "checked_in";
    AppointmentStatus["IN_CONSULTATION"] = "in_consultation";
    AppointmentStatus["COMPLETED"] = "completed";
    AppointmentStatus["CANCELLED"] = "cancelled";
    AppointmentStatus["NO_SHOW"] = "no_show";
})(AppointmentStatus || (AppointmentStatus = {}));
/**
 * Clinic role types
 */
export var ClinicRole;
(function (ClinicRole) {
    ClinicRole["ADMIN"] = "admin";
    ClinicRole["DOCTOR"] = "doctor";
    ClinicRole["NURSE"] = "nurse";
    ClinicRole["RECEPTIONIST"] = "receptionist";
})(ClinicRole || (ClinicRole = {}));
/**
 * Queue status
 */
export var QueueStatus;
(function (QueueStatus) {
    QueueStatus["WAITING"] = "waiting";
    QueueStatus["ACTIVE"] = "active";
    QueueStatus["PAUSED"] = "paused";
    QueueStatus["COMPLETED"] = "completed";
})(QueueStatus || (QueueStatus = {}));
/**
 * Notification types
 */
export var NotificationType;
(function (NotificationType) {
    NotificationType["APPOINTMENT_REMINDER"] = "appointment_reminder";
    NotificationType["QUEUE_UPDATE"] = "queue_update";
    NotificationType["PRESCRIPTION_READY"] = "prescription_ready";
    NotificationType["ANNOUNCEMENT"] = "announcement";
})(NotificationType || (NotificationType = {}));
/**
 * Type guard for appointment status
 */
export function isValidAppointmentStatus(status) {
    return Object.values(AppointmentStatus).includes(status);
}
/**
 * Type guard for clinic role
 */
export function isValidClinicRole(role) {
    return Object.values(ClinicRole).includes(role);
}
