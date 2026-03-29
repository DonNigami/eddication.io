# Quick Start Guide

## วิธีการเริ่มต้นใช้งานด่วน

### Option 1: Docker (แนะนำที่สุด)

```bash
# 1. Clone หรือดาวน์โหลดโฟลเดอร์
cd MLSTMS/self-host

# 2. สร้าง .env
cp .env.example .env

# 3. แก้ไข username/password
nano .env
# เปลี่ยน PTG_USERNAME และ PTG_PASSWORD

# 4. เริ่มใช้งาน
docker-compose --profile python up -d

# 5. ดู logs
docker-compose logs -f

# 6. หยุด
docker-compose down
```

### Option 2: Python

```bash
# 1. ติดตั้ง dependencies
pip install -r requirements.txt

# 2. ตั้งค่า environment
cp .env.example .env
nano .env  # แก้ไข username/password

# 3. ทดสอบรันครั้งเดียว
python ptg_ezview_client.py --once

# 4. รันแบบ daemon (scheduled)
python ptg_ezview_client.py --daemon
```

### Option 3: Node.js

```bash
# 1. ติดตั้ง dependencies
npm install

# 2. ตั้งค่า environment
cp .env.example .env
nano .env  # แก้ไข username/password

# 3. ทดสอบรันครั้งเดียว
npm run once

# 4. รันแบบ daemon (scheduled)
npm start
```

## ตั้งค่าหลักๆ ใน .env

```bash
# API Credentials (จำเป็นต้องตั้งค่า)
PTG_USERNAME=LPG_Bulk
PTG_PASSWORD=your_password

# Schedule (รันทุกๆ กี่นาที)
PTG_SCHEDULE_MINUTES=60

# Storage
PTG_STORAGE_TYPE=sqlite    # หรือ csv, json
PTG_SQLITE_PATH=ptg_data.db

# Logging
PTG_LOG_LEVEL=INFO        # DEBUG, INFO, WARN, ERROR
```

## การดูข้อมูล

### SQLite
```bash
sqlite3 ptg_data.db

# ดู trips
SELECT * FROM trips LIMIT 10;

# ดู trip details
SELECT * FROM trip_details LIMIT 10;

# ออกจาก sqlite
.quit
```

### CSV/JSON
- ข้อมูลจะถูกเก็บในโฟลเดอร์ `csv_output/` หรือ `json_output/`

## การติดตั้งเป็น System Service (Linux)

```bash
# 1. คัดลอก service file
sudo cp ptg-ezview.service /etc/systemd/system/

# 2. สร้าง user
sudo useradd -r -s /bin/false ptguser

# 3. คัดลอกไฟล์ไปยัง /opt
sudo mkdir -p /opt/ptg-ezview
sudo cp -r * /opt/ptg-ezview/
sudo chown -R ptguser:ptguser /opt/ptg-ezview

# 4. Enable และ start
sudo systemctl daemon-reload
sudo systemctl enable ptg-ezview
sudo systemctl start ptg-ezview

# 5. ดู status
sudo systemctl status ptg-ezview

# ดู logs
sudo journalctl -u ptg-ezview -f
```

## ปัญหาที่พบบ่อย

### 1. Login failed
- ตรวจสอบ username/password ใน .env
- ตรวจสอบว่า API URL ถูกต้อง

### 2. Rate limiting issues
- เพิ่ม `PTG_RATE_LIMIT_MS` ใน .env
- หรือเปิด `PTG_FAST_MODE=true`

### 3. Memory issues
- ลด `PTG_LIMIT` ใน .env
- เปลี่ยน storage เป็น sqlite

### 4. Connection timeout
- ตรวจสอบ firewall
- ตรวจสอบว่า server สามารถเข้าถึง PTG API ได้

## การอัปเกรด

```bash
# ดึงโค้ดใหม่
git pull

# Docker
docker-compose down
docker-compose pull
docker-compose up -d

# Python
pip install -r requirements.txt --upgrade

# Node.js
npm update
```

## การ uninstall

```bash
# Docker
docker-compose down -v

# Python/Node.js
# ลบไฟล์และ dependencies
rm -rf node_modules/
pip uninstall -r requirements.txt -y

# System service
sudo systemctl stop ptg-ezview
sudo systemctl disable ptg-ezview
sudo rm /etc/systemd/system/ptg-ezview.service
```
