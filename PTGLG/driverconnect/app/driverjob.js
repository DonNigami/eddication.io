// ===== File: driverjob.gs =====
/********************************
 * DriverConnect: DRIVER JOB (Search/Update/Alcohol/Review/Close/EndTrip)
 * ✅ ตัด doGet/doPost ออก (ใช้ router.gs)
 * ✅ vehicleDescription มาจาก InputZoile30 เท่านั้น (fallback lookup)
 * ✅ ensureJobdataHasCols_ / Origin by route(3) / Default origin
 * ✅ มี uploadProcessData + processdata header ใหม่ (timestamp..lng)
 * ✅ Close Job: READY/MAINTENANCE + log closejobdata + vehicleDesc
 *
 * ✅ NEW (ตามที่คุยกัน):
 * 1) บันทึก extracost โดยมี reference + vehicle_desc + shipToName + shipToCode อ้างอิง
 * 2) hasPumping / hasTransfer -> บันทึก “จากทุก stop” (ตอน checkout)
 * 3) hillFee / bkkFee / repairFee -> บันทึก “เฉพาะ reference” (ตอน close job) และทำแบบ upsert กันซ้ำ
 * 4) ✅ รองรับ FE ที่ส่ง lng/long/longitude + กัน lat/lng สลับกัน + กันพิกัดตกหล่น (ทุกฟังก์ชันที่เกี่ยวข้อง)
 ********************************/

/********************************
 * Helper: jsonResponse
 ********************************/
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/********************************
 * Helper: format date/time for client
 ********************************/
function formatDateForClient(value) {
  if (!value) return "";
  try {
    if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
      return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    }
    return String(value);
  } catch (e) {
    return "";
  }
}

/********************************
 * ✅ Helper: ensure jobdata has enough columns (ถึง J_COL_LAST)
 ********************************/
function ensureJobdataHasCols_(jobSheet) {
  const needLast = J_COL_LAST;
  const curLast = jobSheet.getLastColumn();
  if (curLast < needLast) {
    jobSheet.insertColumnsAfter(curLast, needLast - curLast);
  }
}

/********************************
 * Helper: haversine meters
 ********************************/
function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  function toRad(x) { return x * Math.PI / 180; }
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/********************************
 * Helper: อ่าน Origin จากชีท Origin ด้วย route 3 ตัวแรก
 * Origin sheet: A=originKey, B=name, C=lat, D=lng, E=radiusMeters, F=routeCode
 ********************************/
function getOriginConfigByRoute(routeRaw) {
  const route = String(routeRaw || "").trim();
  if (!route || route.length < 3) return null;

  const prefix3 = route.substring(0, 3);

  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_ORIGIN);
  if (!sheet) return null;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const values = sheet.getRange(2, 1, lastRow - 1, 6).getValues(); // A-F

  for (let i = 0; i < values.length; i++) {
    const row          = values[i];
    const originKey    = String(row[0] || "").trim();
    const originName   = String(row[1] || "").trim();
    const lat          = parseFloat(row[2]);
    const lng          = parseFloat(row[3]);
    const radiusMeters = parseFloat(row[4]);
    const routeCode    = String(row[5] || "").trim();

    if (!routeCode) continue;

    const routePrefix = routeCode.substring(0, 3);
    if (routePrefix === prefix3) {
      return {
        code:    originKey,
        name:    originName,
        lat:     isNaN(lat)          ? ""   : lat,
        lng:     isNaN(lng)          ? ""   : lng,
        radiusM: isNaN(radiusMeters) ? 200 : radiusMeters
      };
    }
  }
  return null;
}

/********************************
 * Helper: default origin (ใช้แถวแรกของชีท Origin ถ้ามี)
 ********************************/
function getDefaultOriginConfig() {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_ORIGIN);
  if (sheet && sheet.getLastRow() >= 2) {
    const row          = sheet.getRange(2, 1, 1, 5).getValues()[0]; // A-E
    const originKey    = String(row[0] || "").trim();
    const originName   = String(row[1] || "").trim();
    const lat          = parseFloat(row[2]);
    const lng          = parseFloat(row[3]);
    const radiusMeters = parseFloat(row[4]);

    return {
      code:    originKey || "TOP_SR",
      name:    originName || "ไทยออยล์ ศรีราชา",
      lat:     isNaN(lat)          ? ""   : lat,
      lng:     isNaN(lng)          ? ""   : lng,
      radiusM: isNaN(radiusMeters) ? 200 : radiusMeters
    };
  }

  return {
    code:    "TOP_SR",
    name:    "ไทยออยล์ ศรีราชา",
    lat:     "13.1100258",
    lng:     "100.9144418",
    radiusM: 200
  };
}

/********************************
 * Helper: get Station location config by code (from Station sheet)
 * Station: A=stationKey, B=stationKey2, C=name, D=lat, E=lng, F=radiusMeters
 ********************************/
function getLocationConfigByCode(shipToCode) {
  const code = String(shipToCode || "").trim();
  if (!code) return null;

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SHEET_STATION);
  if (!sh) return null;

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return null;

  const values = sh.getRange(2, 1, lastRow - 1, 6).getValues(); // A-F
  for (let i = 0; i < values.length; i++) {
    const r = values[i];
    const key1 = String(r[0] || "").trim();
    const key2 = String(r[1] || "").trim();
    if (key1 === code || key2 === code) {
      const name = String(r[2] || "").trim();
      const lat  = parseFloat(r[3]);
      const lng  = parseFloat(r[4]);
      const rad  = parseFloat(r[5]);
      return {
        code: code,
        name: name,
        lat: isNaN(lat) ? "" : lat,
        lng: isNaN(lng) ? "" : lng,
        radiusM: isNaN(rad) ? 50 : rad
      };
    }
  }
  return null;
}

/********************************
 * ✅ vehicle_desc อยู่แค่ InputZoile30
 ********************************/
function getVehicleDescFromInputByReference_(zoSS, ref) {
  try {
    const keyword = String(ref || "").trim();
    if (!keyword) return "";

    const sh = zoSS.getSheetByName(ZOILE_SHEET_INPUT);
    if (!sh) return "";

    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();
    if (lastRow < 2) return "";

    const values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
    for (let i = 0; i < values.length; i++) {
      const r = values[i];
      const refNo = String(r[ZI_COL_REFERENCE - 1] || "").trim();
      if (refNo === keyword) {
        return String(r[ZI_COL_VEHICLE_DESC - 1] || "").trim();
      }
    }
    return "";
  } catch (err) {
    Logger.log("[getVehicleDescFromInputByReference_] error: " + err);
    return "";
  }
}

/* ======================================================================
 * ✅ NEW: EXTRACOST (ตาม requirement ล่าสุด)
 * - hasPumping / hasTransfer -> บันทึกทุก stop ตอน checkout
 * - hillFee / bkkFee / repairFee -> บันทึกเฉพาะ reference ตอน closejob (upsert)
 * - ✅ กัน FE ส่ง lng/long/longitude และกัน lat/lng สลับกัน (ทุกฟังก์ชัน)
 * ====================================================================== */

/********************************
 * ✅ parseLng_ รองรับ lng / long / longitude (คงไว้เพื่อ compatibility)
 ********************************/
function parseLng_(p) {
  const v = (p.lng !== undefined && p.lng !== "") ? p.lng
          : (p.long !== undefined && p.long !== "") ? p.long
          : (p.longitude !== undefined && p.longitude !== "") ? p.longitude
          : "";
  const n = (v === "" || v === null) ? NaN : parseFloat(v);
  return n;
}

/********************************
 * ✅ parseLatLngFlexible_
 * - รองรับ: lat/lng/long/longitude
 * - รองรับเคส FE ส่งสลับ lat<->lng (range check + auto swap)
 ********************************/
function parseLatLngFlexible_(p) {
  const rawLat = (p.lat !== undefined && p.lat !== "") ? p.lat : "";
  const rawLng = (p.lng !== undefined && p.lng !== "") ? p.lng
              : (p.long !== undefined && p.long !== "") ? p.long
              : (p.longitude !== undefined && p.longitude !== "") ? p.longitude
              : "";

  let lat = (rawLat === "" || rawLat === null) ? NaN : parseFloat(rawLat);
  let lng = (rawLng === "" || rawLng === null) ? NaN : parseFloat(rawLng);

  return normalizeLatLng_(lat, lng);
}

function normalizeLatLng_(lat, lng) {
  const isNum = (n) => typeof n === "number" && !isNaN(n);
  const inLatRange = (n) => isNum(n) && Math.abs(n) <= 90;
  const inLngRange = (n) => isNum(n) && Math.abs(n) <= 180;

  if (!isNum(lat) || !isNum(lng)) {
    return { lat: lat, lng: lng, ok: false, reason: "lat/lng not number" };
  }

  // ถูกต้องอยู่แล้ว
  if (inLatRange(lat) && inLngRange(lng)) {
    return { lat: lat, lng: lng, ok: true, swapped: false };
  }

  // ลองสลับ
  if (inLatRange(lng) && inLngRange(lat)) {
    return { lat: lng, lng: lat, ok: true, swapped: true };
  }

  return { lat: lat, lng: lng, ok: false, reason: "lat/lng out of range" };
}

/********************************
 * ✅ normalizeBoolish_ : ทำให้ hasPumping/hasTransfer เป็นมาตรฐาน
 ********************************/
function normalizeBoolish_(v) {
  const s = String(v || "").trim().toLowerCase();
  if (!s) return "";
  if (["1","true","yes","y","มี","ใช่"].indexOf(s) !== -1) return "YES";
  if (["0","false","no","n","ไม่มี","ไม่"].indexOf(s) !== -1) return "NO";
  return String(v || "").trim();
}

/********************************
 * ✅ ensureExtracostSheet_
 * Header:
 * timestamp, actionType, reference, rowIndex, userId,
 * shipToName, shipToCode, vehicle_desc,
 * lat, lng,
 * hasPumping, hasTransfer,
 * hillFee, bkkFee, repairFee
 ********************************/
