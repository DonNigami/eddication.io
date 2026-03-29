/**
 * MLSTMS - PTG eZView Integration to Google Sheets (Refactored)
 *
 * สคริปต์สำหรับดึงข้อมูล Trips และ Trip Details จาก PTG eZView API
 * มาบันทึกลงใน Google Sheets
 *
 * @version 2.0 - Refactored for better maintainability
 */

// ============================================
// CONSTANTS
// ============================================

const CONFIG = {
  BASE_URL:
    "http://203.151.215.230:9000/eZViewIntegrationService/web-service/api",
  DEVICE_ID: "google-sheets-integration",
  DEVICE_NAME: "Google Sheets Integration",
  DEVICE_TYPE: "web",
  OS: "Google Apps Script",
  TRIPS_SHEET_NAME: "Trips",
  TRIP_DETAILS_SHEET_NAME: "TripDetails",
  STATUS_IDS: [1, 2, 3, 4, 5],
  BATCH_TIME_LIMIT: 5 * 60 * 1000, // 5 minutes
  // Rate Limit Optimization (Safe mode to avoid bandwidth quota)
  // Using 1000ms = 60 req/min (safe), 600ms = 100 req/min (max)
  OPTIMAL_RATE_LIMIT_MS: 1000, // Safe default (60 req/min)
  MAX_SAFE_RATE_LIMIT_MS: 1500, // 40 req/min (very safe)
  MIN_RATE_LIMIT_MS: 600, // 100 req/min (max speed)
};

// ============================================
// CONFIGURATION
// ============================================

function setupConfig() {
  PropertiesService.getScriptProperties().setProperties({
    BASE_URL: CONFIG.BASE_URL,
    DEVICE_ID: CONFIG.DEVICE_ID,
    DEVICE_NAME: CONFIG.DEVICE_NAME,
    DEVICE_TYPE: CONFIG.DEVICE_TYPE,
    OS: CONFIG.OS,
    TRIPS_SHEET_NAME: CONFIG.TRIPS_SHEET_NAME,
    TRIP_DETAILS_SHEET_NAME: CONFIG.TRIP_DETAILS_SHEET_NAME,
    STATUS_ID: "",
    START_DATE: "",
    END_DATE: "",
    LIMIT: "50",
    // ปรับ Rate Limit ให้ปลอดภัยกว่า (หลังเจอ Bandwidth quota exceeded)
    // ใช้ 1000 ms = 60 req/min เพื่อไม่ให้โดน bandwidth quota
    RATE_LIMIT_MS: "1000",
    FAST_MODE: "false",
    ADAPTIVE_RATE_LIMIT: "true",
    // Min: 600ms (100 req/min), Max: 2000ms (30 req/min - very safe)
    MIN_RATE_LIMIT_MS: "600",
    MAX_RATE_LIMIT_MS: "2000",
    TARGET_RESPONSE_TIME_MS: "500",
    LOG_LEVEL: "NORMAL",
    LOG_BATCH_SIZE: "10",
    PERFORMANCE_MODE: "SAFE",
  });
  Logger.log("✅ Configuration saved!");
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    baseUrl: props.getProperty("BASE_URL"),
    username: "LPG_Bulk",
    password: props.getProperty("PASSWORD"),
    deviceId: props.getProperty("DEVICE_ID"),
    deviceName: props.getProperty("DEVICE_NAME"),
    deviceType: props.getProperty("DEVICE_TYPE"),
    os: props.getProperty("OS"),
    tripsSheetName:
      props.getProperty("TRIPS_SHEET_NAME") || CONFIG.TRIPS_SHEET_NAME,
    tripDetailsSheetName:
      props.getProperty("TRIP_DETAILS_SHEET_NAME") ||
      CONFIG.TRIP_DETAILS_SHEET_NAME,
    statusId:
      props.getProperty("TEMP_STATUS_ID") ||
      props.getProperty("STATUS_ID") ||
      "",
    startDate:
      props.getProperty("TEMP_START_DATE") ||
      props.getProperty("START_DATE") ||
      "",
    endDate:
      props.getProperty("TEMP_END_DATE") || props.getProperty("END_DATE") || "",
    limit:
      props.getProperty("TEMP_LIMIT") || props.getProperty("LIMIT") || "50",
    rateLimitMs: parseInt(props.getProperty("RATE_LIMIT_MS") || "1000"),
    fastMode: props.getProperty("FAST_MODE") === "true",
    adaptiveRateLimit: props.getProperty("ADAPTIVE_RATE_LIMIT") === "true",
    minRateLimitMs: parseInt(props.getProperty("MIN_RATE_LIMIT_MS") || "100"),
    maxRateLimitMs: parseInt(props.getProperty("MAX_RATE_LIMIT_MS") || "1000"),
    targetResponseTimeMs: parseInt(
      props.getProperty("TARGET_RESPONSE_TIME_MS") || "500",
    ),
    logLevel: props.getProperty("LOG_LEVEL") || "NORMAL",
    logBatchSize: parseInt(props.getProperty("LOG_BATCH_SIZE") || "10"),
  };
}

function hasSavedCredentials() {
  const props = PropertiesService.getScriptProperties();
  return !!(props.getProperty("USERNAME") && props.getProperty("PASSWORD"));
}

function smartLog(message, level = "NORMAL") {
  const levels = { MINIMAL: 0, NORMAL: 1, VERBOSE: 2, DEBUG: 3 };
  if (levels[level] <= levels[getConfig().logLevel]) {
    Logger.log(message);
  }
}

function adaptiveSleep(lastResponseTime) {
  const config = getConfig();
  if (config.fastMode) return;
  if (!config.adaptiveRateLimit) {
    Utilities.sleep(config.rateLimitMs);
    return;
  }
  if (lastResponseTime < config.targetResponseTimeMs) {
    Utilities.sleep(config.minRateLimitMs);
  } else {
    Utilities.sleep(config.rateLimitMs);
  }
}

