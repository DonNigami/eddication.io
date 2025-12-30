# Broadcast Scheduler Setup Guide

ระบบจะส่งข้อความแบบกำหนดเวลา (Scheduled Broadcast) โดยอัตโนมัติ

## ✅ ขั้นตอนการตั้งค่า

### 1. **Supabase Configuration**

ต้องตั้งค่า Environment Variables ใน backend/.env หรือ Railway:

```bash
SUPABASE_URL=https://rwqgxdjcwrglbwlruyty.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
```

**ที่มา:**
- `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`: ได้จาก Supabase Dashboard → Settings → API
  - ต้องใช้ **Service Key** (ไม่ใช่ Anon Key) เพื่อให้เข้าถึงข้อมูลได้เต็มที่
- `LINE_CHANNEL_ACCESS_TOKEN`: ได้จาก LINE Official Account Manager

### 2. **สร้าง Supabase Tables**

รัน migration SQL ใน Supabase Dashboard:
```
supabase/migrations/20251230_create_missing_tables.sql
```

ตารางที่จะถูกสร้าง:
- `broadcast_queue` - เก็บข้อความที่รออยู่
- `news_metrics` - บันทึกการดู/คลิกข่าว
- `audit_logs` - บันทึกการเปลี่ยนแปลง
- `points_history` - ประวัติการเปลี่ยนแต้ม

### 3. **Deploy Backend**

ต้อง deploy backend ให้รัน BroadcastScheduler 24/7 มีหลายวิธี:

#### 🚀 Cloud Platforms (แนะนำ)

**Railway** (ง่ายที่สุด)
```bash
- Connect GitHub repo
- Set environment variables
- Auto-deploy on push
- 24/7 uptime
```

**Render** (Free tier มี uptime 15 นาที)
```bash
- Connect GitHub
- Set env vars
- Deploy
- Free: ngrok timeout หรือต้องจ่ายใช้ paid plan
```

**Heroku** (เสียค่าใช้แล้ว)
```bash
- git push heroku main
- heroku config:set SUPABASE_URL=...
- Uptime 99.99%
```

**Google Cloud Run**
```bash
gcloud run deploy crm-backend \
  --source . \
  --set-env-vars SUPABASE_URL=... \
  --memory 512Mi \
  --timeout 3600
```

**AWS Lambda + API Gateway** (ต้องแก้ code สำหรับ serverless)

#### 🐳 Docker (Local / VPS)

```bash
# Build image
docker build -t crm-backend .

# Run container
docker run -d \
  -p 3000:3000 \
  -e SUPABASE_URL=https://... \
  -e SUPABASE_SERVICE_KEY=... \
  -e LINE_CHANNEL_ACCESS_TOKEN=... \
  crm-backend
```

#### 💻 Local Development

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with actual values

# Start server
npm start
# Or with auto-reload
npm install -g nodemon
nodemon server.js
```

#### 🖥️ Self-hosted VPS (DigitalOcean, Vultr, Linode, AWS EC2)

**ตั้ง PM2 Process Manager:**
```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start server.js --name "crm-backend"

# Auto-restart on reboot
pm2 startup
pm2 save

# Monitor logs
pm2 logs crm-backend
```

**Nginx Reverse Proxy:**
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### ☁️ Systemd Service (Ubuntu/Debian VPS)

**สร้าง `/etc/systemd/system/crm-backend.service`:**
```ini
[Unit]
Description=CRM Backend Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/home/app/crm-backend
ExecStart=/usr/bin/node /home/app/crm-backend/server.js
Restart=always
RestartSec=10
Environment="NODE_ENV=production"
Environment="PORT=3000"
Environment="SUPABASE_URL=https://..."
Environment="SUPABASE_SERVICE_KEY=..."

[Install]
WantedBy=multi-user.target
```

**เปิดใช้งาน:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable crm-backend
sudo systemctl start crm-backend
sudo systemctl status crm-backend
```

#### Docker Compose (Local + Production)

**สร้าง `docker-compose.yml`:**
```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      SUPABASE_URL: ${SUPABASE_URL}
      SUPABASE_SERVICE_KEY: ${SUPABASE_SERVICE_KEY}
      LINE_CHANNEL_ACCESS_TOKEN: ${LINE_CHANNEL_ACCESS_TOKEN}
    restart: always
    volumes:
      - ./backend/data:/app/data
```

**รัน:**
```bash
docker-compose up -d
```

