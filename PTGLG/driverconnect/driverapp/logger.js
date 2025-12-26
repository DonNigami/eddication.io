/**
 * Simple logger with debug levels and environment-aware filtering
 * Supports console grouping and styling for better debugging
 */
(function(){
  const isDev = (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost') || 
                (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development');
  
  window.Logger = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    currentLevel: isDev ? 0 : 1, // In dev: show all; in prod: info and above
    
    /**
     * Set the current logging level
     * @param {number} level
     */
    setLevel(level) {
      this.currentLevel = level;
    },
    
    /**
     * Log debug message (lowest priority)
     * @param {string} label
     * @param {*} data
     */
    debug(label, data) {
      if (this.currentLevel <= this.DEBUG) {
        console.log('%c[DEBUG] ' + label, 'color: #888; font-weight: normal;', data || '');
      }
    },
    
    /**
     * Log info message
     * @param {string} label
     * @param {*} data
     */
    info(label, data) {
      if (this.currentLevel <= this.INFO) {
        console.log('%c[INFO] ' + label, 'color: #0066cc; font-weight: 600;', data || '');
      }
    },
    
    /**
     * Log warning (often recoverable)
     * @param {string} label
     * @param {*} data
     */
    warn(label, data) {
      if (this.currentLevel <= this.WARN) {
        console.warn('%c[WARN] ' + label, 'color: #ff9800; font-weight: 600;', data || '');
      }
    },
    
    /**
     * Log error (critical)
     * @param {string} label
     * @param {*} error
     */
    error(label, error) {
      if (this.currentLevel <= this.ERROR) {
        console.error('%c[ERROR] ' + label, 'color: #d32f2f; font-weight: bold;', error || '');
      }
    },
    
    /**
     * Start a collapsible group
     * @param {string} groupLabel
     */
    group(groupLabel) {
      if (isDev) {
        console.group('📦 ' + groupLabel);
      }
    },
    
    /**
     * End the current group
     */
    groupEnd() {
      if (isDev) {
        console.groupEnd();
      }
    }
  };
})();
