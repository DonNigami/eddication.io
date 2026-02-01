'use client';

import { Bell, Search, Settings } from 'lucide-react';
import { useState } from 'react';

export function Header() {
  const [showNotifications, setShowNotifications] = useState(false);

  const notifications = [
    { id: 1, title: 'นัดหมายใหม่', message: 'คุณสมชาย นัดหมายเวลา 14:00', time: '5 นาทีที่แล้ว', unread: true },
    { id: 2, title: 'คนไข้รอเข้าพบ', message: 'มี 3 คนรอพบแพทย์', time: '15 นาทีที่แล้ว', unread: true },
    { id: 3, title: 'ระบบ', message: 'ระบบสำรองข้อมูลเสร็จสิ้น', time: '1 ชั่วโมงที่แล้ว', unread: false },
  ];

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <header className="flex items-center justify-between h-16 px-6 bg-white border-b border-slate-200">
      {/* Left Side - Search */}
      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาคนไข้, แพทย์, นัดหมาย..."
            className="w-64 pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Right Side - Actions */}
      <div className="flex items-center gap-3">
        {/* Date Display */}
        <div className="hidden lg:block text-right">
          <p className="text-xs text-slate-500">วันนี้</p>
          <p className="text-sm font-medium text-slate-900">
            {new Date().toLocaleDateString('th-TH', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 text-[10px] font-medium text-white bg-rose-500 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowNotifications(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-20 animate-scale-in">
                <div className="px-4 py-3 border-b border-slate-200">
                  <h3 className="font-semibold text-slate-900">การแจ้งเตือน</h3>
                  <p className="text-xs text-slate-500">คุณมี {unreadCount} การแจ้งเตือนที่ยังไม่ได้อ่าน</p>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors ${
                        notification.unread ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {notification.unread && (
                          <div className="w-2 h-2 mt-1.5 bg-blue-600 rounded-full flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900">{notification.title}</p>
                          <p className="text-xs text-slate-600 truncate">{notification.message}</p>
                          <p className="text-xs text-slate-400 mt-1">{notification.time}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2 border-t border-slate-200">
                  <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                    ดูการแจ้งเตือนทั้งหมด
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Settings */}
        <button className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
          <Settings className="w-5 h-5" />
        </button>

        {/* Profile */}
        <button className="flex items-center gap-2 pl-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium ring-2 ring-white shadow-sm">
            A
          </div>
        </button>
      </div>
    </header>
  );
}