function getTripField(trip, possibleFields) {
  for (const field of possibleFields) {
    const value = field.split(".").reduce((obj, key) => obj && obj[key], trip);
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return "";
}

function parseISODateTime(isoString) {
  if (!isoString) return null;
  try {
    const date = new Date(isoString);
    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    return null;
  }
}

function formatDateTimeWithTimezone(date, timezone) {
  if (!date) return null;
  try {
    const year = Utilities.formatDate(date, timezone, "yyyy");
    const month = Utilities.formatDate(date, timezone, "MM");
    const day = Utilities.formatDate(date, timezone, "dd");
    const hours = Utilities.formatDate(date, timezone, "HH");
    const minutes = Utilities.formatDate(date, timezone, "mm");
    const seconds = Utilities.formatDate(date, timezone, "ss");
    const formatted = Utilities.formatDate(date, timezone, "Z");
    const sign = formatted[0] === "+" ? 1 : -1;
    const offsetHours = Math.abs(parseInt(formatted.substring(1, 3), 10));
    const offsetMinutes = Math.abs(parseInt(formatted.substring(3, 5), 10));
    const offsetString = `${sign}${String(offsetHours).padStart(2, "0")}:${String(offsetMinutes).padStart(2, "0")}`;
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offsetString}`;
  } catch (error) {
    return null;
  }
}

/**
 * จัดรูปแบบวันที่เวลาเป็น Bangkok Time (GMT+7)
 * รูปแบบ: dd/MM/yyyy HH:mm:ss
 * @param {Date} date - วันที่เวลาที่ต้องการจัดรูปแบบ
 * @returns {string} - วันที่เวลาในรูปแบบ Bangkok Time
 */
function formatBangkokDateTime(date) {
  if (!date) return "";
  try {
    return Utilities.formatDate(date, "Asia/Bangkok", "dd/MM/yyyy HH:mm:ss");
  } catch (error) {
    return "";
  }
}

/**
 * จัดรูปแบบวันที่เวลาจาก ISO string เป็น Bangkok Time
 * รูปแบบ: dd/MM/yyyy HH:mm:ss
 * @param {string} isoString - ISO 8601 string
 * @returns {string} - วันที่เวลาในรูปแบบ Bangkok Time
 */
function formatISOToBangkok(isoString) {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    return formatBangkokDateTime(date);
  } catch (error) {
    return "";
  }
}

/**
 * คืนค่า "--" ถ้าค่าว่าง หรือ null/undefined
 * @param {any} value - ค่าที่ต้องการตรวจสอบ
 * @returns {string} - ค่าที่ได้ หรือ "--" ถ้าว่าง
 */
function getValueOrDash(value) {
  if (value === null || value === undefined || value === "") {
    return "--";
  }
  return value;
}

// ============================================
// API AUTHENTICATION
// ============================================

function login() {
  const config = getConfig();
  const maxRetries = 3;
  const baseDelayMs = 2000; // Start with 2 seconds

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      Logger.log(`🔐 Login attempt ${attempt}/${maxRetries}...`);
      Logger.log(`   🔗 URL: ${config.baseUrl}/v1/login`);
      Logger.log(`   👤 Username: ${config.username}`);
      Logger.log(`   📱 Device: ${config.deviceName} (${config.deviceType})`);

      const response = UrlFetchApp.fetch(`${config.baseUrl}/v1/login`, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({
          username: config.username,
          password: config.password,
          deviceInfo: {
            deviceId: config.deviceId,
            deviceName: config.deviceName,
            deviceType: config.deviceType,
            os: config.os,
          },
        }),
        muteHttpExceptions: true,
      });

      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();

      Logger.log(`   📡 Response Code: ${responseCode}`);

      // Handle successful login
      if (responseCode === 200) {
        const result = JSON.parse(responseText);
        if (!result?.data?.accessToken) {
          throw new Error("Invalid response format");
        }

        const props = PropertiesService.getScriptProperties();
        props.setProperty("ACCESS_TOKEN", result.data.accessToken);
        props.setProperty("REFRESH_TOKEN", result.data.refreshToken);
        props.setProperty(
          "TOKEN_EXPIRES_AT",
          new Date(Date.now() + 55 * 60 * 1000).toISOString(),
        );

        if (attempt > 1) {
          Logger.log(`✅ Login successful on attempt ${attempt}!`);
        } else {
          Logger.log("✅ Login successful!");
        }
        return result.data.accessToken;
      }

      // Handle HTTP 503 Service Unavailable with retry
      if (responseCode === 503) {
        if (attempt < maxRetries) {
          const delayMs = baseDelayMs * Math.pow(2, attempt - 1); // Exponential backoff: 2s, 4s, 8s
          Logger.log(
            `⚠️ HTTP 503 Service Unavailable - Retrying in ${delayMs / 1000}s...`,
          );
          SpreadsheetApp.getActiveSpreadsheet().toast(
            `⚠️ Service busy... retrying in ${delayMs / 1000}s (attempt ${attempt}/${maxRetries})`,
            "MLSTMS Trips",
            delayMs / 1000,
          );
          Utilities.sleep(delayMs);
          continue;
        } else {
          throw new Error(
            `Login failed after ${maxRetries} attempts - Service Unavailable (HTTP 503)\n\n` +
              `The PTG eZView API is currently down or overloaded.\n\n` +
              `💡 Suggestions:\n` +
              `1. Run "Service Health Check" to verify service status\n` +
              `2. Wait a few minutes and try again\n` +
              `3. Contact PTG support if the issue persists\n\n` +
              `Response: ${responseText.substring(0, 200)}`,
          );
        }
      }

      // Handle HTTP 401 Unauthorized
      if (responseCode === 401) {
        throw new Error(
          `Login failed - Unauthorized (HTTP 401)\n\n` +
            `💡 Please check your credentials:\n` +
            `• Username: ${config.username}\n` +
            `• Password: ${config.password ? "***" : "NOT SET"}\n\n` +
            `Use "🔐 Login & Pull Data" to update credentials.`,
        );
      }

      // Handle other HTTP errors
      throw new Error(
        `Login failed - HTTP ${responseCode}\n\n` +
          `Response: ${responseText.substring(0, 300)}`,
      );
    } catch (error) {
      // If this is the last attempt or not a retryable error, throw
      if (attempt === maxRetries || !error.message.includes("503")) {
        throw error;
      }
      // Continue to next retry
    }
  }
}

function getAccessToken() {
  const props = PropertiesService.getScriptProperties();
  const expiresAt = props.getProperty("TOKEN_EXPIRES_AT");
  if (expiresAt && new Date(expiresAt) > new Date()) {
    const token = props.getProperty("ACCESS_TOKEN");
    if (token) return token;
  }
  return login();
}

// ============================================
// API CALLS
// ============================================

function getAllTripsForStatusIdWithDateFilter(statusId, startDate, endDate) {
  const config = getConfig();
  const token = getAccessToken();
  const timezone = Session.getScriptTimeZone();

  const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
  const end = endDate ? new Date(`${endDate}T23:59:59`) : null;

  let allTrips = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;
  let pageCount = 0;

  while (hasMore) {
    pageCount++;
    const params = [
      `statusId=${statusId}`,
      `limit=${limit}`,
      `offset=${offset}`,
    ];
    if (startDate && endDate) {
      params.push(`startDate=${startDate}`, `endDate=${endDate}`);
    }

    const response = UrlFetchApp.fetch(
      `${config.baseUrl}/v1/trips?${params.join("&")}`,
      {
        method: "get",
        headers: { Authorization: `Bearer ${token}` },
        muteHttpExceptions: true,
      },
    );

    if (response.getResponseCode() === 401) {
      getAccessToken();
      continue;
    }

    if (response.getResponseCode() !== 200) {
      hasMore = false;
      break;
    }

    const result = JSON.parse(response.getContentText());
    let tripsInPage =
      result?.data?.trips || result?.data || result?.trips || [];

    if (start && end) {
      tripsInPage = tripsInPage.filter((trip) => {
        const openDateTime = getTripField(trip, [
          "openDateTime",
          "tripOpenDateTime",
          "createdAt",
        ]);
        if (!openDateTime) return false;
        const tripDate = parseISODateTime(openDateTime);
        return tripDate && tripDate >= start && tripDate <= end;
      });
    }

    allTrips = allTrips.concat(tripsInPage);
    hasMore = result?.pagination?.hasNextPage || tripsInPage.length === limit;
    if (tripsInPage.length === 0) hasMore = false;
    offset += limit;

    if (!config.fastMode && config.rateLimitMs > 0) {
      Utilities.sleep(Math.min(config.rateLimitMs, 1000));
    }
  }

  return allTrips;
}

function getTripDetails(tripId) {
  const config = getConfig();
  const token = getAccessToken();
  const url = `${config.baseUrl}/v1/trips/${tripId}`;

  const response = UrlFetchApp.fetch(url, {
    method: "get",
    headers: { Authorization: `Bearer ${token}` },
    muteHttpExceptions: true,
  });

  const responseCode = response.getResponseCode();

  if (responseCode === 401) {
    Logger.log(`🔑 getTripDetails: Token expired for tripId=${tripId} - refreshing...`);
    getAccessToken();
    return getTripDetails(tripId);
  }

  if (responseCode !== 200) {
    Logger.log(`❌ getTripDetails: Failed for tripId=${tripId}, responseCode=${responseCode}`);
    return null;
  }

  return JSON.parse(response.getContentText());
}

// ============================================
// GOOGLE SHEETS OPERATIONS
// ============================================

function prepareSheet(sheetName, headers, clearData = true) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  } else if (clearData) {
    sheet.clear();
  }

  const lastRow = sheet.getLastRow();
  if (lastRow === 0 || clearData) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet
      .getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground("#4285F4")
      .setFontColor("#FFFFFF")
      .setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function saveTripsToSheet(trips, append = false, checkDuplicates = true) {
  const config = getConfig();
  const headers = [
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

  const sheet = prepareSheet(config.tripsSheetName, headers, !append);
  if (!trips || trips.length === 0) return;

  const lastRow = sheet.getLastRow();
  Logger.log(`📊 saveTripsToSheet: Started with ${trips.length} trips, sheet has ${lastRow} rows`);

  // อ่าน Trip IDs ที่มีอยู่ทั้งหมดในชีท
  const existingTripIdsMap = new Map(); // Trip ID -> Row Index
  if (lastRow > 1) {
    const existingData = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < existingData.length; i++) {
      if (existingData[i][0]) {
        existingTripIdsMap.set(String(existingData[i][0]).trim(), i + 2); // +2 because row 1 is header
      }
    }
    Logger.log(`📊 saveTripsToSheet: Found ${existingTripIdsMap.size} existing trips in sheet`);
  }

  // แยก trips เป็น 2 กลุ่ม: ที่จะอัพเดท และ ที่จะเพิ่มใหม่
  const tripsToUpdate = [];
  const tripsToAdd = [];

  for (const trip of trips) {
    const tripStatus = trip.tripStatus || {};
    const tripId = getTripField(trip, [
      "tripId",
      "id",
      "trip_code",
      "tripCode",
      "trip_id",
    ]);

    if (!tripId) continue; // ข้ามถ้าไม่มี Trip ID

    // ✅ Normalize Trip ID: trim whitespace และ convert to string
    const normalizedTripId = String(tripId).trim();

    // ✅ ดึง timestamps จาก API และแปลงเป็น Bangkok time
    const apiCreatedAt = formatISOToBangkok(getTripField(trip, ["createdAt", "created_at", "createdDate"]));
    const apiUpdatedAt = formatISOToBangkok(getTripField(trip, ["updatedAt", "updated_at", "updatedDate"]));
    const currentTimestamp = formatBangkokDateTime(new Date());

    const rowData = [
      tripId,
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
        getTripField(trip, ["tripStatus.statusId", "statusId", "status_id"]),
      tripStatus.statusName ||
        tripStatus.name ||
        getTripField(trip, [
          "tripStatus.statusName",
          "statusName",
          "status_name",
        ]),
      getTripField(trip, ["openDateTime", "tripOpenDateTime", "startDateTime"]),
      getTripField(trip, ["closeDateTime", "tripCloseDateTime", "endDateTime"]),
      getTripField(trip, ["distance", "totalDistance", "total_distance"]),
      apiCreatedAt,
      apiUpdatedAt,
    ];

    if (checkDuplicates && existingTripIdsMap.has(normalizedTripId)) {
      // Trip ID มีอยู่แล้ว -> อัพเดท
      const rowIndex = existingTripIdsMap.get(normalizedTripId);
      // ✅ สำหรับการ update: เก็บ createdAt เดิม แต่อัพเดท updatedAt เป็นเวลาปัจจุบัน
      rowData[8] = apiCreatedAt || rowData[8]; // Created At: ใช้ค่าจาก API หรือเก่า
      rowData[9] = currentTimestamp; // Updated At: เวลาปัจจุบัน
      tripsToUpdate.push({ rowIndex, rowData });
    } else {
      // Trip ID ไม่มี -> เพิ่มใหม่
      // ✅ สำหรับการ insert: ใช้เวลาปัจจุบันทั้ง createdAt และ updatedAt
      rowData[8] = currentTimestamp; // Created At: เวลาปัจจุบัน
      rowData[9] = currentTimestamp; // Updated At: เวลาปัจจุบัน
      tripsToAdd.push(rowData);
      // ✅ คำนวณ row index ที่ถูกต้อง: current lastRow + number of new trips added so far
      const currentLastRow = sheet.getLastRow();
      existingTripIdsMap.set(normalizedTripId, currentLastRow + tripsToAdd.length); // Mark as existing
    }
  }

  // อัพเดท trips ที่มีอยู่แล้ว
  if (tripsToUpdate.length > 0) {
    for (const { rowIndex, rowData } of tripsToUpdate) {
      sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
    }
    Logger.log(`✅ Updated ${tripsToUpdate.length} existing trips`);
  }

  // เพิ่ม trips ใหม่
  if (tripsToAdd.length > 0) {
    // ✅ ใช้ค่าปัจจุบันของชีทแทน lastRow ค่าเดิม
    const currentLastRow = sheet.getLastRow();
    const startRow = currentLastRow > 1 ? currentLastRow + 1 : 2;
    sheet
      .getRange(startRow, 1, tripsToAdd.length, tripsToAdd[0].length)
      .setValues(tripsToAdd);
    Logger.log(`✅ Added ${tripsToAdd.length} new trips (rows ${startRow}-${startRow + tripsToAdd.length - 1})`);
  }

  const finalRowCount = sheet.getLastRow() - 1; // Exclude header
  Logger.log(`📊 saveTripsToSheet: Complete. Final sheet has ${finalRowCount} trips total`);
}

function saveTripDetailsToSheet(
  tripDetails,
  append = false,
  checkDuplicates = true,
) {
  const config = getConfig();
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

  const headers = tripHeaders.concat(waypointHeaders);
  const sheet = prepareSheet(config.tripDetailsSheetName, headers, !append);
  if (!tripDetails || tripDetails.length === 0) return;

  const lastRow = sheet.getLastRow();
  Logger.log(`📊 saveTripDetailsToSheet: Started with ${tripDetails.length} details, sheet has ${lastRow} rows`);

  // อ่าน Trip IDs ที่มีอยู่ทั้งหมดในชีท
  const existingTripIdsMap = new Map(); // Trip ID -> Row Index
  if (lastRow > 1) {
    const existingData = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < existingData.length; i++) {
      if (existingData[i][0]) {
        existingTripIdsMap.set(String(existingData[i][0]).trim(), i + 2); // +2 because row 1 is header
      }
    }
    Logger.log(`📊 saveTripDetailsToSheet: Found ${existingTripIdsMap.size} existing details in sheet`);
  }

  // แยก trip details เป็น 2 กลุ่ม: ที่จะอัพเดท และ ที่จะเพิ่มใหม่
  const detailsToUpdate = [];
  const detailsToAdd = [];

  for (const detail of tripDetails) {
    const trip = detail.data || detail.trip || detail;
    const waypoints = trip.waypoints || [];

    // ✅ ดึง timestamps จาก API และแปลงเป็น Bangkok time
    const apiCreatedAt = formatISOToBangkok(getTripField(trip, ["createdAt", "created_at", "createdDate"]));
    const apiUpdatedAt = formatISOToBangkok(getTripField(trip, ["updatedAt", "updated_at", "updatedDate"]));
    const currentTimestamp = formatBangkokDateTime(new Date());

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
      getTripField(trip, ["statusId", "status_id", "status"]),
      getTripField(trip, ["statusName", "status_name"]),
      getTripField(trip, ["openDateTime", "tripOpenDateTime", "startDateTime"]),
      getTripField(trip, ["closeDateTime", "tripCloseDateTime", "endDateTime"]),
      getTripField(trip, ["distance", "totalDistance", "total_distance"]),
      getTripField(trip, ["driverName", "driver_name", "driverFullName"]),
      getTripField(trip, ["driverPhone", "driver_phone", "driverMobile"]),
      getTripField(trip, ["vehicleType", "vehicle_type", "vehicleModel"]),
      apiCreatedAt,
      apiUpdatedAt,
    ];

    const waypointData = [];
    for (let i = 0; i < 20; i++) {
      if (i < waypoints.length) {
        const wp = waypoints[i];
        waypointData.push(
          getValueOrDash(wp.sequence),
          getValueOrDash(wp.reference || wp.waypointReferenceId),
          getValueOrDash(wp.waypointName),
          getValueOrDash(wp.address),
          getValueOrDash(wp.latitude),
          getValueOrDash(wp.longitude),
          getValueOrDash(wp.actualArrivalDateTime || wp.arrivalDateTime),
          getValueOrDash(wp.actualDepartureDateTime || wp.departureDateTime),
          getValueOrDash(wp.status || wp.waypointStatus),
        );
      } else {
        waypointData.push("--", "--", "--", "--", "--", "--", "--", "--", "--");
      }
    }

    const rowData = tripData.concat(waypointData);
    const tripId = rowData[0];

    if (!tripId) continue; // ข้ามถ้าไม่มี Trip ID

    // ✅ Normalize Trip ID: trim whitespace และ convert to string
    const normalizedTripId = String(tripId).trim();

    if (checkDuplicates && existingTripIdsMap.has(normalizedTripId)) {
      // Trip ID มีอยู่แล้ว -> อัพเดท
      const rowIndex = existingTripIdsMap.get(normalizedTripId);
      // ✅ สำหรับการ update: เก็บ createdAt เดิม แต่อัพเดท updatedAt เป็นเวลาปัจจุบัน
      rowData[10] = apiCreatedAt || rowData[10]; // Created At: ใช้ค่าจาก API หรือเก่า
      rowData[11] = currentTimestamp; // Updated At: เวลาปัจจุบัน
      detailsToUpdate.push({ rowIndex, rowData });
    } else {
      // Trip ID ไม่มี -> เพิ่มใหม่
      // ✅ สำหรับการ insert: ใช้เวลาปัจจุบันทั้ง createdAt และ updatedAt
      rowData[10] = currentTimestamp; // Created At: เวลาปัจจุบัน
      rowData[11] = currentTimestamp; // Updated At: เวลาปัจจุบัน
      detailsToAdd.push(rowData);
      // ✅ คำนวณ row index ที่ถูกต้อง: current lastRow + number of new details added so far
      const currentLastRow = sheet.getLastRow();
      existingTripIdsMap.set(normalizedTripId, currentLastRow + detailsToAdd.length); // Mark as existing
    }
  }

  // อัพเดท trip details ที่มีอยู่แล้ว
  if (detailsToUpdate.length > 0) {
    for (const { rowIndex, rowData } of detailsToUpdate) {
      sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
    }
    Logger.log(`✅ Updated ${detailsToUpdate.length} existing trip details`);
  }

  // เพิ่ม trip details ใหม่
  if (detailsToAdd.length > 0) {
    // ✅ ใช้ค่าปัจจุบันของชีทแทน lastRow ค่าเดิม
    const currentLastRow = sheet.getLastRow();
    const startRow = currentLastRow > 1 ? currentLastRow + 1 : 2;
    sheet
      .getRange(startRow, 1, detailsToAdd.length, detailsToAdd[0].length)
      .setValues(detailsToAdd);
    Logger.log(`✅ Added ${detailsToAdd.length} new trip details (rows ${startRow}-${startRow + detailsToAdd.length - 1})`);
  }

  const finalRowCount = sheet.getLastRow() - 1; // Exclude header
  Logger.log(`📊 saveTripDetailsToSheet: Complete. Final sheet has ${finalRowCount} trip details total`);
}

// ============================================
// CORE PULL FUNCTION (Unified)
// ============================================

/**
 * ฟังก์ชันกลางสำหรับดึงข้อมูลทั้งหมด
 * @param {Object} options - ตัวเลือกการดึงข้อมูล
 * @param {string} options.mode - 'FRESH' (ล้างของเก่า) หรือ 'APPEND' (เพิ่ม)
 * @param {string} options.startDate - วันที่เริ่ม (YYYY-MM-DD)
 * @param {string} options.endDate - วันที่สิ้นสุด (YYYY-MM-DD)
 * @param {string} options.statusId - Status ID (ว่าง = ทั้งหมด)
 * @param {number} options.limit - จำนวนสูงสุดต่อ Status (null = ไม่จำกัด)
 * @param {boolean} options.showAlert - แสดง alert ทุก Status (true) หรือ toast เท่านั้น (false)
 * @returns {Object} - { success: boolean, message: string }
 */
function pullTripsUnified(options = {}) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const scriptProperties = PropertiesService.getScriptProperties();
  const config = getConfig();

  const {
    mode = "FRESH",
    startDate = null,
    endDate = null,
    statusId = "ALL",
    limit = null,
    showAlert = true,
  } = options;

  try {
    if (!hasSavedCredentials()) {
      return {
        success: false,
        message: "No saved credentials found. Please login first.",
      };
    }

    const STATUS_IDS =
      statusId === "ALL" ? CONFIG.STATUS_IDS : [parseInt(statusId)];
    const statusText =
      statusId === "ALL" ? "ทุก Status (1-5)" : `Status ${statusId}`;
    const dateText =
      startDate && endDate ? `วันที่ ${startDate} ถึง ${endDate}` : "ทุกวันที่";
    const limitText = limit ? `Limit ${limit} รายการ/Status` : "ไม่จำกัด";
    const modeEmoji = mode === "FRESH" ? "🔄" : "➕";
    const modeText = mode === "FRESH" ? "FRESH" : "APPEND";

    ss.toast(`${modeEmoji} Starting ${modeText} pull...`, "MLSTMS Trips", 5);
    Logger.log(
      `${modeEmoji} Starting ${modeText} pull: ${statusText}, ${dateText}, ${limitText}`,
    );

    const token = login();
    if (!token) {
      return {
        success: false,
        message: "Login failed. Please check your credentials.",
      };
    }

    let allTrips = [];
    let allTripDetails = [];
    let totalSuccessful = 0;
    let totalSkipped = 0;
    const startTime = new Date();

    for (let i = 0; i < STATUS_IDS.length; i++) {
      const currentStatusId = STATUS_IDS[i];
      const isLastStatus = i === STATUS_IDS.length - 1;

      const statusMessage = `${modeEmoji} [${i + 1}/${STATUS_IDS.length}] กำลังดึง Status ${currentStatusId}...`;
      ss.toast(statusMessage, "MLSTMS Trips", 30);

      if (showAlert) {
        try {
          SpreadsheetApp.getUi().alert(
            `${modeEmoji} ${modeText} Pull - Status ${currentStatusId}`,
            `กำลังดึงข้อมูล Status ${currentStatusId}...\n\n` +
              `ความคืบหน้า: ${i + 1}/${STATUS_IDS.length}\n` +
              `Status นี้: ${isLastStatus ? "(สุดท้าย)" : "(ยังมีต่อ)"}`,
            ui.ButtonSet.OK,
          );
        } catch (e) {
          Logger.log(`ℹ️ Could not show alert (trigger context): ${e.message}`);
        }
      }

      Logger.log(
        `📋 [${i + 1}/${STATUS_IDS.length}] Fetching Status ${currentStatusId}...`,
      );

      try {
        const trips = getAllTripsForStatusIdWithDateFilter(
          currentStatusId,
          startDate,
          endDate,
        );

        const limitedTrips = limit ? trips.slice(0, limit) : trips;

        if (limitedTrips.length === 0) {
          ss.toast(
            `⏭️ Status ${currentStatusId}: ไม่มีข้อมูล - ข้าม`,
            "MLSTMS Trips",
            5,
          );
          Logger.log(`   ⏭️ Status ${currentStatusId}: No data - skipping`);
          continue;
        }

        ss.toast(
          `✅ Status ${currentStatusId}: พบ ${limitedTrips.length} รายการ`,
          "MLSTMS Trips",
          5,
        );
        Logger.log(
          `   ✅ Status ${currentStatusId}: ${limitedTrips.length} trips found`,
        );

        allTrips = allTrips.concat(limitedTrips);

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

          if ((j + 1) % 10 === 0 || j === limitedTrips.length - 1) {
            ss.toast(
              `📊 Status ${currentStatusId}: กำลังดึง Details ${j + 1}/${limitedTrips.length}`,
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

          if (!config.fastMode && config.rateLimitMs > 0) {
            Utilities.sleep(config.rateLimitMs);
          }
        }

        allTripDetails = allTripDetails.concat(tripDetails);
        Logger.log(
          `   ✅ Status ${currentStatusId}: ${tripDetails.length} details fetched`,
        );
      } catch (error) {
        ss.toast(
          `❌ Status ${currentStatusId}: เกิดข้อผิดพลาด`,
          "MLSTMS Trips",
          10,
        );
        Logger.log(
          `   ❌ Error fetching Status ${currentStatusId}: ${error.message}`,
        );
      }

      Utilities.sleep(2000);
    }

    if (allTrips.length === 0) {
      return {
        success: false,
        message: "No trips found in the specified date range.",
      };
    }

    ss.toast(`💾 กำลังบันทึก Trips...`, "MLSTMS Trips", 10);
    const appendMode = mode === "APPEND";
    const checkDupMode = true; // ✅ เช็คซ้ำเสมอ ไม่ว่าจะ mode ไหน
    saveTripsToSheet(allTrips, appendMode, checkDupMode);

    ss.toast(`💾 กำลังบันทึก Trip Details...`, "MLSTMS Trips", 10);
    saveTripDetailsToSheet(allTripDetails, appendMode, checkDupMode);

    const totalTime = Math.round((new Date() - startTime) / 1000);
    const minutes = Math.floor(totalTime / 60);
    const seconds = totalTime % 60;

    ss.toast(`✅ ${modeText} pull completed!`, "MLSTMS Trips", 10);
    Logger.log(`✅ ${modeText} pull completed!`);

    const summaryMessage =
      `✅ ${modeText} pull completed!\n\n` +
      `${allTrips.length} trips ${mode === "FRESH" ? "saved (old data cleared)" : "processed (new added, existing updated)"}\n` +
      `${allTripDetails.length} trip details ${mode === "FRESH" ? "saved (old data cleared)" : "processed (new added, existing updated)"}\n\n` +
      `📅 ช่วงวันที่: ${dateText}\n` +
      `🔍 Status: ${statusText}\n` +
      `${mode === "APPEND" ? "💡 ข้อมูลเดิมยังอยู่ - เพิ่มเฉพาะข้อมูลใหม่\n" : ""}` +
      (totalSkipped > 0
        ? `⚠️ Warning: ${totalSkipped} trip(s) could not be fetched.\n\n`
        : "") +
      `Total time: ${minutes}m ${seconds}s`;

    return { success: true, message: summaryMessage };
  } catch (error) {
    ss.toast("❌ Error occurred", "MLSTMS Trips", 10);
    Logger.log(`❌ Error: ${error.message}`);
    return { success: false, message: `Error: ${error.message}` };
  } finally {
    scriptProperties.deleteProperty("TEMP_START_DATE");
    scriptProperties.deleteProperty("TEMP_END_DATE");
    scriptProperties.deleteProperty("TEMP_STATUS_ID");
    scriptProperties.deleteProperty("TEMP_LIMIT");
  }
}

// ============================================
// WRAPPER FUNCTIONS (保持向后兼容)
// ============================================

function executePullTripsToSheetFresh() {
  const props = PropertiesService.getScriptProperties();
  return pullTripsUnified({
    mode: "FRESH",
    startDate: props.getProperty("TEMP_START_DATE") || null,
    endDate: props.getProperty("TEMP_END_DATE") || null,
    statusId: props.getProperty("TEMP_STATUS_ID") || "ALL",
    limit: props.getProperty("TEMP_LIMIT")
      ? parseInt(props.getProperty("TEMP_LIMIT"))
      : null,
    showAlert: true,
  });
}

function executePullTripsToSheetAppend() {
  const props = PropertiesService.getScriptProperties();
  return pullTripsUnified({
    mode: "APPEND",
    startDate: props.getProperty("TEMP_START_DATE") || null,
    endDate: props.getProperty("TEMP_END_DATE") || null,
    statusId: props.getProperty("TEMP_STATUS_ID") || "ALL",
    limit: props.getProperty("TEMP_LIMIT")
      ? parseInt(props.getProperty("TEMP_LIMIT"))
      : null,
    showAlert: true,
  });
}

function pullTripIdsOnly(startDate = null, endDate = null, statusId = null) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const scriptProperties = PropertiesService.getScriptProperties();

  try {
    if (startDate) scriptProperties.setProperty("TEMP_START_DATE", startDate);
    if (endDate) scriptProperties.setProperty("TEMP_END_DATE", endDate);
    if (statusId) scriptProperties.setProperty("TEMP_STATUS_ID", statusId);

    const token = login();
    if (!token) throw new Error("Login failed");

    const STATUS_IDS = statusId ? [parseInt(statusId)] : CONFIG.STATUS_IDS;
    let allTrips = [];

    for (const sid of STATUS_IDS) {
      const trips = getAllTripsForStatusIdWithDateFilter(
        sid,
        startDate,
        endDate,
      );
      allTrips = allTrips.concat(trips);
      Utilities.sleep(1000);
    }

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

    scriptProperties.deleteProperty("TEMP_START_DATE");
    scriptProperties.deleteProperty("TEMP_END_DATE");
    scriptProperties.deleteProperty("TEMP_STATUS_ID");

    if (uniqueTrips.length === 0) {
      ui.alert(
        "⚠️ No Trips Found",
        `ไม่พบ Trip IDs ในช่วงเวลาที่เลือก`,
        ui.ButtonSet.OK,
      );
      return 0;
    }

    saveTripsToSheet(uniqueTrips, false, true);
    ui.alert(
      "✅ Phase 1 Complete!",
      `ดึง Trip IDs สำเร็จ!\n\nจำนวน: ${uniqueTrips.length}`,
      ui.ButtonSet.OK,
    );
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

// ============================================
// DIALOG BUILDERS (Unified)
// ============================================

/**
 * สร้าง Dialog สำหรับเลือกวันที่/Status/Limit
 * @param {string} mode - 'FRESH' หรือ 'APPEND'
 */
function showPullModeDialog(mode) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const hasSavedCreds = hasSavedCredentials();

  if (!hasSavedCreds) {
    SpreadsheetApp.getUi().alert(
      "⚠️ ต้อง Login ก่อน",
      "กรุณา Login ก่อนดึงข้อมูล\n\nใช้เมนู: 🔐 Login & Pull Data",
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
    return;
  }

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

  const isFresh = mode === "FRESH";
  const modeEmoji = isFresh ? "🔄" : "➕";
  const modeTitle = isFresh ? "Fresh Start (เริ่มใหม่)" : "Append (เพิ่ม)";
  const modeSubtitle = isFresh
    ? "ล้างข้อมูลเก่าแล้วดึงใหม่ทั้งหมด"
    : "เพิ่มข้อมูลใหม่เข้าไปในข้อมูลเดิม";
  const modeColor = isFresh ? "#EA4335" : "#34A853";
  const modeClass = isFresh ? "btn-danger" : "btn-success";

  const html = HtmlService.createHtmlOutput(
    `
    <!DOCTYPE html>
    <html>
    <head>
      <base target="_top">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 450px; margin: 0 auto; background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h2 { color: ${modeColor}; margin-top: 0; margin-bottom: 5px; text-align: center; }
        .subtitle { text-align: center; color: #666; font-size: 13px; margin-bottom: 20px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; font-weight: 500; margin-bottom: 5px; color: #333; font-size: 13px; }
        input[type="date"], input[type="number"], select { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box; }
        input:focus, select:focus { outline: none; border-color: ${modeColor}; }
        .hint { font-size: 11px; color: #888; margin-top: 3px; }
        .btn-group { display: flex; gap: 10px; margin-top: 20px; }
        button { flex: 1; padding: 12px; border: none; border-radius: 4px; font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.3s; }
        .${modeClass} { background: ${modeColor}; color: white; }
        .${modeClass}:hover { background: ${isFresh ? "#D33426" : "#2D9249"}; }
        .btn-secondary { background: #f1f3f4; color: #333; }
        .btn-secondary:hover { background: #e8eaed; }
        .${isFresh ? "warning-box" : "success-box"} { padding: 12px; border-radius: 4px; font-size: 12px; margin-bottom: 15px; ${isFresh ? "background: #fce8e6; color: #c5221f;" : "background: #e6f4ea; color: #137333;"} }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>${modeEmoji} ${modeTitle}</h2>
        <div class="subtitle">${modeSubtitle}</div>
        <div class="${isFresh ? "warning-box" : "success-box"}">
          ${isFresh ? "⚠️ โหมดนี้จะล้างข้อมูลเก่าทั้งหมด<br>ข้อมูลเดิมในชีทจะหายไป!" : "✅ โหมดนี้จะเก็บข้อมูลเดิมไว้<br>ตรวจสอบ Trip ID เพื่อหลีกเลี่ยงข้อมูลซ้ำ"}
        </div>
        <div class="form-group">
          <label>📅 วันที่เริ่ม</label>
          <input type="date" id="startDate" value="${savedStartDate}" required>
        </div>
        <div class="form-group">
          <label>📅 วันที่สิ้นสุด</label>
          <input type="date" id="endDate" value="${savedEndDate}" required>
        </div>
        <div class="form-group">
          <label>🔢 Status ID</label>
          <select id="statusId">
            <option value="ALL" ${!savedStatusId ? "selected" : ""}>ทุก Status (1-5)</option>
            <option value="1" ${savedStatusId === "1" ? "selected" : ""}>1 - Open</option>
            <option value="2" ${savedStatusId === "2" ? "selected" : ""}>2 - In Progress</option>
            <option value="3" ${savedStatusId === "3" ? "selected" : ""}>3 - Completed</option>
            <option value="4" ${savedStatusId === "4" ? "selected" : ""}>4 - Cancelled</option>
            <option value="5" ${savedStatusId === "5" ? "selected" : ""}>5 - Other</option>
          </select>
        </div>
        <div class="form-group">
          <label>📊 Limit (จำนวนสูงสุดต่อ Status)</label>
          <input type="number" id="limit" value="${savedLimit}" min="1" max="5000">
          <div class="hint">ถ้าไม่ระบุจะดึงทั้งหมด</div>
        </div>
        <div class="btn-group">
          <button type="button" class="btn-secondary" onclick="google.script.host.close()">ปิด</button>
          <button type="button" class="${modeClass}" onclick="submitPull()">${modeEmoji} เริ่ม ${mode}</button>
        </div>
      </div>
      <script>
        function submitPull() {
          const startDate = document.getElementById('startDate').value;
          const endDate = document.getElementById('endDate').value;
          const statusId = document.getElementById('statusId').value;
          const limit = document.getElementById('limit').value;
          if (!startDate || !endDate) { alert('❌ กรุณาระบุวันที่เริ่มและวันที่สิ้นสุด'); return; }
          if (startDate > endDate) { alert('❌ วันที่เริ่มต้องไม่หลังวันที่สิ้นสุด'); return; }
          const confirmed = confirm('${isFresh ? "⚠️ ยืนยันเริ่ม Fresh Start?\\n\\nข้อมูลเดิมในชีทจะหายไป!" : "✅ ยืนยันเริ่ม Append?\\n\\nข้อมูลเดิมจะถูกเก็บไว้"}');
          if (confirmed) {
            google.script.run.withSuccessHandler(function(result) {
              if (result.success) { alert('✅ ${mode} สำเร็จ!\\n\\n' + result.message); google.script.host.close(); }
              else { alert('❌ เกิดข้อผิดพลาด: ' + result.message); }
            }).withFailureHandler(function(error) { alert('❌ เกิดข้อผิดพลาด: ' + error.message); })
            .saveTempParametersAndExecute("${mode}", startDate, endDate, statusId, limit);
          }
        }
      </script>
    </body>
    </html>
  `,
  )
    .setWidth(480)
    .setHeight(600)
    .setTitle(`${modeEmoji} ${mode}`);

  SpreadsheetApp.getUi().showModalDialog(html, modeTitle);
}

function showPullModeFreshDialog() {
  showPullModeDialog("FRESH");
}
function showPullModeAppendDialog() {
  showPullModeDialog("APPEND");
}

function saveTempParametersAndExecute(
  mode,
  startDate,
  endDate,
  statusId,
  limit,
) {
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty("TEMP_START_DATE", startDate);
  scriptProperties.setProperty("TEMP_END_DATE", endDate);
  scriptProperties.setProperty("TEMP_STATUS_ID", statusId);
  scriptProperties.setProperty("TEMP_LIMIT", limit);

  return mode === "FRESH"
    ? executePullTripsToSheetFresh()
    : executePullTripsToSheetAppend();
}

// ============================================
// MENU SIMPLIFIED
// ============================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const hasCreds = hasSavedCredentials();
  const menu = ui.createMenu("🚚 MLSTMS Trips");

  if (!hasCreds) {
    menu.addItem("🔐 Login & Pull Data", "showLoginDialog").addToUi();
    return;
  }

  menu
    .addItem("💡 Smart Advisor (แนะนำวิธีดึงข้อมูล)", "showSmartAdvisorDialog")
    .addSeparator()
    .addSubMenu(
      ui
        .createMenu("🔄 Pull Mode (โหมดดึงข้อมูล)")
        .addItem("🔄 Fresh Start (เริ่มใหม่)", "showPullModeFreshDialog")
        .addItem("➕ Append (เพิ่ม)", "showPullModeAppendDialog"),
    )
    .addSeparator()
    .addItem("📅 Pull Today's Data", "pullTodayData")
    .addItem("⚡ Fast Pull All", "fastPullAll")
    .addItem("📥 Quick Pull", "showQuickPullDialog")
    .addSeparator()
    .addItem("⚙️ Set Performance Mode", "setPerformanceMode")
    .addItem("⚡ Toggle Fast Mode", "toggleFastMode")
    .addSeparator()
    .addItem("🔍 Test API Connection", "testConnection")
    .addItem("📊 Estimate Trip Count", "estimateTripCountWithUI")
    .addSeparator()
    .addItem("👁️ View Config", "viewConfig")
    .addItem("🔄 Reset All State", "resetAllState")
    .addToUi();
}

// ============================================
// PROGRESS DISPLAY SYSTEM
// ============================================

/**
 * แสดง Progress Toast มุมขวาล่าง
 * @param {string} message - ข้อความ
 * @param {number} current - ค่าปัจจุบ
 * @param {number} total - ค่ารวมทั้งหมด
 */
function showProgressToast(message, current, total) {
  const percentage = Math.round((current / total) * 100);
  SpreadsheetApp.getActiveSpreadsheet().toast(
    `${message} (${current}/${total} - ${percentage}%)`,
    "MLSTMS Trips",
    5,
  );
}

/**
 * แสดง Progress Alert มุมขวาล่าง (สำหรับ Progress ยาวๆ)
 * @param {string} title - หัวข้อ
 * @param {string} message - ข้อความ
 * @param {number} current - ค่าปัจจุบ
 * @param {number} total - ค่ารวมทั้งหมด
 */
function showProgressAlert(title, message, current, total) {
  try {
    const percentage = Math.round((current / total) * 100);
    SpreadsheetApp.getUi().alert(
      title,
      `${message}\n\nความคืบหน้า: ${current}/${total} (${percentage}%)`,
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
  } catch (e) {
    // Running in trigger context - ignore alert
  }
}

/**
 * แสดง Summary Alert เมื่อเสร็จสิ้น
 */
function showSummaryAlert(title, summary) {
  try {
    SpreadsheetApp.getUi().alert(
      title,
      summary,
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
  } catch (e) {
    // Running in trigger context - ignore alert
  }
}

// ============================================
// 2-PHASE PULL SYSTEM
// ============================================

/**
 * Phase 1: ดึง Trip IDs ทั้งหมด (Trip List Only)
 * ดึง Trip IDs จาก Status ID และช่วงวันที่กำหนด
 * ตรวจสอบ Trip ID ซ้ำ - เพิ่มใหม่ถ้าไม่มี, อัพเดทถ้ามี
 * เก็บ Trip ID ล่าสุดไว้สำหรับ Phase 2
 */
function pullTripIdsPhase1(startDate, endDate, statusId = "ALL") {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const scriptProperties = PropertiesService.getScriptProperties();
  const config = getConfig();

  try {
    // ตั้งค่าเริ่มต้น
    const today = new Date();
    const todayStr = Utilities.formatDate(
      today,
      Session.getScriptTimeZone(),
      "yyyy-MM-dd",
    );
    startDate =
      startDate || scriptProperties.getProperty("START_DATE") || todayStr;
    endDate = endDate || scriptProperties.getProperty("END_DATE") || todayStr;

    const STATUS_IDS =
      statusId === "ALL" ? CONFIG.STATUS_IDS : [parseInt(statusId)];
    const statusText =
      statusId === "ALL" ? "ทุก Status (1-5)" : `Status ${statusId}`;
    const dateText = `วันที่ ${startDate} ถึง ${endDate}`;

    ss.toast("🔄 Phase 1: ดึง Trip IDs...", "MLSTMS Trips", 5);
    Logger.log(`🔄 Phase 1: Pulling Trip IDs - ${statusText}, ${dateText}`);

    // Login
    const token = login();
    if (!token) throw new Error("Login failed");

    // เตรียมชีท
    const sheet = prepareSheet(
      config.tripsSheetName,
      [
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
      ],
      false,
    );

    // ✅ ใช้ array รวมทุก status เพื่อบันทึกทีเดียวด้วย saveTripsToSheet()
    let allTripsForAllStatuses = [];
    let totalFetched = 0;

    for (let i = 0; i < STATUS_IDS.length; i++) {
      const currentStatusId = STATUS_IDS[i];
      const isLastStatus = i === STATUS_IDS.length - 1;

      showProgressToast("📋 Phase 1: ดึง Trip IDs", i + 1, STATUS_IDS.length);

      // ✅ ดึง Trip IDs โดยตรง API (ตาม URL ที่ระบุ)
      const trips = fetchTripsFromAPI(currentStatusId, startDate, endDate);

      if (trips.length === 0) {
        ss.toast(
          `⏭️ Status ${currentStatusId}: ไม่มีข้อมูล`,
          "MLSTMS Trips",
          3,
        );
        Logger.log(`   ⏭️ Status ${currentStatusId}: No data - skipping`);
        continue;
      }

      ss.toast(
        `✅ Status ${currentStatusId}: พบ ${trips.length} รายการ`,
        "MLSTMS Trips",
        5,
      );
      Logger.log(
        `   ✅ Status ${currentStatusId}: ${trips.length} trips found`,
      );

      // ✅ เพิ่ม trips ทั้งหมดใน status นี้ลงใน array ชั่วคราว
      // แล้วค่อยเรียก saveTripsToSheet() ครั้งเดียวเพื่อป้องกันการซ้ำ
      const tripsForCurrentStatus = trips.map(trip => ({ ...trip, _tempStatusId: currentStatusId }));
      allTripsForAllStatuses = allTripsForAllStatuses.concat(tripsForCurrentStatus);
      totalFetched += trips.length;

      Logger.log(
        `   📊 Status ${currentStatusId}: ${trips.length} fetched`,
      );

      // Rate limiting ระหว่าง Status IDs
      Utilities.sleep(2000);
    }

    // ✅ เรียก saveTripsToSheet() ครั้งเดียวหลังจากดึงครบทุก status
    // เพื่อให้ duplicate checking ทำงานถูกต้องทั้งหมด
    ss.toast(`💾 กำลังบันทึก Trips ทั้งหมด ${allTripsForAllStatuses.length} รายการ...`, "MLSTMS Trips", 10);
    saveTripsToSheet(allTripsForAllStatuses, true, true);

    // ✅ อ่านจำนวน trips ที่แท้จริงในชีทหลังจากบันทึก
    const actualLastRow = sheet.getLastRow();
    const actualTotalTrips = actualLastRow > 1 ? actualLastRow - 1 : 0;

    // เก็บ Trip IDs ไว้สำหรับ Phase 2
    const allTripIdsSet = new Set();
    for (const trip of allTripsForAllStatuses) {
      const tripId = getTripField(trip, ["id", "tripId", "trip_code", "tripCode", "trip_id"]);
      if (tripId) allTripIdsSet.add(String(tripId));
    }
    const tripIdArray = Array.from(allTripIdsSet);
    const latestTripId = tripIdArray.length > 0 ? tripIdArray[tripIdArray.length - 1] : "";

    scriptProperties.setProperty("LATEST_TRIP_ID", latestTripId);
    scriptProperties.setProperty("TOTAL_TRIP_IDS", allTripIdsSet.size.toString());
    scriptProperties.setProperty("TRIP_IDS_LIST", JSON.stringify(tripIdArray));

    // แสดง Summary
    const summaryMessage =
      `✅ Phase 1 Complete!\n\n` +
      `📊 สรุปเสร็จ:\n` +
      `• ดึงข้อมูลจาก API: ${totalFetched} รายการ\n` +
      `• บันทึกลงชีท: ${actualTotalTrips} รายการ (ไม่ซ้ำ)\n` +
      `• รวม Trip IDs ทั้งหมด: ${allTripIdsSet.size} IDs\n\n` +
      `📅 ช่วงเวลา: ${dateText}\n` +
      `🔍 Status: ${statusText}\n\n` +
      `👉 ถัดไป: ใช้ "Phase 2: Pull Trip Details" เพื่อดึงรายละเอียด`;

    showSummaryAlert("✅ Phase 1 Complete!", summaryMessage);
    return allTripIdsSet.size;
  } catch (error) {
    ss.toast("❌ Error occurred", "MLSTMS Trips", 10);
    showSummaryAlert(
      "❌ Phase 1 Failed",
      `เกิดข้อผิดพลาด:\n\n${error.message}`,
    );
    throw error;
  }
}

/**
 * ดึง Trips จาก API โดยตรง (ตาม URL ที่ระบุ)
 * ✅ รองรับ Pagination - ดึงข้อมูลครบทุกหน้า
 */
function fetchTripsFromAPI(statusId, startDate, endDate) {
  const config = getConfig();
  const token = getAccessToken();

  let allTrips = [];
  let cursor = ""; // ✅ Cursor-based pagination: เริ่มต้นด้วยค่าว่าง
  const limit = 100;
  let hasMore = true;
  let pageCount = 0;

  Logger.log(`🌐 fetchTripsFromAPI: START fetching trips for statusId=${statusId}`);
  Logger.log(`   📅 Date Range: ${startDate || "ALL"} to ${endDate || "ALL"}`);
  Logger.log(`   📄 Pagination: limit=${limit}, cursor-based pagination`);

  while (hasMore) {
    pageCount++;
    const params = [
      `statusId=${statusId}`,
      `limit=${limit}`,
    ];

    // ✅ เพิ่ม cursor เฉพาะเมื่อมีค่า (ไม่ใช่ครั้งแรก)
    if (cursor) {
      params.push(`cursor=${cursor}`);
    }

    if (startDate) params.push(`startDate=${startDate}`);
    if (endDate) params.push(`endDate=${endDate}`);

    const url = `${config.baseUrl}/v1/trips?${params.join("&")}`;

    // ✅ Log API request details
    Logger.log(`🌐 [Page ${pageCount}] API Request:`);
    Logger.log(`   🔗 URL: ${config.baseUrl}/v1/trips`);
    Logger.log(`   📋 Params: statusId=${statusId}, limit=${limit}${cursor ? `, cursor=${cursor}` : ", cursor=(empty)"}${startDate ? `, startDate=${startDate}` : ""}${endDate ? `, endDate=${endDate}` : ""}`);
    Logger.log(`   🔑 Auth: Bearer ${token.substring(0, 20)}...`);

    const response = UrlFetchApp.fetch(url, {
      method: "get",
      headers: { Authorization: `Bearer ${token}` },
      muteHttpExceptions: true,
    });

    const responseCode = response.getResponseCode();
    Logger.log(`   📡 Response Code: ${responseCode}`);

    if (responseCode === 401) {
      Logger.log(`   🔑 Token expired - refreshing...`);
      getAccessToken();
      continue;
    }

    if (responseCode !== 200) {
      Logger.log(`   ❌ Error response: ${responseCode} - stopping pagination`);
      hasMore = false;
      break;
    }

    const result = JSON.parse(response.getContentText());
    let tripsInPage = result?.data?.trips || result?.data || result?.trips || [];

    // ✅ Log pagination info
    const nextCursor = result?.pagination?.cursor || result?.cursor || "";
    const hasNextPage = result?.pagination?.hasNextPage || false;
    const totalRecords = result?.pagination?.totalRecords || "unknown";

    Logger.log(`   📊 Page ${pageCount}: ${tripsInPage.length} trips received (total so far: ${allTrips.length + tripsInPage.length})`);
    Logger.log(`   📄 nextCursor: "${nextCursor || "(empty)"}", hasNextPage: ${hasNextPage}${totalRecords !== "unknown" ? `, totalRecords: ${totalRecords}` : ""}`);

    allTrips = allTrips.concat(tripsInPage);

    // ✅ เช็คเงื่อนไขหยุด pagination:
    // 1. cursor เป็นค่าว่าง หรือ
    // 2. hasNextPage = false หรือ
    // 3. ไม่มี trips ในหน้านี้
    if (!nextCursor || nextCursor.trim() === "" || !hasNextPage) {
      Logger.log(`   ⏹️ No more pages - stopping pagination`);
      hasMore = false;
    } else if (tripsInPage.length === 0) {
      Logger.log(`   ⏹️ No more data - stopping pagination`);
      hasMore = false;
    } else {
      // ✅ อัพเดท cursor สำหรับหน้าถัดไป
      cursor = nextCursor;
      Logger.log(`   ➡️ Moving to next page with cursor: ${cursor.substring(0, 20)}...`);
    }

    // Rate limiting ระหว่างหน้า
    if (!config.fastMode && config.rateLimitMs > 0) {
      Utilities.sleep(Math.min(config.rateLimitMs, 1000));
    }

    // ✅ ป้องกัน infinite loop - หยุดถ้าเกิน 100 หน้า
    if (pageCount > 100) {
      Logger.log(`⚠️ fetchTripsFromAPI: Reached maximum page count (100) for statusId=${statusId}`);
      break;
    }
  }

  Logger.log(`✅ fetchTripsFromAPI: COMPLETE - statusId=${statusId}, fetched ${allTrips.length} trips in ${pageCount} pages`);
  return allTrips;
}

/**
 * Phase 2: ดึง Trip Details ตาม Trip IDs จาก Phase 1
 * ดึงรายละเอียดทีละ Trip ID จนครบ
 * บันทึกลง TripDetails Sheet
 *
 * ✅ BATCH WRITE: รวบข้อมูลทั้งหมดก่อน save ทีเดียว (เร็วกว่ามาก)
 *
 * อ่าน Trip IDs เฉพาะจาก Phase 1 Storage (Script Properties)
 */
function pullTripDetailsPhase2() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const config = getConfig();
  const scriptProperties = PropertiesService.getScriptProperties();

  try {
    // อ่าน Trip IDs เฉพาะจาก Phase 1 Storage เท่านั้น
    const tripIds = readTripIdsFromPhase1();

    if (tripIds.length === 0) {
      ui.alert(
        "⚠️ No Trip IDs Found",
        `ไม่พบ Trip IDs จาก Phase 1\n\n` +
          `กรุณารัน Phase 1 ก่อนเพื่อดึง Trip IDs`,
        ui.ButtonSet.OK,
      );
      return;
    }

    const confirmed = ui.alert(
      "📋 Phase 2: ดึง Trip Details",
      `จำนวน Trip IDs จาก Phase 1: ${tripIds.length} รายการ\n\n` +
        `เวลาโดยประมาณ: ~${Math.ceil((tripIds.length * 0.6) / 60)} นาที\n\n` +
        `ต้องการดำเนินการต่อหรือไม่?`,
      ui.ButtonSet.YES_NO,
    );

    if (confirmed !== ui.Button.YES) return;

    ss.toast("🔐 Logging in...", "MLSTMS Trips", 5);
    const token = login();
    if (!token) throw new Error("Login failed");

    const startTime = new Date();

    // ✅ รวบ Trip Details ทั้งหมดก่อน (batch collect)
    const allDetails = [];
    let successful = 0;
    let failed = 0;

    ss.toast(`📋 Phase 2: กำลังดึง Trip Details ${tripIds.length} รายการ...`, "MLSTMS Trips", 10);
    Logger.log(`📋 Phase 2: Starting to fetch ${tripIds.length} trip details...`);

    for (let i = 0; i < tripIds.length; i++) {
      const tripId = tripIds[i];
      const progress = Math.round(((i + 1) / tripIds.length) * 100);

      // Progress update ทุก 10% หรือทุก 50 รายการ
      if ((i + 1) % 50 === 0 || (i + 1) % Math.floor(tripIds.length / 10) === 0 || i === tripIds.length - 1) {
        ss.toast(
          `📋 กำลังดึง Details: ${i + 1}/${tripIds.length} (${progress}%)`,
          "MLSTMS Trips",
          5,
        );
        Logger.log(`   📊 Progress: ${i + 1}/${tripIds.length} (${progress}%) - fetched: ${successful}, failed: ${failed}`);
      }

      // ✅ ดึง Trip Details โดยตรง API (ตาม URL ที่ระบุ)
      const detail = fetchTripDetailsFromAPI(tripId);

      if (detail) {
        allDetails.push(detail);  // ✅ เก็บไว้ใน array ก่อน
        successful++;
      } else {
        failed++;
      }

      // Rate limiting
      if (!config.fastMode && config.rateLimitMs > 0) {
        Utilities.sleep(config.rateLimitMs);
      }
    }

    Logger.log(`   ✅ Fetched ${allDetails.length} trip details (successful: ${successful}, failed: ${failed})`);

    // ✅ Batch write ทีเดียว - เร็วกว่ามาก!
    ss.toast(`💾 กำลังบันทึก Trip Details ${allDetails.length} รายการ...`, "MLSTMS Trips", 10);
    saveTripDetailsToSheet(allDetails, true, true);

    const totalTime = Math.round((new Date() - startTime) / 1000);
    const minutes = Math.floor(totalTime / 60);
    const seconds = totalTime % 60;

    const summaryMessage =
      `✅ Phase 2 Complete!\n\n` +
      `📊 สรุปเสร็จ:\n` +
      `• ดึงข้อมูลสำเร็จ: ${successful} รายการ\n` +
      `• ล้มเหลว: ${failed} รายการ\n` +
      `• บันทึกลงชีท: ${allDetails.length} รายการ\n` +
      `⏱️ เวลาที่ใช้: ${minutes} นาที ${seconds} วินาที`;

    ui.alert("✅ Phase 2 Complete!", summaryMessage, ui.ButtonSet.OK);
    Logger.log(`✅ Phase 2 Complete: ${allDetails.length} details in ${minutes}m ${seconds}s`);
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
 * อ่าน Trip IDs จากชีท "Trips" (PRIMARY SOURCE)
 * @returns {Array<string>} - Array of Trip IDs
 * @note ฟังก์ชันนี้ไม่ได้ใช้ใน Phase 2 (ใช้เฉพาะ Phase 1 IDs)
 *        เก็บไว้สำหรับกรณีที่ต้องการอ่าน Trip IDs จากชีทโดยตรง
 */
function readTripIdsFromSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const config = getConfig();
  const tripsSheet = ss.getSheetByName(config.tripsSheetName);

  if (!tripsSheet || tripsSheet.getLastRow() <= 1) {
    return [];
  }

  try {
    const tripData = tripsSheet
      .getRange(2, 1, tripsSheet.getLastRow() - 1, 1)
      .getValues();
    return tripData.map((row) => String(row[0])).filter((id) => id);
  } catch (error) {
    Logger.log(`⚠️ Error reading Trip IDs from sheet: ${error.message}`);
    return [];
  }
}

/**
 * อ่าน Trip IDs จาก Phase 1 Storage (SECONDARY SOURCE)
 * @returns {Array<string>} - Array of Trip IDs
 */
function readTripIdsFromPhase1() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const tripIdsJson = scriptProperties.getProperty("TRIP_IDS_LIST");

  if (!tripIdsJson) {
    return [];
  }

  try {
    const tripIds = JSON.parse(tripIdsJson);
    return Array.isArray(tripIds) ? tripIds : [];
  } catch (error) {
    Logger.log(
      `⚠️ Error reading Trip IDs from Phase 1 storage: ${error.message}`,
    );
    return [];
  }
}

/**
 * ดึง Trip Details โดยตรง API
 */
function fetchTripDetailsFromAPI(tripId) {
  const config = getConfig();
  const token = getAccessToken();
  const url = `${config.baseUrl}/v1/trips/${tripId}`;

  const response = UrlFetchApp.fetch(url, {
    method: "get",
    headers: { Authorization: `Bearer ${token}` },
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() === 401) {
    getAccessToken();
    return fetchTripDetailsFromAPI(tripId);
  }

  if (response.getResponseCode() !== 200) {
    return null;
  }

  return JSON.parse(response.getContentText());
}

/**
 * เพิ่ม Trip ใหม่ลงในชีท
 */
function addTripToSheet(trip, statusId) {
  const config = getConfig();
  const sheet = prepareSheet(
    config.tripsSheetName,
    [
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
    ],
    false,
  );

  const tripStatus = trip.tripStatus || {};
  const row = [
    getTripField(trip, ["tripId", "id", "trip_code", "tripCode", "trip_id"]),
    getTripField(trip, ["tripName", "name", "trip_name"]),
    getTripField(trip, [
      "licenseNo",
      "plateNo",
      "license_no",
      "plate_no",
      "vehicleLicenseNo",
    ]),
    statusId ||
      tripStatus.statusId ||
      tripStatus.id ||
      getTripField(trip, ["tripStatus.statusId", "statusId", "status_id"]),
    tripStatus.statusName ||
      tripStatus.name ||
      getTripField(trip, [
        "tripStatus.statusName",
        "statusName",
        "status_name",
      ]),
    getTripField(trip, ["openDateTime", "tripOpenDateTime", "startDateTime"]),
    getTripField(trip, ["closeDateTime", "tripCloseDateTime", "endDateTime"]),
    getTripField(trip, ["distance", "totalDistance", "total_distance"]),
    getTripField(trip, ["createdAt", "created_at", "createdDate"]),
    getTripField(trip, ["updatedAt", "updated_at", "updatedDate"]),
  ];

  sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
}

/**
 * อัพเดท Trip ที่มีอยู่ในชีท
 */
function updateTripInSheet(trip, statusId) {
  const config = getConfig();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(config.tripsSheetName);
  if (!sheet) return;

  const tripId = getTripField(trip, [
    "tripId",
    "id",
    "trip_code",
    "tripCode",
    "trip_id",
  ]);
  if (!tripId) return;

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  // หา Trip ID ในชีท
  const data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]) === String(tripId)) {
      // พบแล้ว -> อัพเดท
      const tripStatus = trip.tripStatus || {};
      const row = [
        tripId,
        getTripField(trip, ["tripName", "name", "trip_name"]),
        getTripField(trip, [
          "licenseNo",
          "plateNo",
          "license_no",
          "plate_no",
          "vehicleLicenseNo",
        ]),
        statusId ||
          tripStatus.statusId ||
          tripStatus.id ||
          getTripField(trip, ["tripStatus.statusId", "statusId", "status_id"]),
        tripStatus.statusName ||
          tripStatus.name ||
          getTripField(trip, [
            "tripStatus.statusName",
            "statusName",
            "status_name",
          ]),
        getTripField(trip, [
          "openDateTime",
          "tripOpenDateTime",
          "startDateTime",
        ]),
        getTripField(trip, [
          "closeDateTime",
          "tripCloseDateTime",
          "endDateTime",
        ]),
        getTripField(trip, ["distance", "totalDistance", "total_distance"]),
        getTripField(trip, ["createdAt", "created_at", "createdDate"]),
        getTripField(trip, ["updatedAt", "updated_at", "updatedDate"]),
      ];
      sheet.getRange(i + 2, 1, 1, row.length).setValues([row]);
      return;
    }
  }
}

/**
 * บันทึก Trip Detail ลงชีท (ตรวจสอบซ้ำและอัพเดท)
 * Map JSON response to sheet headers according to actual API structure
 */
function saveTripDetailToSheet(detail) {
  const config = getConfig();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = prepareSheet(
    config.tripDetailsSheetName,
    [
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
    ].concat(generateWaypointHeaders(20)),
    false,
  );

  // Extract trip from API response: { "data": { trip details } }
  const trip = detail.data || detail.trip || detail;

  // Extract tripStatus nested object
  const tripStatus = trip.tripStatus || {};
  const waypoints = trip.waypoints || trip.waypointList || [];

  // Map trip data according to JSON structure
  const tripData = [
    // Trip ID - direct field from trip object
    trip.tripId ||
      trip.id ||
      trip.trip_code ||
      trip.tripCode ||
      trip.trip_id ||
      "",

    // Trip Name - direct field from trip object
    trip.tripName || trip.name || trip.trip_name || "",

    // License No - direct field from trip object
    trip.licenseNo ||
      trip.plateNo ||
      trip.license_no ||
      trip.plate_no ||
      trip.vehicleLicenseNo ||
      "",

    // Status ID - from nested tripStatus object
    tripStatus.statusId ||
      tripStatus.id ||
      trip.statusId ||
      trip.status_id ||
      trip.status ||
      "",

    // Status Name - from nested tripStatus object
    tripStatus.statusName ||
      tripStatus.name ||
      trip.statusName ||
      trip.status_name ||
      "",

    // Open DateTime - direct field from trip object
    trip.openDateTime || trip.tripOpenDateTime || trip.startDateTime || "",

    // Close DateTime - direct field from trip object
    trip.closeDateTime || trip.tripCloseDateTime || trip.endDateTime || "",

    // Distance - direct field from trip object
    trip.distance || trip.totalDistance || trip.total_distance || "",

    // Driver Name - may not exist in response
    trip.driverName || trip.driver_name || trip.driverFullName || "",

    // Driver Phone - may not exist in response
    trip.driverPhone || trip.driver_phone || trip.driverMobile || "",

    // Vehicle Type - may not exist in response
    trip.vehicleType || trip.vehicle_type || trip.vehicleModel || "",

    // Created At - direct field from trip object
    trip.createdAt || trip.created_at || trip.createdDate || "",

    // Updated At - direct field from trip object
    trip.updatedAt || trip.updated_at || trip.updatedDate || "",
  ];

  // Map 20 waypoints with proper JSON fields
  // Column order: Sequence, Reference ID, Name, Address, Latitude, Longitude, Arrival DateTime, Departure DateTime, Status
  const waypointData = [];
  for (let i = 0; i < 20; i++) {
    if (i < waypoints.length) {
      const wp = waypoints[i];
      waypointData.push(
        // WP1 Sequence
        getValueOrDash(wp.sequence),

        // WP1 Reference ID
        getValueOrDash(wp.reference || wp.waypointReferenceId),

        // WP1 Name
        getValueOrDash(wp.waypointName),

        // WP1 Address (try to get from API if available)
        getValueOrDash(wp.address),

        // WP1 Latitude (try to get from API if available)
        getValueOrDash(wp.latitude),

        // WP1 Longitude (try to get from API if available)
        getValueOrDash(wp.longitude),

        // WP1 Arrival DateTime
        getValueOrDash(wp.actualArrivalDateTime || wp.arrivalDateTime),

        // WP1 Departure DateTime
        getValueOrDash(wp.actualDepartureDateTime || wp.departureDateTime),

        // WP1 Status (try to get from API if available)
        getValueOrDash(wp.status || wp.waypointStatus)
      );
    } else {
      waypointData.push("--", "--", "--", "--", "--", "--", "--", "--", "--");
    }
  }

  const row = tripData.concat(waypointData);
  const tripId = row[0];

  // ✅ Normalize Trip ID: trim whitespace และ convert to string
  if (!tripId) {
    // ไม่มี Trip ID - เพิ่มใหม่ที่แถวสุดท้าย
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
    return;
  }

  const normalizedTripId = String(tripId).trim();

  // ✅ ตรวจสอบ Trip ID ซ้ำโดยใช้ Map (เร็วกว่า linear search)
  const lastRow = sheet.getLastRow();
  const existingTripIdsMap = new Map(); // Trip ID -> Row Index

  if (lastRow > 1) {
    const existingData = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < existingData.length; i++) {
      if (existingData[i][0]) {
        existingTripIdsMap.set(String(existingData[i][0]).trim(), i + 2);
      }
    }
  }

  // เช็คว่า Trip ID มีอยู่แล้วหรือไม่
  if (existingTripIdsMap.has(normalizedTripId)) {
    // ✅ พบ Trip ID ซ้ำ -> อัพเดท
    const rowIndex = existingTripIdsMap.get(normalizedTripId);
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    Logger.log(`✅ Updated trip detail: ${normalizedTripId} (row ${rowIndex})`);
    return;
  }

  // ✅ ไม่พบ Trip ID ซ้ำ -> เพิ่มใหม่
  const currentLastRow = sheet.getLastRow();
  sheet.getRange(currentLastRow + 1, 1, 1, row.length).setValues([row]);
  Logger.log(`✅ Added new trip detail: ${normalizedTripId} (row ${currentLastRow + 1})`);
}

function generateWaypointHeaders(count) {
  const headers = [];
  for (let i = 1; i <= count; i++) {
    headers.push(
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
  return headers;
}

// ============================================
// MENU & DIALOGS (Updated for 2-Phase)
// ============================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const hasCreds = hasSavedCredentials();
  const menu = ui.createMenu("🚚 MLSTMS Trips");

  if (!hasCreds) {
    menu.addItem("🔐 Login & Pull Data", "showLoginDialog").addToUi();
    return;
  }

  menu
    .addSubMenu(
      ui
        .createMenu("🚀 Auto Run (แนะนำ)")
        .addItem("🚀 Auto Pull Today", "pullTodayAutoRun")
        .addSeparator()
        .addItem("📅 Auto Pull 2 Days Ago", "pull2DaysAgoAutoRun")
        .addItem("📅 Auto Pull 3 Days Ago", "pull3DaysAgoAutoRun")
        .addSeparator()
        .addItem("📅 Auto Run: เลือกช่วงวันที่", "showAutoRunDialog")
        .addSeparator()
        .addItem("📋 Phase 1: Pull Trip IDs (ดึง IDs)", "showPhase1Dialog")
        .addItem(
          "📋 Phase 2: Pull Trip Details (ดึงรายละเอียด)",
          "pullTripDetailsPhase2",
        ),
    )
    .addSeparator()
    .addSubMenu(
      ui
        .createMenu("⏰ Auto Run Trigger (ตั้งเวลาอัตโนมัติ)")
        .addItem("⏰ Setup Auto Run Trigger", "setupAutoRunTriggerWithUI")
        .addItem("👁️ View Trigger Status", "viewTriggerStatus")
        .addItem("📋 View Execution Log", "viewLatestExecutionLog")
        .addItem("🗑️ Delete Trigger", "deleteAutoRunTrigger"),
    )
    .addSeparator()
    .addItem("📅 Pull Today's Data (Phase 1 เท่านั้น)", "pullTodayData")
    .addItem("🔄 Pull Fresh Start (เริ่มใหม่)", "showPullModeFreshDialog")
    .addItem("➕ Pull Append (เพิ่ม)", "showPullModeAppendDialog")
    .addSeparator()
    .addSubMenu(
      ui
        .createMenu("🔧 Diagnostics (วินิจฉัย)")
        .addItem("🏥 Service Health Check", "serviceHealthCheck")
        .addItem("🔍 Test API Connection", "testConnection"),
    )
    .addSeparator()
    .addSubMenu(
      ui
        .createMenu("⚡ Performance (ปรับสมรรถนะ)")
        .addItem("🚀 Optimize for Phase 2 (60 req/min)", "optimizeForPhase2")
        .addItem("⚙️ Set Performance Mode", "setPerformanceMode")
        .addItem("⚡ Toggle Fast Mode", "toggleFastMode"),
    )
    .addSeparator()
    .addItem("👁️ View Config", "viewConfig")
    .addItem("🔄 Reset All State", "resetAllState")
    .addToUi();
}

function showPhase1Dialog() {
  const ui = SpreadsheetApp.getUi();
  const scriptProperties = PropertiesService.getScriptProperties();
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
    <head><base target="_top">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; background-color: #f5f5f5; }
      .container { max-width: 450px; margin: 0 auto; background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
      h2 { color: #4285F4; margin-top: 0; margin-bottom: 5px; text-align: center; }
      .subtitle { text-align: center; color: #666; font-size: 13px; margin-bottom: 20px; }
      .form-group { margin-bottom: 15px; }
      label { display: block; font-weight: 500; margin-bottom: 5px; color: #333; font-size: 13px; }
      input[type="date"], select { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box; }
      button { width: 100%; padding: 12px; border: none; border-radius: 4px; background: #4285F4; color: white; font-weight: 500; cursor: pointer; }
      .btn-group { display: flex; gap: 10px; margin-top: 20px; }
      .btn-secondary { background: #f1f3f4; color: #333; }
    </style>
    </head>
    <body>
      <div class="container">
        <h2>📋 Phase 1: Pull Trip IDs</h2>
        <div class="subtitle">ดึง Trip IDs ตามช่วงวันที่และ Status</div>
        <form onsubmit="handleSubmit(event)">
          <div class="form-group">
            <label>📅 วันที่เริ่ม</label>
            <input type="date" id="startDate" value="${savedStartDate}" required>
          </div>
          <div class="form-group">
            <label>📅 วันที่สิ้นสุด</label>
            <input type="date" id="endDate" value="${savedEndDate}" required>
          </div>
          <div class="form-group">
            <label>🔢 Status ID</label>
            <select id="statusId">
              <option value="ALL">ทุก Status (1-5)</option>
              <option value="1">1 - Open</option>
              <option value="2">2 - In Progress</option>
              <option value="3">3 - Completed</option>
              <option value="4">4 - Cancelled</option>
              <option value="5">5 - Other</option>
            </select>
          </div>
          <div class="btn-group">
            <button type="button" class="btn-secondary" onclick="google.script.host.close()">ปิด</button>
            <button type="submit">📋 เริ่มดึงข้อมูล</button>
          </div>
        </form>
      </div>
      <script>
        function handleSubmit(event) {
          event.preventDefault();
          const startDate = document.getElementById('startDate').value;
          const endDate = document.getElementById('endDate').value;
          const statusId = document.getElementById('statusId').value;
          google.script.run.withSuccessHandler(function(count) {
            alert('✅ Phase 1 Complete!\\n\\nดึง Trip IDs สำเร็จ: ' + count + ' รายการ');
            google.script.host.close();
          }).pullTripIdsPhase1(startDate, endDate, statusId);
        }
      </script>
    </body>
    </html>
  `,
  )
    .setWidth(480)
    .setHeight(550)
    .setTitle("Phase 1: Pull Trip IDs");

  ui.showModalDialog(html, "Phase 1: Pull Trip IDs");
}

// ============================================
// ADDITIONAL FUNCTIONS (保持兼容性)
// ============================================

function pullTodayData() {
  const today = new Date();
  const todayStr = Utilities.formatDate(
    today,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd",
  );
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty("START_DATE", todayStr);
  scriptProperties.setProperty("END_DATE", todayStr);
  scriptProperties.setProperty("STATUS_ID", "");
  return pullTripIdsPhase1(todayStr, todayStr, "");
}

function fastPullAll() {
  // Simplified - just use APPEND mode with fast settings
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty("FAST_MODE", "true");
  scriptProperties.setProperty("RATE_LIMIT_MS", "0");
  return pullTripsUnified({ mode: "APPEND", showAlert: true });
}

function showQuickPullDialog() {
  // Reuse Pull Mode Dialog with default values
  showPullModeAppendDialog();
}

function setPerformanceMode() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    "⚡ Set Performance Mode",
    "Choose performance mode:\n\n• SAFE - 40 req/min (Very Safe - Avoid Bandwidth Quota)\n• BALANCED - 60 req/min (Recommended)\n• MODERATE - 80 req/min (Moderate Speed)\n• TURBO - 100 req/min (Max Speed - Risk of Bandwidth Quota)\n\nEnter mode (SAFE/BALANCED/MODERATE/TURBO):",
    ui.ButtonSet.OK_CANCEL,
  );

  if (response.getSelectedButton() === ui.Button.OK) {
    const mode = response.getResponseText().toUpperCase().trim();
    const props = PropertiesService.getScriptProperties();

    if (mode === "SAFE") {
      // 40 req/min - Very safe (1500ms per request)
      props.setProperty("RATE_LIMIT_MS", "1500");
      props.setProperty("FAST_MODE", "false");
      props.setProperty("PERFORMANCE_MODE", "SAFE");
    } else if (mode === "BALANCED") {
      // 60 req/min - Balanced (1000ms per request)
      props.setProperty("RATE_LIMIT_MS", "1000");
      props.setProperty("FAST_MODE", "false");
      props.setProperty("PERFORMANCE_MODE", "BALANCED");
    } else if (mode === "MODERATE") {
      // 80 req/min - Moderate (750ms per request)
      props.setProperty("RATE_LIMIT_MS", "750");
      props.setProperty("FAST_MODE", "false");
      props.setProperty("PERFORMANCE_MODE", "MODERATE");
    } else if (mode === "TURBO") {
      // 100 req/min - Maximum speed (600ms per request)
      props.setProperty("RATE_LIMIT_MS", "600");
      props.setProperty("FAST_MODE", "false");
      props.setProperty("PERFORMANCE_MODE", "TURBO");
    } else {
      ui.alert(
        "Invalid Input",
        "Please enter: SAFE, BALANCED, MODERATE, or TURBO",
        ui.ButtonSet.OK,
      );
      return;
    }

    const reqPerMin =
      mode === "SAFE"
        ? 40
        : mode === "BALANCED"
          ? 60
          : mode === "MODERATE"
            ? 80
            : 100;
    SpreadsheetApp.getActiveSpreadsheet().toast(
      `Mode: ${mode} (~${reqPerMin} req/min)`,
      "MLSTMS Trips",
      5,
    );
  }
}

function toggleFastMode() {
  const props = PropertiesService.getScriptProperties();
  const currentMode = props.getProperty("FAST_MODE") === "true";
  const newMode = !currentMode;
  props.setProperty("FAST_MODE", newMode ? "true" : "false");
  SpreadsheetApp.getActiveSpreadsheet().toast(
    `Fast Mode ${newMode ? "ENABLED" : "DISABLED"}`,
    "MLSTMS Trips",
    5,
  );
}

/**
 * Optimize for Phase 2 (Trip Details)
 * ตั้งค่าให้เหมาะสมที่สุดสำหรับการดึง Trip Details จำนวนมาก
 * Rate: ~60 req/min (Balanced - ปลอดภัยจาก bandwidth quota)
 */
function optimizeForPhase2() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty("RATE_LIMIT_MS", "1000");
  props.setProperty("FAST_MODE", "false");
  props.setProperty("ADAPTIVE_RATE_LIMIT", "true");
  props.setProperty("PERFORMANCE_MODE", "BALANCED");
  SpreadsheetApp.getActiveSpreadsheet().toast(
    "✅ Optimized for Phase 2 (60 req/min - Safe Mode)",
    "MLSTMS Trips",
    5,
  );
}

function testConnection() {
  try {
    const token = login();
    SpreadsheetApp.getUi().alert(
      "✅ Connection Successful",
      "Successfully connected to PTG eZView API!",
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
    return true;
  } catch (error) {
    SpreadsheetApp.getUi().alert(
      "❌ Connection Failed",
      `Failed to connect: ${error.message}`,
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
    return false;
  }
}

/**
 * Comprehensive Service Health Check
 * Tests API connectivity and provides detailed diagnostic information
 */
function serviceHealthCheck() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const config = getConfig();
  const ui = SpreadsheetApp.getUi();

  const results = {
    baseUrl: config.baseUrl,
    timestamp: new Date().toISOString(),
    tests: [],
  };

  // Test 1: Base URL Reachability
  ss.toast("🔍 Testing base URL...", "MLSTMS Health Check", 5);
  try {
    const response = UrlFetchApp.fetch(config.baseUrl, {
      method: "get",
      muteHttpExceptions: true,
      followRedirects: false,
    });

    const code = response.getResponseCode();
    const content = response.getContentText();

    results.tests.push({
      name: "Base URL Reachability",
      status: code < 500 ? "✅ PASS" : "❌ FAIL",
      httpCode: code,
      details: code === 200 ? "Base URL is accessible" : `HTTP ${code}`,
      responseSample: content.substring(0, 200),
    });
  } catch (error) {
    results.tests.push({
      name: "Base URL Reachability",
      status: "❌ FAIL",
      error: error.message,
      details: "Cannot reach base URL - possible network issue",
    });
  }

  // Test 2: Login Endpoint
  ss.toast("🔍 Testing login endpoint...", "MLSTMS Health Check", 5);
  try {
    const response = UrlFetchApp.fetch(`${config.baseUrl}/v1/login`, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        username: config.username,
        password: config.password,
        deviceInfo: {
          deviceId: "health-check",
          deviceName: "Health Check",
          deviceType: "web",
          os: "Google Apps Script",
        },
      }),
      muteHttpExceptions: true,
    });

    const code = response.getResponseCode();
    const content = response.getContentText();

    if (code === 200) {
      results.tests.push({
        name: "Login Endpoint",
        status: "✅ PASS",
        httpCode: code,
        details: "Login successful - credentials are valid",
      });
    } else if (code === 503) {
      results.tests.push({
        name: "Login Endpoint",
        status: "❌ FAIL",
        httpCode: code,
        details: "Service Unavailable - API server is down or overloaded",
        recommendation: "Contact PTG support or wait for service restoration",
      });
    } else if (code === 401) {
      results.tests.push({
        name: "Login Endpoint",
        status: "❌ FAIL",
        httpCode: code,
        details: "Unauthorized - check username/password",
        recommendation: "Verify credentials in configuration",
      });
    } else {
      results.tests.push({
        name: "Login Endpoint",
        status: "⚠️ WARNING",
        httpCode: code,
        details: `Unexpected response code`,
        responseSample: content.substring(0, 300),
      });
    }
  } catch (error) {
    results.tests.push({
      name: "Login Endpoint",
      status: "❌ FAIL",
      error: error.message,
      details: "Network error reaching login endpoint",
    });
  }

  // Test 3: Trips Endpoint (if login succeeded)
  if (
    results.tests.some(
      (t) => t.name === "Login Endpoint" && t.status.includes("PASS"),
    )
  ) {
    ss.toast("🔍 Testing trips endpoint...", "MLSTMS Health Check", 5);
    try {
      const token =
        PropertiesService.getScriptProperties().getProperty("ACCESS_TOKEN");
      const response = UrlFetchApp.fetch(
        `${config.baseUrl}/v1/trips?statusId=1&limit=1`,
        {
          method: "get",
          headers: { Authorization: `Bearer ${token}` },
          muteHttpExceptions: true,
        },
      );

      const code = response.getResponseCode();
      results.tests.push({
        name: "Trips Endpoint",
        status: code === 200 ? "✅ PASS" : "⚠️ WARNING",
        httpCode: code,
        details: code === 200 ? "Can fetch trips successfully" : `HTTP ${code}`,
      });
    } catch (error) {
      results.tests.push({
        name: "Trips Endpoint",
        status: "❌ FAIL",
        error: error.message,
      });
    }
  }

  // Generate Report
  let report = "🏥 PTG eZView Service Health Check\n\n";
  report += `📅 Timestamp: ${results.timestamp}\n`;
  report += `🌐 Base URL: ${results.baseUrl}\n\n`;
  report += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

  for (const test of results.tests) {
    report += `${test.status} ${test.name}\n`;
    if (test.httpCode) report += `   HTTP Code: ${test.httpCode}\n`;
    if (test.details) report += `   Details: ${test.details}\n`;
    if (test.recommendation)
      report += `   💡 Recommendation: ${test.recommendation}\n`;
    if (test.error) report += `   Error: ${test.error}\n`;
    report += "\n";
  }

  // Overall Status
  const allPassed = results.tests.every((t) => t.status.includes("PASS"));
  const hasFailures = results.tests.some((t) => t.status.includes("FAIL"));

  if (allPassed) {
    report += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    report += "✅ Overall Status: HEALTHY\n";
    report += "All services are operational. You can proceed with data pulls.";
  } else if (hasFailures) {
    report += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    report += "❌ Overall Status: UNHEALTHY\n";
    report +=
      "Service issues detected. Please review the recommendations above.";
  } else {
    report += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    report += "⚠️ Overall Status: DEGRADED\n";
    report += "Some services are experiencing issues.";
  }

  // Log results
  Logger.log("=== Service Health Check Results ===");
  Logger.log(JSON.stringify(results, null, 2));

  // Show report
  try {
    ui.alert("🏥 Service Health Check Report", report, ui.ButtonSet.OK);
  } catch (e) {
    Logger.log("Could not show alert in trigger context");
  }

  return results;
}

