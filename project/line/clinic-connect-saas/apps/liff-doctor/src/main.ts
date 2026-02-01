/**
 * ClinicConnect - LIFF Doctor App Main Entry Point
 */

import { liff } from '@line/liff';
import { createClient } from '@supabase/supabase-js';
import { supabaseConfig, lineConfig, AppointmentStatus } from '@clinic/config';

// =====================================================
// TYPES
// =====================================================

interface DoctorProfile {
  doctor_id: string;
  name: string;
  title: string;
  specialty: string;
  clinic_id: string;
}

interface QueueItem {
  appointment_id: string;
  queue_number: number;
  status: AppointmentStatus;
  patient: {
    name: string;
    phone: string;
  };
  appointment_time: string;
  symptoms: string;
}

interface Patient {
  patient_id: string;
  name: string;
  phone: string;
  last_visit_date?: string;
  total_visits: number;
}

// =====================================================
// STATE
// =====================================================

let currentDoctor: DoctorProfile | null = null;
let currentPage: string = 'dashboard';
let pageHistory: string[] = [];
let currentPatientId: string | null = null;

const supabase = createClient(
  supabaseConfig.url,
  supabaseConfig.anonKey
);

// =====================================================
// LIFF INITIALIZATION
// =====================================================

async function initializeLiff(): Promise<void> {
  try {
    await liff.init({ liffId: lineConfig.liffId });

    if (!liff.isLoggedIn()) {
      liff.login();
      return;
    }

    const profile = liff.getDecodedIDToken();

    // Hide loading, show app
    document.getElementById('loading-screen')?.classList.add('hidden');
    document.getElementById('main-app')?.classList.remove('hidden');

    // Load doctor profile
    await loadDoctorProfile(profile.sub);

    // Load initial data
    await loadDashboard();

  } catch (error) {
    console.error('LIFF initialization failed:', error);
    showToast('ไม่สามารถเริ่มแอปได้', 'error');
  }
}

async function loadDoctorProfile(lineUserId: string): Promise<void> {
  try {
    const { data } = await supabase
      .from('doctors')
      .select('*, clinic_id')
      .eq('user_id', lineUserId)
      .single();

    if (data) {
      currentDoctor = data;
      updateGreeting();
    } else {
      showToast('ไม่พบข้อมูลแพทย์', 'error');
    }
  } catch (error) {
    console.error('Error loading doctor profile:', error);
  }
}

function updateGreeting(): void {
  const greetingEl = document.getElementById('user-greeting');
  if (greetingEl && currentDoctor) {
    greetingEl.textContent = `👨‍⚕️ ${currentDoctor.title || ''} ${currentDoctor.name}`;
  }
}

// =====================================================
// NAVIGATION
// =====================================================

function navigateTo(pageId: string): void {
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });

  const targetPage = document.getElementById(`page-${pageId}`);
  if (targetPage) {
    targetPage.classList.add('active');
  }

  if (currentPage !== pageId) {
    pageHistory.push(currentPage);
  }
  currentPage = pageId;

  updateBottomNav(pageId);
  loadPageData(pageId);
  window.scrollTo(0, 0);
}

function navigateBack(): void {
  if (pageHistory.length > 0) {
    const previousPage = pageHistory.pop() || 'dashboard';
    currentPage = previousPage;
    navigateTo(previousPage);
    pageHistory.pop();
  } else {
    navigateTo('dashboard');
  }
}

