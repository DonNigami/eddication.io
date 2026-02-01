'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from '@clinic/config';
import { Button, Input, Modal } from '@clinic/ui';

interface ClinicSettings {
  name: string;
  name_en?: string;
  phone: string;
  email?: string;
  address?: string;
  province?: string;
  district?: string;
  postal_code?: string;
  operating_hours?: Record<string, { open: string; close: string }>;
}

export default function SettingsPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || supabaseConfig.url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || supabaseConfig.anonKey
  );

  const [activeTab, setActiveTab] = useState<'clinic' | 'line' | 'subscription' | 'notifications'>('clinic');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Clinic settings
  const [clinicSettings, setClinicSettings] = useState<ClinicSettings>({
    name: 'คลินิกทันตกรรม สมชาย',
    phone: '02-123-4567',
    email: 'info@clinic.com',
    address: '123 ถนนสุขุมวิท เขตวัฒนา กรุงเทพฯ 10110',
    province: 'กรุงเทพมหานคร',
    district: 'เขตวัฒนา',
    postal_code: '10110',
    operating_hours: {
      monday: { open: '09:00', close: '17:00' },
      tuesday: { open: '09:00', close: '17:00' },
      wednesday: { open: '09:00', close: '17:00' },
      thursday: { open: '09:00', close: '17:00' },
      friday: { open: '09:00', close: '17:00' },
      saturday: { open: '09:00', close: '13:00' },
      sunday: { open: '00:00', close: '00:00' },
    },
  });

  // LINE settings
  const [lineSettings, setLineSettings] = useState({
    liffId: '',
    channelId: '',
    channelSecret: '',
    channelAccessToken: '',
  });

  async function saveSettings() {
    setSaving(true);
    setSaveMessage('');

    try {
      // Simulate save
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setSaveMessage('บันทึกตั้งค่าสำเร็จ');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      setSaveMessage('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">ตั้งค่าระบบ</h1>
            {saveMessage && (
              <div className={`px-4 py-2 rounded-lg text-sm ${
                saveMessage.includes('สำเร็จ')
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {saveMessage}
              </div>
            )}
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
            <a href="/reports" className="py-4 text-sm font-medium text-gray-600 hover:text-gray-900">
              รายงาน
            </a>
            <a href="/settings" className="py-4 text-sm font-medium text-primary border-b-2 border-primary">
              ตั้งค่า
            </a>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg">
          {/* Tabs */}
          <div className="border-b">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('clinic')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'clinic'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                ข้อมูลคลินิก
              </button>
              <button
                onClick={() => setActiveTab('line')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'line'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                ตั้งค่า LINE
              </button>
              <button
                onClick={() => setActiveTab('subscription')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'subscription'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                แพ็กเกจ
              </button>
              <button
                onClick={() => setActiveTab('notifications')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'notifications'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                การแจ้งเตือน
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'clinic' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  ข้อมูลทั่วไปคลินิก
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="ชื่อคลินิก"
                    value={clinicSettings.name}
                    onChange={(e) =>
                      setClinicSettings({ ...clinicSettings, name: e.target.value })
                    }
                  />
                  <Input
                    label="ชื่อคลินิก (ภาษาอังกฤษ)"
                    value={clinicSettings.name_en || ''}
                    onChange={(e) =>
                      setClinicSettings({ ...clinicSettings, name_en: e.target.value })
                    }
                  />
                  <Input
                    label="เบอร์โทรศัพท์"
                    value={clinicSettings.phone}
                    onChange={(e) =>
                      setClinicSettings({ ...clinicSettings, phone: e.target.value })
                    }
                  />
                  <Input
                    label="อีเมล"
                    type="email"
                    value={clinicSettings.email || ''}
                    onChange={(e) =>
                      setClinicSettings({ ...clinicSettings, email: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ที่อยู่
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    rows={2}
                    value={clinicSettings.address || ''}
                    onChange={(e) =>
                      setClinicSettings({ ...clinicSettings, address: e.target.value })
                    }
                  />
                </div>

                <div className="grid grid-cols-3 gap-6">
                  <Input
                    label="จังหวัด"
                    value={clinicSettings.province || ''}
                    onChange={(e) =>
                      setClinicSettings({ ...clinicSettings, province: e.target.value })
                    }
                  />
                  <Input
                    label="เขต/อำเภอ"
                    value={clinicSettings.district || ''}
                    onChange={(e) =>
                      setClinicSettings({ ...clinicSettings, district: e.target.value })
                    }
                  />
                  <Input
                    label="รหัสไปรษณีย์"
                    value={clinicSettings.postal_code || ''}
                    onChange={(e) =>
                      setClinicSettings({ ...clinicSettings, postal_code: e.target.value })
                    }
                  />
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">เวลาทำการ</h4>
                  <div className="space-y-2">
                    {[
                      { key: 'monday', label: 'จันทร์' },
                      { key: 'tuesday', label: 'อังคาร' },
                      { key: 'wednesday', label: 'พุธ' },
                      { key: 'thursday', label: 'พฤหัสบดี' },
                      { key: 'friday', label: 'ศุกร์' },
                      { key: 'saturday', label: 'เสาร์' },
                      { key: 'sunday', label: 'อาทิตย์' },
                    ].map((day) => (
                      <div key={day.key} className="flex items-center gap-4">
                        <span className="w-20 text-sm text-gray-600">{day.label}</span>
                        <input
                          type="time"
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                          value={
                            clinicSettings.operating_hours?.[day.key as keyof typeof clinicSettings.operating_hours]?.open ||
                            '09:00'
                          }
                          onChange={(e) => {
                            const hours = clinicSettings.operating_hours || {};
                            setClinicSettings({
                              ...clinicSettings,
                              operating_hours: {
                                ...hours,
                                [day.key]: { ...hours[day.key as keyof typeof hours], open: e.target.value },
                              },
                            });
                          }}
                        />
                        <span className="text-gray-400">-</span>
                        <input
                          type="time"
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                          value={
                            clinicSettings.operating_hours?.[day.key as keyof typeof clinicSettings.operating_hours]?.close ||
                            '17:00'
                          }
                          onChange={(e) => {
                            const hours = clinicSettings.operating_hours || {};
                            setClinicSettings({
                              ...clinicSettings,
                              operating_hours: {
                                ...hours,
                                [day.key]: { ...hours[day.key as keyof typeof hours], close: e.target.value },
                              },
                            });
                          }}
                        />
                        <label className="flex items-center gap-2 text-sm text-gray-600">
                          <input
                            type="checkbox"
                            checked={
                              (clinicSettings.operating_hours?.[day.key as keyof typeof clinicSettings.operating_hours]
                                ?.open || '09:00') !== '00:00'
                            }
                            onChange={(e) => {
                              const hours = clinicSettings.operating_hours || {};
                              setClinicSettings({
                                ...clinicSettings,
                                operating_hours: {
                                  ...hours,
                                  [day.key]: e.target.checked
                                    ? { open: '09:00', close: '17:00' }
                                    : { open: '00:00', close: '00:00' },
                                },
                              });
                            }}
                          />
                          เปิดทำการ
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'line' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  การเชื่อมต่อ LINE
                </h3>

                <Input
                  label="LIFF ID"
                  value={lineSettings.liffId}
                  onChange={(e) =>
                    setLineSettings({ ...lineSettings, liffId: e.target.value })
                  }
                  helperText="LIFF App ID จาก LINE Developers Console"
                />

                <Input
                  label="Channel ID"
                  value={lineSettings.channelId}
                  onChange={(e) =>
                    setLineSettings({ ...lineSettings, channelId: e.target.value })
                  }
                />

                <Input
                  label="Channel Secret"
                  type="password"
                  value={lineSettings.channelSecret}
                  onChange={(e) =>
                    setLineSettings({ ...lineSettings, channelSecret: e.target.value })
                  }
                  helperText="ใช้สำหรับยืนยัน Webhook Signature"
                />

                <Input
                  label="Channel Access Token"
                  type="password"
                  value={lineSettings.channelAccessToken}
                  onChange={(e) =>
                    setLineSettings({ ...lineSettings, channelAccessToken: e.target.value })
                  }
                  helperText="Messaging API Access Token สำหรับส่งข้อความ"
                />

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>หมายเหตุ:</strong> หลังจากบันทึกการตั้งค่า ระบบจะต้องรีสตาร์ท Webhook
                    เพื่อให้การตั้งค่าใหม่มีผล
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'subscription' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  แพ็กเกจสมาชิก
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    {
                      name: 'Basic',
                      price: '1,500',
                      features: ['จองนัดหมาย', 'จัดการคิว', 'แจ้งเตือน LINE'],
                      color: 'gray',
                    },
                    {
                      name: 'Pro',
                      price: '3,000',
                      features: [
                        'จองนัดหมาย',
                        'จัดการคิว',
                        'แจ้งเตือน LINE',
                        'ประวัติการรักษา',
                        'บทความ',
                      ],
                      color: 'blue',
                      recommended: true,
                    },
                    {
                      name: 'Clinic',
                      price: '5,000',
                      features: [
                        'จองนัดหมาย',
                        'จัดการคิว',
                        'แจ้งเตือน LINE',
                        'ประวัติการรักษา',
                        'บทความ',
                        'LINE Pay',
                        'รายงาน',
                        'รีวิว',
                      ],
                      color: 'purple',
                    },
                  ].map((plan) => (
                    <div
                      key={plan.name}
                      className={`border-2 rounded-lg p-6 ${
                        plan.recommended ? 'border-primary' : 'border-gray-200'
                      }`}
                    >
                      {plan.recommended && (
                        <div className="text-center">
                          <span className="inline-block px-3 py-1 bg-primary text-white text-xs font-medium rounded-full">
                            แนะนำ
                          </span>
                        </div>
                      )}
                      <h4 className="text-xl font-semibold text-center mt-2">{plan.name}</h4>
                      <div className="text-center mt-4">
                        <span className="text-3xl font-bold">฿{plan.price}</span>
                        <span className="text-gray-500">/เดือน</span>
                      </div>
                      <ul className="mt-6 space-y-2">
                        {plan.features.map((feature) => (
                          <li key={feature} className="flex items-center text-sm">
                            <svg
                              className="w-4 h-4 text-green-500 mr-2"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  การแจ้งเตือน
                </h3>

                {[
                  { key: 'reminder', label: 'แจ้งเตือนนัดหมายล่วงหน้า', description: 'ส่งการแจ้งเตือน 1 วันก่อนนัด' },
                  { key: 'queue', label: 'แจ้งเตือนคิว', description: 'ส่งการแจ้งเตือนเมื่อใกล้ถึงคิว' },
                  { key: 'payment', label: 'แจ้งเตือนการชำระเงิน', description: 'ส่งการแจ้งเตือนเมื่อมียอดที่ต้องชำระ' },
                  { key: 'promotion', label: 'ข้อความประชาสัมพันธ์', description: 'ส่งบทความและโปรโมชัน' },
                ].map((setting) => (
                  <div key={setting.key} className="flex items-center justify-between py-3 border-b">
                    <div>
                      <p className="font-medium text-gray-900">{setting.label}</p>
                      <p className="text-sm text-gray-500">{setting.description}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                ))}
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end pt-6 border-t">
              <Button onClick={saveSettings} disabled={saving}>
                {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
