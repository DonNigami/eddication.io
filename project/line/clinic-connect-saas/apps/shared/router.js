/**
 * =====================================================
 * CLINIC CONNECT SAAS - ROUTER UTILITY
 * =====================================================
 * Lightweight hash-based router for LIFF apps
 *
 * Usage:
 *   // Navigate to pages
 *   router.navigate('home');
 *   router.navigate('booking', { doctorId: '123' });
 *
 *   // Define routes
 *   router.on('home', () => { ... });
 *   router.on('booking', (params) => { ... });
 *
 *   // Get current route
 *   const current = router.current();
 *
 *   // Back button
 *   router.back();
 * =====================================================
 */

(function(global) {
  'use strict';

  const Router = function() {
    this.routes = {};
    this.currentRoute = null;
    this.currentParams = {};
    this.beforeHooks = [];
    this.afterHooks = [];

    // Parse hash to extract route and params
    this.parseHash = function() {
      const hash = window.location.hash.slice(1) || '/';
      const [path, queryString] = hash.split('?');

      // Parse query parameters
      const params = {};
      if (queryString) {
        queryString.split('&').forEach(pair => {
          const [key, value] = pair.split('=');
          params[decodeURIComponent(key)] = decodeURIComponent(value || '');
        });
      }

      return { path, params };
    };

    // Match route pattern (supports :param syntax)
    this.matchRoute = function(pattern, path) {
      const patternParts = pattern.split('/');
      const pathParts = path.split('/');

      if (patternParts.length !== pathParts.length) {
        return null;
      }

      const params = {};
      for (let i = 0; i < patternParts.length; i++) {
        const patternPart = patternParts[i];
        const pathPart = pathParts[i];

        if (patternPart.startsWith(':')) {
          const paramName = patternPart.slice(1);
          params[paramName] = pathPart;
        } else if (patternPart !== pathPart) {
          return null;
        }
      }

      return params;
    };

    // Execute before hooks
    this.runBeforeHooks = async function(to, from) {
      for (const hook of this.beforeHooks) {
        const result = await hook(to, from);
        if (result === false) return false;
      }
      return true;
    };

    // Execute after hooks
    this.runAfterHooks = function(to, from) {
      this.afterHooks.forEach(hook => hook(to, from));
    };

    // Handle hash change
    this.handleHashChange = async function() {
      const { path, params } = this.parseHash();
      const from = this.currentRoute;

      // Find matching route
      let matchedRoute = null;
      let routeParams = {};

      for (const pattern in this.routes) {
        const matchParams = this.matchRoute(pattern, path);
        if (matchParams !== null) {
          matchedRoute = pattern;
          routeParams = { ...params, ...matchParams };
          break;
        }
      }

      // Run before hooks
      const canProceed = await this.runBeforeHooks(
        { path, params: routeParams },
        from
      );
      if (canProceed === false) {
        // Revert hash
        if (from) window.location.hash = from;
        return;
      }

      // Update current state
      this.currentRoute = path;
      this.currentParams = routeParams;

      // Execute route handler
      if (matchedRoute && this.routes[matchedRoute]) {
        this.routes[matchedRoute](routeParams, path);
      }

      // Run after hooks
      this.runAfterHooks(
        { path, params: routeParams },
        from
      );
    };

    // Register route handler
    this.on = function(pattern, handler) {
      if (typeof pattern === 'object') {
        // Batch registration
        Object.keys(pattern).forEach(key => {
          this.routes[key] = pattern[key];
        });
      } else {
        this.routes[pattern] = handler;
      }
      return this;
    };

    // Navigate to route
    this.navigate = function(path, params = {}) {
      let hash = path.startsWith('/') ? path.slice(1) : path;

      if (Object.keys(params).length > 0) {
        const query = Object.keys(params)
          .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
          .join('&');
        hash += '?' + query;
      }

      window.location.hash = hash;
    };

    // Go back
    this.back = function() {
      window.history.back();
    };

    // Replace current route (no history entry)
    this.replace = function(path, params = {}) {
      let hash = path.startsWith('/') ? path.slice(1) : path;

      if (Object.keys(params).length > 0) {
        const query = Object.keys(params)
          .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
          .join('&');
        hash += '?' + query;
      }

      const url = new URL(window.location);
      url.hash = hash;
      window.history.replaceState(null, '', url);
      this.handleHashChange();
    };

    // Get current route info
    this.current = function() {
      return {
        path: this.currentRoute,
        params: this.currentParams
      };
    };

    // Get parameter value
    this.param = function(name) {
      return this.currentParams[name];
    };

    // Before each navigation
    this.beforeEach = function(hook) {
      this.beforeHooks.push(hook);
      return this;
    };

    // After each navigation
    this.afterEach = function(hook) {
      this.afterHooks.push(hook);
      return this;
    };

    // Initialize router
    this.init = function() {
      window.addEventListener('hashchange', () => this.handleHashChange());

      // Handle initial route
      if (!window.location.hash) {
        this.navigate('/');
      } else {
        this.handleHashChange();
      }

      return this;
    };
  };

  // Export
  global.LiffRouter = Router;

  // Auto-create instance
  global.router = new Router();

})(typeof window !== 'undefined' ? window : global);

/**
 * =====================================================
 * USAGE EXAMPLES
 * =====================================================
 */

// Example 1: Simple routes
/*
router.init();

router.on({
  '/': () => showPage('home'),
  '/booking': () => showPage('booking'),
  '/queue': () => showPage('queue'),
  '/records': () => showPage('records'),
  '/profile': () => showPage('profile')
});

router.navigate('booking');
*/

// Example 2: Routes with parameters
/*
router.on('/appointment/:id', (params) => {
  const appointmentId = params.id;
  loadAppointment(appointmentId);
});

router.navigate('appointment/123');
*/

// Example 3: Query parameters
/*
router.on('/search', (params) => {
  const query = params.q || '';
  search(query);
});

router.navigate('search', { q: 'doctor' });
*/

// Example 4: Navigation guards
/*
router.beforeEach((to, from) => {
  if (to.path === '/profile' && !isLoggedIn()) {
    router.navigate('login');
    return false; // Cancel navigation
  }
});
*/

// Example 5: Programmatic navigation
/*
// In your HTML
<button onclick="router.navigate('booking')">จองนัดหมาย</button>

// In your JavaScript
function showAppointment(id) {
  router.navigate('appointment/' + id);
}

function goBack() {
  router.back();
}
*/
