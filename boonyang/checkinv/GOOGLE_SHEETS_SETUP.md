# คู่มือการตั้งค่า Google Sheets สำหรับ Boonyang CheckInv

## 📋 ภาพรวม

เอกสารนี้อธิบายวิธีการตั้งค่า Google Sheets สำหรับระบบตรวจสอบยอดคงค้างผ่าน LINE

## 📊 โครงสร้าง Google Sheets

จำเป็นต้องมี 3 Sheets:

1. **AccountReceivables** - ข้อมูลยอดคงค้าง (import จาก Excel)
2. **Customers** - ข้อมูลลูกค้าที่ลงทะเบียน
3. **MessageLog** - บันทึกประวัติการสนทนา

## 🔧 ขั้นตอนการตั้งค่า

### 1. สร้าง Google Sheets ใหม่

1. ไปที่ [Google Sheets](https://sheets.google.com)
2. กด **Blank spreadsheet**
3. ตั้งชื่อ: `Boonyang CheckInv - Account Receivables`
4. คัดลอก **Spreadsheet ID** จาก URL:
   ```
   https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
   ```
   เช่น: `1AbC123DeF456GhI789JkL012MnO345Pq`

### 2. Import ข้อมูลจาก Excel

#### วิธี A: Import ไฟล์ Excel โดยตรง

1. ใน Google Sheets ที่สร้างไว้
2. ไปที่ **File** → **Import** → **Upload**
3. ลากไฟล์ `AccountReceivablesReportByDocument-5.xlsx` มาวาง
4. เลือก:
   - **Replace spreadsheet** (แทนที่ sheet ปัจจุบัน)
   - หรือ **Insert new sheet** (เพิ่มเป็น sheet ใหม่)
5. กด **Import data**

#### วิธี B: Copy-Paste (ถ้า Import ไม่สำเร็จ)

1. เปิดไฟล์ Excel
2. Select และ Copy ข้อมูลทั้งหมด
3. ใน Google Sheets:
   - สร้าง Sheet ใหม่ชื่อ `AccountReceivables`
   - Paste ข้อมูล
4. ปรับ column widths ให้เหมาะสม

### 3. ตรวจสอบโครงสร้างข้อมูล AccountReceivables

ตรวจสอบว่าข้อมูลมีคอลัมน์ตามนี้:

| คอลัมน์ | ชื่อ | คำอธิบาย |
|---------|------|----------|
| A | เลขที่เอกสาร | Document number |
| B | ชื่อลูกค้า/ร้านค้า | **สำคัญ** - ใช้ค้นหา |
| C-F | รายละเอียดอื่นๆ | - |
| G | ยอดรวม | **สำคัญ** - บรรทัดที่เป็นยอดรวมจะมีคำว่า "ยอดรวม" |
| H | ยอดเงิน | **สำคัญ** - จำนวนเงินที่ต้องชำระ |

#### ตัวอย่างโครงสร้างข้อมูล:

```
แถว 1:   เลขที่เอกสาร   ชื่อลูกค้า        ...    ยอดรวม        ยอดเงิน
แถว 10:                  ร้านค้า A              ...
แถว 11:                                                ยอดรวม         10,000
แถว 12:                  ร้านค้า B              ...
แถว 13:                                                ยอดรวม         20,000
```

**สิ่งสำคัญ**:
- ชื่อร้านค้า (คอลัมน์ B) อยู่ด้านบน
- คำว่า "ยอดรวม" (คอลัมน์ G) อยู่ในแถวถัดไป
- ยอดเงิน (คอลัมน์ H) อยู่ในแถวเดียวกับ "ยอดรวม"

### 4. สร้าง Sheet: Customers

1. ที่มุมล่างซ้าย กด **+** เพื่อเพิ่ม Sheet
2. ตั้งชื่อ: `Customers`
3. ใส่ Headers ในแถวแรก:

| A | B | C | D | E | F |
|---|---|---|---|---|---|
| Timestamp | LINE User ID | ชื่อ-นามสกุล | ชื่อร้านค้า | เลขประจำตัวผู้เสียภาษี | สถานะ |

4. ปรับความกว้างคอลัมน์:
   - คอลัมน์ A: 180px (Timestamp)
   - คอลัมน์ B: 250px (LINE User ID)
   - คอลัมน์ C: 200px (ชื่อ-นามสกุล)
   - คอลัมน์ D: 250px (ชื่อร้านค้า)
   - คอลัมน์ E: 150px (เลขประจำตัวผู้เสียภาษี)
   - คอลัมน์ F: 100px (สถานะ)

5. ตั้งค่า Format:
   - คอลัมน์ A: Format → Number → Date time
   - คอลัมน์ E: Format → Number → Plain text (เผื่อไว้สำหรับเลข 0 นำ)

### 5. สร้าง Sheet: MessageLog

1. เพิ่ม Sheet ใหม่
2. ตั้งชื่อ: `MessageLog`
3. ใส่ Headers ในแถวแรก:

| A | B | C | D |
|---|---|---|---|
| Timestamp | LINE User ID | ข้อความที่ส่ง | ข้อความตอบกลับ |

4. ปรับความกว้างคอลัมน์:
   - คอลัมน์ A: 180px (Timestamp)
   - คอลัมน์ B: 250px (LINE User ID)
   - คอลัมน์ C: 300px (ข้อความที่ส่ง) - ใช้ Text wrapping
   - คอลัมน์ D: 400px (ข้อความตอบกลับ) - ใช้ Text wrapping

5. ตั้งค่า Format:
   - คอลัมน์ A: Format → Number → Date time
   - คอลัมน์ C, D: Format → Text wrapping → Wrap

### 6. ป้องกันการแก้ไข (Optional - แนะนำ)

เพื่อป้องกันการลบข้อมูลโดยไม่ตั้งใจ:

1. ไปที่ **Data** → **Protect sheets and ranges**
2. **Protect Sheet: Customers**
   - กด **+ Sheet** → เลือก `Customers`
   - ตั้งค่า **Show a warning when editing this range**
   - กด **Set permissions**

3. **Protect Sheet: MessageLog**
   - ทำเช่นเดียวกัน

### 7. ทดสอบการอ่านข้อมูล

ใน Google Apps Script (ยังไม่ต้อง deploy):

```javascript
function testReadSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const arSheet = ss.getSheetByName("AccountReceivables");

  // อ่านข้อมูล 10 แถวแรก
  const data = arSheet.getRange("A1:H10").getValues();

  console.log("ข้อมูล AccountReceivables:");
  data.forEach((row, index) => {
    console.log(`แถว ${index + 1}: ${row.join(" | ")}`);
  });

  // ทดสอบการค้นหา
  const testShopName = "ร้านค้า A"; // เปลี่ยนเป็นชื่อร้านค้าจริง
  const balance = getOutstandingBalance(testShopName);
  console.log(`ยอดคงค้างของ ${testShopName}: ${balance}`);
}
```

## ✅ Checklist การตรวจสอบ

ก่อนนำไปใช้งาน ตรวจสอบให้แน่ใจว่า:

- [ ] Spreadsheet ID ถูกต้อง
- [ ] Sheet ชื่อ `AccountReceivables` มีข้อมูลจาก Excel
- [ ] คอลัมน์ B มีชื่อร้านค้า
- [ ] คอลัมน์ G มีคำว่า "ยอดรวม" ในแถวที่เป็นยอดรวม
- [ ] คอลัมน์ H มียอดเงิน
- [ ] Sheet ชื่อ `Customers` มี Headers ถูกต้อง
- [ ] Sheet ชื่อ `MessageLog` มี Headers ถูกต้อง
- [  ] ทดสอบฟังก์ชัน `setupSheets()` ใน Apps Script แล้ว
- [ ] ทดสอบฟังก์ชัน `testReadSheet()` แล้ว

## 🔍 การตรวจสอบความถูกต้องของข้อมูล

### ทดสอบด้วย Apps Script

สร้างไฟล์ใหม่ใน Apps Script ชื่อ `Test.gs`:

```javascript
function testBalanceCalculation() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const arSheet = ss.getSheetByName("AccountReceivables");
  const data = arSheet.getDataRange().getValues();

  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║           ทดสอบการคำนวณยอดคงค้าง                    ║");
  console.log("╚══════════════════════════════════════════════════════╝");

  let totalBalance = 0;
  let currentShopName = null;
  const shopBalances = {};

  const COL_B = 1;
  const COL_G = 6;
  const COL_H = 7;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const cellB = row[COL_B];
    const cellG = row[COL_G];
    const cellH = row[COL_H];

    if (cellB && cellB.toString().trim() !== "") {
      currentShopName = cellB.toString().trim();
    }

    if (cellG && cellG.toString().trim() === "ยอดรวม") {
      const amount = parseFloat(cellH) || 0;

      if (currentShopName) {
        if (!shopBalances[currentShopName]) {
          shopBalances[currentShopName] = 0;
        }
        shopBalances[currentShopName] += amount;
        totalBalance += amount;

        console.log(`✓ ${currentShopName}: ${amount.toLocaleString()} บาท`);
      }
    }
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`ยอดรวมทั้งหมด: ${totalBalance.toLocaleString()} บาท`);
  console.log(`จำนวนร้านค้า: ${Object.keys(shopBalances).length}`);
  console.log("╚══════════════════════════════════════════════════════╝");
}
```

รันฟังก์ชันนี้และดูผลใน Execution log

## 📝 บันทึกข้อมูลที่ได้

หลังจากตั้งค่าเสร็จ บันทึกข้อมูลต่อไปนี้:

1. **Spreadsheet ID**: `_____________________________________________`
2. **URL**: `https://docs.google.com/spreadsheets/d/________________________`
3. **ชื่อร้านค้าทดสอบ**: `_____________________________________________`
4. **ยอดคงค้างที่คาดไว้**: `_____________________________________________`

## 🆘 ปัญหาที่พบบ่อย

### ปัญหา: Import Excel แล้วข้อมูลเพี้ยน

**วิธีแก้**:
1. ใช้วิธี B (Copy-Paste) แทน
2. หรือ export Excel เป็น CSV แล้ว import

### ปัญหา: ไม่พบ Sheet ที่ตั้งชื่อไว้

**วิธีแก้**:
1. ตรวจสอบชื่อ Sheet ว่าตรงกับที่ระบุใน Code.gs:
   - `AccountReceivables`
   - `Customers`
   - `MessageLog`
2. ชื่อต้องตรงตัวพิมพ์ใหญ่-เล็ก (case-sensitive)

### ปัญหา: อ่านข้อมูลแล้วค่าเป็น 0

**วิธีแก้**:
1. ตรวจสอบคอลัมน์ G ว่ามีคำว่า "ยอดรวม" จริงๆ
2. ตรวจสอบคอลัมน์ H ว่าเป็นตัวเลข (ไม่ใช่ text)
3. รันฟังก์ชัน `testBalanceCalculation()` เพื่อดูว่าเกิดอะไรขึ้น

## 📞 ต้องการความช่วยเหลือ?

หากพบปัญหาในการตั้งค่า Google Sheets:
- ติดต่อ: support@boonyang.com
- ดูเพิ่มเติมใน [README.md](README.md)
