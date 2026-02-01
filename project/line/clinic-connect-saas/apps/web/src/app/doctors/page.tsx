'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from '@clinic/config';
import { StatusBadge } from '@clinic/ui';

interface Doctor {
  doctor_id: string;
  name: string;
  title: string;
  specialty: string;
  license_no: string;
  consultation_fee: number;
  is_available: boolean;
  rating_average: number;
  review_count: number;
  total_patients: number;
}

export default function DoctorsPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || supabaseConfig.url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || supabaseConfig.anonKey
  );

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadDoctors();
  }, []);

  async function loadDoctors() {
    try {
      const { data } = await supabase
        .from('doctors')
        .select('*')
        .order('name');

      setDoctors(data || []);
    } catch (error) {
      console.error('Error loading doctors:', error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleAvailability(doctorId: string, currentStatus: boolean) {
    try {
      await supabase
        .from('doctors')
        .update({ is_available: !currentStatus })
        .eq('doctor_id', doctorId);

      await loadDoctors();
    } catch (error) {
      console.error('Error updating doctor:', error);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">จัดการแพทย์</h1>
            <button
              onClick={() => setShowModal(true)}
              className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark"
            >
              + เพิ่มแพทย์
            </button>
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
            <a href="/doctors" className="py-4 text-sm font-medium text-primary border-b-2 border-primary">
              แพทย์
            </a>
            <a href="/patients" className="py-4 text-sm font-medium text-gray-600 hover:text-gray-900">
              คนไข้
            </a>
            <a href="/appointments" className="py-4 text-sm font-medium text-gray-600 hover:text-gray-900">
              นัดหมาย
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
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      แพทย์
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      สาขแพทย์
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      ค่าบรักษา
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      สถานะ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      คะแนน
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      จัดการ
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {doctors.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                        ไม่พบข้อมแพทย์
                      </td>
                    </tr>
                  ) : (
                    doctors.map((doctor) => (
                      <tr key={doctor.doctor_id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">
                            {doctor.title} {doctor.name}
                          </div>
                          {doctor.license_no && (
                            <div className="text-sm text-gray-500">{doctor.license_no}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                          {doctor.specialty || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                          ฿{doctor.consultation_fee.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {doctor.is_available ? (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                              ว่าง
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
                              ไม่ว่าง
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          ⭐ {doctor.rating_average.toFixed(1)} ({doctor.review_count})
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <button
                            onClick={() => toggleAvailability(doctor.doctor_id, doctor.is_available)}
                            className="text-primary hover:text-primary-dark mr-3"
                          >
                            {doctor.is_available ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                          </button>
                          <button className="text-gray-400 hover:text-gray-600">
                            แก้ไข
                          </button>
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

      {/* Add Doctor Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">เพิ่มแพทย์ใหม่</h2>
            </div>
            <form className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  คำนำหน้า
                </label>
                <select className="w-full border rounded-md px-3 py-2">
                  <option>นพ.</option>
                  <option>พญ.</option>
                  <option>นพญ.</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อแพทย์
                </label>
                <input type="text" className="w-full border rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  เลขทใบประกอ
                </label>
                <input type="text" className="w-full border rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  สาขแพทย์
                </label>
                <input type="text" className="w-full border rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ค่าบรักษา (บาท)
                </label>
                <input type="number" className="w-full border rounded-md px-3 py-2" />
              </div>
            </form>
            <div className="p-6 border-t bg-gray-50 rounded-b-lg flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
