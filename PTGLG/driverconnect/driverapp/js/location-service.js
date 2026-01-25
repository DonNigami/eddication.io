/**
 * Driver Tracking App - Location Service
 *
 * Centralized location data management including:
 * - Origin configuration lookup
 * - Customer/station coordinate lookup
 * - Stop enrichment with coordinates
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
        .order('id', { ascending: true })
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
 * Get customer coordinates by shipToCodes
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
    const { data: customerData } = await supabase
      .from('customer')
      .select('stationKey, name, lat, lng, radiusMeters')
      .in('stationKey', uncachedCodes);

    if (customerData) {
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

    cache.customersExpiry = Date.now() + CACHE_TTL;
  } catch (error) {
    console.warn('⚠️ Error fetching customers:', error.message);
  }

  return new Map(cache.customers);
}

/**
 * Enrich stops with coordinates from master location tables
 * @param {Array} stops - Array of stop objects
 * @param {string|null} route - Route code for origin lookup
 * @returns {Promise<Array>} - Enriched stops with coordinates
 */
export async function enrichStopsWithCoordinates(stops, route = null) {
  if (!stops || stops.length === 0) {
    return stops;
  }

  try {
    console.log('🔍 Enriching coordinates for', stops.length, 'stops');

    // Step 1: Get origin coordinate
    const originData = await getOriginConfig(route);

    // Step 2: Get all unique customer codes
    const shipToCodes = stops
      .filter(s => s.shipToCode && !s.isOriginStop)
      .map(s => s.shipToCode)
      .filter((v, i, a) => a.indexOf(v) === i); // unique

    // Step 3: Fetch customer coordinates
    const customerMap = shipToCodes.length > 0
      ? await getCustomerCoordinates(shipToCodes)
      : new Map();

    // Step 4: Enrich stops
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

      // Regular stop - lookup in customer map
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

      // No coordinates found
      return stop;
    });

    const enrichedCount = enrichedStops.filter(s => s.destLat && s.destLng).length;
    console.log(`✅ Enriched ${enrichedCount}/${stops.length} stops with coordinates`);

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
