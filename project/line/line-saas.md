# ClinicConnect SaaS - Full Feature Plan
## แผนพัฒนาระบบคลินิกแบบ SaaS ครบทุกฟีเจอร์ (ตาม PDF)

> **Source**: จากเอกสาร "itons5 Course เสียเงินเรียนเอง Line API Expert" (ทุกหน้า)
> **Version**: Full Feature - All Screens & Features
> **Total Screens**: 20+ screens

---

## 📋 Executive Summary

| หัวข้อ | รายละเอียด |
|:-------|:-----------|
| **ชื่อโปรเจกต์** | ClinicConnect SaaS |
| **แพลตฟอร์ม** | LINE Mini App (LIFF) + LINE Messaging API |
| **เป้าหมาย** | ระบบจัดการคลินิกแบบ SaaS สำหรับคลินิกเอกชน |
| **Revenue Model** | Subscription ต่อคลินิก (tier-based) |
| **Tech Stack** | Next.js, Supabase, LINE API, PostgreSQL, TailwindCSS |
| **Timeline** | 12-16 weeks (Full Feature) |

---

## 📱 All Screens (จาก PDF)

### Patient App (6 Screens)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PATIENT APP SCREENS                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. HOME                              4. MEDICAL RECORDS              │
│  ┌─────────────────────────┐        ┌─────────────────────────┐        │
│  │ 👋 สวัสดี, คุณสมชาย       │        │ 📋 ประวัติการรักษา    │        │
│  │                         │        │                         │        │
│  │ 📅 นัดหมายถัดไป          │        │ พญ.สมหญิง            │        │
│  │ ┌─────────────────────┐ │        │ 1 ก.พ. 2024           │        │
│  │ │ พญ. สมหญิง          │ │        │ วินิจฉัย: ปวดหัว    │        │
│  │ │ 1 ก.พ. - 10:00      │ │        │ ยา: Paracetamol       │        │
│  │ │ เลขคิว: A5         │ │        │                         │        │
│  │ └─────────────────────┘ │        │ [ดูรายละเอียด]       │        │
│  │                         │        └─────────────────────────┘        │
│  │ 🏥 คิวของฉัน            │                                        │
│  │ ┌─────────────────────┐ │  5. NOTIFICATIONS                 │
│  │ │ คิวปัจจุบัน: A3     │ │  ┌─────────────────────────┐        │
│  │ │ คิวของคุณ: A5       │ │  │ 🔔 แจ้งเตือน (5)        │        │
│  │ │ รอประมาณ 2 คน      │ │  │                         │        │
│  │ └─────────────────────┘ │  │ • ยืนยันนัดหมาย      │        │
│  │                         │  │ • เรียกคิว A5         │        │
│  │ [จองนัด] [คิว] [ประวัติ]│  │ • ข่าวสาร           │        │
│  └─────────────────────────┘  └─────────────────────────┘        │
│                                                                         │
│  2. BOOKING                         6. PROFILE                      │
│  ┌─────────────────────────┐        ┌─────────────────────────┐        │
│  │ จองนัดหมาย      <        │        │ 👤 โปรไฟล์             │        │
│  │                         │        │                         │        │
│  │ เลือกแพทย์:             │        │ ชื่อ: สมชาย วงศ์สวัสดิ์│        │
│  │ [พญ. สมหญิง ▼]         │        │ เบอร์: 081-234-5678    │        │
│  │                         │        │ วันเกิด: 15/05/1990     │        │
│  │ เลือกวันที่:             │        │                         │        │
│  │ [1][2][3][4][5][6][7]    │        │ ประวัติแพ้ยา:         │        │
│  │                         │        │ • ยาปฏิชีวิย         │        │
│  │ เลือกเวลา:               │        │                         │        │
│  │ [09:00][10:00][11:00]    │        │ โรคประจำตัว:          │        │
│  │                         │        │ • เบาหวาน            │        │
│  │ อาการเบื้องต้น:        │        │                         │        │
│  │ [ปวดหัว ตัวร้อน]       │        │ [แก้ไขข้อมูล]         │        │
│  │                         │        └─────────────────────────┘        │
│  │ [ยกเลิก] [ยืนยัน]       │                                        │
│  └─────────────────────────┘                                        │
│                                                                         │
│  3. MY QUEUE                                                         │
│  ┌─────────────────────────┐                                        │
│  │ 🏥 คิวของฉัน            │                                        │
│  │                         │                                        │
│  │ คิวปัจจุบัน: A5        │                                        │
│  │ รอประมาณ 2 คน         │                                        │
│  │ เวลารอคอย ~20 นาที   │                                        │
│  │                         │                                        │
│  │ ┌─────────────────────┐ │                                        │
│  │ │ คุณ: A5              │ │                                        │
│  │ │ หมอ: พญ. สมหญิง     │ │                                        │
│  │ │ อาการ: ปวดหัว     │ │                                        │
│  │ │ เวลานัด: 10:00      │ │                                        │
│  │ │ Status: ⏳ Waiting    │ │                                        │
│  │ └─────────────────────┘ │                                        │
│  └─────────────────────────┘                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### Doctor App (5 Screens)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DOCTOR APP SCREENS                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. DOCTOR DASHBOARD                   3. PATIENT RECORDS               │
│  ┌─────────────────────────┐        ┌─────────────────────────┐        │
│  │ 👨‍⚕️ นพ. สมศักดิ์           │        │ 👥 คนไข้ทั้งหมด        │        │
│  │                         │        │                         │        │
│  │ ┌───┐ ┌───┐ ┌───┐ ┌───┐  │        │ [ค้นหาคนไข้...]        │        │
│  │ │12 │ │ 3 │ │45 │ │⭐4.9│ │        │                         │        │
│  │ │คน│ │รอ│ │นาที│ │    │  │        │ ┌─────────────────────┐ │        │
│  │ └───┘ └───┘ └───┘ └───┘  │        │ │ คุณสมชาย           │ │        │
│  │                         │        │ │ 081-234-5678         │ │        │
│  │ 🩺 คิวคนไข้วันนี้       │        │ │ ประวัติ: 5 ครั้ง      │ │        │
│  │ ┌─────────────────────┐ │        │ │ แพ้: ยาปฏิชีวิย    │ │        │
│  │ │ A5 - สมชาย          │ │        │ └─────────────────────┘ │        │
│  │ │ A6 - วิภา            │ │        │                         │        │
│  │ │ A7 - สมศรี          │ │        │ [ดูประวัติ] [บันทึก]   │        │
│  │ └─────────────────────┘ │        └─────────────────────────┘        │
│  │                         │                                        │
│  │ [เรียกคิว] [ดูคิวทั้งหมด]│                                        │
│  └─────────────────────────┘                                        │
│                                                                         │
│  2. PATIENT QUEUE                       4. WRITE DIAGNOSIS               │
│  ┌─────────────────────────┐        ┌─────────────────────────┐        │
│  │ 🩺 คิวคนไข้             │        │ 📝 บันทึกการรักษา    │        │
│  │                         │        │                         │        │
│  │ คิวปัจจุบัน: A5        │        │ คนไข้: สมชาย           │        │
│  │                         │        │ วันที่: 1 ก.พ. 2024      │        │
│  │ ┌─────────────────────┐ │        │                         │        │
│  │ │ A5 - คุณสมชาย       │ │        │ SUBJ: ปวดหัว ตัวร้อน│        │
│  │ │ อาการ: ปวดหัว     │ │        │ ┌─────────────────────┐ │        │
│  │ │ เวลานัด: 10:00      │ │        │ │                     │ │        │
│  │ │ Status: ⏳ Waiting    │ │        │ └─────────────────────┘ │        │
│  │ │ [เรียกคิว] [เสร็จ]    │ │        │                         │        │
│  │ └─────────────────────┘ │        │ OBJ: BP 120/80         │        │
│  │                         │        │ Temp 37.0°C            │        │
│  │ ┌─────────────────────┐ │        │                         │        │
│  │ │ A6 - คุณวิภา         │ │        │ ASS: ปวดหังหลัง     │        │
│  │ │ อาการ: ตัวแพ้     │ │        │                         │        │
│  │ │ Status: ⏳ Waiting    │ │        │ PLAN:                  │        │
│  │ │ [เรียกคิว] [เสร็จ]    │ │        │ • Paracetamol 500mg   │        │
│  │ └─────────────────────┘ │        │ • 1 เม็ด ทุก 4 ชม.   │        │
│  │                         │        │ • นอนพักผ่อน         │        │
│  │ [ดูคิวทั้งหมด]         │        │                         │        │
│  └─────────────────────────┘        │ [บันทึก] [สั่งยา]      │        │
│                                         └─────────────────────────┘        │
│                                                                         │
│  5. SCHEDULE                                                          │
│  ┌─────────────────────────┐                                        │
│  │ 📅 จัดการเวลาว่าง       │                                        │
│  │                         │                                        │
│  │ เวลาทำการ: 09:00-17:00  │                                        │
│  │ ระยะเวลาคนไข้: 30 นาที  │                                        │
│  │                         │                                        │
│  │ วันที่ทำการ:           │                                        │
│  │ ☑ จ ☑ อ ☑ พ ☑ พฤ ☑ ศ  │                                        │
│  │ ☐ ส                       │                                        │
│  │                         │                                        │
│  │ วันหยุด:                │                                        │
│  │ + เพิ่มวันหยุด          │                                        │
│  │                         │                                        │
│  │ [บันทึก]                 │                                        │
│  └─────────────────────────┘                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### Admin Panel (9 Screens)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          ADMIN PANEL SCREENS                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. ADMIN DASHBOARD                   4. APPOINTMENTS                   │
│  ┌─────────────────────────────────┐  ┌─────────────────────────┐        │
│  │ 📊 Dashboard                    │  │ 📅 นัดหมายทั้งหมด    │        │
│  │                                 │  │                         │        │
│  │ ┌───┐ ┌───┐ ┌───┐ ┌───┐        │  │ [ค้นหา...] [ตั้งค่า]  │        │
│  │ │45 │ │12 │ │฿15K│ │ 3 │        │  │                         │        │
│  │ │นัด│ │ใหม่│ │ราย│ │หมอ│        │  │ ┌─────────────────────┐│        │
│  │ └───┘ └───┘ └───┘ └───┘        │  │ │ สมชาย - พญ.สมหญิง ││        │
│  │                                 │  │ │ 1 ก.พ. 10:00        ││        │
│  │ 📈 กราฟ 7 วัน                │  │ │ Status: confirmed     ││        │
│  │                                 │  │ │ [ดู] [แก้] [ยกเลิก]   ││        │
│  │ 🩺 นัดหมายวันนี้            │  │ └─────────────────────┘│        │
│  │ ┌─────────────────────────┐   │  │                         │        │
│  │ │ เวลา │ หมอ  │ คนไข้  │สถานะ│   │  │ ┌─────────────────────┐│        │
│  │ ├─────────────────────────┤   │  │ │ วิภา - พญ.สมหญิง   ││        │
│  │ │ 09:00 │ พญ.สม │สมชาย│✅   │   │  │ │ 1 ก.พ. 10:30        ││        │
│  │ │ 09:30 │ พญ.สม │วิภา  │🔄   │   │  │ │ Status: confirmed     ││        │
│  │ │ 10:00 │ นพ.สม │สมศรี│⏳   │   │  │ │ [ดู] [แก้] [ยกเลิก]   ││        │
│  │ └─────────────────────────┘   │  │  └─────────────────────┘│        │
│  │                                 │  │                         │        │
│  │ 📰 ข่าวสารล่าสุด            │  │ [ดูทั้งหมด]            │        │
│  │ └─────────────────────────┘   │  └─────────────────────────┘        │
│  └─────────────────────────────────┘                                        │
│                                                                         │
│  2. MANAGE DOCS                     5. NEWS/ARTICLES                   │
│  ┌─────────────────────────┐        ┌─────────────────────────┐        │
│  │ 👨‍⚕️ จัดการแพทย์          │        │ 📰 ข่าวสาร/บทความ    │        │
│  │                         │        │                         │        │
│  │ [+ เพิ่มแพทย์]           │        │ [+ เขียนบทความ]       │        │
│  │                         │        │                         │        │
│  │ ┌─────────────────────┐ │        │ ┌─────────────────────┐ │        │
│  │ │ พญ. สมหญิง          │ │        │ │ 5 วิธีป้องกันไข้    │ │        │
│  │ │ อายุระบังศาสตร์      │ │        │ │ โพสต์: 12 ม.ค. 24   │ │        │
│  │ │ ⭐ 4.8 (125 รีวิว)   │ │        │ │ อ่าน: 1,250 คน       │ │        │
│  │ │ [แก้] [ลบ]           │ │        │ │ [แก้] [ลบ]          │ │        │
│  │ └─────────────────────┘ │        │ └─────────────────────┘ │        │
│  │                         │        │                         │        │
│  │ ┌─────────────────────┐ │        │ ┌─────────────────────┐ │        │
│  │ │ นพ. สมศักดิ์        │ │        │ │ ประกาศวันหยุด      │ │        │
│  │ │ ศัลยแพทย์           │ │        │ │ โพสต์: 1 ชม. ที่แล้ว│ │        │
│  │ │ ⭐ 4.9 (98 รีวิว)    │ │        │ │ [แก้] [ลบ]          │ │        │
│  │ │ [แก้] [ลบ]           │ │        │ └─────────────────────┘ │        │
│  │ └─────────────────────┘ │        │                         │        │
│  │                         │        │ [ดูทั้งหมด]            │        │
│  └─────────────────────────┘        └─────────────────────────┘        │
│                                                                         │
│  3. MANAGE PATIENTS                 6. REPORTS                        │
│  ┌─────────────────────────┐        ┌─────────────────────────┐        │
│  │ 👥 จัดการคนไข้         │        │ 📊 รายงาน               │        │
│  │                         │        │                         │        │
│  │ [ค้นหาคนไข้...]         │        │ 📈 รายงานรายได้       │        │
│  │                         │        │ ┌─────────────────────┐ │        │
│  │ ┌─────────────────────┐ │        │ │ รายได้รายเดือน      │ │        │
│  │ │ สมชาย วงศ์สวัสดิ์    │ │        │ │                      │ │        │
│  │ │ 081-234-5678         │ │        │ │      ██              │ │        │
│  │ │ คนไข้ตั้งแต่: 2019  │ │        │ │    ████             │ │        │
│  │ │ มาทั้งหมด: 12 ครั้ง  │ │        │ │  ██████             │ │        │
│  │ │ [ดูประวัติ] [แก้]    │ │        │ │ ████████            │ │        │
│  │ └─────────────────────┘ │        │ └─────────────────────┘ │        │
│  │                         │        │                         │        │
│  │ ┌─────────────────────┐ │        │ 📋 รายงานคนไข้        │        │
│  │ │ วิภา สุขสันต์        │ │        │ 🩺 รายงานการรักษา    │        │
│  │ │ 082-345-6789         │ │        │ 💰 รายงานรายได้หมอ   │        │
│  │ │ คนไข้ตั้งแต่: 2021  │ │        │                         │        │
│  │ │ มาทั้งหมด: 5 ครั้ง   │ │        │ [ส่งออก PDF/Excel]    │        │
│  │ │ [ดูประวัติ] [แก้]    │ │        └─────────────────────────┘        │
│  │ └─────────────────────┘ │                                        │
│  │                         │                                        │
│  │ [ดูทั้งหมด]             │                                        │
│  └─────────────────────────┘                                        │
│                                                                         │
│  7. SETTINGS                         8. REVIEWS                         │
│  ┌─────────────────────────┐        ┌─────────────────────────┐        │
│  │ ⚙️ ตั้งค่า                │        │ ⭐ รีวิว                │        │
│  │                         │        │                         │        │
│  │ ข้อมูลคลินิก            │        │ ┌─────────────────────┐ │        │
│  │ • ชื่อ, ที่อยู่         │        │ │ คุณสมชาย           │ │        │
│  │ • เบอร์, อีเมล          │        │ │ ⭐⭐⭐⭐⭐             │ │        │
│  │ • เวลาทำการ            │        │ │ "บริการดีมาก"      │ │        │
│  │                         │        │ │ 1 ก.พ. 2024           │ │        │
│  │ LINE OA                  │        │ │ [ตอบ]                 │ │        │
│  │ • Rich Menu             │        │ └─────────────────────┘ │        │
│  │ • Auto Reply            │        │                         │        │
│  │                         │        │ [ดูทั้งหมด]            │        │
│  │ [บันทึก]                 │        └─────────────────────────┘        │
│  └─────────────────────────┘                                        │
│                                                                         │
│  9. PAYMENTS                                                          │
│  ┌─────────────────────────┐                                        │
│  │ 💰 ประวัติการชำระเงิน  │                                        │
│  │                         │                                        │
│  │ [เดือน: ม.ค. 2024 ▼]     │                                        │
│  │                         │                                        │
│  │ ┌─────────────────────┐ │                                        │
│  │ │ สมชาย              │ │                                        │
│  │ │ 1 ก.พ. 2024         │                                        │
│  │ │ พญ. สมหญิง          │                                        │
│  │ │ ฿500                │                                        │
│  │ │ LINE Pay ✅          │                                        │
│  │ └─────────────────────┘ │                                        │
│  │                         │                                        │
│  │ ┌─────────────────────┐ │                                        │
│  │ │ วิภา                │                                        │
│  │ │ 1 ก.พ. 2024         │                                        │
│  │ │ พญ. สมหญิง          │                                        │
│  │ │ ฿500                │                                        │
│  │ │ เงินสด             │                                        │
│  │ └─────────────────────┘ │                                        │
│  │                         │                                        │
│  │ รวมทั้งหมด: ฿15,000    │                                        │
│  └─────────────────────────┘                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Schema (Full - 18 Tables)

