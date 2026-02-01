# Clinic Connect SaaS - Single LIFF Router

ระบบ Routing สำหรับใช้ LIFF ID เดียวและแยกหน้าด้วย Hash Routing

## โครงสร้างไฟล์

```
apps/
├── index.html              # Entry point (LIFF URL ชี้มาที่นี่)
├── shared/
│   ├── styles.css          # Shared styles
│   ├── config.js           # Shared configuration
│   ├── router.js           # Router utility
│   └── role-detection.js   # Role detection utility
├── liff-patient/
│   └── dist/
│       └── index.html      # Patient app
└── liff-doctor/
    └── dist/
        └── index.html      # Doctor app
```

## วิธีใช้งาน

### 1. ตั้งค่า LIFF URL

ใน [LINE Developers Console](https://developers.line.biz):

```
LIFF URL: https://donnigami.github.io/eddication.io/project/line/clinic-connect-saas/apps/
```

### 2. เข้าถึงแต่ละหน้า

| Role | URL Hash | Description |
|------|----------|-------------|
| คนไข้ | `#/patient` | หน้าจองนัดหมาย / ดูคิว |
| แพทย์ | `#/doctor` | หน้าจัดการคิว / บันทึกการรักษา |
| หน้าเลือกบทบาท | `#/` | หน้าเลือกบทบาท (default) |

### 3. การส่งลิงก์

```javascript
// สำหรับคนไข้
const patientUrl = 'https://liff.line.me/YOUR_LIFF_ID/#/patient';

// สำหรับแพทย์
const doctorUrl = 'https://liff.line.me/YOUR_LIFF_ID/#/doctor';

// จาก LIFF SDK
liff.openWindow({ url: patientUrl });
```

### 4. Rich Menu Links

ใน Rich Menu ให้ใส่ URL:

```
https://liff.line.me/YOUR_LIFF_ID/#/patient
https://liff.line.me/YOUR_LIFF_ID/#/doctor
```

## Shared Utilities

### Router (`shared/router.js`)

```javascript
// กำหนด routes
router.on({
  '/': () => showPage('home'),
  '/booking': () => showPage('booking'),
  '/queue': () => showPage('queue')
});

// Navigate ไปหน้าอื่น
router.navigate('booking');
router.navigate('appointment/123');

// ย้อนกลับ
router.back();
```

### Role Detection (`shared/role-detection.js`)

```javascript
// Configure
RoleDetector.configure({
  supabaseUrl: 'https://xxx.supabase.co',
  supabaseKey: 'your-anon-key'
});

// Detect role
const role = await RoleDetector.detect();

// Check role
if (await RoleDetector.isDoctor()) {
  // Show doctor features
}

// Require role (auto-redirect if not)
await RoleDetector.require('doctor', {
  redirect: '#/',
  message: 'กรุณาเข้าสู่ระบบด้วยบัญชีแพทย์'
});

// Redirect based on role
await RoleDetector.redirectToRole();
```

## Configuration

แก้ไข `shared/config.js`:

```javascript
const AppConfig = {
  liff: {
    id: '200xxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' // LIFF ID ของคุณ
  },
  supabase: {
    url: 'https://your-project.supabase.co',
    anonKey: 'your-anon-key'
  }
};
```

## การเพิ่มหน้าใหม่

### วิธีที่ 1: เพิ่มใน index.html (Router)

```javascript
routes: {
  '/patient': { component: 'patient-app' },
  '/doctor': { component: 'doctor-app' },
  '/admin': { component: 'admin-app' }, // เพิ่มหน้าใหม่
}
```

### วิธีที่ 2: เพิ่มในแต่ละ app (Internal Routing)

```javascript
// ใน liff-patient
router.on('/history', () => {
  showPage('history');
});

// เรียกใช้
router.navigate('history');
```

## ข้อดีของ Hash Routing

| ข้อดี | อธิบาย |
|--------|---------|
| Single LIFF ID | ใช้ LIFF ID เดียวจบ |
| No Reload | สลับหน้าไม่ต้องโหลดใหม่ |
| Back Button | รองรับปุ่มย้อนกลับ |
| Deep Linking | ลิงก์ได้โดยตรงหน้านั้นๆ |
| Shared State | LIFF context ไม่หาย |

## Troubleshooting

### หน้าขึ้นแต่ Loading Screen

1. ตรวจสอบว่าไฟล์ `dist/` มีอยู่จริง
2. เปิด Console ดู Error
3. ตรวจสอบ CORS policy

### หน้า Doctor/Patient ไม่โหลด

1. ตรวจสอบ path ใน `router.routes`
2. แน่ใจว่าไฟล์ HTML อยู่ในตำแหน่งที่ถูกต้อง

### LIFF Login Loop

1. ตรวจสอบ LIFF ID
2. ตรวจสอบ LIFF URL ว่าตรงกับที่ตั้งค่า
3. เปิด LIFF SDK debug mode