function estimateTripCountWithUI() {
  // Show current settings and rate limit info
  const config = getConfig();
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();

  // Calculate requests per minute
  const reqPerMin = config.fastMode
    ? "∞ (No Limit)"
    : Math.round(60000 / config.rateLimitMs);

  let message = "📊 Current Settings\n\n";
  message += `📡 Base URL: ${config.baseUrl}\n`;
  message += `⚡ Performance Mode: ${props.getProperty("PERFORMANCE_MODE") || "BALANCED"}\n`;
  message += `🔁 Rate Limit: ${config.fastMode ? "Fast Mode" : config.rateLimitMs + "ms/request"}\n`;
  message += `📊 Max Speed: ~${reqPerMin} requests/minute\n`;
  message += `📋 Status ID: ${config.statusId || "All"}\n`;
  message += `📅 Date Range: ${config.startDate || "All"} to ${config.endDate || "All"}\n\n`;
  message += `💡 API Limit: 100 requests/minute\n`;
  message += `💡 Recommended: Use "Optimize for Phase 2" for best performance`;

  ui.alert("📊 Current Settings", message, ui.ButtonSet.OK);
}

function viewConfig() {
  const config = getConfig();
  const ui = SpreadsheetApp.getUi();
  let message = "⚙️ Current Configuration:\n\n";
  message += `📡 API: ${config.baseUrl}\n`;
  message += `🔐 Username: ${config.username}\n`;
  message += `🔑 Password: ${config.password ? "*** Set ***" : "Not set"}\n`;
  message += `📋 Status ID: ${config.statusId || "All"}\n`;
  message += `📅 Date: ${config.startDate || "All"} to ${config.endDate || "All"}\n`;
  message += `📊 Limit: ${config.limit}\n`;
  message += `⚡ Fast Mode: ${config.fastMode ? "ON" : "OFF"}\n`;
  ui.alert("Configuration", message, ui.ButtonSet.OK);
}

