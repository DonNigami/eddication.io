# ClinicConnect SaaS

> ระบบจัดการคลินิกแบบ SaaS ด้วย LINE LIFF และ Supabase

## 📋 Overview

ระบบจัดการคลินิกเอกชนที่ออกแบบใช้ LINE LIFF ให้ผู้ป่วยจองนัดหมาย ติดตามคิว และดูประวัติการรักษา ผ่านแอป LINE

## 🏗️ Project Structure

```
clinic-connect-saas/
├── apps/
│   ├── liff-patient/          # LINE LIFF สำหรับผู้ป่วย
│   ├── liff-doctor/           # LINE LIFF สำหรับแพทย์
│   └── web/                   # Next.js Admin Dashboard
├── packages/
│   └── config/                # Shared configuration
├── supabase/
│   ├── functions/
│   │   └── line-webhook/      # LINE Webhook Handler
│   └── migrations/
│       └── 001_initial_schema.sql
└── package.json
```

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Supabase Account
- LINE Developers Account

### Installation

```bash
# Clone repository
git clone <repository-url>
cd clinic-connect-saas

# Install dependencies
npm install
```

### Environment Setup

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Update environment variables:
   - Create Supabase project at https://supabase.com
   - Create LINE OA at https://developers.line.biz
   - Update `.env` with your credentials

### Database Setup

```bash
# Run migration
npm run db:migrate
```

Copy the SQL output and run it in Supabase Dashboard > SQL Editor

### Development

```bash
# Start all apps
npm run dev

# Or start individually:
# Patient LIFF
cd apps/liff-patient && npm run dev

# Doctor LIFF
cd apps/liff-doctor && npm run dev

# Admin Dashboard
cd apps/web && npm run dev
```

### Deploy Edge Functions

```bash
# Deploy LINE webhook
supabase functions deploy line-webhook

# Set secrets
supabase secrets set LINE_CHANNEL_SECRET=your_secret
supabase secrets set LINE_CHANNEL_ACCESS_TOKEN=your_token
```

## 📱 Screens

### Patient App (6 screens)
- ✅ Home - หน้าแรก แสดงนัดหมายถัดไปและคิว
- ✅ Booking - จองนัดหมาย
- ✅ Queue - ดูคิวของตัวเอง
- ✅ Records - ประวัติการรักษา
- ✅ Notifications - แจ้งเตือน
- ✅ Profile - โปรไฟล์

### Doctor App (5 screens)
- ✅ Dashboard - ภาพรวมสถิติ
- ✅ Queue - จัดการคิวคนไข้
- ✅ Patients - ค้นหาคนไข้
- ✅ Diagnosis - บันทึกการรักษา (SOAP Note)
- ✅ Schedule - จัดการเวลาว่าง

### Admin Panel (9 screens)
- ✅ Dashboard - ภาพรวมคลินิก
- ✅ Doctors - จัดการแพทย์
- ✅ Patients - จัดการคนไข้
- ✅ Appointments - จัดการนัดหมาย
- ✅ Articles - ข่าวสาร/บทความ
- ✅ Reports - รายงาน
- ✅ Settings - ตั้งค่า
- ✅ Reviews - รีวิว
- ✅ Payments - การชำระเงิน

## 🗄️ Database Schema

- **users** - ผู้ใช้งาน (LINE Login)
- **clinics** - ข้อมูลคลินิก
- **doctors** - ข้อมูลแพทย์
- **patients** - ข้อมูลผู้ป่วย
- **appointments** - นัดหมาย
- **appointment_slots** - ช่วงเวลาที่ว่าง
- **queue_management** - การจัดการคิว
- **medical_records** - ประวัติการรักษา
- **prescriptions** - ใบสั่งยา
- **payments** - การชำระเงิน
- **notifications** - การแจ้งเตือน
- **articles** - บทความ/ข่าวสาร
- **reviews** - รีวิว/คะแนน
- **subscriptions** - การสมัครสมาชิก
- **line_users** - ข้อมูล LINE users
- **conversation_states** - state สำหรับการสนทนา

## 🔐 Security

- RLS (Row Level Security) enabled on all tables
- Webhook signature verification
- Environment variables for sensitive data

## 💰 Pricing (SaaS)

| Tier | Price/ Month | Doctors | Features |
|------|--------------|---------|----------|
| Basic | ฿1,500 | 1-2 | Booking, Queue, LINE Notifications |
| Pro | ฿3,000 | 3-5 | + Medical Records, Articles |
| Clinic | ฿5,000 | 6-10 | + LINE Pay, Reports, Reviews |

## 📄 License

MIT

## 👥 Authors

Eddication.io Team

## 🙏 Acknowledgments

- LINE Platform
- Supabase
- Next.js
