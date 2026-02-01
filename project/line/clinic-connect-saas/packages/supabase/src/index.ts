/**
 * ClinicConnect SaaS - Supabase Package
 *
 * Main export file for Supabase utilities
 */

// Client creation
export {
  createBrowserClient,
  createServerClient,
  createServiceClient,
  getBrowserClient,
} from './client';

export type { Database, SupabaseClient } from './client';

// Types
export type * from './types';

// Queries
export * from './queries/appointments';
export * from './queries/patients';
export * from './queries/doctors';
export * from './queries/queue';

// Realtime helpers
export { subscribeToAppointments, subscribeToQueue, subscribeToNotifications } from './realtime';

// Auth helpers
export {
  signInWithLine,
  signOut,
  getCurrentUser,
  linkLineAccount,
} from './auth';
