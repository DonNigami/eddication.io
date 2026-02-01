'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from '@clinic/config';
import { StatusBadge } from '@clinic/ui';

interface Appointment {
  appointment_id: string;
  appointment_date: string;
  appointment_time: string;
  status: 'pending' | 'confirmed' | 'checked_in' | 'in_consultation' | 'completed' | 'cancelled' | 'no_show';
  queue_number: number;
  patient: {
    name: string;
    phone: string;
  };
  doctor: {
    name: string;
  };
}

export default function AppointmentsPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || supabaseConfig.url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || supabaseConfig.anonKey
  );

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    loadAppointments();
  }, []);

  async function loadAppointments() {
    try {
      const { data } = await supabase
        .from('appointments')
        .select(`
          appointment_id,
          appointment_date,
          appointment_time,
          status,
          queue_number,
          patient:patients(name, phone),
          doctor:doctors(name)
        `)
        .gte('appointment_date', new Date().toISOString().split('T')[0])
        .order('appointment_date', { ascending: false })
        .order('appointment_time')
        .limit(50);

      setAppointments(data || []);
    } catch (error) {
      console.error('Error loading appointments:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredAppointments = filterStatus === 'all'
    ? appointments
    : appointments.filter(apt => apt.status === filterStatus);

  async function updateStatus(appointmentId: string, newStatus: string) {
    try {
      await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('appointment_id', appointmentId);

      await loadAppointments();
    } catch (error) {
      console.error('Error updating appointment:', error);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">นัดหมายทั้งหมด</h1>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-8">
            <a href="/dashboard" className="py-4 text-sm font-medium text-gray-600 hover:text-gray-900">
              ภาพรวม
            </a>
            <a href="/doctors" className="py-4 text-sm font-medium text-gray-600 hover:text-gray-900">
              แพทย์
            </a>
            <a href="/patients" className="py-4 text-sm font-medium text-gray-600 hover:text-gray-900">
              คนไข้
            </a>
            <a href="/appointments" className="py-4 text-sm font-medium text-primary border-b-2 border-primary">
              นัดหมาย
            </a>
          </div>
        </div>
      </nav>

      {/* Filters */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                filterStatus === 'all' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ทั้งหมด ({appointments.length})
            </button>
            <button
              onClick={() => setFilterStatus('pending')}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                filterStatus === 'pending' ? 'bg-gray-100 text-gray-700' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              รอยืนยัน
            </button>
            <button
              onClick={() => setFilterStatus('confirmed')}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                filterStatus === 'confirmed' ? 'bg-gray-100 text-gray-700' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              ยืนยันแล้ว
            </button>
            <button
              onClick={() => setFilterStatus('completed')}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                filterStatus === 'completed' ? 'bg-gray-100 text-gray-700' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              เสร็จสิ้น
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      วันที่
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      เวลา
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      แพทย์
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      คนไข้
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      คิว
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      สถานะ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      จัดการ
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAppointments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                        ไม่พบข้อมูลนัดหมาย
                      </td>
                    </tr>
                  ) : (
                    filteredAppointments.map((apt) => (
                      <tr key={apt.appointment_id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(apt.appointment_date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {apt.appointment_time}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {apt.doctor?.name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {apt.patient?.name || '-'}
                          </div>
                          <div className="text-xs text-gray-500">{apt.patient?.phone || ''}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          A{apt.queue_number || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge status={apt.status as any} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {apt.status === 'pending' && (
                            <button
                              onClick={() => updateStatus(apt.appointment_id, 'confirmed')}
                              className="text-green-600 hover:text-green-800 mr-3"
                            >
                              ยืนยัน
                            </button>
                          )}
                          {apt.status === 'confirmed' && (
                            <button
                              onClick={() => updateStatus(apt.appointment_id, 'checked_in')}
                              className="text-blue-600 hover:text-blue-800 mr-3"
                            >
                              เช็คอิน
                            </button>
                          )}
                          {apt.status === 'confirmed' && (
                            <button
                              onClick={() => updateStatus(apt.appointment_id, 'cancelled')}
                              className="text-red-600 hover:text-red-800"
                            >
                              ยกเลิก
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