```sql
-- =====================================================
-- CLINIC CONNECT SAAS - FULL DATABASE SCHEMA
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. USERS (LINE Login)
-- =====================================================
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    line_user_id VARCHAR UNIQUE NOT NULL,
    display_name VARCHAR NOT NULL,
    picture_url TEXT,
    email VARCHAR UNIQUE,
    phone VARCHAR,
    role VARCHAR NOT NULL CHECK (role IN ('patient', 'doctor', 'admin')),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. CLINICS
-- =====================================================
CREATE TABLE clinics (
    clinic_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR NOT NULL,
    slug VARCHAR UNIQUE NOT NULL,
    line_oa_id VARCHAR,
    address TEXT,
    province VARCHAR,
    district VARCHAR,
    subdistrict VARCHAR,
    postal_code VARCHAR,
    phone VARCHAR,
    email VARCHAR,
    description TEXT,
    logo_url TEXT,
    cover_image TEXT,
    operating_hours JSONB,
    subscription_tier VARCHAR DEFAULT 'basic',
    subscription_status VARCHAR DEFAULT 'active',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. DOCTORS
-- =====================================================
CREATE TABLE doctors (
    doctor_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    title VARCHAR,
    name VARCHAR NOT NULL,
    license_no VARCHAR UNIQUE,
    specialty VARCHAR,
    consultation_fee DECIMAL(10,2) DEFAULT 0,
    appointment_duration_minutes INT DEFAULT 30,
    education TEXT,
    experience_years INT,
    biography TEXT,
    profile_image TEXT,
    is_available BOOLEAN DEFAULT true,
    available_days JSONB,
    available_time_start TIME,
    available_time_end TIME,
    break_start_time TIME,
    break_end_time TIME,
    rating_average DECIMAL(3,2) DEFAULT 0,
    review_count INT DEFAULT 0,
    total_patients INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. PATIENTS
-- =====================================================
CREATE TABLE patients (
    patient_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    title VARCHAR,
    name VARCHAR NOT NULL,
    phone VARCHAR NOT NULL,
    email VARCHAR,
    date_of_birth DATE,
    gender VARCHAR CHECK (gender IN ('male', 'female', 'other')),
    id_card_number VARCHAR,
    blood_type VARCHAR CHECK (blood_type IN ('A', 'B', 'AB', 'O', 'unknown')),
    blood_rh VARCHAR CHECK (blood_rh IN ('positive', 'negative')),
    allergies TEXT,
    chronic_diseases TEXT,
    current_medications TEXT,
    emergency_contact_name VARCHAR,
    emergency_contact_phone VARCHAR,
    emergency_contact_relation VARCHAR,
    address TEXT,
    insurance_provider VARCHAR,
    insurance_number VARCHAR,
    profile_image TEXT,
    first_visit_date DATE,
    last_visit_date DATE,
    total_visits INT DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinic_id, user_id)
);

-- =====================================================
-- 5. APPOINTMENTS
-- =====================================================
CREATE TABLE appointments (
    appointment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(patient_id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctors(doctor_id) ON DELETE SET NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    end_time TIME,
    duration_minutes INT DEFAULT 30,
    status VARCHAR DEFAULT 'pending' CHECK (status IN (
        'pending', 'confirmed', 'checked_in', 'in_consultation',
        'completed', 'cancelled', 'no_show'
    )),
    queue_number INT,
    queue_status VARCHAR DEFAULT 'waiting' CHECK (queue_status IN (
        'waiting', 'in_queue', 'in_room', 'completed', 'skipped'
    )),
    symptoms TEXT,
    notes TEXT,
    cancel_reason TEXT,
    cancelled_by UUID REFERENCES users(user_id),
    cancelled_at TIMESTAMPTZ,
    check_in_time TIMESTAMPTZ,
    start_time TIMESTAMPTZ,
    end_time_actual TIMESTAMPTZ,
    payment_status VARCHAR DEFAULT 'unpaid',
    payment_amount DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 6. APPOINTMENT SLOTS
-- =====================================================
CREATE TABLE appointment_slots (
    slot_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_minutes INT DEFAULT 30,
    is_available BOOLEAN DEFAULT true,
    is_blocked BOOLEAN DEFAULT false,
    block_reason TEXT,
    appointment_id UUID REFERENCES appointments(appointment_id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(doctor_id, date, start_time)
);

-- =====================================================
-- 7. QUEUE MANAGEMENT
-- =====================================================
CREATE TABLE queue_management (
    queue_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    current_queue INT DEFAULT 0,
    waiting_count INT DEFAULT 0,
    completed_count INT DEFAULT 0,
    skipped_count INT DEFAULT 0,
    no_show_count INT DEFAULT 0,
    last_called_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinic_id, doctor_id, date)
);

-- =====================================================
-- 8. MEDICAL RECORDS
-- =====================================================
CREATE TABLE medical_records (
    record_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID REFERENCES appointments(appointment_id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(patient_id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctors(doctor_id),
    clinic_id UUID REFERENCES clinics(clinic_id),
    chief_complaint TEXT,
    present_illness TEXT,
    physical_exam TEXT,
    vital_signs JSONB,
    diagnosis TEXT,
    treatment_plan TEXT,
    prescription TEXT,
    follow_up_date DATE,
    next_appointment_date DATE,
    notes TEXT,
    attachments JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 9. PRESCRIPTIONS
-- =====================================================
CREATE TABLE prescriptions (
    prescription_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID REFERENCES appointments(appointment_id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(patient_id),
    doctor_id UUID REFERENCES doctors(doctor_id),
    clinic_id UUID REFERENCES clinics(clinic_id),
    medications JSONB NOT NULL,
    notes TEXT,
    is_dispensed BOOLEAN DEFAULT false,
    dispensed_at TIMESTAMPTZ,
    dispensed_by UUID REFERENCES users(user_id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 10. PAYMENTS
-- =====================================================
CREATE TABLE payments (
    payment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID REFERENCES appointments(appointment_id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(patient_id),
    clinic_id UUID REFERENCES clinics(clinic_id),
    amount DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    final_amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR CHECK (payment_method IN (
        'line_pay', 'credit_card', 'promptpay', 'cash', 'other'
    )),
    payment_status VARCHAR DEFAULT 'pending',
    transaction_id VARCHAR,
    transaction_ref VARCHAR,
    payment_date TIMESTAMPTZ,
    receipt_url TEXT,
    receipt_number VARCHAR,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 11. NOTIFICATIONS
-- =====================================================
CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    type VARCHAR NOT NULL CHECK (type IN (
        'appointment_confirmation', 'appointment_reminder', 'queue_update',
        'queue_called', 'appointment_cancelled', 'news', 'system'
    )),
    title VARCHAR,
    message TEXT,
    data JSONB,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    sent_via_line BOOLEAN DEFAULT false,
    line_message_id VARCHAR,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 12. ARTICLES / NEWS
-- =====================================================
CREATE TABLE articles (
    article_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    slug VARCHAR,
    excerpt TEXT,
    content TEXT,
    cover_image TEXT,
    category VARCHAR CHECK (category IN (
        'health', 'clinic_news', 'promotion', 'announcement', 'tips'
    )),
    author VARCHAR,
    status VARCHAR DEFAULT 'draft',
    published_at TIMESTAMPTZ,
    view_count INT DEFAULT 0,
    is_featured BOOLEAN DEFAULT false,
    tags VARCHAR[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinic_id, slug)
);

-- =====================================================
-- 13. REVIEWS / RATINGS
-- =====================================================
CREATE TABLE reviews (
    review_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID REFERENCES appointments(appointment_id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(patient_id),
    doctor_id UUID REFERENCES doctors(doctor_id),
    clinic_id UUID REFERENCES clinics(clinic_id),
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    service_quality_rating INT,
    doctor_professionalism_rating INT,
    cleanliness_rating INT,
    waiting_time_rating INT,
    comment TEXT,
    is_anonymous BOOLEAN DEFAULT false,
    admin_reply TEXT,
    admin_replied_at TIMESTAMPTZ,
    admin_replied_by UUID REFERENCES users(user_id),
    is_visible BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(appointment_id)
);

-- =====================================================
-- 14. SUBSCRIPTIONS
-- =====================================================
CREATE TABLE subscriptions (
    subscription_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    tier VARCHAR NOT NULL CHECK (tier IN ('basic', 'pro', 'clinic')),
    status VARCHAR DEFAULT 'active',
    billing_cycle VARCHAR CHECK (billing_cycle IN ('monthly', 'yearly')),
    monthly_price DECIMAL(10,2),
    start_date DATE NOT NULL,
    end_date DATE,
    max_doctors INT,
    max_appointments_per_month INT,
    features JSONB,
    auto_renew BOOLEAN DEFAULT true,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 15. USAGE LOGS
-- =====================================================
CREATE TABLE usage_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    month DATE NOT NULL,
    year INT NOT NULL,
    appointments_created INT DEFAULT 0,
    appointments_completed INT DEFAULT 0,
    appointments_cancelled INT DEFAULT 0,
    new_patients INT DEFAULT 0,
    messages_sent INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinic_id, year, month)
);

-- =====================================================
-- 16. ADMIN LOGS
-- =====================================================
CREATE TABLE admin_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id),
    action VARCHAR NOT NULL,
    entity_type VARCHAR,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 17. LINE CONFIGURATION
-- =====================================================
CREATE TABLE line_configs (
    config_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    liff_id VARCHAR,
    liff_url VARCHAR,
    channel_id VARCHAR,
    channel_secret VARCHAR,
    access_token VARCHAR,
    rich_menu_id VARCHAR,
    rich_menu_image_url TEXT,
    auto_reply_enabled BOOLEAN DEFAULT true,
    greeting_message TEXT,
    flex_templates JSONB,
    webhook_url VARCHAR,
    webhook_secret VARCHAR,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinic_id)
);

-- =====================================================
-- 18. DOCTOR BLOCKED DATES
-- =====================================================
CREATE TABLE doctor_blocked_dates (
    block_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    block_date DATE NOT NULL,
    block_type VARCHAR CHECK (block_type IN ('holiday', 'leave', 'conference', 'other')),
    reason TEXT,
    is_recurring BOOLEAN DEFAULT false,
    recurring_pattern VARCHAR,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(doctor_id, block_date)
);
```

