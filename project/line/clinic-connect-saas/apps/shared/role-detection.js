/**
 * =====================================================
 * CLINIC CONNECT SAAS - ROLE DETECTION
 * =====================================================
 * Utility to detect and manage user roles in LIFF apps
 *
 * Supported roles:
 *   - patient: Regular patients
 *   - doctor: Doctors with clinic access
 *   - admin: System administrators
 *   - staff: Clinic staff
 *
 * Usage:
 *   // Detect role
 *   const role = await RoleDetector.detect();
 *
 *   // Check specific role
 *   if (await RoleDetector.isDoctor()) { ... }
 *
 *   // Require role (redirect if not)
 *   await RoleDetector.require('doctor');
 *
 *   // Get user profile with role
 *   const profile = await RoleDetector.getProfile();
 * =====================================================
 */

(function(global) {
  'use strict';

  const RoleDetector = {
    // Configuration
    config: {
      supabaseUrl: '', // Set via RoleDetector.configure()
      supabaseKey: '', // Set via RoleDetector.configure()
      cacheKey: 'clinic_role',
      cacheDuration: 5 * 60 * 1000 // 5 minutes
    },

    // Cached role data
    cache: {
      role: null,
      profile: null,
      timestamp: 0
    },

    /**
     * Configure Supabase connection
     */
    configure: function(options) {
      if (options.supabaseUrl) this.config.supabaseUrl = options.supabaseUrl;
      if (options.supabaseKey) this.config.supabaseKey = options.supabaseKey;
      return this;
    },

    /**
     * Get current LIFF access token
     */
    getAccessToken: async function() {
      if (!window.liff) throw new Error('LIFF SDK not loaded');

      const accessToken = liff.getAccessToken();
      if (!accessToken) throw new Error('Not logged in to LIFF');

      return accessToken;
    },

    /**
     * Get LINE user ID
     */
    getLineUserId: async function() {
      if (!window.liff) throw new Error('LIFF SDK not loaded');

      if (!liff.isLoggedIn()) {
        await liff.login();
      }

      const profile = await liff.getProfile();
      return profile.userId;
    },

    /**
     * Fetch user role from Supabase
     */
    fetchRoleFromDB: async function(lineUserId) {
      const { supabaseUrl, supabaseKey } = this.config;

      if (!supabaseUrl || !supabaseKey) {
        console.warn('Supabase not configured, using default role');
        return { role: 'patient' };
      }

      // Fetch from user_profiles table
      const response = await fetch(`${supabaseUrl}/rest/v1/user_profiles?line_user_id=eq.${lineUserId}&select=*`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user role');
      }

      const data = await response.json();

      if (data.length === 0) {
        // User not found, create new patient profile
        return await this.createPatientProfile(lineUserId);
      }

      return {
        role: data[0].role || 'patient',
        profile: data[0]
      };
    },

    /**
     * Create a new patient profile
     */
    createPatientProfile: async function(lineUserId) {
      const { supabaseUrl, supabaseKey } = this.config;

      if (!supabaseUrl || !supabaseKey) {
        return { role: 'patient' };
      }

      // Get LINE profile
      const lineProfile = await liff.getProfile();

      const newProfile = {
        line_user_id: lineUserId,
        display_name: lineProfile.displayName,
        picture_url: lineProfile.pictureUrl,
        role: 'patient',
        created_at: new Date().toISOString()
      };

      const response = await fetch(`${supabaseUrl}/rest/v1/user_profiles`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newProfile)
      });

      if (!response.ok) {
        console.warn('Failed to create profile, using default role');
        return { role: 'patient' };
      }

      return { role: 'patient', profile: newProfile };
    },

    /**
     * Detect user role with caching
     */
    detect: async function() {
      const now = Date.now();
      const cacheAge = now - this.cache.timestamp;

      // Return cached role if still valid
      if (this.cache.role && cacheAge < this.config.cacheDuration) {
        return this.cache.role;
      }

      try {
        const lineUserId = await this.getLineUserId();
        const result = await this.fetchRoleFromDB(lineUserId);

        // Update cache
        this.cache = {
          role: result.role,
          profile: result.profile,
          timestamp: now
        };

        // Store in localStorage
        try {
          localStorage.setItem(this.config.cacheKey, JSON.stringify({
            role: result.role,
            timestamp: now
          }));
        } catch (e) {
          // Ignore localStorage errors
        }

        return result.role;

      } catch (error) {
        console.error('Role detection error:', error);

        // Try to get from localStorage as fallback
        try {
          const cached = localStorage.getItem(this.config.cacheKey);
          if (cached) {
            const data = JSON.parse(cached);
            if (now - data.timestamp < this.config.cacheDuration * 2) {
              return data.role;
            }
          }
        } catch (e) {
          // Ignore localStorage errors
        }

        // Default to patient
        return 'patient';
      }
    },

    /**
     * Get full user profile with role
     */
    getProfile: async function() {
      const now = Date.now();
      const cacheAge = now - this.cache.timestamp;

      if (this.cache.profile && cacheAge < this.config.cacheDuration) {
        return this.cache.profile;
      }

      await this.detect(); // This will populate cache
      return this.cache.profile;
    },

    /**
     * Check if user has specific role
     */
    hasRole: async function(role) {
      const userRole = await this.detect();
      return userRole === role;
    },

    /**
     * Check if user is patient
     */
    isPatient: async function() {
      return await this.hasRole('patient');
    },

    /**
     * Check if user is doctor
     */
    isDoctor: async function() {
      return await this.hasRole('doctor');
    },

    /**
     * Check if user is admin
     */
    isAdmin: async function() {
      return await this.hasRole('admin');
    },

    /**
     * Check if user is staff
     */
    isStaff: async function() {
      return await this.hasRole('staff');
    },

    /**
     * Require specific role, redirect if not
     */
    require: async function(requiredRole, options = {}) {
      const userRole = await this.detect();

      if (userRole !== requiredRole) {
        const redirectTo = options.redirect || '#/';
        if (options.message) {
          alert(options.message);
        }
        window.location.hash = redirectTo;
        return false;
      }

      return true;
    },

    /**
     * Require any of the specified roles
     */
    requireAny: async function(roles, options = {}) {
      const userRole = await this.detect();

      if (!roles.includes(userRole)) {
        const redirectTo = options.redirect || '#/';
        if (options.message) {
          alert(options.message);
        }
        window.location.hash = redirectTo;
        return false;
      }

      return true;
    },

    /**
     * Clear cached role data
     */
    clearCache: function() {
      this.cache = { role: null, profile: null, timestamp: 0 };
      try {
        localStorage.removeItem(this.config.cacheKey);
      } catch (e) {
        // Ignore localStorage errors
      }
    },

    /**
     * Redirect based on role
     */
    redirectToRole: async function() {
      const role = await this.detect();

      const routes = {
        patient: '#/patient',
        doctor: '#/doctor',
        admin: '#/admin',
        staff: '#/staff'
      };

      const route = routes[role] || routes.patient;
      window.location.hash = route;
    }
  };

  // Export
  global.RoleDetector = RoleDetector;

})(typeof window !== 'undefined' ? window : global);

/**
 * =====================================================
 * USAGE EXAMPLES
 * =====================================================
 */

// Example 1: Configure and detect
/*
RoleDetector.configure({
  supabaseUrl: 'https://your-project.supabase.co',
  supabaseKey: 'your-anon-key'
});

const role = await RoleDetector.detect();
console.log('User role:', role);
*/

// Example 2: Role-based redirect
/*
// On app load
window.addEventListener('DOMContentLoaded', async () => {
  await RoleDetector.configure(config);
  await RoleDetector.redirectToRole();
});
*/

// Example 3: Protect routes
/*
router.beforeEach(async (to, from) => {
  if (to.path.startsWith('/doctor')) {
    return await RoleDetector.require('doctor', {
      redirect: '#/',
      message: 'กรุณาเข้าสู่ระบบด้วยบัญชีแพทย์'
    });
  }
  return true;
});
*/

// Example 4: Conditional UI
/*
const isDoctor = await RoleDetector.isDoctor();

if (isDoctor) {
  showDoctorDashboard();
} else {
  showPatientDashboard();
}
*/