function ensureExtracostSheet_(ss) {
  const sheetName = (typeof SHEET_EXTRACOST !== "undefined" && SHEET_EXTRACOST)
    ? SHEET_EXTRACOST
    : "extracost";

  let sh = ss.getSheetByName(sheetName);
  if (!sh) sh = ss.insertSheet(sheetName);

  const headers = [
    "timestamp","actionType","reference","rowIndex","userId",
    "shipToName","shipToCode","vehicle_desc",
    "lat","lng",
    "hasPumping","hasTransfer",
    "hillFee","bkkFee","repairFee"
  ];

  if (sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    if (sh.getLastColumn() < headers.length) {
      sh.insertColumnsAfter(sh.getLastColumn(), headers.length - sh.getLastColumn());
    }
    const cur = sh.getRange(1, 1, 1, headers.length).getValues()[0]
      .map(x => String(x || "").trim().toLowerCase());
    const need = headers.map(x => String(x).trim().toLowerCase());
    const same = need.every((h, i) => cur[i] === h);
    if (!same) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  return sh;
}

/********************************
 * ✅ logExtracostStop_ : บันทึก “ทุก stop” ตอน checkout
 ********************************/
function logExtracostStop_(ctx) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ensureExtracostSheet_(ss);

  sh.appendRow([
    formatDateForClient(ctx.now),
    "checkout",
    ctx.reference,
    ctx.rowIndex,
    ctx.userId,
    ctx.shipToName,
    ctx.shipToCode,
    ctx.vehicleDesc,
    (isNaN(ctx.lat) ? "" : ctx.lat),
    (isNaN(ctx.lng) ? "" : ctx.lng),
    ctx.hasPumping,
    ctx.hasTransfer,
    "", "", ""
  ]);
}

/********************************
 * ✅ upsertExtracostReference_ : บันทึก “เฉพาะ reference” ตอน closejob
 * - หาแถว actionType=closejob และ reference ตรงกัน ถ้ามี update
 * - ถ้าไม่มีก็ append ใหม่
 ********************************/
function upsertExtracostReference_(ctx) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ensureExtracostSheet_(ss);

  const lastRow = sh.getLastRow();
  let targetRow = 0;

  if (lastRow >= 2) {
    // อ่านเฉพาะคอลัมน์ actionType(2), reference(3)
    const look = sh.getRange(2, 2, lastRow - 1, 2).getValues(); // B-C
    for (let i = look.length - 1; i >= 0; i--) {
      const actionType = String(look[i][0] || "").trim().toLowerCase();
      const ref = String(look[i][1] || "").trim();
      if (actionType === "closejob" && ref === ctx.reference) {
        targetRow = i + 2;
        break;
      }
    }
  }

  const rowValues = [
    formatDateForClient(ctx.now),
    "closejob",
    ctx.reference,
    "",                 // rowIndex (reference-level)
    ctx.userId,
    ctx.shipToName,
    ctx.shipToCode,
    ctx.vehicleDesc,
    "", "",             // lat/lng
    "", "",             // hasPumping/hasTransfer (ไม่ใช่ reference-level)
    ctx.hillFee,
    ctx.bkkFee,
    ctx.repairFee
  ];

  if (targetRow) {
    sh.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sh.appendRow(rowValues);
  }
}

/********************************
 * handleSearchShipment
 ********************************/