---

## 🏗️ Project Structure

```
clinic-connect-saas/
├── apps/
│   ├── web/                              # Admin Dashboard (Next.js)
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/
│   │   │   │   └── register/
│   │   │   ├── (dashboard)/
│   │   │   │   ├── dashboard/           # Screen 1
│   │   │   │   ├── doctors/             # Screen 2
│   │   │   │   ├── patients/            # Screen 3
│   │   │   │   ├── appointments/        # Screen 4
│   │   │   │   ├── articles/            # Screen 5
│   │   │   │   ├── reports/             # Screen 6
│   │   │   │   ├── settings/            # Screen 7
│   │   │   │   ├── reviews/             # Screen 8
│   │   │   │   └── payments/            # Screen 9
│   │   │   ├── api/
│   │   │   │   ├── webhooks/line/
│   │   │   │   ├── doctors/
│   │   │   │   ├── patients/
│   │   │   │   └── appointments/
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   ├── dashboard/
│   │   │   ├── doctors/
│   │   │   └── patients/
│   │   └── lib/
│   │
│   └── liff/                              # LINE Mini App
│       ├── patient/
│       │   ├── pages/
│       │   │   ├── home.html             # Screen 1
│       │   │   ├── booking.html           # Screen 2
│       │   │   ├── queue.html             # Screen 3
│       │   │   ├── records.html           # Screen 4
│       │   │   ├── notifications.html     # Screen 5
│       │   │   └── profile.html           # Screen 6
│       │   └── js/
│       │
│       └── doctor/
│           ├── pages/
│           │   ├── dashboard.html         # Screen 1
│           │   ├── queue.html             # Screen 2
│           │   ├── patients.html          # Screen 3
│           │   ├── diagnosis.html         # Screen 4
│           │   └── schedule.html          # Screen 5
│           └── js/
│
├── packages/
│   ├── db/
│   │   └── migrations/
│   ├── ui/
│   ├── types/
│   └── config/
│
├── supabase/
│   ├── functions/
│   │   ├── line-webhook/
│   │   ├── appointment-reminder/
│   │   ├── queue-update/
│   │   └── payment-callback/
│   └── migrations/
│
├── tests/
│   └── e2e/
│
└── README.md
```

