/**
 * Real-Time Fleet Dashboard for DriverConnect
 * Live monitoring of drivers, jobs, and exceptions
 *
 * Works with Supabase Free Plan Realtime features
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  window.CONFIG.SUPABASE_URL,
  window.CONFIG.SUPABASE_KEY
);

/**
 * Fleet Dashboard State
 */
const FleetDashboard = {
  state: {
    activeDrivers: 0,
    totalJobsToday: 0,
    completedJobs: 0,
    exceptionCount: 0,
    avgResponseTime: 0,
    driverLocations: [],
    criticalAlerts: [],
    subscriptions: []
  },

  /**
   * Initialize Dashboard
   */
  async init() {
    console.log('🚗 Initializing Fleet Dashboard...');

    // Load initial data
    await this.loadInitialData();

    // Setup real-time subscriptions
    this.setupRealtimeSubscriptions();

    // Start periodic updates
    this.startPeriodicUpdates();

    console.log('✅ Fleet Dashboard initialized');
  },

  /**
   * Load Initial Data
   */
  async loadInitialData() {
    try {
      // Load active jobs
      const { data: activeJobs } = await supabase
        .from('jobdata')
        .select('id, reference, driver_id, status, created_at')
        .in('status', ['assigned', 'in_progress']);

      this.state.totalJobsToday = activeJobs?.length || 0;
      this.state.completedJobs = activeJobs?.filter(j => j.status === 'completed').length || 0;

      // Load driver locations
      const { data: locations } = await supabase
        .from('driver_live_locations')
        .select('*')
        .gte('last_updated', new Date(Date.now() - 3600000).toISOString()); // Last hour

      this.state.driverLocations = locations || [];

      // Load open exceptions
      const { data: exceptions } = await supabase
        .from('job_exceptions')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false });

      this.state.exceptionCount = exceptions?.length || 0;
      this.state.criticalAlerts = exceptions?.filter(e => e.severity === 'critical') || [];

      // Update UI
      this.updateKPIs();
      this.updateMap();
      this.updateAlerts();

    } catch (error) {
      console.error('❌ Failed to load initial data:', error);
    }
  },

  /**
   * Setup Real-time Subscriptions
   */
  setupRealtimeSubscriptions() {
    console.log('📡 Setting up realtime subscriptions...');

    // Subscribe to driver location updates
    const locationSubscription = supabase
      .channel('driver-locations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_live_locations'
        },
        (payload) => {
          console.log('📍 Location update:', payload);
          this.handleLocationUpdate(payload);
        }
      )
      .subscribe((status) => {
        console.log(`Location subscription status: ${status}`);
      });

    this.state.subscriptions.push(locationSubscription);

    // Subscribe to job status updates
    const jobSubscription = supabase
      .channel('job-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobdata'
        },
        (payload) => {
          console.log('📦 Job update:', payload);
          this.handleJobUpdate(payload);
        }
      )
      .subscribe();

    this.state.subscriptions.push(jobSubscription);

    // Subscribe to new exceptions
    const exceptionSubscription = supabase
      .channel('exception-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_exceptions'
        },
        (payload) => {
          console.log('🚨 New exception:', payload);
          this.handleNewException(payload.new);
        }
      )
      .subscribe();

    this.state.subscriptions.push(exceptionSubscription);

    console.log(`✅ ${this.state.subscriptions.length} subscriptions active`);
  },

  /**
   * Handle Location Update
   */
  handleLocationUpdate(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    if (eventType === 'INSERT') {
      this.state.driverLocations.push(newRecord);
    } else if (eventType === 'UPDATE') {
      const index = this.state.driverLocations.findIndex(
        loc => loc.driver_id === newRecord.driver_id
      );
      if (index !== -1) {
        this.state.driverLocations[index] = newRecord;
      }
    } else if (eventType === 'DELETE') {
      this.state.driverLocations = this.state.driverLocations.filter(
        loc => loc.driver_id !== oldRecord.driver_id
      );
    }

    this.updateMap();
  },

  /**
   * Handle Job Status Update
   */
  handleJobUpdate(payload) {
    const { new: newRecord, old: oldRecord } = payload;

    // Update counters
    if (oldRecord.status !== 'completed' && newRecord.status === 'completed') {
      this.state.completedJobs++;
    }

    this.updateKPIs();
  },

  /**
   * Handle New Exception
   */
  handleNewException(exception) {
    this.state.exceptionCount++;

    if (exception.severity === 'critical') {
      this.state.criticalAlerts.push(exception);

      // Play alert sound
      this.playAlertSound();

      // Show desktop notification
      this.showDesktopNotification(exception);
    }

    this.updateAlerts();
    this.updateKPIs();
  },

  /**
   * Update KPI Cards
   */
  updateKPIs() {
    // Active Drivers
    const activeDriversEl = document.getElementById('activeDrivers');
    if (activeDriversEl) {
      this.animateValue(activeDriversEl, parseInt(activeDriversEl.textContent) || 0, this.state.driverLocations.length, 500);
    }

    // Total Jobs Today
    const totalJobsEl = document.getElementById('todayJobs');
    if (totalJobsEl) {
      totalJobsEl.textContent = this.state.totalJobsToday;
    }

    // Completed Jobs
    const completedJobsEl = document.getElementById('completedJobs');
    if (completedJobsEl) {
      const percentage = this.state.totalJobsToday > 0
        ? Math.round((this.state.completedJobs / this.state.totalJobsToday) * 100)
        : 0;
      completedJobsEl.textContent = `${this.state.completedJobs}/${this.state.totalJobsToday} (${percentage}%)`;

      // Update progress bar
      const progressBar = document.getElementById('jobsProgress');
      if (progressBar) {
        progressBar.style.width = `${percentage}%`;
      }
    }

    // Exception Count
    const exceptionsEl = document.getElementById('exceptions');
    if (exceptionsEl) {
      exceptionsEl.textContent = this.state.exceptionCount;

      // Add critical indicator
      if (this.state.criticalAlerts.length > 0) {
        exceptionsEl.classList.add('critical');
        exceptionsEl.innerHTML = `🚨 ${this.state.exceptionCount}`;
      }
    }

    // Average Response Time (mock for now)
    const avgResponseTimeEl = document.getElementById('avgResponseTime');
    if (avgResponseTimeEl) {
      avgResponseTimeEl.textContent = '2.3 นาที';
    }
  },

  /**
   * Update Map Markers
   */
  updateMap() {
    // This would integrate with your existing map.js
    console.log(`🗺️  Updating ${this.state.driverLocations.length} markers`);

    // Emit custom event for map module
    window.dispatchEvent(new CustomEvent('fleetLocationsUpdate', {
      detail: { locations: this.state.driverLocations }
    }));
  },

  /**
   * Update Alerts Panel
   */
  updateAlerts() {
    const alertsList = document.getElementById('alertsList');
    if (!alertsList) return;

    if (this.state.criticalAlerts.length === 0) {
      alertsList.innerHTML = '<p class="no-alerts">ไม่มีการแจ้งเตือนขณะนี้</p>';
      return;
    }

    alertsList.innerHTML = this.state.criticalAlerts.map(alert => `
      <div class="alert-item critical" data-id="${alert.id}">
        <div class="alert-icon">🚨</div>
        <div class="alert-content">
          <div class="alert-title">${alert.message_th}</div>
          <div class="alert-time">${this.formatTimeAgo(alert.created_at)}</div>
          <div class="alert-driver">Driver ID: ${alert.driver_id}</div>
        </div>
        <div class="alert-actions">
          <button class="btn-view-map" data-lat="${alert.location?.latitude}" data-lng="${alert.location?.longitude}">
            📍
          </button>
          <button class="btn-resolve" data-id="${alert.id}">
            ✅
          </button>
        </div>
      </div>
    `).join('');

    // Add event listeners
    alertsList.querySelectorAll('.btn-resolve').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const exceptionId = e.target.dataset.id;
        this.resolveException(exceptionId);
      });
    });
  },

  /**
   * Resolve Exception
   */
  async resolveException(exceptionId) {
    try {
      const { error } = await supabase
        .from('job_exceptions')
        .update({
          status: 'resolved',
          resolved_by: window.currentUser.id,
          resolved_at: new Date().toISOString()
        })
        .eq('id', exceptionId);

      if (error) throw error;

      // Remove from local state
      this.state.criticalAlerts = this.state.criticalAlerts.filter(a => a.id !== exceptionId);
      this.state.exceptionCount--;

      this.updateAlerts();
      this.updateKPIs();

      // Show notification
      showNotification('✅ แก้ไขปัญหาเรียบร้อย', 'success');

    } catch (error) {
      console.error('Failed to resolve exception:', error);
      showNotification('❌ แก้ไขปัญหาไม่สำเร็จ', 'error');
    }
  },

  /**
   * Play Alert Sound
   */
  playAlertSound() {
    const audio = new Audio('/sounds/alert.mp3');
    audio.play().catch(e => console.log('Could not play alert sound:', e));
  },

  /**
   * Show Desktop Notification
   */
  showDesktopNotification(exception) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('🚨 แจ้งเตือนฉุกเฉิน', {
        body: exception.message_th,
        icon: '/icon-192.png',
        tag: exception.id,
        requireInteraction: true
      });
    }
  },

  /**
   * Start Periodic Updates
   */
  startPeriodicUpdates() {
    // Refresh data every 30 seconds
    setInterval(() => {
      this.loadInitialData();
    }, 30000);
  },

  /**
   * Animate Value Change
   */
  animateValue(element, start, end, duration) {
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;

    const timer = setInterval(() => {
      current += increment;
      if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
        current = end;
        clearInterval(timer);
      }
      element.textContent = Math.round(current);
    }, 16);
  },

  /**
   * Format Time Ago
   */
  formatTimeAgo(timestamp) {
    const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);

    if (seconds < 60) return 'เมื่อกี้';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} นาทีที่แล้ว`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} ชั่วโมงที่แล้ว`;
    return `${Math.floor(seconds / 86400)} วันที่แล้ว`;
  },

  /**
   * Cleanup
   */
  destroy() {
    console.log('🧹 Cleaning up Fleet Dashboard...');

    // Unsubscribe from all channels
    this.state.subscriptions.forEach(subscription => {
      supabase.removeChannel(subscription);
    });

    this.state.subscriptions = [];
  }
};

// Export for use in main.js
window.FleetDashboard = FleetDashboard;

// Auto-initialize if on dashboard page
if (document.getElementById('fleetDashboard')) {
  FleetDashboard.init();
}
