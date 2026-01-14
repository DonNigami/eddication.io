/********************************
 * router.gs (READY - PATCHED for Frontend)
 * - รองรับ Admin APIs (GET/POST)
 * - รองรับ Driver APIs (GET/POST) ✅ updateStop / closejob
 * - รองรับ LIFF Upload (POST)
 * - รองรับ LINE Webhook (POST)
 * - รองรับ processdata (GET/POST) -> ใช้ชื่อเดิม uploadProcessData
 *
 * ✅ FIX สำคัญ:
 * - กัน jsonResponse ซ้อน jsonResponse (ContentOutput ซ้อน) ใน doPost
 ********************************/

/********************************
 * ✅ Helper: ตรวจว่าเป็น ContentOutput ไหม
 ********************************/
function isContentOutput_(x) {
  return x && typeof x.getContent === "function" && typeof x.getMimeType === "function";
}

/********************************
 * ✅ Helper: เรียกฟังก์ชันแบบปลอดภัย (กัน ReferenceError)
 ********************************/
function callIfExists_(fnName, arg) {
  try {
    const fn = this[fnName];
    if (typeof fn !== 'function') {
      return { success: false, message: 'MISSING_FUNCTION: ' + fnName + ' is not defined' };
    }
    return fn(arg);
  } catch (err) {
    return { success: false, message: 'CALL_ERROR: ' + fnName + ' => ' + err };
  }
}

/********************************
 * ✅ Helper: ทำ e-like ให้ handler ที่เคยอ่าน e.parameter ใช้ได้ใน doPost
 ********************************/
function toEventLike_(e, body) {
  return {
    parameter: body || {},
    postData: (e && e.postData) ? e.postData : null
  };
}

/********************************
 * doGet: Web App / LIFF / Admin
 ********************************/
function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const action = String(params.action || '').trim().toLowerCase();
    const page   = String(params.page || '').trim().toLowerCase();

    // =========================
    // ✅ Process Data (GET)
    // =========================
    if (action === 'processdata') {
      const result = callIfExists_('uploadProcessData', e); // ✅ ใช้ชื่อเดิม
      // uploadProcessData ของคุณคืน object เป็นหลัก → wrap ได้
      // แต่กันไว้ถ้าวันหนึ่งคืน ContentOutput
      if (isContentOutput_(result)) return result;
      return jsonResponse(result);
    }

    // =========================
    // Admin APIs (GET)
    // =========================
    if (action === 'checkadmin') {
      return handleCheckAdmin(e);

    } else if (action === 'adminjobdata') {
      return handleAdminJobdata(e);

    } else if (action === 'adminalcohol') {
      return handleAdminAlcohol(e);

    } else if (action === 'adminuserprofile') {
      return handleAdminUserprofile(e);

    } else if (action === 'adminaddstop') {
      const result = handleAdminAddStop(e);
      if (isContentOutput_(result)) return result;
      return jsonResponse(result);
    }

    // =========================
    // Admin UI
    // =========================
    if (page === 'admin') {
      return HtmlService.createTemplateFromFile('admin')
        .evaluate()
        .setTitle('Admin Console - Driver Tracking')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    // =========================
    // Driver API (GET)
    // =========================
    if (action === 'search') {
      // handleSearchShipment คืน ContentOutput อยู่แล้ว → return ตรงๆ
      return handleSearchShipment(e);

    } else if (action === 'updatestop') {
      return handleUpdateStop(e);

    } else if (action === 'closejob') {
      return handleCloseJob(e);
    }

    // =========================
    // Default driver UI
    // =========================
    return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('Driver Tracking')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  } catch (err) {
    Logger.log('doGet error: ' + err);
    return jsonResponse({ success: false, message: 'SERVER_ERROR: ' + err });
  }
}

/********************************
 * doPost: LINE Webhook / LIFF Upload / Admin / Driver POST / ProcessData
 ********************************/
