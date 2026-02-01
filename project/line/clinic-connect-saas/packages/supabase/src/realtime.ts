/**
 * Realtime Subscriptions
 * Helper functions for Supabase Realtime subscriptions
 */

import { getBrowserClient } from './client';
import type { RealtimeChannel } from '@supabase/supabase-js';

const supabase = getBrowserClient();

// =====================================================
// APPOINTMENT SUBSCRIPTIONS
// =====================================================

export interface AppointmentSubscriptionCallbacks {
  onInsert?: (appointment: any) => void;
  onUpdate?: (appointment: any) => void;
  onDelete?: (appointment: any) => void;
}

export function subscribeToAppointments(
  filters: { clinicId?: string; doctorId?: string; patientId?: string },
  callbacks: AppointmentSubscriptionCallbacks
): RealtimeChannel {
  let query = supabase.channel('appointments-channel');

  const filterConditions: string[] = [];
  if (filters.clinicId) filterConditions.push(`clinic_id=eq.${filters.clinicId}`);
  if (filters.doctorId) filterConditions.push(`doctor_id=eq.${filters.doctorId}`);
  if (filters.patientId) filterConditions.push(`patient_id=eq.${filters.patientId}`);

  const filterString = filterConditions.length > 0 ? `&${filterConditions.join('&')}` : '';

  query = query
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'appointments',
        filter: filterString || undefined,
      },
      (payload) => {
        callbacks.onInsert?.(payload.new);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'appointments',
        filter: filterString || undefined,
      },
      (payload) => {
        callbacks.onUpdate?.(payload.new);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'appointments',
        filter: filterString || undefined,
      },
      (payload) => {
        callbacks.onDelete?.(payload.old);
      }
    )
    .subscribe();

  return query;
}

// =====================================================
// QUEUE SUBSCRIPTIONS
// =====================================================

export interface QueueSubscriptionCallbacks {
  onUpdate?: (queue: any) => void;
}

export function subscribeToQueue(
  doctorId: string,
  callbacks: QueueSubscriptionCallbacks
): RealtimeChannel {
  const channel = supabase
    .channel(`queue-${doctorId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'queue_management',
        filter: `doctor_id=eq.${doctorId}`,
      },
      (payload) => {
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          callbacks.onUpdate?.(payload.new);
        }
      }
    )
    .subscribe();

  return channel;
}

// =====================================================
// NOTIFICATION SUBSCRIPTIONS
// =====================================================

export interface NotificationSubscriptionCallbacks {
  onInsert?: (notification: any) => void;
}

export function subscribeToNotifications(
  userId: string | undefined,
  lineUserId: string | undefined,
  callbacks: NotificationSubscriptionCallbacks
): RealtimeChannel {
  let filterString = '';

  if (userId) {
    filterString = `user_id=eq.${userId}`;
  } else if (lineUserId) {
    filterString = `line_user_id=eq.${lineUserId}`;
  }

  const channel = supabase
    .channel('notifications-channel')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: filterString || undefined,
      },
      (payload) => {
        callbacks.onInsert?.(payload.new);
      }
    )
    .subscribe();

  return channel;
}

// =====================================================
// UNSUBSCRIBE HELPER
// =====================================================

export function unsubscribeAll(): void {
  supabase.removeAllChannels();
}

export function unsubscribeChannel(channel: RealtimeChannel): void {
  supabase.removeChannel(channel);
}