#### Kubernetes (Enterprise)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: crm-backend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: crm-backend
  template:
    metadata:
      labels:
        app: crm-backend
    spec:
      containers:
      - name: backend
        image: your-registry/crm-backend:latest
        ports:
        - containerPort: 3000
        env:
        - name: SUPABASE_URL
          valueFrom:
            secretKeyRef:
              name: crm-secrets
              key: supabase-url
```

### 4. **ทดสอบการส่ง**

#### วิธีที่ 1: ใน Frontend (project/crm/test.html)
1. Admin panel → "ส่งข้อความ (Broadcast)"
2. เลือกกลุ่มเป้าหมาย (all, segment, tag)
3. เขียนข้อความ
4. **เลือกวันเวลา** ใน "ตั้งเวลาส่ง"
5. คลิก "ยืนยันการส่ง"

#### วิธีที่ 2: ส่งข้อความทันที
- ไม่เลือกเวลา → จะส่งโดยอัตโนมัติทันที

#### วิธีที่ 3: ตรวจสอบ Queue ใน Supabase
```sql
SELECT * FROM broadcast_queue ORDER BY created_at DESC LIMIT 10;
```

## 🔄 มันทำงานอย่างไร?

```
Frontend: User ตั้งเวลาส่ง
    ↓
Supabase: INSERT ลงตาราง broadcast_queue
    ↓
Backend Scheduler: ตรวจสอบทุก 30 วินาที
    ↓
Scheduler: ถ้าเวลา >= scheduled_at → ส่งข้อความ
    ↓
LINE API: ส่งข้อความไปยัง users
    ↓
Supabase: UPDATE status = 'sent'
```

## ⚙️ Scheduler Configuration

ค่าเริ่มต้น:
- **Check Interval**: 30 วินาที
- **Batch Size**: 50 broadcasts ต่อครั้ง
- **Target Audience**:
  - `all` → ลูกค้าทั้งหมด
  - `segment:id` → ลูกค้าตามเงื่อนไข (วันที่เข้า, แต้ม, เคยเข้า)
  - `tag:name` → ลูกค้าตามป้ายกำกับ

## 🎯 Message Types

1. **Text** - ข้อความข้อความธรรมชาติ
2. **Image** - รูปภาพพร้อม URL
3. **Flex Message** - JSON complex message

## 📊 ตัวอย่าง broadcast_queue Record

```json
{
  "id": 1,
  "target": "all",
  "msg_type": "text",
  "message": "ส่วนลด 50% สำหรับวันนี้",
  "scheduled_at": "2025-12-31T15:00:00Z",
  "status": "scheduled",
  "created_at": "2025-12-30T10:00:00Z"
}
```

## ❌ Troubleshooting

| ปัญหา | วิธีแก้ |
|------|-------|
| 404 on broadcast_queue | รัน migration ใน Supabase |
| Scheduler ไม่ทำงาน | ตรวจสอบ logs: `pm2 logs` หรือ `docker logs` |
| ส่ง broadcast ไม่ได้ | ตรวจสอบ `LINE_CHANNEL_ACCESS_TOKEN` ถูกต้อง |
| ไม่เห็น queue ใน DB | ตรวจสอบ `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` |
| Backend ไม่ start | `npm start` แล้วดู error message |
| "Service Key" ไม่มี | ไป Supabase Dashboard → Settings → API → Service Role Key |
| Port 3000 ว่าง? | `lsof -i :3000` (Mac/Linux) หรือ `netstat -ano \| findstr :3000` (Windows) |

## 📊 วิธีตรวจสอบ Scheduler ทำงาน

**ใน Railway/Render/Cloud:**
```
Dashboard → Logs → ค้นหา "[BroadcastScheduler]"
ควรเห็น: "Started - checking every 30 seconds"
```

**ใน Local/VPS:**
```bash
# PM2 logs
pm2 logs crm-backend

# Docker logs
docker logs -f container_id

# Systemd logs
journalctl -u crm-backend -f
```

**Check Supabase:**
```sql
SELECT COUNT(*) FROM broadcast_queue WHERE status = 'sent';
-- ควรเห็นค่า > 0 ถ้าเคยส่ง
```

## 🔐 Security Notes

- ใช้ **Service Key** (ไม่ใช่ Anon Key) ให้เข้าถึงข้อมูลได้
- RLS Policies ต้อง allow authenticated users
- LINE Token ต้องเก็บเป็นความลับ (ไม่ commit ลง Git)

---

✅ **ถ้าทำตามขั้นตอนนี้ สามารถส่ง broadcast ตามเวลาได้**
