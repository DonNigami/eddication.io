# PTG eZView API Integration Client - Self-Hosted Version

ระบบดึงข้อมูล Trips และ Trip Details จาก PTG eZView API ที่รันบน self-hosted server

## 📋 เลือก Version

| Version | เหมาะสำหรับ | ข้อดี | ข้อเสีย |
|---------|--------------|--------|---------|
| **Python** | งานที่ต้องการ data processing, ML | - แพ็กเกจมากมาย<br>- pandas, numpy integration<br>- เหมาะกับ data science | - ใช้ memory เยอะหน่อย<br>- startup ช้ากว่า |
| **Node.js** | Microservices, Real-time | - ตัวเล็ก<br>- เร็ว<br>- async/await ดีมาก | - ecosystem น้อยกว่า python |

## 🚀 วิธีการติดตั้ง

### 1. Python Version

```bash
# ติดตั้ง dependencies
pip install -r requirements.txt

# ตั้งค่า environment
cp .env.example .env
nano .env  # แก้ไข PTG_USERNAME และ PTG_PASSWORD

# รันครั้งเดียว
python ptg_ezview_client.py --once

# รันแบบ daemon (scheduled)
python ptg_ezview_client.py --daemon
```

### 2. Node.js Version

```bash
# ติดตั้ง dependencies
npm install

# ตั้งค่า environment
cp .env.example .env
nano .env  # แก้ไข PTG_USERNAME และ PTG_PASSWORD

# รันครั้งเดียว
npm run once

# รันแบบ daemon (scheduled)
npm start
```

### 3. Docker (แนะนำ)

```bash
# เลือก version (python หรือ nodejs)
docker-compose --profile python up -d
# หรือ
docker-compose --profile nodejs up -d

# ดู logs
docker-compose logs -f

# หยุด
docker-compose down
```

### 4. Render.com (PaaS - ง่ายที่สุด) ⭐

[ดูคู่มือการ deploy ไปยัง Render.com →](DEPLOY_RENDER.md)

**ข้อดี:**
- Deploy ง่ายด้วย Blueprint (เพียง 1 คลิก)
- Auto-deploy จาก GitHub
- มี Free tier
- มี Disk storage

```bash
# 1. Push โค้ดไป GitHub
git init
git add .
git commit -m "Add PTG eZView integration"
git push origin main

# 2. ไปที่ Render.com → New → Blueprint
# 3. เลือก GitHub repo
# 4. ตั้งค่า Environment Variables (PTG_USERNAME, PTG_PASSWORD)
# 5. Deploy!
```

ดูรายละเอียดเพิ่มเติมที่ [DEPLOY_RENDER.md](DEPLOY_RENDER.md)

## 🔧 Environment Variables

```bash
# API Credentials
PTG_BASE_URL=http://203.151.215.230:9000/eZViewIntegrationService/web-service/api
PTG_USERNAME=LPG_Bulk
PTG_PASSWORD=your_password_here

# Query Parameters (optional)
PTG_STATUS_ID=              # ว่างเปล่า = ดึงทั้งหมด
PTG_START_DATE=2024-01-01   # YYYY-MM-DD
PTG_END_DATE=2024-12-31     # YYYY-MM-DD
PTG_LIMIT=50

# Rate Limiting
PTG_RATE_LIMIT_MS=1000      # Delay ระหว่าง request (ms)
PTG_FAST_MODE=false         # true = ปิด rate limiting

# Performance
PTG_ADAPTIVE_RATE_LIMIT=true    # Auto-adjust delay
PTG_MIN_RATE_LIMIT_MS=100       # Minimum delay
PTG_MAX_RATE_LIMIT_MS=1000      # Maximum delay

# Storage
PTG_STORAGE_TYPE=sqlite     # sqlite, csv, json
PTG_SQLITE_PATH=ptg_data.db

# Schedule
PTG_SCHEDULE_MINUTES=60     # รันทุกๆ กี่นาที

# Logging
PTG_LOG_LEVEL=INFO          # DEBUG, INFO, WARN, ERROR
```

## 📊 Storage Options

### SQLite (Python)
```bash
PTG_STORAGE_TYPE=sqlite
PTG_SQLITE_PATH=ptg_data.db
```

### CSV (Python)
```bash
PTG_STORAGE_TYPE=csv
PTG_CSV_PATH=csv_output
```

### JSON (Node.js)
```bash
PTG_STORAGE_TYPE=json
PTG_JSON_PATH=json_output
```

## 🖥️ Hosting Recommendations

### 1. **VPS ราคาประหยัด** (แนะนำสำหรับเริ่มต้น)

