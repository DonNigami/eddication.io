'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from '@clinic/config';
import {
  Calendar,
  Users,
  TrendingUp,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';

// Types
interface DashboardStats {
  totalAppointments: number;
  newPatients: number;
  todayRevenue: number;
  totalDoctors: number;
  completedToday: number;
  cancelledToday: number;
  noShowToday: number;
}

interface Appointment {
  appointment_id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  queue_number?: number;
  // From today_appointments view
  patient_name?: string;
  patient_phone?: string;
  doctor_name?: string;
  doctor_title?: string;
  doctor_specialty?: string;
}

export default function DashboardPage() {
  const supabase = createClient(
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SUPABASE_URL) || supabaseConfig.url,
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) || supabaseConfig.anonKey
  );

  const [stats, setStats] = useState<DashboardStats>({
    totalAppointments: 0,
    newPatients: 0,
    todayRevenue: 0,
    totalDoctors: 0,
    completedToday: 0,
    cancelledToday: 0,
    noShowToday: 0,
  });

  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const today = new Date().toISOString().split('T')[0];

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

      // Calculate additional stats
      const completed = appointments?.filter((a: Appointment) => a.status === 'completed').length || 0;
      const cancelled = appointments?.filter((a: Appointment) => a.status === 'cancelled').length || 0;
      const noShow = appointments?.filter((a: Appointment) => a.status === 'no_show').length || 0;

      setStats({
        totalAppointments: appointmentCount || 0,
        newPatients: 0,
        todayRevenue: 0,
        totalDoctors: doctorCount || 0,
        completedToday: completed,
        cancelledToday: cancelled,
        noShowToday: noShow,
      });

      setTodayAppointments(appointments || []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'confirmed':
        return {
          label: 'ยืนยันแล้ว',
          color: 'bg-blue-100 text-blue-800',
          icon: <CheckCircle className="w-4 h-4" />,
        };
      case 'checked_in':
        return {
          label: 'เช็คอินแล้ว',
          color: 'bg-cyan-100 text-cyan-800',
          icon: <Clock className="w-4 h-4" />,
        };
      case 'in_consultation':
        return {
          label: 'กำลังตรวจ',
          color: 'bg-amber-100 text-amber-800',
          icon: <Activity className="w-4 h-4" />,
        };
      case 'completed':
        return {
          label: 'เสร็จสิ้น',
          color: 'bg-emerald-100 text-emerald-800',
          icon: <CheckCircle className="w-4 h-4" />,
        };
      case 'cancelled':
        return {
          label: 'ยกเลิก',
          color: 'bg-rose-100 text-rose-800',
          icon: <XCircle className="w-4 h-4" />,
        };
      case 'no_show':
        return {
          label: 'ไม่มา',
          color: 'bg-slate-100 text-slate-800',
          icon: <AlertCircle className="w-4 h-4" />,
        };
      default:
        return {
          label: 'รอยืนยัน',
          color: 'bg-slate-100 text-slate-800',
          icon: <Clock className="w-4 h-4" />,
        };
    }
  };

  // Loading Skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-6">
              <div className="skeleton h-4 w-24 mb-2" />
              <div className="skeleton h-8 w-16" />
            </div>
          ))}
        </div>
        {/* Table Skeleton */}
        <div className="card">
          <div className="p-4 border-b border-slate-200">
            <div className="skeleton h-6 w-32" />
          </div>
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ภาพรวม</h1>
          <p className="text-slate-600 mt-1">ยินดีต้อนรับกลับมา ดูข้อมูลสรุปของวันนี้</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-secondary">
            <Activity className="w-4 h-4" />
            รายงาน
          </button>
          <button className="btn btn-primary">
            <Calendar className="w-4 h-4" />
            นัดหมายใหม่
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        {/* Today's Appointments */}
        <div className="card p-6 hover-lift cursor-pointer">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">นัดหมายวันนี้</p>
              <p className="text-3xl font-bold text-slate-900">{stats.totalAppointments}</p>
              <p className="text-xs text-slate-500 mt-2">นัดหมายทั้งหมด</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-xl">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs">
            <span className="text-emerald-600 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {stats.completedToday} เสร็จสิ้น
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-rose-600">{stats.cancelledToday} ยกเลิก</span>
          </div>
        </div>

        {/* New Patients */}
        <div className="card p-6 hover-lift cursor-pointer">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">คนไข้ใหม่</p>
              <p className="text-3xl font-bold text-slate-900">{stats.newPatients}</p>
              <p className="text-xs text-slate-500 mt-2">เดือนนี้</p>
            </div>
            <div className="p-3 bg-emerald-100 rounded-xl">
              <Users className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '65%' }} />
            </div>
            <p className="text-xs text-slate-500 mt-2">65% จากเป้าหมายเดือนนี้</p>
          </div>
        </div>

        {/* Today's Revenue */}
        <div className="card p-6 hover-lift cursor-pointer">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">รายได้วันนี้</p>
              <p className="text-3xl font-bold text-slate-900">
                ฿{stats.todayRevenue.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 mt-2">จากการรักษา</p>
            </div>
            <div className="p-3 bg-amber-100 rounded-xl">
              <TrendingUp className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs text-emerald-600">
            <TrendingUp className="w-3 h-3" />
            <span>+12% จากเมื่อวาน</span>
          </div>
        </div>

        {/* Total Doctors */}
        <div className="card p-6 hover-lift cursor-pointer">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">แพทย์ทั้งหมด</p>
              <p className="text-3xl font-bold text-slate-900">{stats.totalDoctors}</p>
              <p className="text-xs text-slate-500 mt-2">แพทย์ที่เปิดให้บริการ</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-xl">
              <Activity className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2">
            <div className="flex -space-x-2">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-white"
                />
              ))}
            </div>
            <span className="text-xs text-slate-500">แพทย์ออกตรวจวันนี้</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <span className="text-sm font-medium text-slate-700">นัดหมายใหม่</span>
        </button>
        <button className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <Users className="w-5 h-5 text-emerald-600" />
          </div>
          <span className="text-sm font-medium text-slate-700">ลงทะเบียนคนไข้</span>
        </button>
        <button className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-purple-300 hover:shadow-md transition-all">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Activity className="w-5 h-5 text-purple-600" />
          </div>
          <span className="text-sm font-medium text-slate-700">เริ่มตรวจ</span>
        </button>
        <button className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-amber-300 hover:shadow-md transition-all">
          <div className="p-2 bg-amber-100 rounded-lg">
            <TrendingUp className="w-5 h-5 text-amber-600" />
          </div>
          <span className="text-sm font-medium text-slate-700">รายงาน</span>
        </button>
      </div>

      {/* Today's Appointments */}
      <div className="card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">นัดหมายวันนี้</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {new Date().toLocaleDateString('th-TH', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
          <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            ดูทั้งหมด →
          </button>
        </div>

        {todayAppointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Calendar className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">ไม่มีนัดหมายวันนี้</h3>
            <p className="text-slate-500 mb-4">ยังไม่มีการนัดหมายสำหรับวันนี้</p>
            <button className="btn btn-primary">
              <Calendar className="w-4 h-4" />
              สร้างนัดหมายใหม่
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-20">คิว</th>
                  <th>เวลา</th>
                  <th>แพทย์</th>
                  <th>คนไข้</th>
                  <th>สถานะ</th>
                  <th className="text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {todayAppointments.map((apt, index) => {
                  const statusInfo = getStatusInfo(apt.status);
                  return (
                    <tr key={apt.appointment_id}>
                      <td className="font-medium text-slate-900">
                        <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-700 rounded-lg text-sm font-semibold">
                          {apt.queue_number || index + 1}
                        </span>
                      </td>
                      <td>
                        <div className="font-medium text-slate-900">{apt.appointment_time}</div>
                      </td>
                      <td>
                        <div className="font-medium text-slate-900">{apt.doctor_name || '-'}</div>
                        {apt.doctor_specialty && (
                          <div className="text-xs text-slate-500">{apt.doctor_specialty}</div>
                        )}
                      </td>
                      <td>
                        <div className="font-medium text-slate-900">{apt.patient_name || '-'}</div>
                        <div className="text-xs text-slate-500">{apt.patient_phone || ''}</div>
                      </td>
                      <td>
                        <span className={`badge flex items-center gap-1.5 w-fit ${statusInfo.color}`}>
                          {statusInfo.icon}
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="card">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">กิจกรรมล่าสุด</h2>
          </div>
          <div className="p-4 space-y-3">
            {[
              { action: 'นัดหมายใหม่', detail: 'คุณสมชาย นัดหมายเวลา 14:00', time: '5 นาทีที่แล้ว', color: 'bg-blue-500' },
              { action: 'เช็คอิน', detail: 'คุณวิภา มาถึงคลินิก', time: '10 นาทีที่แล้ว', color: 'bg-emerald-500' },
              { action: 'เสร็จสิ้นการตรวจ', detail: 'คุณมานี พบแพทย์เสร็จแล้ว', time: '15 นาทีที่แล้ว', color: 'bg-amber-500' },
              { action: 'ยกเลิกนัดหมาย', detail: 'คุณสมศรี ยกเลิกนัดหมาย', time: '30 นาทีที่แล้ว', color: 'bg-rose-500' },
            ].map((activity, i) => (
              <div key={i} className="flex items-start gap-3 p-3 hover:bg-slate-50 rounded-lg transition-colors">
                <div className={`w-2 h-2 rounded-full ${activity.color} mt-2 flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{activity.action}</p>
                  <p className="text-xs text-slate-600 truncate">{activity.detail}</p>
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">{activity.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming */}
        <div className="card">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">นัดหมายที่กำลังจะถึง</h2>
          </div>
          <div className="p-4 space-y-3">
            {[
              { name: 'คุณสมชาย เขียวขจี', doctor: 'พญ. สมหญิง แพทย์', time: '13:30', specialty: 'อายุรกรรมทั่วไป' },
              { name: 'คุณวิภา สุขสันต์', doctor: 'นพ. วิชัย แพทย์', time: '14:00', specialty: 'กุมารเวช' },
              { name: 'คุณมานี มีสุข', doctor: 'พญ. สมหญิง แพทย์', time: '14:30', specialty: 'อายุรกรรมทั่วไป' },
            ].map((apt, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-semibold flex-shrink-0">
                  {apt.time}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{apt.name}</p>
                  <p className="text-xs text-slate-500">{apt.doctor} • {apt.specialty}</p>
                </div>
                <div className="flex-shrink-0">
                  <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
