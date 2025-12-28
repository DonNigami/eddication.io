# Railway Deployment Setup Guide

## Required Environment Variables

ไปที่ Railway Dashboard → เลือก Project → Variables tab แล้วตั้งค่าดังนี้:

### 1. GOOGLE_SHEETS_ID
```
1234567890abcdefghijklmnopqrstuvwxyz
```
(ดึงจาก URL ของ Google Sheets: `https://docs.google.com/spreadsheets/d/[GOOGLE_SHEETS_ID]/edit`)

### 2. GOOGLE_SHEETS_CREDENTIALS_JSON
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "your-service-account@project.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```
**สำคัญ:** วาง JSON ทั้งหมดในบรรทัดเดียว (ไม่ต้องมี line breaks)

### 3. CORS_ORIGIN
```
https://donnigami.github.io
```

### 4. NODE_ENV
```
production
```

### 5. PORT (Optional - Railway จะตั้งค่าให้อัตโนมัติ)
```
3000
```

---

## วิธีสร้าง Service Account สำหรับ Google Sheets

1. ไปที่ [Google Cloud Console](https://console.cloud.google.com/)
2. สร้าง Project ใหม่ หรือเลือก Project ที่มีอยู่
3. เปิดใช้งาน Google Sheets API:
   - ไปที่ "APIs & Services" → "Library"
   - ค้นหา "Google Sheets API"
   - คลิก "Enable"
4. สร้าง Service Account:
   - ไปที่ "APIs & Services" → "Credentials"
   - คลิก "Create Credentials" → "Service Account"
   - ตั้งชื่อและคลิก "Create"
   - คลิก "Done" (ไม่ต้องกำหนด roles)
5. สร้าง Key:
   - คลิกที่ Service Account ที่สร้าง
   - ไปที่ "Keys" tab
   - คลิก "Add Key" → "Create new key"
   - เลือก "JSON" → คลิก "Create"
   - ไฟล์ JSON จะถูกดาวน์โหลด
6. Share Google Sheet:
   - เปิด Google Sheet ที่ต้องการใช้
   - คลิก "Share" ที่มุมขวาบน
   - วาง `client_email` จากไฟล์ JSON (เช่น `xxx@xxx.iam.gserviceaccount.com`)
   - ให้สิทธิ์ "Editor"
   - คลิก "Share"

---

## การ Deploy

### อัตโนมัติ (แนะนำ)
Railway จะ deploy อัตโนมัติทุกครั้งที่มีการ push ไปที่ GitHub

### Manual Deploy
```bash
railway up
```

---

## Troubleshooting

### ❌ Cannot read properties of undefined (reading 'startsWith')
- **สาเหตุ:** ไม่ได้ตั้งค่า `GOOGLE_SHEETS_CREDENTIALS_JSON`
- **วิธีแก้:** ตั้งค่า environment variable ใน Railway

### ❌ The caller does not have permission
- **สาเหตุ:** ยังไม่ได้ Share Google Sheet กับ Service Account
- **วิธีแก้:** Share Sheet โดยใช้ `client_email` จาก credentials

### ❌ CORS Error
- **สาเหตุ:** `CORS_ORIGIN` ไม่ตรงกับ frontend URL
- **วิธีแก้:** ตั้งค่า `CORS_ORIGIN=https://donnigami.github.io`

### ❌ 404 Not Found
- **สาเหตุ:** Backend ยังไม่ได้ deploy สำเร็จ
- **วิธีแก้:** ดู Deployment Logs ใน Railway Dashboard

---

## Health Check

ทดสอบว่า backend ทำงานหรือไม่:
```bash
curl https://your-app.railway.app/health
```

ควรได้ response:
```json
{
  "status": "OK",
  "timestamp": "2025-12-28T...",
  "service": "driverconnect-backend",
  "version": "1.0.0"
}
```
