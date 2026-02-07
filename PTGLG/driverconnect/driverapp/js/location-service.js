/**
 * Driver Tracking App - Location Service (Simplified)
 *
 * Centralized location data management using ONLY database tables:
 * - Origin configuration lookup
 * - Customer/station coordinate lookup from database
 * - Stop enrichment with coordinates
 *
 * NO EXTERNAL GEOCODING - Coordinates must exist in database tables
 */

import { supabase } from '../../shared/config.js';

/**
 * Location data cache
 */
const cache = {
  origin: null,
  originExpiry: 0,
  customers: new Map(),
  customersExpiry: 0
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get origin configuration by route
 * @param {string} route - Route code
 * @returns {Promise<Object|null>} - Origin data or null
 */
export async function getOriginConfig(route = null) {
  // Check cache first
  if (cache.origin && Date.now() < cache.originExpiry) {
    return cache.origin;
  }

  let originData = null;

  // 1. Try by route code
  if (route) {
    const routePrefix = route.substring(0, 3).toUpperCase();
    try {
      const { data } = await supabase
        .from('origin')
        .select('originKey, name, lat, lng, radiusMeters, routeCode')
        .or(`routeCode.ilike.${routePrefix}%,originKey.ilike.${routePrefix}%`)
        .limit(1)
        .maybeSingle();

      if (data) {
        originData = data;
        console.log(`✅ Found origin by route: ${originData.name}`);
      }
    } catch (error) {
      console.warn('⚠️ Error fetching origin by route:', error.message);
    }
  }

  // 2. Fallback to default origin (first row)
  if (!originData) {
    try {
      const { data } = await supabase
        .from('origin')
        .select('originKey, name, lat, lng, radiusMeters, routeCode')
        .limit(1)
        .maybeSingle();

      if (data) {
        originData = data;
        console.log(`✅ Using default origin: ${originData.name}`);
      }
    } catch (error) {
      console.warn('⚠️ Error fetching default origin:', error.message);
    }
  }

  // Cache the result
  if (originData) {
    cache.origin = originData;
    cache.originExpiry = Date.now() + CACHE_TTL;
  }

  return originData;
}

/**
 * Get customer/station coordinates by shipToCodes
 * Queries both 'customer' and 'station' tables
 * @param {string[]} shipToCodes - Array of ship to codes
 * @returns {Promise<Map>} - Map of shipToCode -> { lat, lng, radiusMeters }
 */
export async function getCustomerCoordinates(shipToCodes = []) {
  if (shipToCodes.length === 0) {
    return new Map();
  }

  // Filter out already cached entries
  const uncachedCodes = shipToCodes.filter(code => !cache.customers.has(code));

  if (uncachedCodes.length === 0) {
    return new Map(cache.customers);
  }

  try {
    // Step 1: Query customer table
    const { data: customerData, error: customerError } = await supabase
      .from('customer')
      .select('"stationKey", name, lat, lng, "radiusMeters"')
      .in('"stationKey"', uncachedCodes);

    if (customerError) {
      // Check if table doesn't exist or permission denied
      if (customerError.code === 'PGRST116' || customerError.code === '42501') {
        console.warn(`⚠️ Customer table not accessible (${customerError.code}), skipping...`);
      } else {
        console.warn('⚠️ Customer table query error:', customerError.message);
      }
    } else if (customerData) {
      customerData.forEach(c => {
        const lat = parseFloat(c.lat);
        const lng = parseFloat(c.lng);

        if (!isNaN(lat) && !isNaN(lng)) {
          cache.customers.set(c.stationKey, {
            name: c.name,
            lat,
            lng,
            radiusMeters: c.radiusMeters
          });
        }
      });
      console.log(`✅ Loaded ${customerData.length} customer coordinates`);
    }

    // Step 2: Query station table for codes not found in customer
    const stillUncachedCodes = uncachedCodes.filter(code => !cache.customers.has(code));
    if (stillUncachedCodes.length > 0) {
      // Station table uses Thai column name 'ชื่อสถานีบริการ' for name
      // Also try 'station_name' as fallback (some migrations use this)
      const { data: stationData, error: stationError } = await supabase
        .from('station')
        .select('"stationKey", "ชื่อสถานีบริการ", lat, lng, "radiusMeters"')
        .in('"stationKey"', stillUncachedCodes);

      if (stationError) {
        // Check if table doesn't exist or permission denied
        if (stationError.code === 'PGRST116' || stationError.code === '42501') {
          console.warn(`⚠️ Station table not accessible (${stationError.code}), skipping...`);
        } else {
          console.warn('⚠️ Station table query error:', stationError.message);
        }
      } else if (stationData) {
        stationData.forEach(s => {
          const lat = parseFloat(s.lat);
          const lng = parseFloat(s.lng);

          if (!isNaN(lat) && !isNaN(lng)) {
            cache.customers.set(s.stationKey, {
              name: s['ชื่อสถานีบริการ'] || s.station_name || s.stationKey,
              lat,
              lng,
              radiusMeters: s.radiusMeters
            });
          }
        });
        console.log(`✅ Loaded ${stationData.length} station coordinates`);
      }
    }

    cache.customersExpiry = Date.now() + CACHE_TTL;
  } catch (error) {
    console.warn('⚠️ Exception fetching customer/station coordinates:', error.message);
  }

  return new Map(cache.customers);
}

/**
 * Query station by exact name match
 * @param {string} name - Station name to lookup
 * @returns {Promise<Object|null>} - Station data or null
 */
async function getStationByName(name) {
  // Check cache first
  const cached = Array.from(cache.customers.entries()).find(([key, value]) => value.name === name);
  if (cached) {
    return { stationKey: cached[0], ...cached[1] };
  }

  try {
    // Try exact match - the station table uses Thai column name 'ชื่อสถานีบริการ'
    // Also try 'station_name' as fallback (some migrations use this)
    let stationData = null;
    let error = null;

    // First try with Thai column name
    const thaiResult = await supabase
      .from('station')
      .select('"stationKey", "ชื่อสถานีบริการ", lat, lng, "radiusMeters"')
      .eq('"ชื่อสถานีบริการ"', name)
      .limit(1)
      .maybeSingle();

    if (!thaiResult.error && thaiResult.data) {
      stationData = {
        stationKey: thaiResult.data.stationKey,
        name: thaiResult.data['ชื่อสถานีบริการ'],
        lat: thaiResult.data.lat,
        lng: thaiResult.data.lng,
        radiusMeters: thaiResult.data.radiusMeters
      };
    } else {
      // Try with station_name as fallback
      const fallbackResult = await supabase
        .from('station')
        .select('"stationKey", station_name, lat, lng, "radiusMeters"')
        .eq('station_name', name)
        .limit(1)
        .maybeSingle();
      error = fallbackResult.error;
      stationData = fallbackResult.data;
    }

    // Check for specific error codes
    if (error && !stationData) {
      // If table doesn't exist or permission denied, just return null
      if (error.code === 'PGRST116' || error.code === '42501') {
        console.warn(`⚠️ Station table not accessible (${error.code})`);
        return null;
      }
      // For other errors, log and continue
      console.warn(`⚠️ Error looking up station by name "${name}":`, error.message);
      return null;
    }

    if (stationData) {
      const lat = parseFloat(stationData.lat);
      const lng = parseFloat(stationData.lng);
      if (!isNaN(lat) && !isNaN(lng)) {
        cache.customers.set(stationData.stationKey, {
          name: stationData.name || stationData.station_name || stationData['ชื่อสถานีบริการ'],
          lat,
          lng,
          radiusMeters: stationData.radiusMeters
        });
        return stationData;
      }
    }
  } catch (err) {
    // Catch network errors and other exceptions
    console.warn(`⚠️ Exception looking up station by name "${name}":`, err.message);
  }

  return null;
}

/**
 * Enrich stops with coordinates from database tables only
 * NO EXTERNAL API CALLS - Coordinates must exist in database
 * @param {Array} stops - Array of stop objects
 * @param {string|null} route - Route code for origin lookup
 * @returns {Promise<Array>} - Enriched stops with coordinates (or without if not found in DB)
 */
export async function enrichStopsWithCoordinates(stops, route = null) {
  if (!stops || stops.length === 0) {
    return stops;
  }

  try {
    console.log('🔍 Enriching coordinates for', stops.length, 'stops (database only)');

    // Step 1: Get origin coordinate
    const originData = await getOriginConfig(route);

    // Step 2: Get all unique customer codes
    const shipToCodes = stops
      .filter(s => s.shipToCode && !s.isOriginStop)
      .map(s => s.shipToCode)
      .filter((v, i, a) => a.indexOf(v) === i); // unique

    // Step 3: Fetch customer coordinates from database
    let customerMap = new Map();
    if (shipToCodes.length > 0) {
      try {
        customerMap = await getCustomerCoordinates(shipToCodes);
      } catch (err) {
        console.warn('⚠️ Error fetching customer coordinates:', err.message);
        customerMap = new Map();
      }
    }

    // Step 4: For stops without shipToCode, try to load coordinates by shipToName
    const stopsWithoutCode = stops.filter(s => !s.shipToCode && s.shipToName && !s.isOriginStop);
    if (stopsWithoutCode.length > 0) {
      const uniqueNames = [...new Set(stopsWithoutCode.map(s => s.shipToName))];
      console.log(`🔍 Looking up ${uniqueNames.length} unique names in station table...`);

      for (const name of uniqueNames) {
        const station = await getStationByName(name);
        if (station) {
          console.log(`✅ Found coordinates for "${name}"`);
        }
      }
    }

    // Step 5: Enrich stops with database coordinates
    const enrichedStops = stops.map(stop => {
      // If already has coordinates, keep them
      if (stop.destLat && stop.destLng && stop.radiusM) {
        return stop;
      }

      // Origin stop - use origin coordinates
      if (stop.isOriginStop && originData) {
        return {
          ...stop,
          destLat: parseFloat(originData.lat) || null,
          destLng: parseFloat(originData.lng) || null,
          radiusM: parseFloat(originData.radiusMeters) || 200
        };
      }

      // Regular stop - lookup in customer map by shipToCode
      if (stop.shipToCode) {
        const customer = customerMap.get(stop.shipToCode);
        if (customer && customer.lat && customer.lng) {
          return {
            ...stop,
            destLat: customer.lat,
            destLng: customer.lng,
            radiusM: parseFloat(customer.radiusMeters) || 50
          };
        }
      }

      // If shipToCode is empty, try to find by shipToName in cache
      if (!stop.shipToCode && stop.shipToName) {
        for (const [key, value] of cache.customers.entries()) {
          if (value.name === stop.shipToName && value.lat && value.lng) {
            return {
              ...stop,
              destLat: value.lat,
              destLng: value.lng,
              radiusM: parseFloat(value.radiusMeters) || 100,
              // Add shipToCode from cache for future reference
              shipToCode: key
            };
          }
        }
      }

      // No coordinates found in database - return original (will be shown without map)
      return stop;
    });

    const enrichedCount = enrichedStops.filter(s => s.destLat && s.destLng).length;
    console.log(`✅ Enriched ${enrichedCount}/${stops.length} stops with coordinates (from database)`);

    // Log stops without coordinates for reference
    const withoutCoords = enrichedStops.filter(s => !s.destLat || !s.destLng);
    if (withoutCoords.length > 0) {
      const missingNames = [...new Set(withoutCoords.map(s => s.shipToName || s.shipToCode || 'Unknown').filter(Boolean))];
      console.log(`⚠️ No coordinates found for: ${missingNames.join(', ')} (add to station/customer table)`);
    }

    return enrichedStops;

  } catch (error) {
    console.error('❌ Error enriching coordinates:', error);
    // Return original stops if enrichment fails
    return stops;
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lng1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lng2 - Longitude of point 2
 * @returns {number} - Distance in meters
 */
export function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Check if a point is within a radius of a center point
 * @param {number} centerLat - Center latitude
 * @param {number} centerLng - Center longitude
 * @param {number} pointLat - Point latitude
 * @param {number} pointLng - Point longitude
 * @param {number} radiusMeters - Radius in meters
 * @returns {boolean} - True if point is within radius
 */
export function isWithinRadius(centerLat, centerLng, pointLat, pointLng, radiusMeters = 200) {
  const distance = haversineDistanceMeters(centerLat, centerLng, pointLat, pointLng);
  return distance <= radiusMeters;
}

/**
 * Clear the location cache
 */
export function clearLocationCache() {
  cache.origin = null;
  cache.originExpiry = 0;
  cache.customers.clear();
  cache.customersExpiry = 0;
  console.log('🗑️ Location cache cleared');
}

/**
 * Get cache status for debugging
 */
export function getCacheStatus() {
  return {
    origin: cache.origin ? 'cached' : 'empty',
    customers: cache.customers.size + ' entries',
    originExpiry: new Date(cache.originExpiry).toISOString(),
    customersExpiry: new Date(cache.customersExpiry).toISOString()
  };
}
