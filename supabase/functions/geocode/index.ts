/**
 * Supabase Edge Function: Geocode
 *
 * Geocodes addresses using Nominatim (OpenStreetMap) server-side,
 * avoiding CORS issues.
 *
 * Usage: Call via supabase.functions.invoke('geocode', { body: { address, country } })
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

interface GeocodeRequest {
  address: string;
  country?: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
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

    // Build Nominatim URL
    const params = new URLSearchParams({
      format: 'json',
      q: address,
      limit: '1',
      countrycodes: country,
      addressdetails: '1',
      'accept-language': 'th,en',
    });

    const nominatimUrl = `https://nominatim.openstreetmap.org/search?${params.toString()}`;

    // Fetch from Nominatim with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'DriverConnect-EdgeFunction/1.0',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Nominatim returned ${response.status}`);
    }

    const data: NominatimResult[] = await response.json();

    if (data && data.length > 0 && data[0].lat && data[0].lon) {
      console.log(`Geocoded "${address}" to ${data[0].lat}, ${data[0].lon}`);
      return new Response(
        JSON.stringify({
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          displayName: data[0].display_name,
          source: 'nominatim',
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
        source: 'nominatim',
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
      }),
      {
        status: 200, // Return 200 with null values instead of error
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