function resetAllState() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    "🔄 Reset All State",
    "This will clear all credentials and state. Continue?",
    ui.ButtonSet.YES_NO,
  );

  if (response === ui.Button.YES) {
    const props = PropertiesService.getScriptProperties();
    props.deleteProperty("USERNAME");
    props.deleteProperty("PASSWORD");
    props.deleteProperty("ACCESS_TOKEN");
    props.deleteProperty("REFRESH_TOKEN");
    props.deleteProperty("TOKEN_EXPIRES_AT");
    SpreadsheetApp.getActiveSpreadsheet().toast(
      "✅ Reset complete!",
      "MLSTMS Trips",
      5,
    );
  }
}

function showSmartAdvisorDialog() {
  const ui = SpreadsheetApp.getUi();
  const html = HtmlService.createHtmlOutput(
    `
    <!DOCTYPE html>
    <html>
    <head><base target="_top">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; background-color: #f5f5f5; }
      .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
      h2 { color: #4285F4; margin-top: 0; margin-bottom: 10px; text-align: center; }
      .option { padding: 15px; margin: 10px 0; background: #f8f9fa; border-left: 4px solid #4285F4; border-radius: 4px; cursor: pointer; }
      .option:hover { background: #e8f0fe; }
      .option-title { font-weight: bold; color: #1967d2; }
      .option-desc { font-size: 12px; color: #666; margin-top: 5px; }
    </style>
    </head>
    <body>
      <div class="container">
        <h2>💡 Smart Advisor</h2>
        <div class="option" onclick="selectOption('today')">
          <div class="option-title">📅 Pull Today's Data</div>
          <div class="option-desc">ดึง trips ทั้งหมดของวันนี้ (00:00 - 23:59)</div>
        </div>
        <div class="option" onclick="selectOption('fresh')">
          <div class="option-title">🔄 Fresh Start</div>
          <div class="option-desc">ล้างข้อมูลเก่าแล้วดึงใหม่ทั้งหมด</div>
        </div>
        <div class="option" onclick="selectOption('append')">
          <div class="option-title">➕ Append Mode</div>
          <div class="option-desc">เพิ่มข้อมูลใหม่เข้าไปในข้อมูลเดิม</div>
        </div>
      </div>
      <script>
        function selectOption(option) {
          google.script.run.withSuccessHandler(function() { google.script.host.close(); })
          .executeSmartAdvisor(option);
        }
      </script>
    </body>
    </html>
  `,
  )
    .setWidth(520)
    .setHeight(400);
  ui.showModalDialog(html, "Smart Advisor");
}

