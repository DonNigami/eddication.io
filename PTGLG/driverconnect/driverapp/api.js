/**
 * API Module: Centralized HTTP layer with retry logic, error recovery, and response validation
 * All requests go through this module for consistency and reliability
 */
(function(){
  const { WEB_APP_URL, TIMEOUT_MS, MAX_RETRIES, RETRY_DELAY_MS } = window.CONSTANTS.API;
  const { ACTIONS, MESSAGES } = window.CONSTANTS;

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
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
        cache: 'no-store',
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const err = new Error('HTTP ' + res.status + ': ' + (text || res.statusText));
        err.status = res.status;
        throw err;
      }

      return await res.json();
    } catch (err) {
      clearTimeout(id);

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
        const form = new URLSearchParams();
        form.append('rowIndex', String(rowIndex));
        form.append('status', String(status));
        form.append('type', String(type));
        form.append('userId', String(userId));
        form.append('lat', String(lat));
        form.append('lng', String(lng));

        if (type === 'checkin') {
          form.append('odo', String(odo || ''));
        }

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
    async uploadAlcohol({ reference, driverName, userId, alcoholValue, lat, lng, imageBase64 }) {
      window.Logger.info('🍺 Uploading alcohol check', { driverName });

      try {
        const form = new URLSearchParams();
        form.append('action', ACTIONS.UPLOAD_ALCOHOL);
        form.append('reference', reference);
        form.append('driverName', driverName);
        form.append('userId', userId);
        form.append('alcoholValue', alcoholValue);
        form.append('lat', String(lat));
        form.append('lng', String(lng));
        form.append('imageBase64', imageBase64);

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
    async uploadReview({ reference, rowIndex, userId, score, lat, lng, signatureBase64 }) {
      window.Logger.info('⭐ Uploading review', { rowIndex, score });

      try {
        const form = new URLSearchParams();
        form.append('action', ACTIONS.UPLOAD_REVIEW);
        form.append('reference', reference);
        form.append('rowIndex', String(rowIndex));
        form.append('userId', userId);
        form.append('score', score);
        form.append('lat', String(lat));
        form.append('lng', String(lng));
        form.append('signatureBase64', signatureBase64);

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
        const form = new URLSearchParams();
        form.append('action', ACTIONS.FILL_MISSING);
        form.append('reference', reference);
        form.append('userId', userId);
        form.append('lat', String(lat));
        form.append('lng', String(lng));
        form.append('missingData', JSON.stringify(missingData));

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
        const form = new URLSearchParams();
        form.append('action', ACTIONS.END_TRIP);
        form.append('reference', reference);
        form.append('userId', userId);
        form.append('endOdo', endOdo || '');
        form.append('endPointName', endPointName || '');
        form.append('lat', String(lat || ''));
        form.append('lng', String(lng || ''));

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
  };
})();