function handleSearchShipment(e) {
  try {
    const keyword = (e.parameter.keyword || "").trim();
    const userId  = (e.parameter.userId || "").trim();

    if (!keyword) {
      return jsonResponse({ success: false, message: "กรุณาใส่เลข Reference" });
    }

    // ✅ ตรวจสิทธิ์คนขับก่อน
    if (userId) {
      const status = getUserStatus(userId);
      if (status !== "APPROVED") {
        return jsonResponse({ success: false, message: "คุณยังไม่ได้รับอนุมัติให้ใช้งานระบบ" });
      }
    }

    const zoSS = SpreadsheetApp.openById(ZOILE_SHEET_ID);

    function loadSheetValues(sheetName) {
      const sheet = zoSS.getSheetByName(sheetName);
      if (!sheet) return null;
      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      if (lastRow < 2) return null;
      const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
      return { sheet, values, lastRow, lastCol };
    }

    function getZoileCols(sourceType) {
      if (sourceType === "input") {
        return {
          SHIPMENT:      ZI_COL_SHIPMENT,
          DRIVER_NAME:   ZI_COL_DRIVER_NAME,
          DISTANCE:      ZI_COL_DISTANCE,
          REFERENCE:     ZI_COL_REFERENCE,
          SHIP_TO_CODE:  ZI_COL_SHIP_TO_CODE,
          SHIP_TO_NAME:  ZI_COL_SHIP_TO_NAME,
          MATERIAL:      ZI_COL_MATERIAL,
          MATERIAL_DESC: ZI_COL_MATERIAL_DESC,
          DELIVERY_QTY:  ZI_COL_DELIVERY_QTY,
          ROUTE:         ZI_COL_ROUTE,
          VEHICLE_DESC:  ZI_COL_VEHICLE_DESC
        };
      }
      return {
        SHIPMENT:      Z_COL_SHIPMENT,
        DRIVER_NAME:   Z_COL_DRIVER_NAME,
        DISTANCE:      Z_COL_DISTANCE,
        REFERENCE:     Z_COL_REFERENCE,
        SHIP_TO_CODE:  Z_COL_SHIP_TO_CODE,
        SHIP_TO_NAME:  Z_COL_SHIP_TO_NAME,
        MATERIAL:      Z_COL_MATERIAL,
        MATERIAL_DESC: Z_COL_MATERIAL_DESC,
        DELIVERY_QTY:  Z_COL_DELIVERY_QTY,
        ROUTE:         Z_COL_ROUTE,
        VEHICLE_DESC:  Z_COL_VEHICLE_DESC
      };
    }

    function findRowsByReference(values, refColIndex, refKeyword) {
      const matches = [];
      let firstIdx  = -1;
      const target  = String(refKeyword).trim();
      for (let i = 0; i < values.length; i++) {
        const referenceNo = String(values[i][refColIndex - 1] || "").trim();
        if (referenceNo === target) {
          if (firstIdx === -1) firstIdx = i;
          matches.push({ index: i, row: values[i] });
        }
      }
      return { firstIdx, matches };
    }

    // ---------- 1. ค้นหา: InputZoile30 ➜ data ----------
    let sourceType   = "input";
    let dataInfo     = loadSheetValues(ZOILE_SHEET_INPUT);
    let cols         = getZoileCols(sourceType);
    let zoValues     = dataInfo ? dataInfo.values : [];
    let searchResult = dataInfo
      ? findRowsByReference(zoValues, cols.REFERENCE, keyword)
      : { firstIdx: -1, matches: [] };

    // ถ้าไม่เจอใน input → ลองชีท data
    if (searchResult.firstIdx === -1) {
      const dataInfo2 = loadSheetValues(ZOILE_SHEET_DATA);
      if (dataInfo2) {
        const dataCols   = getZoileCols("data");
        const searchData = findRowsByReference(dataInfo2.values, dataCols.REFERENCE, keyword);
        if (searchData.firstIdx !== -1) {
          sourceType   = "data";
          dataInfo     = dataInfo2;
          zoValues     = dataInfo2.values;
          cols         = dataCols;
          searchResult = searchData;
        }
      }
    }

    if (searchResult.firstIdx === -1) {
      return jsonResponse({
        success: false,
        message: "ไม่พบข้อมูลเลข Reference นี้ใน zoile30Connect (ทั้งชีท InputZoile30 และ data)"
      });
    }

    const targetReference = keyword;
    const zoRowsForRef    = searchResult.matches;

    if (zoRowsForRef.length === 0) {
      return jsonResponse({ success: false, message: "ไม่พบข้อมูลปลายทางสำหรับ Reference นี้ใน zoile30Connect" });
    }

    // ✅ FIX: vehicle_desc มีเฉพาะ InputZoile30 → ถ้า source เป็น data ให้ lookup จาก input เสมอ
    let vehicleDescription = "";
    if (cols.VEHICLE_DESC && cols.VEHICLE_DESC > 0) {
      vehicleDescription = String(zoRowsForRef[0].row[cols.VEHICLE_DESC - 1] || "").trim();
    }
    if (!vehicleDescription) {
      vehicleDescription = getVehicleDescFromInputByReference_(zoSS, targetReference);
    }

    // ---------- 2. ดึงรายชื่อคนขับ ----------
    let driverRaw = "";
    for (let i = 0; i < zoRowsForRef.length; i++) {
      const r = zoRowsForRef[i].row;
      const d = String(r[cols.DRIVER_NAME - 1] || "").trim();
      if (d) { driverRaw = d; break; }
    }
    let drivers = [];
    if (driverRaw) drivers = driverRaw.split("/").map(s => s.trim()).filter(Boolean);

    // ---------- 3. Aggregate ปลายทาง/สินค้า ----------
    // ✅ FIX: สร้าง map shipToName -> shipToCode ก่อน เพื่อ copy ค่าให้ row ที่ไม่มี shipToCode
    const shipToNameToCodeMap = {};
    zoRowsForRef.forEach(obj => {
      const row = obj.row;
      const shipToCode = String(row[cols.SHIP_TO_CODE - 1] || "").trim();
      const shipToName = String(row[cols.SHIP_TO_NAME - 1] || "").trim();
      if (shipToCode && shipToName && !shipToNameToCodeMap[shipToName]) {
        shipToNameToCodeMap[shipToName] = shipToCode;
      }
    });

    const stationAgg = {};
    zoRowsForRef.forEach(obj => {
      const row = obj.row;

      let shipToCode   = String(row[cols.SHIP_TO_CODE   - 1] || "").trim();
      const shipToName = String(row[cols.SHIP_TO_NAME   - 1] || "").trim();
      const material   = String(row[cols.MATERIAL       - 1] || "").trim();
      const materialDesc = String(row[cols.MATERIAL_DESC  - 1] || "").trim();
      const qtyRaw     = row[cols.DELIVERY_QTY - 1];
      const qty        = parseFloat(qtyRaw || 0) || 0;

      const distanceRaw = row[cols.DISTANCE - 1];
      const distanceKm  = (distanceRaw !== "" && distanceRaw != null) ? parseFloat(distanceRaw) : "";

      // ✅ FIX: ถ้าไม่มี shipToCode แต่มี shipToName ที่ match กับค่าอื่น ให้ copy มาใช้
      if (!shipToCode && shipToName && shipToNameToCodeMap[shipToName]) {
        shipToCode = shipToNameToCodeMap[shipToName];
      }

      const stationKey = shipToCode || ("NAME:" + shipToName);

      if (!stationAgg[stationKey]) {
        stationAgg[stationKey] = {
          shipToCode: shipToCode,
          shipToName: shipToName,
          totalQty:   0,
          linesCount: 0,
          materials:  {},
          distanceKm: distanceKm
        };
      }

      const agg = stationAgg[stationKey];
      agg.totalQty   += qty;
      agg.linesCount += 1;

      if ((agg.distanceKm === "" || agg.distanceKm == null) && distanceKm !== "") {
        agg.distanceKm = distanceKm;
      }

      const matKey = material || materialDesc || "UNKNOWN";
      if (!agg.materials[matKey]) {
        agg.materials[matKey] = { material, materialDesc, totalQty: 0 };
      }
      agg.materials[matKey].totalQty += qty;
    });

    // ---------- 4. jobdata ----------
    const mainSS   = SpreadsheetApp.openById(SHEET_ID);
    const jobSheet = mainSS.getSheetByName(SHEET_JOBDATA);
    if (!jobSheet) return jsonResponse({ success: false, message: "ไม่พบชีท jobdata ในไฟล์หลัก" });

    ensureJobdataHasCols_(jobSheet);

    const jobLastRow = jobSheet.getLastRow();
    let jobValues = [];
    if (jobLastRow > 1) jobValues = jobSheet.getRange(2, 1, jobLastRow - 1, J_COL_LAST).getValues();

    let jobRowsForRef = [];
    if (jobValues.length > 0) {
      jobValues.forEach((row, idx) => {
        const ref = String(row[J_COL_REFERENCE - 1] || "").trim();
        if (ref === targetReference) jobRowsForRef.push({ rowIndex: idx + 2, row });
      });
    }

    // 2.4 PATCH: เติม vehicle_desc ให้ jobdata เดิม (ถ้ายังว่าง)
    if (typeof J_COL_VEHICLE_DESC !== "undefined" && J_COL_VEHICLE_DESC > 0) {
      if (!vehicleDescription) vehicleDescription = getVehicleDescFromInputByReference_(zoSS, targetReference);

      if (vehicleDescription && jobRowsForRef && jobRowsForRef.length > 0) {
        jobRowsForRef.forEach(info => {
          const rowIdx = info.rowIndex;
          const row = jobSheet.getRange(rowIdx, 1, 1, J_COL_LAST).getValues()[0];
          const oldVal = String(row[J_COL_VEHICLE_DESC - 1] || "").trim();
          if (!oldVal) {
            row[J_COL_VEHICLE_DESC - 1] = vehicleDescription;
            jobSheet.getRange(rowIdx, 1, 1, J_COL_LAST).setValues([row]);
          }
        });
        SpreadsheetApp.flush();
      }
    }

    // ✅ 4.1 ถ้ายังไม่มีก็สร้าง jobdata จาก zoile (origin + ปลายทาง)
    if (jobRowsForRef.length === 0) {
      const now        = new Date();
      const stationMap = {};

      // ✅ FIX: สร้าง map shipToName -> shipToCode เพื่อ copy ค่าให้ row ที่ไม่มี shipToCode
      const shipToNameToCode = {};
      zoRowsForRef.forEach(obj => {
        const row        = obj.row;
        const shipToCode = String(row[cols.SHIP_TO_CODE - 1] || "").trim();
        const shipToName = String(row[cols.SHIP_TO_NAME - 1] || "").trim();
        // ถ้ามี shipToCode และยังไม่เคย map กับ shipToName นี้ ให้บันทึก
        if (shipToCode && shipToName && !shipToNameToCode[shipToName]) {
          shipToNameToCode[shipToName] = shipToCode;
        }
      });

      zoRowsForRef.forEach(obj => {
        const row        = obj.row;
        const zoRowIndex = obj.index + 2;

        let shipToCode = String(row[cols.SHIP_TO_CODE - 1] || "").trim();
        const shipToName = String(row[cols.SHIP_TO_NAME - 1] || "").trim();

        const distanceRaw = row[cols.DISTANCE - 1];
        const distanceKm  = (distanceRaw !== "" && distanceRaw != null) ? parseFloat(distanceRaw) : "";

        // ✅ FIX: ถ้าไม่มี shipToCode แต่มี shipToName ที่ match กับค่าอื่น ให้ copy มาใช้
        if (!shipToCode && shipToName && shipToNameToCode[shipToName]) {
          shipToCode = shipToNameToCode[shipToName];
        }

        if (!shipToCode) {
          const fallbackKey = "NO_CODE_" + zoRowIndex;
          if (!stationMap[fallbackKey]) {
            stationMap[fallbackKey] = { row, zoRowIndex, shipToCode: "", shipToName, isFallback: true, distanceKm };
          }
          return;
        }

        if (!stationMap[shipToCode]) {
          stationMap[shipToCode] = { row, zoRowIndex, shipToCode, shipToName, isFallback: false, distanceKm };
        }
      });

      if (zoRowsForRef.length > 0) {
        const firstRow       = zoRowsForRef[0].row;
        const shipmentNoOri  = String(firstRow[cols.SHIPMENT  - 1] || "").trim();
        const referenceNoOri = String(firstRow[cols.REFERENCE - 1] || "").trim();

        let routeValue = "";
        if (cols.ROUTE && cols.ROUTE > 0) routeValue = String(firstRow[cols.ROUTE - 1] || "").trim();

        let originConfig = null;
        if (routeValue && routeValue.length >= 3) originConfig = getOriginConfigByRoute(routeValue);
        if (!originConfig) originConfig = getDefaultOriginConfig();

        const originRow = new Array(J_COL_LAST).fill("");
        originRow[J_COL_REFERENCE - 1]   = referenceNoOri;
        originRow[J_COL_SHIPMENT - 1]    = shipmentNoOri;
        originRow[J_COL_SHIPTO_CODE - 1] = originConfig.code;
        originRow[J_COL_SHIPTO_NAME - 1] = originConfig.name;
        originRow[J_COL_STATUS - 1]      = "NEW";
        originRow[J_COL_CREATED_AT - 1]  = now;
        originRow[J_COL_UPDATED_AT - 1]  = now;
        originRow[J_COL_DEST_LAT - 1]    = originConfig.lat;
        originRow[J_COL_DEST_LNG - 1]    = originConfig.lng;
        originRow[J_COL_RADIUS_M - 1]    = originConfig.radiusM;
        originRow[J_COL_SOURCE_ROW - 1]  = "";
        if (typeof J_COL_VEHICLE_DESC !== "undefined" && J_COL_VEHICLE_DESC > 0) {
          originRow[J_COL_VEHICLE_DESC - 1] = vehicleDescription || "";
        }
        jobSheet.getRange(jobSheet.getLastRow() + 1, 1, 1, J_COL_LAST).setValues([originRow]);
      }

      Object.keys(stationMap).forEach(key => {
        const entry      = stationMap[key];
        const row        = entry.row;
        const zoRowIndex = entry.zoRowIndex;

        const shipmentNo  = String(row[cols.SHIPMENT  - 1] || "").trim();
        const referenceNo = String(row[cols.REFERENCE - 1] || "").trim();
        const shipToCode  = entry.isFallback ? "" : String(row[cols.SHIP_TO_CODE - 1] || "").trim();
        const shipToName  = String(row[cols.SHIP_TO_NAME - 1] || "").trim();
        const distanceKm  = entry.distanceKm;

        const loc     = shipToCode ? getLocationConfigByCode(shipToCode) : null;
        const destLat = loc ? loc.lat : "";
        const destLng = loc ? loc.lng : "";
        const radiusM = (loc && !isNaN(loc.radiusM)) ? loc.radiusM : 50;

        const destRow = new Array(J_COL_LAST).fill("");
        destRow[J_COL_REFERENCE - 1]   = referenceNo;
        destRow[J_COL_SHIPMENT - 1]    = shipmentNo;
        destRow[J_COL_SHIPTO_CODE - 1] = shipToCode;
        destRow[J_COL_SHIPTO_NAME - 1] = shipToName;
        destRow[J_COL_STATUS - 1]      = "NEW";
        destRow[J_COL_SOURCE_ROW - 1]  = zoRowIndex;
        destRow[J_COL_CREATED_AT - 1]  = now;
        destRow[J_COL_UPDATED_AT - 1]  = now;
        destRow[J_COL_DEST_LAT - 1]    = destLat;
        destRow[J_COL_DEST_LNG - 1]    = destLng;
        destRow[J_COL_RADIUS_M - 1]    = radiusM;
        destRow[J_COL_DISTANCE_KM - 1] = distanceKm;

        if (typeof J_COL_VEHICLE_DESC !== "undefined" && J_COL_VEHICLE_DESC > 0) {
          destRow[J_COL_VEHICLE_DESC - 1] = vehicleDescription || "";
        }

        jobSheet.getRange(jobSheet.getLastRow() + 1, 1, 1, J_COL_LAST).setValues([destRow]);
      });

      const newJobLastRow = jobSheet.getLastRow();
      const newJobValues  = jobSheet.getRange(2, 1, newJobLastRow - 1, J_COL_LAST).getValues();

      jobRowsForRef = [];
      newJobValues.forEach((row, idx) => {
        const ref = String(row[J_COL_REFERENCE - 1] || "").trim();
        if (ref === targetReference) jobRowsForRef.push({ rowIndex: idx + 2, row });
      });
    }

    if (jobRowsForRef.length === 0) {
      return jsonResponse({ success: false, message: "ไม่พบข้อมูลใน jobdata หลัง copy จาก zoile30Connect" });
    }

    // ---------- 5. jobClosed / tripEnded flag ----------
    const jobClosed = jobRowsForRef.every(obj => {
      const row      = obj.row;
      const status   = String(row[J_COL_STATUS - 1] || "").trim().toUpperCase();
      const closedAt = row[J_COL_JOB_CLOSED_AT - 1];
      return status === "JOB_DONE" || !!closedAt;
    });

    const tripEnded = jobRowsForRef.every(obj => {
      const row         = obj.row;
      const tripEndedAt = row[J_COL_TRIP_ENDED_AT - 1];
      return !!tripEndedAt;
    });

    // ---------- 6. รายชื่อคนขับที่ตรวจแอลกอฮอล์แล้ว ----------
    let checkedDrivers = [];
    if (drivers.length > 0) {
      const ss = SpreadsheetApp.openById(SHEET_ID);
      const alcoSheet = ss.getSheetByName(SHEET_ALCOHOL);
      if (alcoSheet) {
        const last = alcoSheet.getLastRow();
        if (last > 1) {
          const data = alcoSheet.getRange(2, 1, last - 1, 2).getValues();
          checkedDrivers = data
            .filter(r => String(r[0] || "").trim() === targetReference)
            .map(r => String(r[1] || "").trim())
            .filter(Boolean);
        }
      }
      checkedDrivers = Array.from(new Set(checkedDrivers));
    }

    // ---------- 7. สร้าง stops ----------
    const stops       = [];
    const shipmentSet = {};
    const stationSeen = {};

    jobRowsForRef.forEach(obj => {
      const row      = obj.row;
      const rowIndex = obj.rowIndex;

      const referenceNo = String(row[J_COL_REFERENCE   - 1] || "").trim();
      const shipmentNo  = String(row[J_COL_SHIPMENT    - 1] || "").trim();
      const shipToCode  = String(row[J_COL_SHIPTO_CODE - 1] || "").trim();
      const shipToName  = String(row[J_COL_SHIPTO_NAME - 1] || "").trim();
      const status      = String(row[J_COL_STATUS      - 1] || "").trim();

      const checkIn     = row[J_COL_CHECKIN           - 1];
      const checkOut    = row[J_COL_CHECKOUT          - 1];
      const fueling     = row[J_COL_FUELING_TIME      - 1];
      const unloadDone  = row[J_COL_UNLOAD_DONE_TIME  - 1];
      const reviewed    = row[J_COL_REVIEWED_TIME     - 1];
      const processT    = (typeof J_COL_PROCESSDATA_TIME !== "undefined" && J_COL_PROCESSDATA_TIME > 0)
        ? row[J_COL_PROCESSDATA_TIME - 1]
        : "";

      const distanceKm  = row[J_COL_DISTANCE_KM       - 1];
      const checkInOdo  = row[J_COL_CHECKIN_ODO       - 1];

      const destLat     = row[J_COL_DEST_LAT          - 1];
      const destLng     = row[J_COL_DEST_LNG          - 1];

      const sourceRow    = row[J_COL_SOURCE_ROW       - 1];
      const isOriginStop = !sourceRow;

      if (shipmentNo) shipmentSet[shipmentNo] = true;

      const stationKey = shipToCode || ("NAME:" + shipToName);

      if (stationSeen[stationKey] && !isOriginStop) return;
      stationSeen[stationKey] = true;

      const agg = stationAgg[stationKey] || null;
      const materialsArray = agg
        ? Object.keys(agg.materials).map(k => agg.materials[k])
        : [];

      stops.push({
        seq:            0,
        shipmentNo:     shipmentNo,
        referenceNo:    referenceNo,
        destination1:   shipToCode,
        destination2:   shipToName,
        status:         status,
        checkInTime:    formatDateForClient(checkIn),
        checkOutTime:   formatDateForClient(checkOut),
        fuelingTime:    formatDateForClient(fueling),
        unloadDoneTime: formatDateForClient(unloadDone),
        reviewedTime:   formatDateForClient(reviewed),
        processdataTime: formatDateForClient(processT),
        distanceKm:     distanceKm,
        checkInOdo:     checkInOdo,
        rowIndex:       rowIndex,
        totalQty:       agg ? agg.totalQty : null,
        linesCount:     agg ? agg.linesCount : 0,
        materials:      materialsArray,
        isOriginStop:   isOriginStop,
        destLat:        destLat,
        destLng:        destLng
      });
    });

    stops.forEach((s, i) => { s.seq = i + 1; });

    const shipmentList = Object.keys(shipmentSet);

    return jsonResponse({
      success: true,
      data: {
        referenceNo: targetReference,
        shipmentNos: shipmentList,
        shipmentNo:  shipmentList.length === 1 ? shipmentList[0] : "",
        vehicleDescription: vehicleDescription,
        totalStops:  stops.length,
        stops:       stops,
        alcohol: {
          drivers:        drivers,
          checkedDrivers: checkedDrivers
        },
        jobClosed: jobClosed,
        tripEnded: tripEnded
      }
    });

  } catch (err) {
    Logger.log("handleSearchShipment error: " + err);
    return jsonResponse({ success: false, message: "SERVER_ERROR: " + err });
  }
}

