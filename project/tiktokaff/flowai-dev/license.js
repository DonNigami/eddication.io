/**
 * License Module - DISABLED
 * License system has been removed - all features are now free
 * Created by eddication
 */
const License = {
  BASE_URL: '',
  PROGRAM_SLUG: 'eddication-flow-ai',
  machineId: null,
  licenseKey: 'FREE-VERSION',
  programInfo: null,
  heartbeatInterval: null,

  /**
   * Initialize license module (disabled - auto-activate)
   */
  async init() {
    // License system disabled - auto-activate
    this.machineId = 'eddication-free';
    this.licenseKey = 'FREE-VERSION';
    // Skip license verification and show app immediately
    this.hideOverlay();
    return;
  },

  /**
   * Generate unique machine ID for Chrome Extension
   * Uses WebGL GPU info (hardware-based, consistent across profiles)
   */
  async getMachineId() {
    // Get WebGL renderer info (GPU hardware - consistent across profiles)
    let gpuInfo = 'unknown-gpu';
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
          const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          gpuInfo = `${vendor}-${renderer}`;
        }
      }
    } catch (e) {
      console.warn('Could not get WebGL info:', e);
    }

    // Combine with other hardware info
    const platform = navigator.platform;
    const hardwareConcurrency = navigator.hardwareConcurrency || 0;
    const deviceMemory = navigator.deviceMemory || 0;

    // Create fingerprint from hardware info
    const rawId = `TIKTOK-${platform}-${gpuInfo}-${hardwareConcurrency}-${deviceMemory}`;

    // Hash using SHA-256
    const encoder = new TextEncoder();
    const data = encoder.encode(rawId);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const machineId = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);

    return machineId;
  },

  /**
   * Load license key from storage (disabled)
   */
  async loadLicenseKey() {
    // License system disabled - always return FREE-VERSION
    this.licenseKey = 'FREE-VERSION';
    return this.licenseKey;
  },

  /**
   * Save license key to storage (disabled)
   */
  async saveLicenseKey(key) {
    // License system disabled - do nothing
    this.licenseKey = 'FREE-VERSION';
  },

  /**
   * Clear license data (disabled)
   */
  async clearLicense() {
    // License system disabled - do nothing
    this.licenseKey = 'FREE-VERSION';
  },

  /**
   * Get device info
   */
  getDeviceInfo() {
    const platform = navigator.platform;
    const userAgent = navigator.userAgent;

    let osInfo = 'Unknown OS';
    if (userAgent.includes('Windows')) {
      osInfo = 'Windows';
    } else if (userAgent.includes('Mac')) {
      osInfo = 'macOS';
    } else if (userAgent.includes('Linux')) {
      osInfo = 'Linux';
    } else if (userAgent.includes('CrOS')) {
      osInfo = 'Chrome OS';
    }

    return {
      deviceName: `Chrome Extension (${platform})`,
      osInfo: osInfo
    };
  },

  /**
   * Verify license with server (disabled - always returns valid)
   */
  async verify(licenseKey = null) {
    // License system disabled - always return valid
    this.licenseKey = 'FREE-VERSION';
    return {
      valid: true,
      code: 'FREE_VERSION',
      message: 'Free version - all features unlocked',
      program: {
        name: 'Eddication Flow AI',
        version: '4.0',
        features: ['all']
      }
    };
  },

  /**
   * Activate license on this device (disabled)
   */
  async activate() {
    // License system disabled - always return success
    this.licenseKey = 'FREE-VERSION';
    return {
      success: true,
      code: 'FREE_VERSION',
      message: 'Free version activated',
      program: {
        name: 'Eddication Flow AI',
        version: '4.0'
      }
    };
  },
  const response = await fetch(`${this.BASE_URL}/api/licenses/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      license_key: this.licenseKey,
      machine_id: this.machineId,
      device_name: deviceInfo.deviceName,
      os_info: deviceInfo.osInfo
    })
  });

  const data = await response.json();

  if(data.success) {
    await this.saveLicenseKey(this.licenseKey);
if (data.program) {
  this.programInfo = data.program;
}
      }

return data;
    } catch (error) {
  console.error('License activate error:', error);
  return { success: false, code: 'NETWORK_ERROR', error: error.message };
}
  },

  /**
   * Heartbeat check (disabled)
   */
  async heartbeat() {
  // License system disabled - always return valid
  return { valid: true, code: 'FREE_VERSION' };
},

  /**
   * Main validation function (disabled - always returns success)
   */
  async validateAndActivate(licenseKey = null) {
  // License system disabled - always return success
  this.licenseKey = 'FREE-VERSION';
  return {
    success: true,
    message: 'Free version - all features unlocked',
    program: {
      name: 'Eddication Flow AI',
      version: '4.0',
      features: ['all']
    }
  };
},

/**
 * Start heartbeat interval (disabled)
 */
startHeartbeat(intervalMs = 8 * 60 * 60 * 1000) {
  // License system disabled - do nothing
},

/**
 * Stop heartbeat interval (disabled)
 */
stopHeartbeat() {
  // License system disabled - do nothing
},

/**
 * Callback when license becomes invalid (disabled)
 */
onLicenseInvalid: null,

  /**
   * Check if has valid stored license (disabled - always returns true)
   */
  async hasStoredLicense() {
  this.licenseKey = 'FREE-VERSION';
  return true;
},

/**
 * Hide license overlay and show main app
 */
hideOverlay() {
  const overlay = document.getElementById('licenseOverlay');
  const appContainer = document.getElementById('appContainer');
  if (overlay) overlay.style.display = 'none';
  if (appContainer) appContainer.removeAttribute('hidden');
}
};