---

## 🚀 Development Roadmap (Full Feature)

### Phase 1: Foundation & Patient App (Weeks 1-4)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   PHASE 1: FOUNDATION & PATIENT (4 WEEKS)              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Week 1: SETUP                                                          │
│  ├── Initialize Project (Turborepo + Next.js)                           │
│  ├── Setup Supabase Project                                             │
│  ├── Apply Database Migrations (18 tables)                              │
│  ├── Setup LINE Developers Account                                      │
│  ├── Create LIFF Apps (Patient, Doctor)                                │
│  └── Configure Environment Variables                                     │
│                                                                         │
│  Week 2: AUTHENTICATION & USER MANAGEMENT                               │
│  ├── LINE Login Integration (OAuth 2.0)                                 │
│  ├── User Registration/Login                                             │
│  ├── Role-based Access Control (RLS)                                    │
│  ├── Profile Management                                                 │
│  └── Session Management                                                │
│                                                                         │
│  Week 3: PATIENT - CORE FEATURES                                        │
│  ├── Patient Home Screen (Screen 1)                                    │
│  │   - Show next appointment                                           │
│  │   - Show current queue                                              │
│  │   - Show news/articles                                              │
│  ├── Booking Page (Screen 2)                                           │
│  │   - Select doctor                                                   │
│  │   - Select date/time                                               │
│  │   - Input symptoms                                                  │
│  │   - Confirm booking                                                 │
│  └── Queue Page (Screen 3)                                             │
│      - Show queue number                                               │
│      - Show waiting time                                              │
│                                                                         │
│  Week 4: PATIENT - ADDITIONAL FEATURES                                  │
│  ├── Medical Records Page (Screen 4)                                  │
│  │   - Show visit history                                              │
│  │   - Show diagnosis & prescriptions                                  │
│  ├── Notifications Page (Screen 5)                                    │
│  │   - List all notifications                                         │
│  │   - Mark as read                                                   │
│  └── Profile Page (Screen 6)                                          │
│      - Show/edit personal info                                         │
│      - Show allergies, conditions                                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Phase 2: Doctor App (Weeks 5-7)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       PHASE 2: DOCTOR APP (3 WEEKS)                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Week 5: DOCTOR - DASHBOARD & QUEUE                                     │
│  ├── Doctor Dashboard (Screen 1)                                      │
│  │   - Today's statistics                                             │
│  │   - Patient count                                                  │
│  │   - Revenue summary                                                │
│  │   - Rating display                                                │
│  └── Patient Queue (Screen 2)                                         │
│      - Show waiting patients                                          │
│      - Call next patient                                              │
│      - Update patient status                                          │
│                                                                         │
│  Week 6: DOCTOR - PATIENT MANAGEMENT                                   │
│  ├── Patient Records (Screen 3)                                       │
│  │   - Search patients                                                │
│  │   - View patient profile                                           │
│  │   - View medical history                                           │
│  └── Write Diagnosis (Screen 4)                                       │
│      - SOAP Note form                                                  │
│      - Vital signs input                                              │
│      - Diagnosis input                                                │
│      - Treatment plan                                                 │
│      - Prescription writer                                            │
│                                                                         │
│  Week 7: DOCTOR - SCHEDULE                                             │
│  └── Schedule Management (Screen 5)                                    │
│      - Set working hours                                              │
│      - Set available days                                             │
│      - Block dates (holidays, leave)                                  │
│      - Break time settings                                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Phase 3: Admin Panel (Weeks 8-11)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      PHASE 3: ADMIN PANEL (4 WEEKS)                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Week 8: ADMIN - DASHBOARD & DOCTORS                                   │
│  ├── Admin Dashboard (Screen 1)                                       │
│  │   - Clinic overview                                                │
│  │   - Statistics cards                                              │
│  │   - Charts (7 days, revenue)                                       │
│  │   - Today's appointments list                                      │
│  └── Manage Doctors (Screen 2)                                        │
│      - Add/Edit/Delete doctors                                         │
│      - Doctor profiles                                                 │
│      - Availability settings                                           │
│                                                                         │
│  Week 9: ADMIN - PATIENTS & APPOINTMENTS                              │
│  ├── Manage Patients (Screen 3)                                       │
│  │   - Patient list with search                                       │
│  │   - Patient details                                                │
│  │   - Visit history                                                  │
│  └── Appointments (Screen 4)                                          │
│      - All appointments list                                          │
│      - Filter by status/doctor/date                                    │
│      - View details                                                   │
│      - Cancel/reschedule                                              │
│                                                                         │
│  Week 10: ADMIN - CONTENT & REPORTS                                   │
│  ├── News/Articles (Screen 5)                                         │
│  │   - Create/Edit/Delete articles                                    │
│  │   - Rich text editor                                               │
│  │   - Category management                                            │
│  │   - Publish schedule                                              │
│  └── Reports (Screen 6)                                               │
│      - Revenue reports                                                │
│      - Patient reports                                               │
│      - Doctor performance reports                                     │
│      - Export to PDF/Excel                                            │
│                                                                         │
│  Week 11: ADMIN - SETTINGS & REVIEWS                                  │
│  ├── Settings (Screen 7)                                             │
│  │   - Clinic information                                             │
│  │   - Operating hours                                               │
│  │   - LINE OA configuration                                         │
│  │   - Rich menu setup                                               │
│  ├── Reviews (Screen 8)                                              │
│  │   - View all reviews                                               │
│  │   - Admin reply                                                   │
│  │   - Show/hide reviews                                             │
│  └── Payments (Screen 9)                                              │
│      - Payment history                                               │
│      - Revenue summary                                               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Phase 4: LINE Integration & Notifications (Weeks 12-13)

