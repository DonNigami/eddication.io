import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { GoogleAuth } from "https://esm.sh/google-auth-library@9.6.3";

// Define the shape of the incoming request body
interface NotificationPayload {
  event_type: 'job_closed' | 'trip_ended';
  user_id: string; // The user who triggered the event
  job_id?: string; // ID of the job or trip
  trip_id?: string;
}

// Define the shape of a notification target from our database
interface NotificationTarget {
  notification_type: 'webhook' | 'dm';
  target_address: string;
  description: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Main function to handle requests
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: NotificationPayload = await req.json();
    const { event_type, user_id, job_id, trip_id } = payload;

    // Create a Supabase client with service role access
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Admin Mode Override Check
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("user_type")
      .eq("user_id", user_id)
      .single();

    if (profileError) throw new Error(`Failed to fetch user profile: ${profileError.message}`);

    if (userProfile?.user_type === 'ADMIN') {
      const adminWebhookUrl = Deno.env.get("ADMIN_NOTIFICATION_WEBHOOK");
      if (adminWebhookUrl) {
        const testMessage = `🔔 [ADMIN TEST] Event: ${event_type}, Job/Trip ID: ${job_id || trip_id}, Triggered by: ${user_id}`;
        await sendToWebhook(adminWebhookUrl, { text: testMessage });
        return new Response(JSON.stringify({ message: "Admin test notification sent." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 2. Normal Notification Logic
    let targets: NotificationTarget[] = [];
    const message = `Event: ${event_type} received for Job/Trip ID: ${job_id || trip_id}.`; // Placeholder message

    // In a real scenario, you'd fetch job/trip details to get customer/station IDs
    // and then query google_chat_webhooks based on those IDs.
    // For this example, we'll assume we have a way to get the targets.
    // This part needs to be fully implemented based on your DB schema for jobs/trips.
    // For now, let's hardcode a query for all targets for demonstration.
    const { data: allTargets, error: targetsError } = await supabaseAdmin
      .from("google_chat_webhooks")
      .select("notification_type, target_address, description");
    
    if (targetsError) throw new Error(`Failed to fetch notification targets: ${targetsError.message}`);
    
    targets = allTargets || [];

    // 3. Send notifications to all targets
    const sendPromises = targets.map(target => {
      if (target.notification_type === 'webhook') {
        return sendToWebhook(target.target_address, { text: `📢 ${target.description}: ${message}` });
      } else if (target.notification_type === 'dm') {
        return sendToDm(target.target_address, { text: `👤 ${target.description}: ${message}` });
      }
      return Promise.resolve();
    });

    await Promise.all(sendPromises);

    return new Response(JSON.stringify({ message: "Notifications processed.", targets_notified: targets.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

// Helper function to send a message to a Webhook URL
async function sendToWebhook(url: string, body: Record<string, any>) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    console.error(`Webhook failed for ${url}: ${await response.text()}`);
  }
  return response;
}

// Helper function to send a Direct Message using Google Chat API
async function sendToDm(email: string, body: Record<string, any>) {
  try {
    const serviceAccountJson = Deno.env.get("GOOGLE_CHAT_SERVICE_ACCOUNT");
    if (!serviceAccountJson) {
      throw new Error("GOOGLE_CHAT_SERVICE_ACCOUNT secret is not set.");
    }
    
    const auth = new GoogleAuth({
      credentials: JSON.parse(serviceAccountJson),
      scopes: ["https://www.googleapis.com/auth/chat.bot"],
    });

    const authToken = await auth.getAccessToken();
    
    // The Google Chat API endpoint for sending messages.
    // NOTE: This is a simplified example. A robust implementation would need to
    // manage spaces, find the DM space ID for the user email, etc.
    // This example sends a message to a hardcoded space name for demonstration.
    // To DM, you need to find the space name like 'dm/USER_ID'.
    // This requires another API call to 'findDirectMessage' which is not shown here for brevity.
    // Let's assume for now we have a space ID.
    const spaceName = `spaces/AAAAqR2n0E4`; // <-- IMPORTANT: THIS IS A PLACEHOLDER and will fail.
    
    const apiUrl = `https://chat.googleapis.com/v1/${spaceName}/messages`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`DM failed for ${email}: ${errorText}`);
    }
    return response;

  } catch (err) {
    console.error(`Error in sendToDm for ${email}: ${err.message}`);
  }
}
