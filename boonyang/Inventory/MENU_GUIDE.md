# 📦 Google Sheet Menu - Stock Cache Management

## เกี่ยวกับระบบ

เมนูนี้ถูกสร้างขึ้นสำหรับจัดการ Cache ของข้อมูลสินค้าใน Google Sheet (Sheet ID: `1BGVpH5-VuDh4iQcZN8gD5pW0n3_EvoSjXXbFGEaLMg8`)

ระบบมี 2 ชีตหลัก:
- **BotData**: ข้อมูลสินค้าหลัก (รหัสสินค้า, ชื่อสินค้า, LOT, Stock)
- **InventData**: ข้อมูลสินค้าสำหรับ Fuzzy Search (ชื่อสินค้า, Stock)

## 📋 ฟังก์ชันในเมนู

เมื่อเปิด Google Sheet จะมีเมนู **"📦 Stock Cache Management"** ปรากฏดังนี้:

### 🔄 อัปเดต BotData Cache
- อัปเดต Cache สำหรับ BotData Sheet
- ใช้เวลาประมาณ 5-10 วินาที
- Cache จะหมดอายุใน 5 นาที

### 🔄 อัปเดต InventData Cache
- อัปเดต Cache สำหรับ InventData Sheet
- ใช้เวลาประมาณ 3-5 วินาที
- Cache จะหมดอายุใน 5 นาที

### 🔄 อัปเดตทั้งหมด (BotData + InventData)
- อัปเดต Cache ทั้ง 2 ชีตในครั้งเดียว
- แนะนำให้ใช้ตัวเลือกนี้เมื่ออัปเดตข้อมูลสินค้า

### 📊 ดูสถานะ Cache
- แสดงจำนวนรายการในแต่ละชีต
- แสดงสถานะ Cache (มี/ไม่มี)
- แสดงสถานะ Auto Cache Trigger

### 🧹 ล้าง Cache ทั้งหมด
- ลบ Cache ทั้งหมดออกจากระบบ
- Cache จะถูกสร้างใหม่เมื่อมีการค้นหาหรืออัปเดต

### ⚙️ ตั้งเวลา Auto Cache (ทุก 4 ชม.)
- ตั้งเวลาให้อัปเดต Cache อัตโนมัติทุก 4 ชั่วโมง
- แนะนำให้ตั้งค่านี้เพื่อให้ข้อมูล Cache อัปเดตอยู่เสมอ

### 🚫 ยกเลิก Auto Cache
- ยกเลิกการตั้งเวลา Auto Cache
- Cache จะไม่ถูกอัปเดตอัตโนมัติ

## 🔧 วิธีการติดตั้ง

### 1. เปิด Google Apps Script Editor
1. เปิด Google Sheet: https://docs.google.com/spreadsheets/d/1BGVpH5-VuDh4iQcZN8gD5pW0n3_EvoSjXXbFGEaLMg8
2. ไปที่เมนู **Extensions** → **Apps Script**

### 2. สร้างไฟล์ใหม่
1. คลิกปุ่ม **+**  alongside "Files"
2. เลือก **Script**
3. ตั้งชื่อไฟล์: `menu.js`

### 3. คัดลอกโค้ด
คัดลอกโค้ดจากไฟล์ `menu.js` ในโปรเจกต์นี้ไปวางใน Apps Script Editor

### 4. บันทึกและรีเฟรช
1. กด **Ctrl+S** (หรือ Cmd+S) เพื่อบันทึก
2. กลับไปที่ Google Sheet
3. รีเฟรชหน้าเว็บ (F5)
4. เมนู **"📦 Stock Cache Management"** จะปรากฏขึ้น

## 📝 การใช้งานประจำวัน

### หลังจากอัปเดตข้อมูลสินค้า
1. เปิดเมนู **"📦 Stock Cache Management"**
2. คลิก **"🔄 อัปเดตทั้งหมด (BotData + InventData)"**
3. รอจนกว่าจะแสดงผลลัพธ์

### ตรวจสอบสถานะ Cache
- คลิก **"📊 ดูสถานะ Cache"** เพื่อดูว่า Cache ยังใช้งานได้อยู่หรือไม่

### ตั้งค่า Auto Cache (แนะนำ)
1. คลิก **"⚙️ ตั้งเวลา Auto Cache (ทุก 4 ชม.)"**
2. ระบบจะอัปเดต Cache อัตโนมัติทุก 4 ชั่วโมง
3. ไม่ต้องกังวลว่า Cache จะหมดอายุ

## 🐛 การแก้ปัญหา

### เมนูไม่ปรากฏ
1. ตรวจสอบว่าไฟล์ `menu.js` ถูกบันทึกหรือไม่
2. รีเฟรชหน้าเว็บ (F5)
3. ปิดและเปิด Google Sheet ใหม่

### ข้อผิดพลาด "Function not found"
- ตรวจสอบว่าไฟล์ `checkstock.js` และ `code.js` มีฟังก์ชันที่จำเป็น:
  - `preloadStockCache()` - ใน checkstock.js
  - `preloadInventDataCache()` - ใน checkstock.js
  - `autoPreloadStockCache()` - ใน code.js

### Cache ไม่อัปเดต
- ตรวจสอบ Sheet ID ว่าตรงกับ `1BGVpH5-VuDh4iQcZN8gD5pW0n3_EvoSjXXbFGEaLMg8` หรือไม่
- ตรวจสอบว่าชีต BotData และ InventData มีอยู่จริง

## 📊 โครงสร้างข้อมูล

### BotData Sheet (Columns A-G)
- Column A: รหัสสินค้า
- Column B: -
- Column C: ชื่อสินค้า
- Column D: LOT
- Column E: Stock
- Column F: คีย์เวิร์ด 1
- Column G: คีย์เวิร์ด 2

### InventData Sheet (Columns A-B)
- Column A: ชื่อสินค้า
- Column B: Stock

## 🔗 ไฟล์ที่เกี่ยวข้อง

- `menu.js` - เมนูและฟังก์ชันการจัดการ Cache
- `checkstock.js` - ฟังก์ชัน Cache สำหรับ BotData และ InventData
- `code.js` - ฟังก์ชัน Auto Cache Trigger
- `flex.js` - ฟังก์ชันแสดงผล Carousel

## 📞 ติดต่อ

หากมีปัญหาหรือข้อสงสัย ติดต่อ:
- ดูที่ Logger ใน Apps Script Editor (View → Logs)
- ตรวจสอบ Errors ใน Executions (View → Executions)

---

**หมายเหตุ**: Cache มีอายุ 5 นาที หลังจากนั้นจะหมดอายุและต้องอัปเดตใหม่ หรือใช้ Auto Cache Trigger
