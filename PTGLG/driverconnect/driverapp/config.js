// Lightweight client-side config
// Move environment-specific values here; avoid hardcoding in pages.
(function(){
  // Backend URLs
  var BACKENDS = {
    railway: 'https://eddicationio-production.up.railway.app',
    appscript: 'https://script.google.com/macros/s/AKfycbwWn9SBE9XaIQ4k_hNt_TZa8MzI9Ywk8lXTi7RsONX-PBNLa65yXZmqCAd-ZYhHpV-g/exec',
    localhost: 'http://localhost:3000'
  };

  // ลำดับความสำคัญ: railway > appscript > localhost
  var BACKEND_PRIORITY = ['railway', 'appscript', 'localhost'];

  function getBackendURL() {
    try {
      // วิธีที่ 1: ใช้ custom URL จาก localStorage
      var customUrl = localStorage.getItem('backend_url');
      if (customUrl && /^https?:\/\//.test(customUrl)) {
        console.log('[CONFIG] Using custom backend URL:', customUrl);
        return customUrl;
      }

      // วิธีที่ 2: เลือก backend mode (railway, appscript, localhost)
      var mode = localStorage.getItem('backend_mode');
      if (mode && BACKENDS[mode]) {
        console.log('[CONFIG] Using backend mode:', mode, '→', BACKENDS[mode]);
        return BACKENDS[mode];
      }

      // วิธีที่ 3: ใช้ default ตามลำดับความสำคัญ (railway เป็น default)
      var defaultBackend = BACKENDS[BACKEND_PRIORITY[0]];
      console.log('[CONFIG] Using default backend:', BACKEND_PRIORITY[0], '→', defaultBackend);
      return defaultBackend;
    } catch (_) {
      return BACKENDS.railway;
    }
  }

  window.CONFIG = window.CONFIG || {
    LIFF_ID: '2007705394-y4mV76Gv',
    WEB_APP_URL: getBackendURL(),

    // Awareness popup image URL - แก้ไข URL นี้เป็นลิ้งค์รูปที่ต้องการแสดง
    AWARENESS_IMAGE_URL: 'https://drive.google.com/uc?id=1AODJfyZFFP4WsbrR7kyojPskoQWQcAY1',

    // Helper functions สำหรับสลับ backend
    setBackendMode: function(mode) {
      if (!BACKENDS[mode]) {
        console.error('[CONFIG] Invalid backend mode:', mode, '(valid:', Object.keys(BACKENDS).join(', ') + ')');
        return false;
      }
      localStorage.setItem('backend_mode', mode);
      console.log('[CONFIG] Backend mode set to:', mode);
      console.log('[CONFIG] Please reload the page for changes to take effect');
      return true;
    },

    setCustomBackendURL: function(url) {
      if (!url || !/^https?:\/\//.test(url)) {
        console.error('[CONFIG] Invalid URL:', url);
        return false;
      }
      localStorage.setItem('backend_url', url);
      console.log('[CONFIG] Custom backend URL set to:', url);
      console.log('[CONFIG] Please reload the page for changes to take effect');
      return true;
    },

    resetBackend: function() {
      localStorage.removeItem('backend_mode');
      localStorage.removeItem('backend_url');
      console.log('[CONFIG] Backend reset to default (railway)');
      console.log('[CONFIG] Please reload the page for changes to take effect');
    },

    showBackendInfo: function() {
      console.log('[CONFIG] ═══════════════════════════════════════');
      console.log('[CONFIG] Current Backend:', window.CONFIG.WEB_APP_URL);
      console.log('[CONFIG] Backend Mode:', localStorage.getItem('backend_mode') || 'default (railway)');
      console.log('[CONFIG] Custom URL:', localStorage.getItem('backend_url') || 'none');
      console.log('[CONFIG] ───────────────────────────────────────');
      console.log('[CONFIG] Available backends:');
      Object.keys(BACKENDS).forEach(function(key) {
        console.log('[CONFIG]   -', key + ':', BACKENDS[key]);
      });
      console.log('[CONFIG] ───────────────────────────────────────');
      console.log('[CONFIG] Commands:');
      console.log('[CONFIG]   CONFIG.setBackendMode("railway|appscript|localhost")');
      console.log('[CONFIG]   CONFIG.setCustomBackendURL("https://...")');
      console.log('[CONFIG]   CONFIG.resetBackend()');
      console.log('[CONFIG]   CONFIG.showBackendInfo()');
      console.log('[CONFIG] ═══════════════════════════════════════');
    }
  };

  // แสดงข้อมูล backend ที่กำลังใช้
  console.log('[CONFIG] Backend initialized:', window.CONFIG.WEB_APP_URL);
  console.log('[CONFIG] Run CONFIG.showBackendInfo() for more details');
})();