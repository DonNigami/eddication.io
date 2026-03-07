# SCORDS AI Chat - Deployment Guide (GLM API + PDF)

## 📋 วิธีการติดตั้งระบบ (Day-by-Step)

---

## Day 1: เตรียม Google Sheets

### 1. เปิด Google Sheets
1. ไปที่: https://docs.google.com/spreadsheets/d/1nvNFkeUUU7tTnTlE0UkKt0tZqxYe4fxOI7crTtiEsrM

### 2. สร้าง Sheets ใหม่ 3 แท็บ

#### แท็บที่ 1: SCOR_Knowledge
1. คลิก **+** ด้านซ้ายมือสุด
2. เลือก **Insert sheet** (แทรกใหม่)
3. ตั้งชื่อ: `SCOR_Knowledge`
4. แก้ Header ที่ Row 1:
   ```
   Category | Topic | Question | Answer | Keywords | Priority
   ```
5. Import ไฟล์ CSV:
   - ไปที่ File > Import
   - อัปโหลด `SCORDS/knowledge_base/scor_knowledge.csv`
   - ตรวจสอบว่า import ถูกต้อง

#### แท็บที่ 2: Points_Rules
1. สร้าง sheet ใหม่ชื่อ: `Points_Rules`
2. Header ที่ Row 1:
   ```
   Rule_Type | Description | Points | Max_Daily | Conditions
   ```
3. Import ไฟล์: `SCORDS/knowledge_base/points_rules.csv`

#### แท็บที่ 3: FAQ
1. สร้าง sheet ใหม่ชื่อ: `FAQ`
2. Header ที่ Row 1:
   ```
   Category | Question | Answer | Priority
   ```
3. Import ไฟล์: `SCORDS/knowledge_base/faq.csv`

---

## Day 2: ตั้งค่า Google Apps Script

### 1. เปิด Google Apps Script Editor
1. ใน Google Sheets ไปที่ **Extensions** > **Apps Script**
2. รอสนิท อยู่ไฟล์ `Code.gs`

### 2. เพิ่มฟังก์ชัน AI

ไฟล์ `backend/Code.gs` มีฟังก์ชันใหม่แล้ว:
- `askAI()` - ฟังก์ชันหลัก
- `searchKnowledgeBase()` - ค้นหาใน SCOR_Knowledge
- `searchPointsRules()` - ค้นหาใน Points_Rules
- `searchPDFDocuments()` - ค้นหาใน PDF documents
- `buildContext()` - สร้าง context
- `callGLM()` - เรียก Z.AI API (หลัก)
- `callOpenAI()` - เรียก OpenAI API (สำรอง)

### 3. Set up Z.AI API Key (หลัก - ราคาถูกกว่า)

ใน Apps Script Editor:

```javascript
// Run this function ONCE to set your Z.AI API key
function setupZAIKey() {
  const apiKey = "YOUR_ZAI_API_KEY_HERE"; // Replace with your key
  ScriptProperties.setProperty("ZAI_API_KEY", apiKey);
  console.log("Z.AI API Key saved successfully!");
}
```

**วิธีได้ Z.AI API Key:**
1. ไปที่: https://docs.z.ai/guides/overview/quick-start
2. Login หรือ Sign up
3. Get API key from dashboard
4. Copy API key
5. Paste ใน function ด้านบน

**Z.AI Pricing (รุ่น glm-5):**
- Input: ~0.5 THB per million tokens (~$0.014 USD)
- Output: ~2 THB per million tokens (~$0.056 USD)
- **ถูกกว่า OpenAI 10 เท่า!**

### 4. Set up OpenAI API Key (ตัวเลือกสำรอง)

```javascript
// Run this function ONCE to set your OpenAI API key (optional)
function setupOpenAIKey() {
  const apiKey = "sk-YOUR_OPENAI_API_KEY_HERE"; // Replace with your key
  ScriptProperties.setProperty("OPENAI_API_KEY", apiKey);
  console.log("OpenAI API Key saved successfully!");
}
```

**วิธีได้ OpenAI API Key:**
1. ไปที่: https://platform.openai.com/api-keys
2. Login หรือ Sign up
3. คลิก **Create new secret key**
4. ตั้งชื่อ: `SCORDS AI`
5. Copy API key (เรูปแบบ: `sk-...`)
6. Paste ใน function ด้านบน

### 5. Set up PDF Folder (สำหรับเอกสาร PDF)

```javascript
// Run this function ONCE to set your PDF folder ID
function setupPDFFolder() {
  const folderId = "YOUR_GOOGLE_DRIVE_FOLDER_ID_HERE"; // Replace with folder ID
  ScriptProperties.setProperty("PDF_FOLDER_ID", folderId);
  console.log("PDF Folder ID saved successfully!");
}
```

