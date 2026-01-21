import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { driver_user_id } = await req.json();

    if (!driver_user_id) {
      return new Response(
        JSON.stringify({ error: 'driver_user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Stopping live tracking for driver: ${driver_user_id}`);

    // Update the driver_live_locations record to disable realtime tracking
    const { data, error } = await supabase
      .from('driver_live_locations')
      .update({
        is_tracked_in_realtime: false,
        last_updated: new Date().toISOString()
      })
      .eq('driver_user_id', driver_user_id)
      .select()
      .single();

    if (error) {
      console.error('Error stopping live tracking:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Live tracking stopped successfully:', data);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Live tracking stopped',
        data
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
