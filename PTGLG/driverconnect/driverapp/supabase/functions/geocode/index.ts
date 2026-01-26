/**
 * Supabase Edge Function: Geocode
 *
 * Geocodes addresses using Nominatim (OpenStreetMap) server-side,
 * avoiding CORS issues.
 *
 * Usage: Call via supabase.functions.invoke('geocode', { body: { address, country } })
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

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
  // Handle CORS preflight - MUST allow all Supabase client headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-runtime, x-supabase-client-runtime-version, x-supabase-auth, x-supabase-client-platform, x-supabase-client-version',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  try {
    const { address, country = 'th' }: GeocodeRequest = await req.json();

    if (!address) {
      return new Response(
        JSON.stringify({ error: 'Address is required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

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

    // Fetch from Nominatim
    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'DriverConnect-EdgeFunction/1.0',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim returned ${response.status}`);
    }

    const data: NominatimResult[] = await response.json();

    if (data && data.length > 0 && data[0].lat && data[0].lon) {
      return new Response(
        JSON.stringify({
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          displayName: data[0].display_name,
          source: 'nominatim',
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // No results found
    return new Response(
      JSON.stringify({ error: 'No results found', address }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Geocoding error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Geocoding failed',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
