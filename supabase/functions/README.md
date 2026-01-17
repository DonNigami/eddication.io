# Supabase Edge Functions Backend

## 📁 โครงสร้างไฟล์

```
supabase/functions/
├── types.ts              # Type definitions (TypeScript interfaces)
├── utils.ts              # Shared utilities (CORS, validation, helpers)
├── search-job.ts         # ค้นหางานจาก reference
├── update-stop.ts        # อัปเดตสถานะ stop (check-in/out, fuel, unload)
├── upload-alcohol.ts     # บันทึกการตรวจแอลกอฮอล์ + upload รูป
├── close-job.ts          # ปิดงาน
└── end-trip.ts           # จบทริป
```

## 🚀 API Endpoints

### 1. Search Job
**Endpoint:** `POST /search-job`
```typescript
{
  reference: string;
  userId: string;
}
```
**Response:**
```typescript
{
  success: true,
  data: {
    referenceNo: string;
    vehicleDesc: string;
    shipmentNos: string[];
    totalStops: number;
    stops: StopInfo[];
    alcohol: {
      drivers: string[];
      checkedDrivers: string[];
    };
    jobClosed: boolean;
    tripEnded: boolean;
  }
}
```

### 2. Update Stop
**Endpoint:** `POST /update-stop`
```typescript
{
  rowIndex: number;
  status: string;
  type: 'checkin' | 'checkout' | 'fuel' | 'unload';
  userId: string;
  lat?: number;
  lng?: number;
  odo?: number;
  receiverName?: string;
  receiverType?: string;
  hasPumping?: string;
  hasTransfer?: string;
}
```

### 3. Upload Alcohol
**Endpoint:** `POST /upload-alcohol`
```typescript
{
  reference: string;
  driverName: string;
  userId: string;
  alcoholValue: number;
  imageBase64?: string;
  lat?: number;
  lng?: number;
}
```

### 4. Close Job
**Endpoint:** `POST /close-job`
```typescript
{
  reference: string;
  userId: string;
  vehicleStatus: string;
  vehicleDesc: string;
  hillFee: string;
  bkkFee: string;
  repairFee: string;
}
```

### 5. End Trip
**Endpoint:** `POST /end-trip`
```typescript
{
  reference: string;
  userId: string;
  endOdo?: number;
  endPointName: string;
  lat?: number;
  lng?: number;
}
```

## 🔧 การติดตั้งและ Deploy

### 1. ติดตั้ง Supabase CLI
```bash
npm install -g supabase
```

### 2. Login
```bash
supabase login
```

### 3. Link Project
```bash
cd D:\VS_Code_GitHub_DATA\eddication.io\eddication.io
supabase link --project-ref myplpshpcordggbbtblg
```

### 4. Deploy Functions
```bash
# Deploy ทีละ function
supabase functions deploy search-job --no-verify-jwt
supabase functions deploy update-stop --no-verify-jwt
supabase functions deploy upload-alcohol --no-verify-jwt
supabase functions deploy close-job --no-verify-jwt
supabase functions deploy end-trip --no-verify-jwt

# หรือ Deploy ทั้งหมดพร้อมกัน
supabase functions deploy --no-verify-jwt
```

### 5. ตั้งค่า Environment Variables
```bash
# ตั้งค่า secrets สำหรับ Edge Functions
supabase secrets set SUPABASE_URL=https://myplpshpcordggbbtblg.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

## 📝 วิธีใช้งาน

### ตัวอย่างการเรียกใช้จาก Frontend

```javascript
// Before: เรียก Supabase โดยตรง
const { data, error } = await supabase
  .from('jobdata')
  .select('*')
  .eq('reference', reference);

// After: เรียกผ่าน Edge Function
const response = await fetch(
  'https://myplpshpcordggbbtblg.supabase.co/functions/v1/search-job',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`
    },
    body: JSON.stringify({
      reference: reference,
      userId: currentUserId
    })
  }
);

const result = await response.json();
if (result.success) {
  console.log(result.data);
} else {
  console.error(result.error);
}
```

## 🛡️ Features

### Security
- ✅ CORS headers configured
- ✅ Input validation
- ✅ SQL injection protection (via Supabase SDK)
- ✅ XSS protection (input sanitization)
- ✅ Service role key (server-side only)

### Error Handling
- ✅ Try-catch blocks
- ✅ Detailed error messages
- ✅ HTTP status codes
- ✅ Logging with timestamps

### Data Validation
- ✅ Required field validation
- ✅ Reference format validation
- ✅ Alcohol value range (0-5)
- ✅ ODO range (0-9,999,999)
- ✅ Type checking

### Image Upload
- ✅ Base64 decoding
- ✅ Supabase Storage integration
- ✅ Public URL generation
- ✅ Error handling (non-critical)

## 🧪 การทดสอบ

### Local Testing (Supabase CLI)
```bash
# Start local dev server
supabase functions serve

# Test with curl
curl -X POST http://localhost:54321/functions/v1/search-job \
  -H "Content-Type: application/json" \
  -d '{"reference":"TEST001","userId":"U1234"}'
```

### Production Testing
```bash
curl -X POST https://myplpshpcordggbbtblg.supabase.co/functions/v1/search-job \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"reference":"TEST001","userId":"U1234"}'
```

## 📊 Monitoring & Logs

```bash
# ดู logs ของ function
supabase functions logs search-job

# ดู logs แบบ real-time
supabase functions logs search-job --tail
```

## 🔄 Migration Path

### Phase 1: ✅ สร้าง Backend (เสร็จแล้ว)
- [x] สร้าง types.ts
- [x] สร้าง utils.ts
- [x] สร้าง search-job.ts
- [x] สร้าง update-stop.ts
- [x] สร้าง upload-alcohol.ts
- [x] สร้าง close-job.ts
- [x] สร้าง end-trip.ts

### Phase 2: Deploy to Supabase
- [ ] Login และ link project
- [ ] Deploy functions
- [ ] ตั้งค่า environment variables
- [ ] ทดสอบ endpoints

### Phase 3: Update Frontend
- [ ] สร้าง API client wrapper
- [ ] เปลี่ยนจาก direct Supabase calls เป็น Edge Functions
- [ ] ทดสอบทุก features
- [ ] Handle errors และ retry logic

### Phase 4: Production
- [ ] Monitor logs
- [ ] Performance tuning
- [ ] Add rate limiting (ถ้าจำเป็น)
- [ ] Analytics และ tracking

## 📚 Resources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Deno Deploy Docs](https://deno.com/deploy/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## ⚠️ Important Notes

1. **Service Role Key**: ใช้ Service Role Key ใน Edge Functions เท่านั้น (ไม่ใช่ Anon Key)
2. **CORS**: ตั้งค่า CORS headers สำหรับทุก endpoint
3. **Validation**: ตรวจสอบ input ทุกครั้งก่อน query database
4. **Logging**: ใช้ log() function เพื่อ debug และ monitor
5. **Error Messages**: ใช้ภาษาไทยเพื่อ user experience ที่ดี

## 🎯 Next Steps

1. **Deploy Functions**: Run deployment commands
2. **Update Frontend**: Modify `index-supabase.html` to call Edge Functions
3. **Test Everything**: ทดสอบทุก endpoint กับ frontend
4. **Monitor**: ตรวจสอบ logs และ performance

---

Created: 2026-01-17
Last Updated: 2026-01-17
Version: 1.0.0