/********************************
 * Helper: เป่าแอลกอฮอล์อย่างน้อย 1 คนแล้วหรือยัง (ตาม reference)
 * (A=reference, B=driverName)
 ********************************/
function hasAtLeastOneAlcoholChecked(reference) {
  const ref = String(reference || "").trim();
  if (!ref) return false;

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_ALCOHOL);
  if (!sheet) return false;

  const last = sheet.getLastRow();
  if (last < 2) return false;

  const rows = sheet.getRange(2, 1, last - 1, 1).getValues();
  return rows.some(r => String(r[0] || "").trim() === ref);
}

/********************************
 * handleUpdateStop
 ********************************/
function handleUpdateStop(e) {
  try {
    const rowIndex      = parseInt(e.parameter.rowIndex, 10);
    const newStatus     = (e.parameter.status || "").trim();
    const actionTypeRaw = (e.parameter.type   || "").trim();
    const actionType    = actionTypeRaw.toLowerCase();
    const userId        = (e.parameter.userId || "").trim();

    // ✅ NEW: อ่าน lat/lng แบบยืดหยุ่น + กันสลับ
    const ll = parseLatLngFlexible_(e.parameter);
    const lat = ll.lat;
    const lng = ll.lng;

    const odoRaw        = (e.parameter.odo || "").trim();

    const receiverName = (e.parameter.receiverName || "").trim();
    const receiverType = (e.parameter.receiverType || "").trim();

    // ✅ NEW: hasPumping/hasTransfer จาก FE (บันทึกตอน checkout ทุก stop)
    const hasPumping  = normalizeBoolish_(e.parameter.hasPumping);
    const hasTransfer = normalizeBoolish_(e.parameter.hasTransfer);

    if (!rowIndex || !newStatus || !actionType) {
      return jsonResponse({ success: false, message: "ข้อมูลไม่ครบ (rowIndex/status/type)" });
    }

    if (actionType === "checkin" && !odoRaw) {
      return jsonResponse({ success: false, message: "กรุณากรอกเลขไมล์รถก่อน Check-in" });
    }

    if (!ll.ok) {
      return jsonResponse({ success: false, message: "ไม่สามารถอ่านพิกัดจากอุปกรณ์ได้ (lat/lng ผิดรูปแบบ)" });
    }

    if (!userId) {
      return jsonResponse({ success: false, message: "ไม่พบ userId" });
    }

    const status = getUserStatus(userId);
    if (status !== "APPROVED") {
      return jsonResponse({ success: false, message: "คุณยังไม่ได้รับอนุมัติให้ใช้งานระบบ" });
    }

    const mainSS   = SpreadsheetApp.openById(SHEET_ID);
    const jobSheet = mainSS.getSheetByName(SHEET_JOBDATA);
    if (!jobSheet) return jsonResponse({ success: false, message: "ไม่พบชีท jobdata ในไฟล์หลัก" });

    ensureJobdataHasCols_(jobSheet);

    const lastRow = jobSheet.getLastRow();
    if (rowIndex < 2 || rowIndex > lastRow) {
      return jsonResponse({ success: false, message: "rowIndex ไม่ถูกต้อง" });
    }

    const now       = new Date();
    const rowValues = jobSheet.getRange(rowIndex, 1, 1, J_COL_LAST).getValues()[0];
    const referenceInRow = String(rowValues[J_COL_REFERENCE - 1] || "").trim();
    const sourceRow      = rowValues[J_COL_SOURCE_ROW - 1];
    const isOriginStop   = !sourceRow;

    if (actionType === "checkin" && !isOriginStop) {
      const allowedTypes = ["manager", "frontHasCard", "frontNoCard"];
      if (!receiverName) return jsonResponse({ success: false, message: "กรุณากรอกชื่อผู้รับน้ำมัน" });
      if (!receiverType) return jsonResponse({ success: false, message: "กรุณาเลือกประเภทผู้รับน้ำมัน" });
      if (allowedTypes.indexOf(receiverType) === -1) {
        return jsonResponse({ success: false, message: "ประเภทผู้รับน้ำมันไม่ถูกต้อง" });
      }
    }

    if (actionType === "checkin" && isOriginStop) {
      if (!hasAtLeastOneAlcoholChecked(referenceInRow)) {
        return jsonResponse({ success: false, message: "กรุณาเป่าแอลกอฮอล์อย่างน้อย 1 คนก่อนเช็คอินต้นทาง" });
      }
    }

    const destLat   = parseFloat(rowValues[J_COL_DEST_LAT - 1]);
    const destLng   = parseFloat(rowValues[J_COL_DEST_LNG - 1]);
    const radiusM   = parseFloat(rowValues[J_COL_RADIUS_M - 1]);
    let finalRadius = (!isNaN(radiusM) && radiusM > 0) ? radiusM : 50;

    if (!isNaN(destLat) && !isNaN(destLng)) {
      const distance = haversineDistanceMeters(destLat, destLng, lat, lng);
      if (distance > finalRadius) {
        return jsonResponse({
          success: false,
          message:
            "คุณอยู่นอกพื้นที่ที่กำหนด (ห่างจากจุดหมาย " +
            Math.round(distance) +
            " เมตร / รัศมีอนุญาต " +
            Math.round(finalRadius) +
            " เมตร)"
        });
      }
    } else {
      finalRadius = 50;
    }

    jobSheet.getRange(rowIndex, J_COL_STATUS).setValue(newStatus);
    jobSheet.getRange(rowIndex, J_COL_UPDATED_BY).setValue(userId);
    jobSheet.getRange(rowIndex, J_COL_UPDATED_AT).setValue(now);

    if (actionType === "checkin") {
      jobSheet.getRange(rowIndex, J_COL_CHECKIN).setValue(now);
      jobSheet.getRange(rowIndex, J_COL_CHECKIN_LAT).setValue(lat);
      jobSheet.getRange(rowIndex, J_COL_CHECKIN_LNG).setValue(lng);
      jobSheet.getRange(rowIndex, J_COL_CHECKIN_ODO).setValue(odoRaw);

      // ✅ เขียน processdata เฉพาะปลายทาง + ยังไม่เคยเขียน
      if (!isOriginStop) {
        const existingPdTime = (typeof J_COL_PROCESSDATA_TIME !== "undefined" && J_COL_PROCESSDATA_TIME > 0)
          ? jobSheet.getRange(rowIndex, J_COL_PROCESSDATA_TIME).getValue()
          : "";

        if (!existingPdTime) {
          const shipToCode = String(rowValues[J_COL_SHIPTO_CODE - 1] || "").trim();
          const shipToName = String(rowValues[J_COL_SHIPTO_NAME - 1] || "").trim();

          const pdRes = uploadProcessData({
            reference: referenceInRow,
            shipToCode: shipToCode,
            shipToName: shipToName,
            rowIndex: rowIndex,
            userId: userId,
            receiverName: receiverName,
            receiverType: receiverType,
            lat: lat,
            lng: lng
          });

          if (pdRes && pdRes.success) {
            if (typeof J_COL_PROCESSDATA_TIME !== "undefined" && J_COL_PROCESSDATA_TIME > 0) {
              jobSheet.getRange(rowIndex, J_COL_PROCESSDATA_TIME).setValue(now);
            }
          } else {
            return jsonResponse({
              success: false,
              message: (pdRes && pdRes.message) ? pdRes.message : "บันทึกข้อมูลผู้รับน้ำมันไม่สำเร็จ"
            });
          }
        }
      }

    } else if (actionType === "checkout") {
      jobSheet.getRange(rowIndex, J_COL_CHECKOUT).setValue(now);
      jobSheet.getRange(rowIndex, J_COL_CHECKOUT_LAT).setValue(lat);
      jobSheet.getRange(rowIndex, J_COL_CHECKOUT_LNG).setValue(lng);

      // ✅ NEW: extracost stop-level (ทุก stop)
      // ต้องมี reference + vehicle_desc + shipToName + shipToCode
      let vehicleDescToUse = "";
      try {
        const zoSS = SpreadsheetApp.openById(ZOILE_SHEET_ID);
        vehicleDescToUse = getVehicleDescFromInputByReference_(zoSS, referenceInRow) || "";
      } catch (e2) {
        vehicleDescToUse = "";
      }

      const shipToCode = String(rowValues[J_COL_SHIPTO_CODE - 1] || "").trim();
      const shipToName = String(rowValues[J_COL_SHIPTO_NAME - 1] || "").trim();

      logExtracostStop_({
        now: now,
        reference: referenceInRow,
        rowIndex: rowIndex,
        userId: userId,
        shipToName: shipToName,
        shipToCode: shipToCode,
        vehicleDesc: vehicleDescToUse,
        lat: lat,
        lng: lng,
        hasPumping: hasPumping,
        hasTransfer: hasTransfer
      });

    } else if (actionType === "fuel" || actionType === "fueling") {
      jobSheet.getRange(rowIndex, J_COL_FUELING_TIME).setValue(now);

    } else if (actionType === "unload" || actionType === "unload_done") {
      jobSheet.getRange(rowIndex, J_COL_UNLOAD_DONE_TIME).setValue(now);

    } else if (actionType === "review") {
      jobSheet.getRange(rowIndex, J_COL_REVIEWED_TIME).setValue(now);
    }

    SpreadsheetApp.flush();

    const updatedRow = jobSheet.getRange(rowIndex, 1, 1, J_COL_LAST).getValues()[0];

    const responseStop = {
      rowIndex:        rowIndex,
      referenceNo:     String(updatedRow[J_COL_REFERENCE - 1]   || "").trim(),
      shipmentNo:      String(updatedRow[J_COL_SHIPMENT - 1]    || "").trim(),
      destination1:    String(updatedRow[J_COL_SHIPTO_CODE - 1] || "").trim(),
      destination2:    String(updatedRow[J_COL_SHIPTO_NAME - 1] || "").trim(),
      status:          String(updatedRow[J_COL_STATUS - 1]      || "").trim(),
      checkInTime:     formatDateForClient(updatedRow[J_COL_CHECKIN - 1]),
      checkOutTime:    formatDateForClient(updatedRow[J_COL_CHECKOUT - 1]),
      fuelingTime:     formatDateForClient(updatedRow[J_COL_FUELING_TIME - 1]),
      unloadDoneTime:  formatDateForClient(updatedRow[J_COL_UNLOAD_DONE_TIME - 1]),
      reviewedTime:    formatDateForClient(updatedRow[J_COL_REVIEWED_TIME - 1]),
      processdataTime: (typeof J_COL_PROCESSDATA_TIME !== "undefined" && J_COL_PROCESSDATA_TIME > 0)
        ? formatDateForClient(updatedRow[J_COL_PROCESSDATA_TIME - 1])
        : "",
      distanceKm:      updatedRow[J_COL_DISTANCE_KM - 1],
      checkInOdo:      updatedRow[J_COL_CHECKIN_ODO - 1],
      updatedBy:       String(updatedRow[J_COL_UPDATED_BY - 1]  || "").trim()
    };

    return jsonResponse({ success: true, message: "อัปเดตสถานะสำเร็จ", stop: responseStop });

  } catch (err) {
    Logger.log("handleUpdateStop error: " + err);
    return jsonResponse({ success: false, message: "SERVER_ERROR: " + err });
  }
}

