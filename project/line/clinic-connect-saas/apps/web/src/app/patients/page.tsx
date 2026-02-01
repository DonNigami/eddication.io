'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from '@clinic/config';

interface Patient {
  patient_id: string;
  name: string;
  phone: string;
  email?: string;
  date_of_birth?: string;
  blood_type?: string;
  allergies?: string;
  chronic_diseases?: string;
  total_visits: number;
  last_visit_date?: string;
}

export default function PatientsPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || supabaseConfig.url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || supabaseConfig.anonKey
  );

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadPatients();
  }, []);

  async function loadPatients() {
    try {
      const { data } = await supabase
        .from('patients')
        .select('*')
        .order('last_visit_date', { ascending: false, nullsFirst: false })
        .limit(50);

      setPatients(data || []);
    } catch (error) {
      console.error('Error loading patients:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredPatients = patients.filter(patient =>
    patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.phone.includes(searchQuery)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">จัดการคนไข้</h1>
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
            <a href="/patients" className="py-4 text-sm font-medium text-primary border-b-2 border-primary">
              คนไข้
            </a>
            <a href="/appointments" className="py-4 text-sm font-medium text-gray-600 hover:text-gray-900">
              นัดหมาย
            </a>
          </div>
        </div>
      </nav>

      {/* Search */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <input
            type="text"
            placeholder="ค้นหาคนไข้ด้วยชื่อหรือเบอร์โทร..."
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPatients.length === 0 ? (
              <div className="col-span-full text-center py-12 text-gray-500">
                ไม่พบข้อมูลคนไข้
              </div>
            ) : (
              filteredPatients.map((patient) => (
                <div key={patient.patient_id} className="bg-white rounded-lg shadow p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {patient.name}
                      </h3>
                      <p className="text-sm text-gray-500">{patient.phone}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">
                        {patient.total_visits}
                      </div>
                      <div className="text-xs text-gray-500">ครั้ง</div>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    {patient.email && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">อีเมล:</span>
                        <span className="text-gray-900">{patient.email}</span>
                      </div>
                    )}
                    {patient.blood_type && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">กรุ๊ปเลือด:</span>
                        <span className="text-gray-900">{patient.blood_type}</span>
                      </div>
                    )}
                    {patient.allergies && (
                      <div>
                        <span className="text-gray-500">แพ้ยา:</span>
                        <p className="text-red-600 mt-1">{patient.allergies}</p>
                      </div>
                    )}
                    {patient.chronic_diseases && (
                      <div>
                        <span className="text-gray-500">โรคประจำตัว:</span>
                        <p className="text-gray-900 mt-1">{patient.chronic_diseases}</p>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t border-gray-100 mt-2">
                      <span className="text-gray-500">มาครั้งล่าสุด:</span>
                      <span className="text-gray-900">
                        {patient.last_visit_date ? formatDate(patient.last_visit_date) : '-'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                    <button className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                      ดูประวัติ
                    </button>
                    <button className="flex-1 px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark">
                      แก้ไข
                    </button>
                  </div>
                </div>
              ))
            )}
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
