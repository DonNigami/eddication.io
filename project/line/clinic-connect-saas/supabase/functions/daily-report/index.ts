// =====================================================
// SUPABASE EDGE FUNCTION - DAILY REPORT (CRON)
// Generate and send daily clinic reports
// Scheduled: Every day at 20:00
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// =====================================================
// CONFIG & TYPES
// =====================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LINE_ACCESS_TOKEN = Deno.env.get('LINE_ACCESS_TOKEN')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface DailyReport {
  clinic_id: string;
  clinic_name: string;
  date: string;
  total_appointments: number;
  completed_appointments: number;
  cancelled_appointments: number;
  no_show_appointments: number;
  new_patients: number;
  total_revenue: number;
  average_wait_time: number;
  doctor_stats: DoctorStats[];
}

interface DoctorStats {
  doctor_id: string;
  doctor_name: string;
  total_patients: number;
  completed: number;
  revenue: number;
}

// =====================================================
// CRON VERIFICATION
// =====================================================

function verifyCronSecret(req: Request): boolean {
  const authHeader = req.headers.get('Authorization');
  const providedSecret = authHeader?.replace('Bearer ', '');
  const cronSecret = Deno.env.get('CRON_SECRET');

  if (!cronSecret) {
    console.warn('CRON_SECRET not set, skipping verification');
    return true;
  }

  return providedSecret === cronSecret;
}

// =====================================================
// REPORT GENERATION
// =====================================================

async function generateDailyReport(clinicId: string, date: string): Promise<DailyReport | null> {
  // Get clinic info
  const { data: clinic } = await supabase
    .from('clinics')
    .select('name')
    .eq('clinic_id', clinicId)
    .single();

  if (!clinic) return null;

  // Get appointments for the day
  const { data: appointments } = await supabase
    .from('appointments')
    .select('status, patient_id, doctor_id')
    .eq('clinic_id', clinicId)
    .eq('appointment_date', date);

  const totalAppointments = appointments?.length || 0;
  const completed = appointments?.filter(a => a.status === 'completed').length || 0;
  const cancelled = appointments?.filter(a => a.status === 'cancelled').length || 0;
  const noShow = appointments?.filter(a => a.status === 'no_show').length || 0;

  // Get new patients (patients with first appointment today)
  const { count: newPatients } = await supabase
    .from('patients')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .gte('created_at', `${date}T00:00:00`)
    .lt('created_at', `${date}T23:59:59`);

  // Get revenue for the day
  const { data: invoices } = await supabase
    .from('invoices')
    .select('total')
    .eq('clinic_id', clinicId)
    .eq('status', 'paid')
    .gte('payment_date', `${date}T00:00:00`)
    .lt('payment_date', `${date}T23:59:59`);

  const totalRevenue = invoices?.reduce((sum, inv) => sum + inv.total, 0) || 0;

  // Get doctor stats
  const { data: doctors } = await supabase
    .from('doctors')
    .select('doctor_id, name')
    .eq('clinic_id', clinicId)
    .eq('is_active', true);

  const doctorStats: DoctorStats[] = [];

  for (const doctor of doctors || []) {
    const doctorAppointments = appointments?.filter(a => a.doctor_id === doctor.doctor_id) || [];
    const completedCount = doctorAppointments.filter(a => a.status === 'completed').length;

    // Get revenue per doctor
    const { data: doctorInvoices } = await supabase
      .from('invoices')
      .select('total')
      .eq('clinic_id', clinicId)
      .eq('status', 'paid')
      .gte('payment_date', `${date}T00:00:00`)
      .lt('payment_date', `${date}T23:59:59`);

    // Note: This is simplified - real implementation would need to link invoices to doctors
    const doctorRevenue = 0; // Would calculate from invoice items linked to doctor

    doctorStats.push({
      doctor_id: doctor.doctor_id,
      doctor_name: doctor.name,
      total_patients: doctorAppointments.length,
      completed: completedCount,
      revenue: doctorRevenue,
    });
  }

  // Get average wait time
  const { data: queueData } = await supabase
    .from('queue_management')
    .select('estimated_wait_time')
    .eq('clinic_id', clinicId)
    .eq('date', date)
    .maybeSingle();

  const averageWaitTime = queueData?.estimated_wait_time || 0;

  return {
    clinic_id: clinicId,
    clinic_name: clinic.name,
    date,
    total_appointments: totalAppointments,
    completed_appointments: completed,
    cancelled_appointments: cancelled,
    no_show_appointments: noShow,
    new_patients: newPatients || 0,
    total_revenue: totalRevenue,
    average_wait_time: averageWaitTime,
    doctor_stats: doctorStats,
  };
}

