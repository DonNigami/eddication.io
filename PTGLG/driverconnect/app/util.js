/********************************
 * Helper: format date → string
 ********************************/
function formatDateForClient(date) {
  if (!date) return '';
  if (!(date instanceof Date)) return String(date);
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
}

/********************************
 * Helper: JSON Response
 ********************************/
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/********************************
 * Helper: Haversine distance (meters)
 ********************************/
function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;

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
 * Helper: ดึง config พิกัดจาก Station/Origin
 ********************************/
function getLocationConfigByCode(code) {
  if (!code) return null;
  const target = String(code).trim();

  const ss = SpreadsheetApp.openById(SHEET_ID);

  // Station
  const stationSheet = ss.getSheetByName(SHEET_STATION);
  if (stationSheet) {
    const lastRow = stationSheet.getLastRow();
    if (lastRow > 1) {
      const values = stationSheet.getRange(2, 1, lastRow - 1, ST_COL_RADIUS_M).getValues();
      for (let i = 0; i < values.length; i++) {
        const rowKey1 = String(values[i][ST_COL_KEY1 - 1] || '').trim();
        const rowKey2 = String(values[i][ST_COL_KEY2 - 1] || '').trim();
        if (rowKey1 === target || rowKey2 === target) {
          const lat     = parseFloat(values[i][ST_COL_LAT - 1]);
          const lng     = parseFloat(values[i][ST_COL_LNG - 1]);
          const radiusM = parseFloat(values[i][ST_COL_RADIUS_M - 1]);
          if (!isNaN(lat) && !isNaN(lng) && !isNaN(radiusM)) {
            return { lat, lng, radiusM };
          }
        }
      }
    }
  }

  // Origin
  const originSheet = ss.getSheetByName(SHEET_ORIGIN);
  if (originSheet) {
    const lastRow = originSheet.getLastRow();
    if (lastRow > 1) {
      const values = originSheet.getRange(2, 1, lastRow - 1, OR_COL_RADIUS_M).getValues();
      for (let i = 0; i < values.length; i++) {
        const rowCode = String(values[i][OR_COL_CODE - 1] || '').trim();
        if (rowCode === target) {
          const lat     = parseFloat(values[i][OR_COL_LAT - 1]);
          const lng     = parseFloat(values[i][OR_COL_LNG - 1]);
          const radiusM = parseFloat(values[i][OR_COL_RADIUS_M - 1]);
          if (!isNaN(lat) && !isNaN(lng) && !isNaN(radiusM)) {
            return { lat, lng, radiusM };
          }
        }
      }
    }
  }

  return null;
}

/********************************
 * หา config ต้นทางจาก Route (3 ตัวแรก)
 * ใช้ชีท Origin:
 * A originKey | B name | C lat | D lng | E radiusMeters | F routeCode
 ********************************/
function getOriginConfigByRoute(routeStr) {
  const route = String(routeStr || '').trim();
  if (!route) return null;

  // ใช้แค่ 3 ตัวแรกตาม requirement
  const prefix = route.substring(0, 3);

  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_ORIGIN);
  if (!sheet) return null;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const data = sheet.getRange(2, 1, lastRow - 1, OR_COL_ROUTE_CODE).getValues();
  for (let i = 0; i < data.length; i++) {
    const row          = data[i];
    const originKey    = String(row[OR_COL_CODE - 1]       || '').trim();
    const originName   = String(row[OR_COL_NAME - 1]       || '').trim();
    const lat          = row[OR_COL_LAT - 1];
    const lng          = row[OR_COL_LNG - 1];
    const radiusMeters = parseFloat(row[OR_COL_RADIUS_M - 1]);
    const routeCode    = String(row[OR_COL_ROUTE_CODE - 1] || '').trim();

    if (!routeCode) continue;

    const routeCodePrefix = routeCode.substring(0, 3);
    if (prefix === routeCodePrefix) {
      return {
        code:     originKey || routeCodePrefix,
        name:     originName || originKey || routeCodePrefix,
        lat:      lat,
        lng:      lng,
        radiusM: (!isNaN(radiusMeters) && radiusMeters > 0) ? radiusMeters : 200
      };
    }
  }

  return null;
}
