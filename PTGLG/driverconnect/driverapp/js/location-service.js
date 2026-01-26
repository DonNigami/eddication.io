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
  customersExpiry: 0,
  geocoding: new Map() // Cache for geocoding results
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch with timeout and retry logic
 * @param {string} url - URL to fetch
 * @param {number} timeout - Timeout in milliseconds
 * @param {number} retries - Number of retries
 * @returns {Promise<Response>} - Fetch response
 */
async function fetchWithTimeout(url, options = {}, timeout = 6000, retries = 2) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      lastError = error;

      if (attempt < retries) {
        // Exponential backoff: 1s, 2s, 4s...
        const backoffDelay = 1000 * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
  }

  throw lastError;
}

/**
 * Simplify Thai company name for better geocoding results
 * @param {string} name - Original company name
 * @returns {Array<string>} - Array of simplified name variations to try
 */
function simplifyThaiName(name) {
  const variations = [name];

  // Remove common Thai company prefixes/suffixes
  const simplified = name
    .replace(/^บริษัท\s+/i, '') // Remove "บริษัท " (Company)
    .replace(/^ห้างหุ้นส่วนจำกัด\s+/i, '') // Remove "ห้างหุ้นส่วนจำกัด " (Partnership)
    .replace(/\sจำกัด$/i, '') // Remove " จำกัด" (Limited)
    .replace(/\s\(จำกัด\)$/i, '') // Remove " (จำกัด)"
    .replace(/\s\(มหาชน\)$/i, '') // Remove " (มหาชน)" (Public)
    .replace(/\s\(ไทย\)$/i, '') // Remove " (ไทย)" (Thailand)
    .replace(/\s\.+$/, '') // Remove trailing dots
    .trim();

  if (simplified !== name) {
    variations.push(simplified);
  }

  // Try with "จำกัด" suffix only
  if (simplified && !simplified.includes('จำกัด')) {
    variations.push(simplified + ' จำกัด');
  }

  // Try just the first 2-3 words (often the core business name)
  const words = simplified.split(/\s+/);
  if (words.length > 3) {
    const shortName = words.slice(0, Math.min(3, words.length)).join(' ');
    if (shortName !== simplified) {
      variations.push(shortName);
    }
  }

  // Remove duplicates while preserving order
  return [...new Set(variations)];
}

/**
 * Get multiple CORS proxy URLs to try
 * @param {string} targetUrl - URL to proxy
 * @returns {Array<{name: string, url: string}>} - Array of proxy configurations
 */
function getCorsProxies(targetUrl) {
  return [
    // AllOrigins - JSON mode for better parsing
    {
      name: 'AllOrigins',
      url: `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
      isJsonWrapper: true // Response wraps data in .contents
    },
    // Try-cf-worker - a Cloudflare worker proxy
    {
      name: 'TryCFWorker',
      url: `https://try-cf-worker.affecting.workers.dev/?url=${encodeURIComponent(targetUrl)}`
    },
    // Corsproxy - might be rate-limited
    {
      name: 'CorsProxyISO',
      url: `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`
    }
  ];
}

/**
 * Try geocoding via Supabase Edge Function (if deployed)
 * @param {string} address - Address to geocode
 * @returns {Promise<{lat, lng, source}|null>} - Coordinates or null
 */
async function geocodeViaSupabaseEdgeFunction(address) {
  try {
    const { data, error } = await supabase.functions.invoke('geocode', {
      body: { address, country: 'th' }
    });

    if (error) throw error;
    if (data && data.lat && data.lng) {
      return {
        lat: parseFloat(data.lat),
        lng: parseFloat(data.lng),
        source: 'SupabaseEdge'
      };
    }
  } catch (error) {
    // Edge function might not exist - that's okay
    return null;
  }
}

/**
 * Geocode an address using Nominatim (OpenStreetMap) with multiple fallbacks
 * @param {string} address - Address to geocode
 * @param {Object} options - Options { skipCache: boolean }
 * @returns {Promise<{lat, lng, source}|null>} - Coordinates with source or null
 */
