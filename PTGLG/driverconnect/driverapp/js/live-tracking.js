/**
 * Live Tracking Module
 * Handles real-time location tracking with smart interval switching
 */

import { supabase } from '../../shared/config.js';
import { APP_CONFIG } from './config.js';
import { getCurrentPositionAsync } from './gps.js';

class LiveTracking {
  constructor() {
    this.supabase = supabase;
    this.userId = null;
    this.tripId = null;
    this.isTracking = false;
    this.isLiveMode = false;
    this.trackingInterval = null;
    this.realtimeChannel = null;
    this.lastPosition = null;
    this.localStorageKey = 'live_tracking_last_position';
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

    // Load last position from localStorage
    this.loadLastPositionFromStorage();

    // Subscribe to realtime changes for tracking flag
    this.subscribeToRealtimeUpdates();

    // Start tracking in normal mode
    this.startTracking();
  }

  /**
   * Load last position from localStorage
   */
  loadLastPositionFromStorage() {
    try {
      const stored = localStorage.getItem(this.localStorageKey);
      if (stored) {
        const data = JSON.parse(stored);
        // Check if data is not too old (max 24 hours)
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours in ms
        const age = Date.now() - new Date(data.timestamp).getTime();
        
        if (age < maxAge) {
          // Validate coordinates before using
          const { lat, lng } = data;
          
          if (!lat || !lng || lat === 0 || lng === 0) {
            console.warn('LiveTracking: Stored position is invalid (0,0), ignoring');
            this.lastPosition = null;
            localStorage.removeItem(this.localStorageKey);
            return;
          }
          
          if (lat < 5 || lat > 21 || lng < 97 || lng > 106) {
            console.warn('LiveTracking: Stored position out of Thailand bounds, ignoring');
            this.lastPosition = null;
            localStorage.removeItem(this.localStorageKey);
            return;
          }
          
          this.lastPosition = { lat, lng };
          console.log('LiveTracking: Loaded last position from storage:', this.lastPosition);
        } else {
          console.log('LiveTracking: Stored position is too old, ignoring');
          this.lastPosition = null;
          localStorage.removeItem(this.localStorageKey);
        }
      }
    } catch (error) {
      console.error('LiveTracking: Error loading position from storage:', error);
      this.lastPosition = null;
    }
  }

  /**
   * Save position to localStorage
   */
  saveLastPositionToStorage(lat, lng) {
    try {
      const data = {
        lat,
        lng,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(this.localStorageKey, JSON.stringify(data));
      console.log('LiveTracking: Saved position to storage');
    } catch (error) {
      console.error('LiveTracking: Error saving position to storage:', error);
    }
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
  async startTracking() {
    if (this.isTracking) {
      console.log('LiveTracking: Already tracking');
      return;
    }

    this.isTracking = true;
    console.log('LiveTracking: Started in NORMAL mode');
    
    // Wait for GPS to get first valid position before starting interval
    try {
      console.log('LiveTracking: Waiting for first GPS lock...');
      const position = await getCurrentPositionAsync();
      const { latitude, longitude } = position.coords;
      
      if (latitude && longitude && latitude !== 0 && longitude !== 0) {
        console.log(`LiveTracking: First GPS lock successful (${latitude}, ${longitude})`);
        // Start with normal interval
        this.switchMode(false);
      } else {
        console.warn('LiveTracking: Invalid first GPS position, will retry on interval');
        this.switchMode(false);
      }
    } catch (error) {
      console.error('LiveTracking: Failed to get first GPS position:', error);
      // Start interval anyway, will retry on each send
      this.switchMode(false);
    }
  }

  /**
   * Send current location to database
   */
  async sendLocation() {
    try {
      const position = await getCurrentPositionAsync();
      const { latitude, longitude } = position.coords;

      // Validate coordinates
      if (!latitude || !longitude || latitude === 0 || longitude === 0) {
        console.warn('LiveTracking: Invalid coordinates from GPS, trying fallback');
        await this.sendFallbackLocation();
        return;
      }

      // Check if coordinates are realistic (Thailand bounds: 5-21 lat, 97-106 lng)
      if (latitude < 5 || latitude > 21 || longitude < 97 || longitude > 106) {
        console.warn('LiveTracking: Coordinates out of Thailand bounds, trying fallback');
        await this.sendFallbackLocation();
        return;
      }

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
        // Update both memory and localStorage
        this.lastPosition = { lat: latitude, lng: longitude };
        this.saveLastPositionToStorage(latitude, longitude);
      }
    } catch (error) {
      console.error('LiveTracking: Failed to get GPS position:', error);
      await this.sendFallbackLocation();
    }
  }

  /**
   * Send fallback location (from memory or localStorage)
   */
  async sendFallbackLocation() {
    // If no lastPosition in memory, try loading from localStorage again
    if (!this.lastPosition) {
      this.loadLastPositionFromStorage();
    }

    if (this.lastPosition) {
      // Validate fallback position is not 0,0 and within Thailand
      const { lat, lng } = this.lastPosition;
      
      if (!lat || !lng || lat === 0 || lng === 0) {
        console.warn('LiveTracking: Fallback position is invalid (0,0), skipping');
        return;
      }
      
      if (lat < 5 || lat > 21 || lng < 97 || lng > 106) {
        console.warn('LiveTracking: Fallback position out of Thailand bounds, skipping');
        return;
      }
      
      console.log('LiveTracking: Using fallback position:', this.lastPosition);
      
      try {
        const { data, error } = await this.supabase
          .from('driver_live_locations')
          .upsert({
            driver_user_id: this.userId,
            trip_id: this.tripId,
            lat: lat,
            lng: lng,
            last_updated: new Date().toISOString()
          }, {
            onConflict: 'driver_user_id'
          });
        
        if (error) {
          console.error('LiveTracking: Error sending fallback location:', error);
        } else {
          console.log('LiveTracking: Fallback location sent successfully');
        }
      } catch (fallbackError) {
        console.error('LiveTracking: Failed to send fallback location:', fallbackError);
      }
    } else {
      console.warn('LiveTracking: No fallback position available, skipping this update');
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
