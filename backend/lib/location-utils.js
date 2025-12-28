/**
 * Location & Config Utilities
 * Adapted from GAS for Node.js backend
 */

/**
 * Helper: Format date → string (ISO or custom)
 * @param {Date|string|null} date - Date object or ISO string
 * @param {string} format - Format string: 'iso', 'datetime', or pattern like 'yyyy-MM-dd HH:mm'
 * @returns {string} Formatted date string
 */
function formatDateForClient(date, format = 'datetime') {
  if (!date) return '';
  
  let d;
  if (typeof date === 'string') {
    d = new Date(date);
  } else if (date instanceof Date) {
    d = date;
  } else {
    return String(date);
  }

  if (isNaN(d.getTime())) return '';

  switch (format) {
    case 'iso':
      return d.toISOString();
    case 'datetime':
      // yyyy-MM-dd HH:mm
      return d.toLocaleDateString('en-CA') + ' ' + 
             String(d.getHours()).padStart(2, '0') + ':' +
             String(d.getMinutes()).padStart(2, '0');
    case 'date':
      return d.toLocaleDateString('en-CA');
    case 'time':
      return String(d.getHours()).padStart(2, '0') + ':' +
             String(d.getMinutes()).padStart(2, '0') + ':' +
             String(d.getSeconds()).padStart(2, '0');
    default:
      return d.toString();
  }
}

/**
 * Haversine distance calculator (meters)
 * @param {number} lat1 - Latitude 1
 * @param {number} lng1 - Longitude 1
 * @param {number} lat2 - Latitude 2
 * @param {number} lng2 - Longitude 2
 * @returns {number} Distance in meters
 */
function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (d) => (d * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Get location config (lat/lng/radius) by code from Station or Origin sheet
 * @param {Sheet} sheet - GAS Sheet object or array of values
 * @param {string} code - Code to search for (station or origin code)
 * @param {object} columnConfig - {keyCol, latCol, lngCol, radiusCol, nameCol}
 * @returns {object|null} {lat, lng, radiusM, name} or null
 */
function getLocationConfigFromSheet(values, code, columnConfig) {
  if (!code || !values || values.length === 0) return null;

  const target = String(code).trim().toUpperCase();
  const { keyCol = 1, nameCol = 2, latCol = 3, lngCol = 4, radiusCol = 5 } = columnConfig;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowKey = String(row[keyCol - 1] || '').trim().toUpperCase();
    const rowName = String(row[nameCol - 1] || '').trim();
    const lat = parseFloat(row[latCol - 1]);
    const lng = parseFloat(row[lngCol - 1]);
    const radius = parseFloat(row[radiusCol - 1]);

    if (rowKey === target && !isNaN(lat) && !isNaN(lng) && !isNaN(radius)) {
      return {
        code: rowKey,
        name: rowName || rowKey,
        lat,
        lng,
        radiusM: radius
      };
    }
  }

  return null;
}

/**
 * Get origin config by route prefix (3 characters)
 * @param {array} values - Array of origin sheet rows
 * @param {string} routeStr - Route code (first 3 chars used for matching)
 * @param {object} columnConfig - {codeCol, nameCol, latCol, lngCol, radiusCol, routeCodeCol}
 * @returns {object|null} {code, name, lat, lng, radiusM} or null
 */
function getOriginConfigByRoute(values, routeStr, columnConfig) {
  if (!routeStr || !values || values.length === 0) return null;

  const route = String(routeStr).trim();
  const prefix = route.substring(0, 3).toUpperCase();
  const { 
    codeCol = 1, 
    nameCol = 2, 
    latCol = 3, 
    lngCol = 4, 
    radiusCol = 5, 
    routeCodeCol = 6 
  } = columnConfig;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const originCode = String(row[codeCol - 1] || '').trim().toUpperCase();
    const originName = String(row[nameCol - 1] || '').trim();
    const lat = parseFloat(row[latCol - 1]);
    const lng = parseFloat(row[lngCol - 1]);
    const radiusMeters = parseFloat(row[radiusCol - 1]);
    const routeCode = String(row[routeCodeCol - 1] || '').trim();

    if (!routeCode) continue;

    const routeCodePrefix = routeCode.substring(0, 3).toUpperCase();
    if (prefix === routeCodePrefix && !isNaN(lat) && !isNaN(lng)) {
      return {
        code: originCode || prefix,
        name: originName || originCode || prefix,
        lat,
        lng,
        radiusM: (!isNaN(radiusMeters) && radiusMeters > 0) ? radiusMeters : 200
      };
    }
  }

  return null;
}

/**
 * Calculate if coordinate is within radius of target location
 * @param {number} currentLat - Current latitude
 * @param {number} currentLng - Current longitude
 * @param {number} targetLat - Target latitude
 * @param {number} targetLng - Target longitude
 * @param {number} radiusMeters - Acceptable radius in meters
 * @returns {boolean} True if within radius
 */
function isWithinRadius(currentLat, currentLng, targetLat, targetLng, radiusMeters = 200) {
  const distance = haversineDistanceMeters(currentLat, currentLng, targetLat, targetLng);
  return distance <= radiusMeters;
}

/**
 * Parse and validate coordinate
 * @param {*} lat - Latitude value
 * @param {*} lng - Longitude value
 * @returns {object|null} {lat, lng} or null if invalid
 */
function parseCoordinates(lat, lng) {
  const parsedLat = parseFloat(lat);
  const parsedLng = parseFloat(lng);

  if (isNaN(parsedLat) || isNaN(parsedLng)) return null;
  if (parsedLat < -90 || parsedLat > 90) return null;
  if (parsedLng < -180 || parsedLng > 180) return null;

  return { lat: parsedLat, lng: parsedLng };
}

module.exports = {
  formatDateForClient,
  haversineDistanceMeters,
  getLocationConfigFromSheet,
  getOriginConfigByRoute,
  isWithinRadius,
  parseCoordinates
};