async function geocodeAddress(address, options = {}) {
  if (!address) return null;

  // Check cache first (unless skipping cache)
  const cacheKey = address.toLowerCase();
  if (!options.skipCache && cache.geocoding.has(cacheKey)) {
    return cache.geocoding.get(cacheKey);
  }

  // Method 1: Try Supabase Edge Function first (most reliable if available)
  const edgeResult = await geocodeViaSupabaseEdgeFunction(address);
  if (edgeResult) {
    cache.geocoding.set(cacheKey, edgeResult);
    console.log(`📍 Geocoded "${address}" to ${edgeResult.lat}, ${edgeResult.lng} (SupabaseEdge)`);
    return edgeResult;
  }

  // Get name variations to try
  const nameVariations = simplifyThaiName(address);

  // Method 2: Try Nominatim through various proxies
  for (const [index, searchName] of nameVariations.entries()) {
    // Build the Nominatim URL with progressive simplification
    const params = new URLSearchParams({
      format: 'json',
      q: searchName,
      limit: '1',
      countrycodes: 'th',
      addressdetails: '1',
      'accept-language': 'th,en'
    });

    const nominatimUrl = `https://nominatim.openstreetmap.org/search?${params.toString()}`;

    // Get proxy configurations
    const proxies = getCorsProxies(nominatimUrl);

    // Define geocoding methods to try
    const methods = [
      {
        name: 'Direct',
        fetch: async () => {
          const response = await fetchWithTimeout(nominatimUrl, {
            headers: { 'Accept': 'application/json', 'User-Agent': 'DriverConnect-App/1.0' }
          }, 6000, 1);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const json = await response.json();
          return { data: json, isDirect: true };
        }
      },
      ...proxies.map(proxy => ({
        name: proxy.name,
        isJsonWrapper: proxy.isJsonWrapper || false,
        fetch: async () => {
          const response = await fetchWithTimeout(proxy.url, {}, 8000, 1);
          if (!response.ok) throw new Error(`Proxy HTTP ${response.status}`);
          const json = await response.json();
          // AllOrigins wraps the response in .contents
          if (proxy.isJsonWrapper && json.contents) {
            try {
              return { data: JSON.parse(json.contents), isDirect: false };
            } catch {
              return { data: null, isDirect: false };
            }
          }
          return { data: json, isDirect: false };
        }
      }))
    ];

    // Try each method for this name variation
    for (const method of methods) {
      try {
        const result = await method.fetch();
        const data = result.data;

        if (data && data.length > 0 && data[0].lat && data[0].lon) {
          const coords = {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            source: method.name,
            searchedName: searchName
          };
          // Cache the result
          cache.geocoding.set(cacheKey, coords);
          const variationLabel = index > 0 ? ` (simplified: "${searchName}")` : '';
          console.log(`📍 Geocoded "${address}" to ${coords.lat}, ${coords.lng} (${method.name})${variationLabel}`);
          return coords;
        }
      } catch (error) {
        // Only log warning for the last name variation and last method
        const isLastVariation = index === nameVariations.length - 1;
        const isLastMethod = method === methods[methods.length - 1];
        if (isLastVariation && isLastMethod) {
          console.warn(`⚠️ Geocoding ${method.name} failed:`, error.message);
        }
        // Continue to next method
      }
    }
  }

  console.warn(`⚠️ All geocoding methods failed for "${address}"`);
  return null;
}

/**
 * Batch geocode multiple addresses with rate limiting (parallel with delay)
 * @param {Array} stops - Array of stops needing geocoding
 * @param {number} timeoutMs - Timeout in milliseconds (default: 20000)
 * @returns {Promise<Map>} - Map of shipToCode -> { lat, lng, source }
 */
async function batchGeocodeStops(stops, timeoutMs = 20000) {
  const results = new Map();
  const stopsToGeocode = stops.filter(s => s.shipToName || s.address);

  if (stopsToGeocode.length === 0) {
    return results;
  }

  // Process in parallel with small delay between batches
  const BATCH_SIZE = 2; // Reduced for better reliability
  const BATCH_DELAY = 500; // Increased delay to respect rate limits

  const geocodePromise = (async () => {
    for (let i = 0; i < stopsToGeocode.length; i += BATCH_SIZE) {
      const batch = stopsToGeocode.slice(i, i + BATCH_SIZE);

      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(async (stop) => {
          const address = stop.shipToName || stop.address;
          const coords = await geocodeAddress(address);
          return coords ? { key: stop.shipToCode || stop.seq, coords, address } : null;
        })
      );

      // Store results
      batchResults.forEach(result => {
        if (result) {
          results.set(result.key, result.coords);
        }
      });

      // Delay between batches (except for the last batch)
      if (i + BATCH_SIZE < stopsToGeocode.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }
    return results;
  })();

  // Race between geocoding and timeout
  const timeoutPromise = new Promise(resolve => {
    setTimeout(() => {
      console.warn(`⏱️ Geocoding timed out after ${timeoutMs}ms, returning partial results`);
      resolve(results);
    }, timeoutMs);
  });

  return Promise.race([geocodePromise, timeoutPromise]);
}

