/**
 * Realtime Module
 * Handles Supabase realtime subscriptions
 */

import { supabase } from '../../shared/config.js';
import { showNotification } from './utils.js';
import { addNotificationToBell } from './notifications.js';
import { subscribeToHolidayWorkUpdates, unsubscribeFromHolidayWorkUpdates } from './holiday-work.js';

// Realtime channels
let jobActivityRealtimeChannel = null;

/**
 * Setup all realtime subscriptions
 */
export function setupRealtimeSubscriptions() {
    subscribeToJobActivityUpdates();
    subscribeToHolidayWorkUpdates();
    console.log('✅ Realtime subscriptions initialized');
}

/**
 * Cleanup all realtime subscriptions
 */
export function cleanupRealtimeSubscriptions() {
    unsubscribeFromJobActivityUpdates();
    unsubscribeFromHolidayWorkUpdates();
    console.log('👋 Realtime subscriptions cleaned up');
}

/**
 * Subscribe to job activity updates (checkin/checkout)
 */
function subscribeToJobActivityUpdates() {
    // Unsubscribe existing channel if any
    if (jobActivityRealtimeChannel) {
        supabase.removeChannel(jobActivityRealtimeChannel);
    }

    console.log('🔔 Subscribing to job activity updates...');

    jobActivityRealtimeChannel = supabase
        .channel('job-activity-changes')
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'jobdata'
            },
            (payload) => {
                console.log('🔔 Job activity detected:', payload);

                const oldData = payload.old;
                const newData = payload.new;

                // Check for checkin
                if (!oldData.checkin_time && newData.checkin_time) {
                    const message = `📍 Check-in: ${newData.reference} - ${newData.ship_to_name || 'จุดส่ง'}`;
                    console.log('✅ CHECKIN DETECTED:', message);
                    showNotification(message, 'info');
                    addNotificationToBell('checkin', 'Check-in สำเร็จ', message, { reference: newData.reference });
                }

                // Check for checkout
                if (!oldData.checkout_time && newData.checkout_time) {
                    const message = `✅ Check-out: ${newData.reference} - ${newData.ship_to_name || 'จุดส่ง'}`;
                    console.log('✅ CHECKOUT DETECTED:', message);
                    showNotification(message, 'success');
                    addNotificationToBell('checkout', 'Check-out สำเร็จ', message, { reference: newData.reference });
                }

                // Check for trip completion
                if (!oldData.trip_ended && newData.trip_ended) {
                    const message = `🎉 Trip จบแล้ว: ${newData.reference}`;
                    console.log('✅ TRIP END DETECTED:', message);
                    showNotification(message, 'success');
                    addNotificationToBell('trip-end', 'Trip เสร็จสมบูรณ์', message, { reference: newData.reference });
                }
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ Subscribed to job activity updates');
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.error('❌ Failed to subscribe to job activity updates');
                // Retry after 5 seconds
                setTimeout(() => {
                    console.log('🔄 Retrying job activity subscription...');
                    subscribeToJobActivityUpdates();
                }, 5000);
            }
        });
}

/**
 * Unsubscribe from job activity updates
 */
function unsubscribeFromJobActivityUpdates() {
    if (jobActivityRealtimeChannel) {
        console.log('👋 Unsubscribing from job activity updates...');
        supabase.removeChannel(jobActivityRealtimeChannel);
        jobActivityRealtimeChannel = null;
    }
}
