/**
 * API Module: Centralized HTTP layer with retry logic, error recovery, and response validation
 * All requests go through this module for consistency and reliability
 */
(function(){
  const WEB_APP_URL = window.CONSTANTS.API.WEB_APP_URL;
  const TIMEOUT_MS = window.CONSTANTS.API.TIMEOUT_MS;
  const MAX_RETRIES = window.CONSTANTS.API.MAX_RETRIES;
  const RETRY_DELAY_MS = window.CONSTANTS.API.RETRY_DELAY_MS;
  const ACTIONS = window.CONSTANTS.ACTIONS;
  const MESSAGES = window.CONSTANTS.MESSAGES;

  // ES5-safe Object.assign fallback
  const assign = Object.assign || function(target) {
    target = target || {};
    for (var i = 1; i < arguments.length; i++) {
      var src = arguments[i] || {};
      for (var k in src) {
        if (Object.prototype.hasOwnProperty.call(src, k)) {
          target[k] = src[k];
        }
      }
    }
    return target;
  };

  // Build form body with URLSearchParams fallback for older WebViews
  function makeFormBody(obj) {
    if (typeof URLSearchParams !== 'undefined') {
      var form = new URLSearchParams();
      for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          var val = obj[key];
          if (val !== undefined) {
            form.append(key, String(val));
          }
        }
      }
      return form;
    }
    var parts = [];
    for (var k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) {
        var v = obj[k];
        if (v !== undefined) {
          parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
        }
      }
    }
    return parts.join('&');
  }

  /**
   * Sleep utility for retry delays
   * @param {number} ms
   * @returns {Promise<void>}
   */
  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  /**
   * Make a fetch request with timeout, retry logic, and error recovery
   * @param {string} url
   * @param {object} options
   * @param {number} retryCount - Current retry attempt
   * @returns {Promise<*>}
   */
  async function fetchWithRetry(url, options = {}, retryCount = 0) {
    var controller = null;
    var id = null;
    if (typeof AbortController !== 'undefined') {
      try {
        controller = new AbortController();
        id = setTimeout(function(){ try { controller.abort(); } catch(e){} }, TIMEOUT_MS);
      } catch(e) {
        controller = null;
        id = null;
      }
    }

    try {
      var fetchOptions = assign({}, options, { cache: 'no-store' });
      if (controller && controller.signal) {
        fetchOptions.signal = controller.signal;
      }
      const res = await fetch(url, fetchOptions);

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const err = new Error('HTTP ' + res.status + ': ' + (text || res.statusText));
        err.status = res.status;
        throw err;
      }

      return await res.json();
    } catch (err) {
      if (id) clearTimeout(id);

      // Retry logic for network/timeout errors (not 4xx client errors)
      const isRetryable =
        err.name === 'AbortError' || // Timeout
        !err.status || // Network error
        (err.status >= 500 && err.status < 600); // Server error

      if (isRetryable && retryCount < MAX_RETRIES) {
        window.Logger.warn('⚠️ Retry ' + (retryCount + 1) + '/' + MAX_RETRIES + ': ' + err.message);
        await sleep(RETRY_DELAY_MS * (retryCount + 1)); // Exponential backoff
        return fetchWithRetry(url, options, retryCount + 1);
      }

      throw err;
    }
  }

  window.API = {
    /**
     * Search for a job by reference number
     * @param {string} keyword
     * @param {string} userId
     * @returns {Promise<{success: boolean, data?: *, message?: string}>}
     */
    async search(keyword, userId) {
      window.Logger.info('🔍 Searching for job', { keyword, userId });

      const validation = window.Validators.validateReference(keyword);
      if (!validation.valid) {
        return { success: false, message: validation.error };
      }

      try {
        const url =
          WEB_APP_URL + '?action=' + ACTIONS.SEARCH +
          '&keyword=' + encodeURIComponent(keyword) +
          '&userId=' + encodeURIComponent(userId);

        const json = await fetchWithRetry(url);

        const shapeCheck = window.Validators.validateResponseShape(json, ['success']);
        if (!shapeCheck.valid) {
          return { success: false, message: shapeCheck.error };
        }

        if (!json.success) {
          return { success: false, message: json.message || MESSAGES.ERROR_NOT_FOUND };
        }

        window.Logger.debug('✅ Search successful', json.data);
        return { success: true, data: json.data };
      } catch (err) {
        window.Logger.error('❌ Search failed', err);
        return {
          success: false,
          message: err.name === 'AbortError' ? MESSAGES.ERROR_TIMEOUT : MESSAGES.ERROR_NETWORK,
        };
      }
    },

    /**
     * Update a stop's status (checkin, checkout, fuel, unload, etc.)
     * @param {object} params
     * @returns {Promise<{success: boolean, stop?: *, message?: string}>}
     */
    async updateStop({ rowIndex, status, type, userId, lat, lng, odo }) {
      window.Logger.info('🔄 Updating stop status', { rowIndex, status, type });

      try {
        const url = WEB_APP_URL + '?action=' + ACTIONS.UPDATE_STOP;
        const form = makeFormBody({
          rowIndex: String(rowIndex),
          status: String(status),
          type: String(type),
          userId: String(userId),
          lat: String(lat),
          lng: String(lng),
          odo: type === 'checkin' ? String(odo || '') : undefined
        });

        let json;
        try {
          // Try POST first
          json = await fetchWithRetry(url, { method: 'POST', body: form });
        } catch (e) {
          // Fallback to GET for backward compatibility
          window.Logger.warn('📌 POST failed, trying GET', e.message);
          const urlGet =
            WEB_APP_URL + '?action=' + ACTIONS.UPDATE_STOP +
            '&rowIndex=' + encodeURIComponent(rowIndex) +
            '&status=' + encodeURIComponent(status) +
            '&type=' + encodeURIComponent(type) +
            '&userId=' + encodeURIComponent(userId) +
            '&lat=' + encodeURIComponent(lat) +
            '&lng=' + encodeURIComponent(lng) +
            (type === 'checkin' ? '&odo=' + encodeURIComponent(odo || '') : '');
          json = await fetchWithRetry(urlGet);
        }

        if (!json.success) {
          return { success: false, message: json.message || MESSAGES.ERROR_UPDATE_FAILED };
        }

        window.Logger.debug('✅ Stop status updated', json.stop);
        return { success: true, stop: json.stop };
      } catch (err) {
        window.Logger.error('❌ Update stop failed', err);
        return {
          success: false,
          message: err.name === 'AbortError' ? MESSAGES.ERROR_TIMEOUT : MESSAGES.ERROR_NETWORK,
        };
      }
    },

    /**
     * Upload alcohol check result
     * @param {object} params
     * @returns {Promise<{success: boolean, checkedDrivers?: string[], message?: string}>}
     */
    async uploadAlcohol({ reference, driverName, userId, alcoholValue, lat, lng, imageBase64, accuracy }) {
      window.Logger.info('🍺 Uploading alcohol check', { driverName });

      try {
        const form = makeFormBody({
          action: ACTIONS.UPLOAD_ALCOHOL,
          reference: reference,
          driverName: driverName,
          userId: userId,
          alcoholValue: alcoholValue,
          lat: String(lat),
          lng: String(lng),
          imageBase64: imageBase64,
          accuracy: (accuracy !== undefined && accuracy !== null) ? String(accuracy) : undefined
        });

        const json = await fetchWithRetry(WEB_APP_URL, { method: 'POST', body: form });

        if (!json.success) {
          return { success: false, message: json.message || 'บันทึกการตรวจแอลกอฮอล์ไม่สำเร็จ' };
        }

        window.Logger.debug('✅ Alcohol uploaded', json.checkedDrivers);
        return { success: true, checkedDrivers: json.checkedDrivers };
      } catch (err) {
        window.Logger.error('❌ Alcohol upload failed', err);
        return { success: false, message: MESSAGES.ERROR_NETWORK };
      }
    },

    /**
     * Upload review/rating
     * @param {object} params
     * @returns {Promise<{success: boolean, stop?: *, message?: string}>}
     */
    async uploadReview({ reference, rowIndex, userId, score, lat, lng, signatureBase64, accuracy }) {
      window.Logger.info('⭐ Uploading review', { rowIndex, score });

      try {
        const form = makeFormBody({
          action: ACTIONS.UPLOAD_REVIEW,
          reference: reference,
          rowIndex: String(rowIndex),
          userId: userId,
          score: score,
          lat: String(lat),
          lng: String(lng),
          signatureBase64: signatureBase64,
          accuracy: (accuracy !== undefined && accuracy !== null) ? String(accuracy) : undefined
        });

        const json = await fetchWithRetry(WEB_APP_URL, { method: 'POST', body: form });

        if (!json.success) {
          return { success: false, message: json.message || 'บันทึกการประเมินไม่สำเร็จ' };
        }

        window.Logger.debug('✅ Review uploaded', json.stop);
        return { success: true, stop: json.stop };
      } catch (err) {
        window.Logger.error('❌ Review upload failed', err);
        return { success: false, message: MESSAGES.ERROR_NETWORK };
      }
    },

    /**
     * Fill in missing steps before end-trip
     * @param {object} params
     * @returns {Promise<{success: boolean, message?: string}>}
     */
    async fillMissingSteps({ reference, userId, lat, lng, missingData }) {
      window.Logger.info('📝 Filling missing steps', { reference });

      try {
        const form = makeFormBody({
          action: ACTIONS.FILL_MISSING,
          reference: reference,
          userId: userId,
          lat: String(lat),
          lng: String(lng),
          missingData: JSON.stringify(missingData)
        });

        const json = await fetchWithRetry(WEB_APP_URL, { method: 'POST', body: form });

        if (!json.success) {
          return { success: false, message: json.message || 'บันทึกข้อมูลที่ขาดไม่สำเร็จ' };
        }

        window.Logger.debug('✅ Missing steps filled');
        return { success: true };
      } catch (err) {
        window.Logger.error('❌ Fill missing steps failed', err);
        return { success: false, message: MESSAGES.ERROR_NETWORK };
      }
    },

    /**
     * End trip: save odometer and endpoint
     * @param {object} params
     * @returns {Promise<{success: boolean, message?: string}>}
     */
    async endTrip({ reference, userId, endOdo, endPointName, lat, lng }) {
      window.Logger.info('🏁 Ending trip', { reference });

      try {
        const form = makeFormBody({
          action: ACTIONS.END_TRIP,
          reference: reference,
          userId: userId,
          endOdo: endOdo || '',
          endPointName: endPointName || '',
          lat: String(lat || ''),
          lng: String(lng || '')
        });

        const json = await fetchWithRetry(WEB_APP_URL, { method: 'POST', body: form });

        if (!json.success) {
          return { success: false, message: json.message || 'บันทึกข้อมูลจบทริปไม่สำเร็จ' };
        }

        window.Logger.debug('✅ Trip ended');
        return { success: true };
      } catch (err) {
        window.Logger.error('❌ End trip failed', err);
        return { success: false, message: MESSAGES.ERROR_NETWORK };
      }
    },

    /**
     * Close a job (mark vehicle as ready)
     * @param {object} params
     * @returns {Promise<{success: boolean, stop?: *, message?: string}>}
     */
    async closeJob({ reference, userId }) {
      window.Logger.info('🔐 Closing job', { reference });

      try {
        const url =
          WEB_APP_URL + '?action=' + ACTIONS.CLOSE_JOB +
          '&reference=' + encodeURIComponent(reference) +
          '&userId=' + encodeURIComponent(userId);

        const json = await fetchWithRetry(url);

        if (!json.success) {
          return { success: false, message: json.message || 'ไม่สามารถปิดงานได้' };
        }

        window.Logger.debug('✅ Job closed', json.stop);
        return { success: true, stop: json.stop };
      } catch (err) {
        window.Logger.error('❌ Close job failed', err);
        return {
          success: false,
          message: err.name === 'AbortError' ? MESSAGES.ERROR_TIMEOUT : MESSAGES.ERROR_NETWORK,
        };
      }
    },

    /**
     * Save awareness acknowledgment with image to Google Sheet
     * @param {object} params
     * @returns {Promise<{success: boolean, message?: string}>}
     */
    async saveAwareness({ reference, userId, imageBase64, imageUrl, lat, lng, accuracy, timestamp }) {
      window.Logger.info('📸 Saving awareness acknowledgment', { reference });

      try {
        const form = makeFormBody({
          action: 'saveAwareness',
          reference: reference,
          userId: userId,
          imageBase64: imageBase64,
          imageUrl: imageUrl,
          lat: String(lat || ''),
          lng: String(lng || ''),
          accuracy: accuracy !== undefined ? String(accuracy) : '',
          timestamp: timestamp || ''
        });

        const json = await fetchWithRetry(WEB_APP_URL, { method: 'POST', body: form });

        if (!json.success) {
          return { success: false, message: json.message || 'ไม่สามารถบันทึกได้' };
        }

        window.Logger.debug('✅ Awareness saved');
        return { success: true };
      } catch (err) {
        window.Logger.error('❌ Save awareness failed', err);
        return { success: false, message: MESSAGES.ERROR_NETWORK };
      }
    },

    /**
     * Upload POD (Proof of Delivery) photos
     * @param {object} payload - {reference, userId, rowIndex, seq, beforeImage, afterImage, condition, note, lat, lng, accuracy, timestamp}
     * @returns {Promise<*>}
     */
    async uploadPOD(payload) {
      window.Logger.info('📤 uploadPOD', { reference: payload.reference, rowIndex: payload.rowIndex });
      try {
        const form = makeFormBody({
          action: 'UPLOAD_POD',
          reference: payload.reference,
          userId: payload.userId,
          rowIndex: String(payload.rowIndex || ''),
          seq: String(payload.seq || ''),
          beforeImage: payload.beforeImage || '',
          afterImage: payload.afterImage || '',
          condition: payload.condition || '',
          note: payload.note || '',
          lat: String(payload.lat || ''),
          lng: String(payload.lng || ''),
          accuracy: payload.accuracy !== undefined ? String(payload.accuracy) : '',
          timestamp: payload.timestamp || ''
        });

        const json = await fetchWithRetry(WEB_APP_URL, { method: 'POST', body: form });

        if (!json.success) {
          return { success: false, message: json.message || 'ไม่สามารถบันทึก POD ได้' };
        }

        window.Logger.debug('✅ POD uploaded');
        return { success: true, data: json.data || {} };
      } catch (err) {
        window.Logger.error('❌ Upload POD failed', err);
        return { success: false, message: MESSAGES.ERROR_NETWORK };
      }
    },

    /**
     * Send Emergency SOS alert
     * @param {object} payload - {reference, userId, emergencyType, detail, lat, lng, accuracy, timestamp}
     * @returns {Promise<*>}
     */
    async sendSOS(payload) {
      window.Logger.info('📤 sendSOS', { type: payload.emergencyType, reference: payload.reference });
      try {
        const form = makeFormBody({
          action: 'EMERGENCY_SOS',
          reference: payload.reference || 'ไม่มีงาน',
          userId: payload.userId,
          emergencyType: payload.emergencyType || '',
          detail: payload.detail || '',
          lat: String(payload.lat || ''),
          lng: String(payload.lng || ''),
          accuracy: payload.accuracy !== undefined ? String(payload.accuracy) : '',
          timestamp: payload.timestamp || ''
        });

        const json = await fetchWithRetry(WEB_APP_URL, { method: 'POST', body: form });

        if (!json.success) {
          return { success: false, message: json.message || 'ไม่สามารถส่ง SOS ได้' };
        }

        window.Logger.debug('✅ SOS sent');
        return { success: true, data: json.data || {} };
      } catch (err) {
        window.Logger.error('❌ Send SOS failed', err);
        return { success: false, message: MESSAGES.ERROR_NETWORK };
      }
    },
  };
})();
