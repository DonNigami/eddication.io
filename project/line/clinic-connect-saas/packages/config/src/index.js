/**
 * ClinicConnect SaaS - Shared Configuration
 *
 * Environment variables and shared constants
 */
// =====================================================
// SUPABASE CONFIG
// =====================================================
export const supabaseConfig = {
    url: import.meta.env.VITE_SUPABASE_URL || (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL : undefined) || '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_ANON_KEY : undefined) || '',
};
// =====================================================
// LINE CONFIG
// =====================================================
export const lineConfig = {
    liffId: import.meta.env.VITE_LINE_LIFF_ID || (typeof process !== 'undefined' ? process.env.VITE_LINE_LIFF_ID : undefined) || '',
    channelId: import.meta.env.VITE_LINE_CHANNEL_ID || (typeof process !== 'undefined' ? process.env.VITE_LINE_CHANNEL_ID : undefined) || '',
};
// =====================================================
// APP CONFIG
// =====================================================
export const appConfig = {
    name: 'ClinicConnect',
    version: '1.0.0',
    environment: import.meta.env.MODE || (typeof process !== 'undefined' ? process.env.NODE_ENV : undefined) || 'development',
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || (typeof process !== 'undefined' ? process.env.VITE_API_BASE_URL : undefined) || '/api',
};
// =====================================================
// APPOINTMENT STATUS
// =====================================================
export const AppointmentStatus = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    CHECKED_IN: 'checked_in',
    IN_CONSULTATION: 'in_consultation',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    NO_SHOW: 'no_show',
};
export const AppointmentStatusLabels = {
    pending: 'รอยืนยัน',
    confirmed: 'ยืนยันแล้ว',
    checked_in: 'เช็คอินแล้ว',
    in_consultation: 'กำลังพบแพทย์',
    completed: 'เสร็จสิ้น',
    cancelled: 'ยกเลิก',
    no_show: 'ไม่มา',
};
// =====================================================
// QUEUE STATUS
// =====================================================
export const QueueStatus = {
    WAITING: 'waiting',
    IN_QUEUE: 'in_queue',
    IN_ROOM: 'in_room',
    COMPLETED: 'completed',
    SKIPPED: 'skipped',
};
export const QueueStatusLabels = {
    waiting: 'รอคิว',
    in_queue: 'ในคิว',
    in_room: 'ในห้องตรวจ',
    completed: 'เสร็จสิ้น',
    skipped: 'ข้าม',
};
// =====================================================
// USER ROLES
// =====================================================
export const UserRole = {
    PATIENT: 'patient',
    DOCTOR: 'doctor',
    ADMIN: 'admin',
};
// =====================================================
// PAYMENT METHODS
// =====================================================
export const PaymentMethod = {
    LINE_PAY: 'line_pay',
    CREDIT_CARD: 'credit_card',
    PROMPTPAY: 'promptpay',
    CASH: 'cash',
    OTHER: 'other',
};
export const PaymentMethodLabels = {
    line_pay: 'LINE Pay',
    credit_card: 'บัตรเครดิต',
    promptpay: 'พร้อมเพย์',
    cash: 'เงินสด',
    other: 'อื่นๆ',
};
// =====================================================
// SUBSCRIPTION TIERS
// =====================================================
export const SubscriptionTier = {
    BASIC: 'basic',
    PRO: 'pro',
    CLINIC: 'clinic',
};
export const SubscriptionFeatures = {
    basic: {
        name: 'Basic',
        price: 1500,
        maxDoctors: 2,
        features: ['จองนัดหมาย', 'จัดการคิว', 'แจ้งเตือน LINE'],
    },
    pro: {
        name: 'Pro',
        price: 3000,
        maxDoctors: 5,
        features: ['จองนัดหมาย', 'จัดการคิว', 'แจ้งเตือน LINE', 'ประวัติการรักษา', 'บทความ'],
    },
    clinic: {
        name: 'Clinic',
        price: 5000,
        maxDoctors: 10,
        features: [
            'จองนัดหมาย',
            'จัดการคิว',
            'แจ้งเตือน LINE',
            'ประวัติการรักษา',
            'บทความ',
            'LINE Pay',
            'รายงาน',
            'รีวิว',
        ],
    },
};
// =====================================================
// TIME CONFIG
// =====================================================
export const TimeConfig = {
    appointmentDuration: 30, // minutes
    appointmentStartHour: 9,
    appointmentEndHour: 17,
    breakStartHour: 12,
    breakEndHour: 13,
    workingDays: [1, 2, 3, 4, 5], // 1=Monday, 5=Friday
};
// =====================================================
// LIFF ROUTES
// =====================================================
export const LiffRoutes = {
    HOME: '/home',
    BOOKING: '/booking',
    QUEUE: '/queue',
    RECORDS: '/records',
    NOTIFICATIONS: '/notifications',
    PROFILE: '/profile',
};
// Doctor LIFF Routes
export const DoctorLiffRoutes = {
    DASHBOARD: '/doctor/dashboard',
    QUEUE: '/doctor/queue',
    PATIENTS: '/doctor/patients',
    DIAGNOSIS: '/doctor/diagnosis',
    SCHEDULE: '/doctor/schedule',
};
// Admin Web Routes
export const AdminRoutes = {
    DASHBOARD: '/dashboard',
    DOCTORS: '/doctors',
    PATIENTS: '/patients',
    APPOINTMENTS: '/appointments',
    ARTICLES: '/articles',
    REPORTS: '/reports',
    SETTINGS: '/settings',
    REVIEWS: '/reviews',
    PAYMENTS: '/payments',
};
// =====================================================
// ERROR MESSAGES (Thai)
// =====================================================
export const ErrorMessages = {
    GENERIC: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
    NETWORK: 'ไม่สามารถเชื่อมต่อได้ กรุณาตรวจสอบอินเทอร์เน็ต',
    UNAUTHORIZED: 'กรุณาเข้าสู่ระบบ',
    NOT_FOUND: 'ไม่พบข้อมูล',
    INVALID_INPUT: 'ข้อมูลไม่ถูกต้อง',
    APPOINTMENT_NOT_AVAILABLE: 'ช่วงเวลานี้ไม่ว่าง',
    APPOINTMENT_ALREADY_BOOKED: 'ท่านมีนัดหมายในช่วงเวลานี้แล้ว',
    CANCELLATION_TOO_LATE: 'ยกเลิกนัดหมายได้ล่วงหน้าอย่างน้อย 3 ชั่วโมง',
};
// =====================================================
// SUCCESS MESSAGES (Thai)
// =====================================================
export const SuccessMessages = {
    APPOINTMENT_BOOKED: 'จองนัดหมายสำเร็จ',
    APPOINTMENT_CANCELLED: 'ยกเลิกนัดหมายสำเร็จ',
    APPOINTMENT_CONFIRMED: 'ยืนยันนัดหมายสำเร็จ',
    PROFILE_UPDATED: 'บันทึกข้อมูลสำเร็จ',
    CHECK_IN_SUCCESS: 'เช็คอินสำเร็จ',
};
// =====================================================
// EXPORT ALL
// =====================================================
export default {
    supabase: supabaseConfig,
    line: lineConfig,
    app: appConfig,
    time: TimeConfig,
};
