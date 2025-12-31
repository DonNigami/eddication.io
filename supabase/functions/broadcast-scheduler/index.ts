import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Get environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LINE_CHANNEL_ACCESS_TOKEN =
  Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") || "";

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface BroadcastRecord {
  id: string;
  target: string;
  msg_type: string;
  message: string;
  image_url: string | null;
  flex_json: Record<string, unknown> | null;
  scheduled_at: string;
}

interface LineMessage {
  to: string;
  messages: unknown[];
}

async function sendLineMessage(broadcast: BroadcastRecord): Promise<boolean> {
  let messages: unknown[];

  if (broadcast.msg_type === "text") {
    messages = [
      {
        type: "text",
        text: broadcast.message,
      },
    ];
  } else if (broadcast.msg_type === "image") {
    messages = [
      {
        type: "image",
        originalContentUrl: broadcast.image_url,
        previewImageUrl: broadcast.image_url,
      },
    ];
  } else if (broadcast.msg_type === "flex") {
    messages = [
      {
        type: "flex",
        altText: "Message",
        contents: broadcast.flex_json,
      },
    ];
  } else {
    // Default to text
    messages = [
      {
        type: "text",
        text: broadcast.message,
      },
    ];
  }

  const payload: LineMessage = {
    to: broadcast.target,
    messages: messages,
  };

  try {
    const response = await fetch("https://api.line.biz/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(
        `LINE API error for broadcast ${broadcast.id}:`,
        error
      );
      return false;
    }

    console.log(`Broadcast ${broadcast.id} sent to ${broadcast.target}`);
    return true;
  } catch (error) {
    console.error(`Error sending broadcast ${broadcast.id}:`, error);
    return false;
  }
}

async function processBroadcastQueue(): Promise<void> {
  try {
    // Call the get_pending_broadcasts() function
    const { data: broadcasts, error } = await supabase
      .rpc("get_pending_broadcasts");

    if (error) {
      console.error("Error fetching broadcasts:", error);
      return;
    }

    if (!broadcasts || broadcasts.length === 0) {
      console.log("No broadcasts to process");
      return;
    }

    console.log(`Processing ${broadcasts.length} broadcasts`);

    // Process each broadcast
    for (const broadcast of broadcasts as BroadcastRecord[]) {
      const sent = await sendLineMessage(broadcast);

      // Call the mark_broadcast_sent() function
      const { error: updateError } = await supabase
        .rpc("mark_broadcast_sent", {
          broadcast_id: broadcast.id,
          success: sent
        });

      if (updateError) {
        console.error(
          `Error updating broadcast ${broadcast.id}:`,
          updateError
        );
      }
    }

    console.log("Broadcast queue processed successfully");
  } catch (error) {
    console.error("Error processing broadcast queue:", error);
  }
}

serve(async (req) => {
  // Verify this is called from a cron trigger or authorized source
  const authHeader = req.headers.get("authorization");

  // For testing: allow with correct auth header
  if (!authHeader?.includes("Bearer")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  await processBroadcastQueue();

  return new Response(
    JSON.stringify({ success: true, message: "Broadcasts processed" }),
    {
      headers: { "Content-Type": "application/json" },
      status: 200,
    }
  );
});

// Export for cron trigger
export async function processBroadcasts() {
  await processBroadcastQueue();
}