// =====================================================
// NOTIFICATION
// =====================================================

async function sendDailyReportNotification(report: DailyReport): Promise<boolean> {
  // Get clinic admin users to notify
  const { data: admins } = await supabase
    .from('clinic_admins')
    .select('line_user_id')
    .eq('clinic_id', report.clinic_id)
    .eq('receive_reports', true);

  if (!admins || admins.length === 0) {
    console.log(`No admin users found for clinic ${report.clinic_id}`);
    return false;
  }

  const date = new Date(report.date);
  const dateFormatted = date.toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  let message = `📊 รายงานประจำวัน ${report.clinic_name}\n`;
  message += `📅 วันที่ ${dateFormatted}\n\n`;

  message += `🏥 สรุปการนัดหมาย\n`;
  message += `   นัดหมายทั้งหมด: ${report.total_appointments} คน\n`;
  message += `   เสร็จสิ้น: ${report.completed_appointments} คน\n`;
  message += `   ยกเลิก: ${report.cancelled_appointments} คน\n`;
  message += `   ไม่มา: ${report.no_show_appointments} คน\n`;
  message += `   คนไข้ใหม่: ${report.new_patients} คน\n\n`;

  message += `💰 รายได้: ฿${report.total_revenue.toLocaleString('th-TH')}\n\n`;

  if (report.doctor_stats.length > 0) {
    message += `👨‍⚕️ สถิติแพทย์\n`;
    for (const doc of report.doctor_stats) {
      if (doc.total_patients > 0) {
        message += `   ${doc.doctor_name}: ${doc.completed}/${doc.total_patients} คน\n`;
      }
    }
  }

  const lineUserIds = admins.map(a => a.line_user_id).filter(Boolean) as string[];

  try {
    await fetch('https://api.line.me/v2/bot/message/multicast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: lineUserIds,
        messages: [{ type: 'text', text: message }],
      }),
    });

    return true;
  } catch (error) {
    console.error('Error sending report notification:', error);
    return false;
  }
}

async function saveDailyReport(report: DailyReport): Promise<void> {
  await supabase.from('daily_reports').insert({
    clinic_id: report.clinic_id,
    report_date: report.date,
    total_appointments: report.total_appointments,
    completed_appointments: report.completed_appointments,
    cancelled_appointments: report.cancelled_appointments,
    no_show_appointments: report.no_show_appointments,
    new_patients: report.new_patients,
    total_revenue: report.total_revenue,
    average_wait_time: report.average_wait_time,
    report_data: report,
    created_at: new Date().toISOString(),
  });
}

// =====================================================
// MAIN HANDLER
// =====================================================

serve(async (req) => {
  // Verify cron secret
  if (!verifyCronSecret(req)) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Only allow POST from cron
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  console.log('Starting daily report cron job...');

  // Get date from request body or use today
  const body = await req.json().catch(() => ({}));
  const date = body.date || new Date().toISOString().split('T')[0];

  // Get all active clinics
  const { data: clinics } = await supabase
    .from('clinics')
    .select('clinic_id, name, is_active')
    .eq('is_active', true);

  if (!clinics || clinics.length === 0) {
    console.log('No active clinics found');
    return Response.json({
      success: true,
      date,
      message: 'No active clinics',
    });
  }

  console.log(`Generating reports for ${clinics.length} clinics`);

  const results = {
    date,
    total_clinics: clinics.length,
    reports_generated: 0,
    reports_sent: 0,
    reports_failed: 0,
    clinic_reports: [] as Array<{ clinic_id: string; clinic_name: string; success: boolean }>,
  };

  for (const clinic of clinics) {
    try {
      // Generate report
      const report = await generateDailyReport(clinic.clinic_id, date);

      if (!report) {
        results.reports_failed++;
        results.clinic_reports.push({
          clinic_id: clinic.clinic_id,
          clinic_name: clinic.name,
          success: false,
        });
        continue;
      }

      // Save report to database
      await saveDailyReport(report);
      results.reports_generated++;

      // Send notification
      const sent = await sendDailyReportNotification(report);
      if (sent) {
        results.reports_sent++;
      }

      results.clinic_reports.push({
        clinic_id: clinic.clinic_id,
        clinic_name: clinic.name,
        success: sent,
      });

    } catch (error) {
      console.error(`Error processing clinic ${clinic.clinic_id}:`, error);
      results.reports_failed++;
      results.clinic_reports.push({
        clinic_id: clinic.clinic_id,
        clinic_name: clinic.name,
        success: false,
      });
    }
  }

  console.log('Daily report cron job completed:', results);

  return Response.json({
    success: true,
    date,
    results,
  });
});
