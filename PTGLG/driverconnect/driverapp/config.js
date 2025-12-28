// Lightweight client-side config
// Move environment-specific values here; avoid hardcoding in pages.
(function(){
  window.CONFIG = window.CONFIG || {
    LIFF_ID: '2007705394-y4mV76Gv',
    //WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbxn8IxIhL9zdO1QMEyAZ8TThppvApILg7oyGdrPFeKU7L83ClgxxmTKz0bhj0u5ZJM/exec',

    // หรือถ้าทดสอบ local:
     WEB_APP_URL: 'http://localhost:3000',

    // Awareness popup image URL - แก้ไข URL นี้เป็นลิ้งค์รูปที่ต้องการแสดง
    AWARENESS_IMAGE_URL: 'https://drive.google.com/uc?id=1AODJfyZFFP4WsbrR7kyojPskoQWQcAY1'
    };
  })();