```
┌─────────────────────────────────────────────────────────────────────────┐
│              PHASE 4: LINE INTEGRATION (2 WEEKS)                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Week 12: LINE MESSAGING API                                            │
│  ├── Push Notifications                                               │
│  │   - Appointment confirmation                                       │
│  │   - Appointment reminders (1 day, 1 hour before)                  │
│  │   - Queue called notification                                     │
│  │   - Cancellation notifications                                     │
│  ├── Flex Messages                                                    │
│  │   - Appointment card template                                     │
│  │   - Queue update template                                         │
│  │   - News/article template                                         │
│  └── Rich Menu                                                        │
│      - Home menu                                                     │
│      - Quick actions                                                 │
│                                                                         │
│  Week 13: LINE WEBHOOK & EDGE FUNCTIONS                                │
│  ├── LINE Webhook Handler                                             │
│  │   - Receive user messages                                         │
│  │   - Handle follow events                                          │
│  │   - Auto reply setup                                              │
│  ├── Supabase Edge Functions                                          │
│  │   - Appointment reminder cron                                     │
│  │   - Queue update broadcast                                        │
│  │   - Payment callback handler                                      │
│  └── LINE OA Configuration                                             │
│      - Greeting message                                              │
│      - Auto reply keywords                                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Phase 5: Payment & SaaS Features (Weeks 14-15)

```
┌─────────────────────────────────────────────────────────────────────────┐
│           PHASE 5: PAYMENT & SAAS (2 WEEKS)                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Week 14: PAYMENT INTEGRATION                                          │
│  ├── LINE Pay Integration                                             │
│  │   - Payment request API                                            │
│  │   - Payment confirmation                                          │
│  │   - Refund handling                                               │
│  ├── Payment Flow                                                     │
│  │   - Pay after booking                                             │
│  │   - Pay at clinic option                                         │
│  └── Receipt Generation                                               │
│      - E-receipt                                                     │
│      - Receipt number                                               │
│                                                                         │
│  Week 15: SAAS PLATFORM                                               │
│  ├── Subscription Management                                           │
│  │   - Tier-based features                                           │
│  │   - Usage tracking                                               │
│  │   - Billing page                                                 │
│  ├── Subscription Tiers                                               │
│  │   - Basic: 1-2 doctors, ฿1,500/mo                                │
│  │   - Pro: 3-5 doctors, ฿3,000/mo                                  │
│  │   - Clinic: 6-10 doctors, ฿5,000/mo                             │
│  └── Upgrade/Downgrade Flow                                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Phase 6: Testing & Launch (Week 16)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  PHASE 6: TESTING & LAUNCH (1 WEEK)                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ├── E2E Testing (Playwright)                                          │
│  │   - Patient booking flow                                          │
│  │   - Doctor queue management                                       │
│  │   - Admin CRUD operations                                         │
│  ├── Load Testing                                                     │
│  ├── Security Testing                                                 │
│  ├── Bug Fixes                                                         │
│  ├── Production Deployment                                             │
│  └── Documentation                                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Feature Matrix

| Feature | Patient | Doctor | Admin |
|:--------|:--------|:-------|:------|
| **Home / Dashboard** | ✅ | ✅ | ✅ |
| **Booking** | ✅ | ❌ | ❌ |
| **Queue Management** | ✅ (View) | ✅ (Manage) | ✅ (View) |
| **Medical Records** | ✅ (View) | ✅ (Write) | ✅ (View) |
| **Notifications** | ✅ | ✅ | ❌ |
| **Profile** | ✅ | ❌ | ❌ |
| **Patient Search** | ❌ | ✅ | ✅ |
| **Write Diagnosis** | ❌ | ✅ | ❌ |
| **Schedule Mgmt** | ❌ | ✅ | ✅ |
| **Doctor Mgmt** | ❌ | ❌ | ✅ |
| **Appointment Mgmt** | ❌ | ❌ | ✅ |
| **Articles/News** | ✅ (View) | ❌ | ✅ (CRUD) |
| **Reports** | ❌ | ✅ (Personal) | ✅ (All) |
| **Settings** | ❌ | ❌ | ✅ |
| **Reviews** | ✅ (Write) | ❌ | ✅ (Reply) |
| **Payments** | ✅ (Pay) | ❌ | ✅ (View) |

---

## 💰 Pricing (SaaS)

| Tier | ราคา/เดือน | หมอ | ฟีเจอร์ |
|:-----|:-----------|:----|:--------|
| **Basic** | ฿1,500 | 1-2 | จองนัด, คิว, แจ้งเตือน LINE |
| **Pro** | ฿3,000 | 3-5 | + Medical Records, Articles |
| **Clinic** | ฿5,000 | 6-10 | + LINE Pay, Reports, Reviews |

---

## ✅ Success Criteria

### All 20 Screens Built
- [ ] Patient: Home, Booking, Queue, Records, Notifications, Profile (6)
- [ ] Doctor: Dashboard, Queue, Patients, Diagnosis, Schedule (5)
- [ ] Admin: Dashboard, Doctors, Patients, Appointments, Articles, Reports, Settings, Reviews, Payments (9)

### All Features Working
- [ ] LINE Login works for all roles
- [ ] Appointment booking flow complete
- [ ] Queue management real-time
- [ ] Medical records CRUD
- [ ] LINE notifications sent
- [ ] Payment via LINE Pay
- [ ] Reviews & ratings
- [ ] Reports & analytics
- [ ] SaaS subscription

---

---

## 🚀 LINE API Expert Features - Advanced Integration

> **Source**: จากเอกสาร "itons5 Course เสียเงินเรียนเอง Line API Expert"
> **Added**: 2025-01-31

---

### 1. LINE Things - IoT Device Integration

**Use Case**: เชื่อมต่ออุปกรณ์แพทย์ (BP monitor, Thermometer, Glucometer) กับ LINE

```
┌──────────────┐         BLE/WiFi         ┌──────────────┐
│  Medical     │ ───────────────────────> │  LINE Things │
│  Device      │ <─────────────────────── │  Device Link │
└──────────────┘                         └──────────────┘
                                               │
                                               ▼
                                         ┌──────────────┐
                                         │  Auto Sync   │
                                         │  Vital Signs │
                                         └──────────────┘
```

**Webhook Event Handling**:

```typescript
// LINE Things Webhook Event
interface LINEThingsEvent {
  type: 'things';
  source: { userId: string };
  things: {
    type: 'link' | 'unlink';
    deviceId: string;
    result?: {
      heartbeat: number;
      bloodPressure: string;
      temperature: number;
      bloodSugar: number;
    }
  }
}

// Handle device link
async function handleDeviceLink(event: LINEThingsEvent) {
  const { userId } = event.source;
  const { deviceId, type, result } = event.things;

  if (type === 'link') {
    // Pair device with patient profile
    await supabase.from('patients').update({
      iot_device_id: deviceId,
      device_linked_at: new Date().toISOString()
    }).eq('line_user_id', userId);

    await pushNotification(userId, '🩺 เชื่อมต่ออุปกรณ์สำเร็จ!');
  }

  if (result) {
    // Auto-save vital signs from device
    await supabase.from('vital_signs').insert({
      patient_id: await getPatientId(userId),
      device_id: deviceId,
      heartbeat: result.heartbeat,
      blood_pressure: result.bloodPressure,
      temperature: result.temperature,
      blood_sugar: result.bloodSugar,
      recorded_at: new Date().toISOString(),
      source: 'iot_device'
    });
  }
}
```

**Supported Device Types**:

| ประเภท | ตัวอย่าง | ข้อมูลที่ได้ |
|:------|:----------|:--------------|
| **BP Monitor** | Omron, iHealth | Systolic/Diastolic, Pulse |
| **Thermometer** | Withings, Kinsa | Temperature (°C/°F) |
| **Glucometer** | Accu-Chek, OneTouch | Blood Sugar (mg/dL) |
| **Smart Scale** | Tanita, Fitbit | Weight, BMI, Body Fat |

---

### 2. LINE Login - Web Admin Authentication

**Use Case**: ให้แพทย์/แอดมิน Login ผ่าน LINE ใน Web Dashboard

```
┌──────────┐     LINE Login      ┌──────────────┐
│   Admin  │ ──────────────────> │  LINE OAuth  │
│  Panel   │ <────────────────── │  Redirect    │
└──────────┘                     └──────────────┘
                                      │
                                      ▼
                               ┌──────────────┐
                               │  Access Token│
                               │  + ID Token  │
                               └──────────────┘
```

**Implementation**:

```typescript
// LINE Login Configuration
const LINE_LOGIN_CONFIG = {
  channelId: process.env.LINE_CHANNEL_ID,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  redirectUri: `${process.env.APP_URL}/auth/line/callback`,
  scope: 'profile email openid',
  nonce: generateNonce()
};

// Step 1: Redirect to LINE Login
function initiateLineLogin() {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: LINE_LOGIN_CONFIG.channelId,
    redirect_uri: LINE_LOGIN_CONFIG.redirectUri,
    state: generateState(),
    scope: LINE_LOGIN_CONFIG.scope,
    nonce: LINE_LOGIN_CONFIG.nonce
  });

  return `https://access.line.me/oauth2/v2.1/authorize?${params}`;
}