/********************************
 * handleAlcoholUpload
 * (ปรับ: ใช้ parseLatLngFlexible_ กันสลับ + รองรับ long/longitude)
 ********************************/
function handleAlcoholUpload(body) {
  try {
    const reference   = (body.reference || "").trim();
    const driverName  = (body.driverName || "").trim();
    const userId      = (body.userId || "").trim();
    const alcoholRaw  = body.alcoholValue;
    let   imageBase64 = body.imageBase64 || "";

    // ✅ normalized lat/lng
    const ll = parseLatLngFlexible_(body);
    const lat = ll.ok ? ll.lat : "";
    const lng = ll.ok ? ll.lng : "";

    if (!reference || !driverName) return { success: false, message: "ข้อมูลไม่ครบ (reference/driverName)" };
    if (!userId) return { success: false, message: "ไม่พบ userId" };

    const status = getUserStatus(userId);
    if (status !== "APPROVED") return { success: false, message: "คุณยังไม่ได้รับอนุมัติให้ใช้งานระบบ" };

    const alcoholValue = parseFloat(alcoholRaw);
    if (isNaN(alcoholValue)) return { success: false, message: "ปริมาณแอลกอฮอล์ต้องเป็นตัวเลข" };

    if (imageBase64 && imageBase64.indexOf(",") !== -1) imageBase64 = imageBase64.split(",").pop();

    const now      = new Date();
    const timezone = Session.getScriptTimeZone();
    const tsStr    = Utilities.formatDate(now, timezone, "yyyyMMdd_HHmmss");

    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = ss.getSheetByName(SHEET_ALCOHOL);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_ALCOHOL);
      sheet.getRange(1, 1, 1, 8).setValues([[
        "reference","driverName","alcoholValue","checkedAt","userId","lat","lng","imageUrl"
      ]]);
    }

    let imageUrl = "";
    if (imageBase64) {
      try {
        const bytes = Utilities.base64Decode(imageBase64);

        let parentFolder;
        try { parentFolder = DriveApp.getFolderById(ALC_PARENT_FOLDER_ID); }
        catch (e) { parentFolder = DriveApp.getRootFolder(); }

        let userFolder;
        try {
          const subFolders = parentFolder.getFoldersByName(userId);
          userFolder = subFolders.hasNext() ? subFolders.next() : parentFolder.createFolder(userId);
        } catch (e) {
          userFolder = parentFolder;
        }

        const safeDriver = driverName.replace(/[^a-zA-Z0-9ก-๙ _-]/g, "");
        const fileName =
          "alc_" + reference + "_" + safeDriver + "_" + tsStr + "_" +
          (lat || "noLat") + "_" + (lng || "noLng") + ".jpg";

        const blob = Utilities.newBlob(bytes, "image/jpeg", fileName);
        const file = userFolder.createFile(blob);
        imageUrl   = file.getUrl();
      } catch (e) {
        Logger.log("handleAlcoholUpload image upload error = " + e);
      }
    }

    sheet.appendRow([ reference, driverName, alcoholValue, now, userId, lat, lng, imageUrl ]);

    // return checkedDrivers
    const lastRow = sheet.getLastRow();
    let checkedDrivers = [];
    if (lastRow > 1) {
      const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
      checkedDrivers = data
        .filter(r => String(r[0] || "").trim() === reference)
        .map(r => String(r[1] || "").trim())
        .filter(Boolean);
      checkedDrivers = Array.from(new Set(checkedDrivers));
    }

    return { success: true, message: "บันทึกการตรวจแอลกอฮอล์สำเร็จ", checkedDrivers };

  } catch (err) {
    Logger.log("handleAlcoholUpload error: " + err);
    return { success: false, message: "SERVER_ERROR: " + err };
  }
}

/********************************
 * handleReviewUpload
 * (ปรับ: ใช้ parseLatLngFlexible_ กันสลับ + รองรับ long/longitude)
 ********************************/
