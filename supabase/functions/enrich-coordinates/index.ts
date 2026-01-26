// ============================================
// ENRICH COORDINATES EDGE FUNCTION
// ============================================
// Purpose: Enrich job stop data with coordinates from master location tables
// Endpoint: /enrich-coordinates
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, successResponse, errorResponse, log } from '../_shared/utils.ts';

interface EnrichRequest {
  stops: StopData[];
  route?: string;
}

interface StopData {
  rowIndex?: number;
  seq: number;
  shipToCode?: string;
  shipToName?: string;
  isOriginStop?: boolean;
  destLat?: number;
  destLng?: number;
  [key: string]: any;
}

interface LocationData {
  lat: number;
  lng: number;
  radiusMeters?: number;
  name?: string;
  code?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body
    const body: EnrichRequest = await req.json();
    if (!body || !body.stops || !Array.isArray(body.stops)) {
      return errorResponse('Invalid request body');
    }

    const { stops, route } = body;
    log(`Enriching ${stops.length} stops with coordinates`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('PROJECT_URL') || Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ============================================
    // Step 1: Get origin coordinate
    // ============================================
    let originLat: number | null = null;
    let originLng: number | null = null;
    let originRadiusM: number = 200;

    if (route) {
      const routePrefix = route.substring(0, 3).toUpperCase();

      const { data: originData } = await supabase
        .from('origin')
        .select('*')
        .or(`routeCode.ilike.${routePrefix}%,originKey.ilike.${routePrefix}%`)
        .eq('active', true)
        .limit(1)
        .maybeSingle();

      if (originData) {
        originLat = parseFloat(originData.lat);
        originLng = parseFloat(originData.lng);
        originRadiusM = parseInt(originData.radiusMeters) || 200;
        log(`Found origin: ${originData.name} (${originLat}, ${originLng})`);
      }
    }

    // ============================================
    // Step 2: Get all customer coordinates
    // Using camelCase column names: stationKey, name, lat, lng, radiusMeters
    // ============================================
    const shipToCodes = stops
      .filter(s => s.shipToCode && !s.isOriginStop)
      .map(s => s.shipToCode)
      .filter((v, i, a) => a.indexOf(v) === i); // unique

    let customerMap = new Map<string, LocationData>();

    if (shipToCodes.length > 0) {
      const { data: customerData } = await supabase
        .from('customer')
        .select('stationKey, name, lat, lng, radiusMeters')
        .in('stationKey', shipToCodes);

      if (customerData) {
        customerData.forEach((c: any) => {
          const lat = parseFloat(c.lat);
          const lng = parseFloat(c.lng);
          if (!isNaN(lat) && !isNaN(lng)) {
            customerMap.set(c.stationKey, {
              lat,
              lng,
              radiusMeters: parseInt(c.radiusMeters) || 100,
              name: c.name,
              code: c.stationKey
            });
          }
        });
        log(`Found ${customerData.length} customers with coordinates`);
      }
    }

    // ============================================
    // Step 3: Get all station coordinates
    // Note: station table uses lowercase column names (stationkey, radiusmeters)
    // ============================================
    let stationMap = new Map<string, LocationData>();

    if (shipToCodes.length > 0) {
      const { data: stationData } = await supabase
        .from('station')
        .select('stationkey, name, lat, lng, radiusmeters')
        .in('stationkey', shipToCodes);

      if (stationData) {
        stationData.forEach((s: any) => {
          const lat = parseFloat(s.lat);
          const lng = parseFloat(s.lng);
          if (!isNaN(lat) && !isNaN(lng)) {
            stationMap.set(s.stationkey, {
              lat,
              lng,
              radiusMeters: parseInt(s.radiusmeters) || 100,
              name: s.name,
              code: s.stationkey
            });
          }
        });
        log(`Found ${stationData.length} stations with coordinates`);
      }
    }

    // ============================================
    // Step 4: Look up stations by name for stops without shipToCode
    // ============================================
    const stopsWithoutCode = stops.filter(s => !s.shipToCode && s.shipToName && !s.isOriginStop);
    if (stopsWithoutCode.length > 0) {
      const uniqueNames = [...new Set(stopsWithoutCode.map(s => s.shipToName))];

      for (const name of uniqueNames) {
        const { data: stationByName } = await supabase
          .from('station')
          .select('stationkey, name, lat, lng, radiusmeters')
          .eq('name', name)
          .limit(1)
          .maybeSingle();

        if (stationByName) {
          const lat = parseFloat(stationByName.lat);
          const lng = parseFloat(stationByName.lng);
          if (!isNaN(lat) && !isNaN(lng)) {
            // Store by name for later lookup
            stationMap.set(name, {
              lat,
              lng,
              radiusMeters: parseInt(stationByName.radiusmeters) || 100,
              name: stationByName.name,
              code: stationByName.stationkey
            });
            log(`Found station by name: ${name}`);
          }
        }
      }
    }

    // ============================================
    // Step 5: Enrich stops with coordinates
    // ============================================
    const enrichedStops = stops.map((stop, index) => {
      // If already has coordinates, keep them
      if (stop.destLat && stop.destLng) {
        return stop;
      }

      // Origin stop - use origin coordinates
      if (stop.isOriginStop && originLat && originLng) {
        return {
          ...stop,
          destLat: originLat,
          destLng: originLng,
          radiusM: originRadiusM
        };
      }

      // Regular stop - lookup in customer first
      if (stop.shipToCode) {
        const customer = customerMap.get(stop.shipToCode);
        if (customer && customer.lat && customer.lng) {
          return {
            ...stop,
            destLat: customer.lat,
            destLng: customer.lng,
            radiusM: customer.radiusMeters || 100
          };
        }

        // Try station
        const station = stationMap.get(stop.shipToCode);
        if (station && station.lat && station.lng) {
          return {
            ...stop,
            destLat: station.lat,
            destLng: station.lng,
            radiusM: station.radiusMeters || 100
          };
        }
      }

      // If shipToCode is empty, try to find by shipToName
      if (!stop.shipToCode && stop.shipToName) {
        // Check if we found it by name lookup
        const station = stationMap.get(stop.shipToName);
        if (station && station.lat && station.lng) {
          return {
            ...stop,
            destLat: station.lat,
            destLng: station.lng,
            radiusM: station.radiusMeters || 100
          };
        }
      }

      // No coordinates found
      return stop;
    });

    // Count how many stops were enriched
    const enrichedCount = enrichedStops.filter(s => s.destLat && s.destLng).length;
    log(`Enriched ${enrichCount}/${stops.length} stops with coordinates`);

    return successResponse({ stops: enrichedStops }, `Enriched ${enriched} stops`);

  } catch (err) {
    log('Unexpected error:', err);
    return errorResponse('เกิดข้อผิดพลาด: ' + (err as Error).message, 500);
  }
});
