// Follow this setup guide: https://supabase.com/docs/guides/functions/quickstart
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Utility function to calculate distance between two lat/lng points (Haversine formula)
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 405,
    })
  }

  const { record: newLog } = await req.json()

  // Ensure this is a driver_logs insert with location data
  if (!newLog || !newLog.table || newLog.table !== 'driver_logs' || !newLog.location || !newLog.trip_id || !newLog.user_id) {
    return new Response(JSON.stringify({ message: 'Not a relevant driver_logs insert or missing data' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Use service role key for RLS bypass
  )

  try {
    const { data: job, error: jobError } = await supabaseClient
      .from('jobdata')
      .select('dest_lat, dest_lng, radius_m')
      .eq('id', newLog.trip_id)
      .single()

    if (jobError) throw jobError

    if (!job || !job.dest_lat || !job.dest_lng || !job.radius_m) {
      return new Response(JSON.stringify({ message: 'Job data for geofence check is incomplete' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const distance = haversineDistance(
      newLog.location.lat, newLog.location.lng,
      job.dest_lat, job.dest_lng
    )

    // Fetch active geofence deviation rule
    const { data: alertRule, error: ruleError } = await supabaseClient
      .from('admin_alerts')
      .select('id, rule_name, rule_type, threshold')
      .eq('rule_type', 'geofence_deviation')
      .eq('status', 'active')
      .single()

    if (ruleError && ruleError.code !== 'PGRST116') throw ruleError // PGRST116 = no rows found
    
    // Check for geofence deviation against rule threshold, or job-specific radius_m if no rule
    const deviationThreshold = alertRule?.threshold?.distance_m || job.radius_m;

    if (distance > deviationThreshold) {
      const { data: triggeredAlert, error: insertError } = await supabaseClient
        .from('triggered_alerts')
        .insert({
          alert_rule_id: alertRule?.id,
          trip_id: newLog.trip_id,
          driver_user_id: newLog.user_id,
          message: `Geofence Deviation: Driver ${newLog.user_id} is ${distance.toFixed(2)}m from destination (threshold: ${deviationThreshold}m) for trip ${newLog.trip_id}.`,
          details: {
            driver_location: newLog.location,
            destination: { lat: job.dest_lat, lng: job.dest_lng },
            distance: distance.toFixed(2),
            threshold: deviationThreshold,
            log_id: newLog.id,
            log_created_at: newLog.created_at,
          },
        })
        .select()

      if (insertError) throw insertError

      return new Response(JSON.stringify({ message: 'Geofence deviation alert triggered', alert: triggeredAlert }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    return new Response(JSON.stringify({ message: 'No geofence deviation detected' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in geofence deviation function:', error.message)
    return new Response(JSON.stringify({ error: `Function error: ${error.message}` }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})