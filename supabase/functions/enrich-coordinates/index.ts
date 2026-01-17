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
  latitude: number;
  longitude: number;
  radius_meters?: number;
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
    const supabaseUrl = Deno.env.get('PROJECT_URL') || 'https://myplpshpcordggbbtblg.supabase.co';
    const supabaseKey = Deno.env.get('SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ============================================
    // Step 1: Get origin coordinate
    // ============================================
    let originLat: number | null = null;
    let originLng: number | null = null;

    if (route) {
      const routePrefix = route.substring(0, 3).toUpperCase();
      
      const { data: originData } = await supabase
        .from('origin')
        .select('latitude, longitude, radius_meters, name, code')
        .ilike('route_code', `${routePrefix}%`)
        .eq('active', true)
        .limit(1)
        .single();

      if (originData) {
        originLat = originData.latitude;
        originLng = originData.longitude;
        log(`Found origin: ${originData.name} (${originLat}, ${originLng})`);
      }
    }

    // ============================================
    // Step 2: Get all customer coordinates in one query
    // ============================================
    const shipToCodes = stops
      .filter(s => s.shipToCode && !s.isOriginStop)
      .map(s => s.shipToCode)
      .filter((v, i, a) => a.indexOf(v) === i); // unique

    let customerMap = new Map<string, LocationData>();

    if (shipToCodes.length > 0) {
      const { data: customerData } = await supabase
        .from('customer')
        .select('customer_code, customer_name, latitude, longitude, radius_meters')
        .in('customer_code', shipToCodes)
        .eq('active', true);

      if (customerData) {
        customerData.forEach(c => {
          customerMap.set(c.customer_code, {
            latitude: c.latitude,
            longitude: c.longitude,
            radius_meters: c.radius_meters,
            name: c.customer_name,
            code: c.customer_code
          });
        });
        log(`Found ${customerData.length} customers with coordinates`);
      }
    }

    // ============================================
    // Step 3: Get all station coordinates in one query
    // ============================================
    let stationMap = new Map<string, LocationData>();

    if (shipToCodes.length > 0) {
      const { data: stationData } = await supabase
        .from('station')
        .select('station_code, station_name, latitude, longitude, radius_meters')
        .in('station_code', shipToCodes)
        .eq('active', true);

      if (stationData) {
        stationData.forEach(s => {
          stationMap.set(s.station_code, {
            latitude: s.latitude,
            longitude: s.longitude,
            radius_meters: s.radius_meters,
            name: s.station_name,
            code: s.station_code
          });
        });
        log(`Found ${stationData.length} stations with coordinates`);
      }
    }

    // ============================================
    // Step 4: Enrich stops with coordinates
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
          destLng: originLng
        };
      }

      // Regular stop - lookup in customer or station
      if (stop.shipToCode) {
        // Try customer first
        const customer = customerMap.get(stop.shipToCode);
        if (customer && customer.latitude && customer.longitude) {
          return {
            ...stop,
            destLat: customer.latitude,
            destLng: customer.longitude
          };
        }

        // Try station
        const station = stationMap.get(stop.shipToCode);
        if (station && station.latitude && station.longitude) {
          return {
            ...stop,
            destLat: station.latitude,
            destLng: station.longitude
          };
        }
      }

      // No coordinates found
      return stop;
    });

    // Count how many stops were enriched
    const enrichedCount = enrichedStops.filter(s => s.destLat && s.destLng).length;
    log(`Enriched ${enrichedCount}/${stops.length} stops with coordinates`);

    return successResponse({ stops: enrichedStops }, `Enriched ${enrichedCount} stops`);

  } catch (err) {
    log('Unexpected error:', err);
    return errorResponse('เกิดข้อผิดพลาด: ' + (err as Error).message, 500);
  }
});
