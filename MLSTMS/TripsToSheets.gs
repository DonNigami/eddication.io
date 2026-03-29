/**
 * MLSTMS - PTG eZView Integration to Google Sheets
 *
 * สคริปต์สำหรับดึงข้อมูล Trips และ Trip Details จาก PTG eZView API
 * มาบันทึกลงใน Google Sheets
 *
 * ขั้นตอนการติดตั้ง:
 * 1. เปิด Google Sheets ใหม่
 * 2. ไปที่ Extensions > Apps Script
 * 3. สร้างไฟล์ใหม่และวางโค้ดนี้
 * 4. ตั้งค่า Properties Service (ดูฟังก์ชัน setupConfig)
 * 5. รันฟังก์ชัน pullTripsToSheet()
 */

// ============================================
// CONFIGURATION
// ============================================

/**
 * ตั้งค่าเริ่มต้น (รันครั้งแรกเท่านั้น)
 */
function setupConfig() {
  const scriptProperties = PropertiesService.getScriptProperties();

  const config = {
    // API Base URL
    BASE_URL:
      "http://203.151.215.230:9000/eZViewIntegrationService/web-service/api",

    // Device Info (สำหรับการล็อกอิน)
    DEVICE_ID: "google-sheets-integration",
    DEVICE_NAME: "Google Sheets Integration",
    DEVICE_TYPE: "web",
    OS: "Google Apps Script",

    // ชื่อ Sheet ที่ต้องการบันทึกข้อมูล
    TRIPS_SHEET_NAME: "Trips",
    TRIP_DETAILS_SHEET_NAME: "TripDetails",

    // Query Parameters (สำหรับดึง trips)
    STATUS_ID: "", // สถานะ trip (ว่างเปล่า = ทั้งหมด) - ✅ ว่างเปล่าจะดึงจากทุก Status ID (1-7)
    // Status ID ที่รองรับ: 1, 2, 3, 4, 5, 6, 7
    // ถ้าไม่ระบุ statusId ระบบจะดึงข้อมูลจากทุก status โดยการ loop ไล่จาก 1-7
    START_DATE: "", // รูปแบบ: YYYY-MM-DD (ว่างเปล่า = ทั้งหมด)
    END_DATE: "", // รูปแบบ: YYYY-MM-DD (ว่างเปล่า = ทั้งหมด)
    LIMIT: "50", // จำนวน trips ต่อครั้ง

    // Rate Limiting
    RATE_LIMIT_MS: "1000", // หน่วงเวลาระหว่าง trip (ms) - 1000ms = 1 วินาที (ใส่ 0 เพื่อปิด)
    FAST_MODE: "false", // เปิด fast mode (skip rate limiting) - true/false

    // ⚡ Performance Optimization (Phase 1)
    ADAPTIVE_RATE_LIMIT: "true", // เปิด adaptive rate limiting - ปรับ delay ตามความเร็ว API
    MIN_RATE_LIMIT_MS: "100", // Minimum delay ถ้า API ตอบเร็ว (ms)
    MAX_RATE_LIMIT_MS: "1000", // Maximum delay ถ้า API ตอบช้า (ms)
    TARGET_RESPONSE_TIME_MS: "500", // Target response time threshold (ms)
    LOG_LEVEL: "NORMAL", // Logging level: 'MINIMAL', 'NORMAL', 'VERBOSE', 'DEBUG'
    LOG_BATCH_SIZE: "10", // Log every N trips (เพื่อลด overhead)
    OPTIMAL_BATCH_SIZE: "auto", // 'auto' = คำนวณอัตโนมัติ หรือระบุตัวเลข
    PERFORMANCE_MODE: "BALANCED", // 'SAFE', 'BALANCED', 'TURBO'
  };

  scriptProperties.setProperties(config);
  Logger.log("✅ Initial configuration saved!");
  Logger.log(
    '📝 Note: Username is hardcoded as "LPG_Bulk" - only password needs to be provided.',
  );
  Logger.log(
    "📝 Default STATUS_ID is set to empty string (pulls ALL trip statuses).",
  );
  Logger.log(
    "⚡ Performance optimizations enabled (Adaptive Rate Limiting: ON)",
  );
}

/**
 * แสดง Dialog สำหรับใส่ Username/Password
 */
function showLoginDialog() {
  // ดึงค่า credentials ที่บันทึกไว้
  const scriptProperties = PropertiesService.getScriptProperties();
  const savedUsername = scriptProperties.getProperty("USERNAME") || "";
  const savedPassword = scriptProperties.getProperty("PASSWORD") || "";
  const hasSavedCreds = savedUsername && savedPassword;

  // ดึงค่า query parameters ที่บันทึกไว้
  const savedStatusId = scriptProperties.getProperty("STATUS_ID") || "";
  const savedLimit = scriptProperties.getProperty("LIMIT") || "50";

  // ดึงวันที่บันทึกไว้ ถ้าไม่มีให้ใช้วันนี้
  const today = new Date();
  const todayStr = Utilities.formatDate(
    today,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd",
  );
  const savedStartDate = scriptProperties.getProperty("START_DATE") || todayStr;
  const savedEndDate = scriptProperties.getProperty("END_DATE") || todayStr;

  const html = HtmlService.createHtmlOutput(
    `
    <!DOCTYPE html>
    <html>
    <head>
      <base target="_top">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          max-width: 400px;
          margin: 0 auto;
          background: white;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h2 {
          color: #4285F4;
          margin-top: 0;
          margin-bottom: 20px;
          text-align: center;
        }
        .logo {
          text-align: center;
          font-size: 48px;
          margin-bottom: 10px;
        }
        .saved-badge {
          background: #e8f5e9;
          color: #2e7d32;
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 12px;
          text-align: center;
          margin-bottom: 15px;
          border: 1px solid #a5d6a7;
        }
        .saved-badge .icon {
          font-size: 16px;
          margin-right: 5px;
        }
        .form-group {
          margin-bottom: 15px;
        }
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
          color: #333;
        }
        input[type="text"],
        input[type="password"],
        input[type="date"] {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          box-sizing: border-box;
        }
        input:focus {
          outline: none;
          border-color: #4285F4;
        }
        .btn-group {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }
        button {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.3s;
        }
        .btn-primary {
          background: #4285F4;
          color: white;
        }
        .btn-primary:hover {
          background: #3367D6;
        }
        .btn-secondary {
          background: #f1f3f4;
          color: #333;
        }
        .btn-secondary:hover {
          background: #e8eaed;
        }
        .advanced-toggle {
          text-align: center;
          margin: 15px 0;
        }
        .advanced-toggle a {
          color: #4285F4;
          text-decoration: none;
          font-size: 13px;
        }
        .advanced-toggle a:hover {
          text-decoration: underline;
        }
        .advanced {
          display: none;
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid #eee;
        }
        .advanced.show {
          display: block;
        }
        .note {
          font-size: 12px;
          color: #666;
          margin-top: 15px;
          padding: 10px;
          background: #fff8e1;
          border-radius: 4px;
        }
        .status {
          margin-top: 15px;
          padding: 10px;
          border-radius: 4px;
          display: none;
          text-align: center;
          font-size: 13px;
        }
        .status.success {
          background: #d4edda;
          color: #155724;
          display: block;
        }
        .status.error {
          background: #f8d7da;
          color: #721c24;
          display: block;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">🚚</div>
        <h2>PTG eZView Login</h2>

        ${
          hasSavedCreds
            ? `
        <div class="saved-badge">
          <span class="icon">💾</span>
          Loaded saved credentials for: <strong>${savedUsername}</strong>
        </div>
        `
            : ""
        }

        <form id="loginForm" onsubmit="handleSubmit(event)">
          <div class="form-group">
            <label for="username">Username:</label>
            <input type="text" id="username" name="username" required placeholder="Enter username" value="${savedUsername}">
          </div>

          <div class="form-group">
            <label for="password">Password:</label>
            <input type="password" id="password" name="password" required placeholder="Enter password" value="${savedPassword}">
          </div>

          <div class="form-group" style="background: #e3f2fd; padding: 10px; border-radius: 4px; border: 1px solid #90caf9;">
            <label style="display: flex; align-items: center; cursor: pointer;" for="pullToday">
              <input type="checkbox" id="pullToday" name="pullToday" style="width: 18px; height: 18px; margin-right: 8px;">
              <span style="font-weight: 500; color: #1976d2;">📅 Pull today's data only (00:00 - 23:59)</span>
            </label>
            <small style="color: #666; display: block; margin-top: 5px;">เลือกเพื่อดึงเฉพาะข้อมูลวันนี้ หรือยกเลิกเลือกเพื่อดึงทั้งหมดตาม Advanced Options</small>
          </div>

          <div class="advanced-toggle">
            <a href="#" onclick="toggleAdvanced()">Advanced Options ▼</a>
          </div>

          <div class="advanced" id="advanced">
            <div class="form-group">
              <label for="statusId">Status ID (optional):</label>
              <input type="text" id="statusId" name="statusId" placeholder="e.g., 4 (empty for all)" value="${savedStatusId}">
            </div>

            <div class="form-group">
              <label for="startDate">Start Date (optional):</label>
              <input type="date" id="startDate" name="startDate" value="${savedStartDate}">
              <small style="color: #666; font-size: 11px;">รูปแบบ: YYYY-MM-DD (เวลา: 00:00 - สิ้นสุด 23:59)</small>
            </div>

            <div class="form-group">
              <label for="endDate">End Date (optional):</label>
              <input type="date" id="endDate" name="endDate" value="${savedEndDate}">
              <small style="color: #666; font-size: 11px;">รูปแบบ: YYYY-MM-DD (เวลา: 00:00 - สิ้นสุด 23:59)</small>
            </div>

            <div class="form-group" style="background: #e8f5e9; padding: 8px; border-radius: 4px; border-left: 3px solid #4caf50;">
              <small style="color: #2e7d32; font-size: 12px;">
                💡 <strong>หมายเหตุ:</strong> ข้อมูลจะดึงตั้งแต่ 00:00 ถึง 23:59 ของวันที่เลือก
              </small>
            </div>

            <div class="form-group">
              <label for="limit">Limit:</label>
              <input type="text" id="limit" name="limit" value="${savedLimit}" placeholder="Number of trips">
            </div>
          </div>

          <div class="btn-group">
            <button type="submit" class="btn-primary">Login & Pull Data</button>
            <button type="button" class="btn-secondary" onclick="google.script.host.close()">Cancel</button>
          </div>
        </form>

        <div class="note">
          ${
            hasSavedCreds
              ? '💾 Credentials loaded from saved storage. You can modify them before logging in, or click "Login & Pull Data" to use the saved credentials.'
              : "ℹ️ Your credentials will be saved for future use. Stored securely in Google Properties Service."
          }
        </div>

        <div id="status" class="status"></div>
      </div>

      <script>
        function toggleAdvanced() {
          const advanced = document.getElementById('advanced');
          advanced.classList.toggle('show');
          const link = document.querySelector('.advanced-toggle a');
          if (advanced.classList.contains('show')) {
            link.textContent = 'Advanced Options ▲';
          } else {
            link.textContent = 'Advanced Options ▼';
          }
        }

        function handleSubmit(event) {
          event.preventDefault();

          const statusDiv = document.getElementById('status');
          statusDiv.className = 'status';
          statusDiv.textContent = 'Logging in...';

          // Check if "Pull today's data only" is selected
          const pullToday = document.getElementById('pullToday').checked;

          const formData = {
            username: document.getElementById('username').value,
            password: document.getElementById('password').value,
            pullToday: pullToday, // ✅ Send checkbox state
            statusId: document.getElementById('statusId').value,
            startDate: document.getElementById('startDate').value,
            endDate: document.getElementById('endDate').value,
            limit: document.getElementById('limit').value
          };

          google.script.run
            .withSuccessHandler(function(result) {
              if (result.success) {
                statusDiv.className = 'status success';
                statusDiv.textContent = result.message;

                setTimeout(function() {
                  google.script.host.close();
                }, 2000);
              } else {
                statusDiv.className = 'status error';
                statusDiv.textContent = result.message;
              }
            })
            .withFailureHandler(function(error) {
              statusDiv.className = 'status error';
              statusDiv.textContent = 'Error: ' + error.message;
            })
            .loginAndPull(formData);
        }
      </script>
    </body>
    </html>
  `,
  )
    .setWidth(450)
    .setHeight(600)
    .setTitle("PTG eZView Login");

  SpreadsheetApp.getUi().showModalDialog(html, "Login to PTG eZView");
}

/**
 * Login และดึงข้อมูล (เรียกจาก Dialog)
 */
function loginAndPull(formData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  try {
    ss.toast("💾 Saving credentials for future use...", "MLSTMS Trips", 5);

    // บันทึก credentials ไว้ใช้รอบหน้า
    const scriptProperties = PropertiesService.getScriptProperties();
    scriptProperties.setProperty("USERNAME", formData.username);
    scriptProperties.setProperty("PASSWORD", formData.password);

    // ✅ ถ้าเลือก "Pull today's data only"
    if (formData.pullToday) {
      const today = new Date();
      const todayStr = Utilities.formatDate(
        today,
        Session.getScriptTimeZone(),
        "yyyy-MM-dd",
      );

      scriptProperties.setProperty("START_DATE", todayStr);
      scriptProperties.setProperty("END_DATE", todayStr);
      scriptProperties.setProperty("STATUS_ID", ""); // ALL statuses

      ss.toast(`📅 Set to pull today's data: ${todayStr}`, "MLSTMS Trips", 3);
    } else {
      // บันทึก query parameters (ปกติ)
      if (formData.statusId)
        scriptProperties.setProperty("STATUS_ID", formData.statusId);
      if (formData.startDate)
        scriptProperties.setProperty("START_DATE", formData.startDate);
      if (formData.endDate)
        scriptProperties.setProperty("END_DATE", formData.endDate);
      if (formData.limit) scriptProperties.setProperty("LIMIT", formData.limit);
    }

    // Login
    ss.toast("🔐 Logging in...", "MLSTMS Trips", 5);
    const token = login();

    if (!token) {
      // ลบ credentials ที่บันทึกไว้ถ้า login ไม่สำเร็จ
      scriptProperties.deleteProperty("USERNAME");
      scriptProperties.deleteProperty("PASSWORD");

      return {
        success: false,
        message: "Login failed. Please check your credentials.",
      };
    }

    // ดึงข้อมูล
    pullTripsToSheet();

    return {
      success: true,
      message: "✅ Login successful! Credentials saved for future use.",
    };
  } catch (error) {
    ss.toast("❌ Error occurred", "MLSTMS Trips", 10);
    return {
      success: false,
      message: "Error: " + error.message,
    };
  }
}

/**
 * ตรวจสอบว่ามี Credentials ที่บันทึกไว้หรือไม่
 */
function hasSavedCredentials() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const username = scriptProperties.getProperty("USERNAME");
  const password = scriptProperties.getProperty("PASSWORD");
  return !!(username && password);
}

/**
 * ดึงค่า config จาก Properties Service
 */
function getConfig() {
  const scriptProperties = PropertiesService.getScriptProperties();

  // ⭐ ดึงค่า DateTime (ถ้ามี) สำหรับ Fast Pull
  const startDateTime = scriptProperties.getProperty("START_DATETIME") || "";
  const endDateTime = scriptProperties.getProperty("END_DATETIME") || "";

  // ⭐ อ่านค่า temp parameters (ถ้ามี) จาก dialog - มีความสำคัญกว่าค่า permanent
  const tempStatusId = scriptProperties.getProperty("TEMP_STATUS_ID");
  const tempStartDate = scriptProperties.getProperty("TEMP_START_DATE");
  const tempEndDate = scriptProperties.getProperty("TEMP_END_DATE");
  const tempLimit = scriptProperties.getProperty("TEMP_LIMIT");

  return {
    baseUrl: scriptProperties.getProperty("BASE_URL"),
    username: "LPG_Bulk", // 🔒 Hardcoded username as requested
    password: scriptProperties.getProperty("PASSWORD"),
    deviceId: scriptProperties.getProperty("DEVICE_ID"),
    deviceName: scriptProperties.getProperty("DEVICE_NAME"),
    deviceType: scriptProperties.getProperty("DEVICE_TYPE"),
    os: scriptProperties.getProperty("OS"),
    tripsSheetName: scriptProperties.getProperty("TRIPS_SHEET_NAME") || "Trips",
    tripDetailsSheetName:
      scriptProperties.getProperty("TRIP_DETAILS_SHEET_NAME") || "TripDetails",
    // ใช้ค่า temp ถ้ามี มิฉะนั้นใช้ค่า permanent
    statusId: tempStatusId || scriptProperties.getProperty("STATUS_ID") || "", // Default to ALL statuses (empty = all)
    startDate:
      tempStartDate || scriptProperties.getProperty("START_DATE") || "",
    endDate: tempEndDate || scriptProperties.getProperty("END_DATE") || "",

    // ⭐ DateTime สำหรับ Fast Pull (ISO 8601 format with timezone: 2026-03-21T00:00:00+07:00)
    startDateTime: startDateTime,
    endDateTime: endDateTime,

    limit: tempLimit || scriptProperties.getProperty("LIMIT") || "50",
    rateLimitMs: parseInt(
      scriptProperties.getProperty("RATE_LIMIT_MS") || "1000",
    ),
    fastMode: scriptProperties.getProperty("FAST_MODE") === "true",

    // ⚡ Performance optimizations
    adaptiveRateLimit:
      scriptProperties.getProperty("ADAPTIVE_RATE_LIMIT") === "true",
    minRateLimitMs: parseInt(
      scriptProperties.getProperty("MIN_RATE_LIMIT_MS") || "100",
    ),
    maxRateLimitMs: parseInt(
      scriptProperties.getProperty("MAX_RATE_LIMIT_MS") || "1000",
    ),
    targetResponseTimeMs: parseInt(
      scriptProperties.getProperty("TARGET_RESPONSE_TIME_MS") || "500",
    ),
    logLevel: scriptProperties.getProperty("LOG_LEVEL") || "NORMAL",
    logBatchSize: parseInt(
      scriptProperties.getProperty("LOG_BATCH_SIZE") || "10",
    ),
    optimalBatchSize:
      scriptProperties.getProperty("OPTIMAL_BATCH_SIZE") || "auto",
    performanceMode:
      scriptProperties.getProperty("PERFORMANCE_MODE") || "BALANCED",
  };
}

// ============================================
// PERFORMANCE OPTIMIZATION UTILITIES
// ============================================

/**
 * ⚡ Phase 1.1: Adaptive Sleep - ปรับ delay ตามความเร็ว API
 * @param {number} lastResponseTime - เวลาที่ API ใช้ตอบ (ms)
 */
function adaptiveSleep(lastResponseTime) {
  const config = getConfig();

  // ถ้า fast mode ไม่ต้อง sleep
  if (config.fastMode) return;

  // ถ้าไม่ได้เปิด adaptive rate limit ให้ใช้ค่าเดิม
  if (!config.adaptiveRateLimit) {
    Utilities.sleep(config.rateLimitMs);
    return;
  }

  // Adaptive: ถ้า API ตอบเร็ว → ลด delay, ถ้าช้า → ใช้ปกติ
  if (lastResponseTime < config.targetResponseTimeMs) {
    // API ตอบเร็ว ใช้ minimum delay
    Utilities.sleep(config.minRateLimitMs);
  } else {
    // API ตอบช้าใช้ normal delay
    Utilities.sleep(config.rateLimitMs);
  }
}

/**
 * ⚡ Phase 1.2: Smart Logging - ลด logging overhead
 * @param {string} message - ข้อความที่จะ log
 * @param {string} level - 'MINIMAL', 'NORMAL', 'VERBOSE', 'DEBUG'
 */
function smartLog(message, level = "NORMAL") {
  const config = getConfig();
  const levels = { MINIMAL: 0, NORMAL: 1, VERBOSE: 2, DEBUG: 3 };

  if (levels[level] <= levels[config.logLevel]) {
    Logger.log(message);
  }
}

/**
 * ⚡ Phase 1.3: Calculate Optimal Batch Size
 * คำนวณขนาด batch ที่เหมาะสมเพื่อใช้เวลา 5 นาทีอย่างเต็มประสิทธิภาพ
 * @returns {number} Optimal batch size
 */
function calculateOptimalBatchSize() {
  const config = getConfig();
  const TIME_LIMIT_MS = 5 * 60 * 1000; // 5 นาที (safe margin จาก 6 นาที limit)
  const avgRequestTimeMs = 500; // เฉลี่ย API response time
  const rateLimitMs = config.fastMode
    ? 0
    : config.adaptiveRateLimit
      ? config.minRateLimitMs
      : config.rateLimitMs;
  const totalTimePerTrip = avgRequestTimeMs + rateLimitMs;

  // คำนวณ batch size (ใช้ 80% ของเวลาที่มี เผื่อไว้สำหรับ overhead)
  const optimalBatchSize = Math.floor((TIME_LIMIT_MS * 0.8) / totalTimePerTrip);

  //  clamp ระหว่าง 20-100
  return Math.max(20, Math.min(100, optimalBatchSize));
}

/**
 * ⚡ Phase 3.1: Apply Performance Presets
 * ใช้ presets สำหรับ performance mode ต่างๆ
 */
function applyPerformancePreset() {
  const config = getConfig();
  const presets = {
    SAFE: {
      rateLimitMs: 2000,
      limit: 30,
      adaptiveRateLimit: false,
      logLevel: "VERBOSE",
    },
    BALANCED: {
      rateLimitMs: 500,
      limit: 75,
      adaptiveRateLimit: true,
      logLevel: "NORMAL",
    },
    TURBO: {
      rateLimitMs: 100,
      limit: 150,
      adaptiveRateLimit: true,
      logLevel: "MINIMAL",
    },
  };

  const preset = presets[config.performanceMode] || presets.BALANCED;

  // อัปเดตค่า config ด้วย preset values
  const scriptProperties = PropertiesService.getScriptProperties();

  if (preset.rateLimitMs)
    scriptProperties.setProperty("RATE_LIMIT_MS", String(preset.rateLimitMs));
  if (preset.limit) scriptProperties.setProperty("LIMIT", String(preset.limit));
  if (preset.adaptiveRateLimit !== undefined)
    scriptProperties.setProperty(
      "ADAPTIVE_RATE_LIMIT",
      String(preset.adaptiveRateLimit),
    );
  if (preset.logLevel)
    scriptProperties.setProperty("LOG_LEVEL", preset.logLevel);

  smartLog(`✅ Applied ${config.performanceMode} performance preset`, "NORMAL");
}

/**
 * ⚡ Phase 3.2: Benchmark API
 * ทดสอบความเร็ว API และแนะนำค่าที่เหมาะสม
 * @returns {object} Benchmark results
 */
function benchmarkAPI() {
  const startTime = Date.now();
  const testResponse = getTripsPaginated(0, 1);
  const responseTime = Date.now() - startTime;

  let recommendedRateLimit;
  let performanceMode;

  if (responseTime < 200) {
    recommendedRateLimit = 200; // Fast API
    performanceMode = "TURBO";
  } else if (responseTime < 500) {
    recommendedRateLimit = 500; // Normal API
    performanceMode = "BALANCED";
  } else {
    recommendedRateLimit = 1000; // Slow API
    performanceMode = "SAFE";
  }

  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty("RATE_LIMIT_MS", String(recommendedRateLimit));
  scriptProperties.setProperty("PERFORMANCE_MODE", performanceMode);

  return {
    responseTime: responseTime,
    recommendedRateLimit: recommendedRateLimit,
    performanceMode: performanceMode,
  };
}

// ============================================
// API AUTHENTICATION
// ============================================

/**
 * Login และรับ Access Token
 */
function login() {
  const config = getConfig();
  const url = `${config.baseUrl}/v1/login`;

  const payload = {
    username: config.username,
    password: config.password,
    deviceInfo: {
      deviceId: config.deviceId,
      deviceName: config.deviceName,
      deviceType: config.deviceType,
      os: config.os,
    },
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode !== 200) {
      throw new Error(
        `Login failed with status ${responseCode}: ${responseBody}`,
      );
    }

    const result = JSON.parse(responseBody);

    if (result && result.data && result.data.accessToken) {
      // บันทึก tokens ไว้ใน Properties
      const scriptProperties = PropertiesService.getScriptProperties();
      scriptProperties.setProperty("ACCESS_TOKEN", result.data.accessToken);
      scriptProperties.setProperty("REFRESH_TOKEN", result.data.refreshToken);
      scriptProperties.setProperty(
        "TOKEN_EXPIRES_AT",
        new Date(Date.now() + 55 * 60 * 1000).toISOString(),
      ); // 55 นาที

      Logger.log("✅ Login successful!");
      return result.data.accessToken;
    } else {
      throw new Error("Invalid response format: missing accessToken");
    }
  } catch (error) {
    Logger.log(`❌ Login error: ${error.message}`);
    throw error;
  }
}

/**
 * ดึง Access Token (พร้อมรีเฟรชถ้าจำเป็น)
 */
function getAccessToken() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const expiresAt = scriptProperties.getProperty("TOKEN_EXPIRES_AT");

  // ตรวจสอบว่า token หมดอายุหรือยัง
  if (expiresAt && new Date(expiresAt) > new Date()) {
    const token = scriptProperties.getProperty("ACCESS_TOKEN");
    if (token) return token;
  }

  // Token หมดอายุหรือไม่มี ให้ล็อกอินใหม่
  return login();
}

/**
 * รีเฟรช Access Token
 */
function refreshToken() {
  const config = getConfig();
  const scriptProperties = PropertiesService.getScriptProperties();
  const currentRefreshToken = scriptProperties.getProperty("REFRESH_TOKEN");

  if (!currentRefreshToken) {
    throw new Error("No refresh token available. Please login again.");
  }

  const url = `${config.baseUrl}/v1/refresh-token`;

  const payload = {
    refreshToken: currentRefreshToken,
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode !== 200) {
      throw new Error(
        `Refresh token failed with status ${responseCode}: ${responseBody}`,
      );
    }

    const result = JSON.parse(responseBody);

    if (result && result.data && result.data.accessToken) {
      scriptProperties.setProperty("ACCESS_TOKEN", result.data.accessToken);
      scriptProperties.setProperty("REFRESH_TOKEN", result.data.refreshToken);
      scriptProperties.setProperty(
        "TOKEN_EXPIRES_AT",
        new Date(Date.now() + 55 * 60 * 1000).toISOString(),
      );

      Logger.log("✅ Token refreshed successfully!");
      return result.data.accessToken;
    } else {
      throw new Error("Invalid response format: missing accessToken");
    }
  } catch (error) {
    Logger.log(`❌ Refresh token error: ${error.message}`);
    throw error;
  }
}

// ============================================
// API CALLS
// ============================================

/**
 * ดึงรายการ Trips
 */
function getTrips() {
  const config = getConfig();
  const token = getAccessToken();
  const url = `${config.baseUrl}/v1/trips`;

  // สร้าง query parameters
  const params = [];
  if (config.statusId) params.push(`statusId=${config.statusId}`);
  if (config.startDate) params.push(`startDate=${config.startDate}`);
  if (config.endDate) params.push(`endDate=${config.endDate}`);
  if (config.limit) params.push(`limit=${config.limit}`);

  const fullUrl = params.length > 0 ? `${url}?${params.join("&")}` : url;

  const options = {
    method: "get",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    muteHttpExceptions: true,
  };

  try {
    const response = UrlFetchApp.fetch(fullUrl, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode === 401) {
      // Token หมดอายุ ลองรีเฟรช
      const newToken = refreshToken();
      options.headers.Authorization = `Bearer ${newToken}`;
      const retryResponse = UrlFetchApp.fetch(fullUrl, options);
      return JSON.parse(retryResponse.getContentText());
    }

    if (responseCode !== 200) {
      throw new Error(
        `Get trips failed with status ${responseCode}: ${responseBody}`,
      );
    }

    return JSON.parse(responseBody);
  } catch (error) {
    Logger.log(`❌ Get trips error: ${error.message}`);
    throw error;
  }
}

/**
 * ✅ ดึงรายการ Trips ทั้งหมด (ทุกหน้า) แล้ว filter ด้วย openDateTime
 * ✅ Filter ตาม Status ID และ Date/Time เสมอ
 * @returns {Array} - Array ของ trips ทั้งหมดที่ผ่าน filter
 */
function getAllTrips() {
  const config = getConfig();
  const token = getAccessToken();
  const baseUrl = `${config.baseUrl}/v1/trips`;

  // ✅ แสดงว่ากำลัง filter ด้วยอะไรบ้าง
  const statusText = config.statusId
    ? `Status ${config.statusId}`
    : "ALL Statuses (1-5)";
  const dateText =
    config.startDate && config.endDate
      ? `Date: ${config.startDate} to ${config.endDate}`
      : config.startDateTime && config.endDateTime
        ? `DateTime: ${config.startDateTime} to ${config.endDateTime}`
        : "ALL dates";

  Logger.log(`🔄 getAllTrips() - Filters: ${statusText}, ${dateText}`);

  // ✅ ถ้าระบุ statusId ให้ดึงเฉพาะ statusId นั้น
  if (config.statusId) {
    Logger.log(
      `🔍 Status filter specified: ${config.statusId} - fetching ONLY this status`,
    );

    try {
      const trips = getAllTripsForStatusId(config.statusId);

      // 🔍 Filter ด้วย openDateTime (ถ้าระบุ startDate/endDate)
      if (config.startDate && config.endDate) {
        Logger.log(
          `🔍 Applying date filter: ${config.startDate} to ${config.endDate}`,
        );
        const filteredTrips = filterTripsByDate(
          trips,
          config.startDate,
          config.endDate,
        );
        Logger.log(
          `✅ Filtered result: ${trips.length} → ${filteredTrips.length} trips`,
        );
        return filteredTrips;
      }

      return trips;
    } catch (error) {
      Logger.log(
        `❌ Error fetching Status ${config.statusId}: ${error.message}`,
      );
      return [];
    }
  }

  // ✅ ถ้าไม่ระบุ statusId ให้ดึงจาก Status ID 1-5 เท่านั้น
  Logger.log(`🔍 No statusId specified - fetching from ALL statuses (1-5)`);

  const allTripsFromAllStatuses = [];
  const STATUS_IDS = [1, 2, 3, 4, 5]; // ✅ ใช้เฉพาะ Status ID 1-5

  for (const statusId of STATUS_IDS) {
    Logger.log(`📍 Fetching trips for statusId=${statusId}...`);

    try {
      const tripsForStatus = getAllTripsForStatusId(statusId);

      // ✅ ถ้าไม่พบข้อมูล ให้ข้ามไป Status ถัดไปเลย
      if (!tripsForStatus || tripsForStatus.length === 0) {
        Logger.log(
          `   ⏭️  Status ${statusId}: No data found - skipping to next status`,
        );
        continue; // ข้ามไป Status ถัดไป
      }

      allTripsFromAllStatuses.push(...tripsForStatus);
      Logger.log(
        `   ✅ Status ${statusId}: ${tripsForStatus.length} trips (total: ${allTripsFromAllStatuses.length})`,
      );

      // ⚠️ Rate limiting between status IDs - เพิ่มเพื่อหลีด 429
      Utilities.sleep(2000); // เพิ่มจาก 1000ms → 2000ms (2 วินาที) เพื่อหลีด 429
    } catch (error) {
      Logger.log(`   ⚠️ Error fetching status ${statusId}: ${error.message}`);
    }
  }

  // ลบ duplicates โดยใช้ Trip ID
  const uniqueTrips = [];
  const seenTripIds = new Set();

  for (const trip of allTripsFromAllStatuses) {
    const tripId = getTripField(trip, [
      "id",
      "tripId",
      "trip_code",
      "tripCode",
      "trip_id",
    ]);
    if (tripId && !seenTripIds.has(String(tripId))) {
      seenTripIds.add(String(tripId));
      uniqueTrips.push(trip);
    }
  }

  Logger.log(
    `✅ Total unique trips from all statuses: ${uniqueTrips.length} (from ${allTripsFromAllStatuses.length} raw records)`,
  );

  // 🔍 Filter ด้วย openDateTime (ถ้าระบุ startDate/endDate)
  if (config.startDate && config.endDate) {
    Logger.log(
      `🔍 Applying date filter: ${config.startDate} to ${config.endDate}`,
    );
    // ✅ ใช้ filterTripsByDate สำหรับ date-only filtering
    const filteredTrips = filterTripsByDate(
      uniqueTrips,
      config.startDate,
      config.endDate,
    );
    Logger.log(
      `✅ Filtered result: ${uniqueTrips.length} → ${filteredTrips.length} trips`,
    );
    return filteredTrips;
  }

  return uniqueTrips;
}

/**
 * ✅ ดึง Trips ทั้งหมดสำหรับ Status ID ที่ระบุ
 * @param {string} statusId - Status ID ที่ต้องการดึง
 * @returns {Array} - Array ของ trips
 */
function getAllTripsForStatusId(statusId) {
  const config = getConfig();
  const token = getAccessToken();
  const baseUrl = `${config.baseUrl}/v1/trips`;

  // ✅ สร้าง query parameters - ส่ง startDate/endDate ไปให้ API filter
  const params = [];
  params.push(`statusId=${statusId}`);

  // ✅ ใช้ startDateTime/endDateTime ถ้ามี (แปลงเป็นวันที่ YYYY-MM-DD)
  if (config.startDateTime && config.endDateTime) {
    const startDateOnly = config.startDateTime.split("T")[0];
    const endDateOnly = config.endDateTime.split("T")[0];
    params.push(`startDate=${startDateOnly}`);
    params.push(`endDate=${endDateOnly}`);
    Logger.log(
      `📅 Filtering by date (API): ${startDateOnly} to ${endDateOnly} (from datetime: ${config.startDateTime} - ${config.endDateTime})`,
    );
  } else if (config.startDate && config.endDate) {
    params.push(`startDate=${config.startDate}`);
    params.push(`endDate=${config.endDate}`);
    Logger.log(
      `📅 Filtering by date (API): ${config.startDate} to ${config.endDate}`,
    );
  } else {
    Logger.log(
      `📅 No date filter specified - fetching all trips for statusId=${statusId}`,
    );
  }

  const options = {
    method: "get",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    muteHttpExceptions: true,
  };

  try {
    let allTrips = [];
    let offset = 0;
    const limit = 100; // API limit ต่อหน้า
    let hasNextPage = true;
    let pageCount = 0;

    Logger.log(
      `🔄 Starting to fetch ALL trips for statusId=${statusId} (all pages)...`,
    );

    while (hasNextPage) {
      pageCount++;
      const pageParams = [...params, `limit=${limit}`, `offset=${offset}`];
      const fullUrl = `${baseUrl}?${pageParams.join("&")}`;

      Logger.log(
        `📖 Fetching page ${pageCount} (offset=${offset}, limit=${limit})...`,
      );

      const response = UrlFetchApp.fetch(fullUrl, options);
      const responseCode = response.getResponseCode();
      const responseBody = response.getContentText();

      if (responseCode === 401) {
        Logger.log(`🔄 Token expired, refreshing...`);
        const newToken = refreshToken();
        options.headers.Authorization = `Bearer ${newToken}`;
        continue; // Retry same page
      }

      if (responseCode !== 200) {
        Logger.log(`❌ API Error ${responseCode}: ${responseBody}`);
        throw new Error(
          `Get trips failed with status ${responseCode}: ${responseBody}`,
        );
      }

      const result = JSON.parse(responseBody);

      // ดึง trips จาก response
      let tripsInPage = [];
      if (result && result.data && Array.isArray(result.data)) {
        tripsInPage = result.data;
      } else if (result && Array.isArray(result)) {
        tripsInPage = result;
      }

      allTrips = allTrips.concat(tripsInPage);
      Logger.log(
        `   ✅ Page ${pageCount}: ${tripsInPage.length} trips | Total so far: ${allTrips.length}`,
      );

      // เช็ค hasNextPage
      if (result && result.pagination) {
        hasNextPage = result.pagination.hasNextPage;
      } else {
        // ถ้าไม่มี pagination field ให้เช็คจากจำนวน trips
        hasNextPage = tripsInPage.length === limit;
      }

      // ถ้าไม่มีข้อมูลเพิ่ม ให้หยุด
      if (tripsInPage.length === 0) {
        hasNextPage = false;
      }

      offset += limit;

      // Rate limiting (แต่ละหน้า)
      if (!config.fastMode && config.rateLimitMs > 0) {
        Utilities.sleep(Math.min(config.rateLimitMs, 500));
      }
    }

    Logger.log(
      `✅ Fetched ALL trips for statusId=${statusId}: ${allTrips.length} trips from ${pageCount} pages`,
    );

    return allTrips;
  } catch (error) {
    Logger.log(
      `❌ Get all trips error for statusId=${statusId}: ${error.message}`,
    );
    throw error;
  }
}

/**
 * ✅ ดึง Trips ทั้งหมดสำหรับ Status ID ที่ระบุ พร้อม Filter วันที่อย่างเข้มงวด
 * 🔴 ฟังก์ชันใหม่ - กรองทั้ง API level และ Client level (double-check)
 * @param {number} statusId - Status ID ที่ต้องการดึง
 * @param {string} startDate - วันที่เริ่ม (YYYY-MM-DD) หรือ null ถ้าต้องการทั้งหมด
 * @param {string} endDate - วันที่สิ้นสุด (YYYY-MM-DD) หรือ null ถ้าต้องการทั้งหมด
 * @returns {Array} - Array ของ trips ที่ผ่านการ filter
 */
function getAllTripsForStatusIdWithDateFilter(statusId, startDate, endDate) {
  const config = getConfig();
  const token = getAccessToken();
  const timezone = Session.getScriptTimeZone();
  const baseUrl = `${config.baseUrl}/v1/trips`;

  // สร้าง query parameters พร้อม pagination
  const params = [];
  params.push(`statusId=${statusId}`);

  // ✅ ส่ง startDate/endDate ไปให้ API filter (API level filtering)
  if (startDate && endDate) {
    params.push(`startDate=${startDate}`);
    params.push(`endDate=${endDate}`);
    Logger.log(`📅 Filtering by date (API): ${startDate} to ${endDate}`);
  } else {
    Logger.log(`📅 No date filter - fetching all trips for statusId=${statusId}`);
  }

  // ✅ สร้าง Date objects สำหรับ Client-side filtering (double-check)
  let startFilter = null;
  let endFilter = null;
  if (startDate && endDate) {
    startFilter = new Date(`${startDate}T00:00:00`);
    endFilter = new Date(`${endDate}T23:59:59`);
    Logger.log(`📅 Client-side filter: ${startFilter.toISOString()} to ${endFilter.toISOString()}`);
  }

  const options = {
    method: "get",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    muteHttpExceptions: true,
  };

  try {
    let allTrips = [];
    let offset = 0;
    const limit = 100;
    let hasNextPage = true;
    let pageCount = 0;

    Logger.log(`🔄 Starting to fetch ALL trips for statusId=${statusId} (all pages)...`);

    while (hasNextPage) {
      pageCount++;
      const pageParams = [...params, `limit=${limit}`, `offset=${offset}`];
      const fullUrl = `${baseUrl}?${pageParams.join("&")}`;

      Logger.log(`📖 Fetching page ${pageCount} (offset=${offset}, limit=${limit})...`);

      const response = UrlFetchApp.fetch(fullUrl, options);
      const responseCode = response.getResponseCode();
      const responseBody = response.getContentText();

      if (responseCode === 401) {
        Logger.log(`🔄 Token expired, refreshing...`);
        const newToken = refreshToken();
        options.headers.Authorization = `Bearer ${newToken}`;
        continue;
      }

      if (responseCode !== 200) {
        Logger.log(`❌ API Error ${responseCode}: ${responseBody}`);
        throw new Error(`Get trips failed with status ${responseCode}: ${responseBody}`);
      }

      const result = JSON.parse(responseBody);

      let tripsInPage = [];
      if (result && result.data && Array.isArray(result.data.trips)) {
        tripsInPage = result.data.trips;
      } else if (result && result.data && Array.isArray(result.data)) {
        tripsInPage = result.data;
      } else if (result && Array.isArray(result)) {
        tripsInPage = result;
      }

      // ✅ Client-side filtering (double-check) - กรองด้วย openDateTime
      let filteredInPage = tripsInPage;
      if (startFilter && endFilter && tripsInPage.length > 0) {
        Logger.log(`🔍 Applying client-side filter for page ${pageCount}...`);

        filteredInPage = tripsInPage.filter(trip => {
          const openDateTime = getTripField(trip, ["openDateTime", "tripOpenDateTime"]);
          if (!openDateTime) {
            Logger.log(`   ⚠️ Skipping trip without openDateTime`);
            return false;
          }

          const tripDate = parseISODateTime(openDateTime);
          if (!tripDate) {
            Logger.log(`   ⚠️ Skipping trip with invalid date: ${openDateTime}`);
            return false;
          }

          const inRange = tripDate >= startFilter && tripDate <= endFilter;
          if (!inRange) {
            Logger.log(`   ❌ Trip ${getTripField(trip, ["id", "tripId"])} date ${openDateTime} is OUT of range`);
          }
          return inRange;
        });

        Logger.log(`   ✅ Page ${pageCount}: ${tripsInPage.length} raw trips → ${filteredInPage.length} filtered`);
      } else {
        Logger.log(`   ✅ Page ${pageCount}: ${tripsInPage.length} trips (no filter)`);
      }

      allTrips = allTrips.concat(filteredInPage);
      Logger.log(`   📊 Total so far: ${allTrips.length} trips`);

      if (result && result.pagination) {
        hasNextPage = result.pagination.hasNextPage;
      } else {
        hasNextPage = filteredInPage.length === limit;
      }

      if (filteredInPage.length === 0) {
        hasNextPage = false;
      }

      offset += limit;

      if (!config.fastMode && config.rateLimitMs > 0) {
        Utilities.sleep(Math.min(config.rateLimitMs, 500));
      }
    }

    Logger.log(`✅ Fetched ALL trips for statusId=${statusId}: ${allTrips.length} trips from ${pageCount} pages`);
    return allTrips;
  } catch (error) {
    Logger.log(`❌ Get all trips error for statusId=${statusId}: ${error.message}`);
    throw error;
  }
}

/**
 * กรอง Trips ด้วย openDateTime (เวอร์ชันเก่า - รับ date only)
 * @param {Array} trips - Array ของ trips
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Array} - Filtered trips
 * @deprecated ใช้ filterTripsByOpenDateTime(trips, startDateTime, endDateTime) แทน
 */
function filterTripsByDate(trips, startDate, endDate) {
  if (!trips || trips.length === 0) return [];

  // แปลงวันที่เป็น ISO 8601 format พร้อม timezone
  const timezone = Session.getScriptTimeZone();
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59`);

  // Format with timezone for proper comparison
  const startDateTime = formatDateTimeWithTimezone(start, timezone);
  const endDateTime = formatDateTimeWithTimezone(end, timezone);

  Logger.log(
    `🔍 Filtering ${trips.length} trips from ${startDateTime} to ${endDateTime}`,
  );

  // ✅ Debug: Log sample date values
  const sampleSize = Math.min(5, trips.length);
  let hasDates = false;
  Logger.log(`   🔍 Sample dates (first ${sampleSize} trips):`);
  for (let i = 0; i < sampleSize; i++) {
    const sampleTrip = trips[i];
    const openDateTime = getTripField(sampleTrip, [
      "openDateTime",
      "tripOpenDateTime",
    ]);
    const tripDate = parseISODateTime(openDateTime);
    const inRange = tripDate && tripDate >= start && tripDate <= end;
    Logger.log(
      `      [${i + 1}] openDateTime="${openDateTime}" → parsed=${tripDate ? tripDate.toISOString() : "NULL"}, inRange=${inRange}`,
    );
    if (openDateTime) hasDates = true;
  }
  if (!hasDates) {
    Logger.log(`   ⚠️ WARNING: No openDateTime values found in sample!`);
  }

  const filtered = trips.filter((trip) => {
    const openDateTime = getTripField(trip, [
      "openDateTime",
      "tripOpenDateTime",
    ]);

    if (!openDateTime) {
      return false; // Skip ถ้าไม่มี openDateTime
    }

    const tripDate = parseISODateTime(openDateTime);

    if (!tripDate) {
      Logger.log(`⚠️ Invalid openDateTime format: ${openDateTime}`);
      return false;
    }

    // เช็คว่า tripDate อยู่ในช่วงที่ระบุหรือไม่
    return tripDate >= start && tripDate <= end;
  });

  Logger.log(
    `✅ Filtered: ${filtered.length} trips (from ${trips.length} total)`,
  );

  return filtered;
}

/**
 * ดึง Trip Details ตาม Trip ID
 */
function getTripDetails(tripId) {
  const config = getConfig();
  const token = getAccessToken();
  const url = `${config.baseUrl}/v1/trips/${tripId}`;

  const options = {
    method: "get",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    muteHttpExceptions: true,
  };

  try {
    Logger.log(`   → Fetching: ${url}`);
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    Logger.log(`   ← Response code: ${responseCode}`);
    Logger.log(`   ← Response preview: ${responseBody.substring(0, 200)}...`);

    if (responseCode === 401) {
      // Token หมดอายุ ลองรีเฟรช
      const newToken = refreshToken();
      options.headers.Authorization = `Bearer ${newToken}`;
      const retryResponse = UrlFetchApp.fetch(url, options);
      return JSON.parse(retryResponse.getContentText());
    }

    if (responseCode !== 200) {
      Logger.log(
        `   ❌ Error: ${responseCode} - ${responseBody.substring(0, 200)}`,
      );
      throw new Error(
        `Get trip details failed with status ${responseCode}: ${responseBody}`,
      );
    }

    const parsed = JSON.parse(responseBody);
    Logger.log(
      `   ✅ Parsed response type: ${typeof parsed}, keys: ${Object.keys(parsed).join(", ")}`,
    );

    return parsed;
  } catch (error) {
    Logger.log(
      `   ❌ Get trip details error for trip ${tripId}: ${error.message}`,
    );
    return null;
  }
}

// ============================================
// GOOGLE SHEETS OPERATIONS
// ============================================

/**
 * สร้างหรือเคลียร์ Sheet พร้อม Header
 * @param {string} sheetName - ชื่อ Sheet
 * @param {Array} headers - Array ของชื่อ columns
 * @param {boolean} clearData - เคลียร์ข้อมูลเก่าหรือไม่ (default: true)
 */
function prepareSheet(sheetName, headers, clearData = true) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  Logger.log(`📝 prepareSheet: "${sheetName}" (clearData=${clearData})`);

  // ถ้าไม่มี Sheet ให้สร้างใหม่
  if (!sheet) {
    Logger.log(`   → Creating new sheet`);
    sheet = ss.insertSheet(sheetName);
  } else {
    Logger.log(`   → Using existing sheet (last row: ${sheet.getLastRow()})`);
  }

  // เคลียร์ข้อมูลเก่าถ้าต้องการ
  if (clearData) {
    sheet.clear();
    Logger.log(`   → Cleared all data`);
  }

  // ตรวจสอบว่ามี Header อยู่แล้วหรือไม่
  const existingHeader = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  Logger.log(`   → Existing header: ${JSON.stringify(existingHeader)}`);

  // ถ้ายังไม่มี Header หรือ Header ไม่ตรง ให้สร้างใหม่
  const needsHeader =
    existingHeader[0] !== headers[0] || existingHeader.every((h) => !h);

  if (needsHeader) {
    Logger.log(`   → Creating new headers`);

    // ตั้งค่า header
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    // จัดรูปแบบ header
    sheet
      .getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground("#4285F4")
      .setFontColor("#FFFFFF")
      .setHorizontalAlignment("center");

    // ตรึงแถว header
    sheet.setFrozenRows(1);

    Logger.log(`   → Headers created: ${headers.length} columns`);
  } else {
    Logger.log(`   → Headers already exist, skipping`);
  }

  Logger.log(`   → Sheet ready: "${sheet.getName()}"`);

  return sheet;
}

/**
 * ดึงค่าจาก trip object ด้วยชื่อ field ที่เป็นไปได้หลายชื่อ
 * @param {Object} trip - Trip object
 * @param {Array} possibleFields - Array ของชื่อ field ที่เป็นไปได้
 * @returns {*} - ค่าที่ดึงได้ หรือค่าว่างถ้าไม่เจอ
 */
function getTripField(trip, possibleFields) {
  for (const field of possibleFields) {
    // รองรับ nested object เช่น 'data.trip.id'
    const value = field.split(".").reduce((obj, key) => obj && obj[key], trip);
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return "";
}

/**
 * Log ทุก keys ใน trip object เพื่อ debug
 * @param {Object} trip - Trip object
 */
function logTripFields(trip) {
  const keys = Object.keys(trip);
  Logger.log(`🔍 Trip object keys (${keys.length}): ${JSON.stringify(keys)}`);

  // Log ค่าของ keys สำคัญ
  const importantKeys = [
    "tripId",
    "id",
    "tripCode",
    "tripName",
    "name",
    "licenseNo",
    "plateNo",
    "tripStatus",
  ];
  for (const key of importantKeys) {
    if (trip[key] !== undefined) {
      const value = trip[key];
      const valueStr =
        typeof value === "object" ? JSON.stringify(value) : String(value);
      Logger.log(`   → ${key}: ${valueStr}`);
    }
  }
}

/**
 * ดึง Headers จาก Trip Object (Dynamic)
 * @param {Object} trip - Trip object
 * @returns {Array} - Array of header names
 */
function getTripHeaders(trip) {
  const baseHeaders = [
    "Trip ID",
    "Trip Name",
    "License No",
    "Status ID",
    "Status Name",
    "Trip Open DateTime",
    "Trip Close DateTime",
    "Total Distance (km)",
    "Created At",
    "Updated At",
  ];

  // ถ้าต้องการให้ dynamic ตาม field ที่มีจริง สามารถแก้ไขได้
  return baseHeaders;
}

/**
 * ดึง Headers สำหรับ Trip Details (Dynamic)
 * @param {Object} tripDetail - Trip detail object
 * @returns {Array} - Array of header names
 */
function getTripDetailHeaders(tripDetail) {
  const trip = tripDetail.trip || tripDetail;

  // Base headers สำหรับ Trip
  const baseHeaders = [
    "Trip ID",
    "Trip Name",
    "License No",
    "Status ID",
    "Status Name",
    "Trip Open DateTime",
    "Trip Close DateTime",
    "Total Distance (km)",
    "Driver Name",
    "Driver Phone",
    "Vehicle Type",
    "Created At",
    "Updated At",
  ];

  // Waypoint headers (รองรับสูงสุด 20 waypoints)
  const waypointHeaders = [];
  for (let i = 1; i <= 20; i++) {
    waypointHeaders.push(
      `WP${i} Sequence`,
      `WP${i} Reference ID`,
      `WP${i} Name`,
      `WP${i} Address`,
      `WP${i} Latitude`,
      `WP${i} Longitude`,
      `WP${i} Arrival DateTime`,
      `WP${i} Departure DateTime`,
      `WP${i} Status`,
    );
  }

  return baseHeaders.concat(waypointHeaders);
}

/**
 * บันทึกข้อมูล Trips ลง Sheet
 * @param {Array} trips - Array ของ trip objects
 * @param {boolean} append - ต่อท้ายข้อมูลเดิมหรือไม่ (default: false)
 * @param {boolean} checkDuplicates - ตรวจสอบและอัพเดท trip ที่มีอยู่ (default: true)
 */
function saveTripsToSheet(trips, append = false, checkDuplicates = true) {
  const config = getConfig();

  Logger.log(`📝 Saving trips to sheet "${config.tripsSheetName}"...`);
  Logger.log(`   - Trips count: ${trips ? trips.length : 0}`);
  Logger.log(`   - Append mode: ${append}`);
  Logger.log(`   - Duplicate check: ${checkDuplicates}`);

  // ใช้ headers จาก config หรือสร้างจาก trip object
  let headers;
  if (trips && trips.length > 0) {
    headers = getTripHeaders(trips[0]);
    Logger.log(`   - Sample trip data: ${JSON.stringify(trips[0])}`);
  } else {
    // Default headers
    headers = [
      "Trip ID",
      "Trip Name",
      "License No",
      "Status ID",
      "Status Name",
      "Trip Open DateTime",
      "Trip Close DateTime",
      "Total Distance (km)",
      "Created At",
      "Updated At",
    ];
  }

  // สร้างหรือใช้ Sheet ที่มีอยู่
  const sheet = prepareSheet(config.tripsSheetName, headers, !append);
  Logger.log(`   - Sheet prepared: "${sheet.getName()}"`);

  if (!trips || trips.length === 0) {
    Logger.log("⚠️ No trips to save.");
    return;
  }

  // Log ข้อมูล trip แรกเพื่อ debug
  logTripFields(trips[0]);

  // สร้างข้อมูลที่จะบันทึก
  const data = trips.map((trip) => {
    // Extract tripStatus if exists (for nested object structure)
    const tripStatus = trip.tripStatus || {};

    return [
      // Trip ID - รองรับหลายชื่อ field
      getTripField(trip, ["tripId", "id", "trip_code", "tripCode", "trip_id"]),
      // Trip Name - รองรับหลายชื่อ field
      getTripField(trip, ["tripName", "name", "trip_name"]),
      // License No - รองรับหลายชื่อ field
      getTripField(trip, [
        "licenseNo",
        "plateNo",
        "license_no",
        "plate_no",
        "vehicleLicenseNo",
      ]),
      // Status - รองรับทั้ง flat และ nested object (tripStatus.statusId)
      tripStatus.statusId ||
        tripStatus.id ||
        getTripField(trip, [
          "tripStatus.statusId",
          "statusId",
          "status_id",
          "status",
        ]),
      tripStatus.statusName ||
        tripStatus.name ||
        getTripField(trip, [
          "tripStatus.statusName",
          "statusName",
          "status_name",
        ]),
      // Dates
      getTripField(trip, [
        "openDateTime",
        "tripOpenDateTime",
        "startDateTime",
        "trip_open_date_time",
      ]),
      getTripField(trip, [
        "closeDateTime",
        "tripCloseDateTime",
        "endDateTime",
        "trip_close_date_time",
      ]),
      // Distance
      getTripField(trip, ["distance", "totalDistance", "total_distance"]),
      // Timestamps
      getTripField(trip, ["createdAt", "created_at", "createdDate"]),
      getTripField(trip, ["updatedAt", "updated_at", "updatedDate"]),
    ];
  });

  Logger.log(`   - Data rows prepared: ${data.length}`);
  Logger.log(`   - Sample data row: ${JSON.stringify(data[0])}`);

  // เขียนข้อมูล
  if (data.length > 0) {
    let rowsUpdated = 0;
    let rowsInserted = 0;

    if (checkDuplicates && sheet.getLastRow() > 1) {
      // 🔍 โหมดตรวจสอบ duplicate: อัพเดทที่มีอยู่, เพิ่มใหม่ถ้าไม่มี
      Logger.log(`   - 🔍 Duplicate check enabled`);

      // ดึง Trip IDs ทั้งหมดจาก sheet
      const lastRow = sheet.getLastRow();
      const existingData = sheet
        .getRange(2, 1, lastRow - 1, headers.length)
        .getValues();
      const existingTripIds = new Set();
      const tripIdToRow = new Map(); // Trip ID -> Row number

      for (let i = 0; i < existingData.length; i++) {
        const tripId = String(existingData[i][0]); // Trip ID อยู่ในคอลัมน์แรก
        if (tripId) {
          existingTripIds.add(tripId);
          tripIdToRow.set(tripId, i + 2); // Row = data index + 2 (skip header)
        }
      }

      Logger.log(`   - Existing trips in sheet: ${existingTripIds.size}`);

      // แยกข้อมูลเป็น update และ insert
      const rowsToUpdate = [];
      const rowsToInsert = [];

      for (let i = 0; i < data.length; i++) {
        const tripId = String(data[i][0]); // Trip ID อยู่ในคอลัมน์แรก
        const rowNum = tripIdToRow.get(tripId);

        if (rowNum) {
          // พบ Trip ID ใน sheet -> เตรียมอัพเดท
          rowsToUpdate.push({ rowNum, data: data[i] });
          Logger.log(
            `   - ♻️ Trip ID ${tripId} found at row ${rowNum} - will update`,
          );
        } else {
          // ไม่พบ Trip ID -> เตรียมเพิ่มใหม่
          rowsToInsert.push(data[i]);
          Logger.log(`   - ➕ Trip ID ${tripId} not found - will insert`);
        }
      }

      // อัพเดท rows ที่มีอยู่
      if (rowsToUpdate.length > 0) {
        for (const update of rowsToUpdate) {
          sheet
            .getRange(update.rowNum, 1, 1, update.data.length)
            .setValues([update.data]);
          rowsUpdated++;
        }
        Logger.log(`   - ✅ Updated ${rowsUpdated} existing trips`);
      }

      // เพิ่ม rows ใหม่
      if (rowsToInsert.length > 0) {
        const insertStartRow = lastRow + 1;
        sheet
          .getRange(
            insertStartRow,
            1,
            rowsToInsert.length,
            rowsToInsert[0].length,
          )
          .setValues(rowsToInsert);
        rowsInserted = rowsToInsert.length;
        Logger.log(`   - ✅ Inserted ${rowsInserted} new trips`);
      }
    } else {
      // โหมดปกติ: เขียนทับหรือต่อท้าย
      let startRow = 2;

      // ถ้า append ให้หาแถวถัดไป
      if (append) {
        const lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          startRow = lastRow + 1;
        }
      }

      Logger.log(
        `   - Writing to range: Row ${startRow}, Col 1, ${data.length} rows, ${data[0].length} cols`,
      );

      try {
        sheet
          .getRange(startRow, 1, data.length, data[0].length)
          .setValues(data);
        Logger.log(`   - ✅ Data written successfully`);
        rowsInserted = data.length;
      } catch (error) {
        Logger.log(`   - ❌ Error writing data: ${error.message}`);
        throw error;
      }
    }

    const action = append ? "appended to" : "saved to";
    if (checkDuplicates) {
      Logger.log(
        `✅ ${data.length} trips processed: ${rowsUpdated} updated, ${rowsInserted} inserted`,
      );
    } else {
      Logger.log(
        `✅ ${data.length} trips ${action} sheet "${config.tripsSheetName}"`,
      );
    }
  }
}

/**
 * บันทึกข้อมูล Trip Details ลง Sheet
 * @param {Array} tripDetails - Array ของ trip detail objects
 * @param {boolean} append - ต่อท้ายข้อมูลเดิมหรือไม่ (default: false)
 */
function saveTripDetailsToSheet(
  tripDetails,
  append = false,
  checkDuplicates = true,
) {
  const config = getConfig();

  Logger.log(
    `📝 Saving trip details... (count: ${tripDetails.length}, checkDuplicates: ${checkDuplicates})`,
  );

  // ใช้ headers จาก trip detail object หรือ default
  let headers;
  if (tripDetails && tripDetails.length > 0) {
    headers = getTripDetailHeaders(tripDetails[0]);
  } else {
    // Default headers
    const tripHeaders = [
      "Trip ID",
      "Trip Name",
      "License No",
      "Status ID",
      "Status Name",
      "Trip Open DateTime",
      "Trip Close DateTime",
      "Total Distance (km)",
      "Driver Name",
      "Driver Phone",
      "Vehicle Type",
      "Created At",
      "Updated At",
    ];

    const waypointHeaders = [];
    for (let i = 1; i <= 20; i++) {
      waypointHeaders.push(
        `WP${i} Sequence`,
        `WP${i} Reference ID`,
        `WP${i} Name`,
        `WP${i} Address`,
        `WP${i} Latitude`,
        `WP${i} Longitude`,
        `WP${i} Arrival DateTime`,
        `WP${i} Departure DateTime`,
        `WP${i} Status`,
      );
    }

    headers = tripHeaders.concat(waypointHeaders);
  }

  // สร้างหรือใช้ Sheet ที่มีอยู่
  const sheet = prepareSheet(config.tripDetailsSheetName, headers, !append);

  if (!tripDetails || tripDetails.length === 0) {
    Logger.log("⚠️ No trip details to save.");
    return;
  }

  // Log sample trip detail structure
  if (tripDetails.length > 0) {
    Logger.log(
      `   - Sample trip detail structure: ${JSON.stringify(tripDetails[0]).substring(0, 500)}...`,
    );
    logTripFields(tripDetails[0].data || tripDetails[0].trip || tripDetails[0]);
  }

  const data = tripDetails.map((detail) => {
    // รองรับหลายโครงสร้าง: detail.data, detail.trip, หรือ detail เลย
    const trip = detail.data || detail.trip || detail;
    const waypoints = trip.waypoints || [];

    // Log structure เพื่อ debug
    Logger.log(
      `   → Detail structure: data=${!!detail.data}, trip=${!!detail.trip}, waypoints=${waypoints.length}`,
    );

    // Extract tripStatus
    const tripStatus = trip.tripStatus || {};

    // Trip data - ใช้ getTripField เพื่อรองรับหลายชื่อ field
    const tripData = [
      getTripField(trip, ["tripId", "id", "trip_code", "tripCode", "trip_id"]),
      getTripField(trip, ["tripName", "name", "trip_name"]),
      getTripField(trip, [
        "licenseNo",
        "plateNo",
        "license_no",
        "plate_no",
        "vehicleLicenseNo",
      ]),
      tripStatus.statusId ||
        tripStatus.id ||
        getTripField(trip, ["statusId", "status_id", "status"]),
      tripStatus.statusName ||
        tripStatus.name ||
        getTripField(trip, ["statusName", "status_name"]),
      getTripField(trip, [
        "openDateTime",
        "tripOpenDateTime",
        "startDateTime",
        "trip_open_date_time",
      ]),
      getTripField(trip, [
        "closeDateTime",
        "tripCloseDateTime",
        "endDateTime",
        "trip_close_date_time",
      ]),
      getTripField(trip, ["distance", "totalDistance", "total_distance"]),
      getTripField(trip, ["driverName", "driver_name", "driverFullName"]),
      getTripField(trip, ["driverPhone", "driver_phone", "driverMobile"]),
      getTripField(trip, ["vehicleType", "vehicle_type", "vehicleModel"]),
      getTripField(trip, ["createdAt", "created_at", "createdDate"]),
      getTripField(trip, ["updatedAt", "updated_at", "updatedDate"]),
    ];

    // Waypoint data
    const waypointData = [];
    for (let i = 0; i < 20; i++) {
      if (i < waypoints.length) {
        const wp = waypoints[i];
        waypointData.push(
          wp.sequence || "",
          wp.reference || wp.waypointReferenceId || "",
          wp.waypointName || "",
          "", // address - ไม่มีใน API
          "", // latitude - ไม่มีใน API
          "", // longitude - ไม่มีใน API
          wp.actualArrivalDateTime || "--",
          wp.actualDepartureDateTime || "--",
          "", // status - ไม่มีใน API
        );
      } else {
        // สำหรับ waypoints ที่ไม่มี ใส่ค่าว่าง
        waypointData.push("", "", "", "", "", "", "", "", "");
      }
    }

    return tripData.concat(waypointData);
  });

  // เขียนข้อมูล
  if (data.length > 0) {
    let rowsUpdated = 0;
    let rowsInserted = 0;

    if (checkDuplicates && sheet.getLastRow() > 1) {
      // 🔍 โหมดตรวจสอบ duplicate: อัพเดทที่มีอยู่, เพิ่มใหม่ถ้าไม่มี
      Logger.log(`   - 🔍 Duplicate check enabled for TripDetails`);

      // ดึง Trip IDs ทั้งหมดจาก sheet
      const lastRow = sheet.getLastRow();
      const existingData = sheet
        .getRange(2, 1, lastRow - 1, headers.length)
        .getValues();
      const existingTripIds = new Set();
      const tripIdToRow = new Map(); // Trip ID -> Row number

      for (let i = 0; i < existingData.length; i++) {
        const tripId = String(existingData[i][0]); // Trip ID อยู่ในคอลัมน์แรก
        if (tripId) {
          existingTripIds.add(tripId);
          tripIdToRow.set(tripId, i + 2); // Row = data index + 2 (skip header)
        }
      }

      Logger.log(
        `   - Existing trip details in sheet: ${existingTripIds.size}`,
      );

      // แยกข้อมูลเป็น update และ insert
      const rowsToUpdate = [];
      const rowsToInsert = [];

      for (let i = 0; i < data.length; i++) {
        const tripId = String(data[i][0]); // Trip ID อยู่ในคอลัมน์แรก
        const rowNum = tripIdToRow.get(tripId);

        if (rowNum) {
          // พบ Trip ID ใน sheet -> เตรียมอัพเดท
          rowsToUpdate.push({ rowNum, data: data[i] });
          Logger.log(
            `   - ♻️ Trip ID ${tripId} found at row ${rowNum} - will update`,
          );
        } else {
          // ไม่พบ Trip ID -> เตรียมเพิ่มใหม่
          rowsToInsert.push(data[i]);
          Logger.log(`   - ➕ Trip ID ${tripId} not found - will insert`);
        }
      }

      // อัพเดท rows ที่มีอยู่
      if (rowsToUpdate.length > 0) {
        for (const update of rowsToUpdate) {
          sheet
            .getRange(update.rowNum, 1, 1, update.data.length)
            .setValues([update.data]);
          rowsUpdated++;
        }
        Logger.log(`   - ✅ Updated ${rowsUpdated} existing trip details`);
      }

      // เพิ่ม rows ใหม่
      if (rowsToInsert.length > 0) {
        const insertStartRow = lastRow + 1;
        sheet
          .getRange(
            insertStartRow,
            1,
            rowsToInsert.length,
            rowsToInsert[0].length,
          )
          .setValues(rowsToInsert);
        rowsInserted = rowsToInsert.length;
        Logger.log(`   - ✅ Inserted ${rowsInserted} new trip details`);
      }
    } else {
      // โหมดปกติ: เขียนทับหรือต่อท้าย
      let startRow = 2;

      // ถ้า append ให้หาแถวถัดไป
      if (append) {
        const lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          startRow = lastRow + 1;
        }
      }

      sheet.getRange(startRow, 1, data.length, data[0].length).setValues(data);
      rowsInserted = data.length;
    }

    const action = append ? "appended to" : "saved to";
    if (checkDuplicates) {
      Logger.log(
        `✅ ${data.length} trip details processed: ${rowsUpdated} updated, ${rowsInserted} inserted`,
      );
    } else {
      Logger.log(
        `✅ ${data.length} trip details ${action} sheet "${config.tripDetailsSheetName}"`,
      );
    }
  }
}

// ============================================
// MAIN FUNCTIONS
// ============================================

/**
 * State Management สำหรับ Batch Processing
 */
const BATCH_STATE_KEY = "BATCH_PULL_STATE";

/**
 * บันทึก state สำหรับ batch processing
 */
function saveBatchState(state) {
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty(BATCH_STATE_KEY, JSON.stringify(state));
  Logger.log(
    `💾 Batch state saved: offset=${state.offset}, processed=${state.processedCount}/${state.totalCount || "?"}`,
  );
}

/**
 * โหลด state สำหรับ batch processing
 */
function loadBatchState() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const stateJson = scriptProperties.getProperty(BATCH_STATE_KEY);
  if (stateJson) {
    return JSON.parse(stateJson);
  }
  return null;
}

/**
 * ลบ batch state
 */
function clearBatchState() {
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.deleteProperty(BATCH_STATE_KEY);
  Logger.log("🗑️ Batch state cleared");
}

/**
 * ดึง Trips แบบ Pagination
 * @param {number} offset - Offset สำหรับ pagination
 * @param {number} limit - จำนวนรายการต่อหน้า
 * @param {string} statusId - Status ID (ถ้าไม่ระบุจะใช้จาก config)
 * @returns {Object} - API response
 */
function getTripsPaginated(offset = 0, limit = 50, statusId = null) {
  const config = getConfig();
  const token = getAccessToken();
  const url = `${config.baseUrl}/v1/trips`;

  // สร้าง query parameters พร้อม pagination
  const params = [];

  // ✅ ใช้ statusId จาก parameter หรือ config
  const finalStatusId = statusId !== null ? statusId : config.statusId;
  if (finalStatusId) {
    params.push(`statusId=${finalStatusId}`);
    Logger.log(`🔍 Filtering by statusId: ${finalStatusId}`);
  }

  // ✅ ใช้ startDate/endDate เสมอ - ส่งไปให้ API filter
  // ถ้ามี startDateTime/endDateTime ให้แปลงเป็นวันที่ (YYYY-MM-DD)
  if (config.startDateTime && config.endDateTime) {
    const startDateOnly = config.startDateTime.split("T")[0];
    const endDateOnly = config.endDateTime.split("T")[0];
    params.push(`startDate=${startDateOnly}`);
    params.push(`endDate=${endDateOnly}`);
    Logger.log(
      `📅 Filtering by date (API): ${startDateOnly} to ${endDateOnly} (from datetime: ${config.startDateTime} - ${config.endDateTime})`,
    );
  } else if (config.startDate && config.endDate) {
    params.push(`startDate=${config.startDate}`);
    params.push(`endDate=${config.endDate}`);
    Logger.log(
      `📅 Filtering by date (API): ${config.startDate} to ${config.endDate}`,
    );
  } else {
    Logger.log(`📅 No date filter - fetching all trips`);
  }

  params.push(`limit=${limit}`);
  params.push(`offset=${offset}`);

  const fullUrl = `${url}?${params.join("&")}`;

  const options = {
    method: "get",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    muteHttpExceptions: true,
  };

  try {
    Logger.log(
      `📡 Fetching trips: offset=${offset}, limit=${limit}, statusId=${finalStatusId || "ALL"}`,
    );
    Logger.log(`📡 Full URL: ${fullUrl}`);

    const response = UrlFetchApp.fetch(fullUrl, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    Logger.log(`📡 Response code: ${responseCode}`);
    Logger.log(`📡 Response preview: ${responseBody.substring(0, 300)}...`);

    if (responseCode === 401) {
      // Token หมดอายุ ลองรีเฟรช
      Logger.log(`🔄 Token expired, refreshing...`);
      const newToken = refreshToken();
      options.headers.Authorization = `Bearer ${newToken}`;
      const retryResponse = UrlFetchApp.fetch(fullUrl, options);
      const retryBody = retryResponse.getContentText();
      Logger.log(`📡 Retry response code: ${retryResponse.getResponseCode()}`);
      return JSON.parse(retryBody);
    }

    if (responseCode !== 200) {
      Logger.log(`❌ API Error ${responseCode}: ${responseBody}`);
      throw new Error(
        `Get trips failed with status ${responseCode}: ${responseBody}`,
      );
    }

    Logger.log(`✅ API Success - parsing response...`);
    const parsed = JSON.parse(responseBody);
    Logger.log(`✅ Response parsed successfully`);
    return parsed;
  } catch (error) {
    Logger.log(`❌ Get trips error: ${error.message}`);
    Logger.log(`❌ Error stack: ${error.stack}`);
    throw error;
  }
}

/**
 * ✅ ดึง Trips ทั้งหมดจากทุก Status ID (1-7)
 * ใช้เมื่อต้องการดึงข้อมูลทั้งหมดโดยไม่ระบุ Status ID
 * @param {number} offset - Offset สำหรับ pagination
 * @param {number} limit - จำนวนรายการต่อหน้า
 * @returns {Array} - Array ของ trips ทั้งหมดจากทุก Status ID
 */
function getTripsPaginatedForAllStatuses(offset = 0, limit = 50) {
  const STATUS_IDS = [1, 2, 3, 4, 5]; // ✅ ใช้เฉพาะ Status ID 1-5
  let allTrips = [];

  Logger.log(`🔄 Fetching trips for statuses 1-5...`);

  for (const statusId of STATUS_IDS) {
    Logger.log(`📍 Fetching statusId=${statusId}...`);

    try {
      const response = getTripsPaginated(offset, limit, statusId);
      let trips = [];

      // ดึง trips จาก response
      if (response && response.data && Array.isArray(response.data.trips)) {
        trips = response.data.trips;
      } else if (response && response.data && Array.isArray(response.data)) {
        trips = response.data;
      } else if (response && Array.isArray(response)) {
        trips = response;
      }

      // ✅ ถ้าไม่พบข้อมูล หรือ paginator = false ให้ข้ามไป Status ถัดไปเลย
      if (!trips || trips.length === 0) {
        Logger.log(
          `   ⏭️  Status ${statusId}: No data found - skipping to next status`,
        );
        continue; // ข้ามไป Status ถัดไป
      }

      Logger.log(`   ✅ Status ${statusId}: ${trips.length} trips`);
      allTrips = allTrips.concat(trips);

      // Rate limiting between status IDs - เพิ่มเพื่อหลีด 429
      Utilities.sleep(2000); // เพิ่มจาก 200ms → 2000ms (2 วินาที) เพื่อหลีด 429
    } catch (error) {
      Logger.log(`   ⚠️ Error fetching status ${statusId}: ${error.message}`);
      // ดำเนินการต่อถ้า status ID หนึ่งล้มเหลว
    }
  }

  // ลบ duplicates โดยใช้ Trip ID
  const uniqueTrips = [];
  const seenTripIds = new Set();

  for (const trip of allTrips) {
    const tripId = getTripField(trip, [
      "id",
      "tripId",
      "trip_code",
      "tripCode",
      "trip_id",
    ]);
    if (tripId && !seenTripIds.has(String(tripId))) {
      seenTripIds.add(String(tripId));
      uniqueTrips.push(trip);
    }
  }

  Logger.log(
    `✅ Total unique trips from all statuses: ${uniqueTrips.length} (from ${allTrips.length} raw records)`,
  );

  return uniqueTrips;
}

/**
 * ตรวจสอบจำนวน Trip IDs ทั้งหมดในช่วงเวลาที่เลือก
 * @returns {Object} - { totalCount, estimateTime }
 */
function estimateTripCount() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  try {
    ss.toast("🔍 Estimating total trips...", "MLSTMS Trips", 5);

    // ⚡ Phase 3.2: Benchmark API เพื่อหา preset ที่เหมาะสม
    const benchmark = benchmarkAPI();
    smartLog(
      `⚡ API Benchmark: ${benchmark.responseTime}ms → Mode: ${benchmark.performanceMode}`,
      "NORMAL",
    );

    // ดึงมาเพื่อเช็ค response structure
    const response = getTripsPaginated(0, 100); // ✅ ดึง 100 รายการเพื่อเช็ค pagination

    // 🔍 LOG: แสดง response structure เพื่อ debug
    Logger.log("🔍 ESTIMATE - Response structure:");
    Logger.log(JSON.stringify(response, null, 2));

    let totalCount = 0;
    let tripsInPage = 0;
    let hasMore = false;

    // ✅ FIX: API ใช้ hasNextPage แทน totalCount
    if (response && response.pagination) {
      hasMore = response.pagination.hasNextPage;
      tripsInPage = response.pagination.recordsReturned || 0;

      // ถ้า hasNextPage = false แปลวว่ามีข้อมูลทั้งหมดในหน้านี้
      if (!hasMore) {
        totalCount = tripsInPage;
        Logger.log(`✅ Found total count (no more pages): ${totalCount}`);
      } else {
        // ถ้ามีหน้าถัดไป ให้ใช้ค่าประมาณ: 2 * recordsReturned
        totalCount = tripsInPage * 2;
        Logger.log(`⚠️ Has more pages - estimated count: ${totalCount}`);
      }
    }
    // Fallback: ตรวจสอบ structure แบบเก่า
    else if (response && response.data) {
      if (response.data.totalCount !== undefined) {
        totalCount = response.data.totalCount;
        Logger.log(`✅ Found totalCount: ${totalCount}`);
      } else if (response.data.count !== undefined) {
        totalCount = response.data.count;
        Logger.log(`✅ Found count: ${totalCount}`);
      } else if (Array.isArray(response.data.trips)) {
        tripsInPage = response.data.trips.length;
        Logger.log(`✅ Found trips array: ${tripsInPage} items`);
      } else if (Array.isArray(response.data)) {
        tripsInPage = response.data.length;
        Logger.log(`✅ Found data array: ${tripsInPage} items`);
      } else {
        Logger.log(`⚠️ Unknown response.data structure`);
        Logger.log(
          `Keys in response.data: ${Object.keys(response.data).join(", ")}`,
        );
      }
    } else if (response && response.trips) {
      tripsInPage = response.trips.length;
      Logger.log(`✅ Found response.trips: ${tripsInPage} items`);
    } else if (Array.isArray(response)) {
      tripsInPage = response.length;
      Logger.log(`✅ Response is direct array: ${tripsInPage} items`);
    } else {
      Logger.log(`⚠️ Unknown response structure`);
      if (response) {
        Logger.log(`Keys in response: ${Object.keys(response).join(", ")}`);
      }
    }

    // ถ้าไม่มี totalCount ให้คำนวณจาก limit และจำนวนที่ได้
    if (totalCount === 0 && tripsInPage > 0) {
      // ไม่รู้总数 - ใช้ค่าประมาณ
      totalCount = tripsInPage === 1 ? 100 : 50; // Default estimate
      Logger.log(`⚠️ Using default estimate: ${totalCount}`);
    }

    // ⚡ Phase 1.3: คำนวณ optimal batch size
    const optimalBatchSize = calculateOptimalBatchSize();
    const config = getConfig();

    // คำนวณเวลาโดยประมาณ (ใช้ค่าใหม่จาก benchmark)
    const actualRateLimit = config.adaptiveRateLimit
      ? config.minRateLimitMs
      : config.rateLimitMs;
    const timePerTrip = (actualRateLimit + benchmark.responseTime) / 1000; // วินาทีต่อ trip
    const estimateSeconds = totalCount * timePerTrip;
    const estimateMinutes = Math.ceil(estimateSeconds / 60);

    return {
      totalCount: totalCount,
      estimateMinutes: estimateMinutes,
      optimalBatchSize: optimalBatchSize,
      hasMore: hasMore,
      benchmark: benchmark,
    };
  } catch (error) {
    smartLog(`❌ Estimate error: ${error.message}`, "NORMAL");
    ui.alert(
      "❌ Estimate Failed",
      `Cannot estimate trip count:\n\n${error.message}`,
      ui.ButtonSet.OK,
    );
    return null;
  }
}

/**
 * ฟังก์ชันหลัก: ดึง Trips และ Trip Details แบบ Batch Processing (พร้อม Resume)
 * @param {boolean} resume - Resume จากครั้งก่อนหรือไม่
 */
function pullTripsToSheetBatch(resume = false) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const config = getConfig();
  const scriptProperties = PropertiesService.getScriptProperties();

  try {
    // ตรวจสอบ credentials
    if (!hasSavedCredentials()) {
      ui.alert(
        "⚠️ No Credentials Found",
        'No saved credentials found. Please use "Login & Pull Data" to login first.',
        ui.ButtonSet.OK,
      );
      return;
    }

    // โหลด state เดิม (ถ้า resume)
    let state = resume ? loadBatchState() : null;

    if (!state) {
      // เริ่ม batch processing ใหม่
      ss.toast("🚀 Starting batch pull...", "MLSTMS Trips", 5);
      Logger.log("🚀 Starting batch pull...");

      // 1. Login
      ss.toast("🔐 Logging in...", "MLSTMS Trips", 5);
      const token = login();
      if (!token) {
        throw new Error("Failed to login. Please check your credentials.");
      }

      // 2. ประมาณการจำนวน trips
      const estimate = estimateTripCount();
      if (!estimate) {
        throw new Error("Cannot estimate trip count");
      }

      // แสดงข้อมูลและยืนยัน
      const confirmMsg = `
📊 Batch Pull Summary:

Total Trips (estimated): ${estimate.totalCount}
Estimated Time: ~${estimate.estimateMinutes} minutes
Batch Size: ${config.limit} trips/batch
Rate Limit: ${config.fastMode ? "Fast mode (no delay)" : config.rateLimitMs + "ms"}

⚠️ This process will take several minutes.
💡 You can resume if it gets interrupted.

Ready to start?
      `.trim();

      const response = ui.alert(
        "📊 Batch Pull Confirmation",
        confirmMsg,
        ui.ButtonSet.YES_NO,
      );

      if (response !== ui.Button.YES) {
        ui.alert("Cancelled", "Batch pull cancelled.", ui.ButtonSet.OK);
        return;
      }

      // สร้าง state ใหม่
      state = {
        offset: 0,
        limit: parseInt(config.limit) || 50,
        processedCount: 0,
        totalCount: estimate.totalCount,
        allTrips: [],
        startTime: new Date().toISOString(),
        lastUpdate: new Date().toISOString(),
      };

      saveBatchState(state);
    } else {
      ss.toast("♻️ Resuming batch pull...", "MLSTMS Trips", 5);
      Logger.log("♻️ Resuming batch pull from offset " + state.offset);
    }

    // 3. Batch Processing Loop
    const BATCH_TIME_LIMIT = 5 * 60 * 1000; // 5 นาที (ปลอดภัยกว่า 6 นาที limit)
    const batchStartTime = Date.now();
    let tripsInBatch = [];
    let batchNumber = Math.floor(state.offset / state.limit) + 1;

    Logger.log(`📦 Starting batch #${batchNumber} (offset: ${state.offset})`);
    ss.toast(
      `📦 Batch #${batchNumber} - Fetching trips...`,
      "MLSTMS Trips",
      10,
    );

    // ดึง trips list (แบบ pagination)
    const tripsResponse = getTripsPaginated(state.offset, state.limit);

    let trips = [];
    if (
      tripsResponse &&
      tripsResponse.data &&
      Array.isArray(tripsResponse.data.trips)
    ) {
      trips = tripsResponse.data.trips;
    } else if (
      tripsResponse &&
      tripsResponse.data &&
      Array.isArray(tripsResponse.data)
    ) {
      trips = tripsResponse.data;
    } else if (tripsResponse && Array.isArray(tripsResponse)) {
      trips = tripsResponse;
    } else if (
      tripsResponse &&
      tripsResponse.trips &&
      Array.isArray(tripsResponse.trips)
    ) {
      trips = tripsResponse.trips;
    }

    if (trips.length === 0) {
      // ไม่มีข้อมูลเพิ่ม - จบงาน
      Logger.log("✅ No more trips to fetch - batch completed!");

      // บันทึก trips ทั้งหมดลง sheet
      if (state.allTrips.length > 0) {
        ss.toast("💾 Saving all trips to sheet...", "MLSTMS Trips", 10);
        saveTripsToSheet(state.allTrips, false, true);
        saveTripDetailsToSheet(state.allTrips, false, true);
      }

      // สรุป
      const totalEndTime = new Date();
      const totalDuration = Math.round(
        (totalEndTime - new Date(state.startTime)) / 1000,
      );
      const totalMinutes = Math.floor(totalDuration / 60);
      const totalSeconds = totalDuration % 60;

      ui.alert(
        "✅ Batch Pull Completed!",
        `Total trips processed: ${state.allTrips.length}\nTotal time: ${totalMinutes}m ${totalSeconds}s\n\nAll data saved to sheets.`,
        ui.ButtonSet.OK,
      );

      clearBatchState();
      return;
    }

    Logger.log(`📦 Fetched ${trips.length} trips in batch #${batchNumber}`);

    // ดึง trip details แต่ละ trip
    const tripDetails = [];
    const skippedTrips = [];

    for (let i = 0; i < trips.length; i++) {
      // ตรวจสอบ execution time
      const elapsed = Date.now() - batchStartTime;
      if (elapsed > BATCH_TIME_LIMIT) {
        Logger.log(
          `⏱️ Time limit approaching (${elapsed}ms). Saving progress...`,
        );

        // บันทึก trips ที่ดึงมาแล้ว
        state.allTrips = state.allTrips.concat(tripsInBatch);
        state.offset = state.offset + i; // บันทึก offset ปัจจุบัน
        state.processedCount = state.allTrips.length;
        state.lastUpdate = new Date().toISOString();
        saveBatchState(state);

        // บันทึกข้อมูลลง sheet (append mode)
        if (tripsInBatch.length > 0) {
          saveTripsToSheet(tripsInBatch, true, true);
          saveTripDetailsToSheet(tripDetails, true, true);
        }

        // แจ้งเตือน
        ui.alert(
          "⏸️ Batch Paused - Time Limit",
          `
Batch #${batchNumber} paused to avoid timeout.

Progress: ${state.processedCount} trips processed
Remaining: ~${state.totalCount - state.processedCount} trips

💡 Click "Resume Batch Pull" to continue.
          `.trim(),
          ui.ButtonSet.OK,
        );

        // Schedule trigger สำหรับ resume (optional)
        // scheduleResumeTrigger();

        return;
      }

      const trip = trips[i];
      const tripId = getTripField(trip, [
        "id",
        "tripId",
        "trip_code",
        "tripCode",
        "trip_id",
      ]);

      if (!tripId) {
        Logger.log(`⚠️ Skipping trip without ID`);
        skippedTrips.push({ reason: "No ID", data: trip });
        continue;
      }

      // Progress update
      const progress = Math.round(
        ((state.processedCount + i + 1) / state.totalCount) * 100,
      );

      // ⚡ Phase 1.2: Smart logging - log เฉพาะทุก N trips
      if (i % config.logBatchSize === 0 || i === trips.length - 1) {
        ss.toast(
          `📦 Batch #${batchNumber}: ${i + 1}/${trips.length} (${progress}%)`,
          "MLSTMS Trips",
          5,
        );
        smartLog(
          `Fetching trip ${tripId} (${i + 1}/${trips.length}, ${progress}%)`,
          "NORMAL",
        );
      }

      // ⚡ Phase 1.1: Track response time for adaptive rate limiting
      const fetchStart = Date.now();
      const detail = getTripDetails(tripId);
      const responseTime = Date.now() - fetchStart;

      if (detail) {
        tripDetails.push(detail);
        tripsInBatch.push(trip); // เพิ่มไว้ใน batch
        smartLog(`✅ Fetched trip ${tripId} (${responseTime}ms)`, "VERBOSE");
      } else {
        smartLog(`❌ Failed to fetch trip ${tripId}`, "NORMAL");
        skippedTrips.push({ reason: "API Error", tripId: tripId });
      }

      // ⚡ Phase 1.1: Adaptive rate limiting - ปรับ delay ตามความเร็ว API
      adaptiveSleep(responseTime);
    }

    // Batch เสร็จสิ้น - บันทึกข้อมูล
    Logger.log(
      `✅ Batch #${batchNumber} completed: ${tripDetails.length} trip details fetched`,
    );

    // เพิ่มข้อมูลเข้า state
    state.allTrips = state.allTrips.concat(tripsInBatch);
    state.offset += trips.length;
    state.processedCount = state.allTrips.length;
    state.lastUpdate = new Date().toISOString();

    // บันทึกข้อมูลลง sheet (append mode)
    saveTripsToSheet(tripsInBatch, true, true);
    saveTripDetailsToSheet(tripDetails, true, true);

    // บันทึก state
    saveBatchState(state);

    // แจ้งเตือน
    const batchEndTime = new Date();
    const batchDuration = Math.round((batchEndTime - batchStartTime) / 1000);

    ui.alert(
      `✅ Batch #${batchNumber} Completed!`,
      `
Fetched: ${trips.length} trips
Time: ${batchDuration}s
Total Progress: ${state.processedCount}/${state.totalCount} (${Math.round((state.processedCount / state.totalCount) * 100)}%)

💡 Click "Resume Batch Pull" to continue with next batch.
      `.trim(),
      ui.ButtonSet.OK,
    );
  } catch (error) {
    ss.toast("❌ Error occurred", "MLSTMS Trips", 10);
    Logger.log(`❌ Error: ${error.message}`);
    ui.alert(
      "❌ Error",
      `An error occurred:\n\n${error.message}\n\nYou can resume from the last saved state.`,
      ui.ButtonSet.OK,
    );
    throw error;
  } finally {
    // ลบ temp properties เสมอ
    scriptProperties.deleteProperty("TEMP_START_DATE");
    scriptProperties.deleteProperty("TEMP_END_DATE");
    scriptProperties.deleteProperty("TEMP_STATUS_ID");
    scriptProperties.deleteProperty("TEMP_LIMIT");
  }
}

/**
 * Resume Batch Pull (Wrapper)
 */
function pullTripsToSheetBatchResume() {
  pullTripsToSheetBatch(true);
}

/**
 * 📅 Pull Today's Data (00:00 - 23:59)
 * ดึงข้อมูล trips ทั้งหมดของวันนี้
 */
function pullTodayData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  try {
    // คำนวณวันที่วันนี้
    const today = new Date();
    const timezone = Session.getScriptTimeZone(); // e.g., "Asia/Bangkok"
    const todayStr = Utilities.formatDate(today, timezone, "yyyy-MM-dd");

    // สร้าง ISO 8601 format พร้อม timezone (e.g., "2026-03-21T00:00:00+07:00")
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const startDateTime = formatDateTimeWithTimezone(startOfDay, timezone);
    const endDateTime = formatDateTimeWithTimezone(endOfDay, timezone);

    // ยืนยันยืนยันกับ user
    const response = ui.alert(
      `📅 Pull Today's Data`,
      `
จะดึงข้อมูล trips ทั้งหมดของวันที่: ${todayStr}
เวลา: 00:00 - 23:59

ค่า CONFIG ที่จะใช้:
✅ Status: ALL Statuses (1-5)
✅ Date: ${todayStr} (00:00 - 23:59)
✅ Performance Mode: ตามที่ตั้งค่าไว้

ต้องการดำเนินการต่อหรือไม่?
      `.trim(),
      ui.ButtonSet.YES_NO,
    );

    if (response !== ui.Button.YES) {
      ui.alert("Cancelled", "ยกเลิกการดำเนินการ", ui.ButtonSet.OK);
      return;
    }

    // ตั้งค่าวันที่วันนี้
    const scriptProperties = PropertiesService.getScriptProperties();
    scriptProperties.setProperty("START_DATE", todayStr);
    scriptProperties.setProperty("END_DATE", todayStr);
    scriptProperties.setProperty("STATUS_ID", ""); // ALL statuses

    // บันทึก ISO datetime format สำหรับ filter
    scriptProperties.setProperty("START_DATETIME", startDateTime);
    scriptProperties.setProperty("END_DATETIME", endDateTime);

    ss.toast(`📅 Set date range to ${todayStr}`, "MLSTMS Trips", 5);
    smartLog(
      `📅 Pulling today's data: ${startDateTime} to ${endDateTime}`,
      "NORMAL",
    );

    // เรียก batch pull
    pullTripsToSheetBatch(false);
  } catch (error) {
    ss.toast("❌ Error occurred", "MLSTMS Trips", 10);
    smartLog(`❌ Pull today's data error: ${error.message}`, "NORMAL");
    ui.alert(
      "❌ Error",
      `เกิดข้อผิดพลาด:\n\n${error.message}`,
      ui.ButtonSet.OK,
    );
  }
}

/**
 * ⚡ Fast Pull All - ดึงข้อมูลทั้งหมดทีเดียวเร็วๆ (Fast Mode)
 */
function fastPullAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  try {
    // ตรวจสอบ credentials
    if (!hasSavedCredentials()) {
      ui.alert("⚠️ No Credentials", "Please login first.", ui.ButtonSet.OK);
      return;
    }

    // แสดง dialog ให้เลือกช่วงวันที่เวลา
    showFastPullDialog();
  } catch (error) {
    ss.toast("❌ Error occurred", "MLSTMS Trips", 10);
    ui.alert(
      "❌ Error",
      `เกิดข้อผิดพลาด:\n\n${error.message}`,
      ui.ButtonSet.OK,
    );
  }
}

/**
 * แสดง Dialog สำหรับ Fast Pull - เลือกช่วงวันที่เวลา
 */
function showFastPullDialog() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const savedStartDate = scriptProperties.getProperty("START_DATE") || "";
  const savedEndDate = scriptProperties.getProperty("END_DATE") || "";
  const savedStatusId = scriptProperties.getProperty("STATUS_ID") || "";

  // คำนวณวันนี้
  const today = new Date();
  const todayStr = Utilities.formatDate(
    today,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd",
  );

  const html = HtmlService.createHtmlOutput(
    `
    <!DOCTYPE html>
    <html>
    <head>
      <base target="_top">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          max-width: 500px;
          margin: 0 auto;
          background: white;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h2 {
          color: #4285F4;
          margin-top: 0;
          margin-bottom: 10px;
          text-align: center;
        }
        .subtitle {
          text-align: center;
          color: #666;
          font-size: 13px;
          margin-bottom: 20px;
        }
        .logo {
          text-align: center;
          font-size: 48px;
          margin-bottom: 10px;
        }
        .quick-options {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
        }
        .quick-btn {
          flex: 1;
          padding: 12px;
          border: 2px solid #ddd;
          border-radius: 6px;
          background: white;
          cursor: pointer;
          text-align: center;
          font-size: 13px;
          transition: all 0.3s;
        }
        .quick-btn:hover {
          border-color: #4285F4;
          background: #e8f0fe;
        }
        .quick-btn.active {
          border-color: #4285F4;
          background: #e8f0fe;
          color: #4285F4;
          font-weight: 500;
        }
        .form-group {
          margin-bottom: 15px;
        }
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
          color: #333;
          font-size: 13px;
        }
        input[type="text"],
        input[type="date"],
        input[type="time"] {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          box-sizing: border-box;
        }
        input:focus {
          outline: none;
          border-color: #4285F4;
        }
        .date-time-group {
          display: flex;
          gap: 10px;
        }
        .date-time-group > div {
          flex: 1;
        }
        .btn-group {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }
        button {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.3s;
        }
        .btn-primary {
          background: #4285F4;
          color: white;
        }
        .btn-primary:hover {
          background: #3367D6;
        }
        .btn-secondary {
          background: #f1f3f4;
          color: #333;
        }
        .btn-secondary:hover {
          background: #e8eaed;
        }
        .warning {
          background: #fff3e0;
          border-left: 4px solid #ff9800;
          padding: 12px;
          margin-bottom: 15px;
          border-radius: 4px;
          font-size: 12px;
          color: #e65100;
        }
        .info {
          background: #e3f2fd;
          border-left: 4px solid #2196f3;
          padding: 12px;
          margin-top: 15px;
          border-radius: 4px;
          font-size: 12px;
          color: #1565c0;
        }
        .status {
          margin-top: 15px;
          padding: 10px;
          border-radius: 4px;
          display: none;
          text-align: center;
          font-size: 13px;
        }
        .status.success {
          background: #d4edda;
          color: #155724;
          display: block;
        }
        .status.error {
          background: #f8d7da;
          color: #721c24;
          display: block;
        }
        .time-hint {
          font-size: 11px;
          color: #999;
          margin-top: 3px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">⚡</div>
        <h2>Fast Pull All</h2>
        <div class="subtitle">ดึงข้อมูล Trips ทั้งหมดทีเดียวเร็วๆ</div>

        <div class="warning">
          ⚠️ <strong>คำเตือน:</strong><br>
          • Rate Limit = 0 (ไม่หน่วงเวลา)<br>
          • ดึงข้อมูลทั้งหมดในครั้งเดียว<br>
          • ถ้าข้อมูลเยอะมาก (>500 รายการ) อาจ timeout
        </div>

        <div class="quick-options">
          <div class="quick-btn" onclick="setToday()">📅 วันนี้</div>
          <div class="quick-btn" onclick="setYesterday()">📅 เมื่อวาน</div>
          <div class="quick-btn" onclick="setThisWeek()">📅 อาทิตย์นี้</div>
          <div class="quick-btn" onclick="setAll()">📅 ทั้งหมด</div>
        </div>

        <form id="fastPullForm" onsubmit="handleSubmit(event)">
          <div class="form-group">
            <label for="startDate">📅 จากวันที่:</label>
            <div class="date-time-group">
              <div>
                <input type="date" id="startDate" name="startDate" value="${savedStartDate || todayStr}" required>
                <div class="time-hint">วันที่ (YYYY-MM-DD)</div>
              </div>
              <div>
                <input type="time" id="startTime" name="startTime" value="00:00">
                <div class="time-hint">เวลา (HH:MM)</div>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label for="endDate">📅 ถึงวันที่:</label>
            <div class="date-time-group">
              <div>
                <input type="date" id="endDate" name="endDate" value="${savedEndDate || todayStr}" required>
                <div class="time-hint">วันที่ (YYYY-MM-DD)</div>
              </div>
              <div>
                <input type="time" id="endTime" name="endTime" value="23:59">
                <div class="time-hint">เวลา (HH:MM)</div>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label for="statusId">🔍 Status ID (optional):</label>
            <input type="text" id="statusId" name="statusId" placeholder="ว่างเปล่า = ทุกสถานะ" value="${savedStatusId}">
            <div class="time-hint">ระบุ status ID ถ้าต้องการกรองเฉพาะสถานะ</div>
          </div>

          <div class="info">
            💡 <strong>หมายเหตุ:</strong><br>
            • วันที่เวลาจะใช้ในการ filter ข้อมูล trips<br>
            • ระบบจะดึง trips ที่อยู่ในช่วงเวลาที่เลือก<br>
            • ถ้าไม่ระบุวันที่ จะดึงข้อมูลทั้งหมด
          </div>

          <div class="btn-group">
            <button type="submit" class="btn-primary">⚡ เริ่มดึงข้อมูล</button>
            <button type="button" class="btn-secondary" onclick="google.script.host.close()">ยกเลิก</button>
          </div>
        </form>

        <div id="status" class="status"></div>
      </div>

      <script>
        // Quick options
        function setToday() {
          const today = new Date().toISOString().split('T')[0];
          document.getElementById('startDate').value = today;
          document.getElementById('endDate').value = today;
          document.getElementById('startTime').value = '00:00';
          document.getElementById('endTime').value = '23:59';
          highlightButton(this);
        }

        function setYesterday() {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const dateStr = yesterday.toISOString().split('T')[0];
          document.getElementById('startDate').value = dateStr;
          document.getElementById('endDate').value = dateStr;
          document.getElementById('startTime').value = '00:00';
          document.getElementById('endTime').value = '23:59';
          highlightButton(this);
        }

        function setThisWeek() {
          const today = new Date();
          const dayOfWeek = today.getDay();
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - dayOfWeek);

          const startDateStr = startOfWeek.toISOString().split('T')[0];
          const endDateStr = today.toISOString().split('T')[0];

          document.getElementById('startDate').value = startDateStr;
          document.getElementById('endDate').value = endDateStr;
          document.getElementById('startTime').value = '00:00';
          document.getElementById('endTime').value = '23:59';
          highlightButton(this);
        }

        function setAll() {
          document.getElementById('startDate').value = '';
          document.getElementById('endDate').value = '';
          highlightButton(this);
        }

        function highlightButton(btn) {
          document.querySelectorAll('.quick-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        }

        function handleSubmit(event) {
          event.preventDefault();

          const statusDiv = document.getElementById('status');
          statusDiv.className = 'status';
          statusDiv.textContent = '⚡ Starting fast pull...';

          const formData = {
            startDate: document.getElementById('startDate').value,
            startTime: document.getElementById('startTime').value,
            endDate: document.getElementById('endDate').value,
            endTime: document.getElementById('endTime').value,
            statusId: document.getElementById('statusId').value
          };

          google.script.run
            .withSuccessHandler(function(result) {
              if (result.success) {
                statusDiv.className = 'status success';
                statusDiv.textContent = result.message;

                setTimeout(function() {
                  google.script.host.close();
                }, 2000);
              } else {
                statusDiv.className = 'status error';
                statusDiv.textContent = result.message;
              }
            })
            .withFailureHandler(function(error) {
              statusDiv.className = 'status error';
              statusDiv.textContent = 'Error: ' + error.message;
            })
            .executeFastPull(formData);
        }
      </script>
    </body>
    </html>
  `,
  )
    .setWidth(520)
    .setHeight(700)
    .setTitle("⚡ Fast Pull All");

  SpreadsheetApp.getUi().showModalDialog(html, "Fast Pull All");
}

/**
 * Execute Fast Pull (เรียกจาก Dialog)
 */
function executeFastPull(formData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const scriptProperties = PropertiesService.getScriptProperties();

  try {
    ss.toast("⚡ Starting fast pull...", "MLSTMS Trips", 10);

    // Login
    const token = login();
    if (!token) {
      throw new Error("Login failed");
    }

    // ⭐ รวมวันที่และเวลาให้เป็น ISO DateTime format พร้อม Timezone
    let startDateTime = "";
    let endDateTime = "";

    if (formData.startDate) {
      // สร้าง Date objects จาก input แล้ว format เป็น ISO 8601 พร้อม timezone
      const timezone = Session.getScriptTimeZone();

      // Parse start date/time
      const startDateStr = `${formData.startDate}T${formData.startTime || "00:00"}:00`;
      const startDate = new Date(startDateStr);

      // Parse end date/time
      const endDateStr = `${formData.endDate}T${formData.endTime || "23:59"}:59`;
      const endDate = new Date(endDateStr);

      // Format to ISO 8601 with timezone: "2026-03-21T03:30:00+07:00"
      startDateTime = formatDateTimeWithTimezone(startDate, timezone);
      endDateTime = formatDateTimeWithTimezone(endDate, timezone);

      smartLog(`📅 Filter: ${startDateTime} to ${endDateTime}`, "NORMAL");
    }

    // บันทึกค่าที่เลือก (แยกวันที่และเวลาไว้)
    if (formData.startDate) {
      scriptProperties.setProperty("START_DATE", formData.startDate);
      scriptProperties.setProperty("END_DATE", formData.endDate);
      scriptProperties.setProperty("START_TIME", formData.startTime || "00:00");
      scriptProperties.setProperty("END_TIME", formData.endTime || "23:59");
      scriptProperties.setProperty("STATUS_ID", formData.statusId || "");

      // ⭐ บันทึกแบบ DateTime ISO พร้อม timezone ไว้ใช้ filter
      scriptProperties.setProperty("START_DATETIME", startDateTime);
      scriptProperties.setProperty("END_DATETIME", endDateTime);
    }

    // ⚡ ตั้งค่า Fast Mode
    scriptProperties.setProperty("FAST_MODE", "true");
    scriptProperties.setProperty("RATE_LIMIT_MS", "0");
    scriptProperties.setProperty("LIMIT", "9999");

    // ✅ แสดงว่ากำลัง filter ด้วยอะไรบ้าง
    const statusText = formData.statusId
      ? `Status ${formData.statusId}`
      : "ALL Statuses";
    const dateText = `${formData.startDate} ${formData.startTime || "00:00"} to ${formData.endDate} ${formData.endTime || "23:59"}`;
    smartLog(
      `⚡ Fast Pull - Filters: ${statusText}, Date/Time: ${dateText}`,
      "NORMAL",
    );
    smartLog("⚡ Fast mode enabled - pulling ALL trips at once...", "NORMAL");

    // 🔍 Log URL ที่จะส่งไป (เพื่อ debug) - ใช้ openDateTime
    const config = getConfig();
    const debugUrl = `${config.baseUrl}/v1/trips?limit=9999&openDateTimeStart=${startDateTime}&openDateTimeEnd=${endDateTime}`;
    smartLog(`📡 API URL: ${debugUrl}`, "DEBUG");

    // ดึง trips list (ทั้งหมดในครั้งเดียว)
    const tripsResponse = getTripsPaginated(0, 9999);

    let trips = [];
    if (
      tripsResponse &&
      tripsResponse.data &&
      Array.isArray(tripsResponse.data.trips)
    ) {
      trips = tripsResponse.data.trips;
    }

    // ⭐ กรอง Trips โดย openDateTime (กรองฝั่ง Client เผื่อ API ไม่รองรับ)
    if (startDateTime && endDateTime && trips.length > 0) {
      smartLog(`🔍 Applying client-side filter by openDateTime...`, "NORMAL");
      const tripsBefore = trips.length;
      trips = filterTripsByOpenDateTime(trips, startDateTime, endDateTime);
      smartLog(`✅ Filtered: ${tripsBefore} → ${trips.length} trips`, "NORMAL");
    }

    if (trips.length === 0) {
      return {
        success: true,
        message: "✅ No trips found",
      };
    }

    smartLog(`📥 Found ${trips.length} trips - fetching details...`, "NORMAL");

    // 🔍 Log trip แระแรกเพื่อดูวันที่
    if (trips.length > 0) {
      const firstTrip = trips[0];
      const tripDate = getTripField(firstTrip, [
        "openDateTime",
        "tripOpenDateTime",
        "createdAt",
        "created_at",
      ]);
      smartLog(`📅 Sample trip date: ${tripDate}`, "DEBUG");
    }

    // ดึง Trip Details แต่ละ trip
    const tripDetails = [];
    const skippedTrips = [];
    const startTime = new Date();
    let processed = 0;
    let successful = 0;

    for (const trip of trips) {
      const tripId =
        getTripField(trip, "id") ||
        getTripField(trip, "trip_id") ||
        getTripField(trip, "tripId");

      if (!tripId) {
        smartLog("⚠️ Skipping trip with no ID", "VERBOSE");
        skippedTrips.push({ reason: "No Trip ID", trip: trip });
        continue;
      }

      processed++;
      const progress = Math.round((processed / trips.length) * 100);

      if (processed % 10 === 0 || processed === trips.length) {
        ss.toast(
          `⚡ Processing: ${processed}/${trips.length} (${progress}%)`,
          "MLSTMS Trips",
          3,
        );
      }

      // ดึงข้อมูล (Fast Mode - ไม่หน่วงเวลา)
      const details = getTripById(tripId);

      if (details && details.data) {
        tripDetails.push(details.data);
        successful++;
      } else {
        skippedTrips.push({ reason: "API Error", tripId: tripId });
      }
    }

    // บันทึกลง Sheets
    smartLog(`💾 Saving ${tripDetails.length} trips to sheets...`, "NORMAL");

    saveTripsToSheet(trips);
    saveTripDetailsToSheet(tripDetails);

    const duration = Math.round((new Date() - startTime) / 1000);

    // แสดงผล
    let resultMessage = `⚡ Fast Pull Complete!\n\n`;
    resultMessage += `✅ Successfully fetched: ${successful} trips\n`;
    resultMessage += `❌ Skipped: ${skippedTrips.length} trips\n`;
    resultMessage += `⏱️ Time taken: ${duration} seconds\n`;
    resultMessage += `🚀 Average speed: ${Math.round(successful / duration)} trips/second`;

    ss.toast(
      `✅ Done! ${successful} trips in ${duration}s`,
      "MLSTMS Trips",
      10,
    );
    smartLog(
      `⚡ Fast pull complete: ${successful}/${trips.length} trips in ${duration}s`,
      "NORMAL",
    );

    return {
      success: true,
      message: `✅ Done! ${successful} trips in ${duration}s`,
    };
  } catch (error) {
    ss.toast("❌ Error occurred", "MLSTMS Trips", 10);
    smartLog(`❌ Fast pull error: ${error.message}`, "NORMAL");

    return {
      success: false,
      message: `❌ Error: ${error.message}`,
    };
  }
}

/**
 * ดึง Trip ตาม ID (alias สำหรับ getTripDetails)
 */
function getTripById(tripId) {
  return getTripDetails(tripId);
}

/**
 * กรอง Trips โดย openDateTime (กรองฝั่ง Client ถ้า API ไม่รองรับ)
 * @param {Array} trips - Array of trip objects
 * @param {string} startDateTime - Start datetime in ISO format (e.g., "2026-03-21T00:00:00+07:00")
 * @param {string} endDateTime - End datetime in ISO format (e.g., "2026-03-21T23:59:59+07:00")
 * @returns {Array} - Filtered trips
 */
function filterTripsByOpenDateTime(trips, startDateTime, endDateTime) {
  if (!trips || trips.length === 0) return trips;

  // Parse ISO datetime strings with timezone support
  // Format: "2026-03-21T03:30:00+07:00"
  const startDate = parseISODateTime(startDateTime);
  const endDate = parseISODateTime(endDateTime);

  smartLog(
    `🔍 Filtering ${trips.length} trips by openDateTime: ${startDateTime} to ${endDateTime}`,
    "DEBUG",
  );

  const filtered = trips.filter((trip) => {
    const openDateTime = getTripField(trip, [
      "openDateTime",
      "tripOpenDateTime",
      "createdAt",
      "created_at",
    ]);

    if (!openDateTime) {
      // ถ้าไม่มี openDateTime ให้ skip trip นี้
      return false;
    }

    const tripDate = parseISODateTime(openDateTime);

    if (!tripDate) {
      smartLog(`⚠️ Invalid openDateTime format: ${openDateTime}`, "VERBOSE");
      return false;
    }

    // เช็คว่า tripDate อยู่ในช่วงที่ระบุหรือไม่
    return tripDate >= startDate && tripDate <= endDate;
  });

  smartLog(
    `✅ Filtered result: ${filtered.length} trips (from ${trips.length})`,
    "NORMAL",
  );

  return filtered;
}

/**
 * Parse ISO 8601 datetime string with timezone support
 * @param {string} isoString - ISO datetime string (e.g., "2026-03-21T03:30:00+07:00")
 * @returns {Date} - Parsed Date object
 */
function parseISODateTime(isoString) {
  if (!isoString) return null;

  try {
    // Handle format: "2026-03-21T03:30:00+07:00" or "2026-03-21T03:30:00.000+07:00"
    // The native Date constructor in Google Apps Script handles ISO 8601 formats
    const date = new Date(isoString);

    // Verify the date is valid
    if (isNaN(date.getTime())) {
      return null;
    }

    return date;
  } catch (error) {
    smartLog(
      `❌ Error parsing ISO datetime: ${isoString} - ${error.message}`,
      "ERROR",
    );
    return null;
  }
}

/**
 * Format Date object to ISO 8601 string with timezone offset
 * @param {Date} date - Date object to format
 * @param {string} timezone - Timezone identifier (e.g., "Asia/Bangkok")
 * @returns {string} - ISO 8601 formatted string (e.g., "2026-03-21T03:30:00+07:00")
 */
function formatDateTimeWithTimezone(date, timezone) {
  if (!date) return null;

  try {
    // Get date parts in the specified timezone
    const year = Utilities.formatDate(date, timezone, "yyyy");
    const month = Utilities.formatDate(date, timezone, "MM");
    const day = Utilities.formatDate(date, timezone, "dd");
    const hours = Utilities.formatDate(date, timezone, "HH");
    const minutes = Utilities.formatDate(date, timezone, "mm");
    const seconds = Utilities.formatDate(date, timezone, "ss");

    // Get timezone offset in minutes
    const offset = getTimezoneOffset(date, timezone);

    // Format offset as ±HH:mm
    const offsetHours = Math.abs(Math.floor(offset / 60));
    const offsetMinutes = Math.abs(offset % 60);
    const offsetSign = offset >= 0 ? "+" : "-";
    const offsetString = `${offsetSign}${String(offsetHours).padStart(2, "0")}:${String(offsetMinutes).padStart(2, "0")}`;

    // Return ISO 8601 format: "2026-03-21T03:30:00+07:00"
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offsetString}`;
  } catch (error) {
    smartLog(
      `❌ Error formatting datetime with timezone: ${error.message}`,
      "ERROR",
    );
    return null;
  }
}

/**
 * Get timezone offset in minutes for a given date and timezone
 * @param {Date} date - Date object
 * @param {string} timezone - Timezone identifier (e.g., "Asia/Bangkok")
 * @returns {number} - Offset in minutes (e.g., +420 for +07:00)
 */
function getTimezoneOffset(date, timezone) {
  // Create a format string that includes the timezone offset
  const formatted = Utilities.formatDate(date, timezone, "Z"); // e.g., "+0700"
  const sign = formatted[0] === "+" ? 1 : -1;
  const hours = parseInt(formatted.substring(1, 3), 10);
  const minutes = parseInt(formatted.substring(3, 5), 10);
  return sign * (hours * 60 + minutes);
}

/**
 * Estimate Trip Count (UI Wrapper)
 */
function estimateTripCountWithUI() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  try {
    ss.toast("🔍 Estimating...", "MLSTMS Trips", 5);

    // ตรวจสอบ credentials
    if (!hasSavedCredentials()) {
      ui.alert("⚠️ No Credentials", "Please login first.", ui.ButtonSet.OK);
      return;
    }

    // Login
    const token = login();
    if (!token) {
      throw new Error("Login failed");
    }

    const estimate = estimateTripCount();
    if (!estimate) {
      throw new Error("Cannot estimate");
    }

    const config = getConfig();
    const timePerTrip = (config.rateLimitMs || 1000) / 1000;
    const batchesNeeded = Math.ceil(
      estimate.totalCount / (parseInt(config.limit) || 50),
    );
    const estimatedMinutes = Math.ceil(
      (estimate.totalCount * timePerTrip) / 60,
    );

    let message = `📊 Trip Count Estimation\n\n`;
    message += `Total Trips: ${estimate.totalCount}\n`;
    message += `Batch Size: ${config.limit} trips\n`;
    message += `Batches Needed: ${batchesNeeded}\n`;
    message += `Rate Limit: ${config.fastMode ? "Fast mode" : config.rateLimitMs + "ms"}\n`;
    message += `Estimated Time: ~${estimatedMinutes} minutes\n\n`;

    if (estimatedMinutes > 30) {
      message += `⚠️ This is a LARGE dataset!\n\n`;
      message += `Recommendations:\n`;
      message += `• Use "Batch Pull" to process in multiple batches\n`;
      message += `• Enable Fast Mode (⚡ Toggle Fast Mode)\n`;
      message += `• Resume if process gets interrupted\n`;
    } else if (estimatedMinutes > 10) {
      message += `ℹ️ This is a medium dataset.\n\n`;
      message += `Use "Batch Pull" for safer processing.\n`;
    } else {
      message += `✅ Small dataset.\n\n`;
      message += `You can use either "Quick Pull" or "Batch Pull".\n`;
    }

    ui.alert("📊 Estimation Result", message, ui.ButtonSet.OK);
  } catch (error) {
    ui.alert(
      "❌ Error",
      `Estimation failed:\n\n${error.message}`,
      ui.ButtonSet.OK,
    );
  }
}

/**
 * สร้าง Trigger สำหรับ Resume อัตโนมัติ (Optional)
 */
function scheduleResumeTrigger() {
  // สร้าง time-based trigger สำหรับ resume
  const triggers = ScriptApp.getProjectTriggers();
  const hasResumeTrigger = triggers.some(
    (t) => t.getHandlerFunction() === "pullTripsToSheetBatchResume",
  );

  if (!hasResumeTrigger) {
    ScriptApp.newTrigger("pullTripsToSheetBatchResume")
      .timeBased()
      .after(60 * 1000) // 1 นาที
      .create();
    Logger.log("⏰ Resume trigger scheduled");
  }
}

/**
 * ลบ Resume Trigger (Optional)
 */
function clearResumeTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach((t) => {
    if (t.getHandlerFunction() === "pullTripsToSheetBatchResume") {
      ScriptApp.deleteTrigger(t);
      Logger.log("🗑️ Resume trigger deleted");
    }
  });
}

/**
 * ฟังก์ชันหลัก: ดึง Trips และ Trip Details มาบันทึกลง Sheet (Single Batch - เดิม)
 */
function pullTripsToSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const scriptProperties = PropertiesService.getScriptProperties();

  try {
    // ตรวจสอบว่ามี credentials ที่บันทึกไว้หรือไม่
    if (!hasSavedCredentials()) {
      ui.alert(
        "⚠️ No Credentials Found",
        'No saved credentials found. Please use "Login & Pull Data" to login first.',
        ui.ButtonSet.OK,
      );
      return;
    }

    // แจ้งเตือนเริ่มต้น
    ss.toast("🚀 Starting to pull trips data...", "MLSTMS Trips", 5);

    Logger.log("🚀 Starting to pull trips data...");

    // 1. Login (ใช้ credentials ที่บันทึกไว้)
    ss.toast("🔐 Logging in with saved credentials...", "MLSTMS Trips", 5);
    const token = login();
    if (!token) {
      ui.alert(
        "Login Failed",
        "Please check your credentials and try again.",
        ui.ButtonSet.OK,
      );
      throw new Error("Failed to login. Please check your credentials.");
    }

    // 2. ดึงรายการ Trips (ทุกหน้า)
    ss.toast("🔄 Fetching ALL trips (all pages)...", "MLSTMS Trips", 10);
    Logger.log("📋 Fetching ALL trips (all pages)...");

    // ✅ เรียก getAllTrips() แทน getTrips() เพื่อดึงทุกหน้า
    const trips = getAllTrips();

    Logger.log(`✅ Found ${trips.length} trips (after filtering)`);
    if (trips.length > 0) {
      Logger.log(
        `   - Sample trip: ${JSON.stringify(trips[0]).substring(0, 300)}...`,
      );
    }
    ss.toast(`✅ Found ${trips.length} trips`, "MLSTMS Trips", 10);

    if (trips.length === 0) {
      const config = getConfig();
      ui.alert(
        "⚠️ No Trips Found",
        `No trips found with the current filters.\n\nPlease check:\n• Start Date: ${config.startDate || "Not set"}\n• End Date: ${config.endDate || "Not set"}\n• Status ID: ${config.statusId || "All"}\n\nTry adjusting the date range or check if there are trips in the system.`,
        ui.ButtonSet.OK,
      );
      Logger.log("⚠️ No trips found after filtering.");
      return;
    }

    // 3. บันทึก Trips ลง Sheet
    ss.toast("💾 Saving trips to sheet...", "MLSTMS Trips", 5);
    Logger.log("💾 Calling saveTripsToSheet...");
    saveTripsToSheet(trips);
    Logger.log("💾 saveTripsToSheet completed");

    // 4. ดึง Trip Details แต่ละ trip
    const config = getConfig();
    Logger.log("📋 Fetching trip details...");
    Logger.log(
      `   - Rate limit: ${config.fastMode ? "FAST MODE (no limit)" : config.rateLimitMs + "ms per request"}`,
    );

    const tripDetails = [];
    const skippedTrips = [];

    // แสดง progress
    let processed = 0;
    let successful = 0;
    const total = trips.length;
    const startTime = new Date();
    const estimatedTime = total * (config.rateLimitMs / 1000); // คำนวณ ETA จาก rate limit

    for (const trip of trips) {
      // ใช้ getTripField เพื่อรองรับหลายชื่อ field
      const tripId = getTripField(trip, [
        "id",
        "tripId",
        "trip_code",
        "tripCode",
        "trip_id",
      ]);

      if (!tripId) {
        Logger.log(
          `⚠️ Skipping trip without ID. Trip data: ${JSON.stringify(trip).substring(0, 200)}...`,
        );
        skippedTrips.push({ reason: "No ID", data: trip });
        continue;
      }

      processed++;
      const progress = Math.round((processed / total) * 100);
      const elapsed = Math.round((new Date() - startTime) / 1000);
      const eta = Math.round((estimatedTime - elapsed) / 60);

      Logger.log(
        `Fetching details for trip ${tripId} (${processed}/${total})...`,
      );

      // แจ้งเตือนทุก 5 รอบ หรือรอบสุดท้าย
      if (processed % 5 === 0 || processed === total) {
        ss.toast(
          `⏳ Fetching trip details: ${processed}/${total} (${progress}%) - ETA: ${eta} min`,
          "MLSTMS Trips",
          10,
        );
      }

      const detail = getTripDetails(tripId);
      if (detail) {
        tripDetails.push(detail);
        successful++;
        Logger.log(`   ✅ Successfully fetched trip ${tripId}`);
      } else {
        Logger.log(`   ❌ Failed to fetch trip ${tripId}`);
        skippedTrips.push({ reason: "API Error", tripId: tripId });
      }

      // Rate limiting - ใช้ค่าจาก config หรือข้ามใน fast mode
      if (!config.fastMode && config.rateLimitMs > 0) {
        Utilities.sleep(config.rateLimitMs);
      }
    }

    Logger.log(
      `📊 Trip details summary: ${successful}/${total} successful, ${skippedTrips.length} skipped`,
    );
    if (skippedTrips.length > 0) {
      Logger.log(
        `   Skipped trips: ${JSON.stringify(skippedTrips).substring(0, 500)}...`,
      );
    }

    // 5. บันทึก Trip Details ลง Sheet
    ss.toast("💾 Saving trip details...", "MLSTMS Trips", 5);
    Logger.log(`💾 Saving ${tripDetails.length} trip details to sheet...`);
    saveTripDetailsToSheet(tripDetails);
    Logger.log("💾 saveTripDetailsToSheet completed");

    // แจ้งเตือนเสร็จสิ้น
    const detailsEndTime = new Date();
    const totalDetailsTime = Math.round((detailsEndTime - startTime) / 1000);
    const minutes = Math.floor(totalDetailsTime / 60);
    const seconds = totalDetailsTime % 60;

    ss.toast("✅ Successfully completed!", "MLSTMS Trips", 10);
    Logger.log("✅ Successfully completed!");
    Logger.log(
      `📊 Summary: ${trips.length} trips, ${tripDetails.length} trip details saved.`,
    );

    // สร้างข้อความสรุป
    let summaryMessage = `Successfully pulled ${trips.length} trips and ${tripDetails.length} trip details.`;

    if (skippedTrips.length > 0) {
      summaryMessage += `\n\n⚠️ Warning: ${skippedTrips.length} trip(s) could not be fetched.`;
      summaryMessage += `\n   - Check logs for details (View > Logs)`;
    }

    summaryMessage += `\n\nTotal time: ${minutes}m ${seconds}s`;

    ui.alert("✅ Data Pull Completed!", summaryMessage, ui.ButtonSet.OK);
  } catch (error) {
    ss.toast("❌ Error occurred", "MLSTMS Trips", 10);
    Logger.log(`❌ Error: ${error.message}`);
    ui.alert(
      "❌ Error",
      `An error occurred:\n\n${error.message}\n\nPlease check the logs for more details.`,
      ui.ButtonSet.OK,
    );
    throw error;
  } finally {
    // ลบ temp properties เสมอ
    scriptProperties.deleteProperty("TEMP_START_DATE");
    scriptProperties.deleteProperty("TEMP_END_DATE");
    scriptProperties.deleteProperty("TEMP_STATUS_ID");
    scriptProperties.deleteProperty("TEMP_LIMIT");
  }
}

/**
 * ดึง Trip Details เฉพาะ Trip ID ที่ระบุ
 * @param {string} tripId - Trip ID ที่ต้องการดึง
 */
function pullSingleTrip(tripId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  try {
    ss.toast(`🚀 Pulling trip ${tripId}...`, "MLSTMS Trips", 5);
    Logger.log(`🚀 Pulling single trip: ${tripId}`);

    // Login
    ss.toast("🔐 Logging in...", "MLSTMS Trips", 5);
    login();

    // Get trip details
    ss.toast("📋 Fetching trip details...", "MLSTMS Trips", 5);
    const detail = getTripDetails(tripId);

    if (detail) {
      ss.toast("💾 Saving trip...", "MLSTMS Trips", 5);
      saveTripDetailsToSheet([detail]);
      ss.toast("✅ Trip saved!", "MLSTMS Trips", 10);
      Logger.log(`✅ Trip ${tripId} saved successfully!`);

      ui.alert(
        "✅ Success",
        `Trip ${tripId} has been saved successfully!`,
        ui.ButtonSet.OK,
      );
    } else {
      ss.toast("❌ Failed to get trip", "MLSTMS Trips", 10);
      Logger.log(`❌ Failed to get trip ${tripId}`);

      ui.alert(
        "❌ Failed",
        `Failed to get trip ${tripId}. Please check the trip ID and try again.`,
        ui.ButtonSet.OK,
      );
    }
  } catch (error) {
    ss.toast("❌ Error occurred", "MLSTMS Trips", 10);
    Logger.log(`❌ Error: ${error.message}`);

    ui.alert(
      "❌ Error",
      `An error occurred:\n\n${error.message}`,
      ui.ButtonSet.OK,
    );
    throw error;
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * ตรวจสอบสถานะการเชื่อมต่อ API
 */
function testConnection() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  try {
    ss.toast("🔍 Testing API connection...", "MLSTMS Trips", 5);
    Logger.log("🔍 Testing API connection...");

    const token = login();

    if (token) {
      ss.toast("✅ Connection successful!", "MLSTMS Trips", 10);
      Logger.log("✅ API connection successful!");
      Logger.log(`Access Token: ${token.substring(0, 20)}...`);

      ui.alert(
        "✅ Connection Successful",
        "Successfully connected to PTG eZView API!\n\nAccess Token: " +
          token.substring(0, 20) +
          "...",
        ui.ButtonSet.OK,
      );

      return true;
    } else {
      ss.toast("❌ Connection failed", "MLSTMS Trips", 10);
      Logger.log("❌ Failed to get access token");

      ui.alert(
        "❌ Connection Failed",
        "Failed to connect to PTG eZView API. Please check your credentials.",
        ui.ButtonSet.OK,
      );

      return false;
    }
  } catch (error) {
    ss.toast("❌ Connection failed", "MLSTMS Trips", 10);
    Logger.log(`❌ Connection test failed: ${error.message}`);

    ui.alert(
      "❌ Connection Failed",
      `Failed to connect to PTG eZView API:\n\n${error.message}`,
      ui.ButtonSet.OK,
    );

    return false;
  }
}

/**
 * Debug API Response - ดูว่า API ตอบกลับมาอย่างไร
 */
function debugApiResponse() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  try {
    ss.toast("🔍 Fetching API response...", "MLSTMS Trips", 5);
    Logger.log("🐛 Debug: Starting API response check...");

    // Login
    const token = login();
    if (!token) {
      ui.alert(
        "❌ Error",
        "Login failed. Cannot check API response.",
        ui.ButtonSet.OK,
      );
      return;
    }

    // Get API Response
    const tripsResponse = getTrips();

    Logger.log("🐛 Debug: Full API Response:");
    Logger.log(JSON.stringify(tripsResponse, null, 2));

    // 🔍 SPECIAL: ดูฟิลด์ทั้งหมดใน response รวม totalCount
    Logger.log("🔍 TOP-LEVEL FIELDS:");
    if (tripsResponse && typeof tripsResponse === "object") {
      Object.keys(tripsResponse).forEach((key) => {
        const value = tripsResponse[key];
        const type = typeof value;
        const valuePreview = Array.isArray(value)
          ? `Array(${value.length})`
          : type === "object"
            ? "Object"
            : value;
        Logger.log(`  • ${key}: ${type} = ${valuePreview}`);
      });
    }

    Logger.log("🔍 DATA FIELDS:");
    if (
      tripsResponse &&
      tripsResponse.data &&
      typeof tripsResponse.data === "object"
    ) {
      Object.keys(tripsResponse.data).forEach((key) => {
        const value = tripsResponse.data[key];
        const type = typeof value;
        const valuePreview = Array.isArray(value)
          ? `Array(${value.length})`
          : type === "object"
            ? "Object"
            : value;
        Logger.log(`  • data.${key}: ${type} = ${valuePreview}`);
      });
    }

    // Parse response
    let trips = [];
    let tripsLocation = "";

    if (
      tripsResponse &&
      tripsResponse.data &&
      Array.isArray(tripsResponse.data.trips)
    ) {
      trips = tripsResponse.data.trips;
      tripsLocation = "response.data.trips";
    } else if (
      tripsResponse &&
      tripsResponse.data &&
      Array.isArray(tripsResponse.data)
    ) {
      trips = tripsResponse.data;
      tripsLocation = "response.data";
    } else if (tripsResponse && Array.isArray(tripsResponse)) {
      trips = tripsResponse;
      tripsLocation = "response (direct array)";
    } else if (
      tripsResponse &&
      tripsResponse.trips &&
      Array.isArray(tripsResponse.trips)
    ) {
      trips = tripsResponse.trips;
      tripsLocation = "response.trips";
    }

    // Create debug message
    let message = "🐛 API Response Debug:\n\n";
    message += `Response Type: ${typeof tripsResponse}\n`;
    message += `Trips Location: ${tripsLocation}\n`;
    message += `Trips Count: ${trips.length}\n\n`;

    if (trips.length > 0) {
      const sampleTrip = trips[0];
      const fieldNames = Object.keys(sampleTrip);

      message += `🔍 Field Names Found (${fieldNames.length}):\n`;
      fieldNames.forEach((key, index) => {
        const value = sampleTrip[key];
        const valueStr =
          typeof value === "object"
            ? "[Object]"
            : String(value).substring(0, 30);
        message += `   ${index + 1}. ${key}: ${valueStr}\n`;
      });

      message += `\n📋 Sample Trip (Full):\n${JSON.stringify(sampleTrip, null, 2)}\n\n`;

      // ตรวจสอบค่าที่สำคัญ
      message += `🔎 Key Field Detection:\n`;
      message += `   Trip ID fields: ${fieldNames.filter((k) => k.toLowerCase().includes("id")).join(", ") || "None"}\n`;
      message += `   Name fields: ${fieldNames.filter((k) => k.toLowerCase().includes("name")).join(", ") || "None"}\n`;
      message += `   License fields: ${fieldNames.filter((k) => k.toLowerCase().includes("license") || k.toLowerCase().includes("plate")).join(", ") || "None"}\n`;
    } else {
      message += `No trips found!\n\n`;
      message += `Full Response:\n${JSON.stringify(tripsResponse, null, 2).substring(0, 500)}...\n\n`;
    }

    // Show in alert (truncated)
    const displayMessage =
      message.length > 4000
        ? message.substring(0, 4000) + "\n\n... (truncated)"
        : message;
    ui.alert("🐛 Debug Info", displayMessage, ui.ButtonSet.OK);

    // Save to debug sheet
    let debugSheet = ss.getSheetByName("Debug Log");
    if (!debugSheet) {
      debugSheet = ss.insertSheet("Debug Log");
    }

    const timestamp = new Date().toISOString();
    debugSheet.getRange(1, 1).setValue("Timestamp");
    debugSheet.getRange(1, 2).setValue("Response Type");
    debugSheet.getRange(1, 3).setValue("Trips Location");
    debugSheet.getRange(1, 4).setValue("Trips Count");
    debugSheet.getRange(1, 5).setValue("Field Names");
    debugSheet.getRange(1, 6).setValue("Full Response");

    const lastRow = debugSheet.getLastRow() + 1;
    debugSheet.getRange(lastRow, 1).setValue(timestamp);
    debugSheet.getRange(lastRow, 2).setValue(typeof tripsResponse);
    debugSheet.getRange(lastRow, 3).setValue(tripsLocation);
    debugSheet.getRange(lastRow, 4).setValue(trips.length);
    debugSheet
      .getRange(lastRow, 5)
      .setValue(trips.length > 0 ? Object.keys(trips[0]).join(", ") : "");
    debugSheet.getRange(lastRow, 6).setValue(JSON.stringify(tripsResponse));

    ss.toast('✅ Debug info saved to "Debug Log" sheet', "MLSTMS Trips", 10);

    Logger.log('🐛 Debug: Check complete. See "Debug Log" sheet for details.');
  } catch (error) {
    Logger.log(`🐛 Debug error: ${error.message}`);
    ui.alert(
      "❌ Debug Error",
      `Error during debug:\n\n${error.message}\n\nCheck the logs for more details.`,
      ui.ButtonSet.OK,
    );
  }
}

/**
 * Debug Trip Details API - ดูว่า Trip Details API ตอบอะไรกลับมา
 */
function debugTripDetails() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  try {
    ss.toast("🔍 Debugging trip details...", "MLSTMS Trips", 5);
    Logger.log("🐛 Debug: Starting trip details check...");

    // Login
    const token = login();
    if (!token) {
      ui.alert(
        "❌ Error",
        "Login failed. Cannot check trip details API.",
        ui.ButtonSet.OK,
      );
      return;
    }

    // Get trips first
    const tripsResponse = getTrips();
    let trips = [];

    if (
      tripsResponse &&
      tripsResponse.data &&
      Array.isArray(tripsResponse.data.trips)
    ) {
      trips = tripsResponse.data.trips;
    } else if (
      tripsResponse &&
      tripsResponse.data &&
      Array.isArray(tripsResponse.data)
    ) {
      trips = tripsResponse.data;
    } else if (tripsResponse && Array.isArray(tripsResponse)) {
      trips = tripsResponse;
    }

    if (trips.length === 0) {
      ui.alert(
        "❌ Error",
        "No trips found. Cannot debug trip details.",
        ui.ButtonSet.OK,
      );
      return;
    }

    // Get first trip ID
    const tripId = getTripField(trips[0], [
      "id",
      "tripId",
      "trip_code",
      "tripCode",
      "trip_id",
    ]);

    if (!tripId) {
      ui.alert(
        "❌ Error",
        "First trip has no ID. Cannot debug trip details.",
        ui.ButtonSet.OK,
      );
      Logger.log(`First trip data: ${JSON.stringify(trips[0], null, 2)}`);
      return;
    }

    Logger.log(`🐛 Testing trip details API with trip ID: ${tripId}`);

    // Get trip details
    const detail = getTripDetails(tripId);

    if (!detail) {
      ui.alert(
        "❌ Error",
        "Failed to get trip details. Check logs.",
        ui.ButtonSet.OK,
      );
      return;
    }

    // Analyze response
    let message = "🐛 Trip Details API Debug:\n\n";
    message += `Trip ID: ${tripId}\n`;
    message += `Response Type: ${typeof detail}\n`;
    message += `Has 'trip' key: ${detail.hasOwnProperty("trip") ? "Yes" : "No"}\n`;
    message += `Has 'data' key: ${detail.hasOwnProperty("data") ? "Yes" : "No"}\n`;
    message += `Has 'waypoints' key: ${detail.hasOwnProperty("waypoints") ? "Yes" : "No"}\n\n`;

    // Check if response has nested structure
    if (detail.trip) {
      message += `📦 Structure: detail.trip detected\n`;
      message += `Keys in detail.trip: ${Object.keys(detail.trip).join(", ")}\n\n`;

      if (detail.trip.waypoints) {
        message += `✅ Waypoints found: ${detail.trip.waypoints.length} waypoints\n`;
        if (detail.trip.waypoints.length > 0) {
          message += `\nSample waypoint:\n${JSON.stringify(detail.trip.waypoints[0], null, 2)}\n`;
        }
      } else {
        message += `⚠️ No waypoints in detail.trip\n`;
      }
    } else if (detail.waypoints) {
      message += `📦 Structure: waypoints at root level\n`;
      message += `✅ Waypoints found: ${detail.waypoints.length} waypoints\n`;
      if (detail.waypoints.length > 0) {
        message += `\nSample waypoint:\n${JSON.stringify(detail.waypoints[0], null, 2)}\n`;
      }
    } else if (detail.data && detail.data.waypoints) {
      message += `📦 Structure: detail.data.waypoints detected\n`;
      message += `✅ Waypoints found: ${detail.data.waypoints.length} waypoints\n`;
    } else {
      message += `⚠️ No waypoints found in response!\n`;
      message += `\nFull response:\n${JSON.stringify(detail, null, 2).substring(0, 1000)}...\n`;
    }

    // Show result
    const displayMessage =
      message.length > 4000
        ? message.substring(0, 4000) + "\n\n... (truncated)"
        : message;
    ui.alert("🐛 Trip Details Debug", displayMessage, ui.ButtonSet.OK);

    // Save to debug sheet
    let debugSheet = ss.getSheetByName("Debug Log");
    if (!debugSheet) {
      debugSheet = ss.insertSheet("Debug Log");
    }

    const timestamp = new Date().toISOString();
    const lastRow = debugSheet.getLastRow() + 1;

    // Set headers if needed
    if (debugSheet.getLastRow() === 0) {
      debugSheet.getRange(1, 1).setValue("Timestamp");
      debugSheet.getRange(1, 2).setValue("Test Type");
      debugSheet.getRange(1, 3).setValue("Trip ID");
      debugSheet.getRange(1, 4).setValue("Response");
      debugSheet.getRange(1, 5).setValue("Has Waypoints");
    }

    debugSheet.getRange(lastRow, 1).setValue(timestamp);
    debugSheet.getRange(lastRow, 2).setValue("Trip Details");
    debugSheet.getRange(lastRow, 3).setValue(tripId);
    debugSheet.getRange(lastRow, 4).setValue(JSON.stringify(detail));
    debugSheet
      .getRange(lastRow, 5)
      .setValue(
        detail.trip?.waypoints?.length ||
          detail.waypoints?.length ||
          detail.data?.waypoints?.length ||
          0,
      );

    ss.toast("✅ Trip details debug saved", "MLSTMS Trips", 10);
    Logger.log("🐛 Trip details debug complete");
  } catch (error) {
    Logger.log(`🐛 Debug error: ${error.message}`);
    ui.alert(
      "❌ Debug Error",
      `Error during debug:\n\n${error.message}\n\nCheck the logs for more details.`,
      ui.ButtonSet.OK,
    );
  }
}

/**
 * ⚡ Phase 3.1: Set Performance Mode
 */
function setPerformanceMode() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const scriptProperties = PropertiesService.getScriptProperties();

  const currentMode =
    scriptProperties.getProperty("PERFORMANCE_MODE") || "BALANCED";

  const response = ui.prompt(
    "⚡ Set Performance Mode",
    "Choose performance mode:\n\n" +
      "• SAFE - Conservative (2000ms delay, 30 trips/batch)\n" +
      "• BALANCED - Recommended (500ms delay, 75 trips/batch, adaptive)\n" +
      "• TURBO - Aggressive (100ms delay, 150 trips/batch, adaptive)\n\n" +
      "Current mode: " +
      currentMode +
      "\n\n" +
      "Enter mode (SAFE/BALANCED/TURBO):",
    ui.ButtonSet.OK_CANCEL,
  );

  if (response.getSelectedButton() === ui.Button.OK) {
    const mode = response.getResponseText().toUpperCase().trim();
    const validModes = ["SAFE", "BALANCED", "TURBO"];

    if (!validModes.includes(mode)) {
      ui.alert(
        "Invalid Input",
        `Please enter a valid mode: ${validModes.join(", ")}`,
        ui.ButtonSet.OK,
      );
      return;
    }

    scriptProperties.setProperty("PERFORMANCE_MODE", mode);

    // Apply preset
    applyPerformancePreset();

    const modeConfig = {
      SAFE: {
        text: "🐢 SAFE",
        speed: "Conservative",
        delay: "2000ms",
        batch: "30",
      },
      BALANCED: {
        text: "⚖️ BALANCED",
        speed: "Recommended",
        delay: "500ms",
        batch: "75",
      },
      TURBO: {
        text: "🚀 TURBO",
        speed: "Aggressive",
        delay: "100ms",
        batch: "150",
      },
    };

    const config = modeConfig[mode];

    ss.toast(`Performance mode set to ${mode}`, "MLSTMS Trips", 5);
    smartLog(`✅ Performance mode: ${mode} - ${config.speed}`, "NORMAL");

    ui.alert(
      `⚡ Performance Mode: ${mode}`,
      `Mode set to ${config.text}\n\n` +
        `• Speed: ${config.speed}\n` +
        `• Rate Limit: ${config.delay}\n` +
        `• Batch Size: ${config.batch} trips\n\n` +
        `Changes will take effect on next run.`,
      ui.ButtonSet.OK,
    );
  }
}

/**
 * เปิด/ปิด Fast Mode (skip rate limiting)
 */
function toggleFastMode() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const scriptProperties = PropertiesService.getScriptProperties();
  const currentMode = scriptProperties.getProperty("FAST_MODE") === "true";

  const newMode = !currentMode;
  scriptProperties.setProperty("FAST_MODE", newMode ? "true" : "false");

  const modeText = newMode ? "ENABLED" : "DISABLED";
  const speedText = newMode
    ? "⚡ MAXIMUM SPEED (no rate limiting)"
    : "🐢 Normal speed (1s delay between requests)";

  ss.toast(`Fast Mode ${modeText}`, "MLSTMS Trips", 5);
  Logger.log(`✅ Fast Mode ${modeText}`);

  ui.alert(
    `Fast Mode ${modeText}`,
    `Fast Mode has been ${modeText}!\n\n${speedText}\n\n⚠️ Warning: Fast mode may overwhelm the API server. Use with caution.`,
    ui.ButtonSet.OK,
  );
}

/**
 * ตั้งค่า Rate Limit (หน่วงเวลาระหว่าง requests)
 */
function setRateLimit() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const scriptProperties = PropertiesService.getScriptProperties();

  const response = ui.prompt(
    "Set Rate Limit",
    "Enter delay between requests in milliseconds:\n\n" +
      "• 0 = Fast mode (no delay)\n" +
      "• 500 = 0.5 second\n" +
      "• 1000 = 1 second (recommended)\n" +
      "• 2000 = 2 seconds\n" +
      "• 5000 = 5 seconds\n\n" +
      "Current value: " +
      (scriptProperties.getProperty("RATE_LIMIT_MS") || "1000") +
      "ms",
    ui.ButtonSet.OK_CANCEL,
  );

  if (response.getSelectedButton() === ui.Button.OK) {
    const value = parseInt(response.getResponseText());

    if (isNaN(value) || value < 0) {
      ui.alert(
        "Invalid Input",
        "Please enter a valid number (0 or greater).",
        ui.ButtonSet.OK,
      );
      return;
    }

    scriptProperties.setProperty("RATE_LIMIT_MS", String(value));
    scriptProperties.setProperty("FAST_MODE", value === 0 ? "true" : "false");

    const speedText = value === 0 ? "⚡ FAST MODE" : value + "ms per request";
    ss.toast(`Rate limit set to ${speedText}`, "MLSTMS Trips", 5);
    Logger.log(`✅ Rate limit set to ${value}ms`);

    ui.alert(
      "✅ Rate Limit Updated",
      `Rate limit has been set to ${speedText}`,
      ui.ButtonSet.OK,
    );
  }
}

/**
 * เคลียร์ Token (สำหรับการทดสอบ)
 */
function clearTokens() {
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.deleteProperty("ACCESS_TOKEN");
  scriptProperties.deleteProperty("REFRESH_TOKEN");
  scriptProperties.deleteProperty("TOKEN_EXPIRES_AT");
  Logger.log("✅ Tokens cleared");
}

/**
 * ทดสอบการดึง Trip ID - เพื่อ debug ปัญหา Trip ID ว่างเปล่า
 */
function testTripIdExtraction() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  try {
    ss.toast("🧪 Testing Trip ID extraction...", "MLSTMS Trips", 5);
    Logger.log("🧪 Test: Starting Trip ID extraction test...");

    // Login
    const token = login();
    if (!token) {
      ui.alert("❌ Error", "Login failed. Cannot test.", ui.ButtonSet.OK);
      return;
    }

    // Get trips
    const tripsResponse = getTrips();
    let trips = [];

    if (
      tripsResponse &&
      tripsResponse.data &&
      Array.isArray(tripsResponse.data.trips)
    ) {
      trips = tripsResponse.data.trips;
    } else if (
      tripsResponse &&
      tripsResponse.data &&
      Array.isArray(tripsResponse.data)
    ) {
      trips = tripsResponse.data;
    } else if (tripsResponse && Array.isArray(tripsResponse)) {
      trips = tripsResponse;
    }

    if (trips.length === 0) {
      ui.alert("❌ Error", "No trips found. Cannot test.", ui.ButtonSet.OK);
      return;
    }

    const trip = trips[0];

    // Log ทุกอย่าง
    Logger.log("=== Trip ID Extraction Test ===");
    Logger.log("Full trip object:");
    Logger.log(JSON.stringify(trip, null, 2));

    Logger.log("\n--- Extraction Tests ---");
    Logger.log("trip.tripId:", trip.tripId);
    Logger.log("trip.id:", trip.id);
    Logger.log("trip['tripId']:", trip["tripId"]);
    Logger.log("Keys:", Object.keys(trip).join(", "));

    // Test getTripField
    const extractedId = getTripField(trip, [
      "tripId",
      "id",
      "trip_code",
      "tripCode",
      "trip_id",
    ]);
    Logger.log("getTripField result:", extractedId);

    // Build message
    let message = "🧪 Trip ID Extraction Test:\n\n";
    message += `Number of trips: ${trips.length}\n\n`;
    message += `First trip keys:\n${Object.keys(trip).join("\n")}\n\n`;
    message += `Extracted values:\n`;
    message += `• tripId: ${trip.tripId || "NOT FOUND"}\n`;
    message += `• id: ${trip.id || "NOT FOUND"}\n`;
    message += `• getTripField(): ${extractedId || "NOT FOUND"}\n`;
    message += `• tripStatus.statusId: ${trip.tripStatus?.statusId || "NOT FOUND"}\n`;
    message += `• tripStatus.statusName: ${trip.tripStatus?.statusName || "NOT FOUND"}\n`;

    ui.alert("🧪 Extraction Test", message, ui.ButtonSet.OK);
    ss.toast("✅ Test complete - Check logs", "MLSTMS Trips", 10);
  } catch (error) {
    Logger.log(`❌ Test error: ${error.message}`);
    ui.alert("❌ Test Error", `Error:\n\n${error.message}`, ui.ButtonSet.OK);
  }
}

/**
 * 📅 Debug: ดูว่า Trip มีฟิลด์ Date อะไรบ้าง
 * เพื่อตรวจสอบว่า API ใช้ฟิลด์ไหนในการ filter
 */
function debugDateFields() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  try {
    ss.toast("📅 Debugging date fields...", "MLSTMS Trips", 3);

    const config = getConfig();
    const token = getAccessToken();

    // ดึง trip มา 1-2 รายการเพื่อดูโครงสร้าง
    const url = `${config.baseUrl}/v1/trips?limit=2`;

    const options = {
      method: "get",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    if (responseCode !== 200) {
      throw new Error(`API Error: ${responseCode}`);
    }

    const result = JSON.parse(response.getContentText());
    const trips = result.data || result.trips || result;

    if (!trips || trips.length === 0) {
      ui.alert("📅 Date Fields Debug", "ไม่พบข้อมูล trips", ui.ButtonSet.OK);
      return;
    }

    const trip = trips[0];

    // หาฟิลด์ทั้งหมดที่มีคำว่า date, time, at, หรือ Date, Time
    const dateFields = {};
    const allKeys = Object.keys(trip);

    // Recursive function to find all date fields
    function findDateFields(obj, prefix = "") {
      if (!obj || typeof obj !== "object") return;

      for (const key of Object.keys(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];
        const keyLower = key.toLowerCase();

        // Check if this looks like a date field
        const isDateField =
          keyLower.includes("date") ||
          keyLower.includes("time") ||
          (keyLower.includes("at") &&
            (keyLower === "createdat" ||
              keyLower === "updatedat" ||
              keyLower.endsWith("at"))) ||
          (value &&
            typeof value === "string" &&
            (value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/) ||
              value.match(/^\d{4}-\d{2}-\d{2}$/)));

        if (isDateField && value) {
          dateFields[fullKey] = value;
        }

        // Recurse into nested objects (but not arrays)
        if (value && typeof value === "object" && !Array.isArray(value)) {
          findDateFields(value, fullKey);
        }
      }
    }

    findDateFields(trip);

    // Build message
    let message = "📅 Date Fields in Trip Data:\n\n";
    message += `🔍 API Endpoint: ${config.baseUrl}/v1/trips\n`;
    message += `📋 Query Parameters: startDate, endDate\n\n`;

    message += `🗓️ All Date/Time Fields Found:\n`;
    message += `${"─".repeat(40)}\n`;

    const fieldList = Object.entries(dateFields);
    if (fieldList.length > 0) {
      fieldList.forEach(([field, value]) => {
        message += `• ${field}:\n  ${value}\n\n`;
      });
    } else {
      message += `No date fields found!\n\n`;
    }

    message += `${"─".repeat(40)}\n\n`;
    message += `💡 หมายเหตุ:\n`;
    message += `API จะ filter โดยใช้ฟิลด์ที่ระบุใน API docs\n`;
    message += `โดยปกติจะใช้: openDateTime, closeDateTime, หรือ createdAt\n\n`;

    message += `📝 ลองตั้งค่า Start/End Date แล้ว pull data\n`;
    message += `เพื่อดูว่าได้ trips ของวันที่เท่าไหร่\n`;

    ui.alert("📅 Date Fields Debug", message, ui.ButtonSet.OK);

    // Log to console as well
    Logger.log("=== Date Fields Debug ===");
    Logger.log(JSON.stringify(dateFields, null, 2));
  } catch (error) {
    Logger.log(`❌ Debug error: ${error.message}`);
    ui.alert("❌ Debug Error", `Error:\n\n${error.message}`, ui.ButtonSet.OK);
  }
}

/**
 * 🔬 Debug: ทดสอบ Date Filtering - ดูว่า API filter ข้อมูลยังไง
 */
function debugDateFiltering() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  try {
    ss.toast("🔬 Debugging date filtering...", "MLSTMS Trips", 5);

    const config = getConfig();
    const token = getAccessToken();

    // ดึงค่าที่ตั้งไว้
    const scriptProperties = PropertiesService.getScriptProperties();
    const startDate = scriptProperties.getProperty("START_DATE") || "";
    const endDate = scriptProperties.getProperty("END_DATE") || "";
    const startTime = scriptProperties.getProperty("START_TIME") || "";
    const endTime = scriptProperties.getProperty("END_TIME") || "";

    // สร้าง DateTime ISO
    const startDateTime = startDate
      ? `${startDate}T${startTime || "00:00"}:00`
      : "";
    const endDateTime = endDate ? `${endDate}T${endTime || "23:59"}:59` : "";

    let message = "🔬 Date Filtering Debug\n\n";
    message += `📋 ค่าที่ตั้งไว้:\n`;
    message += `   Start Date: ${startDate || "Not set"}\n`;
    message += `   Start Time: ${startTime || "Not set"}\n`;
    message += `   Start DateTime: ${startDateTime || "Not set"}\n\n`;
    message += `   End Date: ${endDate || "Not set"}\n`;
    message += `   End Time: ${endTime || "Not set"}\n`;
    message += `   End DateTime: ${endDateTime || "Not set"}\n\n`;

    // ✅ Fix: ประกาศ testUrl ไว้ก่อน if block เพื่อให้เรียกใช้ได้ทั้งในและนอก block
    let testUrl = "";
    if (startDate && endDate) {
      message += `📡 ทดสอบดึงข้อมูล...\n\n`;
      ss.toast("📡 Testing API...", "MLSTMS Trips", 5);

      testUrl = `${config.baseUrl}/v1/trips?startDate=${startDate}&endDate=${endDate}&limit=5`;
      message += `Test URL:\n${testUrl}\n\n`;

      const options = {
        method: "get",
        headers: { Authorization: `Bearer ${token}` },
        muteHttpExceptions: true,
      };

      const response = UrlFetchApp.fetch(testUrl, options);
      const responseCode = response.getResponseCode();

      if (responseCode === 200) {
        const result = JSON.parse(response.getContentText());
        const trips =
          result.data?.trips || result.data || result.trips || result || [];

        message += `✅ API Response: ${responseCode}\n`;
        message += `📊 Trips found: ${trips.length}\n\n`;

        if (trips.length > 0) {
          message += `📋 ตัวอย่าง Trip แรกที่:\n`;
          const sample = trips[0];
          const dateFields = [
            "openDateTime",
            "tripOpenDateTime",
            "createdAt",
            "created_at",
            "closeDateTime",
            "tripCloseDateTime",
          ];

          dateFields.forEach((field) => {
            const value = sample[field] || sample.trip?.[field] || "-";
            message += `   ${field}: ${value}\n`;
          });
        } else {
          message += `⚠️ ไม่พบ trips ในช่วงวันที่ที่เลือก!\n`;
          message += `   ลองเช็คว่าที่ trip มี field ไหนที่ใช้ filter\n`;
        }
      } else {
        message += `❌ API Error: ${responseCode}\n`;
        message += `Response: ${response.getContentText().substring(0, 200)}...\n`;
      }
    }

    message += `\n💡 หมายเหตุ:\n`;
    message += `• API อาจ filter โดยใช้ startDate/endDate แบบวันที่เท่านา (YYYY-MM-DD)\n`;
    message += `• หรืออาจ filter โดย field อื่น เช่น openDateTime\n`;
    message += `• ลองดูที่ Debug Log สำหรับรายละเอียด`;

    ui.alert("🔬 Date Filter Debug", message, ui.ButtonSet.OK);

    // Log ไป Debug Log ด้วย
    let debugSheet = ss.getSheetByName("Debug Log");
    if (!debugSheet) {
      debugSheet = ss.insertSheet("Debug Log");
    }

    const lastRow = debugSheet.getLastRow() + 1;
    debugSheet.getRange(lastRow, 1).setValue(new Date().toISOString());
    debugSheet.getRange(lastRow, 2).setValue("Date Filter Test");
    debugSheet
      .getRange(lastRow, 3)
      .setValue(`Start: ${startDateTime || "N/A"}`);
    debugSheet.getRange(lastRow, 4).setValue(`End: ${endDateTime || "N/A"}`);
    debugSheet.getRange(lastRow, 5).setValue(`URL: ${testUrl || "N/A"}`);

    smartLog(`🔬 Debug: ${message.replace(/\n/g, " | ")}`, "NORMAL");
  } catch (error) {
    ui.alert("❌ Debug Error", `Error:\n\n${error.message}`, ui.ButtonSet.OK);
  }
}

/**
 * ดูค่า Config ปัจจุบัน
 */
function viewConfig() {
  const config = getConfig();
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  Logger.log("Current Configuration:");
  Logger.log(JSON.stringify(config, null, 2));

  // Create user-friendly message
  let message = "⚙️ Current Configuration:\n\n";
  message += `🔒 Username: ${config.username} (hardcoded)\n`;
  message += `🔑 Password: ${config.password ? "*** Set ***" : "Not set"}\n\n`;

  message += `📡 API URL: ${config.baseUrl}\n\n`;

  message += `📋 Query Parameters:\n`;
  message += `   Status ID: ${config.statusId || "All"}\n`;
  message += `   Start Date: ${config.startDate || "Not set"}\n`;
  message += `   End Date: ${config.endDate || "Not set"}\n`;
  message += `   Limit: ${config.limit}\n\n`;

  message += `📁 Sheets:\n`;
  message += `   Trips Sheet: "${config.tripsSheetName}"\n`;
  message += `   Details Sheet: "${config.tripDetailsSheetName}"\n\n`;

  message += `⚡ Performance:\n`;
  message += `   Rate Limit: ${config.rateLimitMs}ms`;
  if (config.fastMode) {
    message += ` (FAST MODE enabled)`;
  }
  message += "\n\n";

  message += `💡 Duplicate Check: Enabled (updates existing trips, inserts new ones)`;

  ui.alert("Configuration", message, ui.ButtonSet.OK);

  return config;
}

/**
 * สร้างเมนูใน Google Sheets
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const hasCreds = hasSavedCredentials();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ตรวจสอบ batch state
  const batchState = loadBatchState();
  const hasBatchState = !!batchState;

  // ตรวจสอบว่ามี Sheets ที่กำหนดหรือยัง
  const config = getConfig();
  const hasTripsSheet = ss.getSheetByName(config.tripsSheetName);
  const hasDetailsSheet = ss.getSheetByName(config.tripDetailsSheetName);

  // ═══════════════════════════════════════════════════════════════
  // 📋 สร้างเมนูหลัก
  // ═══════════════════════════════════════════════════════════════
  const menu = ui.createMenu("🚚 MLSTMS Trips");

  // ═══════════════════════════════════════════════════════════════
  // 🔐 ส่วนที่ 1: Login (ถ้ายังไม่ login)
  // ═══════════════════════════════════════════════════════════════
  if (!hasCreds) {
    menu.addItem("🔐 Login & Pull Data", "showLoginDialog").addSeparator();
  }

  // ═══════════════════════════════════════════════════════════════
  // 📥 ส่วนที่ 2: ดึงข้อมูล (Pull Data) - ถ้า login แล้ว
  // ═══════════════════════════════════════════════════════════════
  if (hasCreds) {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 💡 Smart Advisor - ที่ปรึกษาอัจฉริยะ
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    menu
      .addItem(
        "💡 Smart Advisor (แนะนำวิธีดึงข้อมูล)",
        "showSmartAdvisorDialog",
      )
      .addSeparator();

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🔄 Pull Mode (โหมดดึงข้อมูล)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    menu.addSubMenu(
      ui
        .createMenu("🔄 Pull Mode (โหมดดึงข้อมูล)")
        .addItem(
          "🔄 Fresh Start (เริ่มใหม่ - ล้างข้อมูลเก่า)",
          "showPullModeFreshDialog",
        )
        .addItem(
          "➕ Append (เพิ่ม - เก็บข้อมูลเดิม)",
          "showPullModeAppendDialog",
        ),
    );

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🔄 Background Triggers (รัน Background)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    menu
      .addSeparator()
      .addItem(
        "⏰ Automated Scheduler (รันทุก นาที/ชั่วโมง/วัน)",
        "showAutomatedSchedulerDialog",
      )
      .addItem(
        "🔄 Background Triggers (ดู/ลบ Trigger)",
        "viewBackgroundTriggers",
      )

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 📥 ดึงข้อมูล (Pull Data)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    menu
      .addSeparator()
      .addItem(
        "📊 Pull with Actual Count (ดูจำนวนจริง)",
        "showPullWithEstimateDialog",
      )
      .addItem("📅 Pull Today's Data (ดึงวันนี้)", "pullTodayData")
      .addSeparator()
      .addItem("⚡ Fast Pull All (ดึงทั้งหมดเร็วๆ)", "fastPullAll")
      .addItem("📥 Quick Pull (เลือกจำนวน)", "showQuickPullDialog")
      .addSeparator();

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 📦 2-Phase Pull (แยกดึง Trip IDs และ Trip Details)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    menu.addSubMenu(
      ui
        .createMenu("📦 2-Phase Pull (แยก Trip IDs & Details)")
        .addItem("📦 Phase 1: Pull Trip IDs (เร็ว)", "showPullTripIdsDialog")
        .addItem("📦 Phase 2: Pull Trip Details", "showPullTripDetailsDialog")
        .addItem("♻️ Phase 2 Resume (ดึงต่อ)", "pullTripDetailsResume"),
    );

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🚀 Batch Pull
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    menu.addItem(
      "🚀 Batch Pull (ดึงทั้งหมดแบบแบ่ง batch)",
      "showBatchPullDialog",
    );

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ♻️ ดำเนินการต่อ (Resume) - แสดงเฉพาะถ้ามี batch ค้างอยู่
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (hasBatchState) {
      menu.addItem(
        "♻️ Resume Batch Pull (ทำต่อ)",
        "pullTripsToSheetBatchResume",
      );
    }

    menu
      .addSeparator()
      .addItem("🔐 Update Login (อัปเดต login)", "showLoginDialog")
      .addSeparator();
  }

  // ═══════════════════════════════════════════════════════════════
  // 🗑️ ส่วนที่ 2.5: Batch State Management (ใหม่!)
  // ═══════════════════════════════════════════════════════════════
  if (hasBatchState) {
    menu
      .addSubMenu(
        ui
          .createMenu("🗑️ Batch State Management")
          .addItem("📊 View Batch State (ดูสถานะ)", "viewBatchState")
          .addItem(
            "🗑️ Clear Batch State (ลบ state เริ่มใหม่)",
            "clearBatchStateWithUI",
          )
          .addItem(
            "🗑️ Clear Background Triggers (ลบ Trigger)",
            "clearBackgroundTriggersWithUI",
          ),
      )
      .addSeparator();
  }

  // ═══════════════════════════════════════════════════════════════
  // ⚙️ ส่วนที่ 3: ตั้งค่าระบบ (Settings)
  // ═══════════════════════════════════════════════════════════════
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ⚡ Performance Settings
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  menu
    .addItem("⚡ Set Performance Mode", "setPerformanceMode")
    .addItem("⚡ Toggle Fast Mode", "toggleFastMode")
    .addItem("⏱️ Set Rate Limit", "setRateLimit")
    .addSeparator();

  // ═══════════════════════════════════════════════════════════════
  // 🔍 ส่วนที่ 4: ทดสอบระบบ (Test & Diagnostics)
  // ═══════════════════════════════════════════════════════════════
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔍 ทดสอบการเชื่อมต่อ
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  menu
    .addItem("🔍 Test API Connection", "testConnection")
    .addItem("📊 Estimate Trip Count", "estimateTripCountWithUI")
    .addSeparator();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🐛 Debug Tools
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  menu
    .addSubMenu(
      ui
        .createMenu("🐛 Debug Tools")
        .addItem("📅 Debug Date Fields", "debugDateFields")
        .addItem("🔬 Debug Date Filtering", "debugDateFiltering")
        .addItem("🐛 Debug API Response", "debugApiResponse")
        .addItem("🔬 Debug Trip Details", "debugTripDetails")
        .addItem("🧪 Test Trip ID Extraction", "testTripIdExtraction"),
    )
    .addSeparator();

  // ═══════════════════════════════════════════════════════════════
  // 🛠️ ส่วนที่ 5: การจัดการ (Management)
  // ═══════════════════════════════════════════════════════════════
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 📊 สถานะระบบ
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  menu.addItem("📝 Check Sheets Status", "checkSheetsStatus").addSeparator();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ⚙️ Configuration
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  menu
    .addItem("⚙️ Initial Setup", "setupConfig")
    .addItem("👁️ View Config", "viewConfig")
    .addSeparator()
    .addItem("🔄 Reset All State (ลบทุกอย่าง)", "resetAllState")
    .addItem("🗑️ Clear Credentials", "clearCredentials")
    .addToUi();

  // ═══════════════════════════════════════════════════════════════
  // 🔔 การแจ้งเตือน (Notifications)
  // ═══════════════════════════════════════════════════════════════

  // แสดง toast เตือนถ้ามี batch state ค้างอยู่
  if (hasBatchState) {
    Utilities.sleep(1000);
    ss.toast(
      `♻️ Batch paused: ${batchState.processedCount}/${batchState.totalCount || "?"} trips`,
      "MLSTMS Trips",
      10,
    );
  }

  // แสดง toast เตือนถ้ายังไม่มี sheets
  if (!hasTripsSheet || !hasDetailsSheet) {
    const missing = [];
    if (!hasTripsSheet) missing.push(`"${config.tripsSheetName}"`);
    if (!hasDetailsSheet) missing.push(`"${config.tripDetailsSheetName}"`);

    // แสดงเตือนเฉพาะครั้งแรกที่เปิด
    const lastWarning = PropertiesService.getUserProperties().getProperty(
      "LAST_SHEETS_WARNING",
    );
    const today = new Date().toDateString();

    if (lastWarning !== today) {
      Utilities.sleep(1000); // รอให้ UI โหลดเสร็จ
      ss.toast(
        `ℹ️ Sheets will be created on first run: ${missing.join(", ")}`,
        "MLSTMS Trips",
        10,
      );
      PropertiesService.getUserProperties().setProperty(
        "LAST_SHEETS_WARNING",
        today,
      );
    }
  }
}

/**
 * ตรวจสอบสถานะ Sheets
 */
function checkSheetsStatus() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const config = getConfig();

  const tripsSheet = ss.getSheetByName(config.tripsSheetName);
  const detailsSheet = ss.getSheetByName(config.tripDetailsSheetName);

  let message = "📊 Sheets Status:\n\n";

  if (tripsSheet) {
    const rows = tripsSheet.getLastRow() - 1; // ลบ header ออก
    message += `✅ "${config.tripsSheetName}": ${rows} rows\n`;
  } else {
    message += `⚠️ "${config.tripsSheetName}": Not created yet\n`;
  }

  if (detailsSheet) {
    const rows = detailsSheet.getLastRow() - 1; // ลบ header ออก
    message += `✅ "${config.tripDetailsSheetName}": ${rows} rows\n`;
  } else {
    message += `⚠️ "${config.tripDetailsSheetName}": Not created yet\n`;
  }

  message += "\nSheets will be created automatically on first run.";

  ui.alert("Sheets Status", message, ui.ButtonSet.OK);
}

/**
 * เคลียร์ Credentials ทั้งหมด
 */
function clearCredentials() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  const result = ui.alert(
    "⚠️ Confirm Clear Credentials",
    "Are you sure you want to clear all saved credentials? You will need to login again.",
    ui.ButtonSet.YES_NO,
  );

  if (result === ui.Button.YES) {
    const scriptProperties = PropertiesService.getScriptProperties();
    scriptProperties.deleteProperty("USERNAME");
    scriptProperties.deleteProperty("PASSWORD");
    scriptProperties.deleteProperty("ACCESS_TOKEN");
    scriptProperties.deleteProperty("REFRESH_TOKEN");
    scriptProperties.deleteProperty("TOKEN_EXPIRES_AT");

    ss.toast("✅ All credentials cleared", "MLSTMS Trips", 5);
    Logger.log("✅ All credentials cleared");

    ui.alert(
      "✅ Cleared",
      "All credentials have been cleared successfully.",
      ui.ButtonSet.OK,
    );
  }
}

// ============================================
// NEW: PULL WITH ESTIMATE - ดึงข้อมูลพร้อมแสดงจำนวนก่อน
// ============================================

/**
 * 📊 แสดง Dialog สำหรับดึงข้อมูลพร้อมแสดงจำนวน Trip IDs ก่อน
 */
function showPullWithEstimateDialog() {
  const scriptProperties = PropertiesService.getScriptProperties();

  // ตรวจสอบ credentials
  const savedUsername = scriptProperties.getProperty("USERNAME") || "";
  const hasSavedCreds =
    savedUsername && scriptProperties.getProperty("PASSWORD");

  if (!hasSavedCreds) {
    SpreadsheetApp.getUi().alert(
      "⚠️ ต้อง Login ก่อน",
      "กรุณา Login ก่อนดึงข้อมูล\n\nใช้เมนู: 🔐 Login & Pull Data",
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
    return;
  }

  // ดึงค่าที่บันทึกไว้
  const savedStartDate = scriptProperties.getProperty("START_DATE") || "";
  const savedEndDate = scriptProperties.getProperty("END_DATE") || "";
  const savedStatusId = scriptProperties.getProperty("STATUS_ID") || "";

  // คำนวณวันนี้
  const today = new Date();
  const todayStr = Utilities.formatDate(
    today,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd",
  );

  const html = HtmlService.createHtmlOutput(
    `
    <!DOCTYPE html>
    <html>
    <head>
      <base target="_top">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          max-width: 500px;
          margin: 0 auto;
          background: white;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h2 {
          color: #4285F4;
          margin-top: 0;
          margin-bottom: 10px;
          text-align: center;
        }
        .subtitle {
          text-align: center;
          color: #666;
          font-size: 13px;
          margin-bottom: 20px;
        }
        .step {
          background: #f8f9fa;
          border-left: 4px solid #4285F4;
          padding: 15px;
          margin-bottom: 20px;
          border-radius: 4px;
        }
        .step-number {
          display: inline-block;
          background: #4285F4;
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          text-align: center;
          line-height: 24px;
          font-weight: bold;
          margin-right: 10px;
        }
        .quick-options {
          display: flex;
          gap: 8px;
          margin-bottom: 15px;
        }
        .quick-btn {
          flex: 1;
          padding: 10px;
          border: 2px solid #ddd;
          border-radius: 6px;
          background: white;
          cursor: pointer;
          text-align: center;
          font-size: 12px;
          transition: all 0.3s;
        }
        .quick-btn:hover {
          border-color: #4285F4;
          background: #e8f0fe;
        }
        .form-group {
          margin-bottom: 15px;
        }
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
          color: #333;
          font-size: 13px;
        }
        input[type="text"],
        input[type="date"] {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          box-sizing: border-box;
        }
        input:focus {
          outline: none;
          border-color: #4285F4;
        }
        .btn-group {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }
        button {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.3s;
        }
        .btn-primary {
          background: #4285F4;
          color: white;
        }
        .btn-primary:hover {
          background: #3367D6;
        }
        .btn-secondary {
          background: #f1f3f4;
          color: #333;
        }
        .btn-secondary:hover {
          background: #e8eaed;
        }
        .btn-success {
          background: #34A853;
          color: white;
        }
        .btn-success:hover {
          background: #2D9249;
        }
        .result-box {
          display: none;
          margin-top: 20px;
          padding: 20px;
          background: #e8f5e9;
          border-radius: 8px;
          border: 2px solid #4caf50;
        }
        .result-box.show {
          display: block;
        }
        .result-box h3 {
          margin-top: 0;
          color: #2e7d32;
          font-size: 18px;
        }
        .result-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #c8e6c9;
        }
        .result-item:last-child {
          border-bottom: none;
        }
        .result-label {
          font-weight: 500;
          color: #2e7d32;
        }
        .result-value {
          font-size: 18px;
          font-weight: bold;
          color: #1b5e20;
        }
        .loading {
          display: none;
          text-align: center;
          padding: 20px;
        }
        .loading.show {
          display: block;
        }
        .spinner {
          border: 3px solid #f3f3f3;
          border-top: 3px solid #4285F4;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 0 auto 10px;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .warning {
          background: #fff3e0;
          border-left: 4px solid #ff9800;
          padding: 12px;
          margin-bottom: 15px;
          border-radius: 4px;
          font-size: 12px;
          color: #e65100;
        }
        .info {
          background: #e3f2fd;
          border-left: 4px solid #2196f3;
          padding: 12px;
          margin-top: 15px;
          border-radius: 4px;
          font-size: 12px;
          color: #1565c0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>📊 ดึงข้อมูล Trips</h2>
        <div class="subtitle">เลือกช่วงเวลา → นับจำนวนจริง → ยืนยันดึงข้อมูล</div>

        <!-- Step 1: เลือกช่วงเวลา -->
        <div class="step" id="step1">
          <span class="step-number">1</span>
          <strong>เลือกช่วงเวลา</strong>
        </div>

        <div class="quick-options">
          <div class="quick-btn" onclick="setToday()">📅 วันนี้</div>
          <div class="quick-btn" onclick="setYesterday()">📅 เมื่อวาน</div>
          <div class="quick-btn" onclick="setThisWeek()">📅 อาทิตย์นี้</div>
          <div class="quick-btn" onclick="setThisMonth()">📅 เดือนนี้</div>
        </div>

        <form id="estimateForm" onsubmit="handleEstimate(event)">
          <div class="form-group">
            <label for="startDate">📅 จากวันที่:</label>
            <input type="date" id="startDate" name="startDate" value="${savedStartDate || todayStr}" required>
          </div>

          <div class="form-group">
            <label for="endDate">📅 ถึงวันที่:</label>
            <input type="date" id="endDate" name="endDate" value="${savedEndDate || todayStr}" required>
          </div>

          <div class="form-group">
            <label for="statusId">🔍 Status ID (optional):</label>
            <input type="text" id="statusId" name="statusId" placeholder="ว่างเปล่า = ทุกสถานะ" value="${savedStatusId}">
          </div>

          <div class="info">
            💡 <strong>หมายเหตุ:</strong><br>
            • ข้อมูลจะดึงตั้งแต่ 00:00 ถึง 23:59 ของวันที่เลือก<br>
            • กด "ดูจำนวน Trip IDs จริง" เพื่อนับจำนวน Trip IDs ทั้งหมด (จริง)<br>
            • ระบบจะดึงข้อมูลทุกหน้าเพื่อนับจำนวนแม่นยำ
          </div>

          <div class="btn-group">
            <button type="submit" class="btn-primary">🔍 ดูจำนวน Trip IDs จริง</button>
            <button type="button" class="btn-secondary" onclick="google.script.host.close()">ยกเลิก</button>
          </div>
        </form>

        <!-- Loading -->
        <div class="loading" id="loading">
          <div class="spinner"></div>
          <div style="color: #666;">กำลังนับจำนวน Trip IDs จริง...</div>
        </div>

        <!-- Step 2 & 3: แสดงผลและยืนยัน -->
        <div class="result-box" id="resultBox">
          <h3 id="resultTitle">✅ พบข้อมูล!</h3>

          <div class="result-item">
            <span class="result-label">ช่วงเวลา:</span>
            <span class="result-value" id="resultPeriod">-</span>
          </div>
          <div class="result-item">
            <span class="result-label">จำนวน Trip IDs (จริง):</span>
            <span class="result-value" id="resultCount">-</span>
          </div>
          <div class="result-item">
            <span class="result-label">เวลาที่คาดว่าจะใช้:</span>
            <span class="result-value" id="resultTime">-</span>
          </div>

          <!-- 💡 คำแนะนำอัจฉริยะ -->
          <div id="recommendationBox" style="margin-top: 20px; padding: 15px; border-radius: 8px; border-left: 4px solid #4caf50; background: #f1f8e9;">
            <div style="font-weight: bold; color: #2e7d32; margin-bottom: 10px; font-size: 15px;">
              <span id="recommendationEmoji">💡</span> คำแนะนำ:
            </div>
            <div style="margin-bottom: 8px;">
              <strong style="color: #1b5e20;">วิธีที่แนะนำ:</strong>
              <span id="recommendationMethod" style="color: #2e7d32;">-</span>
            </div>
            <div style="margin-bottom: 8px;">
              <strong style="color: #1b5e20;">เหตุผล:</strong>
              <span id="recommendationReason" style="color: #555;">-</span>
            </div>
            <div style="margin-bottom: 8px;">
              <strong style="color: #1b5e20;">Performance Mode:</strong>
              <span id="recommendationPerformance" style="background: #fff; padding: 3px 8px; border-radius: 4px; font-weight: bold;">-</span>
            </div>
            <div style="margin-top: 10px;">
              <strong style="color: #1b5e20;">💡 เคล็ดลับ:</strong>
              <ul id="recommendationTips" style="margin: 5px 0; padding-left: 20px; color: #555; font-size: 12px;">
              </ul>
            </div>
          </div>

          <div class="btn-group">
            <button type="button" class="btn-success" onclick="confirmPull()">✅ ยืนยันดึงข้อมูล</button>
            <button type="button" class="btn-secondary" onclick="resetForm()">← กลับเลือกใหม่</button>
          </div>
        </div>
      </div>

      <script>
        let currentEstimate = null;

        function setToday() {
          const today = new Date().toISOString().split('T')[0];
          document.getElementById('startDate').value = today;
          document.getElementById('endDate').value = today;
        }

        function setYesterday() {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const dateStr = yesterday.toISOString().split('T')[0];
          document.getElementById('startDate').value = dateStr;
          document.getElementById('endDate').value = dateStr;
        }

        function setThisWeek() {
          const today = new Date();
          const dayOfWeek = today.getDay();
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - dayOfWeek);

          const startDateStr = startOfWeek.toISOString().split('T')[0];
          const endDateStr = today.toISOString().split('T')[0];

          document.getElementById('startDate').value = startDateStr;
          document.getElementById('endDate').value = endDateStr;
        }

        function setThisMonth() {
          const today = new Date();
          const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

          const startDateStr = startOfMonth.toISOString().split('T')[0];
          const endDateStr = today.toISOString().split('T')[0];

          document.getElementById('startDate').value = startDateStr;
          document.getElementById('endDate').value = endDateStr;
        }

        function handleEstimate(event) {
          event.preventDefault();

          const startDate = document.getElementById('startDate').value;
          const endDate = document.getElementById('endDate').value;
          const statusId = document.getElementById('statusId').value;

          // แสดง loading
          document.getElementById('loading').classList.add('show');
          document.getElementById('resultBox').classList.remove('show');

          google.script.run
            .withSuccessHandler(function(result) {
              document.getElementById('loading').classList.remove('show');

              if (result.success) {
                currentEstimate = result.data;

                // แสดงผล
                document.getElementById('resultPeriod').textContent = result.data.periodText;
                document.getElementById('resultCount').textContent = result.data.totalCount + ' รายการ';
                document.getElementById('resultTime').textContent = result.data.estimatedTime;

                // 💡 แสดงคำแนะนำ (Smart Recommendation)
                const rec = result.data.recommendation;
                document.getElementById('resultTitle').textContent = rec.emoji + ' ' +
                  (rec.tripCount === 0 ? 'ไม่พบข้อมูล' : 'พบข้อมูล!');

                document.getElementById('recommendationEmoji').textContent = rec.emoji;
                document.getElementById('recommendationMethod').textContent = rec.method;
                document.getElementById('recommendationReason').textContent = rec.reason;
                document.getElementById('recommendationPerformance').textContent = rec.performanceMode;
                document.getElementById('recommendationPerformance').style.background = rec.color;
                document.getElementById('recommendationPerformance').style.color = '#fff';

                // แสดง tips
                const tipsList = document.getElementById('recommendationTips');
                tipsList.innerHTML = '';
                rec.tips.forEach(function(tip) {
                  const li = document.createElement('li');
                  li.textContent = tip;
                  tipsList.appendChild(li);
                });

                // ปรับสี recommendation box
                document.getElementById('recommendationBox').style.borderLeftColor = rec.color;
                document.getElementById('recommendationBox').style.background =
                  rec.color === '#f44336' ? '#ffebee' : '#f1f8e9';

                // แสดง result box
                document.getElementById('resultBox').classList.add('show');

                // ซ่อน form
                document.getElementById('estimateForm').style.display = 'none';
              } else {
                alert('❌ ' + result.message);
              }
            })
            .withFailureHandler(function(error) {
              document.getElementById('loading').classList.remove('show');
              alert('❌ Error: ' + error.message);
            })
            .estimateTripsForPeriod(startDate, endDate, statusId);
        }

        function confirmPull() {
          if (!currentEstimate) {
            alert('❌ ไม่พบข้อมูล estimate');
            return;
          }

          const confirmed = confirm(
            'ยืนยันดึงข้อมูล ' + currentEstimate.totalCount + ' รายการ?\\n\\n' +
            'ช่วงเวลา: ' + currentEstimate.periodText + '\\n' +
            'เวลาโดยประมาณ: ' + currentEstimate.estimatedTime
          );

          if (confirmed) {
            google.script.run
              .withSuccessHandler(function(result) {
                if (result.success) {
                  alert('✅ ' + result.message);
                  google.script.host.close();
                } else {
                  alert('❌ ' + result.message);
                }
              })
              .withFailureHandler(function(error) {
                alert('❌ Error: ' + error.message);
              })
              .pullWithEstimate(
                currentEstimate.startDate,
                currentEstimate.endDate,
                currentEstimate.statusId
              );
          }
        }

        function resetForm() {
          document.getElementById('resultBox').classList.remove('show');
          document.getElementById('estimateForm').style.display = 'block';
          currentEstimate = null;
        }
      </script>
    </body>
    </html>
  `,
  )
    .setWidth(520)
    .setHeight(650)
    .setTitle("📊 ดึงข้อมูล Trips (นับจำนวนจริง)");

  SpreadsheetApp.getUi().showModalDialog(
    html,
    "ดึงข้อมูล Trips (นับจำนวนจริง)",
  );
}

/**
 * ประมาณจำนวน Trips ในช่วงเวลาที่เลือก
 * @param {string} startDate - วันที่เริ่ม (YYYY-MM-DD)
 * @param {string} endDate - วันที่สิ้นสุด (YYYY-MM-DD)
 * @param {string} statusId - Status ID (optional)
 * @returns {object} - { success: boolean, data: object, message: string }
 */
function estimateTripsForPeriod(startDate, endDate, statusId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  try {
    // บันทึกค่าที่เลือก
    const scriptProperties = PropertiesService.getScriptProperties();
    scriptProperties.setProperty("START_DATE", startDate);
    scriptProperties.setProperty("END_DATE", endDate);
    scriptProperties.setProperty("STATUS_ID", statusId || "");

    // Login
    const token = login();
    if (!token) {
      return {
        success: false,
        message: "Login failed กรุณาลองใหม่",
      };
    }

    ss.toast("🔍 กำลังนับจำนวน Trip IDs จริง...", "MLSTMS Trips", 5);

    // ✅ ถ้าไม่ระบุ statusId ให้นับจาก Status ID 1-5 เท่านั้น
    if (!statusId) {
      Logger.log(`🔄 No statusId specified - counting from statuses 1-5...`);

      const STATUS_IDS = [1, 2, 3, 4, 5]; // ✅ ใช้เฉพาะ Status ID 1-5
      let totalCount = 0;
      const statusCounts = {};

      for (const sid of STATUS_IDS) {
        try {
          const count = countTripsForStatusId(sid, startDate, endDate);

          // ✅ ถ้าไม่พบข้อมูล ให้ข้ามไป Status ถัดไปเลย
          if (count === 0) {
            Logger.log(
              `   ⏭️  Status ${sid}: No data found - skipping to next status`,
            );
            statusCounts[sid] = 0;
            continue; // ข้ามไป Status ถัดไป
          }

          totalCount += count;
          statusCounts[sid] = count;
          Logger.log(
            `   ✅ Status ${sid}: ${count} trips (total: ${totalCount})`,
          );

          // ⚠️ Rate limiting between status IDs - เพิ่มเพื่อหลีด 429
          Utilities.sleep(2000); // เพิ่มจาก 1000ms → 2000ms (2 วินาที) เพื่อหลีด 429
        } catch (error) {
          Logger.log(`   ⚠️ Error counting status ${sid}: ${error.message}`);
          statusCounts[sid] = 0;
        }
      }

      Logger.log(`✅ Count complete: ${totalCount} trips from statuses 1-5`);
      Logger.log(`📊 Breakdown by status: ${JSON.stringify(statusCounts)}`);

      // สร้าง mock response สำหรับ processEstimateResult
      const mockResponse = {
        pagination: {
          hasNextPage: false,
          recordsReturned: totalCount,
        },
      };

      return processEstimateResult(mockResponse, startDate, endDate, "");
    }

    // ✅ ถ้าระบุ statusId ให้นับเฉพาะ statusId นั้น
    const count = countTripsForStatusId(statusId, startDate, endDate);
    Logger.log(`✅ Count complete for statusId ${statusId}: ${count} trips`);

    const mockResponse = {
      pagination: {
        hasNextPage: false,
        recordsReturned: count,
      },
    };

    return processEstimateResult(mockResponse, startDate, endDate, statusId);
  } catch (error) {
    Logger.log(`❌ Estimate error: ${error.message}`);
    return {
      success: false,
      message: `Error: ${error.message}`,
    };
  }
}

/**
 * นับจำนวน Trips สำหรับ Status ID ที่ระบุ
 * ✅ กรองด้วย openDateTime (client-side filtering) เพื่อความแม่นยำ
 * @param {string} statusId - Status ID ที่ต้องการนับ
 * @param {string} startDate - วันที่เริ่ม (YYYY-MM-DD)
 * @param {string} endDate - วันที่สิ้นสุด (YYYY-MM-DD)
 * @returns {number} - จำนวน trips ที่ผ่านการ filter
 */
function countTripsForStatusId(statusId, startDate, endDate) {
  const config = getConfig();
  const token = getAccessToken();
  const timezone = Session.getScriptTimeZone();

  // สร้างวันที่สำหรับ filtering (ISO 8601 format)
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59`);
  const startDateTime = formatDateTimeWithTimezone(start, timezone);
  const endDateTime = formatDateTimeWithTimezone(end, timezone);

  let allTrips = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;
  let pageCount = 0;

  Logger.log(
    `🔍 Counting statusId=${statusId} with openDateTime filter: ${startDateTime} to ${endDateTime}`,
  );

  while (hasMore) {
    pageCount++;
    // ✅ ส่ง startDate/endDate ไปกับ API - API รองรับจริง!
    const params = [
      `statusId=${statusId}`,
      `startDate=${startDate}`, // ✅ ส่งไปให้ API filter
      `endDate=${endDate}`, // ✅ ส่งไปให้ API filter
      `limit=${limit}`,
      `offset=${offset}`,
    ];
    const url = `${config.baseUrl}/v1/trips?${params.join("&")}`;

    const options = {
      method: "get",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 401) {
      const newToken = refreshToken();
      options.headers.Authorization = `Bearer ${newToken}`;
      continue;
    }

    if (responseCode !== 200) {
      Logger.log(`❌ API Error: ${responseCode}`);
      hasMore = false;
      break;
    }

    const result = JSON.parse(response.getContentText());

    let tripsInPage = [];
    if (result && result.data && Array.isArray(result.data.trips)) {
      tripsInPage = result.data.trips;
    } else if (result && result.data && Array.isArray(result.data)) {
      tripsInPage = result.data;
    } else if (result && Array.isArray(result)) {
      tripsInPage = result;
    }

    // ✅ Debug: Log sample date values from first page
    if (pageCount === 1 && tripsInPage.length > 0) {
      const sampleSize = Math.min(3, tripsInPage.length);
      Logger.log(`   🔍 Sample dates (first ${sampleSize} trips):`);
      for (let i = 0; i < sampleSize; i++) {
        const sampleTrip = tripsInPage[i];
        const openDateTime = getTripField(sampleTrip, [
          "openDateTime",
          "tripOpenDateTime",
          "createdAt",
          "created_at",
        ]);
        const tripDate = parseISODateTime(openDateTime);
        Logger.log(
          `      [${i + 1}] openDateTime="${openDateTime}" → parsed=${tripDate ? tripDate.toISOString() : "NULL"}, inRange=${tripDate && tripDate >= start && tripDate <= end}`,
        );
      }
    }

    // ✅ Client-side filtering: กรองด้วย openDateTime
    const filteredInPage = tripsInPage.filter((trip) => {
      const openDateTime = getTripField(trip, [
        "openDateTime",
        "tripOpenDateTime",
        "createdAt",
        "created_at",
      ]);
      if (!openDateTime) return false;

      const tripDate = parseISODateTime(openDateTime);
      if (!tripDate) return false;

      return tripDate >= start && tripDate <= end;
    });

    allTrips = allTrips.concat(filteredInPage);
    Logger.log(
      `   📄 Page ${pageCount}: ${tripsInPage.length} raw trips → ${filteredInPage.length} filtered (total: ${allTrips.length})`,
    );

    if (result && result.pagination) {
      hasMore = result.pagination.hasNextPage;
    } else {
      hasMore = tripsInPage.length === limit;
    }

    if (tripsInPage.length === 0) {
      hasMore = false;
    }

    offset += limit;

    // ⚠️ Rate limiting between pages - เพิ่มเพื่อหลีด 429
    Utilities.sleep(1000); // เพิ่มจาก 500ms → 1000ms (1 วินาที) ระหว่างแต่ละ page เพื่อหลีด 429
  }

  Logger.log(`✅ Status ${statusId}: ${allTrips.length} trips after filtering`);
  return allTrips.length;
}

/**
 * ประมาณผลลัพธ์จาก API response
 */
function processEstimateResult(apiResponse, startDate, endDate, statusId) {
  let totalCount = 0;

  // ✅ FIX: รองรับ API ที่ใช้ pagination.hasNextPage
  if (apiResponse && apiResponse.pagination) {
    const hasNextPage = apiResponse.pagination.hasNextPage;
    const recordsReturned = apiResponse.pagination.recordsReturned || 0;

    if (!hasNextPage) {
      // ไม่มีหน้าถัดไป = มีข้อมูลทั้งหมดในหน้านี้
      totalCount = recordsReturned;
    } else {
      // มีหน้าถัดไป = ใช้ค่าประมาณ
      totalCount = recordsReturned * 2;
    }
  }
  // Fallback: ตรวจสอบ structure แบบเก่า
  else if (apiResponse && apiResponse.data) {
    if (apiResponse.data.totalCount !== undefined) {
      totalCount = apiResponse.data.totalCount;
    } else if (apiResponse.data.count !== undefined) {
      totalCount = apiResponse.data.count;
    }
  }

  // คำนวณเวลาโดยประมาณ
  const config = getConfig();
  const rateLimitMs = config.fastMode
    ? 0
    : config.adaptiveRateLimit
      ? config.minRateLimitMs
      : config.rateLimitMs;
  const avgRequestTimeMs = 500;
  const timePerTrip = (rateLimitMs + avgRequestTimeMs) / 1000; // วินาทีต่อ trip
  const estimateSeconds = totalCount * timePerTrip;

  let estimatedTime;
  if (estimateSeconds < 60) {
    estimatedTime = Math.round(estimateSeconds) + " วินาที";
  } else {
    const minutes = Math.ceil(estimateSeconds / 60);
    estimatedTime = "~" + minutes + " นาที";
  }

  // สร้างข้อความช่วงเวลา
  const periodText = `${startDate} ถึง ${endDate}`;

  // 💡 สร้างคำแนะนำ (Recommendation)
  const recommendation = getRecommendation(totalCount, estimateSeconds);

  return {
    success: true,
    data: {
      totalCount: totalCount,
      periodText: periodText,
      estimatedTime: estimatedTime,
      startDate: startDate,
      endDate: endDate,
      statusId: statusId,
      estimateSeconds: estimateSeconds,
      recommendation: recommendation,
    },
  };
}

/**
 * 💡 คำนวณคำแนะนำ (Smart Recommendation Engine)
 * @param {number} tripCount - จำนวน trips
 * @param {number} estimateSeconds - เวลาโดยประมาณ (วินาที)
 * @returns {object} - คำแนะนำ
 */
function getRecommendation(tripCount, estimateSeconds) {
  let method = "";
  let reason = "";
  let performanceMode = "";
  let tips = [];
  let emoji = "";
  let color = "";

  // ตัดสินใจเลือกวิธี
  if (tripCount === 0) {
    emoji = "⚠️";
    color = "#ff9800";
    method = "ไม่พบข้อมูล";
    reason = "ไม่มี trips ในช่วงเวลาที่เลือก";
    performanceMode = "-";
    tips = [
      "ลองเปลี่ยนช่วงวันที่",
      "ตรวจสอบว่ามีข้อมูลจริงหรือไม่",
      "ใช้ Debug Date Fields เพื่อดูฟิลด์วันที่",
    ];
  } else if (tripCount <= 50) {
    emoji = "✅";
    color = "#4caf50";
    method = "Quick Pull (50 รายการ)";
    reason = "ข้อมูลน้อย ดึงทีเดียวได้เลย";
    performanceMode = "BALANCED";
    tips = [
      "ใช้ Quick Pull หรือ Pull with Estimate",
      "ไม่ต้องแบ่ง batch",
      "เสร็จภายใน 1 นาที",
    ];
  } else if (tripCount <= 200) {
    emoji = "⚡";
    color = "#2196f3";
    method = "Fast Pull All";
    reason = "ข้อมูลปานกลาง ดึงเร็วๆ ได้เลย";
    performanceMode = "BALANCED";
    tips = [
      "ใช้ Fast Pull All เพื่อความรวดเร็ว",
      "เสร็จภายใน 2-5 นาที",
      "ถ้า timeout ให้ใช้ Batch Pull แทน",
    ];
  } else if (tripCount <= 1000) {
    emoji = "🚀";
    color = "#ff9800";
    method = "Batch Pull (แบ่ง batch)";
    reason = "ข้อมูลค่อนข้างมาก ควรแบ่ง batch เพื่อความปลอดภัย";
    performanceMode = "BALANCED";
    tips = [
      "ใช้ Batch Pull เพื่อแบ่งดึงหลายครั้ง",
      "สามารถ Resume ได้ถ้าขัดจังหวะ",
      "เสร็จภายใน 5-15 นาที",
      "แนะนำให้เปิด Fast Mode ด้วย",
    ];
  } else {
    emoji = "🔥";
    color = "#f44336";
    method = "Batch Pull + Fast Mode";
    reason = "ข้อมูลมากมาย! ต้องใช้ Batch Pull และ Fast Mode";
    performanceMode = "TURBO";
    tips = [
      "⚠️ ต้องใช้ Batch Pull แบ่งหลาย batch",
      "⚡ เปิด Fast Mode และ Performance Mode = TURBO",
      "♻️ ใช้ Resume หากขัดจังหวะ",
      "⏱️ ใช้เวลา 15+ นาที",
      "💡 พิจารณาเลือกช่วงเวลาที่สั้นลง",
    ];
  }

  // เพิ่ม tips เกี่ยวกับ performance
  if (estimateSeconds > 300 && tripCount > 200) {
    tips.push("⚡ แนะนำ: Set Performance Mode → TURBO");
  }
  if (estimateSeconds > 600) {
    tips.push("⏰ แนะนำ: ใช้ค่ำ/วันที่ API ไม่หนาแจ้ง (off-peak hours)");
  }

  return {
    emoji: emoji,
    color: color,
    method: method,
    reason: reason,
    performanceMode: performanceMode,
    tips: tips,
    tripCount: tripCount,
    estimateMinutes: Math.ceil(estimateSeconds / 60),
  };
}

/**
 * ดึงข้อมูลหลังจาก estimate แล้ว
 * @param {string} startDate - วันที่เริ่ม
 * @param {string} endDate - วันที่สิ้นสุด
 * @param {string} statusId - Status ID
 */
function pullWithEstimate(startDate, endDate, statusId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  try {
    ss.toast("🚀 เริ่มดึงข้อมูล...", "MLSTMS Trips", 10);

    // Login
    const token = login();
    if (!token) {
      return {
        success: false,
        message: "Login failed",
      };
    }

    // เรียกใช้ batch pull (ปลอดภัยกว่าสำหรับข้อมูลจำนวนมาก)
    pullTripsToSheetBatch(false);

    return {
      success: true,
      message: "ดึงข้อมูลสำเร็จ! กำลังบันทึกลง Sheets...",
    };
  } catch (error) {
    Logger.log(`❌ Pull error: ${error.message}`);
    return {
      success: false,
      message: `เกิดข้อผิดพลาด: ${error.message}`,
    };
  }
}

// ============================================
// 💡 SMART ADVISOR - ที่ปรึกษาอัจฉริยะ
// ============================================

/**
 * 💡 แสดง Smart Advisor Dialog - ที่ปรึกษาแนะนำวิธีดึงข้อมูล
 */
function showSmartAdvisorDialog() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const hasCreds =
    scriptProperties.getProperty("USERNAME") &&
    scriptProperties.getProperty("PASSWORD");

  const html = HtmlService.createHtmlOutput(
    `
    <!DOCTYPE html>
    <html>
    <head>
      <base target="_top">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          max-width: 550px;
          margin: 0 auto;
          background: white;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h2 {
          color: #4285F4;
          margin-top: 0;
          margin-bottom: 10px;
          text-align: center;
        }
        .subtitle {
          text-align: center;
          color: #666;
          font-size: 13px;
          margin-bottom: 25px;
        }
        .scenario-box {
          margin-bottom: 20px;
        }
        .scenario-title {
          font-weight: bold;
          color: #333;
          margin-bottom: 10px;
          font-size: 14px;
        }
        .scenario-card {
          background: #f8f9fa;
          border-left: 4px solid #4285F4;
          padding: 15px;
          margin-bottom: 12px;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.3s;
        }
        .scenario-card:hover {
          background: #e8f0fe;
          border-left-color: #1967d2;
          transform: translateX(5px);
        }
        .scenario-card.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .scenario-card.disabled:hover {
          transform: none;
          background: #f8f9fa;
        }
        .scenario-emoji {
          font-size: 24px;
          margin-right: 10px;
        }
        .scenario-name {
          font-weight: bold;
          color: #1967d2;
          font-size: 14px;
          margin-bottom: 5px;
        }
        .scenario-desc {
          color: #666;
          font-size: 12px;
          margin-bottom: 8px;
        }
        .scenario-method {
          background: #e8f0fe;
          color: #1967d2;
          padding: 5px 10px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
          display: inline-block;
        }
        .login-notice {
          background: #fff3e0;
          border-left: 4px solid #ff9800;
          padding: 15px;
          margin-bottom: 20px;
          border-radius: 4px;
          text-align: center;
        }
        .login-notice strong {
          color: #e65100;
        }
        .btn-group {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }
        button {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.3s;
        }
        .btn-primary {
          background: #4285F4;
          color: white;
        }
        .btn-primary:hover {
          background: #3367D6;
        }
        .btn-secondary {
          background: #f1f3f4;
          color: #333;
        }
        .btn-secondary:hover {
          background: #e8eaed;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div style="text-align: center; font-size: 48px; margin-bottom: 10px;">🤖</div>
        <h2>💡 Smart Advisor</h2>
        <div class="subtitle">ที่ปรึกษาอัจฉริยะ - แนะนำวิธีดึงข้อมูลที่เหมาะสม</div>

        ${
          !hasCreds
            ? `
        <div class="login-notice">
          <strong>⚠️ ยังไม่ได้ Login</strong><br>
          <span style="font-size: 12px; color: #e65100;">กรุณา Login ก่อนใช้งาน ไปที่เมนู → 🔐 Login & Pull Data</span>
        </div>
        `
            : ""
        }

        <div class="scenario-box">
          <div class="scenario-title">🎯 เลือกสถานการณ์ของคุณ:</div>

          <div class="scenario-card ${!hasCreds ? "disabled" : ""}" onclick="selectScenario('today')">
            <div><span class="scenario-emoji">📅</span><span class="scenario-name">ดึงข้อมูลวันนี้</span></div>
            <div class="scenario-desc">ดึง trips ทั้งหมดของวันนี้ (00:00 - 23:59)</div>
            <div class="scenario-method">แนะนำ: Pull Today's Data</div>
          </div>

          <div class="scenario-card ${!hasCreds ? "disabled" : ""}" onclick="selectScenario('quick')">
            <div><span class="scenario-emoji">⚡</span><span class="scenario-name">ดึงข้อมูลเร็วๆ ไม่กี่รายการ</span></div>
            <div class="scenario-desc">ดึง 50 รายการล่าสุด เหมาะสำหรับทดสอบระบบ</div>
            <div class="scenario-method">แนะนำ: Quick Pull</div>
          </div>

          <div class="scenario-card ${!hasCreds ? "disabled" : ""}" onclick="selectScenario('range')">
            <div><span class="scenario-emoji">📊</span><span class="scenario-name">ดึงข้อมูลหลายวัน (ต้องการดูจำนวนก่อน)</span></div>
            <div class="scenario-desc">ดึงข้อมูลช่วงเวลาที่เลือก พร้อมดูจำนวนก่อนดึงจริง</div>
            <div class="scenario-method">แนะนำ: Pull with Estimate</div>
          </div>

          <div class="scenario-card ${!hasCreds ? "disabled" : ""}" onclick="selectScenario('all')">
            <div><span class="scenario-emoji">🚀</span><span class="scenario-name">ดึงข้อมูลทั้งหมด (batch)</span></div>
            <div class="scenario-desc">ดึง trips ทั้งหมดแบบแบ่ง batch ปลอดภัยแม้ข้อมูลเยอะ</div>
            <div class="scenario-method">แนะนำ: Batch Pull</div>
          </div>

          <div class="scenario-card ${!hasCreds ? "disabled" : ""}" onclick="selectScenario('resume')">
            <div><span class="scenario-emoji">♻️</span><span class="scenario-name">ทำต่อจากครั้งก่อน</span></div>
            <div class="scenario-desc">ดึงต่อจาก batch ที่ค้างอยู่ (ถ้ามี)</div>
            <div class="scenario-method">แนะนำ: Resume Batch Pull</div>
          </div>
        </div>

        <div style="background: #e3f2fd; padding: 15px; border-radius: 4px; font-size: 12px; color: #1565c0; margin-top: 20px;">
          💡 <strong>เคล็ดลับ:</strong><br>
          • ใช้ "Pull with Estimate" ถ้าไม่แน่ใจว่ามีกี่รายการ<br>
          • ใช้ "Batch Pull" ถ้าข้อมูลมากกว่า 200 รายการ<br>
          • เปิด Fast Mode เพื่อดึงข้อมูลเร็วขึ้น
        </div>

        <div class="btn-group">
          <button type="button" class="btn-secondary" onclick="google.script.host.close()">ปิด</button>
        </div>
      </div>

      <script>
        function selectScenario(scenario) {
          ${
            !hasCreds
              ? `
          alert('⚠️ กรุณา Login ก่อนใช้งาน');
          return;
          `
              : ""
          }

          switch(scenario) {
            case 'today':
              google.script.run.withSuccessHandler(function() {
                google.script.host.close();
              }).pullTodayData();
              break;

            case 'quick':
              google.script.run.withSuccessHandler(function() {
                google.script.host.close();
              }).pullTripsToSheet();
              break;

            case 'range':
              google.script.run.showPullWithEstimateDialog();
              break;

            case 'all':
              google.script.run.withSuccessHandler(function() {
                google.script.host.close();
              }).pullTripsToSheetBatch(false);
              break;

            case 'resume':
              google.script.run.withSuccessHandler(function() {
                google.script.host.close();
              }).pullTripsToSheetBatchResume();
              break;
          }
        }
      </script>
    </body>
    </html>
  `,
  )
    .setWidth(580)
    .setHeight(700)
    .setTitle("💡 Smart Advisor");

  SpreadsheetApp.getUi().showModalDialog(html, "Smart Advisor");
}

// ============================================
// 📋 PARAMETER SELECTION DIALOGS - Dialog เลือก Parameter
// ============================================

/**
 * 📦 แสดง Dialog สำหรับ Phase 1: Pull Trip IDs
 */
function showPullTripIdsDialog() {
  const scriptProperties = PropertiesService.getScriptProperties();

  // ตรวจสอบ credentials
  const hasSavedCreds = hasSavedCredentials();
  if (!hasSavedCreds) {
    SpreadsheetApp.getUi().alert(
      "⚠️ ต้อง Login ก่อน",
      "กรุณา Login ก่อนดึงข้อมูล\n\nใช้เมนู: 🔐 Login & Pull Data",
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
    return;
  }

  // ดึงค่าที่บันทึกไว้
  const today = new Date();
  const todayStr = Utilities.formatDate(
    today,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd",
  );
  const savedStartDate = scriptProperties.getProperty("START_DATE") || todayStr;
  const savedEndDate = scriptProperties.getProperty("END_DATE") || todayStr;
  const savedStatusId = scriptProperties.getProperty("STATUS_ID") || "";

  const html = HtmlService.createHtmlOutput(
    `
    <!DOCTYPE html>
    <html>
    <head>
      <base target="_top">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          max-width: 450px;
          margin: 0 auto;
          background: white;
          padding: 25px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h2 {
          color: #4285F4;
          margin-top: 0;
          margin-bottom: 5px;
          text-align: center;
        }
        .subtitle {
          text-align: center;
          color: #666;
          font-size: 13px;
          margin-bottom: 20px;
        }
        .form-group {
          margin-bottom: 15px;
        }
        label {
          display: block;
          font-weight: 500;
          margin-bottom: 5px;
          color: #333;
          font-size: 13px;
        }
        input[type="date"],
        input[type="number"],
        select {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          box-sizing: border-box;
        }
        input:focus,
        select:focus {
          outline: none;
          border-color: #4285F4;
        }
        .hint {
          font-size: 11px;
          color: #888;
          margin-top: 3px;
        }
        .btn-group {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }
        button {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.3s;
        }
        .btn-primary {
          background: #4285F4;
          color: white;
        }
        .btn-primary:hover {
          background: #3367D6;
        }
        .btn-secondary {
          background: #f1f3f4;
          color: #333;
        }
        .btn-secondary:hover {
          background: #e8eaed;
        }
        .info-box {
          background: #e8f0fe;
          padding: 12px;
          border-radius: 4px;
          font-size: 12px;
          color: #1967d2;
          margin-bottom: 15px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>📦 Phase 1: Pull Trip IDs</h2>
        <div class="subtitle">ดึง Trip IDs ตามช่วงเวลาที่เลือก</div>

        <div class="info-box">
          💡 ดึง Trip IDs ทั้งหมดเฉพาะพื้นฐาน<br>
          เหมาะสำหรับดูภาพรวมก่อนดึงรายละเอียด
        </div>

        <div class="form-group">
          <label for="startDate">📅 วันที่เริ่ม</label>
          <input type="date" id="startDate" value="${savedStartDate}" required>
          <div class="hint">รูปแบบ: YYYY-MM-DD</div>
        </div>

        <div class="form-group">
          <label for="endDate">📅 วันที่สิ้นสุด</label>
          <input type="date" id="endDate" value="${savedEndDate}" required>
          <div class="hint">รูปแบบ: YYYY-MM-DD</div>
        </div>

        <div class="form-group">
          <label for="statusId">🔢 Status ID (ถ้าต้องการกรอง)</label>
          <select id="statusId">
            <option value="" ${!savedStatusId ? "selected" : ""}>ทุก Status (1-5)</option>
            <option value="1" ${savedStatusId === "1" ? "selected" : ""}>1 - Open</option>
            <option value="2" ${savedStatusId === "2" ? "selected" : ""}>2 - In Progress</option>
            <option value="3" ${savedStatusId === "3" ? "selected" : ""}>3 - Completed</option>
            <option value="4" ${savedStatusId === "4" ? "selected" : ""}>4 - Cancelled</option>
            <option value="5" ${savedStatusId === "5" ? "selected" : ""}>5 - Other</option>
          </select>
          <div class="hint">ปล่อยว่างเพื่อดึงทุก Status</div>
        </div>

        <div class="btn-group">
          <button type="button" class="btn-secondary" onclick="google.script.host.close()">ปิด</button>
          <button type="button" class="btn-primary" onclick="submitPull()">📦 ดึง Trip IDs</button>
        </div>
      </div>

      <script>
        function submitPull() {
          const startDate = document.getElementById('startDate').value;
          const endDate = document.getElementById('endDate').value;
          const statusId = document.getElementById('statusId').value;

          if (!startDate || !endDate) {
            alert('❌ กรุณาระบุวันที่เริ่มและวันที่สิ้นสุด');
            return;
          }

          if (startDate > endDate) {
            alert('❌ วันที่เริ่มต้องไม่หลังวันที่สิ้นสุด');
            return;
          }

          google.script.run
            .withSuccessHandler(function(result) {
              alert('✅ ดึง Trip IDs สำเร็จ!\\n\\nจำนวน: ' + result + ' รายการ');
              google.script.host.close();
            })
            .withFailureHandler(function(error) {
              alert('❌ เกิดข้อผิดพลาด: ' + error.message);
            })
            .pullTripIdsOnly(startDate, endDate, statusId);
        }
      </script>
    </body>
    </html>
  `,
  )
    .setWidth(480)
    .setHeight(580)
    .setTitle("📦 Phase 1: Pull Trip IDs");

  SpreadsheetApp.getUi().showModalDialog(html, "Phase 1: Pull Trip IDs");
}

/**
 * 📦 แสดง Dialog สำหรับ Phase 2: Pull Trip Details
 */
function showPullTripDetailsDialog() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const config = getConfig();

  // ตรวจสอบว่ามี Trip IDs ในชีทหรือไม่
  const tripsSheet = ss.getSheetByName(config.tripsSheetName);
  if (!tripsSheet || tripsSheet.getLastRow() <= 1) {
    ui.alert(
      "⚠️ ไม่พบ Trip IDs",
      "ไม่พบ Trip IDs ในชีท Trips\n\nกรุณาดำเนินการ Phase 1 ก่อน",
      ui.ButtonSet.OK,
    );
    return;
  }

  const tripIdsCount = tripsSheet.getLastRow() - 1;

  const html = HtmlService.createHtmlOutput(
    `
    <!DOCTYPE html>
    <html>
    <head>
      <base target="_top">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          max-width: 450px;
          margin: 0 auto;
          background: white;
          padding: 25px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h2 {
          color: #4285F4;
          margin-top: 0;
          margin-bottom: 5px;
          text-align: center;
        }
        .subtitle {
          text-align: center;
          color: #666;
          font-size: 13px;
          margin-bottom: 20px;
        }
        .info-box {
          background: #e8f0fe;
          padding: 15px;
          border-radius: 4px;
          font-size: 13px;
          color: #1967d2;
          margin-bottom: 20px;
          text-align: center;
        }
        .info-box strong {
          display: block;
          font-size: 24px;
          margin-bottom: 5px;
        }
        .btn-group {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }
        button {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.3s;
        }
        .btn-primary {
          background: #4285F4;
          color: white;
        }
        .btn-primary:hover {
          background: #3367D6;
        }
        .btn-secondary {
          background: #f1f3f4;
          color: #333;
        }
        .btn-secondary:hover {
          background: #e8eaed;
        }
        .btn-success {
          background: #34A853;
          color: white;
        }
        .btn-success:hover {
          background: #2D9247;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>📦 Phase 2: Pull Trip Details</h2>
        <div class="subtitle">ดึงรายละเอียดจาก Trip IDs ที่มีอยู่</div>

        <div class="info-box">
          <strong>${tripIdsCount}</strong>
          Trip IDs พร้อมดึงรายละเอียด
        </div>

        <div style="background: #fff3e0; padding: 12px; border-radius: 4px; font-size: 12px; color: #e65100; margin-bottom: 15px;">
          ⚠️ คำเตือน: การดึง Trip Details ใช้เวลานาน<br>
          (ประมาณ 1-2 วินาทีต่อรายการ)
        </div>

        <div style="background: #f8f9fa; padding: 12px; border-radius: 4px; font-size: 12px; color: #333; margin-bottom: 15px;">
          💡 เลือกโหมด:<br>
          • <strong>ดึงใหม่</strong> - เริ่มดึงจากรายการแรก<br>
          • <strong>ดึงต่อ</strong> - ดึงต่อจากครั้งก่อน
        </div>

        <div class="btn-group">
          <button type="button" class="btn-secondary" onclick="google.script.host.close()">ปิด</button>
          <button type="button" class="btn-success" onclick="resumePull()">♻️ ดึงต่อ</button>
          <button type="button" class="btn-primary" onclick="newPull()">📦 ดึงใหม่</button>
        </div>
      </div>

      <script>
        function newPull() {
          const confirmed = confirm(
            'ยืนยันดึง Trip Details ใหม่ทั้งหมด?\\n\\n' +
            'จำนวน: ' + tripIdsCount + ' รายการ\\n' +
            'เวลาโดยประมาณ: ~' + Math.ceil(tripIdsCount * 1.5 / 60) + ' นาที'
          );

          if (confirmed) {
            google.script.run
              .withSuccessHandler(function() {
                alert('✅ เริ่มดึง Trip Details แล้ว');
                google.script.host.close();
              })
              .withFailureHandler(function(error) {
                alert('❌ เกิดข้อผิดพลาด: ' + error.message);
              })
              .pullTripDetails(false);
          }
        }

        function resumePull() {
          google.script.run
            .withSuccessHandler(function() {
              alert('✅ เริ่มดึงต่อแล้ว');
              google.script.host.close();
            })
            .withFailureHandler(function(error) {
              alert('❌ เกิดข้อผิดพลาด: ' + error.message);
            })
            .pullTripDetails(true);
        }
      </script>
    </body>
    </html>
  `,
  )
    .setWidth(480)
    .setHeight(550)
    .setTitle("📦 Phase 2: Pull Trip Details");

  SpreadsheetApp.getUi().showModalDialog(html, "Phase 2: Pull Trip Details");
}

/**
 * 📊 แสดง Dialog สำหรับ Batch Pull
 */
function showBatchPullDialog() {
  const scriptProperties = PropertiesService.getScriptProperties();

  // ตรวจสอบ credentials
  const hasSavedCreds = hasSavedCredentials();
  if (!hasSavedCreds) {
    SpreadsheetApp.getUi().alert(
      "⚠️ ต้อง Login ก่อน",
      "กรุณา Login ก่อนดึงข้อมูล\n\nใช้เมนู: 🔐 Login & Pull Data",
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
    return;
  }

  // ดึงค่าที่บันทึกไว้
  const today = new Date();
  const todayStr = Utilities.formatDate(
    today,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd",
  );
  const savedStartDate = scriptProperties.getProperty("START_DATE") || todayStr;
  const savedEndDate = scriptProperties.getProperty("END_DATE") || todayStr;
  const savedStatusId = scriptProperties.getProperty("STATUS_ID") || "";
  const savedLimit = scriptProperties.getProperty("LIMIT") || "50";

  const html = HtmlService.createHtmlOutput(
    `
    <!DOCTYPE html>
    <html>
    <head>
      <base target="_top">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          max-width: 450px;
          margin: 0 auto;
          background: white;
          padding: 25px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h2 {
          color: #4285F4;
          margin-top: 0;
          margin-bottom: 5px;
          text-align: center;
        }
        .subtitle {
          text-align: center;
          color: #666;
          font-size: 13px;
          margin-bottom: 20px;
        }
        .form-group {
          margin-bottom: 15px;
        }
        label {
          display: block;
          font-weight: 500;
          margin-bottom: 5px;
          color: #333;
          font-size: 13px;
        }
        input[type="date"],
        input[type="number"],
        select {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          box-sizing: border-box;
        }
        input:focus,
        select:focus {
          outline: none;
          border-color: #4285F4;
        }
        .hint {
          font-size: 11px;
          color: #888;
          margin-top: 3px;
        }
        .btn-group {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }
        button {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.3s;
        }
        .btn-primary {
          background: #4285F4;
          color: white;
        }
        .btn-primary:hover {
          background: #3367D6;
        }
        .btn-secondary {
          background: #f1f3f4;
          color: #333;
        }
        .btn-secondary:hover {
          background: #e8eaed;
        }
        .info-box {
          background: #e8f0fe;
          padding: 12px;
          border-radius: 4px;
          font-size: 12px;
          color: #1967d2;
          margin-bottom: 15px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>🚀 Batch Pull</h2>
        <div class="subtitle">ดึงข้อมูลแบบแบ่ง batch (ปลอดภัย)</div>

        <div class="info-box">
          💡 แบ่งดึงทีละ batch ปลอดภัยแม้ข้อมูลเยอะ<br>
          สามารถดึงต่อได้ถ้าขัดจังหวะ
        </div>

        <div class="form-group">
          <label for="startDate">📅 วันที่เริ่ม</label>
          <input type="date" id="startDate" value="${savedStartDate}" required>
        </div>

        <div class="form-group">
          <label for="endDate">📅 วันที่สิ้นสุด</label>
          <input type="date" id="endDate" value="${savedEndDate}" required>
        </div>

        <div class="form-group">
          <label for="statusId">🔢 Status ID</label>
          <select id="statusId">
            <option value="" ${!savedStatusId ? "selected" : ""}>ทุก Status (1-5)</option>
            <option value="1" ${savedStatusId === "1" ? "selected" : ""}>1 - Open</option>
            <option value="2" ${savedStatusId === "2" ? "selected" : ""}>2 - In Progress</option>
            <option value="3" ${savedStatusId === "3" ? "selected" : ""}>3 - Completed</option>
            <option value="4" ${savedStatusId === "4" ? "selected" : ""}>4 - Cancelled</option>
            <option value="5" ${savedStatusId === "5" ? "selected" : ""}>5 - Other</option>
          </select>
        </div>

        <div class="form-group">
          <label for="limit">📊 Batch Size (รายการต่อ batch)</label>
          <input type="number" id="limit" value="${savedLimit}" min="10" max="200">
          <div class="hint">แนะนำ: 50-100 รายการ</div>
        </div>

        <div class="btn-group">
          <button type="button" class="btn-secondary" onclick="google.script.host.close()">ปิด</button>
          <button type="button" class="btn-primary" onclick="submitBatch()">🚀 เริ่ม Batch Pull</button>
        </div>
      </div>

      <script>
        function submitBatch() {
          const startDate = document.getElementById('startDate').value;
          const endDate = document.getElementById('endDate').value;
          const statusId = document.getElementById('statusId').value;
          const limit = document.getElementById('limit').value;

          if (!startDate || !endDate) {
            alert('❌ กรุณาระบุวันที่เริ่มและวันที่สิ้นสุด');
            return;
          }

          if (startDate > endDate) {
            alert('❌ วันที่เริ่มต้องไม่หลังวันที่สิ้นสุด');
            return;
          }

          const confirmed = confirm(
            'ยืนยันเริ่ม Batch Pull?\\n\\n' +
            'ช่วงเวลา: ' + startDate + ' ถึง ' + endDate + '\\n' +
            'Batch Size: ' + limit + ' รายการ\\n\\n' +
            '⚠️ ข้อมูลจำนวนมากอาจใช้เวลานาน'
          );

          if (confirmed) {
            // บันทึกค่าที่เลือก
            google.script.run
              .withSuccessHandler(function() {
                google.script.run
                  .withSuccessHandler(function() {
                    alert('✅ เริ่ม Batch Pull แล้ว');
                    google.script.host.close();
                  })
                  .withFailureHandler(function(error) {
                    alert('❌ เกิดข้อผิดพลาด: ' + error.message);
                  })
                  .pullTripsToSheetBatch(false);
              })
              .withFailureHandler(function(error) {
                alert('❌ บันทึกค่าไม่สำเร็จ: ' + error.message);
              })
              .saveTempParameters(startDate, endDate, statusId, limit);
          }
        }
      </script>
    </body>
    </html>
  `,
  )
    .setWidth(480)
    .setHeight(620)
    .setTitle("🚀 Batch Pull");

  SpreadsheetApp.getUi().showModalDialog(html, "Batch Pull");
}

/**
 * ⚡ แสดง Dialog สำหรับ Quick Pull
 */
function showQuickPullDialog() {
  const scriptProperties = PropertiesService.getScriptProperties();

  // ตรวจสอบ credentials
  const hasSavedCreds = hasSavedCredentials();
  if (!hasSavedCreds) {
    SpreadsheetApp.getUi().alert(
      "⚠️ ต้อง Login ก่อน",
      "กรุณา Login ก่อนดึงข้อมูล\n\nใช้เมนู: 🔐 Login & Pull Data",
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
    return;
  }

  // ดึงค่าที่บันทึกไว้
  const today = new Date();
  const todayStr = Utilities.formatDate(
    today,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd",
  );
  const savedStartDate = scriptProperties.getProperty("START_DATE") || todayStr;
  const savedEndDate = scriptProperties.getProperty("END_DATE") || todayStr;
  const savedStatusId = scriptProperties.getProperty("STATUS_ID") || "";
  const savedLimit = scriptProperties.getProperty("LIMIT") || "50";

  const html = HtmlService.createHtmlOutput(
    `
    <!DOCTYPE html>
    <html>
    <head>
      <base target="_top">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          max-width: 450px;
          margin: 0 auto;
          background: white;
          padding: 25px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h2 {
          color: #4285F4;
          margin-top: 0;
          margin-bottom: 5px;
          text-align: center;
        }
        .subtitle {
          text-align: center;
          color: #666;
          font-size: 13px;
          margin-bottom: 20px;
        }
        .form-group {
          margin-bottom: 15px;
        }
        label {
          display: block;
          font-weight: 500;
          margin-bottom: 5px;
          color: #333;
          font-size: 13px;
        }
        input[type="date"],
        input[type="number"],
        select {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          box-sizing: border-box;
        }
        input:focus,
        select:focus {
          outline: none;
          border-color: #4285F4;
        }
        .hint {
          font-size: 11px;
          color: #888;
          margin-top: 3px;
        }
        .btn-group {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }
        button {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.3s;
        }
        .btn-primary {
          background: #4285F4;
          color: white;
        }
        .btn-primary:hover {
          background: #3367D6;
        }
        .btn-secondary {
          background: #f1f3f4;
          color: #333;
        }
        .btn-secondary:hover {
          background: #e8eaed;
        }
        .info-box {
          background: #e8f0fe;
          padding: 12px;
          border-radius: 4px;
          font-size: 12px;
          color: #1967d2;
          margin-bottom: 15px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>⚡ Quick Pull</h2>
        <div class="subtitle">ดึงข้อมูลเร็วๆ (จำกัดจำนวน)</div>

        <div class="info-box">
          💡 เหมาะสำหรับทดสอบระบบ<br>
          ดึงข้อมูลไม่กี่รายการล่าสุด
        </div>

        <div class="form-group">
          <label for="startDate">📅 วันที่เริ่ม</label>
          <input type="date" id="startDate" value="${savedStartDate}" required>
        </div>

        <div class="form-group">
          <label for="endDate">📅 วันที่สิ้นสุด</label>
          <input type="date" id="endDate" value="${savedEndDate}" required>
        </div>

        <div class="form-group">
          <label for="statusId">🔢 Status ID</label>
          <select id="statusId">
            <option value="" ${!savedStatusId ? "selected" : ""}>ทุก Status (1-5)</option>
            <option value="1" ${savedStatusId === "1" ? "selected" : ""}>1 - Open</option>
            <option value="2" ${savedStatusId === "2" ? "selected" : ""}>2 - In Progress</option>
            <option value="3" ${savedStatusId === "3" ? "selected" : ""}>3 - Completed</option>
            <option value="4" ${savedStatusId === "4" ? "selected" : ""}>4 - Cancelled</option>
            <option value="5" ${savedStatusId === "5" ? "selected" : ""}>5 - Other</option>
          </select>
        </div>

        <div class="form-group">
          <label for="limit">📊 จำนวนที่ต้องการดึง</label>
          <input type="number" id="limit" value="${savedLimit}" min="1" max="500">
          <div class="hint">สูงสุด 500 รายการ</div>
        </div>

        <div class="btn-group">
          <button type="button" class="btn-secondary" onclick="google.script.host.close()">ปิด</button>
          <button type="button" class="btn-primary" onclick="submitPull()">⚡ ดึงข้อมูล</button>
        </div>
      </div>

      <script>
        function submitPull() {
          const startDate = document.getElementById('startDate').value;
          const endDate = document.getElementById('endDate').value;
          const statusId = document.getElementById('statusId').value;
          const limit = document.getElementById('limit').value;

          if (!startDate || !endDate) {
            alert('❌ กรุณาระบุวันที่เริ่มและวันที่สิ้นสุด');
            return;
          }

          if (startDate > endDate) {
            alert('❌ วันที่เริ่มต้องไม่หลังวันที่สิ้นสุด');
            return;
          }

          if (limit < 1 || limit > 500) {
            alert('❌ จำนวนต้องอยู่ระหว่าง 1-500');
            return;
          }

          const confirmed = confirm(
            'ยืนยันดึงข้อมูล?\\n\\n' +
            'ช่วงเวลา: ' + startDate + ' ถึง ' + endDate + '\\n' +
            'จำนวน: ' + limit + ' รายการ'
          );

          if (confirmed) {
            // บันทึกค่าที่เลือก
            google.script.run
              .withSuccessHandler(function() {
                google.script.run
                  .withSuccessHandler(function() {
                    alert('✅ ดึงข้อมูลสำเร็จ!');
                    google.script.host.close();
                  })
                  .withFailureHandler(function(error) {
                    alert('❌ เกิดข้อผิดพลาด: ' + error.message);
                  })
                  .pullTripsToSheet();
              })
              .withFailureHandler(function(error) {
                alert('❌ บันทึกค่าไม่สำเร็จ: ' + error.message);
              })
              .saveTempParameters(startDate, endDate, statusId, limit);
          }
        }
      </script>
    </body>
    </html>
  `,
  )
    .setWidth(480)
    .setHeight(620)
    .setTitle("⚡ Quick Pull");

  SpreadsheetApp.getUi().showModalDialog(html, "Quick Pull");
}

/**
 * 💾 บันทึก Temp Parameters และดำเนินการต่อ
 * @param {string} startDate
 * @param {string} endDate
 * @param {string} statusId
 * @param {string} limit
 * @param {string} action - 'batch' หรือ 'quick'
 */
function saveTempParameters(startDate, endDate, statusId, limit) {
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty("TEMP_START_DATE", startDate);
  scriptProperties.setProperty("TEMP_END_DATE", endDate);
  scriptProperties.setProperty("TEMP_STATUS_ID", statusId || "");
  scriptProperties.setProperty("TEMP_LIMIT", limit);
  return { success: true };
}

// ============================================
// 📦 2-PHASE PULL - แยกดึง Trip IDs และ Trip Details
// ============================================

/**
 * 📦 Phase 1: ดึง Trip IDs ทั้งหมดตามช่วงเวลา
 * ✅ กรองข้อมูลอย่างเข้มงวดตามวันที่และ Status ที่ระบุ
 * บันทึกในชีท Trips (เฉพาะ Trip IDs + ข้อมูลพื้นฐาน)
 * @param {string} startDate - วันที่เริ่ม (YYYY-MM-DD) ถ้าไม่ระบุใช้จาก config
 * @param {string} endDate - วันที่สิ้นสุด (YYYY-MM-DD) ถ้าไม่ระบุใช้จาก config
 * @param {string} statusId - Status ID ถ้าไม่ระบุใช้จาก config
 * @returns {number} - จำนวน Trip IDs ที่ดึงได้
 */
function pullTripIdsOnly(startDate = null, endDate = null, statusId = null) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const scriptProperties = PropertiesService.getScriptProperties();

  try {
    // บันทึก parameters ชั่วคราวสำหรับการ execute นี้
    if (startDate) scriptProperties.setProperty("TEMP_START_DATE", startDate);
    if (endDate) scriptProperties.setProperty("TEMP_END_DATE", endDate);
    if (statusId) scriptProperties.setProperty("TEMP_STATUS_ID", statusId);

    ss.toast("🔐 Logging in...", "MLSTMS Trips", 5);
    const token = login();
    if (!token) {
      throw new Error("Login failed");
    }

    // ✅ แสดงช่วงวันที่และ Status ที่จะดึง
    const statusText = statusId ? `Status ${statusId}` : "ทุก Status (1-5)";
    const dateText = (startDate && endDate) ? `วันที่ ${startDate} ถึง ${endDate}` : "ทุกวันที่";
    ss.toast(`📦 Phase 1: ดึง ${statusText}, ${dateText}...`, "MLSTMS Trips", 10);
    Logger.log(`📦 Phase 1: Pulling Trip IDs - ${statusText}, ${dateText}`);

    // ✅ แก้ไข: ใช้ฟังก์ชันใหม่ที่กรองข้อมูลอย่างเข้มงวด
    let allTrips = [];

    if (statusId) {
      // ดึงเฉพาะ statusId ที่ระบุ พร้อม filter วันที่
      Logger.log(`🔍 Fetching Status ${statusId} with date filter: ${startDate} to ${endDate}`);
      const trips = getAllTripsForStatusIdWithDateFilter(
        parseInt(statusId),
        startDate,
        endDate
      );
      allTrips = allTrips.concat(trips);
      Logger.log(`✅ Status ${statusId}: ${trips.length} trips`);
    } else {
      // ดึงจากทุก Status ID (1-5) พร้อม filter วันที่
      const STATUS_IDS = [1, 2, 3, 4, 5];
      Logger.log(`🔍 Fetching ALL statuses (1-5) with date filter: ${startDate} to ${endDate}`);

      for (const sid of STATUS_IDS) {
        const trips = getAllTripsForStatusIdWithDateFilter(
          sid,
          startDate,
          endDate
        );
        allTrips = allTrips.concat(trips);
        Logger.log(`✅ Status ${sid}: ${trips.length} trips`);

        // Rate limiting ระหว่าง Status IDs
        Utilities.sleep(1000);
      }
    }

    // ลบ duplicates โดยใช้ Trip ID
    const uniqueTrips = [];
    const seenTripIds = new Set();

    for (const trip of allTrips) {
      const tripId = getTripField(trip, ["id", "tripId", "trip_code", "tripCode", "trip_id"]);
      if (tripId && !seenTripIds.has(String(tripId))) {
        seenTripIds.add(String(tripId));
        uniqueTrips.push(trip);
      }
    }

    Logger.log(`✅ Total unique trips after filtering: ${uniqueTrips.length} (from ${allTrips.length} raw records)`);

    // ลบ temp properties
    scriptProperties.deleteProperty("TEMP_START_DATE");
    scriptProperties.deleteProperty("TEMP_END_DATE");
    scriptProperties.deleteProperty("TEMP_STATUS_ID");

    if (uniqueTrips.length === 0) {
      ui.alert(
        "⚠️ No Trips Found",
        `ไม่พบ Trip IDs ในช่วงเวลาที่เลือก\n\n` +
        `Status: ${statusText}\n` +
        `วันที่: ${dateText}`,
        ui.ButtonSet.OK,
      );
      return 0;
    }

    ss.toast(
      `💾 Saving ${uniqueTrips.length} Trip IDs to sheet...`,
      "MLSTMS Trips",
      5,
    );

    // ✅ บันทึกเฉพาะ Trip IDs + ข้อมูลพื้นฐาน (ไม่ดึง details)
    saveTripsToSheet(uniqueTrips, false, true); // append=false, checkDuplicates=true

    ui.alert(
      "✅ Phase 1 Complete!",
      `ดึง Trip IDs สำเร็จ!\n\n` +
        `จำนวน Trip IDs: ${uniqueTrips.length}\n` +
        `Status: ${statusText}\n` +
        `วันที่: ${dateText}\n` +
        `บันทึกในชีท: "Trips"\n\n` +
        `👉 ต่อไปใช้ "📦 Phase 2: Pull Trip Details" เพื่อดึงรายละเอียด`,
      ui.ButtonSet.OK,
    );

    Logger.log(`✅ Phase 1 complete: ${uniqueTrips.length} Trip IDs saved`);
    return uniqueTrips.length;
  } catch (error) {
    ui.alert(
      "❌ Phase 1 Failed",
      `เกิดข้อผิดพลาด:\n\n${error.message}`,
      ui.ButtonSet.OK,
    );
    throw error;
  }
}

/**
 * 📦 Phase 2: ดึง Trip Details จาก Trip IDs ในชีท
 * อ่าน Trip IDs จากชีท Trips → ดึง details ทีละรายการ → บันทึกในชีท TripDetails
 * @param {boolean} resume - Resume จากครั้งก่อนหรือไม่
 */
function pullTripDetails(resume = false) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const config = getConfig();
  const scriptProperties = PropertiesService.getScriptProperties();

  try {
    // ตรวจสอบ credentials
    if (!hasSavedCredentials()) {
      ui.alert("⚠️ No Credentials", "Please login first.", ui.ButtonSet.OK);
      return;
    }

    // อ่าน Trip IDs จากชีท Trips
    const tripsSheet = ss.getSheetByName(config.tripsSheetName);
    if (!tripsSheet) {
      ui.alert(
        "❌ Sheet Not Found",
        `ไม่พบชีท "${config.tripsSheetName}"\n\nกรุณาดำเนินการ Phase 1 ก่อน`,
        ui.ButtonSet.OK,
      );
      return;
    }

    const lastRow = tripsSheet.getLastRow();
    if (lastRow <= 1) {
      ui.alert(
        "⚠️ No Trip IDs Found",
        `ชีท "${config.tripsSheetName}" ว่างเปล่า\n\nกรุณาดำเนินการ Phase 1 ก่อน`,
        ui.ButtonSet.OK,
      );
      return;
    }

    // ดึง Trip IDs ทั้งหมดจากชีท (คอลัมน์ A = Trip ID)
    const tripData = tripsSheet.getRange(2, 1, lastRow - 1, 1).getValues();
    const tripIds = tripData.map((row) => String(row[0])).filter((id) => id);

    if (tripIds.length === 0) {
      ui.alert("⚠️ No Trip IDs", "ไม่พบ Trip IDs ในชีท", ui.ButtonSet.OK);
      return;
    }

    const estimatedTime = Math.ceil(
      (tripIds.length * (config.rateLimitMs || 1000)) / 1000 / 60,
    );

    const response = ui.alert(
      "📦 Phase 2: ดึง Trip Details",
      `พบ Trip IDs: ${tripIds.length} รายการ\n\n` +
        `เวลาโดยประมาณ: ~${estimatedTime} นาที\n\n` +
        `ต้องการดำเนินการต่อหรือไม่?`,
      ui.ButtonSet.YES_NO,
    );

    if (response !== ui.Button.YES) {
      return;
    }

    ss.toast("🔐 Logging in...", "MLSTMS Trips", 5);
    const token = login();
    if (!token) {
      throw new Error("Login failed");
    }

    // ตรวจสอบว่ามี Trip Details อยู่แล้วหรือไม่ (สำหรับ resume)
    let startIndex = 0;
    if (resume) {
      const detailsSheet = ss.getSheetByName(config.tripDetailsSheetName);
      if (detailsSheet && detailsSheet.getLastRow() > 1) {
        const existingDetails = detailsSheet
          .getRange(2, 1, detailsSheet.getLastRow() - 1, 1)
          .getValues();
        const existingTripIds = new Set(
          existingDetails.map((row) => String(row[0])),
        );

        // หา Trip ID แรกที่ยังไม่มี details
        for (let i = 0; i < tripIds.length; i++) {
          if (!existingTripIds.has(tripIds[i])) {
            startIndex = i;
            break;
          }
        }
      }
    }

    ss.toast(
      `📦 Phase 2: ดึง Trip Details ${startIndex + 1}/${tripIds.length}...`,
      "MLSTMS Trips",
      10,
    );
    Logger.log(`📦 Phase 2: Pulling Trip Details from index ${startIndex}...`);

    // ✅ แสดงว่ากำลังดึง details ของ trips ที่ผ่านการ filter แล้ว
    const tempStartDate = scriptProperties.getProperty("TEMP_START_DATE") ||
                        scriptProperties.getProperty("START_DATE");
    const tempEndDate = scriptProperties.getProperty("TEMP_END_DATE") ||
                      scriptProperties.getProperty("END_DATE");
    const tempStatusId = scriptProperties.getProperty("TEMP_STATUS_ID") ||
                         scriptProperties.getProperty("STATUS_ID");

    if (tempStartDate && tempEndDate) {
      Logger.log(`✅ Phase 2 Date Filter: ${tempStartDate} to ${tempEndDate}`);
      Logger.log(`✅ Phase 2 Status Filter: ${tempStatusId || 'ALL'} (from filtered Trips sheet)`);
    }

    // ดึง Trip Details ทีละรายการ
    const tripDetails = [];
    const skippedTrips = [];
    const BATCH_TIME_LIMIT = 5 * 60 * 1000; // 5 นาที
    const startTime = Date.now();

    for (let i = startIndex; i < tripIds.length; i++) {
      // ตรวจสอบ execution time
      const elapsed = Date.now() - startTime;
      if (elapsed > BATCH_TIME_LIMIT) {
        ss.toast(`⏸️ Time limit - ดึงมาแล้ว ${i} รายการ`, "MLSTMS Trips", 10);

        ui.alert(
          "⏸️ Batch Paused",
          `ดึง Trip Details มาแล้ว ${i - startIndex} รายการ\n` +
            `ค้างอยู่ที่ Trip ID: ${tripIds[i]}\n\n` +
            `💡 ใช้ "📦 Phase 2 Resume" เพื่อดึงต่อ`,
          ui.ButtonSet.OK,
        );
        return;
      }

      const tripId = tripIds[i];
      const progress = Math.round(
        ((i - startIndex + 1) / (tripIds.length - startIndex)) * 100,
      );

      // Progress update
      if ((i - startIndex) % 5 === 0 || i === tripIds.length - 1) {
        ss.toast(
          `📦 Phase 2: ${i - startIndex + 1}/${tripIds.length - startIndex} (${progress}%)`,
          "MLSTMS Trips",
          5,
        );
      }

      Logger.log(
        `Fetching details for Trip ID: ${tripId} (${i + 1}/${tripIds.length})`,
      );

      const detail = getTripDetails(tripId);
      if (detail) {
        tripDetails.push(detail);
        Logger.log(`   ✅ Success`);
      } else {
        Logger.log(`   ❌ Failed`);
        skippedTrips.push({ tripId: tripId, reason: "API Error" });
      }

      // Rate limiting
      if (!config.fastMode && config.rateLimitMs > 0) {
        Utilities.sleep(config.rateLimitMs);
      }
    }

    // บันทึก Trip Details ลงชีท
    ss.toast(
      `💾 Saving ${tripDetails.length} Trip Details...`,
      "MLSTMS Trips",
      5,
    );
    saveTripDetailsToSheet(tripDetails, false, true);

    const duration = Math.round((Date.now() - startTime) / 1000);

    ui.alert(
      "✅ Phase 2 Complete!",
      `ดึง Trip Details สำเร็จ!\n\n` +
        `✅ สำเร็จ: ${tripDetails.length} รายการ\n` +
        `❌ ล้มเหลว: ${skippedTrips.length} รายการ\n` +
        `⏱️ เวลาที่ใช้: ${Math.floor(duration / 60)} นาที ${duration % 60} วินาที`,
      ui.ButtonSet.OK,
    );

    Logger.log(`✅ Phase 2 complete: ${tripDetails.length} Trip Details saved`);
  } catch (error) {
    ui.alert(
      "❌ Phase 2 Failed",
      `เกิดข้อผิดพลาด:\n\n${error.message}`,
      ui.ButtonSet.OK,
    );
    throw error;
  }
}

/**
 * 📦 Phase 2: Resume (ดึงต่อจากที่ค้าง)
 */
function pullTripDetailsResume() {
  pullTripDetails(true);
}

// ============================================
// 🗑️ BATCH STATE MANAGEMENT - จัดการ State ที่ค้างอยู่
// ============================================

/**
 * 🗑️ Clear Batch State with UI Confirmation
 * ลบ state ที่บันทึกไว้ว่า batch ค้างอยู่ เพื่อเริ่มใหม่
 */
function clearBatchStateWithUI() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  // โหลด state ปัจจุบัน
  const state = loadBatchState();

  if (!state) {
    ui.alert(
      "ℹ️ ไม่มี Batch State ค้างอยู่",
      "ไม่พบข้อมูล batch ที่ค้างอยู่\n\n" +
        "คุณสามารถเริ่ม batch pull ใหม่ได้เลย",
      ui.ButtonSet.OK,
    );
    return;
  }

  // สร้างข้อความแสดงรายละเอียดของ state ที่จะลบ
  let message = "🗑️ ยืนยันการลบ Batch State\n\n";
  message += "ข้อมูลที่จะถูกลบ:\n";
  message += "━━━━━━━━━━━━━━━━━━━━━━━\n";
  message += `📊 Progress: ${state.processedCount}/${state.totalCount || "?"} trips\n`;
  message += `📍 Offset: ${state.offset}\n`;

  if (state.startTime) {
    const startDate = new Date(state.startTime);
    const elapsed = Math.round((new Date() - startDate) / 1000 / 60);
    message += `⏰ เริ่มเมื่อ: ${Utilities.formatDate(startDate, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm")}\n`;
    message += `⏱️ ผ่านมาแล้ว: ~${elapsed} นาที\n`;
  }

  if (state.lastUpdate) {
    const lastUpdate = new Date(state.lastUpdate);
    message += `🕐 อัปเดตล่าสุด: ${Utilities.formatDate(lastUpdate, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm")}\n`;
  }

  message += "\n";
  message += "⚠️ หลังจากลบ:\n";
  message += "• จะต้องเริ่ม batch pull ใหม่ทั้งหมด\n";
  message += "• ข้อมูลที่บันทึกลงชีทแล้วจะยังอยู่\n";
  message += "• เฉพาะ state ที่ใช้ resume จะถูกลบเท่านั้น\n\n";
  message += "ยืนยันที่จะลบ?";

  const response = ui.alert(
    "🗑️ Clear Batch State",
    message,
    ui.ButtonSet.YES_NO,
  );

  if (response === ui.Button.YES) {
    // ลบ state
    clearBatchState();

    ss.toast("🗑️ Batch state cleared!", "MLSTMS Trips", 5);
    Logger.log("🗑️ Batch state cleared by user");

    ui.alert(
      "✅ ลบ Batch State สำเร็จ!",
      "ลบข้อมูล state ที่ค้างอยู่เรียบร้อย\n\n" +
        "คุณสามารถเริ่ม batch pull ใหม่ได้เลย",
      ui.ButtonSet.OK,
    );
  } else {
    ss.toast("❌ ยกเลิก - คง state ไว้", "MLSTMS Trips", 3);
  }
}

/**
 * 📊 ดูสถานะ Batch State ปัจจุบัน
 */
function viewBatchState() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  const state = loadBatchState();

  if (!state) {
    ui.alert(
      "ℹ️ Batch State Status",
      "❌ ไม่มี Batch State ค้างอยู่\n\n" +
        "คุณยังไม่เคยเริ่ม batch pull หรือได้ลบ state ไปแล้ว",
      ui.ButtonSet.OK,
    );
    return;
  }

  // คำนวณ % และ ETA
  const progress = state.totalCount
    ? Math.round((state.processedCount / state.totalCount) * 100)
    : "?";
  const remaining = state.totalCount
    ? state.totalCount - state.processedCount
    : "?";

  let message = "📊 สถานะ Batch State ปัจจุบัน\n\n";
  message += "━━━━━━━━━━━━━━━━━━━━━━━\n";
  message += `📊 Progress: ${state.processedCount}/${state.totalCount || "?"} (${progress}%)\n`;
  message += `📍 Offset: ${state.offset}\n`;
  message += `🔢 คงเหลือ: ~${remaining} รายการ\n\n`;

  if (state.startTime) {
    const startDate = new Date(state.startTime);
    message += `⏰ เริ่มเมื่อ:\n`;
    message += `   ${Utilities.formatDate(startDate, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss")}\n\n`;
  }

  if (state.lastUpdate) {
    const lastUpdate = new Date(state.lastUpdate);
    message += `🕐 อัปเดตล่าสุด:\n`;
    message += `   ${Utilities.formatDate(lastUpdate, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss")}\n\n`;
  }

  const elapsed = state.startTime
    ? Math.round((new Date() - new Date(state.startTime)) / 1000 / 60)
    : 0;
  if (elapsed > 0) {
    message += `⏱️ ผ่านมาแล้ว: ~${elapsed} นาที\n`;
  }

  message += "\n";
  message += "━━━━━━━━━━━━━━━━━━━━━━━\n";
  message += "💡 คำแนะนำ:\n";
  message += '• ใช้ "♻️ Resume Batch Pull" เพื่อดึงต่อ\n';
  message += '• ใช้ "🗑️ Clear Batch State" เพื่อเริ่มใหม่\n';

  ui.alert("📊 Batch State Status", message, ui.ButtonSet.OK);
}

// ============================================
// 🔄 BACKGROUND TRIGGER - รันใน Background
// ============================================

/**
 * 📅 แสดง Dialog สำหรับตั้งค่า Automated Schedule
 */
function showAutomatedSchedulerDialog() {
  const scriptProperties = PropertiesService.getScriptProperties();

  // ตรวจสอบ credentials
  const hasSavedCreds = hasSavedCredentials();
  if (!hasSavedCreds) {
    SpreadsheetApp.getUi().alert(
      "⚠️ ต้อง Login ก่อน",
      "กรุณา Login ก่อนตั้งค่า Schedule\n\nใช้เมนู: 🔐 Login & Pull Data",
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
    return;
  }

  // ดึงค่าที่บันทึกไว้
  const today = new Date();
  const todayStr = Utilities.formatDate(
    today,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd",
  );
  const savedStartDate = scriptProperties.getProperty("START_DATE") || todayStr;
  const savedEndDate = scriptProperties.getProperty("END_DATE") || todayStr;
  const savedStatusId = scriptProperties.getProperty("STATUS_ID") || "";
  const savedLimit = scriptProperties.getProperty("LIMIT") || "50";

  const html = HtmlService.createHtmlOutput(
    `
    <!DOCTYPE html>
    <html>
    <head>
      <base target="_top">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          max-width: 500px;
          margin: 0 auto;
          background: white;
          padding: 25px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h2 {
          color: #4285F4;
          margin-top: 0;
          margin-bottom: 5px;
          text-align: center;
        }
        .subtitle {
          text-align: center;
          color: #666;
          font-size: 13px;
          margin-bottom: 20px;
        }
        .form-group {
          margin-bottom: 15px;
        }
        label {
          display: block;
          font-weight: 500;
          margin-bottom: 5px;
          color: #333;
          font-size: 13px;
        }
        input[type="date"],
        input[type="number"],
        select {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          box-sizing: border-box;
        }
        input:focus,
        select:focus {
          outline: none;
          border-color: #4285F4;
        }
        .hint {
          font-size: 11px;
          color: #888;
          margin-top: 3px;
        }
        .btn-group {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }
        button {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.3s;
        }
        .btn-primary {
          background: #4285F4;
          color: white;
        }
        .btn-primary:hover {
          background: #3367D6;
        }
        .btn-secondary {
          background: #f1f3f4;
          color: #333;
        }
        .btn-secondary:hover {
          background: #e8eaed;
        }
        .btn-danger {
          background: #EA4335;
          color: white;
        }
        .btn-danger:hover {
          background: #D33426;
        }
        .info-box {
          background: #e8f0fe;
          padding: 12px;
          border-radius: 4px;
          font-size: 12px;
          color: #1967d2;
          margin-bottom: 15px;
        }
        .warning-box {
          background: #fff3e0;
          border-left: 4px solid #ff9800;
          padding: 12px;
          border-radius: 4px;
          font-size: 12px;
          color: #e65100;
          margin-bottom: 15px;
        }
        .schedule-options {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .schedule-option {
          padding: 10px;
          border: 2px solid #ddd;
          border-radius: 6px;
          cursor: pointer;
          text-align: center;
          transition: all 0.3s;
        }
        .schedule-option:hover {
          border-color: #4285F4;
          background: #e8f0fe;
        }
        .schedule-option.selected {
          border-color: #4285F4;
          background: #e8f0fe;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div style="text-align: center; font-size: 48px; margin-bottom: 10px;">⏰</div>
        <h2>📅 Automated Scheduler</h2>
        <div class="subtitle">ตั้งค่ารันอัตโนมัติทุก กี่นาที/ชั่วโมง/วัน</div>

        <div class="info-box">
          💡 สร้าง Trigger ให้รัน Append อัตโนมัติ<br>
          เหมาะสำหรับดึงข้อมูลประจำ (รายวัน, รายชั่วโมง)
        </div>

        <form id="scheduleForm" onsubmit="handleSubmit(event)">
          <div class="form-group">
            <label>📋 เลือกรูปแบบการรัน:</label>
            <div class="schedule-options">
              <div class="schedule-option" onclick="selectScheduleType('MINUTES')" id="opt-MINUTES">
                <div style="font-size: 24px;">⏱️</div>
                <div style="font-weight: bold; margin-top: 5px;">ทุกกี่นาที</div>
                <div style="font-size: 11px; color: #666;">5, 10, 15, 30 นาที</div>
              </div>
              <div class="schedule-option" onclick="selectScheduleType('HOURS')" id="opt-HOURS">
                <div style="font-size: 24px;">🕐</div>
                <div style="font-weight: bold; margin-top: 5px;">ทุกกี่ชั่วโมง</div>
                <div style="font-size: 11px; color: #666;">1, 2, 3, 6, 12 ชั่วโมง</div>
              </div>
              <div class="schedule-option" onclick="selectScheduleType('DAYS')" id="opt-DAYS">
                <div style="font-size: 24px;">📅</div>
                <div style="font-weight: bold; margin-top: 5px;">ทุกวัน</div>
                <div style="font-size: 11px; color: #666;">รันทุกวัน</div>
              </div>
              <div class="schedule-option" onclick="selectScheduleType('WEEKLY')" id="opt-WEEKLY">
                <div style="font-size: 24px;">📆</div>
                <div style="font-weight: bold; margin-top: 5px;">ทุกสัปดาห์</div>
                <div style="font-size: 11px; color: #666;">เลือกวันทำงาน</div>
              </div>
            </div>
          </div>

          <div class="form-group" id="intervalGroup" style="display: none;">
            <label for="interval">🔢 รันทุก:</label>
            <select id="interval">
              <option value="5">ทุก 5 นาที</option>
              <option value="10">ทุก 10 นาที</option>
              <option value="15">ทุก 15 นาที</option>
              <option value="30" selected>ทุก 30 นาที</option>
            </select>
          </div>

          <div class="form-group" id="hoursGroup" style="display: none;">
            <label for="hours">🔢 รันทุงกี่ชั่วโมง:</label>
            <select id="hours">
              <option value="1">ทุก 1 ชั่วโมง</option>
              <option value="2">ทุก 2 ชั่วโมง</option>
              <option value="3">ทุก 3 ชั่วโมง</option>
              <option value="4">ทุก 4 ชั่วโมง</option>
              <option value="6" selected>ทุก 6 ชั่วโมง</option>
              <option value="8">ทุก 8 ชั่วโมง</option>
              <option value="12">ทุก 12 ชั่วโมง</option>
            </select>
          </div>

          <div class="form-group" id="dayOfWeekGroup" style="display: none;">
            <label for="dayOfWeek">📅 เลือกวัน:</label>
            <select id="dayOfWeek">
              <option value="1">จันทร์</option>
              <option value="2">อังคาร</option>
              <option value="3">พุธ</option>
              <option value="4">พฤหัสบดี</option>
              <option value="5">ศุกร์</option>
              <option value="6">เสาร์</option>
              <option value="0">อาทิตย์</option>
            </select>
            <div class="hint">และรันเวลา: <input type="number" id="hourOfDay" value="9" min="0" max="23" style="width: 60px; padding: 5px;"> นาฬิกา</div>
          </div>

          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">

          <h3 style="font-size: 14px; margin-top: 0;">📋 กำหนดพารามิเตอร์การดึงข้อมูล:</h3>

          <div class="form-group">
            <label for="startDate">📅 วันที่เริ่ม</label>
            <input type="date" id="startDate" value="${savedStartDate}" required>
          </div>

          <div class="form-group">
            <label for="endDate">📅 วันที่สิ้นสุด</label>
            <input type="date" id="endDate" value="${savedEndDate}" required>
          </div>

          <div class="form-group">
            <label for="statusId">🔢 Status ID</label>
            <select id="statusId">
              <option value="" ${!savedStatusId ? "selected" : ""}>ทุก Status (1-5)</option>
              <option value="1" ${savedStatusId === "1" ? "selected" : ""}>1 - Open</option>
              <option value="2" ${savedStatusId === "2" ? "selected" : ""}>2 - In Progress</option>
              <option value="3" ${savedStatusId === "3" ? "selected" : ""}>3 - Completed</option>
              <option value="4" ${savedStatusId === "4" ? "selected" : ""}>4 - Cancelled</option>
              <option value="5" ${savedStatusId === "5" ? "selected" : ""}>5 - Other</option>
            </select>
          </div>

          <div class="form-group">
            <label for="limit">📊 Limit (จำนวนสูงสุดต่อ Status)</label>
            <input type="number" id="limit" value="${savedLimit}" min="1" max="5000">
            <div class="hint">ถ้าไม่ระบุจะดึงทั้งหมด</div>
          </div>

          <div class="warning-box">
            ⚠️ <strong>คำเตือน:</strong><br>
            • Trigger จะรันตามเวลาที่ตั้งไว้<br>
            • แต่ละครั้งจะดึงข้อมูลแบบ Append (เพิ่มใหม่)<br>
            • ระวังจำนวน triggers ใน Google Apps Script (จำกัด 20 ตัว/โปรเจกต์)
          </div>

          <div class="btn-group">
            <button type="button" class="btn-danger" onclick="clearAllSchedules()">🗑️ ลบทั้งหมด</button>
            <button type="button" class="btn-secondary" onclick="google.script.host.close()">ปิด</button>
            <button type="button" class="btn-primary" onclick="submitSchedule()">⏰ ตั้งค่า Schedule</button>
          </div>
        </form>
      </div>

      <script>
        let selectedType = '';

        function selectScheduleType(type) {
          selectedType = type;

          // Reset all
          document.querySelectorAll('.schedule-option').forEach(el => el.classList.remove('selected'));
          document.getElementById('intervalGroup').style.display = 'none';
          document.getElementById('hoursGroup').style.display = 'none';
          document.getElementById('dayOfWeekGroup').style.display = 'none';

          // Select current
          document.getElementById('opt-' + type).classList.add('selected');

          // Show relevant group
          if (type === 'MINUTES') {
            document.getElementById('intervalGroup').style.display = 'block';
          } else if (type === 'HOURS') {
            document.getElementById('hoursGroup').style.display = 'block';
          } else if (type === 'WEEKLY') {
            document.getElementById('dayOfWeekGroup').style.display = 'block';
          }
        }

        function submitSchedule() {
          if (!selectedType) {
            alert('❌ กรุณาเลือกรูปแบบการรัน');
            return;
          }

          const startDate = document.getElementById('startDate').value;
          const endDate = document.getElementById('endDate').value;
          const statusId = document.getElementById('statusId').value;
          const limit = document.getElementById('limit').value;

          if (!startDate || !endDate) {
            alert('❌ กรุณาระบุวันที่เริ่มและวันที่สิ้นสุด');
            return;
          }

          if (startDate > endDate) {
            alert('❌ วันที่เริ่มต้องไม่หลังวันที่สิ้นสุด');
            return;
          }

          let scheduleText = '';
          if (selectedType === 'MINUTES') {
            const interval = document.getElementById('interval').value;
            scheduleText = 'ทุก ' + interval + ' นาที';
          } else if (selectedType === 'HOURS') {
            const hours = document.getElementById('hours').value;
            scheduleText = 'ทุก ' + hours + ' ชั่วโมง';
          } else if (selectedType === 'DAYS') {
            scheduleText = 'ทุกวัน';
          } else if (selectedType === 'WEEKLY') {
            const dayNames = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
            const dayOfWeek = parseInt(document.getElementById('dayOfWeek').value);
            const hourOfDay = document.getElementById('hourOfDay').value;
            scheduleText = dayNames[dayOfWeek] + ' เวลา ' + hourOfDay + ':00';
          }

          const statusText = statusId === 'ALL' ? 'ทุก Status' : 'Status ' + statusId;
          const limitText = limit ? 'Limit ' + limit : 'ไม่จำกัด';

          const confirmed = confirm(
            '⏰ ยืนยันตั้งค่า Automated Schedule?\\n\\n' +
            'รูปแบบ: ' + scheduleText + '\\n' +
            'ช่วงเวลา: ' + startDate + ' ถึง ' + endDate + '\\n' +
            'Status: ' + statusText + '\\n' +
            'Limit: ' + limitText + '\\n\\n' +
            '✅ ระบบจะรันอัตโนมัติตามเวลาที่กำหนด'
          );

          if (confirmed) {
            const scheduleData = {
              type: selectedType,
              interval: selectedType === 'MINUTES' ? document.getElementById('interval').value : null,
              hours: selectedType === 'HOURS' ? document.getElementById('hours').value : null,
              dayOfWeek: selectedType === 'WEEKLY' ? document.getElementById('dayOfWeek').value : null,
              hourOfDay: selectedType === 'WEEKLY' ? document.getElementById('hourOfDay').value : null,
              startDate: startDate,
              endDate: endDate,
              statusId: statusId,
              limit: limit
            };

            google.script.run
              .withSuccessHandler(function(result) {
                if (result.success) {
                  alert('✅ ตั้งค่า Schedule สำเร็จ!\\n\\n' + result.message);
                  google.script.host.close();
                } else {
                  alert('❌ เกิดข้อผิดพลาด: ' + result.message);
                }
              })
              .withFailureHandler(function(error) {
                alert('❌ เกิดข้อผิดพลาด: ' + error.message);
              })
              .createAutomatedSchedule(scheduleData);
          }
        }

        function clearAllSchedules() {
          if (confirm('🗑️ ยืนยันลบ Automated Schedules ทั้งหมด?')) {
            google.script.run
              .withSuccessHandler(function(result) {
                alert('✅ ลบ Schedules สำเร็จ!\\n\\n' + result.message);
              })
              .withFailureHandler(function(error) {
                alert('❌ เกิดข้อผิดพลาด: ' + error.message);
              })
              .clearAllAutomatedSchedules();
          }
        }
      </script>
    </body>
    </html>
  `,
  )
    .setWidth(520)
    .setHeight(750)
    .setTitle("⏰ Automated Scheduler");

  SpreadsheetApp.getUi().showModalDialog(html, "Automated Scheduler");
}

/**
 * 📅 สร้าง Automated Schedule Trigger
 * @param {object} scheduleData - ข้อมูล schedule
 * @returns {object} - { success: boolean, message: string }
 */
function createAutomatedSchedule(scheduleData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const scriptProperties = PropertiesService.getScriptProperties();

  try {
    // 1. บันทึก schedule data
    scriptProperties.setProperty(
      "AUTOMATED_SCHEDULE_DATA",
      JSON.stringify(scheduleData),
    );

    // 2. สร้าง trigger ตามประเภท
    let trigger;
    const triggerBuilder = ScriptApp.newTrigger("triggerAutomatedPull");

    switch (scheduleData.type) {
      case "MINUTES":
        const interval = parseInt(scheduleData.interval);
        trigger = triggerBuilder.timeBased().everyMinutes(interval).create();
        break;

      case "HOURS":
        const hours = parseInt(scheduleData.hours);
        trigger = triggerBuilder.timeBased().everyHours(hours).create();
        break;

      case "DAYS":
        trigger = triggerBuilder.timeBased().everyDays(1).create();
        break;

      case "WEEKLY":
        const dayOfWeek = parseInt(scheduleData.dayOfWeek);
        const hourOfDay = parseInt(scheduleData.hourOfDay);
        trigger = triggerBuilder
          .timeBased()
          .everyWeek()
          .onWeekDay(dayOfWeek)
          .atHour(hourOfDay)
          .create();
        break;

      default:
        throw new Error("Invalid schedule type: " + scheduleData.type);
    }

    Logger.log(
      `✅ Automated trigger created: ${scheduleData.type} - ${trigger.getTriggerSource()}`,
    );

    // 3. ส่ง email แจ้งเตือน
    try {
      const userEmail = Session.getActiveUser().getEmail();
      if (userEmail && userEmail !== "") {
        let scheduleText = "";
        if (scheduleData.type === "MINUTES") {
          scheduleText = `ทุก ${scheduleData.interval} นาที`;
        } else if (scheduleData.type === "HOURS") {
          scheduleText = `ทุก ${scheduleData.hours} ชั่วโมง`;
        } else if (scheduleData.type === "DAYS") {
          scheduleText = "ทุกวัน";
        } else if (scheduleData.type === "WEEKLY") {
          const dayNames = [
            "อาทิตย์",
            "จันทร์",
            "อังคาร",
            "พุธ",
            "พฤหัสบดี",
            "ศุกร์",
            "เสาร์",
          ];
          scheduleText = `${dayNames[scheduleData.dayOfWeek]} เวลา ${scheduleData.hourOfDay}:00`;
        }

        MailApp.sendEmail({
          to: userEmail,
          subject: "⏰ MLSTMS - Automated Schedule Created",
          htmlBody: `
            <h2>⏰ Automated Schedule Created!</h2>
            <p>ระบบได้ตั้งค่ารันอัตโนมัติเรียบร้อยแล้ว</p>

            <h3>รายละเอียด Schedule:</h3>
            <ul>
              <li><strong>รูปแบบ:</strong> ${scheduleText}</li>
              <li><strong>วันที่:</strong> ${scheduleData.startDate} ถึง ${scheduleData.endDate}</li>
              <li><strong>Status:</strong> ${scheduleData.statusId === "" ? "ทุก Status" : "Status " + scheduleData.statusId}</li>
              <li><strong>Limit:</strong> ${scheduleData.limit ? scheduleData.limit + " รายการ/Status" : "ไม่จำกัด"}</li>
            </ul>

            <p>✅ ระบบจะรันอัตโนมัติตามเวลาที่กำหนด</p>
            <p>📧 แจ้งเตือนผ่าน Email ทุกครั้งที่รันเสร็จ</p>

            <hr>
            <small style="color: #999;">
              ตั้งค่าเมื่อ: ${new Date().toLocaleString("th-TH")}<br>
              Google Apps Script - MLSTMS TripsToSheets
            </small>
          `,
        });
      }
    } catch (emailError) {
      Logger.log(`⚠️ Could not send email: ${emailError.message}`);
    }

    return {
      success: true,
      message:
        `ตั้งค่า Automated Schedule สำเร็จ!\n\n` +
        `• รูปแบบ: ${scheduleText}\n` +
        `• วันที่: ${scheduleData.startDate} ถึง ${scheduleData.endDate}\n` +
        `• Status: ${scheduleData.statusId === "" ? "ทุก Status" : scheduleData.statusId}\n` +
        `• Limit: ${scheduleData.limit || "ไม่จำกัด"}\n\n` +
        `✅ ระบบจะรันอัตโนมัติตามเวลาที่กำหนด`,
    };
  } catch (error) {
    Logger.log(`❌ Create automated schedule error: ${error.message}`);
    return {
      success: false,
      message: `สร้าง schedule ไม่สำเร็จ: ${error.message}`,
    };
  }
}

/**
 * 🔄 Trigger Function - รัน Automated Pull
 * ฟังก์ชันนี้ถูกเรียกโดย automated trigger
 */
function triggerAutomatedPull() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const scriptProperties = PropertiesService.getScriptProperties();
  const startTime = new Date();
  let success = false;
  let errorMessage = "";

  try {
    // 1. อ่าน schedule data
    const scheduleDataJson =
      scriptProperties.getProperty("AUTOMATED_SCHEDULE_DATA");
    if (!scheduleDataJson) {
      throw new Error("ไม่พบ schedule data");
    }

    const scheduleData = JSON.parse(scheduleDataJson);

    Logger.log("🔄 Automated trigger started:");
    Logger.log(JSON.stringify(scheduleData, null, 2));

    // 2. บันทึก parameters ลงใน TEMP
    scriptProperties.setProperty("TEMP_START_DATE", scheduleData.startDate);
    scriptProperties.setProperty("TEMP_END_DATE", scheduleData.endDate);
    scriptProperties.setProperty("TEMP_STATUS_ID", scheduleData.statusId);
    scriptProperties.setProperty("TEMP_LIMIT", scheduleData.limit);

    // 3. เรียก executePullTripsToSheetAppend
    const result = executePullTripsToSheetAppend();
    success = result.success;
    errorMessage = result.message || "";

    Logger.log(
      success ? "✅ Automated pull completed" : "❌ Automated pull failed",
    );
  } catch (error) {
    success = false;
    errorMessage = error.message;
    Logger.log(`❌ Automated trigger error: ${error.message}`);
  } finally {
    // 4. ส่ง email แจ้งผล (เฉพาะถ้าล้มเหลว หรือสำเร็จแต่มีข้อควรรู้)
    try {
      const userEmail = Session.getActiveUser().getEmail();
      if (userEmail && userEmail !== "") {
        const endTime = new Date();
        const duration = Math.round((endTime - startTime) / 1000);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;

        if (!success) {
          MailApp.sendEmail({
            to: userEmail,
            subject: "❌ MLSTMS - Automated Pull Failed",
            htmlBody: `
              <h2>❌ Automated Pull Failed</h2>
              <p>การดึงข้อมูลอัตโนมัติล้มเหลว</p>

              <h3>รายละเอียด:</h3>
              <ul>
                <li><strong>สถานะ:</strong> <span style="color: red;">ล้มเหลว</span></li>
                <li><strong>ข้อผิดพลาด:</strong> ${errorMessage}</li>
                <li><strong>เริ่มเมื่อ:</strong> ${startTime.toLocaleString("th-TH")}</li>
                <li><strong>ล้มเหลวเมื่อ:</strong> ${endTime.toLocaleString("th-TH")}</li>
              </ul>

              <p>💡 ตรวจสอบ logs หรือตรวจสอบ schedule</p>

              <hr>
              <small style="color: #999;">
                ล้มเหลว: ${endTime.toLocaleString("th-TH")}<br>
                Google Apps Script - MLSTMS TripsToSheets
              </small>
            `,
          });
        }
      }
    } catch (emailError) {
      Logger.log(`⚠️ Could not send result email: ${emailError.message}`);
    }
  }
}

/**
 * 🗑️ ลบ Automated Schedules ทั้งหมด
 * @returns {object} - { success: boolean, message: string }
 */
function clearAllAutomatedSchedules() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  try {
    const triggers = ScriptApp.getProjectTriggers();
    const automatedTriggers = triggers.filter(
      (t) => t.getHandlerFunction() === "triggerAutomatedPull",
    );

    automatedTriggers.forEach((trigger) => {
      ScriptApp.deleteTrigger(trigger);
      Logger.log("🗑️ Deleted automated trigger");
    });

    // ลบ schedule data
    const scriptProperties = PropertiesService.getScriptProperties();
    scriptProperties.deleteProperty("AUTOMATED_SCHEDULE_DATA");

    ss.toast(
      `🗑️ Deleted ${automatedTriggers.length} automated schedules`,
      "MLSTMS Trips",
      5,
    );

    return {
      success: true,
      message: `ลบ Automated Schedules สำเร็จ!\n\nจำนวนที่ลบ: ${automatedTriggers.length} ตัว`,
    };
  } catch (error) {
    Logger.log(`❌ Clear automated schedules error: ${error.message}`);
    return {
      success: false,
      message: `ลบ schedules ไม่สำเร็จ: ${error.message}`,
    };
  }
}

/**
 * 📊 ดูสถานะ Automated Schedules
 */
function viewAutomatedSchedules() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const scriptProperties = PropertiesService.getScriptProperties();

  // ตรวจสอบ triggers ที่มีอยู่
  const triggers = ScriptApp.getProjectTriggers();
  const automatedTriggers = triggers.filter(
    (t) => t.getHandlerFunction() === "triggerAutomatedPull",
  );

  // ตรวจสอบ schedule data
  const scheduleDataJson =
    scriptProperties.getProperty("AUTOMATED_SCHEDULE_DATA");
  let scheduleData = null;
  let scheduleText = "";

  if (scheduleDataJson) {
    try {
      scheduleData = JSON.parse(scheduleDataJson);

      if (scheduleData.type === "MINUTES") {
        scheduleText = `⏱️ ทุก ${scheduleData.interval} นาที`;
      } else if (scheduleData.type === "HOURS") {
        scheduleText = `🕐 ทุก ${scheduleData.hours} ชั่วโมง`;
      } else if (scheduleData.type === "DAYS") {
        scheduleText = `📅 ทุกวัน`;
      } else if (scheduleData.type === "WEEKLY") {
        const dayNames = [
          "อาทิตย์",
          "จันทร์",
          "อังคาร",
          "พุธ",
          "พฤหัสบดี",
          "ศุกร์",
          "เสาร์",
        ];
        scheduleText = `📆 ทุก${dayNames[scheduleData.dayOfWeek]} เวลา ${scheduleData.hourOfDay}:00`;
      }
    } catch (e) {
      Logger.log(`⚠️ Could not parse schedule data: ${e.message}`);
    }
  }

  let message = "📊 สถานะ Automated Schedules\n\n";
  message += "━━━━━━━━━━━━━━━━━━━━━━━\n\n";

  // Schedule ที่ตั้งไว้
  if (scheduleData) {
    message += `✅ Active Schedule: ${scheduleText}\n\n`;
    message += `📋 รายละเอียด:\n`;
    message += `• วันที่: ${scheduleData.startDate} ถึง ${scheduleData.endDate}\n`;
    message += `• Status: ${scheduleData.statusId === "" ? "ทุก Status" : "Status " + scheduleData.statusId}\n`;
    message += `• Limit: ${scheduleData.limit || "ไม่จำกัด"}\n\n`;
  } else {
    message += `❌ ไม่มี Active Schedule\n\n`;
  }

  // Triggers ที่มีอยู่
  if (automatedTriggers.length > 0) {
    message += `🔧 Active Triggers: ${automatedTriggers.length} ตัว\n\n`;

    automatedTriggers.forEach((trigger, index) => {
      message += `Trigger #${index + 1}:\n`;
      message += `• Type: ${trigger.getTriggerSource()}\n`;
      message += `• Handler: ${trigger.getHandlerFunction()}\n`;
      message += `• Unique ID: ${trigger.getUniqueId()}\n\n`;
    });
  }

  message += "━━━━━━━━━━━━━━━━━━━━━━━\n\n";
  message += "💡 การจัดการ:\n";
  message += '• ใช้เมนู "⏰ Automated Scheduler" เพื่อสร้าง schedule ใหม่\n';
  message += '• ใช้เมนู "⏰ Automated Scheduler" → "🗑️ ลบทั้งหมด" เพื่อลบ schedule\n';
  message += '• ระวังจำนวน triggers ใน Google Apps Script (จำกัด 20 ตัว/โปรเจกต์)\n';

  if (automatedTriggers.length === 0 && scheduleData) {
    message += '\n⚠️ พบ Schedule Data แต่ไม่มี Trigger\n';
    message += '• อาจต้องสร้าง schedule ใหม่\n';
  }

  ui.alert("📊 Automated Schedules Status", message, ui.ButtonSet.OK);
}

/**
 * 🔄 สร้าง Trigger สำหรับ Append Pull (Background Mode)
 * @param {string} startDate - วันที่เริ่ม
 * @param {string} endDate - วันที่สิ้นสุด
 * @param {string} statusId - Status ID
 * @param {string} limit - Limit
 * @returns {object} - { success: boolean, message: string }
 */
function scheduleAppendPullTrigger(startDate, endDate, statusId, limit) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const scriptProperties = PropertiesService.getScriptProperties();

  try {
    // 1. บันทึก parameters สำหรับ trigger
    const triggerData = {
      startDate: startDate,
      endDate: endDate,
      statusId: statusId,
      limit: limit,
      scheduledAt: new Date().toISOString(),
      triggerType: "APPEND_PULL",
    };

    scriptProperties.setProperty(
      "BACKGROUND_TRIGGER_DATA",
      JSON.stringify(triggerData),
    );

    // 2. ลบ trigger เก่า (ถ้ามี)
    clearAppendPullTriggers();

    // 3. สร้าง trigger ใหม่ (รันใน 1-2 นาที)
    ScriptApp.newTrigger("triggerAppendPull")
      .timeBased()
      .after(60 * 1000) // 1 นาที
      .create();

    Logger.log("✅ Background trigger scheduled for APPEND_PULL");

    // 4. ส่ง email แจ้งเตือน (ถ้ามีอยู่แล้ว)
    try {
      const userEmail = Session.getActiveUser().getEmail();
      if (userEmail && userEmail !== "") {
        MailApp.sendEmail({
          to: userEmail,
          subject: "🔄 MLSTMS - Background Append Scheduled",
          htmlBody: `
            <h2>🔄 Background Append Trigger Scheduled</h2>
            <p>ระบบได้ตั้งค่าให้ดึงข้อมูลแบบ Append ใน Background แล้ว</p>

            <h3>รายละเอียด:</h3>
            <ul>
              <li><strong>วันที่เริ่ม:</strong> ${startDate}</li>
              <li><strong>วันที่สิ้นสุด:</strong> ${endDate}</li>
              <li><strong>Status:</strong> ${statusId === "ALL" ? "ทุก Status (1-5)" : "Status " + statusId}</li>
              <li><strong>Limit:</strong> ${limit ? limit + " รายการ/Status" : "ไม่จำกัด"}</li>
              <li><strong>เริ่มรันใน:</strong> ~1-2 นาที</li>
            </ul>

            <p>✅ คุณสามารถปิดหน้าต่างนี้ได้เลย - ระบบจะทำงานอัตโนมัติ</p>
            <p>📧 แจ้งเตือนผลลัพธ์ผ่าน Email เมื่อเสร็จสิ้น</p>

            <hr>
            <small style="color: #999;">
              ติดตั้งเมื่อ: ${new Date().toLocaleString("th-TH")}<br>
              Google Apps Script - MLSTMS TripsToSheets
            </small>
          `,
        });
      }
    } catch (emailError) {
      Logger.log(`⚠️ Could not send email: ${emailError.message}`);
    }

    return {
      success: true,
      message:
        `ตั้งค่า Background Append สำเร็จ!\n\n` +
        `• ระบบจะเริ่มรันใน 1-2 นาที\n` +
        `• สามารถปิดหน้าต่างไปได้\n` +
        `• แจ้งเตือนผ่าน Email เมื่อเสร็จสิ้น\n\n` +
        `📊 รายละเอียด:\n` +
        `• วันที่: ${startDate} ถึง ${endDate}\n` +
        `• Status: ${statusId === "ALL" ? "ทุก Status" : statusId}\n` +
        `• Limit: ${limit || "ไม่จำกัด"}`,
    };
  } catch (error) {
    Logger.log(`❌ Schedule trigger error: ${error.message}`);
    return {
      success: false,
      message: `สร้าง trigger ไม่สำเร็จ: ${error.message}`,
    };
  }
}

/**
 * 🔄 Trigger Function - รัน Append Pull ใน Background
 * ฟังก์ชันนี้ถูกเรียกโดย trigger
 */
function triggerAppendPull() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const scriptProperties = PropertiesService.getScriptProperties();
  const startTime = new Date();
  let success = false;
  let errorMessage = "";

  try {
    // 1. อ่าน trigger data
    const triggerDataJson =
      scriptProperties.getProperty("BACKGROUND_TRIGGER_DATA");
    if (!triggerDataJson) {
      throw new Error("ไม่พบ trigger data");
    }

    const triggerData = JSON.parse(triggerDataJson);

    Logger.log("🔄 Trigger started:");
    Logger.log(JSON.stringify(triggerData, null, 2));

    // 2. บันทึก parameters ลงใน TEMP (เพื่อให้ executePullTripsToSheetAppend อ่านค่าได้)
    scriptProperties.setProperty("TEMP_START_DATE", triggerData.startDate);
    scriptProperties.setProperty("TEMP_END_DATE", triggerData.endDate);
    scriptProperties.setProperty("TEMP_STATUS_ID", triggerData.statusId);
    scriptProperties.setProperty("TEMP_LIMIT", triggerData.limit);

    // 3. เรียก executePullTripsToSheetAppend
    const result = executePullTripsToSheetAppend();
    success = result.success;
    errorMessage = result.message || "";

    // 4. ลบ trigger data
    scriptProperties.deleteProperty("BACKGROUND_TRIGGER_DATA");

    Logger.log("✅ Trigger completed successfully");
  } catch (error) {
    success = false;
    errorMessage = error.message;
    Logger.log(`❌ Trigger error: ${error.message}`);
  } finally {
    // 5. ลบ triggers เก่า
    clearAppendPullTriggers();

    // 6. ส่ง email แจ้งผล
    try {
      const userEmail = Session.getActiveUser().getEmail();
      if (userEmail && userEmail !== "") {
        const endTime = new Date();
        const duration = Math.round((endTime - startTime) / 1000);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;

        if (success) {
          MailApp.sendEmail({
            to: userEmail,
            subject: "✅ MLSTMS - Background Append Completed!",
            htmlBody: `
              <h2>✅ Background Append Completed!</h2>
              <p>การดึงข้อมูลแบบ Append เสร็จสิ้นแล้ว</p>

              <h3>สรุป:</h3>
              <ul>
                <li><strong>สถานะ:</strong> <span style="color: green;">สำเร็จ</span></li>
                <li><strong>ระยะเวลา:</strong> ${minutes} นาที ${seconds} วินาที</li>
                <li><strong>เริ่มเมื่อ:</strong> ${startTime.toLocaleString("th-TH")}</li>
                <li><strong>เสร็จเมื่อ:</strong> ${endTime.toLocaleString("th-TH")}</li>
              </ul>

              <p>📊 ตรวจสอบข้อมูลใน Google Sheets ได้เลย</p>

              <hr>
              <small style="color: #999;">
                เสร็จสิ้น: ${endTime.toLocaleString("th-TH")}<br>
                Google Apps Script - MLSTMS TripsToSheets
              </small>
            `,
          });
        } else {
          MailApp.sendEmail({
            to: userEmail,
            subject: "❌ MLSTMS - Background Append Failed",
            htmlBody: `
              <h2>❌ Background Append Failed</h2>
              <p>การดึงข้อมูลแบบ Append ล้มเหลว</p>

              <h3>รายละเอียด:</h3>
              <ul>
                <li><strong>สถานะ:</strong> <span style="color: red;">ล้มเหลว</span></li>
                <li><strong>ข้อผิดพลาด:</strong> ${errorMessage}</li>
                <li><strong>เริ่มเมื่อ:</strong> ${startTime.toLocaleString("th-TH")}</li>
                <li><strong>ล้มเหลวเมื่อ:</strong> ${new Date().toLocaleString("th-TH")}</li>
              </ul>

              <p>💡 ลองตรวจสอบ logs หรือลองใหม่อีกครั้ง</p>

              <hr>
              <small style="color: #999;">
                ล้มเหลว: ${new Date().toLocaleString("th-TH")}<br>
                Google Apps Script - MLSTMS TripsToSheets
              </small>
            `,
          });
        }
      }
    } catch (emailError) {
      Logger.log(`⚠️ Could not send result email: ${emailError.message}`);
    }
  }
}

/**
 * 🗑️ ลบ Append Pull Triggers ทั้งหมด
 */
function clearAppendPullTriggers() {
  const triggers = ScriptApp.getProjectTriggers();

  triggers.forEach((trigger) => {
    if (trigger.getHandlerFunction() === "triggerAppendPull") {
      ScriptApp.deleteTrigger(trigger);
      Logger.log("🗑️ Deleted triggerAppendPull trigger");
    }
  });
}

/**
 * 📊 ดูสถานะ Background Triggers
 */
function viewBackgroundTriggers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const scriptProperties = PropertiesService.getScriptProperties();

  // ตรวจสอบ trigger ที่มีอยู่
  const triggers = ScriptApp.getProjectTriggers();
  const appendTriggers = triggers.filter(
    (t) => t.getHandlerFunction() === "triggerAppendPull",
  );

  // ตรวจสอบ trigger data
  const triggerDataJson =
    scriptProperties.getProperty("BACKGROUND_TRIGGER_DATA");
  let triggerData = null;
  if (triggerDataJson) {
    try {
      triggerData = JSON.parse(triggerDataJson);
    } catch (e) {
      Logger.log(`⚠️ Could not parse trigger data: ${e.message}`);
    }
  }

  let message = "📊 สถานะ Background Triggers\n\n";
  message += "━━━━━━━━━━━━━━━━━━━━━━━\n\n";

  // Trigger ที่มีอยู่
  if (appendTriggers.length > 0) {
    message += `✅ Active Triggers: ${appendTriggers.length}\n\n`;

    appendTriggers.forEach((trigger, index) => {
      message += `Trigger #${index + 1}:\n`;
      message += `• Type: ${trigger.getTriggerSource()}\n`;
      message += `• Handler: ${trigger.getHandlerFunction()}\n`;

      if (triggerData) {
        message += `\n📋 รายละเอียดงาน:\n`;
        message += `• วันที่: ${triggerData.startDate} ถึง ${triggerData.endDate}\n`;
        message += `• Status: ${triggerData.statusId === "ALL" ? "ทุก Status" : triggerData.statusId}\n`;
        message += `• Limit: ${triggerData.limit || "ไม่จำกัด"}\n`;
        message += `• ตั้งค่าเมื่อ: ${new Date(triggerData.scheduledAt).toLocaleString("th-TH")}\n`;
      }

      message += "\n";
    });
  } else {
    message += `❌ ไม่มี Active Triggers\n\n`;
  }

  // Trigger data ที่ค้างอยู่
  if (triggerData && appendTriggers.length === 0) {
    message += `⚠️ พบ Trigger Data แต่ไม่มี Trigger\n`;
    message += `• Trigger Type: ${triggerData.triggerType}\n`;
    message += `• ตั้งค่าเมื่อ: ${new Date(triggerData.scheduledAt).toLocaleString("th-TH")}\n\n`;
    message += `💡 อาจต้องสร้าง trigger ใหม่\n\n`;
  }

  message += "━━━━━━━━━━━━━━━━━━━━━━━\n\n";
  message += "💡 การจัดการ:\n";
  message += '• ใช้เมนู "🔄 Pull Mode" → "➕ Append" เพื่อสร้าง trigger ใหม่\n';
  message += '• Trigger จะถูกลบอัตโนมัติเมื่อทำงานเสร็จ\n';

  if (appendTriggers.length > 0) {
    message += '\n⚠️ ต้องการลบ trigger ที่ค้างอยู่?\n';
    message += 'ใช้เมนู "🗑️ Clear Background Triggers"';
  }

  ui.alert("📊 Background Triggers Status", message, ui.ButtonSet.OK);
}

/**
 * 🗑️ ลบ Background Triggers ทั้งหมด (ด้วย UI)
 */
function clearBackgroundTriggersWithUI() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  // ตรวจสอบ trigger ที่มีอยู่
  const triggers = ScriptApp.getProjectTriggers();
  const appendTriggers = triggers.filter(
    (t) => t.getHandlerFunction() === "triggerAppendPull",
  );

  if (appendTriggers.length === 0) {
    ui.alert(
      "ℹ️ ไม่มี Background Triggers",
      "ไม่พบ Background Triggers ที่ค้างอยู่\n\n" +
        "ไม่ต้องลบอะไร",
      ui.ButtonSet.OK,
    );
    return;
  }

  const response = ui.alert(
    "🗑️ ยืนยันลบ Background Triggers",
    `พบ Background Triggers: ${appendTriggers.length} ตัว\n\n` +
      "ต้องการลบทั้งหมดหรือไม่?\n\n" +
      "⚠️ หลังจากลบ:\n" +
      "• Trigger จะหยุดทำงานทันที\n" +
      "• ถ้างานยังไม่เสร็จ จะหยุดไปเลย",
    ui.ButtonSet.YES_NO,
  );

  if (response === ui.Button.YES) {
    clearAppendPullTriggers();

    // ลบ trigger data ด้วย
    const scriptProperties = PropertiesService.getScriptProperties();
    scriptProperties.deleteProperty("BACKGROUND_TRIGGER_DATA");

    ss.toast("🗑️ Background triggers deleted!", "MLSTMS Trips", 5);

    ui.alert(
      "✅ ลบ Background Triggers สำเร็จ!",
      `ลบ Background Triggers ทั้งหมดเรียบร้อย\n\n` +
        `จำนวนที่ลบ: ${appendTriggers.length} ตัว`,
      ui.ButtonSet.OK,
    );
  } else {
    ss.toast("❌ ยกเลิก - คง triggers ไว้", "MLSTMS Trips", 3);
  }
}

/**
 * 🔄 Reset All State (ลบทุกอย่าง - credentials + batch state)
 */
function resetAllState() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const scriptProperties = PropertiesService.getScriptProperties();

  // เช็คว่ามีอะไรอยู่บ้าง
  const hasCreds = hasSavedCredentials();
  const hasBatch = !!loadBatchState();

  let message = "🔄 Reset ทุกอย่าง\n\n";
  message += "รายการที่จะลบ:\n";
  message += "━━━━━━━━━━━━━━━━━━━━━━━\n";

  if (hasCreds) {
    message += "✅ Username & Password (credentials)\n";
    message += "✅ Access Token & Refresh Token\n";
  } else {
    message += "❌ Credentials (ไม่มี)\n";
  }

  if (hasBatch) {
    message += "✅ Batch State (state ที่ค้างอยู่)\n";
  } else {
    message += "❌ Batch State (ไม่มี)\n";
  }

  message += "\n";
  message += "⚠️ หลังจาก Reset:\n";
  message += "• ต้อง Login ใหม่ทั้งหมด\n";
  message += "• ต้องเริ่ม batch pull ใหม่\n";
  message += "• ข้อมูลในชีทจะยังอยู่\n\n";
  message += "ยืนยันที่จะ Reset?";

  const response = ui.alert("🔄 Reset All State", message, ui.ButtonSet.YES_NO);

  if (response === ui.Button.YES) {
    // ลบทุกอย่าง
    if (hasCreds) {
      scriptProperties.deleteProperty("USERNAME");
      scriptProperties.deleteProperty("PASSWORD");
      scriptProperties.deleteProperty("ACCESS_TOKEN");
      scriptProperties.deleteProperty("REFRESH_TOKEN");
      scriptProperties.deleteProperty("TOKEN_EXPIRES_AT");
      Logger.log("🗑️ Credentials cleared");
    }

    if (hasBatch) {
      clearBatchState();
      Logger.log("🗑️ Batch state cleared");
    }

    ss.toast("🔄 Reset complete!", "MLSTMS Trips", 5);

    ui.alert(
      "✅ Reset สำเร็จ!",
      "ลบข้อมูลทั้งหมดเรียบร้อย\n\n" +
        "กรุณา Login ใหม่ที่เมนู:\n" +
        "🔐 Login & Pull Data",
      ui.ButtonSet.OK,
    );
  } else {
    ss.toast("❌ ยกเลิก - คงข้อมูลไว้", "MLSTMS Trips", 3);
  }
}

// ═══════════════════════════════════════════════════════════════
// 🔄 โหมดดึงข้อมูล - Fresh Start (เริ่มใหม่) และ Append (เพิ่ม)
// ═══════════════════════════════════════════════════════════════

/**
 * 🔄 แสดง Dialog สำหรับ Pull Mode - Fresh Start (เริ่มใหม่)
 */
function showPullModeFreshDialog() {
  const scriptProperties = PropertiesService.getScriptProperties();

  // ตรวจสอบ credentials
  const hasSavedCreds = hasSavedCredentials();
  if (!hasSavedCreds) {
    SpreadsheetApp.getUi().alert(
      "⚠️ ต้อง Login ก่อน",
      "กรุณา Login ก่อนดึงข้อมูล\n\nใช้เมนู: 🔐 Login & Pull Data",
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
    return;
  }

  // ดึงค่าที่บันทึกไว้
  const today = new Date();
  const todayStr = Utilities.formatDate(
    today,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd",
  );
  const savedStartDate = scriptProperties.getProperty("START_DATE") || todayStr;
  const savedEndDate = scriptProperties.getProperty("END_DATE") || todayStr;
  const savedStatusId = scriptProperties.getProperty("STATUS_ID") || "";
  const savedLimit = scriptProperties.getProperty("LIMIT") || "50";

  const html = HtmlService.createHtmlOutput(
    `
    <!DOCTYPE html>
    <html>
    <head>
      <base target="_top">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          max-width: 450px;
          margin: 0 auto;
          background: white;
          padding: 25px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h2 {
          color: #EA4335;
          margin-top: 0;
          margin-bottom: 5px;
          text-align: center;
        }
        .subtitle {
          text-align: center;
          color: #666;
          font-size: 13px;
          margin-bottom: 20px;
        }
        .form-group {
          margin-bottom: 15px;
        }
        label {
          display: block;
          font-weight: 500;
          margin-bottom: 5px;
          color: #333;
          font-size: 13px;
        }
        input[type="date"],
        select {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          box-sizing: border-box;
        }
        input:focus,
        select:focus {
          outline: none;
          border-color: #EA4335;
        }
        .hint {
          font-size: 11px;
          color: #888;
          margin-top: 3px;
        }
        .btn-group {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }
        button {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.3s;
        }
        .btn-danger {
          background: #EA4335;
          color: white;
        }
        .btn-danger:hover {
          background: #D33426;
        }
        .btn-secondary {
          background: #f1f3f4;
          color: #333;
        }
        .btn-secondary:hover {
          background: #e8eaed;
        }
        .warning-box {
          background: #fce8e6;
          padding: 12px;
          border-radius: 4px;
          font-size: 12px;
          color: #c5221f;
          margin-bottom: 15px;
        }
        .info-box {
          background: #e8f0fe;
          padding: 12px;
          border-radius: 4px;
          font-size: 12px;
          color: #1967d2;
          margin-bottom: 15px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>🔄 Fresh Start (เริ่มใหม่)</h2>
        <div class="subtitle">ล้างข้อมูลเก่าแล้วดึงใหม่ทั้งหมด</div>

        <div class="warning-box">
          ⚠️ โหมดนี้จะล้างข้อมูลเก่าทั้งหมด<br>
          ข้อมูลเดิมในชีทจะหายไป!
        </div>

        <div class="info-box">
          💡 เหมาะสำหรับ: ดึงข้อมูลครั้งแรก, ต้องการรีเฟรชข้อมูลทั้งหมด
        </div>

        <div class="form-group">
          <label for="startDate">📅 วันที่เริ่ม</label>
          <input type="date" id="startDate" value="${savedStartDate}" required>
        </div>

        <div class="form-group">
          <label for="endDate">📅 วันที่สิ้นสุด</label>
          <input type="date" id="endDate" value="${savedEndDate}" required>
        </div>

        <div class="form-group">
          <label for="statusId">🔢 Status ID</label>
          <select id="statusId">
            <option value="ALL" ${!savedStatusId ? "selected" : ""}>ทุก Status (1-5) - ดึงทีละอัน</option>
            <option value="1" ${savedStatusId === "1" ? "selected" : ""}>1 - Open</option>
            <option value="2" ${savedStatusId === "2" ? "selected" : ""}>2 - In Progress</option>
            <option value="3" ${savedStatusId === "3" ? "selected" : ""}>3 - Completed</option>
            <option value="4" ${savedStatusId === "4" ? "selected" : ""}>4 - Cancelled</option>
            <option value="5" ${savedStatusId === "5" ? "selected" : ""}>5 - Other</option>
          </select>
        </div>

        <div class="form-group">
          <label for="limit">📊 Limit (จำนวนสูงสุดต่อ Status)</label>
          <input type="number" id="limit" value="${savedLimit}" min="1" max="5000">
          <div class="hint">ถ้าไม่ระบุจะดึงทั้งหมด</div>
        </div>

        <div class="btn-group">
          <button type="button" class="btn-secondary" onclick="google.script.host.close()">ปิด</button>
          <button type="button" class="btn-danger" onclick="submitFresh()">🔄 เริ่ม Fresh Start</button>
        </div>
      </div>

      <script>
        function submitFresh() {
          const startDate = document.getElementById('startDate').value;
          const endDate = document.getElementById('endDate').value;
          const statusId = document.getElementById('statusId').value;
          const limit = document.getElementById('limit').value;

          if (!startDate || !endDate) {
            alert('❌ กรุณาระบุวันที่เริ่มและวันที่สิ้นสุด');
            return;
          }

          if (startDate > endDate) {
            alert('❌ วันที่เริ่มต้องไม่หลังวันที่สิ้นสุด');
            return;
          }

          const statusText = statusId === 'ALL' ? 'ทุก Status (ทีละอัน)' : 'Status ' + statusId;
          const limitText = limit ? 'Limit ' + limit : 'ไม่จำกัด';

          const confirmed = confirm(
            '⚠️ ยืนยันเริ่ม Fresh Start?\\n\\n' +
            'ช่วงเวลา: ' + startDate + ' ถึง ' + endDate + '\\n' +
            'Status: ' + statusText + '\\n' +
            'Limit: ' + limitText + '\\n\\n' +
            'ข้อมูลเดิมในชีทจะหายไป!'
          );

          if (confirmed) {
            // บันทึกค่าที่เลือก
            google.script.run
              .withSuccessHandler(function() {
                google.script.run
                  .withSuccessHandler(function(result) {
                    if (result.success) {
                      alert('✅ เริ่ม Fresh Start สำเร็จ!\\n\\n' + result.message);
                      google.script.host.close();
                    } else {
                      alert('❌ เกิดข้อผิดพลาด: ' + result.message);
                    }
                  })
                  .withFailureHandler(function(error) {
                    alert('❌ เกิดข้อผิดพลาด: ' + error.message);
                  })
                  .executePullTripsToSheetFresh();
              })
              .withFailureHandler(function(error) {
                alert('❌ บันทึกค่าไม่สำเร็จ: ' + error.message);
              })
              .saveTempParameters(startDate, endDate, statusId, limit);
          }
        }
      </script>
    </body>
    </html>
  `,
  )
    .setWidth(480)
    .setHeight(600)
    .setTitle("🔄 Fresh Start");

  SpreadsheetApp.getUi().showModalDialog(html, "Fresh Start");
}

/**
 * ➕ แสดง Dialog สำหรับ Pull Mode - Append (เพิ่ม)
 */
function showPullModeAppendDialog() {
  const scriptProperties = PropertiesService.getScriptProperties();

  // ตรวจสอบ credentials
  const hasSavedCreds = hasSavedCredentials();
  if (!hasSavedCreds) {
    SpreadsheetApp.getUi().alert(
      "⚠️ ต้อง Login ก่อน",
      "กรุณา Login ก่อนดึงข้อมูล\n\nใช้เมนู: 🔐 Login & Pull Data",
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
    return;
  }

  // ดึงค่าที่บันทึกไว้
  const today = new Date();
  const todayStr = Utilities.formatDate(
    today,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd",
  );
  const savedStartDate = scriptProperties.getProperty("START_DATE") || todayStr;
  const savedEndDate = scriptProperties.getProperty("END_DATE") || todayStr;
  const savedStatusId = scriptProperties.getProperty("STATUS_ID") || "";
  const savedLimit = scriptProperties.getProperty("LIMIT") || "50";

  const html = HtmlService.createHtmlOutput(
    `
    <!DOCTYPE html>
    <html>
    <head>
      <base target="_top">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          max-width: 450px;
          margin: 0 auto;
          background: white;
          padding: 25px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h2 {
          color: #34A853;
          margin-top: 0;
          margin-bottom: 5px;
          text-align: center;
        }
        .subtitle {
          text-align: center;
          color: #666;
          font-size: 13px;
          margin-bottom: 20px;
        }
        .form-group {
          margin-bottom: 15px;
        }
        label {
          display: block;
          font-weight: 500;
          margin-bottom: 5px;
          color: #333;
          font-size: 13px;
        }
        input[type="date"],
        select {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          box-sizing: border-box;
        }
        input:focus,
        select:focus {
          outline: none;
          border-color: #34A853;
        }
        .hint {
          font-size: 11px;
          color: #888;
          margin-top: 3px;
        }
        .btn-group {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }
        button {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.3s;
        }
        .btn-success {
          background: #34A853;
          color: white;
        }
        .btn-success:hover {
          background: #2D9247;
        }
        .btn-secondary {
          background: #f1f3f4;
          color: #333;
        }
        .btn-secondary:hover {
          background: #e8eaed;
        }
        .info-box {
          background: #e8f0fe;
          padding: 12px;
          border-radius: 4px;
          font-size: 12px;
          color: #1967d2;
          margin-bottom: 15px;
        }
        .success-box {
          background: #e6f4ea;
          padding: 12px;
          border-radius: 4px;
          font-size: 12px;
          color: #137333;
          margin-bottom: 15px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>➕ Append (เพิ่ม)</h2>
        <div class="subtitle">เพิ่มข้อมูลใหม่เข้าไปในข้อมูลเดิม</div>

        <div class="success-box">
          ✅ โหมดนี้จะเก็บข้อมูลเดิมไว้<br>
          ตรวจสอบ Trip ID เพื่อหลีกเลี่ยงข้อมูลซ้ำ
        </div>

        <div class="info-box">
          💡 เหมาะสำหรับ: ดึงข้อมูลเพิ่ม, อัปเดตข้อมูลที่มีอยู่
        </div>

        <div class="form-group">
          <label for="startDate">📅 วันที่เริ่ม</label>
          <input type="date" id="startDate" value="${savedStartDate}" required>
        </div>

        <div class="form-group">
          <label for="endDate">📅 วันที่สิ้นสุด</label>
          <input type="date" id="endDate" value="${savedEndDate}" required>
        </div>

        <div class="form-group">
          <label for="statusId">🔢 Status ID</label>
          <select id="statusId">
            <option value="ALL" ${!savedStatusId ? "selected" : ""}>ทุก Status (1-5) - ดึงทีละอัน</option>
            <option value="1" ${savedStatusId === "1" ? "selected" : ""}>1 - Open</option>
            <option value="2" ${savedStatusId === "2" ? "selected" : ""}>2 - In Progress</option>
            <option value="3" ${savedStatusId === "3" ? "selected" : ""}>3 - Completed</option>
            <option value="4" ${savedStatusId === "4" ? "selected" : ""}>4 - Cancelled</option>
            <option value="5" ${savedStatusId === "5" ? "selected" : ""}>5 - Other</option>
          </select>
        </div>

        <div class="form-group">
          <label for="limit">📊 Limit (จำนวนสูงสุดต่อ Status)</label>
          <input type="number" id="limit" value="${savedLimit}" min="1" max="5000">
          <div class="hint">ถ้าไม่ระบุจะดึงทั้งหมด</div>
        </div>

        <div class="form-group" style="background: #e8f5e9; padding: 12px; border-radius: 4px; border-left: 4px solid #4caf50;">
          <label style="display: flex; align-items: center; cursor: pointer;" for="runBackground">
            <input type="checkbox" id="runBackground" name="runBackground" style="width: 18px; height: 18px; margin-right: 10px;">
            <span style="font-weight: 500; color: #2e7d32;">🔄 รันใน Background (ไม่ต้องนั่งรอ)</span>
          </label>
          <small style="color: #666; display: block; margin-top: 8px; margin-left: 28px;">
            เลือกเพื่อให้รันใน background - สามารถปิดหน้าต่างไปได้<br>
            • ระบบจะเริ่มรันใน 1-2 นาที<br>
            • เหมาะสำหรับข้อมูลจำนวนมาก<br>
            • แจ้งเตือนผ่าน Email เมื่อเสร็จสิ้น
          </small>
        </div>

        <div class="btn-group">
          <button type="button" class="btn-secondary" onclick="google.script.host.close()">ปิด</button>
          <button type="button" class="btn-success" onclick="submitAppend()">➕ เริ่ม Append</button>
        </div>
      </div>

      <script>
        function submitAppend() {
          const startDate = document.getElementById('startDate').value;
          const endDate = document.getElementById('endDate').value;
          const statusId = document.getElementById('statusId').value;
          const limit = document.getElementById('limit').value;
          const runBackground = document.getElementById('runBackground').checked;

          if (!startDate || !endDate) {
            alert('❌ กรุณาระบุวันที่เริ่มและวันที่สิ้นสุด');
            return;
          }

          if (startDate > endDate) {
            alert('❌ วันที่เริ่มต้องไม่หลังวันที่สิ้นสุด');
            return;
          }

          const statusText = statusId === 'ALL' ? 'ทุก Status (ทีละอัน)' : 'Status ' + statusId;
          const limitText = limit ? 'Limit ' + limit : 'ไม่จำกัด';

          let confirmMessage = '✅ ยืนยันเริ่ม Append?\\n\\n' +
            'ช่วงเวลา: ' + startDate + ' ถึง ' + endDate + '\\n' +
            'Status: ' + statusText + '\\n' +
            'Limit: ' + limitText + '\\n\\n' +
            'ข้อมูลเดิมจะถูกเก็บไว้';

          if (runBackground) {
            confirmMessage += '\\n\\n🔄 โหมด Background:\\n' +
              '• ระบบจะเริ่มรันใน 1-2 นาที\\n' +
              '• สามารถปิดหน้าต่างไปได้\\n' +
              '• แจ้งเตือนผ่าน Email เมื่อเสร็จสิ้น';
          }

          const confirmed = confirm(confirmMessage);

          if (confirmed) {
            if (runBackground) {
              // รัน background - สร้าง trigger
              google.script.run
                .withSuccessHandler(function(result) {
                  if (result.success) {
                    alert('✅ ตั้งค่า Background Append สำเร็จ!\\n\\n' + result.message);
                    google.script.host.close();
                  } else {
                    alert('❌ เกิดข้อผิดพลาด: ' + result.message);
                  }
                })
                .withFailureHandler(function(error) {
                  alert('❌ เกิดข้อผิดพลาด: ' + error.message);
                })
                .scheduleAppendPullTrigger(startDate, endDate, statusId, limit);
            } else {
              // รันปกติ - รอจนเสร็จ
              google.script.run
                .withSuccessHandler(function() {
                  google.script.run
                    .withSuccessHandler(function(result) {
                      if (result.success) {
                        alert('✅ เริ่ม Append สำเร็จ!\\n\\n' + result.message);
                        google.script.host.close();
                      } else {
                        alert('❌ เกิดข้อผิดพลาด: ' + result.message);
                      }
                    })
                    .withFailureHandler(function(error) {
                      alert('❌ เกิดข้อผิดพลาด: ' + error.message);
                    })
                    .executePullTripsToSheetAppend();
                })
                .withFailureHandler(function(error) {
                  alert('❌ บันทึกค่าไม่สำเร็จ: ' + error.message);
                })
                .saveTempParameters(startDate, endDate, statusId, limit);
            }
          }
        }
      </script>
    </body>
    </html>
  `,
  )
    .setWidth(480)
    .setHeight(600)
    .setTitle("➕ Append");

  SpreadsheetApp.getUi().showModalDialog(html, "Append");
}

/**
 * 🔄 ดึงข้อมูลแบบเริ่มใหม่ (Fresh Start)
 * - ล้างข้อมูลเก่าแล้วเขียนใหม่ทั้งหมด
 * - ดึงทีละ Status ID พร้อม toast/alert แจ้งเตือน
 * - เหมาะสำหรับ: ดึงข้อมูลครั้งแรก, ต้องการรีเฟรชข้อมูลทั้งหมด
 *
 * @returns {object} - { success: boolean, message: string }
 */
function executePullTripsToSheetFresh() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // ✅ FIX: Don't call getUi() in trigger context - wrap in try-catch
  let ui = null;
  try {
    ui = SpreadsheetApp.getUi();
  } catch (e) {
    // Running in trigger context - no UI available
    Logger.log("ℹ️ Running in trigger context - UI alerts disabled");
  }
  const scriptProperties = PropertiesService.getScriptProperties();
  const config = getConfig();

  try {
    // ตรวจสอบว่ามี credentials ที่บันทึกไว้หรือไม่
    if (!hasSavedCredentials()) {
      return {
        success: false,
        message: "No saved credentials found. Please login first.",
      };
    }

    // อ่านค่า temp parameters
    const tempStartDate = scriptProperties.getProperty("TEMP_START_DATE") || "";
    const tempEndDate = scriptProperties.getProperty("TEMP_END_DATE") || "";
    const tempStatusId = scriptProperties.getProperty("TEMP_STATUS_ID") || "ALL";
    const tempLimit = scriptProperties.getProperty("TEMP_LIMIT") || "";
    const limit = tempLimit ? parseInt(tempLimit) : null;

    // กำหนด Status IDs ที่จะดึง
    const STATUS_IDS =
      tempStatusId === "ALL" ? [1, 2, 3, 4, 5] : [parseInt(tempStatusId)];

    // แจ้งเตือนเริ่มต้น
    const statusText =
      tempStatusId === "ALL" ? "ทุก Status (1-5)" : `Status ${tempStatusId}`;
    const limitText = limit ? `Limit ${limit} รายการ/Status` : "ไม่จำกัด";
    const dateText = (tempStartDate && tempEndDate) ? `วันที่ ${tempStartDate} ถึง ${tempEndDate}` : "ทุกวันที่";

    ss.toast(`🔄 Starting FRESH pull...`, "MLSTMS Trips", 5);
    Logger.log(`🔄 Starting FRESH pull: ${statusText}, ${dateText}, ${limitText}`);

    // 1. Login
    const token = login();
    if (!token) {
      return {
        success: false,
        message: "Login failed. Please check your credentials.",
      };
    }

    // 2. ดึงข้อมูลทีละ Status ID
    let allTrips = [];
    let allTripDetails = [];
    let totalSuccessful = 0;
    let totalSkipped = 0;
    const overallStartTime = new Date();

    for (let i = 0; i < STATUS_IDS.length; i++) {
      const statusId = STATUS_IDS[i];
      const isLastStatus = i === STATUS_IDS.length - 1;

      // แสดง toast/alert มุมขวาล่าง
      const statusMessage = `🔄 [${i + 1}/${STATUS_IDS.length}] กำลังดึง Status ${statusId}...`;
      ss.toast(statusMessage, "MLSTMS Trips", 30);
      // ✅ FIX: Only show alert if UI is available (not in trigger context)
      if (ui) {
        try {
          SpreadsheetApp.getUi().alert(
            `🔄 FRESH Pull - Status ${statusId}`,
            `กำลังดึงข้อมูล Status ${statusId}...\n\n` +
              `ความคืบหน้า: ${i + 1}/${STATUS_IDS.length}\n` +
              `Status นี้: ${isLastStatus ? "(สุดท้าย)" : "(ยังมีต่อ)"}`,
            ui.ButtonSet.OK,
          );
        } catch (e) {
          Logger.log(`ℹ️ Could not show alert (trigger context): ${e.message}`);
        }
      }

      Logger.log(
        `📋 [${i + 1}/${STATUS_IDS.length}] Fetching Status ${statusId}...`,
      );

      try {
        // ✅ แก้ไข: ใช้ฟังก์ชันใหม่ที่กรองข้อมูลอย่างเข้มงวด
        const trips = getAllTripsForStatusIdWithDateFilter(
          statusId,
          tempStartDate || null,
          tempEndDate || null
        );

        // ถ้ามี Limit ให้ตัด
        const limitedTrips = limit ? trips.slice(0, limit) : trips;

        if (limitedTrips.length === 0) {
          ss.toast(
            `⏭️ Status ${statusId}: ไม่มีข้อมูล - ข้าม`,
            "MLSTMS Trips",
            5,
          );
          Logger.log(`   ⏭️ Status ${statusId}: No data - skipping`);
          continue;
        }

        ss.toast(
          `✅ Status ${statusId}: พบ ${limitedTrips.length} รายการ`,
          "MLSTMS Trips",
          5,
        );
        Logger.log(
          `   ✅ Status ${statusId}: ${limitedTrips.length} trips found`,
        );

        allTrips = allTrips.concat(limitedTrips);

        // ดึง Trip Details
        const tripDetails = [];
        for (let j = 0; j < limitedTrips.length; j++) {
          const trip = limitedTrips[j];
          const tripId = getTripField(trip, [
            "id",
            "tripId",
            "trip_code",
            "tripCode",
            "trip_id",
          ]);

          if (!tripId) {
            totalSkipped++;
            Logger.log(`   ⚠️ Skipping trip without ID`);
            continue;
          }

          // Progress update
          if ((j + 1) % 10 === 0 || j === limitedTrips.length - 1) {
            ss.toast(
              `📊 Status ${statusId}: กำลังดึง Details ${j + 1}/${limitedTrips.length}`,
              "MLSTMS Trips",
              3,
            );
          }

          const detail = getTripDetails(tripId);
          if (detail) {
            tripDetails.push(detail);
            totalSuccessful++;
          } else {
            totalSkipped++;
          }

          // Rate limiting
          if (!config.fastMode && config.rateLimitMs > 0) {
            Utilities.sleep(config.rateLimitMs);
          }
        }

        allTripDetails = allTripDetails.concat(tripDetails);
        Logger.log(
          `   ✅ Status ${statusId}: ${tripDetails.length} details fetched`,
        );
      } catch (error) {
        ss.toast(`❌ Status ${statusId}: เกิดข้อผิดพลาด`, "MLSTMS Trips", 10);
        Logger.log(`   ❌ Error fetching Status ${statusId}: ${error.message}`);
      }

      // Rate limiting ระหว่าง Status IDs
      Utilities.sleep(2000);
    }

    if (allTrips.length === 0) {
      return {
        success: false,
        message: "No trips found in the specified date range.",
      };
    }

    // 3. บันทึก Trips ลง Sheet (แบบ Fresh Start)
    ss.toast("💾 กำลังบันทึก Trips...", "MLSTMS Trips", 10);
    Logger.log("💾 Saving trips to sheet (FRESH mode)...");
    saveTripsToSheet(allTrips, false, false); // append=false, checkDuplicates=false
    Logger.log("💾 saveTripsToSheet completed");

    // 4. บันทึก Trip Details ลง Sheet (แบบ Fresh Start)
    ss.toast("💾 กำลังบันทึก Trip Details...", "MLSTMS Trips", 10);
    Logger.log("💾 Saving trip details to sheet (FRESH mode)...");
    saveTripDetailsToSheet(allTripDetails, false, false); // append=false, checkDuplicates=false
    Logger.log("💾 saveTripDetailsToSheet completed");

    // แจ้งเตือนเสร็จสิ้น
    const totalDetailsTime = Math.round((new Date() - overallStartTime) / 1000);
    const minutes = Math.floor(totalDetailsTime / 60);
    const seconds = totalDetailsTime % 60;

    ss.toast("✅ FRESH pull completed!", "MLSTMS Trips", 10);
    Logger.log("✅ FRESH pull completed!");
    Logger.log(
      `📊 Summary: ${allTrips.length} trips, ${allTripDetails.length} trip details saved.`,
    );

    const summaryMessage =
      `✅ FRESH pull completed!\n\n` +
      `${allTrips.length} trips saved (old data cleared)\n` +
      `${allTripDetails.length} trip details saved (old data cleared)\n\n` +
      `📅 ช่วงวันที่: ${dateText}\n` +
      `🔍 Status: ${statusText}\n\n` +
      (totalSkipped > 0
        ? `⚠️ Warning: ${totalSkipped} trip(s) could not be fetched.\n\n`
        : "") +
      `Total time: ${minutes}m ${seconds}s`;

    return {
      success: true,
      message: summaryMessage,
    };
  } catch (error) {
    ss.toast("❌ Error occurred", "MLSTMS Trips", 10);
    Logger.log(`❌ Error: ${error.message}`);
    return {
      success: false,
      message: `Error: ${error.message}`,
    };
  } finally {
    // ลบ temp properties เสมอ
    const scriptProperties = PropertiesService.getScriptProperties();
    scriptProperties.deleteProperty("TEMP_START_DATE");
    scriptProperties.deleteProperty("TEMP_END_DATE");
    scriptProperties.deleteProperty("TEMP_STATUS_ID");
    scriptProperties.deleteProperty("TEMP_LIMIT");
  }
}

/**
 * ➕ ดึงข้อมูลแบบเพิ่ม (Append Mode)
 * - เพิ่มข้อมูลใหม่เข้าไปในข้อมูลเดิม
 * - ดึงทีละ Status ID พร้อม toast/alert แจ้งเตือน
 * - ตรวจสอบ Trip ID เพื่อหลีกเลี่ยงข้อมูลซ้ำ
 * - เหมาะสำหรับ: ดึงข้อมูลเพิ่มในอนาคต, อัปเดตข้อมูลที่มีอยู่
 *
 * @returns {object} - { success: boolean, message: string }
 */
function executePullTripsToSheetAppend() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // ✅ FIX: Don't call getUi() in trigger context - wrap in try-catch
  let ui = null;
  try {
    ui = SpreadsheetApp.getUi();
  } catch (e) {
    // Running in trigger context - no UI available
    Logger.log("ℹ️ Running in trigger context - UI alerts disabled");
  }
  const scriptProperties = PropertiesService.getScriptProperties();
  const config = getConfig();

  try {
    // ตรวจสอบว่ามี credentials ที่บันทึกไว้หรือไม่
    if (!hasSavedCredentials()) {
      return {
        success: false,
        message: "No saved credentials found. Please login first.",
      };
    }

    // อ่านค่า temp parameters
    const tempStartDate = scriptProperties.getProperty("TEMP_START_DATE") || "";
    const tempEndDate = scriptProperties.getProperty("TEMP_END_DATE") || "";
    const tempStatusId = scriptProperties.getProperty("TEMP_STATUS_ID") || "ALL";
    const tempLimit = scriptProperties.getProperty("TEMP_LIMIT") || "";
    const limit = tempLimit ? parseInt(tempLimit) : null;

    // กำหนด Status IDs ที่จะดึง
    const STATUS_IDS =
      tempStatusId === "ALL" ? [1, 2, 3, 4, 5] : [parseInt(tempStatusId)];

    // แจ้งเตือนเริ่มต้น
    const statusText =
      tempStatusId === "ALL" ? "ทุก Status (1-5)" : `Status ${tempStatusId}`;
    const limitText = limit ? `Limit ${limit} รายการ/Status` : "ไม่จำกัด";
    const dateText = (tempStartDate && tempEndDate) ? `วันที่ ${tempStartDate} ถึง ${tempEndDate}` : "ทุกวันที่";

    ss.toast(`➕ Starting APPEND pull...`, "MLSTMS Trips", 5);
    Logger.log(`➕ Starting APPEND pull: ${statusText}, ${dateText}, ${limitText}`);

    // 1. Login
    const token = login();
    if (!token) {
      return {
        success: false,
        message: "Login failed. Please check your credentials.",
      };
    }

    // 2. ดึงข้อมูลทีละ Status ID
    let allTrips = [];
    let allTripDetails = [];
    let totalSuccessful = 0;
    let totalSkipped = 0;
    const overallStartTime = new Date();

    for (let i = 0; i < STATUS_IDS.length; i++) {
      const statusId = STATUS_IDS[i];
      const isLastStatus = i === STATUS_IDS.length - 1;

      // แสดง toast/alert มุมขวาล่าง
      const statusMessage = `➕ [${i + 1}/${STATUS_IDS.length}] กำลังดึง Status ${statusId}...`;
      ss.toast(statusMessage, "MLSTMS Trips", 30);
      // ✅ FIX: Only show alert if UI is available (not in trigger context)
      if (ui) {
        try {
          SpreadsheetApp.getUi().alert(
            `➕ APPEND Pull - Status ${statusId}`,
            `กำลังดึงข้อมูล Status ${statusId}...\n\n` +
              `ความคืบหน้า: ${i + 1}/${STATUS_IDS.length}\n` +
              `Status นี้: ${isLastStatus ? "(สุดท้าย)" : "(ยังมีต่อ)"}`,
            ui.ButtonSet.OK,
          );
        } catch (e) {
          Logger.log(`ℹ️ Could not show alert (trigger context): ${e.message}`);
        }
      }

      Logger.log(
        `📋 [${i + 1}/${STATUS_IDS.length}] Fetching Status ${statusId}...`,
      );

      try {
        // ✅ แก้ไข: ใช้ฟังก์ชันใหม่ที่กรองข้อมูลอย่างเข้มงวด
        const trips = getAllTripsForStatusIdWithDateFilter(
          statusId,
          tempStartDate || null,
          tempEndDate || null
        );

        // ถ้ามี Limit ให้ตัด
        const limitedTrips = limit ? trips.slice(0, limit) : trips;

        if (limitedTrips.length === 0) {
          ss.toast(
            `⏭️ Status ${statusId}: ไม่มีข้อมูล - ข้าม`,
            "MLSTMS Trips",
            5,
          );
          Logger.log(`   ⏭️ Status ${statusId}: No data - skipping`);
          continue;
        }

        ss.toast(
          `✅ Status ${statusId}: พบ ${limitedTrips.length} รายการ`,
          "MLSTMS Trips",
          5,
        );
        Logger.log(
          `   ✅ Status ${statusId}: ${limitedTrips.length} trips found`,
        );

        allTrips = allTrips.concat(limitedTrips);

        // ดึง Trip Details
        const tripDetails = [];
        for (let j = 0; j < limitedTrips.length; j++) {
          const trip = limitedTrips[j];
          const tripId = getTripField(trip, [
            "id",
            "tripId",
            "trip_code",
            "tripCode",
            "trip_id",
          ]);

          if (!tripId) {
            totalSkipped++;
            Logger.log(`   ⚠️ Skipping trip without ID`);
            continue;
          }

          // Progress update
          if ((j + 1) % 10 === 0 || j === limitedTrips.length - 1) {
            ss.toast(
              `📊 Status ${statusId}: กำลังดึง Details ${j + 1}/${limitedTrips.length}`,
              "MLSTMS Trips",
              3,
            );
          }

          const detail = getTripDetails(tripId);
          if (detail) {
            tripDetails.push(detail);
            totalSuccessful++;
          } else {
            totalSkipped++;
          }

          // Rate limiting
          if (!config.fastMode && config.rateLimitMs > 0) {
            Utilities.sleep(config.rateLimitMs);
          }
        }

        allTripDetails = allTripDetails.concat(tripDetails);
        Logger.log(
          `   ✅ Status ${statusId}: ${tripDetails.length} details fetched`,
        );
      } catch (error) {
        ss.toast(`❌ Status ${statusId}: เกิดข้อผิดพลาด`, "MLSTMS Trips", 10);
        Logger.log(`   ❌ Error fetching Status ${statusId}: ${error.message}`);
      }

      // Rate limiting ระหว่าง Status IDs
      Utilities.sleep(2000);
    }

    if (allTrips.length === 0) {
      return {
        success: false,
        message: "No trips found in the specified date range.",
      };
    }

    // 3. บันทึก Trips ลง Sheet (แบบ Append)
    ss.toast("➕💾 กำลังบันทึก Trips...", "MLSTMS Trips", 10);
    Logger.log("💾 Saving trips to sheet (APPEND mode)...");
    saveTripsToSheet(allTrips, true, true); // append=true, checkDuplicates=true
    Logger.log("💾 saveTripsToSheet completed");

    // 4. บันทึก Trip Details ลง Sheet (แบบ Append)
    ss.toast("➕💾 กำลังบันทึก Trip Details...", "MLSTMS Trips", 10);
    Logger.log("💾 Saving trip details to sheet (APPEND mode)...");
    saveTripDetailsToSheet(allTripDetails, true, true); // append=true, checkDuplicates=true
    Logger.log("💾 saveTripDetailsToSheet completed");

    // แจ้งเตือนเสร็จสิ้น
    const totalDetailsTime = Math.round((new Date() - overallStartTime) / 1000);
    const minutes = Math.floor(totalDetailsTime / 60);
    const seconds = totalDetailsTime % 60;

    ss.toast("✅ APPEND pull completed!", "MLSTMS Trips", 10);
    Logger.log("✅ APPEND pull completed!");
    Logger.log(
      `📊 Summary: ${allTrips.length} trips, ${allTripDetails.length} trip details saved.`,
    );

    const summaryMessage =
      `✅ APPEND pull completed!\n\n` +
      `${allTrips.length} trips processed (new added, existing updated)\n` +
      `${allTripDetails.length} trip details processed (new added, existing updated)\n\n` +
      `📅 ช่วงวันที่: ${dateText}\n` +
      `🔍 Status: ${statusText}\n` +
      `💡 ข้อมูลเดิมยังอยู่ - เพิ่มเฉพาะข้อมูลใหม่\n\n` +
      (totalSkipped > 0
        ? `⚠️ Warning: ${totalSkipped} trip(s) could not be fetched.\n\n`
        : "") +
      `Total time: ${minutes}m ${seconds}s`;

    return {
      success: true,
      message: summaryMessage,
    };
  } catch (error) {
    ss.toast("❌ Error occurred", "MLSTMS Trips", 10);
    Logger.log(`❌ Error: ${error.message}`);
    return {
      success: false,
      message: `Error: ${error.message}`,
    };
  } finally {
    // ลบ temp properties เสมอ
    const scriptProperties = PropertiesService.getScriptProperties();
    scriptProperties.deleteProperty("TEMP_START_DATE");
    scriptProperties.deleteProperty("TEMP_END_DATE");
    scriptProperties.deleteProperty("TEMP_STATUS_ID");
    scriptProperties.deleteProperty("TEMP_LIMIT");
  }
}