function handleReviewUpload(body) {
  try {
    const reference    = String(body.reference || "").trim();
    const rowIndex     = parseInt(body.rowIndex, 10);
    const userId       = String(body.userId || "").trim();
    const score        = String(body.score || "").trim();

    const ll = parseLatLngFlexible_(body);
    const latNum = ll.lat;
    const lngNum = ll.lng;

    let   sigBase64    = body.signatureBase64 || "";

    if (!reference || !rowIndex) return { success: false, message: "ข้อมูลไม่ครบ (reference/rowIndex)" };
    if (!userId) return { success: false, message: "ไม่พบ userId" };

    const status = getUserStatus(userId);
    if (status !== "APPROVED") return { success: false, message: "คุณยังไม่ได้รับอนุมัติให้ใช้งานระบบ" };
    if (!score) return { success: false, message: "กรุณาเลือกความพึงพอใจ" };

    if (!ll.ok) return { success: false, message: "ไม่สามารถอ่านพิกัดจากอุปกรณ์ได้" };

    const mainSS   = SpreadsheetApp.openById(SHEET_ID);
    const jobSheet = mainSS.getSheetByName(SHEET_JOBDATA);
    if (!jobSheet) return { success: false, message: "ไม่พบชีท jobdata ในไฟล์หลัก" };

    ensureJobdataHasCols_(jobSheet);

    const lastRow = jobSheet.getLastRow();
    if (rowIndex < 2 || rowIndex > lastRow) return { success: false, message: "rowIndex ไม่ถูกต้อง" };

    const rowValues = jobSheet.getRange(rowIndex, 1, 1, J_COL_LAST).getValues()[0];
    const refInRow = String(rowValues[J_COL_REFERENCE - 1] || "").trim();
    if (refInRow !== reference) return { success: false, message: "อ้างอิงเลขงานไม่ตรงกับข้อมูลในระบบ" };

    const destLat   = parseFloat(rowValues[J_COL_DEST_LAT - 1]);
    const destLng   = parseFloat(rowValues[J_COL_DEST_LNG - 1]);
    const radiusM   = parseFloat(rowValues[J_COL_RADIUS_M - 1]);
    let   finalRad  = (!isNaN(radiusM) && radiusM > 0) ? radiusM : 50;

    if (!isNaN(destLat) && !isNaN(destLng)) {
      const distance = haversineDistanceMeters(destLat, destLng, latNum, lngNum);
      if (distance > finalRad) {
        return {
          success: false,
          message: "คุณอยู่นอกพื้นที่ที่กำหนด (ห่างจากจุดหมาย " +
            Math.round(distance) + " เมตร / รัศมีอนุญาต " + Math.round(finalRad) + " เมตร)"
        };
      }
    }

    const now      = new Date();
    const timezone = Session.getScriptTimeZone();
    const tsStr    = Utilities.formatDate(now, timezone, "yyyyMMdd_HHmmss");

    let reviewSheet = mainSS.getSheetByName(SHEET_REVIEW);
    if (!reviewSheet) {
      reviewSheet = mainSS.insertSheet(SHEET_REVIEW);
      reviewSheet.getRange(1, 1, 1, 11).setValues([[
        "reference","rowIndex","shipmentNo","destinationCode","destinationName",
        "score","reviewedAt","userId","lat","lng","signatureUrl"
      ]]);
    }

    const shipmentNo = String(rowValues[J_COL_SHIPMENT    - 1] || "").trim();
    const destCode   = String(rowValues[J_COL_SHIPTO_CODE - 1] || "").trim();
    const destName   = String(rowValues[J_COL_SHIPTO_NAME - 1] || "").trim();

    let signatureUrl = "";
    if (sigBase64) {
      try {
        if (sigBase64.indexOf(",") !== -1) sigBase64 = sigBase64.split(",").pop();
        const bytes = Utilities.base64Decode(sigBase64);

        let parentFolder;
        try { parentFolder = DriveApp.getFolderById(ALC_PARENT_FOLDER_ID); }
        catch (e) { parentFolder = DriveApp.getRootFolder(); }

        let userFolder;
        try {
          const sub = parentFolder.getFoldersByName(userId);
          userFolder = sub.hasNext() ? sub.next() : parentFolder.createFolder(userId);
        } catch (e) {
          userFolder = parentFolder;
        }

        const safeDest = destName.replace(/[^a-zA-Z0-9ก-๙ _-]/g, "");
        const fileName =
          "review_" + reference + "_" + safeDest + "_" + tsStr + "_" +
          (latNum || "noLat") + "_" + (lngNum || "noLng") + ".png";

        const blob = Utilities.newBlob(bytes, "image/png", fileName);
        const file = userFolder.createFile(blob);
        signatureUrl = file.getUrl();
      } catch (e) {
        Logger.log("handleReviewUpload signature upload error: " + e);
      }
    }

    reviewSheet.appendRow([
      reference, rowIndex, shipmentNo, destCode, destName,
      score, now, userId, latNum, lngNum, signatureUrl
    ]);

    jobSheet.getRange(rowIndex, J_COL_STATUS).setValue("REVIEWED");
    jobSheet.getRange(rowIndex, J_COL_REVIEWED_TIME).setValue(now);
    jobSheet.getRange(rowIndex, J_COL_UPDATED_BY).setValue(userId);
    jobSheet.getRange(rowIndex, J_COL_UPDATED_AT).setValue(now);

    SpreadsheetApp.flush();

    const updatedRow = jobSheet.getRange(rowIndex, 1, 1, J_COL_LAST).getValues()[0];

    const responseStop = {
      rowIndex:        rowIndex,
      referenceNo:     String(updatedRow[J_COL_REFERENCE - 1]   || "").trim(),
      shipmentNo:      String(updatedRow[J_COL_SHIPMENT - 1]    || "").trim(),
      destination1:    String(updatedRow[J_COL_SHIPTO_CODE - 1] || "").trim(),
      destination2:    String(updatedRow[J_COL_SHIPTO_NAME - 1] || "").trim(),
      status:          String(updatedRow[J_COL_STATUS - 1]      || "").trim(),
      checkInTime:     formatDateForClient(updatedRow[J_COL_CHECKIN - 1]),
      checkOutTime:    formatDateForClient(updatedRow[J_COL_CHECKOUT - 1]),
      fuelingTime:     formatDateForClient(updatedRow[J_COL_FUELING_TIME - 1]),
      unloadDoneTime:  formatDateForClient(updatedRow[J_COL_UNLOAD_DONE_TIME - 1]),
      reviewedTime:    formatDateForClient(updatedRow[J_COL_REVIEWED_TIME - 1]),
      processdataTime: (typeof J_COL_PROCESSDATA_TIME !== "undefined" && J_COL_PROCESSDATA_TIME > 0)
        ? formatDateForClient(updatedRow[J_COL_PROCESSDATA_TIME - 1])
        : "",
      distanceKm:      updatedRow[J_COL_DISTANCE_KM - 1],
      checkInOdo:      updatedRow[J_COL_CHECKIN_ODO - 1],
      updatedBy:       String(updatedRow[J_COL_UPDATED_BY - 1]  || "").trim()
    };

    return { success: true, message: "บันทึกการประเมินสำเร็จ", stop: responseStop };

  } catch (err) {
    Logger.log("handleReviewUpload error: " + err);
    return { success: false, message: "SERVER_ERROR: " + err };
  }
}

/********************************
 * ✅ NEW: ensureCloseJobSheet_ (สร้างชีท log ปิดงาน)
 * ✅ เพิ่มคอลัมน์ vehicleDesc (VEHICLE_DESC)
 ********************************/
function ensureCloseJobSheet_(ss) {
  const sheetName = "closejobdata";
  let sh = ss.getSheetByName(sheetName);
  if (!sh) sh = ss.insertSheet(sheetName);

  const headers = ["timestamp", "reference", "userId", "vehicleStatus", "vehicleDesc", "remark"];

  const lastRow = sh.getLastRow();
  if (lastRow < 1) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    if (sh.getLastColumn() < headers.length) {
      sh.insertColumnsAfter(sh.getLastColumn(), headers.length - sh.getLastColumn());
    }
    const cur = sh.getRange(1, 1, 1, headers.length).getValues()[0];
    const curTrim = cur.map(x => String(x || "").trim().toLowerCase());
    const need    = headers.map(x => String(x).trim().toLowerCase());
    const same = need.every((h, i) => curTrim[i] === h);
    if (!same) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sh;
}

/********************************
 * handleCloseJob
 * ✅ NEW: รับ hillFee/bkkFee/repairFee และ upsert ลง extracost (reference-level)
 ********************************/
