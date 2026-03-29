# วิธีการ Deploy ไปยัง Render.com

## 📋 สิ่งที่ต้องเตรียม

- Render.com account (สมัครฟรีที่ https://render.com)
- GitHub repository (ที่เก็บโค้ด)
- PTG Username และ Password

---

## 🚀 วิธีการ Deploy (แบบง่ายที่สุด)

### วิธีที่ 1: ใช้ Blueprint (render.yaml) - แนะนำ ⭐

Blueprint เป็นวิธีที่ง่ายที่สุด เพราะ Render จะสร้าง services ให้โดยอัตโนมัติ

#### ขั้นตอน:

1. **Push โค้ดไปยัง GitHub**

```bash
git init
git add .
git commit -m "Add PTG eZView integration"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

> ⚠️ **สำคัญ:** อย่าลืมเพิ่มไฟล์ `.env` หรือ secrets ลงใน `.gitignore` ก่อน commit!

2. **ไปที่ Render Dashboard**

- เข้าไปที่ https://dashboard.render.com
- คลิกปุ่ม **"New +"** → **"Blueprint"**

3. **เชื่อมต่อ GitHub Repository**

- เลือก repository ของคุณ
- Render จะอ่านไฟล์ `render.yaml` อัตโนมัติ

4. **ตั้งค่า Environment Variables**

คลิก **"Advanced"** → **"Add Environment Variable"**:

| Key | Value | Required |
|-----|-------|----------|
| `PTG_USERNAME` | `LPG_Bulk` | ✅ Yes |
| `PTG_PASSWORD` | `your_password` | ✅ Yes |
| `PTG_BASE_URL` | `http://203.151.215.230:9000/eZViewIntegrationService/web-service/api` | - |

5. **Deploy**

คลิก **"Apply"** และรอสักครู่ Render จะสร้าง services ให้:

- ✅ Worker (Python หรือ Node.js)
- ✅ Disk Storage (1 GB)
- ✅ PostgreSQL Database (ถ้าระบุใน render.yaml)

---

### วิธีที่ 2: สร้าง Worker เอง (Manual)

ถ้าไม่ต้องการใช้ Blueprint สามารถสร้าง Worker เองได้:

#### 1. สร้าง Background Worker

1. ไปที่ Render Dashboard
2. คลิก **"New +"** → **"Worker"**
3. เชื่อมต่อ GitHub repository
4. ตั้งค่าดังนี้:

| Setting | Value |
|---------|-------|
| **Name** | `ptg-ezview-python` |
| **Environment** | `Docker` |
| **Region** | `Singapore` (ใกล้ที่สุด) |
| **Plan** | `Free` หรือ `Starter ($7/เดือน)` |
| **Dockerfile Path** | `./Dockerfile.render` |

#### 2. เพิ่ม Environment Variables

คลิก **"Advanced"** → **"Add Environment Variable"**:

```
PTG_USERNAME=LPG_Bulk
PTG_PASSWORD=your_password
PTG_SCHEDULE_MINUTES=60
PTG_LOG_LEVEL=INFO
PTG_STORAGE_TYPE=sqlite
PTG_SQLITE_PATH=/opt/render/project/data/ptg_data.db
```

#### 3. เพิ่ม Disk Storage (เก็บข้อมูล)

คลิก **"Advanced"** → **"Add Disk"**:

| Setting | Value |
|---------|-------|
| **Name** | `ptg-data` |
| **Mount Path** | `/opt/render/project/data` |
| **Size** | `1 GB` |

#### 4. Deploy

คลิก **"Create Worker"** และรอ deployment เสร็จ

---

## 💾 ดาวน์โหลดข้อมูลจาก Render

### วิธีที่ 1: Render Dashboard

1. ไปที่ Worker → **"Metrics"** → **"Shell"**
2. รันคำสั่ง:

```bash
# เข้าไปใน container
cd /opt/render/project/data

# List files
ls -la

# Download SQLite database
# ใช้ Render CLI หรือ scp ดาวน์โหลด
```

### วิธีที่ 2: Render CLI

```bash
# ติดตั้ง Render CLI
npm install -g render-cli

# Login
render login

# Download file
render scp ptg-ezview-python:/opt/render/project/data/ptg_data.db ./ptg_data.db
```

### วิธีที่ 3: Auto-upload to Cloud Storage

แก้ไขโค้ดให้ upload ไฟล์ไปยัง S3, Google Cloud Storage หรือ Dropbox อัตโนมัติ

---

## 📊 Monitoring

### ดู Logs

1. ไปที่ Worker → **"Logs"**
2. ดู logs แบบ real-time:

```
2024-03-22 10:00:00 - ℹ️  🔄 Fetching all trips (paginated)...
2024-03-22 10:00:05 - ℹ️  📦 Page 1: 50 trips (total: 50)
2024-03-22 10:00:10 - ℹ️  ✅ Saved 50 trips to SQLite
```

### ดู Metrics

- **CPU Usage**
- **Memory Usage**
- **Disk Usage**
- **Network Usage**

---

## ⚠️ ข้อจำกัดของ Free Plan

| Feature | Free Plan | Paid Plan |
|---------|-----------|-----------|
| **RAM** | 512 MB | หลาย GB |
| **CPU** | 0.1 CPU | หลาย core |
| **Disk** | ไม่มี | มี |
| **Timeout** | 15 นาที | ไม่มีขีดจำกัด |
| **Sleep after** | 15 นาที idle | ไม่มี |

> 💡 **แนะนำ:** ถ้าใช้งานจริง ให้ใช้ Starter Plan ($7/เดือน) เพื่อไม่ให้ service sleep

---

## 🔄 Auto-Deploy

เมื่อ push โค้ดใหม่ไปที่ GitHub:

1. Render จะ detect changes อัตโนมัติ
2. Build & deploy ใหม่
3. Restart service

---

## 🛠️ Troubleshooting

### 1. Worker ไม่ทำงาน

ตรวจสอบ logs:

```bash
# ดู error logs
2024-03-22 10:00:00 - ❌ Login failed: Invalid credentials
```

**วิธีแก้:**
- ตรวจสอบ PTG_USERNAME และ PTG_PASSWORD
- ตรวจสอบ PTG_BASE_URL

### 2. Disk ไม่มีข้อมูล

**วิธีแก้:**
- ตรวจสอบ Disk Mount Path: `/opt/render/project/data`
- ตรวจสอบ environment variable: `PTG_SQLITE_PATH`

### 3. Worker sleep บน Free Plan

**วิธีแก้:**
- อัปเกรดเป็น Starter Plan ($7/เดือน)
- หรือใช้ External Cron (เช่น cron-job.org) เพื่อ ping worker

### 4. Memory limit exceeded

**วิธีแก้:**
- ลด `PTG_LIMIT` ใน environment variables
- อัปเกรดเป็น paid plan

---

## 💰 ราคา

| Plan | ราคา/เดือน | เหมาะสำหรับ |
|------|-------------|--------------|
| **Free** | $0 | Testing, Development |
| **Starter** | $7 | Production ขนาดเล็ก |
| **Standard** | $25 | Production ขนาดกลาง |
| **Pro** | $85 | Production ขนาดใหญ่ |

---

## 🎯 เปรียบเทียบ Render กับอย่างอื่น

| Feature | Render | Railway | Fly.io |
|---------|--------|---------|-------|
| **Free Tier** | ✅ มี | ✅ มี | ✅ มี |
| **Disk Storage** | ✅ | ✅ | ❌ |
| **Easy Setup** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Region** | Singapore | US/EU | Global |
| **Price** | $7+ | $5+ | Free tier |

---

## 📝 สรุป

### ✅ ข้อดีของ Render

- ง่ายที่สุดในการ deploy (Blueprint)
- มี Free tier
- มี Disk storage
- Auto-deploy จาก GitHub
- Logs ดีมาก

### ❌ ข้อเสีย

- Free plan มี timeout
- ราคาแพงกว่าบางที่
- Region ไม่เยอะ (มี Singapore)

### 🎯 เหมาะสำหรับ

- งานเล็กๆ ถึงกลาง
- คนที่ต้องการความง่าย
- ไม่ต้องการดูแล infrastructure

---

## 🚀 Next Steps

1. ✅ Deploy ไปยัง Render (Blueprint)
2. ✅ ตั้งค่า Environment Variables
3. ✅ ตรวจสอบ Logs ว่าทำงานได้
4. ✅ ตั้งค่า cron schedule (ถ้าต้องการ)
5. ✅ เพิ่ม Disk storage (ถ้าต้องการ)

---

## 📞 ติดต่อ/ถามเพิ่มเติม

- Render Docs: https://render.com/docs
- Render Community: https://community.render.com
- GitHub Issues: สร้าง issue ใน repository ของคุณ
