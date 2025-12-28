// Lightweight client-side config
// Move environment-specific values here; avoid hardcoding in pages.
(function(){
  window.CONFIG = window.CONFIG || {
    LIFF_ID: '2007705394-y4mV76Gv',
    // ตั้งค่าเป็น Railway HTTPS URL (แก้ไขบรรทัดนี้เป็น URL จริงของคุณ)
    // ตัวอย่าง: 'https://your-project.up.railway.app'
    // สามารถ override ชั่วคราวได้ด้วย localStorage.setItem('backend_url', 'https://...')
    WEB_APP_URL: (function(){
      try {
        var u = localStorage.getItem('backend_url');
        if (u && /^https?:\/\//.test(u)) return u;
      } catch (_) {}
      return 'https://your-project.up.railway.app';
    })(),

    // Awareness popup image URL - แก้ไข URL นี้เป็นลิ้งค์รูปที่ต้องการแสดง
    AWARENESS_IMAGE_URL: 'https://drive.google.com/uc?id=1AODJfyZFFP4WsbrR7kyojPskoQWQcAY1'
    };
  })();