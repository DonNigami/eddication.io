# SCORDS AI Chat - Deployment Guide

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

### 2. เพิ่มฟังก์ชัน `askAI()`

ไฟล์ `backend/Code.gs` มีฟังก์ชันใหม่แล้ว:
- `askAI()` - ฟังก์ชันหลัก
- `searchKnowledgeBase()` - ค้นหาใน SCOR_Knowledge
- `searchPointsRules()` - ค้นหาใน Points_Rules
- `buildContext()` - สร้าง context
- `callOpenAI()` - เรียก OpenAI API

### 3. Set up OpenAI API Key

ใน Apps Script Editor:

```javascript
// Run this function ONCE to set your API key
function setupOpenAIKey() {
  const apiKey = "sk-YOUR_OPENAI_API_KEY_HERE"; // Replace with your key
  ScriptProperties.setProperty("OPENAI_API_KEY", apiKey);
  console.log("API Key saved successfully!");
}
```

**วิธีได้ OpenAI API Key:**
1. ไปที่: https://platform.openai.com/api-keys
2. Login หรือ Sign up
3. คลิก **Create new secret key**
4. ตั้งชื่อ: `SCORDS AI`
5. Copy API key (เรูปแบบ: `sk-...`)
6. Paste ใน function ด้านบน

### 4. Deploy Google Apps Script

1. คลิก **Deploy** > **New deployment**
2. เลือก **Web app**
3. ตั้งค่า:
   - Description: SCORDS AI Assistant (Update)
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
  console.log("Cost:", result.data.cost);
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
Cost: 0.0018
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

ลองคำถามเหล่าน:

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

### Test Case 3: Empty Query
```
Query: ""
Expected: No API call (validate on frontend)
Time: 0 seconds
```

### Test Case 4: Long Query
```
Query: "ขั้นตอน Plan Source Make Deliver Return Enable ต่างกันยังไง?"
Expected: Comparison of SCOR processes
Time: <5 seconds
```

---

## 🐛 Troubleshooting

### Problem: "Invalid action specified"
**Solution:** Check that `case "askAI":` is added in `doPost()` switch statement

### Problem: "SCOR_Knowledge sheet not found"
**Solution:**
1. Check sheet name is exactly `SCOR_Knowledge` (case-sensitive)
2. Check sheet exists in Google Sheets
3. Re-deploy Apps Script

### Problem: "OPENAI_API_KEY not found"
**Solution:**
1. Run `setupOpenAIKey()` function once
2. Check ScriptProperties: `ScriptProperties.getProperty("OPENAI_API_KEY")`
3. Verify API key is valid

### Problem: AI response in English
**Solution:** System prompt is in Thai, should respond in Thai. Check OpenAI API response.

### Problem: Slow response (>5 seconds)
**Possible causes:**
1. OpenAI API latency (check status: https://status.openai.com)
2. Google Sheets reading slow
3. Large knowledge base (reduce rows)

---

## ✅ Deployment Checklist

- [ ] สร้าง 3 Sheets ใน Google Sheets
- [ ] Import CSV files เข้า Sheets
- [ ] เพิ่ม `askAI()` function ใน Code.gs
- [ ] Set `OPENAI_API_KEY` in ScriptProperties
- [ ] Deploy Google Apps Script (New version)
- [ ] Test backend with `testAskAI()`
- [ ] Test frontend in LINE LIFF
- [ ] Verify AI responses in Thai
- [ ] Check cost per query

---

## 📊 Cost Monitoring

### Check Cost Per Query

After each query, AI returns cost:
```javascript
result.data.cost // e.g., 0.0018
```

**Expected Cost:**
- 100 queries/month: ~$0.03
- 500 queries/month: ~$0.14
- 1,000 queries/month: ~$0.30

### View OpenAI Usage

1. ไปที่: https://platform.openai.com/usage
2. Login
3. View "Daily usage"
4. Check `gpt-4o-mini` usage

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

### Data Privacy

✅ **DO:**
- Only include non-sensitive knowledge
- No personal user data in knowledge base
- Follow company data policy

❌ **DON'T:**
- Store personal employee info in knowledge
- Share confidential business data
- Include sensitive procedures

---

## 📞 Support

หากเจอปัญหา:

1. **Backend Issues:**
   - Check Apps Script Execution log
   - Verify Google Sheets structure
   - Check OpenAI API status

2. **Frontend Issues:**
   - Clear LIFF cache
   - Refresh browser
   - Check console errors (F12)

3. **API Issues:**
   - Check OpenAI API status
   - Verify API key validity
   - Check API credits

---

## 🎯 Success Criteria

✅ **Deployment Success:**
- Chat button appears in LINE LIFF
- AI responds to queries in Thai
- Response time <3 seconds
- Cost per query < $0.01

✅ **User Acceptance:**
- 50% users try AI within first week
- Average 3+ queries/user/week
- Positive feedback >80%

---

## 📝 Next Steps (Post-MVP)

After successful deployment:

1. **Week 2:** Add more knowledge to CSV files
2. **Week 3:** Improve search algorithm (better keyword matching)
3. **Week 4:** Add conversation memory (multi-turn)
4. **Week 5:** Analytics dashboard (popular questions)
5. **Week 6:** Advanced features (context-aware responses)

---

**Version:** 1.0.0
**Last Updated:** 7 March 2026
**Deployment Status:** Ready for Testing
