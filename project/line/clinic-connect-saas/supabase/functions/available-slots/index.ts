// =====================================================
// SUPABASE EDGE FUNCTION - AVAILABLE SLOTS
// Generate and manage appointment time slots
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// =====================================================
// CONFIG & TYPES
// =====================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface Slot {
  slot_id?: string;
  doctor_id: string;
  clinic_id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
  appointment_id?: string;
}

interface DoctorSchedule {
  doctor_id: string;
  clinic_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration: number;
  break_start_time?: string;
  break_end_time?: string;
  is_available: boolean;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
  };
}

// =====================================================
// SLOT GENERATION
// =====================================================

async function generateSlotsForDay(doctorId: string, date: string): Promise<Slot[]> {
  const dayOfWeek = new Date(date).getDay();

  // Get doctor's schedule
  const { data: schedule } = await supabase
    .from('doctor_schedules')
    .select('*')
    .eq('doctor_id', doctorId)
    .eq('day_of_week', dayOfWeek)
    .single();

  if (!schedule || !schedule.is_available) {
    return [];
  }

  // Check if slots already exist
  const { data: existing } = await supabase
    .from('appointment_slots')
    .select('slot_id')
    .eq('doctor_id', doctorId)
    .eq('date', date)
    .limit(1);

  if (existing && existing.length > 0) {
    return []; // Slots already generated
  }

  return await generateTimeSlots(
    schedule.doctor_id,
    schedule.clinic_id,
    date,
    schedule.start_time,
    schedule.end_time,
    schedule.slot_duration || 30,
    schedule.break_start_time,
    schedule.break_end_time
  );
}