function executeSmartAdvisor(option) {
  switch (option) {
    case "today":
      return pullTodayData();
    case "fresh":
      showPullModeFreshDialog();
      break;
    case "append":
      showPullModeAppendDialog();
      break;
  }
}

// Keep original login dialog (simplified)
function showLoginDialog() {
  // ... (keep existing login dialog code or simplify it)
  const scriptProperties = PropertiesService.getScriptProperties();
  const savedUsername = scriptProperties.getProperty("USERNAME") || "";
  const savedPassword = scriptProperties.getProperty("PASSWORD") || "";
  const hasSavedCreds = savedUsername && savedPassword;

  const html = HtmlService.createHtmlOutput(
    `
    <!DOCTYPE html>
    <html>
    <head><base target="_top">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; background-color: #f5f5f5; }
      .container { max-width: 400px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
      h2 { color: #4285F4; margin-top: 0; text-align: center; }
      .form-group { margin-bottom: 15px; }
      label { display: block; margin-bottom: 5px; font-weight: 500; }
      input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
      button { width: 100%; padding: 12px; border: none; border-radius: 4px; background: #4285F4; color: white; font-weight: 500; cursor: pointer; }
    </style>
    </head>
    <body>
      <div class="container">
        <h2>🔐 Login to PTG eZView</h2>
        ${hasSavedCreds ? '<div style="background: #e8f5e9; padding: 10px; margin-bottom: 15px; border-radius: 4px; text-align: center; color: #2e7d32;">💾 Saved credentials found</div>' : ""}
        <form onsubmit="handleSubmit(event)">
          <div class="form-group">
            <label>Username:</label>
            <input type="text" id="username" value="${savedUsername}" required placeholder="LPG_Bulk">
          </div>
          <div class="form-group">
            <label>Password:</label>
            <input type="password" id="password" value="${savedPassword}" required>
          </div>
          <button type="submit">Login</button>
        </form>
      </div>
      <script>
        function handleSubmit(event) {
          event.preventDefault();
          google.script.run.withSuccessHandler(function(result) {
            if (result.success) { alert('✅ Login successful!'); google.script.host.close(); }
            else { alert('❌ Login failed'); }
          }).loginAndPull({ username: document.getElementById('username').value, password: document.getElementById('password').value });
        }
      </script>
    </body>
    </html>
  `,
  )
    .setWidth(420)
    .setHeight(450)
    .setTitle("Login");
  SpreadsheetApp.getUi().showModalDialog(html, "Login");
}

function loginAndPull(formData) {
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty("USERNAME", formData.username);
  scriptProperties.setProperty("PASSWORD", formData.password);
  try {
    login();
    return { success: true, message: "Login successful!" };
  } catch (error) {
    return { success: false, message: "Login failed: " + error.message };
  }
}

// ============================================
// 2-PHASE AUTO RUN (Combined)
// ============================================

/**
 * ฟังก์ชันรัน Phase 1 + Phase 2 อัตโนมัติ
 * - รัน Phase 1 (ดึง Trip IDs)
 * - ดีเลย์ 10 วินาที
 * - รัน Phase 2 (ดึง Trip Details)
 * - เรียงลำดับข้อมูลทั้ง 2 ชีท (Trip ID desc, Updated At desc)
 * - สรุปผลรวม
 *
 * @param {string} startDate - วันที่เริ่ม (YYYY-MM-DD)
 * @param {string} endDate - วันที่สิ้นสุด (YYYY-MM-DD)
 * @param {string} statusId - Status ID (ว่าง = ทั้งหมด)
 * @returns {Object} - สรุปผลการรันทั้งหมด
 */
function pullTripsAutoRun(startDate, endDate, statusId = "ALL") {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const scriptProperties = PropertiesService.getScriptProperties();
  const config = getConfig();

  // ตั้งค่าเริ่มต้น
  const today = new Date();
  const todayStr = Utilities.formatDate(
    today,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd",
  );
  startDate =
    startDate || scriptProperties.getProperty("START_DATE") || todayStr;
  endDate = endDate || scriptProperties.getProperty("END_DATE") || todayStr;

  const statusText =
    statusId === "ALL" ? "ทุก Status (1-5)" : `Status ${statusId}`;
  const dateText = `วันที่ ${startDate} ถึง ${endDate}`;

  const overallStartTime = new Date();
  let phase1Result = { success: false, tripCount: 0, message: "" };
  let phase2Result = { success: false, successful: 0, failed: 0, message: "" };

  try {
    // ============================================
    // PHASE 1: Pull Trip IDs
    // ============================================
    ss.toast("🚀 Starting Auto Run: Phase 1...", "MLSTMS Trips", 10);
    Logger.log(`🚀 Auto Run Started - Phase 1: ${statusText}, ${dateText}`);

    const phase1StartTime = new Date();

    try {
      // Login
      const token = login();
      if (!token) throw new Error("Login failed");

      const STATUS_IDS =
        statusId === "ALL" ? CONFIG.STATUS_IDS : [parseInt(statusId)];

      // เตรียมชีท Phase 1
      const sheet = prepareSheet(
        config.tripsSheetName,
        [
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
        ],
        false,
      );

      // ✅ ใช้ array รวมทุก status เพื่อบันทึกทีเดียวด้วย saveTripsToSheet()
      let allTripsForAllStatuses = [];
      let totalFetched = 0;

      for (let i = 0; i < STATUS_IDS.length; i++) {
        const currentStatusId = STATUS_IDS[i];
        showProgressToast("📋 Phase 1: ดึง Trip IDs", i + 1, STATUS_IDS.length);

        const trips = fetchTripsFromAPI(currentStatusId, startDate, endDate);

        if (trips.length === 0) {
          ss.toast(
            `⏭️ Status ${currentStatusId}: ไม่มีข้อมูล`,
            "MLSTMS Trips",
            3,
          );
          Logger.log(`   ⏭️ Status ${currentStatusId}: No data - skipping`);
          continue;
        }

        ss.toast(
          `✅ Status ${currentStatusId}: พบ ${trips.length} รายการ`,
          "MLSTMS Trips",
          5,
        );
        Logger.log(
          `   ✅ Status ${currentStatusId}: ${trips.length} trips found`,
        );

        // ✅ เพิ่ม trips ทั้งหมดใน status นี้ลงใน array รวม
        const tripsForCurrentStatus = trips.map(trip => ({ ...trip, _tempStatusId: currentStatusId }));
        allTripsForAllStatuses = allTripsForAllStatuses.concat(tripsForCurrentStatus);
        totalFetched += trips.length;

        Logger.log(`   📊 Status ${currentStatusId}: ${trips.length} fetched`);
        Utilities.sleep(2000);
      }

      // ✅ เรียก saveTripsToSheet() ครั้งเดียวหลังจากดึงครบทุก status
      ss.toast(`💾 กำลังบันทึก Trips ทั้งหมด ${allTripsForAllStatuses.length} รายการ...`, "MLSTMS Trips", 10);
      saveTripsToSheet(allTripsForAllStatuses, true, true);

      // ✅ เก็บ Trip IDs สำหรับ Phase 2
      const allTripIdsSet = new Set();
      for (const trip of allTripsForAllStatuses) {
        const tripId = getTripField(trip, ["id", "tripId", "trip_code", "tripCode", "trip_id"]);
        if (tripId) allTripIdsSet.add(String(tripId));
      }
      const tripIdArray = Array.from(allTripIdsSet);
      scriptProperties.setProperty(
        "TRIP_IDS_LIST",
        JSON.stringify(tripIdArray),
      );
      scriptProperties.setProperty(
        "TOTAL_TRIP_IDS",
        allTripIdsSet.size.toString(),
      );

      const phase1Time = Math.round((new Date() - phase1StartTime) / 1000);

      phase1Result = {
        success: true,
        tripCount: allTripIdsSet.size,
        totalFetched,
        time: phase1Time,
        message: `✅ Phase 1 Complete!\n\n• ดึงข้อมูล: ${totalFetched} รายการ\n• รวมทั้งหมด: ${allTripIdsSet.size} Trip IDs\n• เวลา: ${phase1Time} วินาที`,
      };

      ss.toast(
        `✅ Phase 1 Complete: ${allTripIdsSet.size} Trip IDs`,
        "MLSTMS Trips",
        10,
      );
      Logger.log(
        `✅ Phase 1 Complete: ${allTripIdsSet.size} Trip IDs in ${phase1Time}s`,
      );
      Logger.log(
        `   📊 Summary: ${totalFetched} fetched from API`,
      );
    } catch (error) {
      phase1Result = {
        success: false,
        tripCount: 0,
        message: `❌ Phase 1 Failed: ${error.message}`,
      };
      throw error;
    }

    // ============================================
    // DELAY: 10 วินาที
    // ============================================
    ss.toast("⏳ Waiting 10 seconds before Phase 2...", "MLSTMS Trips", 10);
    Logger.log(`⏳ Delaying 10 seconds before Phase 2...`);

    for (let i = 10; i > 0; i--) {
      if (i % 5 === 0 || i <= 5) {
        ss.toast(`⏳ Starting Phase 2 in ${i} seconds...`, "MLSTMS Trips", 5);
      }
      Utilities.sleep(1000);
    }

    // ============================================
    // PHASE 2: Pull Trip Details
    // ============================================
    ss.toast("🚀 Starting Phase 2: Pull Trip Details...", "MLSTMS Trips", 10);
    Logger.log(`🚀 Phase 2 Started: ${phase1Result.tripCount} Trip IDs`);

    const phase2StartTime = new Date();

    try {
      // อ่าน Trip IDs จาก Phase 1
      const tripIds = readTripIdsFromPhase1();

      if (tripIds.length === 0) {
        throw new Error("ไม่พบ Trip IDs จาก Phase 1");
      }

      // Login ใหม่ (ถ้า token หมดอายุ)
      const token = login();
      if (!token) throw new Error("Login failed");

      // ✅ รวบ Trip Details ทั้งหมดก่อน (batch collect)
      const allDetails = [];
      let successful = 0;
      let failed = 0;

      ss.toast(`📋 Phase 2:กำลังดึง Trip Details ${tripIds.length} รายการ...`, "MLSTMS Trips", 10);
      Logger.log(`📋 Phase 2: Starting to fetch ${tripIds.length} trip details...`);

      for (let i = 0; i < tripIds.length; i++) {
        const tripId = tripIds[i];
        const progress = Math.round(((i + 1) / tripIds.length) * 100);

        // Progress update ทุก 10% หรือทุก 50 รายการ
        if ((i + 1) % 50 === 0 || (i + 1) % Math.floor(tripIds.length / 10) === 0 || i === tripIds.length - 1) {
          ss.toast(
            `📋 กำลังดึง Details: ${i + 1}/${tripIds.length} (${progress}%)`,
            "MLSTMS Trips",
            5,
          );
          Logger.log(`   📊 Progress: ${i + 1}/${tripIds.length} (${progress}%) - fetched: ${successful}, failed: ${failed}`);
        }

        const detail = fetchTripDetailsFromAPI(tripId);

        if (detail) {
          allDetails.push(detail);  // ✅ เก็บไว้ใน array ก่อน
          successful++;
        } else {
          failed++;
        }

        if (!config.fastMode && config.rateLimitMs > 0) {
          Utilities.sleep(config.rateLimitMs);
        }
      }

      Logger.log(`   ✅ Fetched ${allDetails.length} trip details (successful: ${successful}, failed: ${failed})`);

      // ✅ Batch write ทีเดียว - เร็วกว่ามาก!
      ss.toast(`💾 กำลังบันทึก Trip Details ${allDetails.length} รายการ...`, "MLSTMS Trips", 10);
      saveTripDetailsToSheet(allDetails, true, true);

      const phase2Time = Math.round((new Date() - phase2StartTime) / 1000);

      phase2Result = {
        success: true,
        successful,
        failed,
        time: phase2Time,
        message: `✅ Phase 2 Complete!\n\n• สำเร็จ: ${successful} รายการ\n• ล้มเหลว: ${failed} รายการ\n• เวลา: ${phase2Time} วินาที`,
      };

      ss.toast(
        `✅ Phase 2 Complete: ${successful}/${tripIds.length}`,
        "MLSTMS Trips",
        10,
      );
      Logger.log(
        `✅ Phase 2 Complete: ${successful}/${tripIds.length} in ${phase2Time}s`,
      );
      Logger.log(`   📊 Summary: ${successful} successful, ${failed} failed`);
    } catch (error) {
      phase2Result = {
        success: false,
        successful: 0,
        failed: 0,
        message: `❌ Phase 2 Failed: ${error.message}`,
      };
      throw error;
    }

    // ============================================
    // SORTING: เรียงลำดับข้อมูลทั้ง 2 ชีท
    // ============================================
    ss.toast("🔄 เรียงลำดับข้อมูลทั้ง 2 ชีท...", "MLSTMS Trips", 10);
    Logger.log(`🔄 Sorting sheets: Trip ID (desc), Updated At (desc)...`);

    try {
      sortSheetsByTripIdAndUpdatedAt();
      ss.toast("✅ เรียงลำดับข้อมูลเสร็จสิ้น", "MLSTMS Trips", 5);
      Logger.log(`✅ Sorting completed successfully`);
    } catch (error) {
      ss.toast("⚠️ การเรียงลำดับข้อมูลล้มเหลว", "MLSTMS Trips", 5);
      Logger.log(`⚠️ Sorting failed: ${error.message}`);
    }

    // ============================================
    // SUMMARY: สรุปผลรวม
    // ============================================
    const overallTime = Math.round((new Date() - overallStartTime) / 1000);
    const minutes = Math.floor(overallTime / 60);
    const seconds = overallTime % 60;

    const summaryMessage =
      `🎉 Auto Run Complete!\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📊 PHASE 1: Pull Trip IDs\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${phase1Result.success ? "✅ สำเร็จ" : "❌ ล้มเหลว"}\n` +
      `• ดึงข้อมูล: ${phase1Result.totalFetched || 0} รายการ\n` +
      `• เพิ่มใหม่: ${phase1Result.totalAdded || 0} รายการ\n` +
      `• อัพเดท: ${phase1Result.totalUpdated || 0} รายการ\n` +
      `• รวมทั้งหมด: ${phase1Result.tripCount} Trip IDs\n` +
      `• เวลา: ${phase1Result.time || 0} วินาที\n\n` +
      `⏳ DELAY: 10 วินาที\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📊 PHASE 2: Pull Trip Details\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${phase2Result.success ? "✅ สำเร็จ" : "❌ ล้มเหลว"}\n` +
      `• สำเร็จ: ${phase2Result.successful} รายการ\n` +
      `• ล้มเหลว: ${phase2Result.failed} รายการ\n` +
      `• เวลา: ${phase2Result.time || 0} วินาที\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📅 ช่วงเวลา: ${dateText}\n` +
      `🔍 Status: ${statusText}\n` +
      `⏱️ เวลารวม: ${minutes} นาที ${seconds} วินาที\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    ss.toast("🎉 Auto Run Complete!", "MLSTMS Trips", 10);
    Logger.log(`🎉 Auto Run Complete! Total time: ${minutes}m ${seconds}s`);
    Logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    Logger.log(
      `📊 PHASE 1: ${phase1Result.success ? "✅" : "❌"} ${phase1Result.tripCount} Trip IDs in ${phase1Result.time}s`,
    );
    Logger.log(
      `📊 PHASE 2: ${phase2Result.success ? "✅" : "❌"} ${phase2Result.successful}/${phase1Result.tripCount} in ${phase2Result.time}s`,
    );
    Logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // บันทึก Execution Log
    logExecution(
      "pullTripsAutoRun",
      true,
      `Phase 1: ${phase1Result.tripCount} Trip IDs (${phase1Result.time}s)\nPhase 2: ${phase2Result.successful}/${phase1Result.tripCount} (${phase2Result.time}s)\nTotal: ${minutes}m ${seconds}s`,
    );

    return {
      success: true,
      phase1: phase1Result,
      phase2: phase2Result,
      totalTime: overallTime,
      summary: summaryMessage,
    };
  } catch (error) {
    const overallTime = Math.round((new Date() - overallStartTime) / 1000);
    const errorMessage =
      `❌ Auto Run Failed!\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `PHASE 1: ${phase1Result.success ? "✅ สำเร็จ" : "❌ ล้มเหลว"}\n` +
      `${phase1Result.message || ""}\n\n` +
      `PHASE 2: ${phase2Result.success ? "✅ สำเร็จ" : "❌ ล้มเหลว"}\n` +
      `${phase2Result.message || ""}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `เวลาที่ใช้: ${Math.floor(overallTime / 60)} นาที ${overallTime % 60} วินาที\n` +
      `Error: ${error.message}`;

    ss.toast("❌ Auto Run Failed", "MLSTMS Trips", 10);
    Logger.log(`❌ Auto Run Failed: ${error.message}`);
    Logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    Logger.log(
      `PHASE 1: ${phase1Result.success ? "✅" : "❌"} - ${phase1Result.message || "N/A"}`,
    );
    Logger.log(
      `PHASE 2: ${phase2Result.success ? "✅" : "❌"} - ${phase2Result.message || "N/A"}`,
    );
    Logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // บันทึก Execution Log (Error)
    logExecution(
      "pullTripsAutoRun",
      false,
      `Error: ${error.message}\nPhase 1: ${phase1Result.success ? "✅" : "❌"}\nPhase 2: ${phase2Result.success ? "✅" : "❌"}`,
    );

    return {
      success: false,
      phase1: phase1Result,
      phase2: phase2Result,
      error: error.message,
      summary: errorMessage,
    };
  }
}

/**
 * แสดง Dialog สำหรับ Auto Run
 */
function showAutoRunDialog() {
  const ui = SpreadsheetApp.getUi();
  const scriptProperties = PropertiesService.getScriptProperties();
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
    <head><base target="_top">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; background-color: #f5f5f5; }
      .container { max-width: 450px; margin: 0 auto; background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
      h2 { color: #9C27B0; margin-top: 0; margin-bottom: 5px; text-align: center; }
      .subtitle { text-align: center; color: #666; font-size: 13px; margin-bottom: 20px; }
      .info-box { padding: 12px; background: #f3e5f5; border-radius: 4px; margin-bottom: 15px; font-size: 12px; color: #7b1fa2; }
      .form-group { margin-bottom: 15px; }
      label { display: block; font-weight: 500; margin-bottom: 5px; color: #333; font-size: 13px; }
      input[type="date"], select { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box; }
      .btn-group { display: flex; gap: 10px; margin-top: 20px; }
      button { flex: 1; padding: 12px; border: none; border-radius: 4px; font-size: 14px; font-weight: 500; cursor: pointer; }
      .btn-primary { background: #9C27B0; color: white; }
      .btn-primary:hover { background: #7b1fa2; }
      .btn-secondary { background: #f1f3f4; color: #333; }
      .btn-secondary:hover { background: #e8eaed; }
    </style>
    </head>
    <body>
      <div class="container">
        <h2>🚀 Auto Run (Phase 1 + 2)</h2>
        <div class="subtitle">รันอัตโนมัติ: Phase 1 → ดีเลย์ 10 วินาที → Phase 2 → Sorting</div>
        <div class="info-box">
          📋 <b>Phase 1:</b> ดึง Trip IDs<br>
          ⏳ <b>Delay:</b> 10 วินาที<br>
          📋 <b>Phase 2:</b> ดึง Trip Details<br>
          🔄 <b>Sorting:</b> เรียง Trip ID & Updated At (มาก→น้อย)<br>
          📊 <b>Summary:</b> สรุปผลรวม
        </div>
        <form onsubmit="handleSubmit(event)">
          <div class="form-group">
            <label>📅 วันที่เริ่ม</label>
            <input type="date" id="startDate" value="${savedStartDate}" required>
          </div>
          <div class="form-group">
            <label>📅 วันที่สิ้นสุด</label>
            <input type="date" id="endDate" value="${savedEndDate}" required>
          </div>
          <div class="form-group">
            <label>🔢 Status ID</label>
            <select id="statusId">
              <option value="ALL">ทุก Status (1-5)</option>
              <option value="1">1 - Open</option>
              <option value="2">2 - In Progress</option>
              <option value="3">3 - Completed</option>
              <option value="4">4 - Cancelled</option>
              <option value="5">5 - Other</option>
            </select>
          </div>
          <div class="btn-group">
            <button type="button" class="btn-secondary" onclick="google.script.host.close()">ปิด</button>
            <button type="submit" class="btn-primary">🚀 เริ่ม Auto Run</button>
          </div>
        </form>
      </div>
      <script>
        function handleSubmit(event) {
          event.preventDefault();
          const startDate = document.getElementById('startDate').value;
          const endDate = document.getElementById('endDate').value;
          const statusId = document.getElementById('statusId').value;
          if (!startDate || !endDate) { alert('❌ กรุณาระบุวันที่เริ่มและวันที่สิ้นสุด'); return; }
          if (startDate > endDate) { alert('❌ วันที่เริ่มต้องไม่หลังวันที่สิ้นสุด'); return; }
          const confirmed = confirm('🚀 ยืนยันเริ่ม Auto Run?\\n\\nPhase 1 → ดีเลย์ 10 วินาที → Phase 2 → Sorting\\nพร้อมสรุปผลรวม');
          if (confirmed) {
            google.script.run.withSuccessHandler(function(result) {
              if (result.success) { alert('✅ Auto Run สำเร็จ!\\n\\n' + result.summary); google.script.host.close(); }
              else { alert('❌ เกิดข้อผิดพลาด: ' + result.summary); }
            }).withFailureHandler(function(error) { alert('❌ เกิดข้อผิดพลาด: ' + error.message); })
            .pullTripsAutoRun(startDate, endDate, statusId);
          }
        }
      </script>
    </body>
    </html>
  `,
  )
    .setWidth(480)
    .setHeight(580)
    .setTitle("Auto Run: Phase 1 + 2");

  ui.showModalDialog(html, "Auto Run: Phase 1 + 2");
}