// Step 2: Handle callback
async function handleLineCallback(code: string, state: string) {
  // Exchange code for access token
  const tokenResponse = await axios.post(
    'https://api.line.me/oauth2/v2.1/token',
    new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: LINE_LOGIN_CONFIG.redirectUri,
      client_id: LINE_LOGIN_CONFIG.channelId,
      client_secret: LINE_LOGIN_CONFIG.channelSecret,
      id_token_key_type: 'jwk'
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  // Verify ID Token
  const idToken = tokenResponse.data.id_token;
  const userInfo = await verifyIdToken(idToken, LINE_LOGIN_CONFIG.nonce);

  return {
    userId: userInfo.sub,
    displayName: userInfo.name,
    email: userInfo.email,
    pictureUrl: userInfo.picture,
    accessToken: tokenResponse.data.access_token
  };
}

// Step 3: Verify ID Token
async function verifyIdToken(idToken: string, nonce: string) {
  const jwks = await axios.get('https://api.line.me/oauth2/v2.1/certs');
  const decoded = jwt.verify(idToken, jwks.data);

  if (decoded.nonce !== nonce) {
    throw new Error('Invalid nonce');
  }

  return decoded;
}
```

---

### 3. Location Messages - Enhanced Check-in

**Use Case**: ผู้ป่วยแชร์พิกัดสำหรับ Home Visit หรือ Check-in คลินิก

```javascript
// Request location from patient
{
  type: 'text',
  text: '📍 กรุณาแชร์ตำแหน่งของคุณ:',
  quickReply: {
    items: [{
      type: 'action',
      action: {
        type: 'location',
        label: '📍 แชร์ตำแหน่ง'
      }
    }]
  }
}

// Location message received
{
  type: 'location',
  title: 'บ้านคุณสมชาย',
  address: '123 ถนนสุขุมวิท, บางจาก, พระโขนง',
  latitude: 13.7261,
  longitude: 100.6123
}
```

**Webhook Handler**:

```typescript
async function handleLocationMessage(lineUserId: string, location: Location) {
  const { latitude, longitude, title, address } = location;

  // Get patient's current appointment
  const appointment = await getCurrentAppointment(lineUserId);

  // Calculate distance to clinic/home visit location
  const targetLat = appointment.is_home_visit
    ? appointment.patient_address_lat
    : appointment.clinic_lat;

  const targetLng = appointment.is_home_visit
    ? appointment.patient_address_lng
    : appointment.clinic_lng;

  const distance = haversineDistance(
    latitude, longitude,
    targetLat, targetLng
  );

  // Check if within acceptable radius (100 meters)
  if (distance <= 100) {
    await recordCheckIn(lineUserId, {
      latitude,
      longitude,
      address,
      method: 'location_message',
      timestamp: new Date()
    });

    await pushNotification(lineUserId, '✅ Check-in สำเร็จ!');
  } else {
    await pushNotification(
      lineUserId,
      `❌ ห่างจากจุดหมาย ${Math.round(distance)} เมตร กรุณาเข้าใกล้อีกครั้ง`
    );
  }
}

// Haversine distance formula
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
```

---

### 4. File Sharing - Medical Documents

**Use Case**: ผู้ป่วยอัปโหลดเอกสาร (LAB, X-Ray, ใบรับประกัน) ผ่าน LINE

```javascript
// Request document upload
{
  type: 'text',
  text: '📎 กรุณาอัปโหลดผลตรวจ LAB:',
  quickReply: {
    items: [
      {
        type: 'action',
        action: {
          type: 'camera',
          label: '📷 ถ่ายรูป',
          text: '/upload lab'
        }
      },
      {
        type: 'action',
        action: {
          type: 'cameraRoll',
          label: '🖼️ เลือกจากอัลบั้ม',
          text: '/upload lab'
        }
      }
    ]
  }
}
```

**Webhook Handler for File Upload**:

```typescript
async function handleFileUpload(event: MessageEvent) {
  const messageId = event.message.id;
  const lineUserId = event.source.userId;

  // Download file content from LINE
  const contentType = event.message.type; // 'image', 'video', 'audio', 'file'

  const response = await axios.get(
    `https://api-data.line.me/v2/bot/message/${messageId}/content`,
    {
      responseType: 'arraybuffer',
      headers: {
        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
      }
    }
  );

  const fileBuffer = Buffer.from(response.data);
  const fileExtension = contentType === 'image' ? 'jpg' : 'pdf';
  const fileName = `lab-${lineUserId}-${Date.now()}.${fileExtension}`;

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('medical-documents')
    .upload(`${lineUserId}/${fileName}`, fileBuffer, {
      contentType: response.headers['content-type'],
      upsert: false
    });

  if (error) throw error;

  // Save document record
  await supabase.from('patient_documents').insert({
    patient_id: await getPatientId(lineUserId),
    document_type: 'lab_result',
    file_name: fileName,
    file_path: data.path,
    file_url: `${SUPABASE_URL}/storage/v1/object/public/medical-documents/${data.path}`,
    uploaded_via: 'line',
    created_at: new Date().toISOString()
  });

  await pushNotification(lineUserId, '✅ อัปโหลดเอกสารสำเร็จ');
}
```

---

### 5. Narrowcast - Targeted Messaging

**Use Case**: ส่งข้อความแจ้งเตือนเฉพาะกลุ่มคนไข้

```typescript
// Create audience group for specific patient segment
async function createAudienceGroup(criteria: AudienceCriteria) {
  const response = await axios.post(
    'https://api.line.me/v2/bot/audienceGroup',
    {
      description: criteria.name,
      isIfaAudience: false,
      audiences: criteria.patientIds.map(id => ({
        type: 'USER_ID',
        userId: id
      }))
    },
    { headers }
  );

  return response.data.audienceGroupId;
}

// Narrowcast message to audience
async function narrowcastToSegment(
  audienceGroupId: string,
  message: any
) {
  const response = await axios.post(
    'https://api.line.me/v2/bot/message/narrowcast',
    {
      to: {
        type: 'audience',
        audienceGroupId: audienceGroupId
      },
      messages: [message]
    },
    { headers }
  );

  return response.data;
}

// Usage Examples
async function sendDiabetesReminder() {
  // Get all diabetes patients
  const { data: patients } = await supabase
    .from('patients')
    .select('line_user_id')
    .ilike('chronic_diseases', '%เบาหวาน%');

  const audienceId = await createAudienceGroup({
    name: 'Diabetes Patients',
    patientIds: patients.map(p => p.line_user_id)
  });

  await narrowcastToSegment(audienceId, {
    type: 'text',
    text: '💊 เตือน: อย่าลืมตรวจน้ำตาลเป็นประจำ และทานยาตามแพทย์สั่งนะครับ/คะ'
  });
}
```

**Audience Segmentation Examples**:

| กลุ่ม | Criteria | ข้อความตัวอย่าง |
|:-----|:---------|:------------------|
| **เบาหวาน** | `chronic_diseases LIKE '%เบาหวาน%'` | 💊 เตือนทานยาลดน้ำตาล |
| **ความดัน** | `chronic_diseases LIKE '%ความดัน%'` | 🩺 เตือนตรวจความดันประจำ |
| **ตั้งครรภ์** | `is_pregnant = true` | 🤰 เตือนนัดตรวจครรภ์ |
| **ครบกำหนด** | `next_appointment_date = TODAY` | 📅 พรุ่งนี้นัดหมายครับ/คะ |

---

### 6. Verification Messages - Double Confirmation

**Use Case**: ยืนยันการยกเลิกนัดหมาย / การเปลี่ยนแปลงสำคัญ

```typescript
// Send verification message
async function sendCancellationConfirmation(appointmentId: string, lineUserId: string) {
  await axios.post(
    'https://api.line.me/v2/bot/message/push',
    {
      to: lineUserId,
      messages: [{
        type: 'text',
        text: `❓ คุณต้องการยกเลิกนัดหมายวันที่ ${appointmentDate} ใช่หรือไม่?\n\n` +
              `แพทย์: ${doctorName}\n` +
              `เวลา: ${appointmentTime}`,
        quickReply: {
          items: [
            {
              type: 'action',
              action: {
                type: 'message',
                label: '✓ ใช่ ยกเลิก',
                text: `/confirm cancel ${appointmentId}`
              }
            },
            {
              type: 'action',
              action: {
                type: 'message',
                label: '✗ ไม่ใช่',
                text: '/cancel action'
              }
            }
          ]
        }
      }]
    },
    { headers }
  );
}

// Handle confirmation
async function handleConfirmCancel(lineUserId: string, appointmentId: string) {
  // Check if user initiated cancellation request
  const pendingRequest = await supabase
    .from('pending_actions')
    .select('*')
    .eq('user_id', lineUserId)
    .eq('action', 'cancel_appointment')
    .eq('target_id', appointmentId)
    .single();

  if (!pendingRequest) {
    await pushNotification(lineUserId, '❌ ไม่พบคำขอยกเลิกนัดหมาย');
    return;
  }

  // Check if still within cancellation window
  const appointment = await getAppointment(appointmentId);
  const hoursUntilAppointment = differenceInHours(
    new Date(appointment.appointment_date),
    new Date()
  );

  if (hoursUntilAppointment < 3) {
    await pushNotification(
      lineUserId,
      '❌ ไม่สามารถยกเลิกได้ (น้อยกว่า 3 ชั่วโมง) กรุณาโทรติดต่อคลินิก'
    );
    return;
  }

  // Proceed with cancellation
  await cancelAppointment(appointmentId, lineUserId);

  await pushNotification(
    lineUserId,
    '✅ ยกเลิกนัดหมายสำเร็จแล้วครับ/คะ'
  );
}
```

---

### 7. Get Member IDs - Group Management

**Use Case**: ดึงรายชื่อสมาชิกในกลุ่มสำหรับ Support Group

```typescript
// Get all member IDs in a group
async function getGroupMembers(groupId: string) {
  const response = await axios.get(
    `https://api.line.me/v2/bot/group/${groupId}/members/ids`,
    { headers }
  );

  const memberIds: string[] = response.data.memberIds; // Max 100
  const nextToken = response.data.next;

  // Pagination for groups > 100 members
  let allMembers = [...memberIds];
  let token = nextToken;

  while (token) {
    const pageResponse = await axios.get(
      `https://api.line.me/v2/bot/group/${groupId}/members/ids?start=${token}`,
      { headers }
    );

    allMembers = [...allMembers, ...pageResponse.data.memberIds];
    token = pageResponse.data.next;
  }

  return allMembers;
}

// Get member count
async function getGroupMemberCount(groupId: string) {
  const response = await axios.get(
    `https://api.line.me/v2/bot/group/${groupId}/members/count`,
    { headers }
  );

  return response.data.count;
}

// Get member profile
async function getGroupMemberProfile(groupId: string, userId: string) {
  const response = await axios.get(
    `https://api.line.me/v2/bot/group/${groupId}/member/${userId}`,
    { headers }
  );

  return {
    displayName: response.data.displayName,
    pictureUrl: response.data.pictureUrl
  };
}
```

**Use Cases**:

| Use Case | Description |
|:---------|:------------|
| **Sync Members** | Sync รายชื่อกลุ่มเข้า Database |
| **Admin Detection** | หาว่าใครเป็น Admin ในกลุ่ม |
| **Welcome Message** | ส่งข้อความต้อนรับเมื่อมีคนใหม่เข้ากลุ่ม |
| **Member Left** | จัดการเมื่อสมาชิกออกจากกลุ่ม |

---

### 8. Event Source Detection - Smart Routing

**Handle messages from different sources differently**

```typescript
interface WebhookEvent {
  source: {
    type: 'user' | 'group' | 'room';
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
}

async function handleEvent(event: WebhookEvent) {
  const { source } = event;

  switch (source.type) {
    case 'user':
      // Direct 1-on-1 message - handle as personal action
      await handleDirectMessage(event);
      break;

    case 'group':
      // Group message - check if command or regular chat
      if (event.message.text.startsWith('/')) {
        await handleGroupCommand(event);
      } else {
        await handleGroupChat(event);
      }
      break;

    case 'room':
      // Multi-person chat (not named group)
      await handleRoomMessage(event);
      break;
  }
}

// Group-specific: Get group summary
async function getGroupSummary(groupId: string) {
  const [memberCount, groupName] = await Promise.all([
    getGroupMemberCount(groupId),
    getGroupSummary(groupId)
  ]);

  return {
    groupId,
    memberCount,
    groupName
  };
}
```

---

### 9. Beacon Events - Proximity Check-in

**Use Case**: เครื่องหมาย Bluetooth Beacon ติดที่เคาน์เตอร์คลินิก

```typescript
// Beacon webhook event
interface BeaconEvent {
  type: 'beacon';
  source: { userId: string };
  beacon: {
    type: 'enter' | 'leave' | 'banner';
    hwid: string;     // Beacon hardware ID
    dm: string;       // Device message
  }
}

// Handle beacon enter event
async function handleBeaconEnter(event: BeaconEvent) {
  const { userId } = event.source;
  const { hwid } = event.beacon;

  // Find which beacon location this is
  const location = await supabase
    .from('beacon_locations')
    .select('*')
    .eq('hardware_id', hwid)
    .single();

  if (!location) {
    console.log(`Unknown beacon: ${hwid}`);
    return;
  }

  // Auto check-in if patient has appointment today
  const today = new Date().toISOString().split('T')[0];
  const appointment = await supabase
    .from('appointments')
    .select('*')
    .eq('patient.line_user_id', userId)
    .eq('appointment_date', today)
    .eq('status', 'confirmed')
    .single();

  if (appointment) {
    await recordCheckIn(userId, {
      method: 'beacon',
      beacon_id: hwid,
      location: location.name,
      timestamp: new Date()
    });

    await pushNotification(
      userId,
      `✅ Check-in สำเร็จที่ ${location.name}\nคิวของคุณ: ${appointment.queue_number}`
    );
  }
}
```

---

### 10. Message Limits & Best Practices

**LINE API Rate Limits**:

| API | Limit | Description |
|:----|:------|:------------|
| **Push/Multicast** | 1,000/min | Progressive refill |
| **Broadcast** | 3/day | All users |
| **Narrowcast** | 10,000/req | Per audience |
| **Get Content** | 1,000/min | Download files |
| **Get Profile** | 10,000/min | User info |

**Retry Strategy**:

```typescript
async function sendWithRetry(
  apiCall: () => Promise<any>,
  maxRetries = 3
) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      if (error.response?.status === 429) {
        // Rate limited - wait and retry
        const retryAfter = error.response.headers['retry-after'];
        const waitMs = (parseInt(retryAfter) || 1) * 1000;
        await sleep(waitMs);
        continue;
      }
      throw error;
    }
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

### 11. Message Content Retention

| Content Type | Retention Period |
|:-------------|:-----------------|
| **Image** | 30 days |
| **Video** | 7 days |
| **Audio** | 7 days |
| **File** | 30 days |

**Best Practice**: Always download and save to your own storage (Supabase Storage, S3)

```typescript
async function saveContentToStorage(messageId: string, type: string) {
  const response = await axios.get(
    `https://api-data.line.me/v2/bot/message/${messageId}/content`,
    {
      responseType: 'arraybuffer',
      headers: { 'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` }
    }
  );

  // Save to Supabase Storage
  const fileName = `${type}-${messageId}-${Date.now()}.jpg`;
  await supabase.storage
    .from('line-content')
    .upload(fileName, response.data);

  return fileName;
}
```

---

## Feature Priority Matrix

| Priority | Feature | Complexity | Impact |
|:---------|:--------|:-----------|:-------|
| 🔴 **High** | Location Messages | Low | High - Better UX |
| 🔴 **High** | Verification Messages | Low | High - Prevent mistakes |
| 🔴 **High** | Narrowcast | Medium | High - Targeted alerts |
| 🟡 **Medium** | File Sharing | Medium | High - Document workflow |
| 🟡 **Medium** | LINE Login | Medium | Medium - Web admin |
| 🟡 **Medium** | Get Member IDs | Low | Medium - Group sync |
| 🟢 **Low** | LINE Things | High | Medium - IoT integration |
| 🟢 **Low** | Beacon Events | Medium | Low - Hardware needed |

---

## 🚀 GitHub + Supabase + LINE Architecture

> **Added**: 2025-02-01
> **Purpose**: Integration guide for LINE SaaS using GitHub + Supabase

---

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         GitHub (CI/CD)                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  GitHub Actions → Supabase Deploy → LINE Webhook Update          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Supabase (Backend-as-a-Service)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ PostgreSQL   │  │ Edge Functions│  │ Realtime     │  │ Storage    │ │
│  │              │  │ (Webhook)     │  │ Subscriptions│  │            │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        LINE Platform                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ Messaging API│  │ LIFF App     │  │ LINE Login   │  │ LINE OA    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 1. Supabase Edge Functions = LINE Webhook Server

**ไม่ต้องใช้ Express server แยก!** ใช้ Edge Functions แทบฟรี

```typescript
// supabase/functions/line-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import crypto from 'https://deno.land/std@0.168.0/crypto/mod.ts'