function handleCloseJob(e) {
  try {
    const reference = (e.parameter.reference || "").trim();
    const userId    = (e.parameter.userId || "").trim();
    const vehicleStatus = String(e.parameter.vehicleStatus || "").trim().toUpperCase();

    // ✅ NEW: fee flags (reference-level)
    const hillFee   = String(e.parameter.hillFee   || "").trim();
    const bkkFee    = String(e.parameter.bkkFee    || "").trim();
    const repairFee = String(e.parameter.repairFee || "").trim();

    if (!reference) return jsonResponse({ success: false, message: "ไม่พบเลข Reference สำหรับปิดงาน" });
    if (!userId)    return jsonResponse({ success: false, message: "ไม่พบ userId" });

    if (!vehicleStatus || ["READY", "MAINTENANCE"].indexOf(vehicleStatus) === -1) {
      return jsonResponse({
        success: false,
        message: "กรุณาเลือกสถานะรถก่อนปิดงาน (READY=พร้อมรับงาน / MAINTENANCE=รถเข้าซ่อมบำรุง)"
      });
    }

    const userStatus = getUserStatus(userId);
    if (userStatus !== "APPROVED") {
      return jsonResponse({ success: false, message: "คุณยังไม่ได้รับอนุมัติให้ใช้งานระบบ" });
    }

    const mainSS   = SpreadsheetApp.openById(SHEET_ID);
    const jobSheet = mainSS.getSheetByName(SHEET_JOBDATA);
    if (!jobSheet) return jsonResponse({ success: false, message: "ไม่พบชีท jobdata ในไฟล์หลัก" });

    ensureJobdataHasCols_(jobSheet);

    const lastRow = jobSheet.getLastRow();
    if (lastRow < 2) return jsonResponse({ success: false, message: "ยังไม่มีข้อมูล jobdata" });

    const values = jobSheet.getRange(2, 1, lastRow - 1, J_COL_LAST).getValues();
    const now = new Date();

    const refRows = [];
    values.forEach((row, idx) => {
      const ref = String(row[J_COL_REFERENCE - 1] || "").trim();
      if (ref === reference) refRows.push({ rowIndex: idx + 2, row: row });
    });

    if (refRows.length === 0) {
      return jsonResponse({ success: false, message: "ไม่พบข้อมูลงาน Reference นี้ใน jobdata" });
    }

    const alreadyClosed = refRows.every(r => {
      const status  = String(r.row[J_COL_STATUS - 1] || "").trim();
      const closedAt = r.row[J_COL_JOB_CLOSED_AT - 1];
      return status === "JOB_DONE" || !!closedAt;
    });
    if (alreadyClosed) {
      return jsonResponse({ success: false, message: "งานนี้ถูกปิดงานเรียบร้อยแล้ว" });
    }

    const notCheckout = refRows.filter(r => !r.row[J_COL_CHECKOUT - 1]);
    if (notCheckout.length > 0) {
      return jsonResponse({
        success: false,
        message: "ยังมีจุดส่งที่ยังไม่ได้ Check-out ครบทุกจุด ไม่สามารถปิดงานได้"
      });
    }

    // ✅ อัปเดตทุกแถวของ reference เป็น JOB_DONE
    const batchValues = [];
    refRows.forEach(info => {
      const rowArr = jobSheet.getRange(info.rowIndex, 1, 1, J_COL_LAST).getValues()[0];
      rowArr[J_COL_STATUS - 1]        = "JOB_DONE";
      rowArr[J_COL_UPDATED_BY - 1]    = userId;
      rowArr[J_COL_UPDATED_AT - 1]    = now;
      rowArr[J_COL_JOB_CLOSED_AT - 1] = now;
      batchValues.push({ rowIndex: info.rowIndex, row: rowArr });
    });

    batchValues.forEach(b => {
      jobSheet.getRange(b.rowIndex, 1, 1, J_COL_LAST).setValues([b.row]);
    });

    // ✅ NEW: vehicleDesc จาก InputZoile30 เท่านั้น
    let vehicleDescToUse = "";
    try {
      const zoSS = SpreadsheetApp.openById(ZOILE_SHEET_ID);
      vehicleDescToUse = getVehicleDescFromInputByReference_(zoSS, reference) || "";
    } catch (e2) {
      Logger.log("[handleCloseJob] get vehicleDesc error: " + e2);
      vehicleDescToUse = "";
    }

    // ✅ log close job status (sheet closejobdata)
    const closeSheet = ensureCloseJobSheet_(mainSS);
    closeSheet.appendRow([
      formatDateForClient(now),
      reference,
      userId,
      vehicleStatus,
      vehicleDescToUse,
      (vehicleStatus === "READY") ? "พร้อมรับงาน" : "รถเข้าซ่อมบำรุง"
    ]);

    // ✅ NEW: upsert extracost reference-level (hill/bkk/repair) + shipToName/shipToCode
    // เลือก shipTo จาก “แถวสุดท้าย” ของ reference (กัน origin แทรก)
    const lastRowInfo = refRows.reduce((a, b) => (a.rowIndex > b.rowIndex ? a : b));
    const shipToCode = String(lastRowInfo.row[J_COL_SHIPTO_CODE - 1] || "").trim();
    const shipToName = String(lastRowInfo.row[J_COL_SHIPTO_NAME - 1] || "").trim();

    upsertExtracostReference_({
      now: now,
      reference: reference,
      userId: userId,
      shipToName: shipToName,
      shipToCode: shipToCode,
      vehicleDesc: vehicleDescToUse,
      hillFee: hillFee,
      bkkFee: bkkFee,
      repairFee: repairFee
    });

    SpreadsheetApp.flush();

    const firstRow = batchValues[0].row;
    const stop = {
      rowIndex:        batchValues[0].rowIndex,
      referenceNo:     String(firstRow[J_COL_REFERENCE - 1]   || "").trim(),
      shipmentNo:      String(firstRow[J_COL_SHIPMENT - 1]    || "").trim(),
      destination1:    String(firstRow[J_COL_SHIPTO_CODE - 1] || "").trim(),
      destination2:    String(firstRow[J_COL_SHIPTO_NAME - 1] || "").trim(),
      status:          String(firstRow[J_COL_STATUS - 1]      || "").trim(),
      checkInTime:     formatDateForClient(firstRow[J_COL_CHECKIN - 1]),
      checkOutTime:    formatDateForClient(firstRow[J_COL_CHECKOUT - 1]),
      fuelingTime:     formatDateForClient(firstRow[J_COL_FUELING_TIME - 1]),
      unloadDoneTime:  formatDateForClient(firstRow[J_COL_UNLOAD_DONE_TIME - 1]),
      reviewedTime:    formatDateForClient(firstRow[J_COL_REVIEWED_TIME - 1]),
      processdataTime: (typeof J_COL_PROCESSDATA_TIME !== "undefined" && J_COL_PROCESSDATA_TIME > 0)
        ? formatDateForClient(firstRow[J_COL_PROCESSDATA_TIME - 1])
        : "",
      jobClosedAt:     formatDateForClient(firstRow[J_COL_JOB_CLOSED_AT - 1]),
      distanceKm:      firstRow[J_COL_DISTANCE_KM - 1],
      checkInOdo:      firstRow[J_COL_CHECKIN_ODO - 1],
      updatedBy:       String(firstRow[J_COL_UPDATED_BY - 1]  || "").trim()
    };

    return jsonResponse({
      success: true,
      message: "ปิดงานสำเร็จ (" + (vehicleStatus === "READY" ? "พร้อมรับงาน" : "รถเข้าซ่อมบำรุง") + ")",
      vehicleStatus: vehicleStatus,
      vehicleDesc: vehicleDescToUse,
      stop: stop
    });

  } catch (err) {
    Logger.log("handleCloseJob error: " + err);
    return jsonResponse({ success: false, message: "SERVER_ERROR: " + err });
  }
}

/********************************
 * handleEndTripSummary
 * (ปรับ: ใช้ parseLatLngFlexible_ กันสลับ + รองรับ long/longitude)
 ********************************/
function handleEndTripSummary(body) {
  try {
    const reference    = (body.reference    || "").toString().trim();
    const userId       = (body.userId       || "").toString().trim();
    const endOdo       = (body.endOdo       || "").toString().trim();
    const endPointName = (body.endPointName || "").toString().trim();

    const ll = parseLatLngFlexible_(body);
    const latNum = ll.lat;
    const lngNum = ll.lng;

    if (!reference) return { success: false, message: "ไม่พบเลข Reference สำหรับจบทริป" };
    if (!userId)    return { success: false, message: "ไม่พบ userId" };

    const status = getUserStatus(userId);
    if (status !== "APPROVED") {
      return { success: false, message: "คุณยังไม่ได้รับอนุมัติให้ใช้งานระบบ" };
    }

    if (!endOdo)       return { success: false, message: "กรุณากรอกเลขไมล์จบทริป" };
    if (!endPointName) return { success: false, message: "กรุณากรอกชื่อจุดจบทริป" };

    if (!ll.ok) {
      return { success: false, message: "ไม่สามารถอ่านพิกัดจากอุปกรณ์ได้" };
    }

    const mainSS   = SpreadsheetApp.openById(SHEET_ID);
    const jobSheet = mainSS.getSheetByName(SHEET_JOBDATA);
    if (!jobSheet) return { success: false, message: "ไม่พบชีท jobdata ในไฟล์หลัก" };

    ensureJobdataHasCols_(jobSheet);

    const lastRow = jobSheet.getLastRow();
    if (lastRow < 2) return { success: false, message: "ยังไม่มีข้อมูล jobdata" };

    const values  = jobSheet.getRange(2, 1, lastRow - 1, J_COL_LAST).getValues();
    const refRows = [];
    values.forEach((row, idx) => {
      const ref = String(row[J_COL_REFERENCE - 1] || "").trim();
      if (ref === reference) refRows.push({ rowIndex: idx + 2, row: row });
    });

    if (refRows.length === 0) {
      return { success: false, message: "ไม่พบข้อมูลงาน Reference นี้ใน jobdata สำหรับบันทึกจบทริป" };
    }

    const now = new Date();

    refRows.forEach(info => {
      const r = info.rowIndex;
      const currentStatus = String(info.row[J_COL_STATUS - 1] || "").trim();

      jobSheet.getRange(r, J_COL_TRIP_END_ODO).setValue(endOdo);
      jobSheet.getRange(r, J_COL_TRIP_END_LAT).setValue(latNum);
      jobSheet.getRange(r, J_COL_TRIP_END_LNG).setValue(lngNum);
      jobSheet.getRange(r, J_COL_TRIP_END_PLACE).setValue(endPointName);
      jobSheet.getRange(r, J_COL_TRIP_ENDED_AT).setValue(now);

      if (currentStatus !== "JOB_DONE") {
        jobSheet.getRange(r, J_COL_STATUS).setValue("END_TRIP");
      }

      jobSheet.getRange(r, J_COL_UPDATED_BY).setValue(userId);
      jobSheet.getRange(r, J_COL_UPDATED_AT).setValue(now);
    });

    SpreadsheetApp.flush();
    return { success: true, message: "บันทึกข้อมูลจบทริปเรียบร้อยแล้ว" };

  } catch (err) {
    Logger.log("handleEndTripSummary error: " + err);
    return { success: false, message: "SERVER_ERROR: " + err };
  }
}

/********************************
 * ✅ isAdminUser (คงไว้เพื่อ compatibility)
 ********************************/
function isAdminUser(userId) {
  const uid = String(userId || "").trim();
  if (!uid) return false;

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SHEET_ADMIN);
  if (!sh) return false;

  const last = sh.getLastRow();
  if (last < 2) return false;

  const ids = sh.getRange(2, 1, last - 1, 1).getValues().map(r => String(r[0] || "").trim());
  return ids.indexOf(uid) !== -1;
}

/********************************
 * ✅ handleAdminAddStop
 * (ปรับ: รับ lat/lng/long/longitude + กันสลับ)
 ********************************/
