'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from '@clinic/config';

interface ReportStats {
  totalPatients: number;
  totalDoctors: number;
  totalAppointments: number;
  totalRevenue: number;
}

interface AppointmentStats {
  date: string;
  completed: number;
  cancelled: number;
  noShow: number;
}

interface DoctorStats {
  doctor_id: string;
  name: string;
  totalAppointments: number;
  completedAppointments: number;
  completionRate: number;
  averageRating: number;
}

export default function ReportsPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || supabaseConfig.url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || supabaseConfig.anonKey
  );

  const [stats, setStats] = useState<ReportStats>({
    totalPatients: 0,
    totalDoctors: 0,
    totalAppointments: 0,
    totalRevenue: 0,
  });
  const [appointmentStats, setAppointmentStats] = useState<AppointmentStats[]>([]);
  const [doctorStats, setDoctorStats] = useState<DoctorStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30'); // days

  useEffect(() => {
    loadReports();
  }, [dateRange]);

  async function loadReports() {
    setLoading(true);
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(dateRange));
      const startDateStr = startDate.toISOString().split('T')[0];

      // Load overall stats
      const [patientsData, doctorsData, appointmentsData, paymentsData] = await Promise.all([
        supabase.from('patients').select('patient_id', { count: 'exact', head: true }),
        supabase.from('doctors').select('doctor_id', { count: 'exact', head: true }),
        supabase
          .from('appointments')
          .select('appointment_id', { count: 'exact', head: true })
          .gte('appointment_date', startDateStr),
        supabase
          .from('payments')
          .select('amount')
          .eq('status', 'paid')
          .gte('created_at', startDateStr),
      ]);

      const totalRevenue = paymentsData.data?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

      setStats({
        totalPatients: patientsData.count || 0,
        totalDoctors: doctorsData.count || 0,
        totalAppointments: appointmentsData.count || 0,
        totalRevenue,
      });

      // Load appointment stats by date
      const { data: aptData } = await supabase
        .from('appointments')
        .select('appointment_date, status')
        .gte('appointment_date', startDateStr)
        .order('appointment_date');

      if (aptData) {
        const grouped: Record<string, AppointmentStats> = {};

        aptData.forEach((apt) => {
          const date = apt.appointment_date;
          if (!grouped[date]) {
            grouped[date] = { date, completed: 0, cancelled: 0, noShow: 0 };
          }
          if (apt.status === 'completed') grouped[date].completed++;
          else if (apt.status === 'cancelled') grouped[date].cancelled++;
          else if (apt.status === 'no_show') grouped[date].noShow++;
        });

        setAppointmentStats(Object.values(grouped));
      }

      // Load doctor stats
      const { data: docData } = await supabase
        .from('doctors')
        .select(`
          doctor_id,
          name,
          appointments(appointment_id, status)
        `)
        .eq('is_active', true);

      if (docData) {
        const stats: DoctorStats[] = docData.map((doc: any) => {
          const appointments = doc.appointments || [];
          const totalAppointments = appointments.length;
          const completedAppointments = appointments.filter(
            (a: any) => a.status === 'completed'
          ).length;

          return {
            doctor_id: doc.doctor_id,
            name: doc.name,
            totalAppointments,
            completedAppointments,
            completionRate:
              totalAppointments > 0
                ? Math.round((completedAppointments / totalAppointments) * 100)
                : 0,
            averageRating: 0, // Would come from reviews table
          };
        });

        setDoctorStats(stats.sort((a, b) => b.totalAppointments - a.totalAppointments));
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">รายงานสถิติ</h1>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
            >
              <option value="7">7 วันล่าสุด</option>
              <option value="30">30 วันล่าสุด</option>
              <option value="90">3 เดือนล่าสุด</option>
              <option value="365">1 ปีล่าสุด</option>
            </select>
          </div>
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
            <a href="/appointments" className="py-4 text-sm font-medium text-gray-600 hover:text-gray-900">
              นัดหมาย
            </a>
            <a href="/articles" className="py-4 text-sm font-medium text-gray-600 hover:text-gray-900">
              บทความ
            </a>
            <a href="/reports" className="py-4 text-sm font-medium text-primary border-b-2 border-primary">
              รายงาน
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
          <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <StatCard
                title="คนไข้ทั้งหมด"
                value={stats.totalPatients}
                icon="👥"
                color="blue"
              />
              <StatCard
                title="แพทย์ทั้งหมด"
                value={stats.totalDoctors}
                icon="👨‍⚕️"
                color="green"
              />
              <StatCard
                title="นัดหมายทั้งหมด"
                value={stats.totalAppointments}
                icon="📅"
                color="purple"
              />
              <StatCard
                title="รายได้"
                value={`฿${stats.totalRevenue.toLocaleString()}`}
                icon="💰"
                color="yellow"
              />
            </div>

            {/* Appointment Chart */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                สถิติการนัดหมาย
              </h2>
              <div className="h-64 flex items-end justify-between gap-2">
                {appointmentStats.slice(-14).map((day) => {
                  const max = Math.max(...appointmentStats.map(d => d.completed + d.cancelled + d.noShow), 1);
                  const completedHeight = (day.completed / max) * 100;
                  const cancelledHeight = (day.cancelled / max) * 100;
                  const noShowHeight = (day.noShow / max) * 100;

                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center">
                      <div className="w-full flex flex-col-reverse" style={{ height: '200px' }}>
                        <div className="w-full bg-green-500" style={{ height: `${completedHeight}%` }}></div>
                        <div className="w-full bg-red-500" style={{ height: `${cancelledHeight}%` }}></div>
                        <div className="w-full bg-gray-400" style={{ height: `${noShowHeight}%` }}></div>
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        {new Date(day.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span className="text-sm text-gray-600">เสร็จสิ้น</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span className="text-sm text-gray-600">ยกเลิก</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-400 rounded"></div>
                  <span className="text-sm text-gray-600">ไม่มา</span>
                </div>
              </div>
            </div>

            {/* Doctor Performance */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                ประสิทธิภาพแพทย์
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        แพทย์
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        นัดหมายทั้งหมด
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        เสร็จสิ้น
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        อัตราการเสร็จสิ้น
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {doctorStats.map((doc) => (
                      <tr key={doc.doctor_id}>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {doc.name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {doc.totalAppointments}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {doc.completedAppointments}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  doc.completionRate >= 80
                                    ? 'bg-green-500'
                                    : doc.completionRate >= 60
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'
                                }`}
                                style={{ width: `${doc.completionRate}%` }}
                              ></div>
                            </div>
                            <span className="text-gray-900">{doc.completionRate}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: string;
  color: 'blue' | 'green' | 'purple' | 'yellow';
}) {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    yellow: 'bg-yellow-500',
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`${colorClasses[color]} w-12 h-12 rounded-full flex items-center justify-center text-2xl`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
