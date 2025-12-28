// Lightweight client-side config
// Move environment-specific values here; avoid hardcoding in pages.
(function(){
  window.CONFIG = window.CONFIG || {
    LIFF_ID: '2007705394-y4mV76Gv',
    // *** IMPORTANT: Update this URL to your Node.js backend ***
    // Local development:   WEB_APP_URL: 'http://localhost:3000',
    // Railway:             WEB_APP_URL: 'https://your-project.up.railway.app',
    // Heroku:              WEB_APP_URL: 'https://your-app.herokuapp.com',
    WEB_APP_URL: 'http://localhost:3000',  // ← Change this to your backend URL
    // Awareness popup image URL - แก้ไข URL นี้เป็นลิ้งค์รูปที่ต้องการแสดง
    AWARENESS_IMAGE_URL: 'https://drive.google.com/uc?id=1AODJfyZFFP4WsbrR7kyojPskoQWQcAY1'
    };
  })();