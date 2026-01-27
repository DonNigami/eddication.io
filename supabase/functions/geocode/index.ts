/**
 * Supabase Edge Function: Geocode
 *
 * Geocodes addresses using Photon API (OpenStreetMap-based) server-side,
 * avoiding CORS issues. Photon has no rate limits unlike Nominatim.
 *
 * Usage: Call via supabase.functions.invoke('geocode', { body: { address, country } })
 *
 * Photon API: https://photon.komoot.io/
 * - Free, no rate limits
 * - Uses OpenStreetMap data
 * - Returns coordinates as [lon, lat]
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

interface GeocodeRequest {
  address: string;
  country?: string;
}

interface PhotonResult {
  features: PhotonFeature[];
}

interface PhotonFeature {
  geometry: {
    coordinates: [number, number]; // [lon, lat]
  };
  properties: {
    name?: string;
    city?: string;
    country?: string;
    osm_type?: string;
    osm_id?: number;
    extent?: [number, number, number, number];
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { address, country = 'th' }: GeocodeRequest = await req.json();

    if (!address) {
      return new Response(
        JSON.stringify({ error: 'Address is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Geocoding address: "${address}" in country: ${country}`);

    // Build Photon API URL
    // Photon uses 'q' for search and 'lang' for language preference
    // For country filtering, we append country code to the query
    const searchQuery = country && country.toLowerCase() === 'th'
      ? `${address}, Thailand`
      : address;

    const params = new URLSearchParams({
      q: searchQuery,
      limit: '1',
      lang: 'th', // Prefer Thai results
    });

    const photonUrl = `https://photon.komoot.io/api/?${params.toString()}`;

    // Fetch from Photon API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(photonUrl, {
      headers: {
        'User-Agent': 'DriverConnect-EdgeFunction/1.0',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Photon API returned ${response.status}`);
    }

    const data: PhotonResult = await response.json();

    if (data?.features?.[0]) {
      const feature = data.features[0];
      // Photon returns [lon, lat], we need [lat, lng]
      const lon = feature.geometry.coordinates[0];
      const lat = feature.geometry.coordinates[1];

      console.log(`Geocoded "${address}" to ${lat}, ${lon}`);

      // Build display name from properties
      const props = feature.properties;
      const displayName = props.name
        ? `${props.name}${props.city ? `, ${props.city}` : ''}${props.country ? `, ${props.country}` : ''}`
        : `${lat}, ${lon}`;

      return new Response(
        JSON.stringify({
          lat,
          lng: lon,
          displayName,
          source: 'photon',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // No results found - return null lat/lng instead of error
    // This allows graceful fallback in the client
    console.log(`No results found for "${address}"`);
    return new Response(
      JSON.stringify({
        lat: null,
        lng: null,
        source: 'photon',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Geocoding error:', error);
    return new Response(
      JSON.stringify({
        lat: null,
        lng: null,
        error: error.message || 'Geocoding failed',
        source: 'photon',
      }),
      {
        status: 200, // Return 200 with null values instead of error
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
