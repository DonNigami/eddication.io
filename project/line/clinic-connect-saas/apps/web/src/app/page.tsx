'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from '@clinic/config';

// Types
interface DashboardStats {
  totalAppointments: number;
  newPatients: number;
  todayRevenue: number;
  totalDoctors: number;
}

interface Appointment {
  appointment_id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  patient: {
    name: string;
    phone: string;
  };
  doctor: {
    name: string;
  };
}

export default function DashboardPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || supabaseConfig.url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || supabaseConfig.anonKey
  );

  const [stats, setStats] = useState<DashboardStats>({
    totalAppointments: 0,
    newPatients: 0,
    todayRevenue: 0,
    totalDoctors: 0,
  });

  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Load stats in parallel
      const [
        { count: appointmentCount },
        { count: doctorCount },
        { data: appointments },
      ] = await Promise.all([
        supabase
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .gte('appointment_date', today),
        supabase
          .from('doctors')
          .select('*', { count: 'exact', head: true }),
        supabase
          .from('today_appointments')
          .select('*')
          .order('appointment_time', { ascending: true })
          .limit(10),
      ]);

      setStats({
        totalAppointments: appointmentCount || 0,
        newPatients: 0, // TODO: Calculate from patients table
        todayRevenue: 0, // TODO: Calculate from payments table
        totalDoctors: doctorCount || 0,
      });

      setTodayAppointments(appointments || []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'checked_in':
        return 'bg-blue-100 text-blue-800';
      case 'in_consultation':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'รอยืนยัน',
      confirmed: 'ยืนยันแล้ว',
      checked_in: 'เช็คอิน',
      in_consultation: 'กำลังตรวจ',
      completed: 'เสร็จสิ้น',
      cancelled: 'ยกเลิก',
      no_show: 'ไม่มา',
    };
    return labels[status] || status;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                ClinicConnect Admin
              </h1>
              <p className="text-sm text-gray-500">แผงควบคุมระบบคลินิก</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {new Date().toLocaleDateString('th-TH', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-8">
            <a href="/dashboard" className="py-4 text-sm font-medium text-primary border-b-2 border-primary">
              ภาพรวม
            </a>
            <a href="/doctors" className="py-4 text-sm font-medium text-gray-600 hover:text-gray-900">
              แพทย์
            </a>
            <a href="/patients" className="py-4 text-sm font-medium text-gray-600 hover:text-gray-900">
              คนไข้
            </a>
            <a href="/appointments" className="py-4 text-sm font-medium text-gray-600 hover:text-gray-900">
              นัดหมาย
            </a>
            <a href="/settings" className="py-4 text-sm font-medium text-gray-600 hover:text-gray-900">
              ตั้งค่า
            </a>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">นัดหมายวันนี้</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.totalAppointments}</p>
                  </div>
                  <div className="text-4xl">📅</div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">คนไข้ใหม่</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.newPatients}</p>
                  </div>
                  <div className="text-4xl">👥</div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">รายได้วันนี้</p>
                    <p className="text-3xl font-bold text-gray-900">
                      ฿{stats.todayRevenue.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-4xl">💰</div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">แพทย์ทั้งหมด</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.totalDoctors}</p>
                  </div>
                  <div className="text-4xl">👨‍⚕️</div>
                </div>
              </div>
            </div>

            {/* Today's Appointments */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-semibold">นัดหมายวันนี้</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
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
                        สถานะ
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        จัดการ
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {todayAppointments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                          ไม่มีนัดหมายวันนี้
                        </td>
                      </tr>
                    ) : (
                      todayAppointments.map((apt) => (
                        <tr key={apt.appointment_id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {apt.appointment_time}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {apt.doctor?.name || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div>{apt.patient?.name || '-'}</div>
                            <div className="text-xs text-gray-500">{apt.patient?.phone || ''}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(apt.status)}`}>
                              {getStatusLabel(apt.status)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <button className="text-primary hover:text-primary-dark">
                              ดู
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
