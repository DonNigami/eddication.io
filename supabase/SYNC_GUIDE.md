# 🔄 Sync Edge Functions to Supabase

## สถานะปัจจุบัน

ไฟล์ Edge Functions ถูกสร้างแบบ flat structure:
```
functions/
├── types.ts
├── utils.ts
├── search-job.ts
├── update-stop.ts
├── upload-alcohol.ts
├── close-job.ts
└── end-trip.ts
```

## โครงสร้างที่ถูกต้องสำหรับ Supabase

Supabase Edge Functions ต้องการโครงสร้างแบบนี้:
```
functions/
├── _shared/
│   ├── types.ts
│   └── utils.ts
├── search-job/
│   └── index.ts
├── update-stop/
│   └── index.ts
├── upload-alcohol/
│   └── index.ts
├── close-job/
│   └── index.ts
└── end-trip/
    └── index.ts
```

## วิธี Reorganize

### Step 1: รัน Reorganize Script

**Windows:**
```cmd
cd D:\VS_Code_GitHub_DATA\eddication.io\eddication.io\supabase
.\reorganize-functions.bat
```

**Mac/Linux:**
```bash
cd /path/to/project/supabase
chmod +x reorganize-functions.sh
./reorganize-functions.sh
```

### Step 2: ตรวจสอบโครงสร้าง

```cmd
cd functions
dir /s
```

ควรเห็น:
- `_shared\types.ts`
- `_shared\utils.ts`
- `search-job\index.ts`
- `update-stop\index.ts`
- `upload-alcohol\index.ts`
- `close-job\index.ts`
- `end-trip\index.ts`

### Step 3: Deploy to Supabase

```bash
supabase functions deploy --no-verify-jwt
```

## สิ่งที่ Script ทำ

1. **สร้าง directories**:
   - `_shared/` สำหรับ shared code
   - แต่ละ function มี folder ของตัวเอง

2. **ย้ายไฟล์**:
   - `types.ts` → `_shared/types.ts`
   - `utils.ts` → `_shared/utils.ts`
   - `search-job.ts` → `search-job/index.ts`
   - และอื่นๆ

3. **แก้ไข import paths**:
   - เปลี่ยนจาก `'./types.ts'` → `'../_shared/types.ts'`
   - เปลี่ยนจาก `'./utils.ts'` → `'../_shared/utils.ts'`

## ทำไมต้อง Reorganize?

### ❌ แบบเดิม (Flat):
```typescript
// search-job.ts
import { types } from './types.ts';  // ❌ ไม่ work
```
- Supabase แยก function แต่ละตัวเป็น isolated environment
- ไม่สามารถ import จาก root level ได้

### ✅ แบบใหม่ (Nested):
```typescript
// search-job/index.ts
import { types } from '../_shared/types.ts';  // ✅ Work!
```
- แต่ละ function มี folder ของตัวเอง
- Shared code อยู่ใน `_shared/`
- Import path ชัดเจน

## Verification

### ตรวจสอบว่า reorganize สำเร็จ:

```bash
# ดูโครงสร้าง
tree supabase/functions

# หรือ
find supabase/functions -type f -name "*.ts"
```

ควรเห็น output:
```
supabase/functions/_shared/types.ts
supabase/functions/_shared/utils.ts
supabase/functions/search-job/index.ts
supabase/functions/update-stop/index.ts
supabase/functions/upload-alcohol/index.ts
supabase/functions/close-job/index.ts
supabase/functions/end-trip/index.ts
```

### ตรวจสอบ import paths:

```bash
# ดู imports ใน search-job
cat supabase/functions/search-job/index.ts | grep "import"
```

ควรเห็น:
```typescript
import type { ... } from '../_shared/types.ts';
import { ... } from '../_shared/utils.ts';
```

## Troubleshooting

### ปัญหา: ไฟล์ยังอยู่ที่เดิม
**แก้:** รัน script อีกครั้ง หรือย้ายไฟล์ manual

### ปัญหา: Import paths ยังไม่ถูกต้อง
**แก้:** แก้ไข import ใน `index.ts` ให้ชี้ไปที่ `../_shared/`

### ปัญหา: Deploy ไม่สำเร็จ
**แก้:** 
```bash
# ตรวจสอบ syntax
deno check supabase/functions/search-job/index.ts

# Deploy ทีละ function
supabase functions deploy search-job --no-verify-jwt
```

## Next Steps

หลังจาก reorganize เสร็จแล้ว:

1. **Verify structure**: ตรวจสอบว่าโครงสร้างถูกต้อง
2. **Test locally**: `supabase functions serve`
3. **Deploy**: `supabase functions deploy`
4. **Test endpoints**: ใช้ curl หรือ Postman ทดสอบ

---

**Created**: 2026-01-17  
**Version**: 1.0.0  
**Status**: Ready to run reorganize script