/**
 * Auto Pull Today - ดึงข้อมูลวันนี้อัตโนมัติ
 * ใช้หลักการเดียวกับ Auto Run (Phase 1 → ดีเลย์ 10 วินาที → Phase 2 → Sorting)
 * แต่ดึงเฉพาะข้อมูลของวันนี้โดยอัตโนมัติ
 *
 * ✅ มีการตรวจสอบ Trip ID ซ้ำก่อนบันทึกทั้ง Phase 1 และ Phase 2
 */
function pullTodayAutoRun() {
  const today = new Date();
  const todayStr = Utilities.formatDate(
    today,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd",
  );

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const scriptProperties = PropertiesService.getScriptProperties();
  const config = getConfig();

  // ✅ ตรวจสอบว่ารันจาก Trigger หรือ Manual
  // Trigger context: ไม่มี UI -> skip confirmation
  // Manual context: มี UI -> show confirmation
  let isTriggerContext = false;
  try {
    SpreadsheetApp.getUi();
    // ถ้าถึงตรงนี้ แปลว่ามี UI (manual run)
    const ui = SpreadsheetApp.getUi();
    const confirmed = ui.alert(
      "🚀 Auto Pull Today",
      `จะดึงข้อมูลของวันนี้: ${todayStr}\n\n` +
        `📋 Phase 1: ดึง Trip IDs วันนี้ (ตรวจสอบซ้ำ)\n` +
        `⏳ ดีเลย์: 30 วินาที\n` +
        `📋 Phase 2: ดึง Trip Details วันนี้ (ตรวจสอบซ้ำ)\n\n` +
        `ต้องการดำเนินการต่อหรือไม่?`,
      ui.ButtonSet.YES_NO,
    );

    if (confirmed !== ui.Button.YES) {
      ss.toast("❌ ยกเลิกการดึงข้อมูล", "MLSTMS Trips", 5);
      return { success: false, message: "ยกเลิกการดึงข้อมูล" };
    }
  } catch (error) {
    // ❌ ไม่มี UI = trigger context -> รันอัตโนมัติเลย
    isTriggerContext = true;
    Logger.log(`🤖 Auto Pull Today running from trigger context - skipping confirmation`);
  }

  const overallStartTime = new Date();
  let phase1Result = { success: false, tripCount: 0, message: "" };
  let phase2Result = {
    success: false,
    successful: 0,
    failed: 0,
    detailAdded: 0,
    totalBatchesWritten: 0,
    message: "",
  };

  try {
    // ============================================
    // PHASE 1: Pull Trip IDs (ตรวจสอบซ้ำ)
    // ============================================
    ss.toast("🚀 Starting Auto Pull Today: Phase 1...", "MLSTMS Trips", 10);
    Logger.log(`🚀 Auto Pull Today Started - Phase 1: ${todayStr}`);

    const phase1StartTime = new Date();

    try {
      // Login
      const token = login();
      if (!token) throw new Error("Login failed");

      const STATUS_IDS = CONFIG.STATUS_IDS; // 1-5

      // เตรียมชีท Phase 1
      const sheet = prepareSheet(
        config.tripsSheetName,
        [
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
        ],
        false,
      );

      // ✅ ใช้ array รวมทุก status เพื่อบันทึกทีเดียวด้วย saveTripsToSheet()
      let allTripsForAllStatuses = [];
      let totalFetched = 0;

      for (let i = 0; i < STATUS_IDS.length; i++) {
        const currentStatusId = STATUS_IDS[i];
        showProgressToast("📋 Phase 1: ดึง Trip IDs", i + 1, STATUS_IDS.length);

        const trips = fetchTripsFromAPI(currentStatusId, todayStr, todayStr);

        if (trips.length === 0) {
          ss.toast(
            `⏭️ Status ${currentStatusId}: ไม่มีข้อมูล`,
            "MLSTMS Trips",
            3,
          );
          Logger.log(`   ⏭️ Status ${currentStatusId}: No data - skipping`);
          continue;
        }

        ss.toast(
          `✅ Status ${currentStatusId}: พบ ${trips.length} รายการ`,
          "MLSTMS Trips",
          5,
        );
        Logger.log(
          `   ✅ Status ${currentStatusId}: ${trips.length} trips found`,
        );

        // ✅ เพิ่ม trips ทั้งหมดใน status นี้ลงใน array รวม
        const tripsForCurrentStatus = trips.map(trip => ({ ...trip, _tempStatusId: currentStatusId }));
        allTripsForAllStatuses = allTripsForAllStatuses.concat(tripsForCurrentStatus);
        totalFetched += trips.length;

        Logger.log(`   📊 Status ${currentStatusId}: ${trips.length} fetched`);
        Utilities.sleep(2000);
      }

      // ✅ เรียก saveTripsToSheet() ครั้งเดียวหลังจากดึงครบทุก status
      ss.toast(`💾 กำลังบันทึก Trips ทั้งหมด ${allTripsForAllStatuses.length} รายการ...`, "MLSTMS Trips", 10);
      saveTripsToSheet(allTripsForAllStatuses, true, true);

      // ✅ เก็บ Trip IDs สำหรับ Phase 2
      const allTripIdsSet = new Set();
      for (const trip of allTripsForAllStatuses) {
        const tripId = getTripField(trip, ["id", "tripId", "trip_code", "tripCode", "trip_id"]);
        if (tripId) allTripIdsSet.add(String(tripId));
      }
      const tripIdArray = Array.from(allTripIdsSet);
      scriptProperties.setProperty(
        "TRIP_IDS_LIST",
        JSON.stringify(tripIdArray),
      );
      scriptProperties.setProperty(
        "TOTAL_TRIP_IDS",
        allTripIdsSet.size.toString(),
      );

      const phase1Time = Math.round((new Date() - phase1StartTime) / 1000);

      phase1Result = {
        success: true,
        tripCount: allTripIdsSet.size,
        totalFetched,
        time: phase1Time,
        message: `✅ Phase 1 Complete!\n\n• ดึงข้อมูล: ${totalFetched} รายการ\n• รวมทั้งหมด: ${allTripIdsSet.size} Trip IDs\n• เวลา: ${phase1Time} วินาที`,
      };

      ss.toast(
        `✅ Phase 1 Complete: ${allTripIdsSet.size} Trip IDs`,
        "MLSTMS Trips",
        10,
      );
      Logger.log(
        `✅ Phase 1 Complete: ${allTripIdsSet.size} Trip IDs in ${phase1Time}s`,
      );
      Logger.log(
        `   📊 Summary: ${totalFetched} fetched from API`,
      );
    } catch (error) {
      phase1Result = {
        success: false,
        tripCount: 0,
        message: `❌ Phase 1 Failed: ${error.message}`,
      };
      throw error;
    }

    // ============================================
    // DELAY: 10 วินาที
    // ============================================
    ss.toast("⏳ Waiting 10 seconds before Phase 2...", "MLSTMS Trips", 10);
    Logger.log(`⏳ Delaying 10 seconds before Phase 2...`);

    for (let i = 10; i > 0; i--) {
      if (i % 5 === 0 || i <= 5) {
        ss.toast(`⏳ Starting Phase 2 in ${i} seconds...`, "MLSTMS Trips", 5);
      }
      Utilities.sleep(1000);
    }

    // ============================================
    // PHASE 2: Pull Trip Details (ดึงทั้งหมด → ตรวจสอบซ้ำ → insert/update)
    // ============================================
    ss.toast("🚀 Starting Phase 2: Pull Trip Details...", "MLSTMS Trips", 10);
    Logger.log(`🚀 Phase 2 Started: ${phase1Result.tripCount} Trip IDs`);

    const phase2StartTime = new Date();

    try {
      // อ่าน Trip IDs จาก Phase 1
      const tripIds = readTripIdsFromPhase1();

      if (tripIds.length === 0) {
        throw new Error("ไม่พบ Trip IDs จาก Phase 1");
      }

      // Login ใหม่ (ถ้า token หมดอายุ)
      const token = login();
      if (!token) throw new Error("Login failed");

      // ✅ Batch Write Settings: เขียนทีละ 100 รายการ
      const BATCH_WRITE_SIZE = 100;
      let currentBatch = [];
      let totalBatchesWritten = 0;

      // ✅ Track statistics
      let successful = 0;
      let failed = 0;
      let detailAdded = 0;
      let detailUpdated = 0;

      ss.toast(`📋 Phase 2:กำลังดึง Trip Details ${tripIds.length} รายการ...`, "MLSTMS Trips", 10);
      Logger.log(`📋 Phase 2: Starting to fetch ${tripIds.length} trip details...`);
      Logger.log(`📊 Batch write size: ${BATCH_WRITE_SIZE} records per batch`);

      for (let i = 0; i < tripIds.length; i++) {
        const tripId = tripIds[i];
        const progress = Math.round(((i + 1) / tripIds.length) * 100);

        // Progress update ทุก 10% หรือทุก 50 รายการ
        if ((i + 1) % 50 === 0 || (i + 1) % Math.floor(tripIds.length / 10) === 0 || i === tripIds.length - 1) {
          ss.toast(
            `📋 กำลังดึง Details: ${i + 1}/${tripIds.length} (${progress}%)`,
            "MLSTMS Trips",
            5,
          );
          Logger.log(`   📊 Progress: ${i + 1}/${tripIds.length} (${progress}%) - fetched: ${successful}, failed: ${failed}, batches: ${totalBatchesWritten}`);
        }

        // ✅ ดึงข้อมูลทุก Trip ID (ไม่ skip ตัวที่มีอยู่แล้ว - เพื่อ update ข้อมูลล่าสุด)
        const detail = fetchTripDetailsFromAPI(tripId);

        if (detail) {
          currentBatch.push(detail);  // ✅ เก็บไว้ใน batch ปัจจุบัน
          successful++;
        } else {
          failed++;
        }

        // ✅ Batch write: เมื่อครบ 100 รายการ หรือถึงรายการสุดท้าย
        if (currentBatch.length >= BATCH_WRITE_SIZE || i === tripIds.length - 1) {
          if (currentBatch.length > 0) {
            ss.toast(
              `💾 บันทึก Batch ${totalBatchesWritten + 1}: ${currentBatch.length} รายการ...`,
              "MLSTMS Trips",
              5,
            );
            Logger.log(`   💾 Writing batch ${totalBatchesWritten + 1}: ${currentBatch.length} records`);

            // เรียก saveTripDetailsToSheet เพื่อบันทึก (มีการ checkDuplicates อยู่แล้วภายใน)
            saveTripDetailsToSheet(currentBatch, true, true);

            totalBatchesWritten++;

            // ✅ นับจำนวนที่เพิ่ม/อัพเดท จาก batch ที่เพิ่งบันทึก
            const detailSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.tripDetailsSheetName);
            const currentTotalRows = detailSheet ? detailSheet.getLastRow() - 1 : 0; // Exclude header

            detailAdded = Math.max(detailAdded, currentTotalRows - (totalBatchesWritten > 1 ? detailAdded : 0));
            detailUpdated = Math.max(detailUpdated, currentBatch.length);

            Logger.log(`   ✅ Batch ${totalBatchesWritten} saved. Total records in sheet: ${currentTotalRows}`);

            // ✅ เคลียร batch ปัจจุบัน
            currentBatch = [];
          }
        }

        if (!config.fastMode && config.rateLimitMs > 0) {
          Utilities.sleep(config.rateLimitMs);
        }
      }

      // ✅ อ่านจำนวน records ที่แท้จริงในชีทหลังจากบันทึกทั้งหมด
      const detailSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.tripDetailsSheetName);
      const finalTotalRecords = detailSheet ? detailSheet.getLastRow() - 1 : 0;

      const phase2Time = Math.round((new Date() - phase2StartTime) / 1000);

      phase2Result = {
        success: true,
        successful,
        failed,
        detailAdded: finalTotalRecords, // จำนวนรวมทั้งหมดในชีท
        detailUpdated: Math.max(0, finalTotalRecords), // ทุกรายการถือว่าเป็น update
        detailSkipped: 0, // ไม่มีการ skip แล้ว
        totalBatchesWritten,
        time: phase2Time,
        message: `✅ Phase 2 Complete!\n\n• สำเร็จ: ${successful} รายการ\n• ล้มเหลว: ${failed} รายการ\n• บันทึกทั้งหมด: ${finalTotalRecords} รายการในชีท\n• Batch ที่บันทึก: ${totalBatchesWritten} บาช\n• เวลา: ${phase2Time} วินาที`,
      };

      ss.toast(
        `✅ Phase 2 Complete: ${successful}/${tripIds.length} (${totalBatchesWritten} batches)`,
        "MLSTMS Trips",
        10,
      );
      Logger.log(
        `✅ Phase 2 Complete: ${successful}/${tripIds.length} in ${phase2Time}s (${totalBatchesWritten} batches written)`,
      );
      Logger.log(
        `   📊 Summary: ${successful} fetched, ${failed} failed, ${finalTotalRecords} total in sheet`,
      );
    } catch (error) {
      phase2Result = {
        success: false,
        successful: 0,
        failed: 0,
        detailAdded: 0,
        totalBatchesWritten: 0,
        message: `❌ Phase 2 Failed: ${error.message}`,
      };
      throw error;
    }

    // ============================================
    // SORTING: เรียงลำดับข้อมูลทั้ง 2 ชีท
    // ============================================
    ss.toast("🔄 เรียงลำดับข้อมูลทั้ง 2 ชีท...", "MLSTMS Trips", 10);
    Logger.log(`🔄 Sorting sheets: Trip ID (desc), Updated At (desc)...`);

    try {
      sortSheetsByTripIdAndUpdatedAt();
      ss.toast("✅ เรียงลำดับข้อมูลเสร็จสิ้น", "MLSTMS Trips", 5);
      Logger.log(`✅ Sorting completed successfully`);
    } catch (error) {
      ss.toast("⚠️ การเรียงลำดับข้อมูลล้มเหลว", "MLSTMS Trips", 5);
      Logger.log(`⚠️ Sorting failed: ${error.message}`);
    }

    // ============================================
    // SUMMARY: สรุปผลรวม
    // ============================================
    const overallTime = Math.round((new Date() - overallStartTime) / 1000);
    const minutes = Math.floor(overallTime / 60);
    const seconds = overallTime % 60;

    const summaryMessage =
      `🎉 Auto Pull Today Complete!\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📊 PHASE 1: Pull Trip IDs\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${phase1Result.success ? "✅ สำเร็จ" : "❌ ล้มเหลว"}\n` +
      `• ดึงข้อมูล: ${phase1Result.totalFetched || 0} รายการ\n` +
      `• เพิ่มใหม่: ${phase1Result.totalAdded || 0} รายการ\n` +
      `• อัพเดท: ${phase1Result.totalUpdated || 0} รายการ\n` +
      `• รวมทั้งหมด: ${phase1Result.tripCount} Trip IDs\n` +
      `• เวลา: ${phase1Result.time || 0} วินาที\n\n` +
      `⏳ DELAY: 10 วินาที\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📊 PHASE 2: Pull Trip Details\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${phase2Result.success ? "✅ สำเร็จ" : "❌ ล้มเหลว"}\n` +
      `• สำเร็จ: ${phase2Result.successful} รายการ\n` +
      `• ล้มเหลว: ${phase2Result.failed} รายการ\n` +
      `• บันทึกทั้งหมด: ${phase2Result.detailAdded || 0} รายการในชีท\n` +
      `• Batch ที่บันทึก: ${phase2Result.totalBatchesWritten || 0} บาช (ทีละ 100 รายการ)\n` +
      `• เวลา: ${phase2Result.time || 0} วินาที\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📅 วันที่: ${todayStr}\n` +
      `⏱️ เวลารวม: ${minutes} นาที ${seconds} วินาที\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    ss.toast("🎉 Auto Pull Today Complete!", "MLSTMS Trips", 10);
    Logger.log(
      `🎉 Auto Pull Today Complete! Total time: ${minutes}m ${seconds}s`,
    );
    Logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    Logger.log(
      `📊 PHASE 1: ${phase1Result.success ? "✅" : "❌"} ${phase1Result.tripCount} Trip IDs in ${phase1Result.time}s`,
    );
    Logger.log(
      `📊 PHASE 2: ${phase2Result.success ? "✅" : "❌"} ${phase2Result.successful}/${phase1Result.tripCount} in ${phase2Result.time}s`,
    );
    Logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // บันทึก Execution Log
    logExecution(
      "pullTodayAutoRun",
      true,
      `Phase 1: ${phase1Result.tripCount} Trip IDs (${phase1Result.time}s)\nPhase 2: ${phase2Result.successful}/${phase1Result.tripCount} (${phase2Result.time}s)\nTotal: ${minutes}m ${seconds}s`,
    );

    return {
      success: true,
      phase1: phase1Result,
      phase2: phase2Result,
      totalTime: overallTime,
      summary: summaryMessage,
    };
  } catch (error) {
    const overallTime = Math.round((new Date() - overallStartTime) / 1000);
    const errorMessage =
      `❌ Auto Pull Today Failed!\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `PHASE 1: ${phase1Result.success ? "✅ สำเร็จ" : "❌ ล้มเหลว"}\n` +
      `${phase1Result.message || ""}\n\n` +
      `PHASE 2: ${phase2Result.success ? "✅ สำเร็จ" : "❌ ล้มเหลว"}\n` +
      `• สำเร็จ: ${phase2Result.successful || 0} รายการ\n` +
      `• ล้มเหลว: ${phase2Result.failed || 0} รายการ\n` +
      `• บันทึกแล้ว: ${phase2Result.detailAdded || 0} รายการ\n` +
      `• Batch ที่บันทึก: ${phase2Result.totalBatchesWritten || 0} บาช\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `เวลาที่ใช้: ${Math.floor(overallTime / 60)} นาที ${overallTime % 60} วินาที\n` +
      `Error: ${error.message}`;

    ss.toast("❌ Auto Pull Today Failed", "MLSTMS Trips", 10);
    Logger.log(`❌ Auto Pull Today Failed: ${error.message}`);
    Logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    Logger.log(
      `PHASE 1: ${phase1Result.success ? "✅" : "❌"} - ${phase1Result.message || "N/A"}`,
    );
    Logger.log(
      `PHASE 2: ${phase2Result.success ? "✅" : "❌"} - ${phase2Result.message || "N/A"}`,
    );
    Logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // บันทึก Execution Log (Error)
    logExecution(
      "pullTodayAutoRun",
      false,
      `Error: ${error.message}\nPhase 1: ${phase1Result.success ? "✅" : "❌"}\nPhase 2: ${phase2Result.success ? "✅" : "❌"}`,
    );

    return {
      success: false,
      phase1: phase1Result,
      phase2: phase2Result,
      error: error.message,
      summary: errorMessage,
    };
  }
}

/**
 * Auto Pull N Days Ago - ดึงข้อมูลย้อนหลัง N วันอัตโนมัติ
 * ดึงข้อมูลต่อเนื่อง N วัน (ตั้งแต่ N-1 วันก่อนหน้า ถึง วันนี้)
 *
 * ตัวอย่าง:
 * - pull2DaysAgoAutoRun() = ดึง 2 วัน (เมื่อวาน → วันนี้) = 27-28 มี.ค.
 * - pull3DaysAgoAutoRun() = ดึง 3 วัน (2 วันก่อนหน้า → เมื่อวาน → วันนี้) = 26-28 มี.ค.
 *
 * @param {number} daysCount - จำนวนวันที่ต้องการดึง (default: 3)
 */
function pullDaysAgoAutoRun(daysCount = 3) {
  // ✅ คำนวณช่วงวันที่: (daysCount-1) วันก่อนหน้า → วันนี้
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - (daysCount - 1)); // เริ่มจาก daysCount-1 วันก่อนหน้า

  const startDateStr = Utilities.formatDate(
    startDate,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd",
  );
  const endDateStr = Utilities.formatDate(
    today,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd",
  );

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const scriptProperties = PropertiesService.getScriptProperties();
  const config = getConfig();

  // ✅ ตรวจสอบว่ารันจาก Trigger หรือ Manual
  let isTriggerContext = false;
  try {
    SpreadsheetApp.getUi();
    const ui = SpreadsheetApp.getUi();
    const confirmed = ui.alert(
      `🚀 Auto Pull ${daysCount} Days`,
      `จะดึงข้อมูล ${daysCount} วันต่อเนื่อง:\n\n` +
        `📅 วันที่เริ่ม: ${startDateStr}\n` +
        `📅 วันที่สิ้นสุด: ${endDateStr}\n\n` +
        `📋 Phase 1: ดึง Trip IDs (ตรวจสอบซ้ำ)\n` +
        `⏳ ดีเลย์: 10 วินาที\n` +
        `📋 Phase 2: ดึง Trip Details (ตรวจสอบซ้ำ)\n\n` +
        `ต้องการดำเนินการต่อหรือไม่?`,
      ui.ButtonSet.YES_NO,
    );

    if (confirmed !== ui.Button.YES) {
      ss.toast(`❌ ยกเลิกการดึงข้อมูล ${daysCount} วัน`, "MLSTMS Trips", 5);
      return { success: false, message: "ยกเลิกการดึงข้อมูล" };
    }
  } catch (error) {
    isTriggerContext = true;
    Logger.log(`🤖 Auto Pull ${daysCount} Days running from trigger context - skipping confirmation`);
  }

  const overallStartTime = new Date();
  let phase1Result = { success: false, tripCount: 0, totalFetched: 0, message: "" };
  let phase2Result = {
    success: false,
    successful: 0,
    failed: 0,
    detailAdded: 0,
    totalBatchesWritten: 0,
    message: "",
  };

  try {
    // ============================================
    // PHASE 1: Pull Trip IDs
    // ============================================
    ss.toast(`🚀 Starting Auto Pull ${daysCount} Days: Phase 1...`, "MLSTMS Trips", 10);
    Logger.log(`🚀 Auto Pull ${daysCount} Days Started - Phase 1: ${startDateStr} to ${endDateStr}`);

    const phase1StartTime = new Date();

    try {
      const token = login();
      if (!token) throw new Error("Login failed");

      const STATUS_IDS = CONFIG.STATUS_IDS;

      const sheet = prepareSheet(
        config.tripsSheetName,
        [
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
        ],
        false,
      );

      let allTripsForAllStatuses = [];
      let totalFetched = 0;

      for (let i = 0; i < STATUS_IDS.length; i++) {
        const currentStatusId = STATUS_IDS[i];
        showProgressToast("📋 Phase 1: ดึง Trip IDs", i + 1, STATUS_IDS.length);

        const trips = fetchTripsFromAPI(currentStatusId, startDateStr, endDateStr);

        if (trips.length === 0) {
          ss.toast(
            `⏭️ Status ${currentStatusId}: ไม่มีข้อมูล`,
            "MLSTMS Trips",
            3,
          );
          Logger.log(`   ⏭️ Status ${currentStatusId}: No data - skipping`);
          continue;
        }

        ss.toast(
          `✅ Status ${currentStatusId}: พบ ${trips.length} รายการ`,
          "MLSTMS Trips",
          5,
        );
        Logger.log(
          `   ✅ Status ${currentStatusId}: ${trips.length} trips found`,
        );

        const tripsForCurrentStatus = trips.map(trip => ({ ...trip, _tempStatusId: currentStatusId }));
        allTripsForAllStatuses = allTripsForAllStatuses.concat(tripsForCurrentStatus);
        totalFetched += trips.length;

        Logger.log(`   📊 Status ${currentStatusId}: ${trips.length} fetched`);
        Utilities.sleep(2000);
      }

      ss.toast(`💾 กำลังบันทึก Trips ทั้งหมด ${allTripsForAllStatuses.length} รายการ...`, "MLSTMS Trips", 10);
      saveTripsToSheet(allTripsForAllStatuses, true, true);

      const allTripIdsSet = new Set();
      for (const trip of allTripsForAllStatuses) {
        const tripId = getTripField(trip, ["id", "tripId", "trip_code", "tripCode", "trip_id"]);
        if (tripId) allTripIdsSet.add(String(tripId));
      }
      const tripIdArray = Array.from(allTripIdsSet);
      scriptProperties.setProperty(
        "TRIP_IDS_LIST",
        JSON.stringify(tripIdArray),
      );
      scriptProperties.setProperty(
        "TOTAL_TRIP_IDS",
        allTripIdsSet.size.toString(),
      );

      const phase1Time = Math.round((new Date() - phase1StartTime) / 1000);

      phase1Result = {
        success: true,
        tripCount: allTripIdsSet.size,
        totalFetched,
        time: phase1Time,
        message: `✅ Phase 1 Complete!\n\n• ดึงข้อมูล: ${totalFetched} รายการ\n• รวมทั้งหมด: ${allTripIdsSet.size} Trip IDs\n• เวลา: ${phase1Time} วินาที`,
      };

      ss.toast(
        `✅ Phase 1 Complete: ${allTripIdsSet.size} Trip IDs`,
        "MLSTMS Trips",
        10,
      );
      Logger.log(
        `✅ Phase 1 Complete: ${allTripIdsSet.size} Trip IDs in ${phase1Time}s`,
      );
    } catch (error) {
      phase1Result = {
        success: false,
        tripCount: 0,
        message: `❌ Phase 1 Failed: ${error.message}`,
      };
      throw error;
    }

    // ============================================
    // DELAY: 10 วินาที
    // ============================================
    ss.toast("⏳ Waiting 10 seconds before Phase 2...", "MLSTMS Trips", 10);
    Logger.log(`⏳ Delaying 10 seconds before Phase 2...`);

    for (let i = 10; i > 0; i--) {
      if (i % 5 === 0 || i <= 5) {
        ss.toast(`⏳ Starting Phase 2 in ${i} seconds...`, "MLSTMS Trips", 5);
      }
      Utilities.sleep(1000);
    }

    // ============================================
    // PHASE 2: Pull Trip Details
    // ============================================
    ss.toast("🚀 Starting Phase 2: Pull Trip Details...", "MLSTMS Trips", 10);
    Logger.log(`🚀 Phase 2 Started: ${phase1Result.tripCount} Trip IDs`);

    const phase2StartTime = new Date();

    try {
      const tripIds = readTripIdsFromPhase1();

      if (tripIds.length === 0) {
        throw new Error("ไม่พบ Trip IDs จาก Phase 1");
      }

      const token = login();
      if (!token) throw new Error("Login failed");

      const BATCH_WRITE_SIZE = 100;
      let currentBatch = [];
      let totalBatchesWritten = 0;

      let successful = 0;
      let failed = 0;

      ss.toast(`📋 Phase 2: กำลังดึง Trip Details ${tripIds.length} รายการ...`, "MLSTMS Trips", 10);
      Logger.log(`📋 Phase 2: Starting to fetch ${tripIds.length} trip details...`);

      for (let i = 0; i < tripIds.length; i++) {
        const tripId = tripIds[i];
        const progress = Math.round(((i + 1) / tripIds.length) * 100);

        if ((i + 1) % 50 === 0 || (i + 1) % Math.floor(tripIds.length / 10) === 0 || i === tripIds.length - 1) {
          ss.toast(
            `📋 กำลังดึง Details: ${i + 1}/${tripIds.length} (${progress}%)`,
            "MLSTMS Trips",
            5,
          );
          Logger.log(`   📊 Progress: ${i + 1}/${tripIds.length} (${progress}%) - fetched: ${successful}, failed: ${failed}, batches: ${totalBatchesWritten}`);
        }

        const detail = fetchTripDetailsFromAPI(tripId);

        if (detail) {
          currentBatch.push(detail);
          successful++;
        } else {
          failed++;
        }

        if (currentBatch.length >= BATCH_WRITE_SIZE || i === tripIds.length - 1) {
          if (currentBatch.length > 0) {
            ss.toast(
              `💾 บันทึก Batch ${totalBatchesWritten + 1}: ${currentBatch.length} รายการ...`,
              "MLSTMS Trips",
              5,
            );
            Logger.log(`   💾 Writing batch ${totalBatchesWritten + 1}: ${currentBatch.length} records`);

            saveTripDetailsToSheet(currentBatch, true, true);

            totalBatchesWritten++;
            currentBatch = [];
          }
        }

        if (!config.fastMode && config.rateLimitMs > 0) {
          Utilities.sleep(config.rateLimitMs);
        }
      }

      const detailSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.tripDetailsSheetName);
      const finalTotalRecords = detailSheet ? detailSheet.getLastRow() - 1 : 0;

      const phase2Time = Math.round((new Date() - phase2StartTime) / 1000);

      phase2Result = {
        success: true,
        successful,
        failed,
        detailAdded: finalTotalRecords,
        detailUpdated: Math.max(0, finalTotalRecords),
        detailSkipped: 0,
        totalBatchesWritten,
        time: phase2Time,
        message: `✅ Phase 2 Complete!\n\n• สำเร็จ: ${successful} รายการ\n• ล้มเหลว: ${failed} รายการ\n• บันทึกทั้งหมด: ${finalTotalRecords} รายการในชีท\n• Batch ที่บันทึก: ${totalBatchesWritten} บาช\n• เวลา: ${phase2Time} วินาที`,
      };

      ss.toast(
        `✅ Phase 2 Complete: ${successful}/${tripIds.length} (${totalBatchesWritten} batches)`,
        "MLSTMS Trips",
        10,
      );
      Logger.log(
        `✅ Phase 2 Complete: ${successful}/${tripIds.length} in ${phase2Time}s (${totalBatchesWritten} batches written)`,
      );
    } catch (error) {
      phase2Result = {
        success: false,
        successful: 0,
        failed: 0,
        detailAdded: 0,
        totalBatchesWritten: 0,
        message: `❌ Phase 2 Failed: ${error.message}`,
      };
      throw error;
    }

    // ============================================
    // SORTING: เรียงลำดับข้อมูลทั้ง 2 ชีท
    // ============================================
    ss.toast("🔄 เรียงลำดับข้อมูลทั้ง 2 ชีท...", "MLSTMS Trips", 10);
    Logger.log(`🔄 Sorting sheets: Trip ID (desc), Updated At (desc)...`);

    try {
      sortSheetsByTripIdAndUpdatedAt();
      ss.toast("✅ เรียงลำดับข้อมูลเสร็จสิ้น", "MLSTMS Trips", 5);
      Logger.log(`✅ Sorting completed successfully`);
    } catch (error) {
      ss.toast("⚠️ การเรียงลำดับข้อมูลล้มเหลว", "MLSTMS Trips", 5);
      Logger.log(`⚠️ Sorting failed: ${error.message}`);
    }

    // ============================================
    // SUMMARY
    // ============================================
    const overallTime = Math.round((new Date() - overallStartTime) / 1000);
    const minutes = Math.floor(overallTime / 60);
    const seconds = overallTime % 60;

    const summaryMessage =
      `🎉 Auto Pull ${daysCount} Days Complete!\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📊 PHASE 1: Pull Trip IDs\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${phase1Result.success ? "✅ สำเร็จ" : "❌ ล้มเหลว"}\n` +
      `• ดึงข้อมูล: ${phase1Result.totalFetched || 0} รายการ\n` +
      `• รวมทั้งหมด: ${phase1Result.tripCount} Trip IDs\n` +
      `• เวลา: ${phase1Result.time || 0} วินาที\n\n` +
      `⏳ DELAY: 10 วินาที\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📊 PHASE 2: Pull Trip Details\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${phase2Result.success ? "✅ สำเร็จ" : "❌ ล้มเหลว"}\n` +
      `• สำเร็จ: ${phase2Result.successful} รายการ\n` +
      `• ล้มเหลว: ${phase2Result.failed} รายการ\n` +
      `• บันทึกทั้งหมด: ${phase2Result.detailAdded || 0} รายการในชีท\n` +
      `• Batch ที่บันทึก: ${phase2Result.totalBatchesWritten || 0} บาช\n` +
      `• เวลา: ${phase2Result.time || 0} วินาที\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📅 ช่วงวันที่: ${startDateStr} ถึง ${endDateStr}\n` +
      `⏱️ เวลารวม: ${minutes} นาที ${seconds} วินาที\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    ss.toast(`🎉 Auto Pull ${daysCount} Days Complete!`, "MLSTMS Trips", 10);
    Logger.log(
      `🎉 Auto Pull ${daysCount} Days Complete! Total time: ${minutes}m ${seconds}s`,
    );

    logExecution(
      `pull${daysCount}DaysAutoRun`,
      true,
      `Date Range: ${startDateStr} to ${endDateStr}\nPhase 1: ${phase1Result.tripCount} Trip IDs (${phase1Result.time}s)\nPhase 2: ${phase2Result.successful}/${phase1Result.tripCount} (${phase2Result.time}s)\nTotal: ${minutes}m ${seconds}s`,
    );

    return {
      success: true,
      phase1: phase1Result,
      phase2: phase2Result,
      totalTime: overallTime,
      summary: summaryMessage,
    };
  } catch (error) {
    const overallTime = Math.round((new Date() - overallStartTime) / 1000);
    const errorMessage =
      `❌ Auto Pull ${daysCount} Days Failed!\n\n` +
      `Error: ${error.message}`;

    ss.toast(`❌ Auto Pull ${daysCount} Days Failed`, "MLSTMS Trips", 10);
    Logger.log(`❌ Auto Pull ${daysCount} Days Failed: ${error.message}`);

    logExecution(
      `pull${daysCount}DaysAutoRun`,
      false,
      `Error: ${error.message}`,
    );

    return {
      success: false,
      phase1: phase1Result,
      phase2: phase2Result,
      error: error.message,
      summary: errorMessage,
    };
  }
}

