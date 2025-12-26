/**
 * Input validators for the driver app
 * Provides consistent validation with clear error messages
 */
(function(){
  window.Validators = {
    /**
     * Validate reference number format and length
     * @param {string} ref - Reference number
     * @returns {{valid: boolean, error?: string}}
     */
    validateReference(ref) {
      if (!ref || typeof ref !== 'string') {
        return { valid: false, error: window.CONSTANTS.MESSAGES.INFO_SEARCH_EMPTY };
      }
      const trimmed = ref.trim();
      if (trimmed.length < window.CONSTANTS.VALIDATION.REFERENCE_MIN_LENGTH) {
        return { valid: false, error: 'เลขอ้างอิงต้องมีความยาวอย่างน้อย 3 ตัวอักษร' };
      }
      if (trimmed.length > window.CONSTANTS.VALIDATION.REFERENCE_MAX_LENGTH) {
        return { valid: false, error: 'เลขอ้างอิงต้องไม่เกิน 50 ตัวอักษร' };
      }
      return { valid: true };
    },

    /**
     * Validate odometer reading
     * @param {number|string} odo - Odometer value
     * @returns {{valid: boolean, error?: string, value?: number}}
     */
    validateOdometer(odo) {
      if (!odo && odo !== 0) {
        return { valid: false, error: window.CONSTANTS.MESSAGES.VALIDATE_ODOMETER_REQUIRED };
      }
      const num = Number(odo);
      if (!Number.isFinite(num)) {
        return { valid: false, error: window.CONSTANTS.MESSAGES.VALIDATE_ODOMETER_RANGE };
      }
      if (num < window.CONSTANTS.VALIDATION.ODOMETER_MIN || num > window.CONSTANTS.VALIDATION.ODOMETER_MAX) {
        return { valid: false, error: window.CONSTANTS.MESSAGES.VALIDATE_ODOMETER_RANGE };
      }
      return { valid: true, value: Math.floor(num) };
    },

    /**
     * Validate alcohol reading
     * @param {number|string} alcohol - Alcohol value in mg/L
     * @returns {{valid: boolean, error?: string, value?: string}}
     */
    validateAlcohol(alcohol) {
      if (!alcohol && alcohol !== 0) {
        return { valid: false, error: window.CONSTANTS.MESSAGES.VALIDATE_ALCOHOL_REQUIRED };
      }
      const num = parseFloat(alcohol);
      if (!Number.isFinite(num)) {
        return { valid: false, error: window.CONSTANTS.MESSAGES.VALIDATE_ALCOHOL_NUMBER };
      }
      if (num < window.CONSTANTS.VALIDATION.ALCOHOL_MIN || num > window.CONSTANTS.VALIDATION.ALCOHOL_MAX) {
        return { valid: false, error: window.CONSTANTS.MESSAGES.VALIDATE_ALCOHOL_RANGE };
      }
      return { valid: true, value: num.toFixed(2) };
    },

    /**
     * Validate image file
     * @param {File} file - File object
     * @returns {{valid: boolean, error?: string}}
     */
    validateImage(file) {
      if (!file) {
        return { valid: false, error: window.CONSTANTS.MESSAGES.VALIDATE_IMAGE_REQUIRED };
      }
      if (!file.type.startsWith('image/')) {
        return { valid: false, error: 'กรุณาเลือกไฟล์รูปภาพ' };
      }
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > window.CONSTANTS.VALIDATION.IMAGE_MAX_SIZE_MB) {
        return { valid: false, error: window.CONSTANTS.MESSAGES.VALIDATE_IMAGE_SIZE };
      }
      return { valid: true };
    },

    /**
     * Validate latitude and longitude (optional, can be empty)
     * @param {string} lat - Latitude
     * @param {string} lng - Longitude
     * @returns {{valid: boolean, error?: string, lat?: number, lng?: number}}
     */
    validateCoordinates(lat, lng) {
      if (!lat && !lng) {
        // Both empty is acceptable
        return { valid: true, lat: null, lng: null };
      }
      
      const latNum = lat ? Number(lat) : null;
      const lngNum = lng ? Number(lng) : null;

      if ((lat && !Number.isFinite(latNum)) || (lng && !Number.isFinite(lngNum))) {
        return { valid: false, error: 'พิกัดต้องเป็นตัวเลขที่ถูกต้อง' };
      }

      if (latNum && (latNum < -90 || latNum > 90)) {
        return { valid: false, error: 'ละติจูดต้องอยู่ระหว่าง -90 ถึง 90' };
      }

      if (lngNum && (lngNum < -180 || lngNum > 180)) {
        return { valid: false, error: 'ลองจิจูดต้องอยู่ระหว่าง -180 ถึง 180' };
      }

      return { valid: true, lat: latNum, lng: lngNum };
    },

    /**
     * Validate backend response shape
     * @param {*} response - API response
     * @param {string[]} requiredFields - Expected fields
     * @returns {{valid: boolean, error?: string}}
     */
    validateResponseShape(response, requiredFields = []) {
      if (!response || typeof response !== 'object') {
        return { valid: false, error: 'ข้อมูลการตอบกลับไม่ถูกต้อง' };
      }

      for (const field of requiredFields) {
        if (!(field in response)) {
          return { valid: false, error: 'ข้อมูลที่ได้รับไม่สมบูรณ์ (ขาด ' + field + ')' };
        }
      }

      return { valid: true };
    },
  };
})();