const LINE_CHANNEL_SECRET = Deno.env.get('LINE_CHANNEL_SECRET')!
const LINE_ACCESS_TOKEN = Deno.env.get('LINE_ACCESS_TOKEN')!

// Verify LINE webhook signature
async function verifySignature(body: string, signature: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(LINE_CHANNEL_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)))
  return signature === expected
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const body = await req.text()
  const signature = req.headers.get('x-line-signature')!

  if (!await verifySignature(body, signature)) {
    return new Response('Invalid signature', { status: 401 })
  }

  const events = JSON.parse(body).events

  for (const event of events) {
    await handleEvent(event)
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' }
  })
})

async function handleEvent(event: any) {
  const { type, source, replyToken } = event

  switch (type) {
    case 'follow':
      await handleFollow(source.userId, replyToken)
      break
    case 'message':
      await handleMessage(event)
      break
    case 'postback':
      await handlePostback(event)
      break
  }
}

async function handleFollow(userId: string, replyToken: string) {
  // Save user to Supabase
  const supabase = createClient(...)
  await supabase.from('line_users').insert({
    user_id: userId,
    followed_at: new Date().toISOString(),
    status: 'active'
  })

  // Send welcome message
  await replyMessage(replyToken, {
    type: 'text',
    text: 'ยินดีต้อนรับสู่ ClinicConnect! 🏥'
  })
}

async function replyMessage(replyToken: string, messages: any) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
    },
    body: JSON.stringify({ replyToken, messages: [messages] })
  })
}
```

**Deploy ง่ายๆ:**
```bash
supabase functions deploy line-webhook
```

---

### 2. Supabase Tables สำหรับ LINE SaaS

```sql
-- =====================================================
-- LINE-ADDITIONAL TABLES FOR CLINIC CONNECT
-- =====================================================