**วิธีหา Folder ID:**
1. สร้าง folder ใหม่ใน Google Drive
2. ตั้งชื่อ: `SCORDS PDF Documents`
3. อัปโหลดไฟล์ PDF ที่ต้องการใช้เป็น knowledge base
4. เปิด folder นั้น
5. ดู URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`
6. Copy ส่วน `FOLDER_ID_HERE` (เรูปแบบ: ตัวอักษรยาวๆ)
7. Paste ใน function ด้านบน

### 6. Deploy Google Apps Script

1. คลิก **Deploy** > **New deployment**
2. เลือก **Web app**
3. ตั้งค่า:
   - Description: SCORDS AI Assistant (GLM + PDF Support)
   - Execute as: **Me** (อีเมลของคุณ)
   - Who has access: **Anyone** (ทุกคน)
4. คลิก **Deploy**
5. **อย่าลืม** เลือก **New version**

---

## Day 3: Test ระบบ

### 1. Test Backend (ใน Apps Script Editor)

```javascript
function testAskAI() {
  const result = askAI({
    query: "SCOR คืออะไร?",
    context: { userId: "test123", group: "Test" }
  });

  console.log("Success:", result.success);
  console.log("Answer:", result.data.answer);
  console.log("Sources:", result.data.sources);
  console.log("Cost (THB):", result.data.costTHB);
  console.log("Model:", result.data.model);
}
```

**วิธีรัน:**
1. กด **+** ถัดไป "function name testAskAI"
2. คลิก **Run**
3. ดูผลใน **Execution log** (ด้านขวาล่าง)

**Expected Output:**
```
Success: true
Answer: SCOR (Supply Chain Operations Reference) คือเฟรมเวิร์ก...
Sources: [SCOR_Knowledge: SCOR Overview]
Cost (THB): 0.00014
Model: glm-4-flash
```

### 2. Test Frontend (LINE LIFF)

1. เปิด SCORDS บน LINE LIFF
2. คลิกปุ่ม **🤖** ที่มุมขวาล่าง
3. ควรเห็น Chat window เปิดขึ้นมา
4. พิมพ์: "SCOR คืออะไร?"
5. กด **ส่ง**
6. ควรเห็น:
   - ข้อความปรากฏ (user message)
   - กำลังคิด (animation)
   - AI ตอบกลับ (bot message)

### 3. Test Queries

ลองคำถามเหล่านี้:

| Query | Expected Response |
|-------|-----------------|
| SCOR คืออะไร? | Overview of SCOR framework |
| ได้แต้มยังไง? | List of ways to earn points |
| ขอบคุณ | Polite acknowledgment |
| 量子物理 (Chinese) | Apology for Thai-only support |

---

## 🧪 Test Cases สำคัญ

### Test Case 1: Basic Query
```
Query: "SCOR คืออะไร?"
Expected: Thai text explaining SCOR
Time: <3 seconds
```

### Test Case 2: Points System
```
Query: "ได้แต้มยังไง?"
Expected: List ways to earn points
Time: <3 seconds
```

### Test Case 3: PDF Search (ถ้ามี PDF)
```
Query: "ข้อมูลในเอกสาร..."
Expected: Content from PDF documents
Time: <5 seconds
```

### Test Case 4: Long Query
```
Query: "ขั้นตอน Plan Source Make Deliver Return Enable ต่างกันยังไง?"
Expected: Comparison of SCOR processes
Time: <5 seconds
```

---

## 🐛 Troubleshooting

### Problem: "ZAI_API_KEY not found"
**Solution:**
1. Run `setupZAIKey()` function once
2. Check ScriptProperties: `ScriptProperties.getProperty("ZAI_API_KEY")`
3. Verify API key is valid

### Problem: "PDF_FOLDER_ID not found"
**Solution:**
1. Run `setupPDFFolder()` function once
2. Verify folder ID is correct
3. Make sure folder contains PDF files

### Problem: Z.AI API fails
**Solution:**
- System will automatically fallback to OpenAI
- Check `result.data.fallback` in response
- Verify API key has credits
- Check Z.AI status: https://docs.z.ai

### Problem: PDF search returns nothing
**Solution:**
1. Check folder contains PDF files
2. Verify PDF files have extractable text (not scanned images only)
3. Check query keywords match PDF content

---

## ✅ Deployment Checklist

- [ ] สร้าง 3 Sheets ใน Google Sheets
- [ ] Import CSV files เข้า Sheets
- [ ] Set `ZAI_API_KEY` in ScriptProperties
- [ ] Set `PDF_FOLDER_ID` in ScriptProperties (optional)
- [ ] Set `OPENAI_API_KEY` in ScriptProperties (optional - fallback)
- [ ] Deploy Google Apps Script (New version)
- [ ] Test backend with `testAskAI()`
- [ ] Test frontend in LINE LIFF
- [ ] Verify AI responses in Thai
- [ ] Check cost per query

---

## 📊 Cost Monitoring

### Z.AI API Pricing (หลัก)

**รุ่น glm-5:**
- Input: 0.5 THB per million tokens
- Output: 2 THB per million tokens

**Estimated Usage** (per month):
- 100 questions × avg 200 input tokens = 20K tokens × 0.5 THB = **0.01 THB**
- 100 answers × avg 400 output tokens = 40K tokens × 2 THB = **0.08 THB**
- **Total**: ~0.09 THB/month (100 questions)

**More realistic (500 questions/month):**
- Input: 100K tokens × 0.5 THB = **0.05 THB**
- Output: 200K tokens × 2 THB = **0.4 THB**
- **Total**: ~0.45 THB/month (500 questions)

**Heavy usage (1,000 questions/month):**
- **Total**: ~0.9 THB/month

✅ **Z.AI เถือะมาก! <1 THB/เดือน แม้ใช้หนักๆ**

### OpenAI API Pricing (สำรอง)

**รุ่น GPT-4o mini:**
- Input: $0.15 per million tokens (~5.4 THB)
- Output: $0.60 per million tokens (~21.4 THB)

**1,000 questions/month:**
- **Total**: ~10.8 THB/month

---

## 📁 PDF Setup Guide

### สร้าง PDF Folder

1. ไปที่ Google Drive
2. สร้าง folder ใหม่ชื่อ "SCORDS PDF Documents"
3. อัปโหลดไฟล์ PDF ที่ต้องการ

### ประเภท PDF ที่รองรับ

✅ **รองรับ:**
- PDF ที่มี text layer (สามารถ copy text ได้)
- PDF จาก Word, Excel, PowerPoint export
- PDF เอกสาร, มืองาน, SOP

❌ **ไม่รองรับ:**
- PDF ที่เป็นรูปภาพทั้งหมด (scanned images only)
- PDF ที่มี password protection
- PDF ที่เป็น handwritten

### ขนาด PDF

- ขนาดไฟล์: แนะนำ <10 MB per file
- จำนวนหน้า: แนะนำ <50 pages per file
- จำนวนไฟล์: ค้นหา 10 ไฟล์ล่าสุด (เพื่อ performance)

---

## 🔐 Security Notes

### Protecting API Keys

✅ **DO:**
- Store API key in ScriptProperties (encrypted)
- Use service role permissions only
- Monitor API usage regularly

❌ **DON'T:**
- Commit API key to Git
- Share API key publicly
- Log API key in plain text

### PDF Document Security

✅ **DO:**
- Only include non-sensitive knowledge
- Remove personal data before upload
- Use separate folder for test documents

❌ **DON'T:**
- Upload confidential business data
- Include personal employee information
- Share public folder link

---

## 📞 Support

หากเจอปัญหา:

1. **Z.AI API Issues:**
   - Check API key at: https://docs.z.ai/guides/overview/quick-start
   - Verify account has credits
   - Check Z.AI status page

2. **PDF Issues:**
   - Verify PDF has extractable text
   - Check folder ID is correct
   - Test with simple PDF first

3. **Backend Issues:**
   - Check Apps Script Execution log
   - Verify Google Sheets structure
   - Check API status

---

## 🎯 Success Criteria

✅ **Deployment Success:**
- Chat button appears in LINE LIFF
- AI responds to queries in Thai
- Response time <3 seconds
- Cost <0.5 THB/month (1,000 queries)
- PDF search works (if PDFs uploaded)

✅ **User Acceptance:**
- 50% users try AI within first week
- Average 3+ queries/user/week
- Positive feedback >80%

---

## 📝 Next Steps (Post-MVP)

After successful deployment:

1. **Week 2:** Add more PDF documents
2. **Week 3:** Improve PDF extraction accuracy
3. **Week 4:** Add conversation memory (multi-turn)
4. **Week 5:** Analytics dashboard (popular questions)
5. **Week 6:** Advanced features (context-aware responses)

---

**Version:** 2.0.0 (GLM + PDF)
**Last Updated:** 7 March 2026
**Deployment Status:** Ready for Testing

---

## API Comparison

| Feature | Z.AI | OpenAI |
|---------|----------------|---------|
| Model | glm-5 | gpt-4o-mini |
| Thai Support | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Speed | Fast | Fast |
| Pricing | 0.5-2 THB/M tokens | 5.4-21.4 THB/M tokens |
| Cost Ratio | 1x (cheapest) | ~10x more expensive |
| Fallback | ✅ To OpenAI | ❌ None |

**Recommendation:** Use Z.AI as primary, OpenAI as fallback