function handleAdminAddStop(input) {
  try {
    const p = (input && input.parameter) ? input.parameter : (input || {});

    const adminUserId = String(p.adminUserId || "").trim();
    const reference   = String(p.reference   || "").trim();
    const shipToCode  = String(p.shipToCode  || "").trim();
    const shipToName  = String(p.shipToName  || "").trim();

    const ll = parseLatLngFlexible_(p);
    const latNum = ll.ok ? ll.lat : "";
    const lngNum = ll.ok ? ll.lng : "";

    const radiusMNum  = (p.radiusM !== undefined && p.radiusM !== "") ? parseFloat(p.radiusM) : "";

    if (!adminUserId) return { success: false, message: "ไม่พบ adminUserId" };
    if (!reference)   return { success: false, message: "กรุณาใส่เลข reference" };
    if (!shipToName)  return { success: false, message: "กรุณาใส่ชื่อจุด (shipToName)" };

    if (!isAdminUser(adminUserId)) return { success: false, message: "คุณไม่มีสิทธิ์ admin" };

    const ss = SpreadsheetApp.openById(SHEET_ID);
    const jobSheet = ss.getSheetByName(SHEET_JOBDATA);
    if (!jobSheet) return { success: false, message: "ไม่พบชีท jobdata" };

    ensureJobdataHasCols_(jobSheet);

    const lastRow = jobSheet.getLastRow();
    if (lastRow < 2) return { success: false, message: "ยังไม่มีข้อมูล jobdata" };

    const values = jobSheet.getRange(2, 1, lastRow - 1, J_COL_LAST).getValues();
    const baseRow = values.find(r => String(r[J_COL_REFERENCE - 1] || "").trim() === reference);
    if (!baseRow) return { success: false, message: "ไม่พบ reference นี้ใน jobdata (ให้ค้น/สร้างงานก่อน)" };

    const shipmentNo = String(baseRow[J_COL_SHIPMENT - 1] || "").trim();
    const now = new Date();

    const newRow = new Array(J_COL_LAST).fill("");
    newRow[J_COL_REFERENCE - 1]   = reference;
    newRow[J_COL_SHIPMENT - 1]    = shipmentNo;
    newRow[J_COL_SHIPTO_CODE - 1] = shipToCode;
    newRow[J_COL_SHIPTO_NAME - 1] = shipToName;
    newRow[J_COL_SOURCE_ROW - 1]  = "ADMIN_EXTRA_STOP";
    newRow[J_COL_STATUS - 1]      = "NEW";

    if (latNum !== "" && !isNaN(latNum)) newRow[J_COL_DEST_LAT - 1] = latNum;
    if (lngNum !== "" && !isNaN(lngNum)) newRow[J_COL_DEST_LNG - 1] = lngNum;

    const finalRadius = (radiusMNum !== "" && !isNaN(radiusMNum)) ? radiusMNum : 50;
    newRow[J_COL_RADIUS_M - 1]    = finalRadius;

    newRow[J_COL_UPDATED_BY - 1]  = adminUserId;
    newRow[J_COL_UPDATED_AT - 1]  = now;

    jobSheet.appendRow(newRow);
    SpreadsheetApp.flush();

    return {
      success: true,
      message: "เพิ่มจุดเพิ่มเรียบร้อย",
      data: { reference, shipmentNo, shipToCode, shipToName, lat: latNum, lng: lngNum, radiusM: finalRadius }
    };

  } catch (err) {
    Logger.log("handleAdminAddStop error: " + err);
    return { success: false, message: "SERVER_ERROR: " + err };
  }
}

/* ======================================================================
 * ✅ PROCESSDATA
 * header: timestamp reference shipToName shipToCode rowIndex userId receiverName receiverType lat lng
 * ====================================================================== */

/********************************
 * ✅ uploadProcessData (GET/POST) - ชื่อเดิมตาม router.gs
 * (ปรับ: รองรับ long/longitude + กันสลับ lat/lng)
 ********************************/
function uploadProcessData(input) {
  try {
    const isEvent = input && input.parameter;
    const p = isEvent ? (input.parameter || {}) : (input || {});

    const reference = String(p.reference || "").trim();
    const userId    = String(p.userId || "").trim();
    const rowIndex  = parseInt(p.rowIndex, 10);

    // รองรับ FE ใหม่ + legacy
    const shipToCodeIn = String(p.shipToCode || p.branchCode || "").trim();
    const shipToNameIn = String(p.shipToName || p.branchName || "").trim();

    const receiverName = String(p.receiverName || "").trim();
    const receiverType = String(p.receiverType || "").trim();

    const ll = parseLatLngFlexible_(p);
    const latNum = ll.ok ? ll.lat : "";
    const lngNum = ll.ok ? ll.lng : "";

    if (!reference || !userId || !rowIndex) {
      return { success: false, message: "ข้อมูลไม่ครบ (reference/userId/rowIndex)" };
    }
    if (!receiverName || !receiverType) {
      return { success: false, message: "กรุณากรอกชื่อผู้รับน้ำมัน และเลือกประเภทผู้รับน้ำมัน" };
    }

    const allowedTypes = ["manager", "frontHasCard", "frontNoCard"];
    if (allowedTypes.indexOf(receiverType) === -1) {
      return { success: false, message: "ประเภทผู้รับน้ำมันไม่ถูกต้อง" };
    }

    const status = getUserStatus(userId);
    if (status !== "APPROVED") {
      return { success: false, message: "คุณยังไม่ได้รับอนุมัติให้ใช้งานระบบ" };
    }

    const mainSS   = SpreadsheetApp.openById(SHEET_ID);
    const jobSheet = mainSS.getSheetByName(SHEET_JOBDATA);
    if (!jobSheet) return { success: false, message: "ไม่พบชีท jobdata ในไฟล์หลัก" };

    ensureJobdataHasCols_(jobSheet);

    const lastRow = jobSheet.getLastRow();
    if (rowIndex < 2 || rowIndex > lastRow) {
      return { success: false, message: "rowIndex ไม่ถูกต้อง (อยู่นอกช่วงข้อมูล)" };
    }

    const rowValues = jobSheet.getRange(rowIndex, 1, 1, J_COL_LAST).getValues()[0];
    const refInRow  = String(rowValues[J_COL_REFERENCE - 1] || "").trim();
    if (refInRow !== reference) {
      return { success: false, message: "reference ไม่ตรงกับแถวใน jobdata (กันเขียนผิดจุด)" };
    }

    const shipToCode = shipToCodeIn || String(rowValues[J_COL_SHIPTO_CODE - 1] || "").trim();
    const shipToName = shipToNameIn || String(rowValues[J_COL_SHIPTO_NAME - 1] || "").trim();

    const processSheet = ensureProcessdataSheet_(mainSS);
    const now = new Date();

    if (isDuplicateProcessdata_(processSheet, { reference, rowIndex, userId, now })) {
      return { success: true, message: "พบข้อมูลซ้ำในช่วงเวลาใกล้เคียง (ข้ามการบันทึกซ้ำ)" };
    }

    processSheet.appendRow([
      formatDateForClient(now),
      reference,
      shipToName,
      shipToCode,
      rowIndex,
      userId,
      receiverName,
      receiverType,
      (latNum === "" || isNaN(latNum)) ? "" : latNum,
      (lngNum === "" || isNaN(lngNum)) ? "" : lngNum
    ]);

    return {
      success: true,
      message: "บันทึก processdata สำเร็จ",
      data: {
        timestamp: formatDateForClient(now),
        reference,
        shipToName,
        shipToCode,
        rowIndex,
        userId,
        receiverName,
        receiverType,
        lat: (latNum === "" || isNaN(latNum)) ? "" : latNum,
        lng: (lngNum === "" || isNaN(lngNum)) ? "" : lngNum,
        processdataTime: formatDateForClient(now)
      }
    };

  } catch (err) {
    Logger.log("uploadProcessData error: " + err);
    return { success: false, message: "SERVER_ERROR: " + err };
  }
}

/********************************
 * ✅ ensureProcessdataSheet_ (header ตามที่กำหนด)
 ********************************/
function ensureProcessdataSheet_(ss) {
  const sheetName = (typeof SHEET_PROCESSDATA !== "undefined" && SHEET_PROCESSDATA)
    ? SHEET_PROCESSDATA
    : "processdata";

  let sh = ss.getSheetByName(sheetName);
  if (!sh) sh = ss.insertSheet(sheetName);

  const headers = [
    "timestamp","reference","shipToName","shipToCode","rowIndex",
    "userId","receiverName","receiverType","lat","lng"
  ];

  if (sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    if (sh.getLastColumn() < headers.length) {
      sh.insertColumnsAfter(sh.getLastColumn(), headers.length - sh.getLastColumn());
    }
    const cur = sh.getRange(1, 1, 1, headers.length).getValues()[0]
      .map(x => String(x || "").trim().toLowerCase());
    const need = headers.map(x => String(x).trim().toLowerCase());
    const same = need.every((h, i) => cur[i] === h);
    if (!same) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  return sh;
}

/********************************
 * ✅ isDuplicateProcessdata_
 * ตรวจซ้ำใน 60 วินาที: same reference + rowIndex + userId
 ********************************/
function isDuplicateProcessdata_(processSheet, ctx) {
  try {
    const ref = String(ctx.reference || "").trim();
    const uid = String(ctx.userId || "").trim();
    const idx = Number(ctx.rowIndex || 0);
    const now = ctx.now instanceof Date ? ctx.now : new Date();

    if (!ref || !uid || !idx) return false;

    const lastRow = processSheet.getLastRow();
    if (lastRow < 2) return false;

    const lookback = Math.min(200, lastRow - 1);
    const startRow = lastRow - lookback + 1;

    // timestamp(1), reference(2), rowIndex(5), userId(6)
    const values = processSheet.getRange(startRow, 1, lookback, 6).getValues();

    for (let i = 0; i < values.length; i++) {
      const r = values[i];

      const ts  = r[0];
      const ref2 = String(r[1] || "").trim();
      const rowIdx2 = parseInt(r[4], 10);
      const uid2 = String(r[5] || "").trim();

      if (ref2 !== ref) continue;
      if (uid2 !== uid) continue;
      if (rowIdx2 !== idx) continue;

      if (ts && Object.prototype.toString.call(ts) === "[object Date]" && !isNaN(ts.getTime())) {
        const diffSec = Math.abs(now.getTime() - ts.getTime()) / 1000;
        if (diffSec <= 60) return true;
      }
    }

    return false;
  } catch (e) {
    return false;
  }
}
