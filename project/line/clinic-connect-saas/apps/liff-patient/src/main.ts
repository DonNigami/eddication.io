/**
 * ClinicConnect - LIFF Patient App Main Entry Point
 */

import { liff } from '@line/liff';
import { createClient } from '@supabase/supabase-js';
import { AppointmentStatus } from '@clinic/config';

// =====================================================
// ENVIRONMENT VARIABLES
// =====================================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const LINE_LIFF_ID = import.meta.env.VITE_LINE_LIFF_ID || '';

// =====================================================
// TYPES
// =====================================================

interface User {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  email?: string;
}

interface Appointment {
  appointment_id: string;
  appointment_date: string;
  appointment_time: string;
  queue_number: number;
  status: AppointmentStatus;
  doctor: {
    name: string;
    specialty: string;
  };
}

interface NewsArticle {
  article_id: string;
  title: string;
  excerpt: string;
  cover_image: string;
  created_at: string;
}

// =====================================================
// STATE
// =====================================================

let currentUser: User | null = null;
let currentPage: string = 'home';
let pageHistory: string[] = [];

// Supabase client
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// =====================================================
// LIFF INITIALIZATION
// =====================================================

async function initializeLiff(): Promise<void> {
  try {
    await liff.init({ liffId: LINE_LIFF_ID });

    if (!liff.isLoggedIn()) {
      liff.login();
      return;
    }

    // Get user profile
    const profile = liff.getDecodedIDToken();
    currentUser = {
      userId: profile.sub,
      displayName: profile.name || 'ผู้ใช้',
      pictureUrl: profile.picture,
    };

    // Hide loading, show app
    document.getElementById('loading-screen')?.classList.add('hidden');
    document.getElementById('main-app')?.classList.remove('hidden');

    // Update UI with user info
    updateGreeting();

    // Check if user is registered
    const patient = await checkUserRegistration(currentUser.userId);

    if (!patient) {
      // User not registered, show registration page
      navigateTo('register');
      return;
    }

    // Load initial data
    await loadHomePage();

  } catch (error) {
    console.error('LIFF initialization failed:', error);
    showToast('ไม่สามารถเริ่มแอปได้ กรุณาลองใหม่', 'error');
  }
}

// =====================================================
// NAVIGATION
// =====================================================

function navigateTo(pageId: string): void {
  // Hide current page
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });

  // Show target page
  const targetPage = document.getElementById(`page-${pageId}`);
  if (targetPage) {
    targetPage.classList.add('active');
  }

  // Update history
  if (currentPage !== pageId) {
    pageHistory.push(currentPage);
  }
  currentPage = pageId;

  // Update bottom nav
  updateBottomNav(pageId);

  // Load page data
  loadPageData(pageId);

  // Scroll to top
  window.scrollTo(0, 0);
}

