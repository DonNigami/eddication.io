/**
 * =====================================================
 * CLINIC CONNECT SAAS - SHARED CONFIGURATION
 * =====================================================
 */

const AppConfig = {
  // LIFF Configuration
  liff: {
    id: 'YOUR_LIFF_ID_HERE', // TODO: Replace with actual LIFF ID
  },

  // Supabase Configuration
  supabase: {
    url: 'YOUR_SUPABASE_URL', // TODO: Replace with actual Supabase URL
    anonKey: 'YOUR_SUPABASE_ANON_KEY' // TODO: Replace with actual Anon Key
  },

  // App Routes
  routes: {
    base: 'https://donnigami.github.io/eddication.io/project/line/clinic-connect-saas/apps',
    patient: '#/patient',
    doctor: '#/doctor',
    login: '#/',
  },

  // API Endpoints
  api: {
    // Supabase Edge Functions
    baseUrl: '', // Will be set from supabase.url
    appointments: '/rest/v1/appointments',
    doctors: '/rest/v1/doctors',
    patients: '/rest/v1/patients',
    queues: '/rest/v1/queues',
    schedules: '/rest/v1/doctor_schedules',

    // Edge Functions
    webhook: '/functions/v1/line-webhook',
    lineLogin: '/functions/v1/line-login',
    availableSlots: '/functions/v1/available-slots',
  },

  // Role Configuration
  roles: {
    patient: 'patient',
    doctor: 'doctor',
    admin: 'admin',
    staff: 'staff'
  },

  // Appointment Status
  appointmentStatus: {
    pending: 'pending',
    confirmed: 'confirmed',
    inProgress: 'in_progress',
    completed: 'completed',
    cancelled: 'cancelled',
    noShow: 'no_show'
  },

  // Queue Status
  queueStatus: {
    waiting: 'waiting',
    called: 'called',
    inRoom: 'in_room',
    completed: 'completed',
    skipped: 'skipped'
  },

  // UI Configuration
  ui: {
    itemsPerPage: 20,
    maxRetries: 3,
    timeout: 30000,
    refreshInterval: 30000, // 30 seconds
  },

  // Time Slots
  timeSlots: [
    '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '13:00', '13:30',
    '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30'
  ],

  // Working Days
  workingDays: [1, 2, 3, 4, 5], // Mon-Fri

  // Break Time
  breakTime: {
    start: '12:00',
    end: '13:00'
  }
};

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AppConfig;
}

// Auto-export to window for browser
if (typeof window !== 'undefined') {
  window.AppConfig = AppConfig;
}
// trigger deploy