/**
 * Wrapper function for 3 days
 * ดึงข้อมูล 3 วันต่อเนื่อง (2 วันก่อนหน้า → เมื่อวาน → วันนี้)
 * ตัวอย่าง: วันนี้ = 2026-03-28 → ดึง 2026-03-26 ถึง 2026-03-28
 */
function pull3DaysAgoAutoRun() {
  return pullDaysAgoAutoRun(3);
}

/**
 * Wrapper function for 2 days
 * ดึงข้อมูล 2 วันต่อเนื่อง (เมื่อวาน → วันนี้)
 * ตัวอย่าง: วันนี้ = 2026-03-28 → ดึง 2026-03-27 ถึง 2026-03-28
 */
function pull2DaysAgoAutoRun() {
  return pullDaysAgoAutoRun(2);
}

// ============================================
// AUTO RUN TRIGGER MANAGEMENT
// ============================================

/**
 * สร้าง Time-driven Trigger สำหรับ Auto Pull
 * @param {string} functionName - ชื่อฟังก์ชันที่ต้องการ trigger ('pullTodayAutoRun', 'pull2DaysAgoAutoRun', 'pull3DaysAgoAutoRun')
 * @param {string} type - 'DAILY' (ทุกวัน) หรือ 'MINUTES' (ทุกๆ นาที)
 * @param {number} value - ถ้า DAILY: ชั่วโมง (0-23), ถ้า MINUTES: จำนวนนาที (1-60)
 * @param {number} minute - นาที (0-59) ใช้เฉพาะกับ DAILY
 * @returns {object} - ผลการสร้าง trigger
 */