| Provider | Plan | ราคา/เดือน | เหมาะสำหรับ |
|----------|------|-------------|--------------|
| **DigitalOcean** | Basic Droplet | $4-6/เดือน | เริ่มต้น, ง่าย |
| **Linode** | Nanode | $5/เดือน | เสถียร, ประสิทธิภาพดี |
| **Vultr** | Regular Cloud | $5/เดือน | ราคาดี, global |
| **AWS Lightsail** | Minimum | $3.5/เดือน | AWS ecosystem |
| **Google Cloud** | e2-micro | $6-8/เดือน | GCP ecosystem |

**ข้อดี:**
- ราคาถูก
- ง่ายต่อการติดตั้ง
- เหมาะกับงานเล็กๆ ถึงกลาง

**ข้อเสีย:**
- Single point of failure
- ต้อง backup เอง

### 2. **Cloud Functions** (แนะนำสำหรับ production)

| Provider | Service | ราคา | เหมาะสำหรับ |
|----------|---------|------|--------------|
| **AWS** | Lambda + EventBridge | Pay per use | Enterprise |
| **Google Cloud** | Cloud Functions + Cloud Scheduler | Pay per use | Serverless |
| **Azure** | Functions + Timer Trigger | Pay per use | Enterprise |
| **Cloudflare** | Workers + Cron Triggers | Pay per use | Edge computing |

**ข้อดี:**
- ไม่ต้องดูแล server
- Auto-scale
- Pay per use (จ่ายตามการใช้งานจริง)

**ข้อเสีย:**
- ตั้งค่ายุ่งยากกว่า
- มี timeout limit

### 3. **Kubernetes** (แนะนำสำหรับ large scale)

| Provider | Managed K8s | ราคา | เหมาะสำหรับ |
|----------|-------------|------|--------------|
| **Google Cloud** | GKE | Free control plane | Large scale |
| **AWS** | EKS | $72/เดือน | Enterprise |
| **Azure** | AKS | Free control plane | Enterprise |
| **DigitalOcean** | DOKS | $10/เดือน | Medium scale |

**ข้อดี:**
- High availability
- Auto-scaling
- Easy deployment

**ข้อเสีย:**
- ซับซ้อน
- ราคาสูงกว่า

### 4. **PaaS** (Platform as a Service)

| Provider | Service | ราคา | เหมาะสำหรับ |
|----------|---------|------|--------------|
| **Railway** | App + Cron | $5/เดือน | ง่ายที่สุด |
| **Render** | Cron Job + Background | Free tier | ง่าย, free tier |
| **Fly.io** | Apps | Free tier | Global deployment |
| **Heroku** | Scheduler + Dyno | $5-7/เดือน | ง่ายมาก |

**ข้อดี:**
- Deploy ง่าย (git push)
- Auto deploy
- Add-ons มากมาย

**ข้อเสีย:**
- ราคาสูงกว่า VPS
- มีข้อจำกัดบางอย่าง

## 💡 คำแนะนำการเลือก Host

### เริ่มต้น / Dev / Test
```
VPS ราคาประหยัด (DigitalOcean Basic @ $4/เดือน)
หรือ
Railway.app (มี free tier)
```

### Production (ขนาดเล็ก - กลาง)
```
DigitalOcean/Linode (VPS @ $5-10/เดือน)
หรือ
AWS Lambda + EventBridge (ประหยัดถ้ารันน้อย)
```

### Production (ขนาดใหญ่)
```
Google Cloud Functions + Cloud Scheduler
หรือ
AWS Lambda + EventBridge
หรือ
Kubernetes (GKE/EKS)
```

### High Availability
```
Kubernetes (GKE - free control plane)
หรือ
Google Cloud Run (regional)
```

## 📦 ไฟล์ที่สร้าง

```
MLSTMS/self-host/
├── ptg_ezview_client.py      # Python version
├── ptg-ezview-client.js       # Node.js version
├── requirements.txt           # Python dependencies
├── package.json               # Node.js dependencies
├── Dockerfile                 # Docker image (Python)
├── Dockerfile.nodejs          # Docker image (Node.js)
├── docker-compose.yml         # Docker Compose setup
├── .env.example               # Environment variables template
└── README.md                  # This file
```

## 🔍 Monitoring

### เพิ่ม Grafana + Prometheus (เฉพาะ Docker)

```bash
docker-compose --profile python --profile monitoring up -d
```

เข้า http://localhost:3000 (admin/admin)

## 🛠️ Troubleshooting

### Token หมดอายุ
- ระบบจะ auto-refresh token เอง
- ถ้ายัง error ให้ลอง restart service

### Rate Limiting
- ปรับ `PTG_RATE_LIMIT_MS` ใน .env
- เปิด `PTG_FAST_MODE=true` เพื่อปิด rate limiting

### Memory issues
- ลด `PTG_LIMIT` ใน .env
- ใช้ `PTG_STORAGE_TYPE=sqlite` แทน csv/json

## 📞 Support

- ตรวจสอบ API status: http://203.151.215.230:9000
- ดู logs: `docker-compose logs -f`
- เช็ค health: `docker-compose ps`