/**
 * Save geocoded result to customer table for future use
 * @param {string} stationKey - The customer station key
 * @param {string} name - Customer name
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {string} source - Geocoding source
 */
async function saveGeocodedResult(stationKey, name, lat, lng, source = 'geocoding') {
  try {
    // Check if customer already exists first
    const { data: existing } = await supabase
      .from('customer')
      .select('stationKey')
      .eq('stationKey', stationKey)
      .maybeSingle();

    if (existing) {
      // Update existing customer
      await supabase
        .from('customer')
        .update({
          lat: lat.toString(),
          lng: lng.toString(),
          updatedAt: new Date().toISOString()
        })
        .eq('stationKey', stationKey);
      console.log(`💾 Updated coordinates for ${stationKey} (${name})`);
    } else {
      // Insert new customer entry
      await supabase
        .from('customer')
        .insert({
          stationKey,
          name,
          lat: lat.toString(),
          lng: lng.toString(),
          radiusMeters: 100,
          source,
          createdAt: new Date().toISOString()
        });
      console.log(`💾 Saved new coordinates for ${stationKey} (${name})`);
    }

    // Update cache
    cache.customers.set(stationKey, {
      name,
      lat,
      lng,
      radiusMeters: 100
    });
  } catch (error) {
    console.warn(`⚠️ Failed to save geocoded result for ${stationKey}:`, error.message);
    // Don't throw - geocoding success shouldn't fail due to save failure
  }
}

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
      .select('stationKey, name, lat, lng, radiusMeters')
      .in('stationKey', uncachedCodes);

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
      const { data: stationData, error: stationError } = await supabase
        .from('station')
        .select('stationkey, name, lat, lng, radiusmeters')
        .in('stationkey', stillUncachedCodes);

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
            cache.customers.set(s.stationkey, {
              name: s.name,
              lat,
              lng,
              radiusMeters: s.radiusmeters
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
 * Enrich stops using the enrich-coordinates Edge Function
 * This calls the server-side function which queries origin, customer, and station tables
 * @param {Array} stops - Array of stop objects
 * @param {string|null} route - Route code for origin lookup
 * @returns {Promise<{success: boolean, stops: Array}|null>} - Enriched stops or null on failure
 */
async function enrichViaEdgeFunction(stops, route) {
  try {
    const { data, error } = await supabase.functions.invoke('enrich-coordinates', {
      body: { stops, route }
    });

    if (error) {
      console.warn('⚠️ enrich-coordinates Edge Function error:', error.message);
      return null;
    }

    if (data && data.stops) {
      console.log(`✅ Enriched via Edge Function: ${data.stops.filter(s => s.destLat && s.destLng).length}/${stops.length} stops`);
      return { success: true, stops: data.stops };
    }

    return null;
  } catch (err) {
    console.warn('⚠️ enrich-coordinates Edge Function failed:', err.message);
    return null;
  }
}

/**
 * Query station by exact name match (more reliable than ilike for Thai)
 * @param {string} name - Station name to lookup
 * @returns {Promise<Object|null>} - Station data or null
 */
async function getStationByName(name) {
  // Check cache first
  const cached = Array.from(cache.customers.entries()).find(([key, value]) => value.name === name);
  if (cached) {
    return { stationkey: cached[0], ...cached[1] };
  }

  try {
    // Try exact match first - more reliable for Thai names
    const { data: stationData, error } = await supabase
      .from('station')
      .select('stationkey, name, lat, lng, radiusmeters')
      .eq('name', name)
      .limit(1)
      .maybeSingle();

    // Check for specific error codes
    if (error) {
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
        cache.customers.set(stationData.stationkey, {
          name: stationData.name,
          lat,
          lng,
          radiusMeters: stationData.radiusmeters
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

    // STEP 1: Try enrich-coordinates Edge Function first (server-side, no CORS issues)
    const edgeResult = await enrichViaEdgeFunction(stops, route);
    if (edgeResult && edgeResult.stops) {
      // Update cache with results from Edge Function
      for (const stop of edgeResult.stops) {
        if (stop.destLat && stop.destLng && stop.shipToCode) {
          cache.customers.set(stop.shipToCode, {
            name: stop.shipToName || '',
            lat: stop.destLat,
            lng: stop.destLng,
            radiusMeters: stop.radiusM || 100
          });
        }
      }
      return edgeResult.stops;
    }

    // STEP 2: Fallback to client-side enrichment if Edge Function fails
    console.log('🔄 Falling back to client-side enrichment...');

    // Step 2.1: Get origin coordinate
    const originData = await getOriginConfig(route);

    // Step 2.2: Get all unique customer codes
    const shipToCodes = stops
      .filter(s => s.shipToCode && !s.isOriginStop)
      .map(s => s.shipToCode)
      .filter((v, i, a) => a.indexOf(v) === i); // unique

    // Step 2.3: Fetch customer coordinates (with error handling)
    let customerMap = new Map();
    if (shipToCodes.length > 0) {
      try {
        customerMap = await getCustomerCoordinates(shipToCodes);
      } catch (err) {
        console.warn('⚠️ Error fetching customer coordinates, continuing without:', err.message);
        customerMap = new Map();
      }
    }

    // Step 2.4: For stops without shipToCode, try to load coordinates by shipToName
    const stopsWithoutCode = stops.filter(s => !s.shipToCode && s.shipToName && !s.isOriginStop);
    if (stopsWithoutCode.length > 0) {
      const uniqueNames = [...new Set(stopsWithoutCode.map(s => s.shipToName))];
      console.log(`🔍 Looking up ${uniqueNames.length} unique names for stops without shipToCode...`);

      // Use exact match instead of ilike for Thai names
      for (const name of uniqueNames) {
        const station = await getStationByName(name);
        if (station) {
          console.log(`✅ Found coordinates for "${name}" by name lookup`);
        }
      }
    }

    // Step 4: Identify stops without coordinates for geocoding
    const stopsWithoutCoords = stops.filter(stop => {
      if (stop.destLat && stop.destLng) return false; // Already has coords
      if (stop.isOriginStop) return false; // Origin handled separately

      // Check if found in customerMap by shipToCode
      if (stop.shipToCode) {
        const customer = customerMap.get(stop.shipToCode);
        if (customer && customer.lat && customer.lng) return false;
      }

      // Check if found in cache by shipToName (for stops without shipToCode)
      if (!stop.shipToCode && stop.shipToName) {
        const foundByName = Array.from(cache.customers.values()).some(
          v => v.name === stop.shipToName && v.lat && v.lng
        );
        if (foundByName) return false;
      }

      // Needs geocoding
      return true;
    });

    // Step 5: Geocode missing stops - NON-BLOCKING with 2s timeout
    let geocodedMap = new Map();
    if (stopsWithoutCoords.length > 0) {
      console.log(`📍 Geocoding ${stopsWithoutCoords.length} stops without coordinates (max 2s wait)...`);

      // Quick 2-second timeout for initial results
      geocodedMap = await batchGeocodeStops(stopsWithoutCoords, 2000);

      // Continue geocoding in background with full timeout (fire and forget)
      batchGeocodeStops(stopsWithoutCoords, 20000).then(backgroundResults => {
        if (backgroundResults.size > geocodedMap.size) {
          console.log(`📍 Background geocoding completed: ${backgroundResults.size} results`);
          // Trigger a UI refresh if callback is registered
          if (window.onGeocodingComplete) {
            window.onGeocodingComplete(backgroundResults);
          }
        }
      }).catch(err => {
        console.warn('⚠️ Background geocoding failed:', err.message);
      });
    }

    // Step 5.5: Save successful geocoding results to database
    if (geocodedMap.size > 0) {
      console.log(`💾 Saving ${geocodedMap.size} geocoded results to database...`);
      for (const [key, coords] of geocodedMap.entries()) {
        const stop = stopsWithoutCoords.find(s => (s.shipToCode || s.seq) === key);
        if (stop && stop.shipToCode && coords.lat && coords.lng) {
          // Save asynchronously without blocking
          saveGeocodedResult(
            stop.shipToCode,
            stop.shipToName || stop.address || 'Unknown',
            coords.lat,
            coords.lng,
            coords.source || 'nominatim'
          ).catch(() => {}); // Fire and forget
        }
      }
    }

    // Step 6: Enrich stops
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

      // If shipToCode is empty, try to find by shipToName in customer/station cache
      // (look up by name as fallback for empty codes)
      if (!stop.shipToCode && stop.shipToName) {
        for (const [key, value] of cache.customers.entries()) {
          if (value.name === stop.shipToName && value.lat && value.lng) {
            return {
              ...stop,
              destLat: value.lat,
              destLng: value.lng,
              radiusM: parseFloat(value.radiusMeters) || 100
            };
          }
        }
      }

      // Try geocoded result
      const geocodeKey = stop.shipToCode || stop.seq;
      if (geocodedMap.has(geocodeKey)) {
        const coords = geocodedMap.get(geocodeKey);
        return {
          ...stop,
          destLat: coords.lat,
          destLng: coords.lng,
          radiusM: 100 // Default radius for geocoded locations
        };
      }

      // No coordinates found - return original
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
  cache.geocoding.clear();
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