-- Line Users table
CREATE TABLE line_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(50) UNIQUE NOT NULL, -- LINE userId
  display_name VARCHAR(100),
  picture_url TEXT,
  status_message TEXT,
  followed_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'active', -- active, blocked, inactive
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversation states (สำหรับ state machine)
CREATE TABLE conversation_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(50) REFERENCES line_users(user_id),
  state_name VARCHAR(50) NOT NULL,
  state_data JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message logs (สำหรับ analytics)
CREATE TABLE message_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(50),
  direction VARCHAR(10), -- inbound, outbound
  message_type VARCHAR(20),
  content JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rich menu assignments
CREATE TABLE rich_menu_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(50) REFERENCES line_users(user_id),
  rich_menu_id VARCHAR(50),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Broadcast campaigns
CREATE TABLE broadcast_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100),
  message_template JSONB NOT NULL,
  target_audience JSONB,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'pending', -- pending, sent, failed
  stats JSONB DEFAULT '{}'
);

-- Indexes
CREATE INDEX idx_line_users_user_id ON line_users(user_id);
CREATE INDEX idx_conversation_states_user_id ON conversation_states(user_id);
CREATE INDEX idx_message_logs_user_id ON message_logs(user_id);
CREATE INDEX idx_message_logs_created_at ON message_logs(created_at);

-- Enable RLS
ALTER TABLE line_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile"
  ON line_users FOR SELECT
  USING (auth.jwt() ->> 'line_user_id' = user_id);

CREATE POLICY "Service role full access line_users"
  ON line_users FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own conversations"
  ON conversation_states FOR SELECT
  USING (user_id = auth.jwt() ->> 'line_user_id');

CREATE POLICY "Users can view own messages"
  ON message_logs FOR SELECT
  USING (user_id = auth.jwt() ->> 'line_user_id');
```

---

### 3. Supabase Realtime + LINE Notifications

```typescript
// Edge function สำหรับ realtime notification
// supabase/functions/notify-line/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Subscribe to database changes
  supabase
    .channel('appointment_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'appointments',
        filter: 'status=eq.confirmed'
      },
      async (payload) => {
        // ส่ง LINE notification เมื่อมีการยืนยันนัดหมาย
        await sendLineNotification(payload.new)
      }
    )
    .subscribe()

  return new Response('Realtime listening...')
})

async function sendLineNotification(appointment: any) {
  // หา patient และ doctor
  const { data: patient } = await supabase
    .from('patients')
    .select('line_user_id, name')
    .eq('patient_id', appointment.patient_id)
    .single()

  const { data: doctor } = await supabase
    .from('doctors')
    .select('name')
    .eq('doctor_id', appointment.doctor_id)
    .single()

  // ส่ง Flex Message
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('LINE_ACCESS_TOKEN')}`
    },
    body: JSON.stringify({
      to: patient.line_user_id,
      messages: [{
        type: 'flex',
        altText: 'ยืนยันนัดหมายสำเร็จ',
        contents: {
          type: 'bubble',
          styles: { hero: { backgroundColor: '#00C300' } },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              { type: 'text', text: '✅ ยืนยันนัดหมาย', weight: 'bold', size: 'xl' },
              { type: 'text', text: `แพทย์: ${doctor.name}` },
              { type: 'text', text: `วันที่: ${appointment.appointment_date}` },
              { type: 'text', text: `เวลา: ${appointment.appointment_time}` },
              { type: 'text', text: `คิว: ${appointment.queue_number}`, weight: 'bold' }
            ]
          },
          action: {
            type: 'uri',
            uri: `line://app/${Deno.env.get('LIFF_ID')}?appointment=${appointment.appointment_id}`
          }
        }
      }]
    })
  })
}
```

---

### 4. GitHub Actions CI/CD for LINE Edge Functions

```yaml
# .github/workflows/deploy-line.yml
name: Deploy LINE Edge Functions

on:
  push:
    branches: [main]
    paths:
      - 'supabase/functions/line-**'
      - 'supabase/migrations/**'

env:
  SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
  PROJECT_ID: ${{ secrets.SUPABASE_PROJECT_ID }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Deploy LINE Webhook
        run: |
          supabase functions deploy line-webhook
          supabase functions deploy notify-line
          supabase functions deploy line-callback

      - name: Update LINE webhook URL
        env:
          LINE_CHANNEL_ACCESS_TOKEN: ${{ secrets.LINE_CHANNEL_ACCESS_TOKEN }}
        run: |
          curl -X PUT https://api.line.me/v2/bot/channel/webhook/endpoint \
            -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
              "endpoint": "https://your-project.supabase.co/functions/v1/line-webhook"
            }'

      - name: Verify deployment
        run: |
          curl -f https://your-project.supabase.co/functions/v1/line-webhook || exit 1
```

---

### 5. LINE Login + Supabase Auth Integration

```typescript
// supabase/functions/line-callback/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  // Exchange code for tokens
  const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/line-callback`,
      client_id: Deno.env.get('LINE_LOGIN_CHANNEL_ID')!,
      client_secret: Deno.env.get('LINE_LOGIN_CHANNEL_SECRET')!
    })
  })

  const { access_token, id_token } = await tokenResponse.json()

  // Get LINE profile
  const profileResponse = await fetch('https://api.line.me/v2/profile', {
    headers: { 'Authorization': `Bearer ${access_token}` }
  })
  const profile = await profileResponse.json()

  // Create/update user in Supabase
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: user } = await supabase
    .from('users')
    .upsert({
      line_user_id: profile.userId,
      display_name: profile.displayName,
      picture_url: profile.pictureUrl,
      updated_at: new Date().toISOString()
    })
    .select()
    .single()

  // Redirect back to LIFF with token
  return Response.redirect(
    `line://app/${Deno.env.get('LIFF_ID')}?token=${access_token}`,
    302
  )
})
```

---

### 6. Environment Variables Setup

**GitHub Secrets:**
```bash
# ใน GitHub repo Settings > Secrets and variables > Actions
LINE_CHANNEL_ACCESS_TOKEN=xxx
LINE_CHANNEL_SECRET=xxx
LINE_LOGIN_CHANNEL_ID=xxx
LINE_LOGIN_CHANNEL_SECRET=xxx
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ACCESS_TOKEN=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
SUPABASE_PROJECT_ID=xxx
LIFF_ID=xxx-xxx-xxx
```

**Supabase Edge Functions Secrets:**
```bash
# ใน Supabase Dashboard > Edge Functions > Manage secrets
supabase secrets set LINE_CHANNEL_SECRET=your_secret
supabase secrets set LINE_CHANNEL_ACCESS_TOKEN=your_token
supabase secrets set LINE_LOGIN_CHANNEL_ID=your_id
supabase secrets set LINE_LOGIN_CHANNEL_SECRET=your_login_secret
```

---

### 7. Quick Start Checklist

```bash
# 1. Clone repo
git clone your-repo
cd your-repo

# 2. Create edge function directory
mkdir -p supabase/functions/line-webhook

# 3. Copy webhook code above to index.ts

# 4. Set environment variables in Supabase Dashboard
# Settings > Edge Functions > Add secrets

# 5. Deploy function
supabase functions deploy line-webhook

# 6. Update LINE webhook URL in LINE Developers Console
# https://developers.line.biz/console/
# URL: https://your-project.supabase.co/functions/v1/line-webhook

# 7. Test webhook
curl -X POST https://your-project.supabase.co/functions/v1/line-webhook \
  -H "Content-Type: application/json" \
  -H "x-line-signature: test" \
  -d '{"events": []}'
```

---

### 8. Additional Edge Functions for LINE SaaS

| Function | Purpose | Trigger |
|:---------|:--------|:--------|
| `line-webhook` | Handle all LINE events | Webhook from LINE |
| `notify-line` | Realtime notifications | Database change |
| `line-callback` | LINE Login OAuth | LINE redirect |
| `appointment-reminder` | Cron job reminders | Scheduled (pg_cron) |
| `queue-update` | Broadcast queue changes | Database trigger |
| `payment-callback` | LINE Pay webhook | LINE Pay webhook |

---

### 9. Database Triggers for Auto Notifications

```sql
-- Auto-send LINE message when appointment is confirmed
CREATE OR REPLACE FUNCTION notify_appointment_confirmed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
    -- Call edge function to send LINE message
    PERFORM net.http_post(
      format('%s/functions/v1/notify-line', current_setting('app.supabase_url')),
      jsonb_build_object(
        'appointment_id', NEW.appointment_id,
        'type', 'appointment_confirmed'
      ),
      jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key'),
        'Content-Type', 'application/json'
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER appointment_confirmed_trigger
  AFTER UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION notify_appointment_confirmed();
```

---

---

*Generated from "itons5 Course เสียเงินเรียนเอง Line API Expert" PDF (ALL PAGES)*
*Version: Full Feature - All 20+ Screens + LINE API Expert + GitHub/Supabase Integration*
*Date: 2025-02-01*
*Updated: Added GitHub + Supabase + LINE Architecture section*
