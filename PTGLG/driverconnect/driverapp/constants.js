/**
 * Global constants: endpoints, messages, validation ranges, retry config
 * Centralized for easy internationalization and configuration
 */
(function(){
  window.CONSTANTS = {
    // API Configuration
    API: {
      WEB_APP_URL: (window.CONFIG && window.CONFIG.WEB_APP_URL) ||
        'https://script.google.com/macros/s/AKfycbxn8IxIhL9zdO1QMEyAZ8TThppvApILg7oyGdrPFeKU7L83ClgxxmTKz0bhj0u5ZJM/exec',
      LIFF_ID: (window.CONFIG && window.CONFIG.LIFF_ID) || '2007705394-y4mV76Gv',
      TIMEOUT_MS: 20000,
      MAX_RETRIES: 2,
      RETRY_DELAY_MS: 800,
      CACHE_DURATION_MS: 5000, // Cache search results for 5 seconds
    },

    // Validation Ranges
    VALIDATION: {
      ODOMETER_MIN: 0,
      ODOMETER_MAX: 3000000,
      ALCOHOL_MIN: 0.0,
      ALCOHOL_MAX: 2.0,
      IMAGE_MAX_SIZE_MB: 5,
      REFERENCE_MIN_LENGTH: 3,
      REFERENCE_MAX_LENGTH: 50,
    },

    // UI Messages - Thai
    MESSAGES: {
      // Titles
      SUCCESS_TITLE: 'บันทึกสำเร็จ',
      ALCOHOL_TITLE: 'บันทึกผลแอลกอฮอล์',
      ENDTRIP_TITLE: 'จบทริป',
      REVIEW_TITLE: 'ประเมินบริการ',

      // Labels
      LABEL_DRIVER_NAME: 'ชื่อคนขับ',
      LABEL_ALCOHOL_VALUE: 'ปริมาณแอลกอฮอล์ (มก./ลิตรลมหายใจ)',
      LABEL_EVIDENCE_PHOTO: 'ถ่ายรูปหลักฐาน',
      LABEL_ODOMETER_START: 'เลขไมล์รถ',
      LABEL_REVIEW_SCORE: 'คะแนนประเมิน',

      // Buttons
      BUTTON_SAVE: 'บันทึกผล',
      BUTTON_CANCEL: 'ยกเลิก',
      BUTTON_SEARCH: 'ค้นหา',
      BUTTON_OK: 'ตกลง',

      // Success messages
      SUCCESS_CHECKIN: 'Check-in สำเร็จ',
      SUCCESS_CHECKOUT: 'Check-out สำเร็จ',
      SUCCESS_FUEL: 'ลงน้ำมันสำเร็จ',
      SUCCESS_UNLOAD: 'ลงเสร็จสำเร็จ',
      SUCCESS_REVIEW: 'ประเมินสำเร็จ',
      SUCCESS_CLOSEJOB: 'ปิดงานสำเร็จ',
      SUCCESS_ENDTRIP: 'จบทริปสำเร็จ',
      SUCCESS_ALCOHOL_SAVED: 'บันทึกการตรวจแอลกอฮอล์เรียบร้อยแล้ว',

      // Error messages
      ERROR_NO_REFERENCE: 'ไม่พบเลขงาน กรุณาค้นหางานก่อน',
      ERROR_INVALID_REFERENCE: 'เลขอ้างอิงงานไม่ถูกต้อง กรุณาลองใหม่',
      ERROR_NOT_FOUND: 'ไม่พบข้อมูลงาน',
      ERROR_SEARCH_FAILED: 'ค้นหางานไม่สำเร็จ',
      ERROR_GPS: 'ไม่สามารถดึงพิกัดจากอุปกรณ์ได้ กรุณาเปิด GPS และอนุญาตการเข้าถึงตำแหน่ง',
      ERROR_GEOLOCATION_NOT_SUPPORTED: 'อุปกรณ์ไม่รองรับการระบุตำแหน่ง',
      ERROR_NETWORK: 'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์',
      ERROR_TIMEOUT: 'หมดเวลาการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง',
      ERROR_UPDATE_FAILED: 'อัปเดตสถานะไม่สำเร็จ',
      ERROR_ALCOHOL_SAVE: 'เกิดข้อผิดพลาดในการบันทึกการตรวจแอลกอฮอล์',
      ERROR_IMAGE_REQUIRED: 'กรุณาถ่ายรูปหลักฐาน',
      ERROR_IMAGE_SIZE: 'ขนาดรูปต้องไม่เกิน 5 MB',
      ERROR_IMAGE_MIME: 'กรุณาเลือกไฟล์รูปภาพเท่านั้น',
      ERROR_LIFF_INIT: 'ไม่สามารถโหลดข้อมูลจาก LIFF ได้',

      // Validation messages
      VALIDATE_ODOMETER_REQUIRED: 'กรุณากรอกเลขไมล์รถ',
      VALIDATE_ODOMETER_RANGE: 'เลขไมล์ต้องเป็นตัวเลข 0 - 3,000,000',
      VALIDATE_ALCOHOL_REQUIRED: 'กรุณากรอกปริมาณแอลกอฮอล์',
      VALIDATE_ALCOHOL_NUMBER: 'กรุณากรอกปริมาณแอลกอฮอล์เป็นตัวเลข',
      VALIDATE_ALCOHOL_RANGE: 'ค่าปริมาณแอลกอฮอล์ต้องอยู่ระหว่าง 0.00 - 2.00',
      VALIDATE_IMAGE_REQUIRED: 'กรุณาถ่ายรูปหลักฐาน',
      VALIDATE_REFERENCE_REQUIRED: 'กรุณากรอกเลขอ้างอิง',
      VALIDATE_REFERENCE_RANGE: 'เลขอ้างอิงต้องมีความยาว 3 - 50 ตัวอักษร',

      // Info messages
      INFO_ALCOHOL_REQUIRED: 'กรุณาตรวจแอลกอฮอล์ก่อนเริ่มงาน ต้องตรวจอย่างน้อย 1 คนก่อนทำการ Check-in จุดส่งแรก',
      INFO_OPEN_IN_LINE: 'กรุณาเปิดหน้านี้ผ่านแอพ LINE เพื่อใช้งานเต็มรูปแบบ',
      INFO_IMPORTANT: 'กรุณาดำเนินการทุกขั้นตอน เนื่องจากมีผลต่อการบันทึกค่าเที่ยวของพนักงาน',
      INFO_NO_COORDS: 'ปลายทางนี้ยังไม่มีพิกัดในระบบ',
      INFO_SEARCH_EMPTY: 'กรุณาใส่เลขอ้างอิงงานก่อนค้นหา',
      INFO_SEARCH_FIRST: 'กรุณาค้นหางานก่อน',
      INFO_NOT_FOUND: 'ไม่พบเลขงาน',

      // Loading messages
      LOADING_GET_COORDINATES: 'กำลังดึงพิกัดจากอุปกรณ์...',
      LOADING_UPLOAD_ALCOHOL: 'กำลังบันทึกการตรวจแอลกอฮอล์...',
      LOADING_SEARCH: 'กำลังค้นหางานจากระบบ...',
      LOADING_UPDATE: 'กำลังอัปเดตสถานะ...',
    },

    // API Actions
    ACTIONS: {
      SEARCH: 'search',
      UPDATE_STOP: 'updatestop',
      UPLOAD_ALCOHOL: 'uploadAlcohol',
      UPLOAD_REVIEW: 'uploadReview',
      FILL_MISSING: 'fillMissingSteps',
      CLOSE_JOB: 'closejob',
      END_TRIP: 'endtrip',
    },

    // Stop status values
    STOP_STATUS: {
      CHECKIN: 'CHECKIN',
      CHECKOUT: 'CHECKOUT',
      FUELING: 'FUELING',
      UNLOAD_DONE: 'UNLOAD_DONE',
    },

    // Review scores
    REVIEW_SCORES: {
      EXCELLENT: 5,
      GOOD: 4,
      NORMAL: 3,
    },

    // Local storage keys
    STORAGE_KEYS: {
      LAST_SEARCH: 'lastSearchKeyword',
      USER_PREFS: 'userPreferences',
    },
  };
})();
