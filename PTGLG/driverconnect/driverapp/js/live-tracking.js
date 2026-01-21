/**
 * Live Tracking Module
 * Handles real-time location tracking with smart interval switching
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY, APP_CONFIG } from './config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { getCurrentPositionAsync } from './gps.js';

class LiveTracking {
  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    this.userId = null;
    this.tripId = null;
    this.isTracking = false;
    this.isLiveMode = false;
    this.trackingInterval = null;
    this.realtimeChannel = null;
    this.lastPosition = null;
  }

  /**
   * Initialize live tracking
   * @param {string} userId - LINE User ID
   * @param {number} tripId - Current trip ID (optional)
   */
  async init(userId, tripId = null) {
    if (!userId) {
      console.error('LiveTracking: userId is required');
      return;
    }

    this.userId = userId;
    this.tripId = tripId;

    console.log(`LiveTracking: Initializing for user ${userId}, trip ${tripId || 'N/A'}`);

    // Subscribe to realtime changes for tracking flag
    this.subscribeToRealtimeUpdates();

    // Start tracking in normal mode
    this.startTracking();
  }

  /**
   * Subscribe to Realtime updates for is_tracked_in_realtime flag
   */
  subscribeToRealtimeUpdates() {
    const channelName = `live-tracking-${this.userId}`;
    
    this.realtimeChannel = this.supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_live_locations',
          filter: `driver_user_id=eq.${this.userId}`
        },
        (payload) => {
          console.log('LiveTracking: Realtime update received:', payload);
          
          if (payload.new && payload.new.is_tracked_in_realtime !== undefined) {
            const shouldBeLive = payload.new.is_tracked_in_realtime;
            
            if (shouldBeLive !== this.isLiveMode) {
              console.log(`LiveTracking: Switching to ${shouldBeLive ? 'LIVE' : 'NORMAL'} mode`);
              this.switchMode(shouldBeLive);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('LiveTracking: Subscription status:', status);
      });
  }

  /**
   * Switch between live and normal tracking modes
   * @param {boolean} toLiveMode - true for live mode, false for normal
   */
  switchMode(toLiveMode) {
    this.isLiveMode = toLiveMode;
    
    // Clear existing interval
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }

    // Restart tracking with new interval
    if (this.isTracking) {
      const interval = toLiveMode 
        ? APP_CONFIG.LIVE_TRACKING.liveInterval 
        : APP_CONFIG.LIVE_TRACKING.normalInterval;

      console.log(`LiveTracking: Setting interval to ${interval}ms`);
      
      // Send location immediately
      this.sendLocation();
      
      // Set up recurring sends
      this.trackingInterval = setInterval(() => {
        this.sendLocation();
      }, interval);
    }
  }

  /**
   * Start tracking in normal mode
   */
  startTracking() {
    if (this.isTracking) {
      console.log('LiveTracking: Already tracking');
      return;
    }

    this.isTracking = true;
    console.log('LiveTracking: Started in NORMAL mode');
    
    // Start with normal interval
    this.switchMode(false);
  }

  /**
   * Send current location to database
   */
  async sendLocation() {
    try {
      const position = await getCurrentPositionAsync();
      const { latitude, longitude } = position.coords;

      console.log(`LiveTracking: Sending location (${latitude}, ${longitude})`);

      const { data, error } = await this.supabase
        .from('driver_live_locations')
        .upsert({
          driver_user_id: this.userId,
          trip_id: this.tripId,
          lat: latitude,
          lng: longitude,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'driver_user_id'
        });

      if (error) {
        console.error('LiveTracking: Error sending location:', error);
      } else {
        console.log('LiveTracking: Location sent successfully');
        this.lastPosition = { lat: latitude, lng: longitude };
      }
    } catch (error) {
      console.error('LiveTracking: Failed to get position:', error);
    }
  }

  /**
   * Stop tracking and cleanup
   */
  stop() {
    console.log('LiveTracking: Stopping');
    
    this.isTracking = false;
    
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }

    if (this.realtimeChannel) {
      this.supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
  }

  /**
   * Get current tracking status
   */
  getStatus() {
    return {
      isTracking: this.isTracking,
      isLiveMode: this.isLiveMode,
      userId: this.userId,
      tripId: this.tripId,
      lastPosition: this.lastPosition
    };
  }
}

// Export singleton instance
export const liveTracking = new LiveTracking();