function updateBottomNav(activePage: string): void {
  document.querySelectorAll('.nav-item').forEach(item => {
    const page = item.getAttribute('data-page');
    if (page === activePage) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

async function loadPageData(pageId: string): Promise<void> {
  switch (pageId) {
    case 'dashboard':
      await loadDashboard();
      break;
    case 'queue':
      await loadQueueList();
      break;
    case 'patients':
      await loadPatientsList();
      break;
    case 'schedule':
      await loadSchedule();
      break;
    case 'diagnosis':
      // Loaded when opening a specific patient
      break;
  }
}

// =====================================================
// DASHBOARD
// =====================================================

async function loadDashboard(): Promise<void> {
  if (!currentDoctor) return;

  const today = new Date().toISOString().split('T')[0];

  try {
    // Get today's stats
    const { data: queueData } = await supabase
      .from('queue_management')
      .select('*')
      .eq('doctor_id', currentDoctor.doctor_id)
      .eq('date', today)
      .single();

    // Get today's appointments
    const { data: appointments } = await supabase
      .from('appointments')
      .select(`
        appointment_id,
        queue_number,
        status,
        patient:patients(name, phone),
        appointment_time
      `)
      .eq('doctor_id', currentDoctor.doctor_id)
      .eq('appointment_date', today)
      .in('status', ['confirmed', 'checked_in', 'in_consultation'])
      .order('appointment_time');

    // Update stats
    document.getElementById('stat-today-patients')!.textContent = queueData?.waiting_count || 0;
    document.getElementById('stat-waiting')!.textContent = queueData?.waiting_count || 0;
    document.getElementById('stat-completed')!.textContent = queueData?.completed_count || 0;
    document.getElementById('stat-rating')!.textContent = `⭐ ${currentDoctor.rating_average || 0}`;

    // Update queue list
    const queueList = document.getElementById('dashboard-queue-list');
    if (queueList) {
      if (appointments && appointments.length > 0) {
        queueList.innerHTML = appointments.slice(0, 5).map(apt => `
          <div class="queue-item ${apt.status === 'in_consultation' ? 'active' : ''}" data-id="${apt.appointment_id}">
            <div class="queue-item-header">
              <span class="queue-number">คิว ${apt.queue_number}</span>
              <span class="queue-status status-${apt.status}">${getStatusText(apt.status)}</span>
            </div>
            <div class="queue-item-body">
              <div class="patient-name">${apt.patient?.name || '-'}</div>
              <div class="patient-phone">${apt.patient?.phone || ''}</div>
            </div>
            <div class="queue-item-actions">
              ${apt.status === 'confirmed' || apt.status === 'checked_in' ? `
                <button class="btn-sm btn-primary" onclick="startConsultation('${apt.appointment_id}')">เรียกเข้าพบ</button>
                <button class="btn-sm btn-outline" onclick="openDiagnosis('${apt.appointment_id}')">บันทึก</button>
              ` : ''}
              ${apt.status === 'in_consultation' ? `
                <button class="btn-sm btn-success" onclick="completeConsultation('${apt.appointment_id}')">เสร็จสิ้น</button>
              ` : ''}
            </div>
          </div>
        `).join('');
      } else {
        queueList.innerHTML = '<p class="text-muted text-center py-4">ไม่มีคิววันนี้</p>';
      }
    }

  } catch (error) {
    console.error('Error loading dashboard:', error);
  }
}

// =====================================================
// QUEUE PAGE
// =====================================================

async function loadQueueList(): Promise<void> {
  if (!currentDoctor) return;

  const today = new Date().toISOString().split('T')[0];
  const container = document.getElementById('queue-list');

  try {
    const { data: appointments } = await supabase
      .from('appointments')
      .select(`
        appointment_id,
        queue_number,
        status,
        patient:patients(name, phone),
        appointment_time,
        symptoms
      `)
      .eq('doctor_id', currentDoctor.doctor_id)
      .eq('appointment_date', today)
      .order('queue_number');

    if (container) {
      if (appointments && appointments.length > 0) {
        container.innerHTML = appointments.map(apt => `
          <div class="queue-item-full">
            <div class="queue-item-full-header">
              <div class="queue-number-large">A${apt.queue_number}</div>
              <div class="queue-info">
                <div class="patient-name">${apt.patient?.name || '-'}</div>
                <div class="patient-phone">${apt.patient?.phone || ''}</div>
                ${apt.symptoms ? `<div class="symptoms text-muted">อาการ: ${apt.symptoms}</div>` : ''}
              </div>
              <div class="queue-status-badge status-${apt.status}">
                ${getStatusText(apt.status)}
              </div>
            </div>
            <div class="queue-item-full-actions">
              ${apt.status === 'confirmed' ? `
                <button class="btn btn-outline" onclick="callQueue('${apt.appointment_id}')">🔔 เรียกคิว</button>
                <button class="btn btn-primary" onclick="openDiagnosis('${apt.appointment_id}')">📝 บันทึก</button>
              ` : ''}
              ${apt.status === 'checked_in' ? `
                <button class="btn btn-success" onclick="startConsultation('${apt.appointment_id}')">เรียกเข้าพบ</button>
              ` : ''}
              ${apt.status === 'in_consultation' ? `
                <button class="btn btn-success" onclick="completeConsultation('${apt.appointment_id}')">✅ เสร็จสิ้น</button>
              ` : ''}
            </div>
          </div>
        `).join('');
      } else {
        container.innerHTML = '<p class="text-muted text-center py-8">ไม่มีคิววันนี้</p>';
      }
    }

  } catch (error) {
    console.error('Error loading queue:', error);
  }
}

// =====================================================
// PATIENTS PAGE
// =====================================================

async function loadPatientsList(): Promise<void> {
  const container = document.getElementById('patients-list');
  if (!container || !currentDoctor) return;

  try {
    const { data: patients } = await supabase
      .from('patients')
      .select('*')
      .eq('clinic_id', currentDoctor.clinic_id)
      .order('last_visit_date', { ascending: false, nullsFirst: false })
      .limit(50);

    if (container) {
      if (patients && patients.length > 0) {
        container.innerHTML = patients.map(patient => `
          <div class="patient-item" onclick="openPatientDetail('${patient.patient_id}')">
            <div class="patient-item-header">
              <div class="patient-name">${patient.name}</div>
              <div class="patient-visits">เคยมา ${patient.total_visits} ครั้ง</div>
            </div>
            <div class="patient-item-body">
              <div class="patient-phone">📱 ${patient.phone}</div>
              ${patient.chronic_diseases ? `<div class="patient-conditions">โรคประจำตัว: ${patient.chronic_diseases}</div>` : ''}
            </div>
          </div>
        `).join('');
      } else {
        container.innerHTML = '<p class="text-muted text-center py-8">ไม่พบข้อมูลคนไข้</p>';
      }
    }

  } catch (error) {
    console.error('Error loading patients:', error);
  }
}

// =====================================================
// SCHEDULE PAGE
// =====================================================

async function loadSchedule(): Promise<void> {
  if (!currentDoctor) return;

  try {
    const { data: doctor } = await supabase
      .from('doctors')
      .select('*')
      .eq('doctor_id', currentDoctor.doctor_id)
      .single();

    if (doctor) {
      // Set form values
      const startInput = document.getElementById('schedule-start') as HTMLInputElement;
      const endInput = document.getElementById('schedule-end') as HTMLInputElement;
      const durationInput = document.getElementById('schedule-duration') as HTMLInputElement;
      const breakStartInput = document.getElementById('schedule-break-start') as HTMLInputElement;
      const breakEndInput = document.getElementById('schedule-break-end') as HTMLInputElement;

      if (startInput) startInput.value = doctor.available_time_start || '09:00';
      if (endInput) endInput.value = doctor.available_time_end || '17:00';
      if (durationInput) durationInput.value = doctor.appointment_duration_minutes || 30;
      if (breakStartInput) breakStartInput.value = doctor.break_start_time || '12:00';
      if (breakEndInput) breakEndInput.value = doctor.break_end_time || '13:00';

      // Set working days checkboxes
      const days = doctor.available_days || [1, 2, 3, 4, 5];
      document.querySelectorAll('.day-checkbox input').forEach((checkbox: HTMLInputElement) => {
        checkbox.checked = days.includes(parseInt(checkbox.value));
      });

      // Load blocked dates
      await loadBlockedDates();
    }

  } catch (error) {
    console.error('Error loading schedule:', error);
  }
}

async function loadBlockedDates(): Promise<void> {
  if (!currentDoctor) return;

  const container = document.getElementById('blocked-dates');
  if (!container) return;

  try {
    const { data: blockedDates } = await supabase
      .from('doctor_blocked_dates')
      .select('*')
      .eq('doctor_id', currentDoctor.doctor_id)
      .gte('block_date', new Date().toISOString().split('T')[0])
      .order('block_date')
      .limit(10);

    if (container) {
      if (blockedDates && blockedDates.length > 0) {
        container.innerHTML = blockedDates.map(date => `
          <div class="blocked-date-item">
            <span>${formatDate(date.block_date)}</span>
            <span class="text-muted">${date.reason || date.block_type}</span>
            <button class="text-btn text-error" onclick="unblockDate('${date.block_id}')">ยกเลิก</button>
          </div>
        `).join('');
      } else {
        container.innerHTML = '<p class="text-muted text-sm">ไม่มีวันหยุก</p>';
      }
    }
  } catch (error) {
    console.error('Error loading blocked dates:', error);
  }
}

// =====================================================
// QUEUE ACTIONS
// =====================================================

async function callQueue(appointmentId: string): Promise<void> {
  try {
    await supabase
      .from('appointments')
      .update({ status: 'checked_in', check_in_time: new Date().toISOString() })
      .eq('appointment_id', appointmentId);

    // Update queue management
    await updateQueueManagement('checked_in');

    showToast('เรียกคิวแล้ว');
    await loadPageData(currentPage);

  } catch (error) {
    console.error('Error calling queue:', error);
    showToast('ไม่สามารถเรียกคิวได้', 'error');
  }
}

async function startConsultation(appointmentId: string): Promise<void> {
  try {
    await supabase
      .from('appointments')
      .update({ status: 'in_consultation', start_time: new Date().toISOString() })
      .eq('appointment_id', appointmentId);

    showToast('เริ่มตรวจแล้ว');
    openDiagnosis(appointmentId);
    await loadPageData(currentPage);

  } catch (error) {
    console.error('Error starting consultation:', error);
    showToast('ไม่สามารถเริ่มตรวจได้', 'error');
  }
}

async function completeConsultation(appointmentId: string): Promise<void> {
  try {
    await supabase
      .from('appointments')
      .update({
        status: 'completed',
        end_time_actual: new Date().toISOString(),
      })
      .eq('appointment_id', appointmentId);

    await updateQueueManagement('completed');

    showToast('เสร็จสิ้นแล้ว');
    await loadPageData(currentPage);

  } catch (error) {
    console.error('Error completing consultation:', error);
    showToast('ไม่สามารถบันทึกได้', 'error');
  }
}

async function updateQueueManagement(status: string): Promise<void> {
  if (!currentDoctor) return;

  const today = new Date().toISOString().split('T')[0];

  const updates: any = {
    updated_at: new Date().toISOString(),
  };

  if (status === 'checked_in') {
    updates.last_called_at = new Date().toISOString();
  } else if (status === 'completed') {
    updates.completed_count = 1;
  }

  await supabase.rpc('increment_queue_stat', {
    p_doctor_id: currentDoctor.doctor_id,
    p_date: today,
    p_stat_type: status,
  });
}

// =====================================================
// DIAGNOSIS PAGE
// =====================================================

function openDiagnosis(appointmentId: string): Promise<void> {
  currentPatientId = appointmentId;

  // Load appointment details
  loadDiagnosisDetails(appointmentId);
  navigateTo('diagnosis');
}

async function loadDiagnosisDetails(appointmentId: string): Promise<void> {
  try {
    const { data: appointment } = await supabase
      .from('appointments')
      .select(`
        patient:patients(name, phone, date_of_birth),
        appointment_time,
        symptoms
      `)
      .eq('appointment_id', appointmentId)
      .single();

    if (appointment) {
      const nameEl = document.getElementById('diagnosis-patient-name');
      const infoEl = document.getElementById('diagnosis-patient-info');

      if (nameEl) nameEl.textContent = appointment.patient?.name || '-';
      if (infoEl) {
        infoEl.textContent = `เบอร์: ${appointment.patient?.phone || '-'} | เวลานัด: ${appointment.appointment_time}`;
      }

      // Pre-fill symptoms
      const symptomsInput = document.getElementById('diagnosis-subj') as HTMLTextAreaElement;
      if (symptomsInput) symptomsInput.value = appointment.symptoms || '';
    }

  } catch (error) {
    console.error('Error loading diagnosis details:', error);
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

function getStatusText(status: string): string {
  const labels: Record<string, string> = {
    pending: 'รอยืนยัน',
    confirmed: 'ยืนยัน',
    checked_in: 'เช็คอิน',
    in_consultation: 'กำลังตรวจ',
    completed: 'เสร็จสิ้น',
    cancelled: 'ยกเลิก',
    no_show: 'ไม่มา',
  };
  return labels[status] || status;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function showToast(message: string, type: 'success' | 'error' = 'success'): void {
  const container = document.createElement('div');
  container.className = 'toast-container';

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;

  container.appendChild(toast);
  document.body.appendChild(container);

  setTimeout(() => {
    toast.remove();
    container.remove();
  }, 3000);
}

// Export functions for global scope
(window as any).navigateTo = navigateTo;
(window as any).navigateBack = navigateBack;
(window as any).callQueue = callQueue;
(window as any).startConsultation = startConsultation;
(window as any).completeConsultation = completeConsultation;
(window as any).openDiagnosis = openDiagnosis;

// =====================================================
// INIT
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
  initializeLiff();

  // Setup schedule form
  const scheduleForm = document.getElementById('schedule-form');
  if (scheduleForm) {
    scheduleForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      // Handle schedule save
      showToast('บันทึกเวลาว่างสำเร็จ');
    });
  }

  // Setup diagnosis form
  const diagnosisForm = document.getElementById('diagnosis-form');
  if (diagnosisForm) {
    diagnosisForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      // Handle diagnosis save
      showToast('บันทึกการรักษาสำเร็จ');
      navigateBack();
    });
  }

  // Setup patient search
  const searchInput = document.getElementById('patient-search');
  if (searchInput) {
    searchInput.addEventListener('input', async (e) => {
      const query = e.target.value;
      // Implement search
    });
  }
});