function navigateBack(): void {
  if (pageHistory.length > 0) {
    const previousPage = pageHistory.pop() || 'home';
    currentPage = previousPage;
    navigateTo(previousPage);
    pageHistory.pop(); // Remove the page we just navigated to
  } else {
    navigateTo('home');
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

// =====================================================
// UI UPDATES
// =====================================================

function updateGreeting(): void {
  const greetingEl = document.getElementById('user-greeting');
  if (greetingEl && currentUser) {
    greetingEl.textContent = `สวัสดี, ${currentUser.displayName}`;
  }
}

function showToast(message: string, type: 'success' | 'error' | 'warning' = 'success'): void {
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

// =====================================================
// DATA LOADING
// =====================================================

async function loadPageData(pageId: string): Promise<void> {
  switch (pageId) {
    case 'home':
      await loadHomePage();
      break;
    case 'booking':
      await loadBookingPage();
      break;
    case 'queue':
      await loadQueuePage();
      break;
    case 'records':
      await loadRecordsPage();
      break;
    case 'notifications':
      await loadNotificationsPage();
      break;
    case 'profile':
      await loadProfilePage();
      break;
    case 'register':
      // Registration page doesn't need additional data loading
      break;
  }
}

async function loadHomePage(): Promise<void> {
  await Promise.all([
    loadNextAppointment(),
    loadMyQueue(),
    loadNews(),
  ]);
}

async function loadNextAppointment(): Promise<void> {
  const container = document.getElementById('next-appointment');
  if (!container) return;

  try {
    const { data: appointments } = await supabase
      .from('appointments')
      .select(`
        appointment_id,
        appointment_date,
        appointment_time,
        queue_number,
        status,
        doctor:doctors(name, specialty)
      `)
      .gte('appointment_date', new Date().toISOString().split('T')[0])
      .in('status', ['pending', 'confirmed'])
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true })
      .limit(1);

    if (appointments && appointments.length > 0) {
      const appointment = appointments[0];
      container.innerHTML = `
        <div class="appointment-info">
          <div class="appointment-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 12h-4l-3 9-9-5-2-3 3V4a2 2 0 01-2 2v2a2 2 0 012 2z" />
              <path d="M12 7v5a2 2 0 002 2" />
            </svg>
          </div>
          <div class="appointment-details">
            <div class="appointment-doctor">${((appointment.doctor as any)?.[0]?.name || (appointment.doctor as any)?.name) || 'แพทย์'}</div>
            <div class="appointment-datetime">
              ${formatDate(appointment.appointment_date)} · ${formatTime(appointment.appointment_time)}
            </div>
            <div class="appointment-queue">
              คิว: ${appointment.queue_number || '-'}
            </div>
          </div>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="no-appointment">
          <p>ไม่มีนัดหมายที่กำลังจะถึง</p>
          <button class="btn btn-primary mt-sm" onclick="navigateTo('booking')">
            จองนัดหมาย
          </button>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading appointment:', error);
  }
}

async function loadMyQueue(): Promise<void> {
  const container = document.getElementById('my-queue');
  if (!container) return;

  try {
    const today = new Date().toISOString().split('T')[0];

    const { data: queueData } = await supabase
      .from('queue_management')
      .select('*')
      .eq('date', today)
      .maybeSingle();

    if (!queueData) {
      container.innerHTML = `<div class="queue-placeholder"><p>ไม่มีคิววันนี้</p></div>`;
      return;
    }

    // Get user's queue for today
    const { data: myAppointment } = await supabase
      .from('appointments')
      .select('queue_number, status, doctor:doctors(name)')
      .eq('appointment_date', today)
      .in('status', ['confirmed', 'checked_in', 'in_consultation'])
      .maybeSingle();

    if (myAppointment) {
      const waitingAhead = Math.max(0, queueData.current_queue - myAppointment.queue_number);
      const waitMinutes = waitingAhead * 30;

      container.innerHTML = `
        <div class="queue-status">
          <div>
            <div class="text-muted text-sm">คิวของคุณ</div>
            <div class="queue-current">${myAppointment.queue_number || '-'}</div>
          </div>
          <div class="queue-waiting">
            <div class="queue-waiting-count">${waitingAhead}</div>
            <div class="queue-waiting-label">รอ ${waitingAhead} คน</div>
          </div>
        </div>
        <div class="queue-estimate">
          เวลารอคอยโดยประมาณ ~${waitMinutes} นาที
          <br>
          <small>แพทย์: ${((myAppointment.doctor as any)?.[0]?.name || (myAppointment.doctor as any)?.name) || '-'}</small>
        </div>
      `;
    } else {
      container.innerHTML = `<div class="queue-placeholder"><p>ไม่มีคิววันนี้</p></div>`;
    }
  } catch (error) {
    console.error('Error loading queue:', error);
  }
}

async function loadNews(): Promise<void> {
  const container = document.getElementById('news-list');
  if (!container) return;

  try {
    const { data: articles } = await supabase
      .from('articles')
      .select('article_id, title, excerpt, cover_image, created_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(3);

    if (articles && articles.length > 0) {
      container.innerHTML = articles.map(article => `
        <div class="news-item">
          <img
            src="${article.cover_image || '/placeholder-news.png'}"
            alt="${article.title}"
            class="news-image"
            onerror="this.src='/placeholder-news.png'"
          >
          <div class="news-content">
            <div class="news-title">${article.title}</div>
            <div class="news-meta">${formatDate(article.created_at)}</div>
          </div>
        </div>
      `).join('');
    } else {
      container.innerHTML = `<p class="text-muted text-center">ไม่มีข่าวสาร</p>`;
    }
  } catch (error) {
    console.error('Error loading news:', error);
  }
}

async function loadBookingPage(): Promise<void> {
  // Load doctors list
  const select = document.getElementById('doctor-select') as HTMLSelectElement;
  if (!select) return;

  try {
    const { data: doctors } = await supabase
      .from('doctors')
      .select('doctor_id, name, title, specialty')
      .eq('is_available', true)
      .order('name');

    // Clear existing options except first
    select.innerHTML = '<option value="">-- กรุณาเลือกแพทย์ --</option>';

    if (doctors && doctors.length > 0) {
      doctors.forEach(doctor => {
        const option = document.createElement('option');
        option.value = doctor.doctor_id;
        option.textContent = `${doctor.title || ''} ${doctor.name}${doctor.specialty ? ` - ${doctor.specialty}` : ''}`;
        select.appendChild(option);
      });
    }

    // Initialize date selector
    initializeDateSelector();

    // Add event listeners
    select.addEventListener('change', handleDoctorChange);

  } catch (error) {
    console.error('Error loading doctors:', error);
  }
}

async function loadQueuePage(): Promise<void> {
  // Similar to home queue but with more detail
  await loadMyQueue();
}

async function loadRecordsPage(): Promise<void> {
  const container = document.getElementById('records-list');
  if (!container) return;

  try {
    const { data: records } = await supabase
      .from('medical_records')
      .select(`
        record_id,
        created_at,
        diagnosis,
        treatment_plan,
        prescription,
        doctor:doctors(name, title),
        appointment:appointments(appointment_date)
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    if (records && records.length > 0) {
      container.innerHTML = records.map(record => `
        <div class="card mb-md">
          <div class="card-body">
            <div class="flex justify-between mb-sm">
              <strong>${((record.doctor as any)?.[0]?.title || (record.doctor as any)?.title) || ''} ${((record.doctor as any)?.[0]?.name || (record.doctor as any)?.name) || 'แพทย์'}</strong>
              <span class="text-muted">${formatDate(record.created_at)}</span>
            </div>
            <div class="mb-sm">
              <span class="text-muted">วินิจฉัย:</span>
              <p>${record.diagnosis || '-'}</p>
            </div>
            <div class="mb-sm">
              <span class="text-muted">การรักษา:</span>
              <p>${record.treatment_plan || '-'}</p>
            </div>
            <div>
              <span class="text-muted">ยา:</span>
              <p>${record.prescription || '-'}</p>
            </div>
          </div>
        </div>
      `).join('');
    } else {
      container.innerHTML = `
        <div class="text-center p-lg">
          <p class="text-muted">ไม่พบประวัติการรักษา</p>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading records:', error);
  }
}

async function loadNotificationsPage(): Promise<void> {
  const container = document.getElementById('notifications-list');
  if (!container || !currentUser) return;

  try {
    const { data: notifications } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', currentUser.userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (notifications && notifications.length > 0) {
      container.innerHTML = notifications.map(notification => `
        <div class="card mb-sm ${notification.is_read ? '' : 'unread'}">
          <div class="card-body">
            <div class="font-semibold mb-sm">${notification.title || 'แจ้งเตือน'}</div>
            <p class="text-muted">${notification.message}</p>
            <span class="text-xs text-muted">${formatDateTime(notification.created_at)}</span>
          </div>
        </div>
      `).join('');
    } else {
      container.innerHTML = `
        <div class="text-center p-lg">
          <p class="text-muted">ไม่มีการแจ้งเตือน</p>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading notifications:', error);
  }
}

async function loadProfilePage(): Promise<void> {
  const container = document.getElementById('profile-card');
  if (!container || !currentUser) return;

  try {
    const { data: patient } = await supabase
      .from('patients')
      .select('*')
      .eq('user_id', currentUser.userId)
      .maybeSingle();

    container.innerHTML = `
      <div class="text-center mb-lg">
        <img
          src="${currentUser.pictureUrl || '/placeholder-avatar.png'}"
          alt="${currentUser.displayName}"
          class="profile-avatar"
          onerror="this.src='/placeholder-avatar.png'"
          style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover;"
        >
        <h2 class="mt-md">${patient?.name || currentUser.displayName}</h2>
        <p class="text-muted">${patient?.phone || ''}</p>
      </div>

      <div class="card">
        <div class="card-body">
          <div class="mb-md">
            <label class="text-muted text-sm">วันเกิด</label>
            <p>${patient?.date_of_birth ? formatDate(patient.date_of_birth) : '-'}</p>
          </div>
          <div class="mb-md">
            <label class="text-muted text-sm">กรุ๊ปเลือด</label>
            <p>${patient?.gender || '-'}</p>
          </div>
          <div class="mb-md">
            <label class="text-muted text-sm">โรคประจำตัว</label>
            <p>${patient?.chronic_diseases || '-'}</p>
          </div>
          <div class="mb-md">
            <label class="text-muted text-sm">ประวัติแพ้ยา</label>
            <p>${patient?.allergies || '-'}</p>
          </div>
        </div>
      </div>

      <button class="btn btn-outline" style="width: 100%; margin-top: var(--spacing-md);">
        แก้ไขข้อมูล
      </button>
    `;
  } catch (error) {
    console.error('Error loading profile:', error);
  }
}

// =====================================================
// BOOKING PAGE LOGIC
// =====================================================

function initializeDateSelector(): void {
  const container = document.getElementById('date-selector');
  if (!container) return;

  const days = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  const today = new Date();
  const dates: Date[] = [];

  // Generate next 14 days
  for (let i = 0; i < 14; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push(date);
  }

  container.innerHTML = dates.map(date => {
    const dateStr = date.toISOString().split('T')[0];
    const dayName = days[date.getDay()];
    const dayNumber = date.getDate();
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    return `
      <button
        type="button"
        class="date-btn ${isWeekend ? 'weekend' : ''}"
        data-date="${dateStr}"
        ${isWeekend ? 'disabled' : ''}
        onclick="selectDate('${dateStr}')"
      >
        <span class="date-day">${dayName}</span>
        <span class="date-number">${dayNumber}</span>
      </button>
    `;
  }).join('');
}

(window as any).selectDate = async (dateStr: string): Promise<void> => {
  // Update UI
  document.querySelectorAll('.date-btn').forEach(btn => {
    btn.classList.remove('selected');
    if (btn.getAttribute('data-date') === dateStr) {
      btn.classList.add('selected');
    }
  });

  // Update hidden input
  const dateInput = document.getElementById('selected-date') as HTMLInputElement;
  if (dateInput) {
    dateInput.value = dateStr;
  }

  // Load time slots
  await loadTimeSlots(dateStr);
};

async function loadTimeSlots(date: string): Promise<void> {
  const container = document.getElementById('time-selector');
  const doctorSelect = document.getElementById('doctor-select') as HTMLSelectElement;
  if (!container || !doctorSelect) return;

  const doctorId = doctorSelect.value;
  if (!doctorId) {
    container.innerHTML = `<p class="text-muted">กรุณาเลือกแพทย์ก่อน</p>`;
    return;
  }

  try {
    // Get doctor's available time
    const { data: doctor } = await supabase
      .from('doctors')
      .select('available_time_start, available_time_end, appointment_duration_minutes')
      .eq('doctor_id', doctorId)
      .maybeSingle();

    const startTime = doctor?.available_time_start || '09:00';
    const endTime = doctor?.available_time_end || '17:00';
    const duration = doctor?.appointment_duration_minutes || 30;

    // Generate time slots
    const slots = generateTimeSlots(startTime, endTime, duration);

    // Get booked slots
    const { data: bookedSlots } = await supabase
      .from('appointment_slots')
      .select('start_time')
      .eq('doctor_id', doctorId)
      .eq('date', date)
      .eq('is_available', false);

    const bookedTimes = new Set(bookedSlots?.map(s => s.start_time) || []);

    container.innerHTML = slots.map(slot => {
      const isBooked = bookedTimes.has(slot);
      return `
        <button
          type="button"
          class="time-btn"
          data-time="${slot}"
          ${isBooked ? 'disabled' : ''}
          onclick="selectTime('${slot}')"
        >
          ${slot}
        </button>
      `;
    }).join('');

  } catch (error) {
    console.error('Error loading time slots:', error);
  }
}

function generateTimeSlots(start: string, end: string, duration: number): string[] {
  const slots: string[] = [];
  let [startHour, startMin] = start.split(':').map(Number);
  const [endHour, endMin] = end.split(':').map(Number);

  while (startHour < endHour || (startHour === endHour && startMin < endMin)) {
    const timeStr = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
    slots.push(timeStr);

    // Add duration
    startMin += duration;
    if (startMin >= 60) {
      startHour += Math.floor(startMin / 60);
      startMin = startMin % 60;
    }
  }

  return slots;
}

(window as any).selectTime = (timeStr: string): void => {
  // Update UI
  document.querySelectorAll('.time-btn').forEach(btn => {
    btn.classList.remove('selected');
    if (btn.getAttribute('data-time') === timeStr) {
      btn.classList.add('selected');
    }
  });

  // Update hidden input
  const timeInput = document.getElementById('selected-time') as HTMLInputElement;
  if (timeInput) {
    timeInput.value = timeStr;
  }
};

async function handleDoctorChange(): Promise<void> {
  const dateInput = document.getElementById('selected-date') as HTMLInputElement;
  if (dateInput.value) {
    await loadTimeSlots(dateInput.value);
  }
}

// =====================================================
// REGISTRATION
// =====================================================

interface Patient {
  patient_id: string;
  user_id?: string;
  line_user_id?: string;
  phone: string;
  id_card_number: string;
  name: string;
  date_of_birth?: string;
  gender?: string;
  chronic_diseases?: string;
  allergies?: string;
}

async function checkUserRegistration(lineUserId: string): Promise<Patient | null> {
  try {
    // First check if there's a users record with this LINE user_id
    const { data: user } = await supabase
      .from('users')
      .select('user_id')
      .eq('line_user_id', lineUserId)
      .maybeSingle();

    if (user) {
      // User exists, check for patient record
      const { data: patient } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', user.user_id)
        .maybeSingle();

      return patient;
    }

    // No user record found
    return null;
  } catch (error) {
    console.error('Error checking registration:', error);
    return null;
  }
}

async function handleRegistrationSubmit(e: Event): Promise<void> {
  e.preventDefault();

  if (!currentUser) {
    showToast('ไม่พบข้อมูลผู้ใช้', 'error');
    return;
  }

  const phoneInput = document.getElementById('reg-phone') as HTMLInputElement;
  const idCardInput = document.getElementById('reg-id-card') as HTMLInputElement;
  const nameInput = document.getElementById('reg-name') as HTMLInputElement;
  const dobInput = document.getElementById('reg-dob') as HTMLInputElement;
  const chronicInput = document.getElementById('reg-chronic') as HTMLTextAreaElement;
  const allergiesInput = document.getElementById('reg-allergies') as HTMLTextAreaElement;

  // Get selected gender
  const genderInput = document.querySelector('input[name="reg-gender"]:checked') as HTMLInputElement;

  // Validation
  if (!phoneInput.value || !idCardInput.value || !nameInput.value) {
    showToast('กรุณากรอกข้อมูลให้ครบถ้วน', 'warning');
    return;
  }

  // Validate phone number (Thai format: 10 digits starting with 0)
  const phoneRegex = /^0[0-9]{8,9}$/;
  const cleanPhone = phoneInput.value.replace(/-/g, '');
  if (!phoneRegex.test(cleanPhone)) {
    showToast('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง', 'warning');
    return;
  }

  // Validate ID card (13 digits for Thai ID)
  const idCardRegex = /^[0-9]{13}$/;
  const cleanIdCard = idCardInput.value.replace(/-/g, '');
  if (!idCardRegex.test(cleanIdCard)) {
    showToast('กรุณากรอกเลขบัตรประชาชน 13 หลัก', 'warning');
    return;
  }

  try {
    // Check if ID card already exists
    const { data: existingPatient } = await supabase
      .from('patients')
      .select('patient_id')
      .eq('id_card_number', cleanIdCard)
      .maybeSingle();

    if (existingPatient) {
      showToast('เลขบัตรประชาชนนี้ได้ถูกลงทะเบียนแล้ว', 'error');
      return;
    }

    // First create or get the user record
    let userId: string | undefined;

    const { data: existingUser } = await supabase
      .from('users')
      .select('user_id')
      .eq('line_user_id', currentUser.userId)
      .maybeSingle();

    if (existingUser) {
      userId = existingUser.user_id;
    } else {
      // Create new user record
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          line_user_id: currentUser.userId,
          display_name: currentUser.displayName,
          picture_url: currentUser.pictureUrl,
          phone: cleanPhone,
          role: 'patient',
        })
        .select('user_id')
        .single();

      if (userError) {
        // If we can't create a user (due to RLS), try to insert patient without user_id
        console.warn('Could not create user record, proceeding with patient only:', userError);
      } else {
        userId = newUser.user_id;
      }
    }

    // Now create the patient record
    const { data: newPatient, error } = await supabase
      .from('patients')
      .insert({
        user_id: userId,
        clinic_id: '00000000-0000-0000-0000-000000000001', // Demo clinic
        phone: cleanPhone,
        id_card_number: cleanIdCard,
        name: nameInput.value.trim(),
        date_of_birth: dobInput.value || null,
        gender: genderInput?.value || null,
        chronic_diseases: chronicInput?.value.trim() || null,
        allergies: allergiesInput?.value.trim() || null,
        first_visit_date: new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (error) {
      console.error('Patient insert error:', error);
      throw error;
    }

    showToast('ลงทะเบียนสำเร็จ', 'success');

    // Reset form
    (document.getElementById('registration-form') as HTMLFormElement).reset();

    // Navigate to home page
    navigateTo('home');
    await loadHomePage();

  } catch (error) {
    console.error('Registration error:', error);
    showToast('ไม่สามารถลงทะเบียนได้ กรุณาลองใหม่', 'error');
  }
}

(window as any).cancelRegistration = function(): void {
  // If user cancels registration, show a warning and redirect to login or exit
  if (confirm('คุณต้องการยกเลิกการลงทะเบียนใช่หรือไม่?')) {
    if (liff.isInClient()) {
      liff.closeWindow();
    } else {
      navigateTo('home');
    }
  }
};

// =====================================================
// FORM SUBMISSION
// =====================================================

async function handleBookingSubmit(e: Event): Promise<void> {
  e.preventDefault();

  const doctorSelect = document.getElementById('doctor-select') as HTMLSelectElement;
  const dateInput = document.getElementById('selected-date') as HTMLInputElement;
  const timeInput = document.getElementById('selected-time') as HTMLInputElement;
  const symptomsInput = document.getElementById('symptoms') as HTMLTextAreaElement;

  if (!doctorSelect.value || !dateInput.value || !timeInput.value) {
    showToast('กรุณากรอกข้อมูลให้ครบถ้วน', 'warning');
    return;
  }

  try {
    // Create appointment
    const { data: appointment, error } = await supabase
      .from('appointments')
      .insert({
        clinic_id: '00000000-0000-0000-0000-000000000001', // Demo clinic
        patient_id: null, // Will be set by RLS or server
        doctor_id: doctorSelect.value,
        appointment_date: dateInput.value,
        appointment_time: timeInput,
        symptoms: symptomsInput.value,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    showToast('จองนัดหมายสำเร็จ', 'success');

    // Reset form and go back to home
    (document.getElementById('booking-form') as HTMLFormElement).reset();
    navigateTo('home');

  } catch (error) {
    console.error('Booking error:', error);
    showToast('ไม่สามารถจองนัดหมายได้', 'error');
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  return date.toLocaleDateString('th-TH', options);
}

function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':');
  return `${hours}:${minutes}`;
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  return date.toLocaleDateString('th-TH', options);
}

// =====================================================
// INIT
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
  // Initialize LIFF
  initializeLiff();

  // Setup form submission
  const bookingForm = document.getElementById('booking-form');
  if (bookingForm) {
    bookingForm.addEventListener('submit', handleBookingSubmit);
  }

  // Setup registration form submission
  const registrationForm = document.getElementById('registration-form');
  if (registrationForm) {
    registrationForm.addEventListener('submit', handleRegistrationSubmit);
  }
});

// Export functions for global scope
(window as any).navigateTo = navigateTo;
(window as any).navigateBack = navigateBack;