function doPost(e) {
  try {
    if (!e || !e.postData) {
      return ContentService.createTextOutput('NO_EVENT');
    }

    const contentType = String(e.postData.type || '').toLowerCase();
    const rawBody     = e.postData.contents || '';
    let body          = {};

    // =========================
    // Parse body
    // =========================
    if (contentType.indexOf('application/json') !== -1) {
      try {
        body = JSON.parse(rawBody || '{}');
      } catch (err) {
        Logger.log('doPost JSON parse error (application/json): ' + err);
        body = {};
      }
    } else {
      const trimmed = String(rawBody || '').trim();
      if (trimmed && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
        try {
          body = JSON.parse(trimmed);
        } catch (err) {
          Logger.log('doPost JSON parse error (text/plain): ' + err);
          body = {};
        }
      } else {
        body = {};
        const params = e.parameter || {};
        Object.keys(params).forEach(function (k) {
          body[k] = params[k];
        });
      }
    }

    // =========================
    // 1) LINE Webhook (ต้องมาก่อน)
    // =========================
    if (body && body.events) {
      const events = body.events || [];
      events.forEach(function (event) {
        const type = event.type;
        if (type === 'follow') {
          handleFollowEvent(event);
        } else if (type === 'message') {
          handleMessageEvent(event);
        }
      });
      return ContentService.createTextOutput('OK');
    }

    // normalize action
    const action = String((body && body.action) ? body.action : '').trim().toLowerCase();

    // =========================
    // ✅ 1.5) Process Data (POST)
    // =========================
    if (action === "processdata" || action === "uploadprocessdata") {
      // uploadProcessData ของคุณ "คืน object" → wrap ได้
      const result = uploadProcessData(body);
      if (isContentOutput_(result)) return result;
      return jsonResponse(result);
    }

    // =========================
    // ✅ 1.6) Driver: updateStop (POST)  <-- FIX: ห้ามห่อ jsonResponse ซ้ำ
    // =========================
    if (action === 'updatestop') {
      const result = handleUpdateStop(toEventLike_(e, body));
      return isContentOutput_(result) ? result : jsonResponse(result);
    }

    // =========================
    // ✅ 1.7) Driver: closejob (POST)  <-- FIX: ห้ามห่อ jsonResponse ซ้ำ
    // =========================
    if (action === 'closejob') {
      const result = handleCloseJob(toEventLike_(e, body));
      return isContentOutput_(result) ? result : jsonResponse(result);
    }

    // =========================
    // 2) LIFF: แอลกอฮอล์
    // =========================
    if (action === 'uploadalcohol') {
      const result = handleAlcoholUpload(body);
      return isContentOutput_(result) ? result : jsonResponse(result);
    }

    // =========================
    // 3) LIFF: Review + ลายเซ็น
    // =========================
    if (action === 'uploadreview') {
      const result = handleReviewUpload(body);
      return isContentOutput_(result) ? result : jsonResponse(result);
    }

    // =========================
    // 4) Admin: อัปเดต userprofile status
    // =========================
    if (action === 'updateuserstatus') {
      const result = handleAdminUpdateUserStatus(body);
      return isContentOutput_(result) ? result : jsonResponse(result);
    }

    // =========================
    // 5) Admin: อัปเดต jobdata
    // =========================
    if (action === 'adminupdatejob') {
      const result = handleAdminUpdateJob(body);
      return isContentOutput_(result) ? result : jsonResponse(result);
    }

    // =========================
    // 6) Admin: อัปเดต alcoholcheck
    // =========================
    if (action === 'adminupdatealcohol') {
      const result = handleAdminUpdateAlcohol(body);
      return isContentOutput_(result) ? result : jsonResponse(result);
    }

    // =========================
    // 6.1) Admin: เพิ่มจุดเพิ่ม (POST)
    // =========================
    if (action === 'adminaddstop') {
      const result = handleAdminAddStop(body);
      return isContentOutput_(result) ? result : jsonResponse(result);
    }

    // =========================
    // 7) LIFF: จบทริป (End Trip Summary)
    // =========================
    if (action === 'endtrip') {
      const result = handleEndTripSummary(body);
      return isContentOutput_(result) ? result : jsonResponse(result);
    }

    // =========================
    // ✅ Default: ถ้ามี action แต่ไม่รู้จัก -> ส่ง JSON (กัน frontend parse พัง)
    // =========================
    if (action) {
      return jsonResponse({ success: false, message: 'UNKNOWN_ACTION: ' + action });
    }

    return ContentService.createTextOutput('NO_EVENT');

  } catch (err) {
    Logger.log('doPost error: ' + err);
    try {
      return jsonResponse({ success: false, message: 'SERVER_ERROR: ' + err });
    } catch (e2) {
      return ContentService.createTextOutput('ERROR');
    }
  }
}