function createAutoRunTrigger(functionName = "pullTodayAutoRun", type = "DAILY", value = 23, minute = 59) {
  // ลบ trigger เก่าทั้งหมดก่อน (ป้องกันซ้ำ)
  deleteAutoRunTrigger();

  try {
    let trigger;
    let triggerDesc;

    if (type === "MINUTES") {
      // ทุกๆ นาทีที่กำหนด (เช่น ทุก 15, 30, 60 นาที)
      trigger = ScriptApp.newTrigger(functionName)
        .timeBased()
        .everyMinutes(value)
        .create();

      triggerDesc = `Every ${value} minute(s) - ${functionName}`;
    } else {
      // ทุกวัน เวลาที่กำหนด
      trigger = ScriptApp.newTrigger(functionName)
        .timeBased()
        .atHour(value)
        .nearMinute(minute)
        .everyDays(1)
        .create();

      const triggerTime = `${String(value).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      triggerDesc = `Daily at ${triggerTime} - ${functionName}`;
    }

    SpreadsheetApp.getActiveSpreadsheet().toast(
      `✅ Trigger created: ${triggerDesc}`,
      "MLSTMS Trips",
      10,
    );

    Logger.log(
      `✅ Auto Run Trigger created: ${trigger.getUniqueId()} - ${triggerDesc}`,
    );

    return {
      success: true,
      triggerId: trigger.getUniqueId(),
      triggerDesc: triggerDesc,
      message: `✅ Trigger created: ${triggerDesc}`,
    };
  } catch (error) {
    const errorMsg = `❌ Failed to create trigger: ${error.message}`;
    SpreadsheetApp.getActiveSpreadsheet().toast(errorMsg, "MLSTMS Trips", 10);
    Logger.log(errorMsg);

    return {
      success: false,
      error: error.message,
      message: errorMsg,
    };
  }
}

/**
 * ลบ Auto Run Triggers ทั้งหมด (รองรับทุกฟังก์ชัน)
 * @returns {object} - จำนวน trigger ที่ลบ
 */
function deleteAutoRunTrigger() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    let deletedCount = 0;

    // ลบ triggers ทั้งหมดที่เกี่ยวข้องกับ Auto Run
    const autoRunFunctions = [
      "pullTodayAutoRun",
      "pull2DaysAgoAutoRun",
      "pull3DaysAgoAutoRun",
    ];

    for (const trigger of triggers) {
      if (autoRunFunctions.includes(trigger.getHandlerFunction())) {
        ScriptApp.deleteTrigger(trigger);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      SpreadsheetApp.getActiveSpreadsheet().toast(
        `✅ Deleted ${deletedCount} trigger(s)`,
        "MLSTMS Trips",
        5,
      );
      Logger.log(`✅ Deleted ${deletedCount} Auto Run Trigger(s)`);
    }

    return {
      success: true,
      deletedCount: deletedCount,
      message:
        deletedCount > 0
          ? `✅ Deleted ${deletedCount} trigger(s)`
          : "No triggers to delete",
    };
  } catch (error) {
    const errorMsg = `❌ Failed to delete triggers: ${error.message}`;
    Logger.log(errorMsg);

    return {
      success: false,
      error: error.message,
      message: errorMsg,
    };
  }
}

/**
 * แสดง Auto Run Triggers ทั้งหมด
 * @returns {array} - รายการ triggers
 */
function listAutoRunTriggers() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    const autoRunTriggers = [];

    for (const trigger of triggers) {
      if (trigger.getHandlerFunction() === "pullTodayAutoRun") {
        autoRunTriggers.push({
          id: trigger.getUniqueId(),
          function: trigger.getHandlerFunction(),
          source: "ScriptApp",
        });
      }
    }

    return autoRunTriggers;
  } catch (error) {
    Logger.log(`❌ Failed to list triggers: ${error.message}`);
    return [];
  }
}

/**
 * แสดง Dialog สำหรับตั้งค่า Auto Run Trigger
 */
function setupAutoRunTriggerWithUI() {
  const ui = SpreadsheetApp.getUi();
  const triggers = listAutoRunTriggers();
  const hasExistingTrigger = triggers.length > 0;

  const html = HtmlService.createHtmlOutput(
    `
    <!DOCTYPE html>
    <html>
    <head><base target="_top">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; background-color: #f5f5f5; }
      .container { max-width: 480px; margin: 0 auto; background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
      h2 { color: #9C27B0; margin-top: 0; margin-bottom: 5px; text-align: center; }
      .subtitle { text-align: center; color: #666; font-size: 13px; margin-bottom: 20px; }
      ${hasExistingTrigger ? ".existing-box { padding: 12px; background: #fff3e0; border-radius: 4px; margin-bottom: 15px; font-size: 12px; color: #e65100; }" : ""}
      .info-box { padding: 12px; background: #e3f2fd; border-radius: 4px; margin-bottom: 15px; font-size: 12px; color: #1565c0; }
      .warning-box { padding: 12px; background: #ffebee; border-radius: 4px; margin-bottom: 15px; font-size: 12px; color: #c62828; }
      .form-group { margin-bottom: 15px; }
      label { display: block; font-weight: 500; margin-bottom: 5px; color: #333; font-size: 13px; }
      input[type="number"], select { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box; }
      .time-group { display: flex; gap: 10px; align-items: center; }
      .time-group .form-group { flex: 1; }
      .time-group .separator { font-size: 20px; font-weight: bold; color: #666; padding-top: 25px; }
      .btn-group { display: flex; gap: 10px; margin-top: 20px; }
      button { flex: 1; padding: 12px; border: none; border-radius: 4px; font-size: 14px; font-weight: 500; cursor: pointer; }
      .btn-primary { background: #9C27B0; color: white; }
      .btn-primary:hover { background: #7b1fa2; }
      .btn-danger { background: #f44336; color: white; }
      .btn-danger:hover { background: #d32f2f; }
      .btn-secondary { background: #f1f3f4; color: #333; }
      .btn-secondary:hover { background: #e8eaed; }
      .hidden { display: none; }
    </style>
    </head>
    <body>
      <div class="container">
        <h2>⏰ Auto Run Trigger Setup</h2>
        <div class="subtitle">ตั้งเวลา Auto Pull อัตโนมัติ</div>

        ${
          hasExistingTrigger
            ? `
          <div class="existing-box">
            ⚠️ <b>มี Trigger อยู่แล้ว:</b> ${triggers.length} ตัว<br>
            การสร้างใหม่จะลบ trigger เก่าทิ้งก่อน
          </div>
        `
            : ""
        }

        <div class="info-box">
          ⏱️ <b>Duration:</b> ~5-15 นาที (ขึ้นกับจำนวน trips)<br>
          📊 <b>Process:</b> Phase 1 → ดีเลย์ 10 วินาที → Phase 2 → Sorting
        </div>

        <div class="warning-box">
          ⚠️ <b>ข้อจำกัดของ Trigger:</b><br>
          • <b>Daily:</b> รันใกล้เคียงเวลาที่กำหนด (±15 นาที)<br>
          • <b>Minutes:</b> รันทุกๆ นาทีที่กำหนด (1-60 นาที)<br>
          • อาจรันช้าหาก Google Apps Script ยุ่ง
        </div>

        <form onsubmit="handleSubmit(event)">
          <div class="form-group">
            <label>📋 เลือกฟังก์ชัน</label>
            <select id="functionName">
              <option value="pullTodayAutoRun">🚀 Auto Pull Today (วันนี้)</option>
              <option value="pull2DaysAgoAutoRun">📅 Auto Pull 2 Days Ago (เมื่อวาน)</option>
              <option value="pull3DaysAgoAutoRun">📅 Auto Pull 3 Days Ago (3 วันก่อนหน้า)</option>
            </select>
          </div>

          <div class="form-group">
            <label>🔀 ประเภท Trigger</label>
            <select id="triggerType" onchange="toggleFields()">
              <option value="DAILY">📅 ทุกวัน (Daily) - รันตามเวลาที่กำหนด</option>
              <option value="MINUTES">⏰ ทุกๆ นาที (Minutes) - รันทุกๆ นาทีที่กำหนด</option>
            </select>
          </div>

          <!-- Daily Fields -->
          <div id="dailyFields">
            <div class="time-group">
              <div class="form-group">
                <label>🕐 ชั่วโมง (0-23)</label>
                <input type="number" id="hour" value="23" min="0" max="23">
              </div>
              <div class="separator">:</div>
              <div class="form-group">
                <label>🕐 นาที (0-59)</label>
                <input type="number" id="minute" value="59" min="0" max="59">
              </div>
            </div>
          </div>

          <!-- Minutes Fields -->
          <div id="minutesFields" class="hidden">
            <div class="form-group">
              <label>⏰ ทุกๆ กี่นาที? (1-60)</label>
              <select id="intervalMinutes">
                <option value="5">ทุก 5 นาที</option>
                <option value="10">ทุก 10 นาที</option>
                <option value="15">ทุก 15 นาที</option>
                <option value="30" selected>ทุก 30 นาที (แนะนำ)</option>
                <option value="60">ทุก 60 นาที (1 ชั่วโมง)</option>
              </select>
            </div>
            <div class="info-box" style="background: #fff3e0; color: #e65100;">
              💡 <b>แนะนำ:</b> ใช้ 30-60 นาที เพื่อไม่ให้รบกวน API มากเกินไป
            </div>
          </div>

          <div class="btn-group">
            <button type="button" class="btn-secondary" onclick="closeDialog()">ปิด</button>
            ${
              hasExistingTrigger
                ? `
              <button type="button" class="btn-danger" onclick="deleteTrigger()">ลบ Trigger</button>
            `
                : ""
            }
            <button type="submit" class="btn-primary">⏰ ตั้งเวลา Auto Run</button>
          </div>
        </form>
      </div>

      <script>
        function toggleFields() {
          const type = document.getElementById('triggerType').value;
          document.getElementById('dailyFields').classList.toggle('hidden', type !== 'DAILY');
          document.getElementById('minutesFields').classList.toggle('hidden', type !== 'MINUTES');
        }

        function handleSubmit(event) {
          event.preventDefault();
          const functionName = document.getElementById('functionName').value;
          const type = document.getElementById('triggerType').value;

          let confirmed, desc;

          if (type === 'DAILY') {
            const hour = parseInt(document.getElementById('hour').value);
            const minute = parseInt(document.getElementById('minute').value);

            if (hour < 0 || hour > 23) {
              alert('❌ ชั่วโมงต้องอยู่ระหว่าง 0-23');
              return;
            }
            if (minute < 0 || minute > 59) {
              alert('❌ นาทีต้องอยู่ระหว่าง 0-59');
              return;
            }

            const timeStr = String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
            desc = '📅 ทุกวัน (Daily)\\n⏰ เวลา: ' + timeStr;

            const functionNames = {
              'pullTodayAutoRun': 'Auto Pull Today',
              'pull2DaysAgoAutoRun': 'Auto Pull 2 Days Ago',
              'pull3DaysAgoAutoRun': 'Auto Pull 3 Days Ago'
            };

            confirmed = confirm(
              '⏰ ยืนยันตั้งเวลา Auto Run?\\n\\n' +
              desc + '\\n' +
              '📋 Function: ' + functionNames[functionName] + '\\n\\n' +
              '⚠️ Trigger จะรันใกล้เคียงเวลาที่กำหนด (±15 นาที)'
            );

            if (confirmed) {
              google.script.run.withSuccessHandler(handleResult).withFailureHandler(handleError)
              .createAutoRunTrigger(functionName, 'DAILY', hour, minute);
            }
          } else {
            const minutes = parseInt(document.getElementById('intervalMinutes').value);
            desc = '⏰ ทุกๆ ' + minutes + ' นาที';

            const functionNames = {
              'pullTodayAutoRun': 'Auto Pull Today',
              'pull2DaysAgoAutoRun': 'Auto Pull 2 Days Ago',
              'pull3DaysAgoAutoRun': 'Auto Pull 3 Days Ago'
            };

            confirmed = confirm(
              '⏰ ยืนยันตั้งเวลา Auto Run?\\n\\n' +
              desc + '\\n' +
              '📋 Function: ' + functionNames[functionName] + '\\n\\n' +
              '⚠️ Trigger จะรันทุกๆ ' + minutes + ' นาที'
            );

            if (confirmed) {
              google.script.run.withSuccessHandler(handleResult).withFailureHandler(handleError)
              .createAutoRunTrigger(functionName, 'MINUTES', minutes);
            }
          }
        }

        function handleResult(result) {
          if (result.success) {
            alert('✅ สำเร็จ!\\n\\n' + result.message);
            google.script.host.close();
          } else {
            alert('❌ ล้มเหลว: ' + result.message);
          }
        }

        function handleError(error) {
          alert('❌ เกิดข้อผิดพลาด: ' + error.message);
        }

        function deleteTrigger() {
          const confirmed = confirm('⚠️ ยืนยันลบ Trigger?\\n\\nAuto Run จะหยุดทำงาน');
          if (confirmed) {
            google.script.run.withSuccessHandler(function(result) {
              if (result.success) {
                alert('✅ ' + result.message);
                google.script.host.close();
              } else {
                alert('❌ ล้มเหลว: ' + result.message);
              }
            }).withFailureHandler(function(error) {
              alert('❌ เกิดข้อผิดพลาด: ' + error.message);
            }).deleteAutoRunTrigger();
          }
        }

        function closeDialog() {
          google.script.host.close();
        }
      </script>
    </body>
    </html>
  `,
  )
    .setWidth(500)
    .setHeight(hasExistingTrigger ? 770 : 730)
    .setTitle("Auto Run Trigger Setup");

  ui.showModalDialog(html, "Auto Run Trigger Setup");
}

/**
 * ดูสถานะ Trigger ปัจจุบัน
 */
function viewTriggerStatus() {
  const ui = SpreadsheetApp.getUi();
  const triggers = ScriptApp.getProjectTriggers();
  const autoRunTriggers = [];

  // กรองเฉพาะ trigger ของ pullTodayAutoRun
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === "pullTodayAutoRun") {
      autoRunTriggers.push(trigger);
    }
  }

  if (autoRunTriggers.length === 0) {
    ui.alert(
      "⏰ Trigger Status",
      "❌ ไม่มี Auto Run Trigger ที่ตั้งไว้\n\n" +
        "ใช้เมนู: ⏰ Setup Auto Run Trigger\n" +
        "เพื่อตั้งเวลา Auto Pull Today",
      ui.ButtonSet.OK,
    );
    return;
  }

  let message = `📊 Auto Run Triggers: ${autoRunTriggers.length} ตัว\n\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  for (let i = 0; i < autoRunTriggers.length; i++) {
    const trigger = autoRunTriggers[i];
    const uniqueId = trigger.getUniqueId();
    const triggerSource = trigger.getTriggerSource();

    message += `🔹 Trigger #${i + 1}\n`;
    message += `   ID: ${uniqueId}\n`;
    message += `   Source: ${triggerSource}\n`;
    message += `   Function: pullTodayAutoRun\n\n`;
  }

  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  message += `📋 Function: pullTodayAutoRun\n`;
  message += `📊 Process: Phase 1 → ดีเลย์ 10 วินาที → Phase 2 → Sorting\n\n`;
  message += `💡 ใช้ "⏰ Setup Auto Run Trigger" เพื่อแก้ไขเวลา`;

  ui.alert("⏰ Trigger Status", message, ui.ButtonSet.OK);
}

/**
 * ดู Execution Log ล่าสุดของ Auto Run
 * ใช้สำหรับตรวจสอบผลลัพธ์ของ Trigger ที่รันอัตโนมัติ
 */
function viewLatestExecutionLog() {
  const ui = SpreadsheetApp.getUi();
  const logs =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Execution Logs");

  if (!logs || logs.getLastRow() <= 1) {
    ui.alert(
      "📋 Execution Log",
      "❌ ไม่พบ Execution Log\n\n" +
        "Trigger ยังไม่เคยรัน หรือไม่มีข้อมูล Log\n\n" +
        "💡 Log จะถูกบันทึกอัตโนมัติเมื่อ Trigger รัน",
      ui.ButtonSet.OK,
    );
    return;
  }

  // อ่าน log ล่าสุด 5 รายการ
  const lastRow = logs.getLastRow();
  const rowsToRead = Math.min(5, lastRow - 1);
  const logData = logs
    .getRange(lastRow - rowsToRead + 1, 1, rowsToRead, 4)
    .getValues();

  let message = `📋 Execution Log (ล่าสุด ${rowsToRead} รายการ)\n\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  for (let i = logData.length - 1; i >= 0; i--) {
    const row = logData[i];
    const timestamp = row[0]
      ? Utilities.formatDate(
          new Date(row[0]),
          Session.getScriptTimeZone(),
          "yyyy-MM-dd HH:mm:ss",
        )
      : "N/A";
    const functionName = row[1] || "Unknown";
    const status = row[2] || "Unknown";
    const details = row[3] || "No details";

    message += `📅 ${timestamp}\n`;
    message += `📋 Function: ${functionName}\n`;
    message += `สถานะ: ${status}\n`;
    message += `รายละเอียด: ${details}\n\n`;
  }

  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  message += `💡 ดู Log ทั้งหมดได้ที่ Sheet "Execution Logs"`;

  ui.alert("📋 Execution Log", message, ui.ButtonSet.OK);
}

/**
 * บันทึก Execution Log ลงใน Sheet
 * @param {string} functionName - ชื่อฟังก์ชันที่รัน
 * @param {boolean} success - สถานะความสำเร็จ
 * @param {string} details - รายละเอียด
 */
function logExecution(functionName, success, details) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let logSheet = ss.getSheetByName("Execution Logs");

    if (!logSheet) {
      logSheet = ss.insertSheet("Execution Logs");
      logSheet
        .getRange(1, 1, 1, 4)
        .setValues([["Timestamp", "Function", "Status", "Details"]]);
      logSheet
        .getRange(1, 1, 1, 4)
        .setFontWeight("bold")
        .setBackground("#4285F4")
        .setFontColor("#FFFFFF")
        .setHorizontalAlignment("center");
      logSheet.setFrozenRows(1);
    }

    const timestamp = new Date();
    const status = success ? "✅ Success" : "❌ Failed";

    logSheet
      .getRange(logSheet.getLastRow() + 1, 1, 1, 4)
      .setValues([[timestamp, functionName, status, details]]);

    Logger.log(`📋 Execution Logged: ${functionName} - ${status}`);
  } catch (error) {
    Logger.log(`⚠️ Failed to log execution: ${error.message}`);
  }
}

// ============================================
// SORTING FUNCTIONS
// ============================================

/**
 * เรียงลำดับข้อมูลทั้ง 2 ชีท (Trips และ TripDetails)
 * ตาม Trip ID (จากมากไปน้อย) และ Updated At (จากมากไปน้อย)
 */
function sortSheetsByTripIdAndUpdatedAt() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const config = getConfig();

  // Sort Trips Sheet
  const tripsSheet = ss.getSheetByName(config.tripsSheetName);
  if (tripsSheet && tripsSheet.getLastRow() > 1) {
    Logger.log(`🔄 Sorting ${config.tripsSheetName} sheet...`);
    sortSheetByColumns(
      tripsSheet,
      [1, 10], // Column 1 (Trip ID), Column 10 (Updated At)
      [false, false] // Both descending (มาก → น้อย)
    );
    Logger.log(`✅ ${config.tripsSheetName} sorted successfully`);
  } else {
    Logger.log(`⏭️ ${config.tripsSheetName} is empty or not found - skipping`);
  }

  // Sort TripDetails Sheet
  const detailsSheet = ss.getSheetByName(config.tripDetailsSheetName);
  if (detailsSheet && detailsSheet.getLastRow() > 1) {
    Logger.log(`🔄 Sorting ${config.tripDetailsSheetName} sheet...`);
    sortSheetByColumns(
      detailsSheet,
      [1, 12], // Column 1 (Trip ID), Column 12 (Updated At)
      [false, false] // Both descending (มาก → น้อย)
    );
    Logger.log(`✅ ${config.tripDetailsSheetName} sorted successfully`);
  } else {
    Logger.log(`⏭️ ${config.tripDetailsSheetName} is empty or not found - skipping`);
  }
}

/**
 * เรียงลำดับข้อมูลใน Sheet ตามหลาย columns
 * @param {Sheet} sheet - Sheet ที่ต้องการเรียง
 * @param {Array<number>} columnIndices - Array ของ column indices (1-based)
 * @param {Array<boolean>} ascendingOrders - Array ของ ascending/descending (true=asc, false=desc)
 *
 * @example
 * // Sort by Column 1 (Trip ID) desc, then Column 10 (Updated At) desc
 * sortSheetByColumns(sheet, [1, 10], [false, false]);
 */
function sortSheetByColumns(sheet, columnIndices, ascendingOrders) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow <= 1) {
    Logger.log(`⏭️ Sheet has no data to sort`);
    return;
  }

  // อ่านข้อมูลทั้งหมด
  const dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol);
  const data = dataRange.getValues();

  // อ่าน header
  const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  // เรียงลำดับข้อมูล
  data.sort(function(rowA, rowB) {
    for (let i = 0; i < columnIndices.length; i++) {
      const colIndex = columnIndices[i] - 1; // Convert to 0-based
      const isAscending = ascendingOrders[i];

      const valueA = rowA[colIndex];
      const valueB = rowB[colIndex];

      // Handle empty values
      if (valueA === "" || valueA === null || valueA === undefined) {
        return isAscending ? -1 : 1;
      }
      if (valueB === "" || valueB === null || valueB === undefined) {
        return isAscending ? 1 : -1;
      }

      // Try numeric comparison first
      const numA = parseFloat(valueA);
      const numB = parseFloat(valueB);

      if (!isNaN(numA) && !isNaN(numB)) {
        if (numA !== numB) {
          return isAscending ? numA - numB : numB - numA;
        }
      } else {
        // String comparison
        const strA = String(valueA).toLowerCase();
        const strB = String(valueB).toLowerCase();

        if (strA < strB) {
          return isAscending ? -1 : 1;
        }
        if (strA > strB) {
          return isAscending ? 1 : -1;
        }
      }
    }
    return 0;
  });

  // เขียนข้อมูลที่เรียงแล้วกลับไป
  dataRange.setValues(data);

  Logger.log(`✅ Sorted ${lastRow - 1} rows by columns ${columnIndices.join(", ")}`);
}