async function generateTimeSlots(
  doctorId: string,
  clinicId: string,
  date: string,
  startTime: string,
  endTime: string,
  durationMinutes: number,
  breakStart?: string,
  breakEnd?: string
): Promise<Slot[]> {
  const slots = [];
  let [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const endTimeMinutes = endHour * 60 + endMin;

  // Parse break times
  let breakStartMinutes = 0;
  let breakEndMinutes = 0;
  if (breakStart && breakEnd) {
    const [bsHour, bsMin] = breakStart.split(':').map(Number);
    const [beHour, beMin] = breakEnd.split(':').map(Number);
    breakStartMinutes = bsHour * 60 + bsMin;
    breakEndMinutes = beHour * 60 + beMin;
  }

  while (true) {
    const currentMinutes = startHour * 60 + startMin;

    // Check if we've reached end time
    if (currentMinutes + durationMinutes > endTimeMinutes) {
      break;
    }

    // Skip break time
    if (breakStart && breakEnd) {
      if (currentMinutes >= breakStartMinutes && currentMinutes < breakEndMinutes) {
        // Jump to after break
        startMin = breakEndMinutes % 60;
        startHour = Math.floor(breakEndMinutes / 60);
        continue;
      }
    }

    const slotTime = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
    const endSlotMinutes = currentMinutes + durationMinutes;
    const endSlotTime = `${String(Math.floor(endSlotMinutes / 60)).padStart(2, '0')}:${String(endSlotMinutes % 60).padStart(2, '0')}`;

    slots.push({
      doctor_id: doctorId,
      clinic_id: clinicId,
      date: date,
      start_time: slotTime,
      end_time: endSlotTime,
      is_available: true,
    });

    // Move to next slot
    startMin += durationMinutes;
    while (startMin >= 60) {
      startMin -= 60;
      startHour++;
    }
  }

  if (slots.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('appointment_slots')
    .insert(slots)
    .select();

  if (error) {
    console.error('Error generating slots:', error);
    return [];
  }

  return data || [];
}

async function generateSlotsForRange(
  doctorId: string,
  startDate: string,
  endDate: string
): Promise<{ date: string; slotsCreated: number }[]> {
  const results = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let date = start; date <= end; date.setDate(date.getDate() + 1)) {
    const dateStr = date.toISOString().split('T')[0];
    const slots = await generateSlotsForDay(doctorId, dateStr);
    results.push({ date: dateStr, slotsCreated: slots.length });
  }

  return results;
}

// =====================================================
// SLOT QUERIES
// =====================================================

async function getAvailableSlots(doctorId: string, date: string): Promise<Slot[]> {
  const { data, error } = await supabase
    .from('appointment_slots')
    .select('*')
    .eq('doctor_id', doctorId)
    .eq('date', date)
    .eq('is_available', true)
    .order('start_time');

  if (error) {
    console.error('Error fetching slots:', error);
    return [];
  }

  return data || [];
}

async function getSlotsForClinic(
  clinicId: string,
  date: string
): Promise<{ doctor_id: string; doctor_name: string; slots: Slot[] }[]> {
  const { data, error } = await supabase
    .from('appointment_slots')
    .select(`
      *,
      doctor:doctors(name, title)
    `)
    .eq('clinic_id', clinicId)
    .eq('date', date)
    .eq('is_available', true)
    .order('doctor_id')
    .order('start_time');

  if (error) {
    console.error('Error fetching clinic slots:', error);
    return [];
  }

  // Group by doctor
  const grouped: Record<string, { doctor_name: string; slots: Slot[] }> = {};

  for (const slot of data || []) {
    const doctorId = slot.doctor_id;
    const doctorName = `${(slot.doctor as any)?.title || ''} ${(slot.doctor as any)?.name || ''}`.trim();

    if (!grouped[doctorId]) {
      grouped[doctorId] = { doctor_name: doctorName, slots: [] };
    }

    grouped[doctorId].slots.push(slot);
  }

  return Object.entries(grouped).map(([doctor_id, value]) => ({
    doctor_id,
    doctor_name: value.doctor_name,
    slots: value.slots,
  }));
}

async function deleteSlotsForDate(doctorId: string, date: string): Promise<boolean> {
  // Only delete slots that are not booked
  const { error } = await supabase
    .from('appointment_slots')
    .delete()
    .eq('doctor_id', doctorId)
    .eq('date', date)
    .eq('is_available', true);

  if (error) {
    console.error('Error deleting slots:', error);
    return false;
  }

  return true;
}

// =====================================================
// MAIN HANDLER
// =====================================================

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const url = new URL(req.url);

  try {
    // GET /available-slots - Get available slots
    if (req.method === 'GET') {
      const doctorId = url.searchParams.get('doctor_id');
      const clinicId = url.searchParams.get('clinic_id');
      const date = url.searchParams.get('date');

      if (!date) {
        return Response.json({
          success: false,
          error: { message: 'Missing date parameter', code: 'MISSING_DATE' },
        }, { status: 400 });
      }

      if (clinicId) {
        const slots = await getSlotsForClinic(clinicId, date);
        return Response.json({ success: true, data: slots });
      }

      if (doctorId) {
        const slots = await getAvailableSlots(doctorId, date);
        return Response.json({ success: true, data: slots });
      }

      return Response.json({
        success: false,
        error: { message: 'Missing doctor_id or clinic_id', code: 'MISSING_PARAM' },
      }, { status: 400 });
    }

    // POST /available-slots/generate - Generate slots
    if (req.method === 'POST' && url.pathname.endsWith('/generate')) {
      const body = await req.json();
      const { doctor_id, date, start_date, end_date } = body;

      if (!doctor_id) {
        return Response.json({
          success: false,
          error: { message: 'Missing doctor_id', code: 'MISSING_DOCTOR' },
        }, { status: 400 });
      }

      // Single date
      if (date) {
        const slots = await generateSlotsForDay(doctor_id, date);
        return Response.json({
          success: true,
          data: {
            date,
            slotsCreated: slots.length,
            slots,
          },
        });
      }

      // Date range
      if (start_date && end_date) {
        const results = await generateSlotsForRange(doctor_id, start_date, end_date);
        const totalSlots = results.reduce((sum, r) => sum + r.slotsCreated, 0);

        return Response.json({
          success: true,
          data: {
            range: { start_date, end_date },
            totalSlots,
            results,
          },
        });
      }

      return Response.json({
        success: false,
        error: { message: 'Missing date or date range', code: 'MISSING_DATE' },
      }, { status: 400 });
    }

    // POST /available-slots/regenerate - Delete and regenerate slots
    if (req.method === 'POST' && url.pathname.endsWith('/regenerate')) {
      const body = await req.json();
      const { doctor_id, date } = body;

      if (!doctor_id || !date) {
        return Response.json({
          success: false,
          error: { message: 'Missing doctor_id or date', code: 'MISSING_PARAM' },
        }, { status: 400 });
      }

      // Delete existing unbooked slots
      await deleteSlotsForDate(doctor_id, date);

      // Generate new slots
      const slots = await generateSlotsForDay(doctor_id, date);

      return Response.json({
        success: true,
        data: {
          date,
          slotsCreated: slots.length,
          slots,
        },
      });
    }

    // DELETE /available-slots - Delete slots
    if (req.method === 'DELETE') {
      const body = await req.json();
      const { doctor_id, date } = body;

      if (!doctor_id || !date) {
        return Response.json({
          success: false,
          error: { message: 'Missing doctor_id or date', code: 'MISSING_PARAM' },
        }, { status: 400 });
      }

      const success = await deleteSlotsForDate(doctor_id, date);

      return Response.json({
        success,
        data: { deleted: success },
      });
    }

    return Response.json({
      success: false,
      error: { message: 'Not found', code: 'NOT_FOUND' },
    }, { status: 404 });

  } catch (error) {
    console.error('Error in available-slots function:', error);
    return Response.json({
      success: false,
      error: { message: 'Internal server error', code: 'INTERNAL_ERROR' },
    }, { status: 500 });
  }
});
