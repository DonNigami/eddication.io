// Follow this setup guide: https://supabase.com/docs/guides/functions/quickstart
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Placeholder for sending email
async function sendEmail(to: string, subject: string, body: string, attachments: any[] = []) {
  console.log(`Simulating email send to ${to}: Subject="${subject}", Body="${body}"`);
  // In a real scenario, integrate with an email sending service like SendGrid, Mailgun, etc.
  // const res = await fetch('YOUR_EMAIL_SERVICE_API_ENDPOINT', { /* ... */ });
  // if (!res.ok) throw new Error('Failed to send email');
}

// Placeholder for sending LINE Notify
async function sendLineNotify(token: string, message: string, imageThumbnail?: string, imageFullsize?: string) {
  console.log(`Simulating LINE Notify to token ${token}: Message="${message}"`);
  // In a real scenario, integrate with LINE Notify API
  // const res = await fetch('https://notify-api.line.me/api/notify', { /* ... */ });
  // if (!res.ok) throw new Error('Failed to send LINE Notify');
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 405,
    })
  }

  const { report_type, schedule_id } = await req.json()

  if (!report_type || !schedule_id) {
    return new Response(JSON.stringify({ error: 'Missing report_type or schedule_id' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    })
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' 
  )

  try {
    console.log(`Generating report for schedule_id: ${schedule_id}, type: ${report_type}`)

    // Fetch schedule details to get recipients
    const { data: schedule, error: scheduleError } = await supabaseClient
      .from('report_schedules')
      .select('report_name, recipients')
      .eq('id', schedule_id)
      .single()

    if (scheduleError) throw scheduleError

    let reportContent = `Report Type: ${report_type}, Schedule ID: ${schedule_id}\n\n`;
    let fileName = `${schedule.report_name.replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.txt`; // Generate dynamic file name

    switch (report_type) {
      case 'driver_performance':
        reportContent += 'This is a driver performance report (placeholder data).\n';
        // TODO: Implement actual data fetching and report generation logic
        break;
      case 'job_summary':
        reportContent += 'This is a job summary report (placeholder data).\n';
        // TODO: Implement actual data fetching and report generation logic
        break;
      default:
        reportContent += 'Unknown report type.\n';
        break;
    }

    // TODO: Upload generated report (e.g., CSV, PDF) to Supabase Storage
    // const { data: storageData, error: storageError } = await supabaseClient.storage.from('reports').upload(fileName, reportContent, { contentType: 'text/csv' });
    // if (storageError) throw storageError;
    // const publicUrl = storageData.publicURL;

    // Send report to recipients
    if (schedule.recipients && Array.isArray(schedule.recipients)) {
      for (const recipient of schedule.recipients) {
        if (recipient.type === 'email' && recipient.address) {
          await sendEmail(recipient.address, `Scheduled Report: ${schedule.report_name}`, reportContent); // Attach report via URL if available
        } else if (recipient.type === 'line' && recipient.id) {
          // For LINE Notify, 'id' here would actually be the user's personal token or a group token
          // For simplicity, we'll use 'id' as a placeholder for the token.
          await sendLineNotify(recipient.id, `รายงานตามกำหนดการ: ${schedule.report_name}\n${reportContent.substring(0, 100)}...`);
        }
      }
    }


    // Update schedule status
    const { error: updateError } = await supabaseClient
      .from('report_schedules')
      .update({
        last_generated_at: new Date().toISOString(),
        // TODO: Logic to calculate next_generation_at based on frequency would go here
      })
      .eq('id', schedule_id)

    if (updateError) throw updateError

    return new Response(JSON.stringify({ message: `Report "${report_type}" generated and sent for schedule "${schedule_id}"