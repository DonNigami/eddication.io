# 🚀 SUBSCRIPTION SYSTEM - QUICK START

## 3-Step Fix (5 minutes)

### Step 1: Run SQL Setup (Supabase)

1. Go to https://app.supabase.com → Project `ckhwouxtrvuthefkxnxb`
2. Click **SQL Editor** → **New Query**
3. Copy ALL from: `project/crm/COMPLETE_SETUP.sql`
4. Paste into SQL Editor
5. Click **RUN** (Ctrl+Enter)
6. Wait for ✅ "Setup complete!"

### Step 2: Hard Refresh Admin Page

1. Open `packages-admin.html`
2. Press **Ctrl+Shift+R**
3. Wait for page to reload

### Step 3: Test Approve/Reject

1. Go to **"ใบสมัครใหม่"** tab
2. Click **"อนุมัติ"** button
3. Check **"สมาชิก"** tab for new subscription ✅

---

## ✨ What's Fixed

| Before ❌ | After ✅ |
|----------|--------|
| Used `subscriptions` table | Uses `customer_subscriptions` |
| Fetched customer from `profiles` | Stores `customer_name`, `customer_phone` directly |
| RLS blocked anon access | RLS allows anon read/write |

---

## 📊 Tables Created

- `subscription_packages` - Package options
- `customer_subscriptions` - Active subscriptions
- `subscription_payments` - Payment history
- `subscription_requests` - Pending approvals
- `payments` - Payment records
- `profiles` - Customer info

---

## 🧪 Verify System

Open: `project/crm/system-diagnostics.html`

---

## 🐛 Troubleshooting

If error in F12 Console:
- "Could not find table" → Re-run SQL (Step 1)
- "RLS policy violation" → Re-run SQL
- "column not found" → Re-run SQL

**→ Go back to Step 1 and run SQL again**

---

**Status:** ✅ READY


## 5-Step Fix

### 1️⃣ Google Cloud Console (5 min)
```
APIs & Services → Credentials
→ Service Account → Credentials tab
→ Enable Domain-wide Delegation
→ Copy Client ID
```

### 2️⃣ Workspace Admin (5 min)
```
Security → API Controls → Domain-wide Delegation
→ Add new
→ Paste Client ID
→ Scopes: drive, drive.file, spreadsheets
→ Authorize
```

### 3️⃣ Backend .env (30 sec)
```env
GOOGLE_IMPERSONATE_EMAIL=driver@yourdomain.com
```
⚠️ MUST be real user, NOT service account!

### 4️⃣ Validate (1 min)
```bash
node backend/validate-drive-quota.js
```
Should show all ✅

### 5️⃣ Test (5 min)
```bash
npm run dev
# Try uploading an image
```

---

## Key Points

✅ **DO:**
- Use real user email (driver@yourdomain.com)
- Enable domain-wide delegation
- Authorize all 3 scopes
- Set GOOGLE_IMPERSONATE_EMAIL

❌ **DON'T:**
- Use service account email for GOOGLE_IMPERSONATE_EMAIL
- Skip domain-wide delegation
- Forget to authorize scopes

---

## Success Looks Like
```
✅ Google Drive authenticated successfully
✅ Uploaded to Drive: photo.jpg → FILE_ID
```

## Failure Looks Like
```
❌ Service Accounts do not have storage quota
```
→ Run: `node validate-drive-quota.js`

---

## Need Help?
1. Run validator: `node backend/validate-drive-quota.js`
2. Check logs: Look in server output for errors
3. Read guide: [DRIVE_QUOTA_CHECKLIST.md](./backend/DRIVE_QUOTA_CHECKLIST.md)
4. Visual help: [VISUAL_GUIDE.md](./backend/VISUAL_GUIDE.md)

---

## Alternatives
**Shared Drive**: No delegation needed, unlimited storage
→ See: [DRIVE_QUOTA_FIX.md](./backend/DRIVE_QUOTA_FIX.md#alternative-shared-drives-only-no-oauth)

---

## Files Updated
- ✅ server.js (code change - minimal)
- ✅ .env.example (config update)
- ✅ README.md (documentation)

## Documentation
- 📖 [DRIVE_QUOTA_FIX.md](./backend/DRIVE_QUOTA_FIX.md) - Complete guide
- ✓️ [DRIVE_QUOTA_CHECKLIST.md](./backend/DRIVE_QUOTA_CHECKLIST.md) - Checklist
- 📊 [VISUAL_GUIDE.md](./backend/VISUAL_GUIDE.md) - Diagrams
- ⚡ [QUICK_REFERENCE.txt](./backend/QUICK_REFERENCE.txt) - Reference
- 🔍 [validate-drive-quota.js](./backend/validate-drive-quota.js) - Validator

---

## Time Estimate
Google Cloud: 5 min → Workspace Admin: 5 min → Config: 2 min → Validate: 1 min → Test: 5 min = **18 min total**

---

## Bottom Line
OAuth domain-wide delegation lets your service account impersonate a user with storage quota.
- ✅ Already implemented in code
- ✅ Just needs configuration
- ✅ Takes ~20 minutes
- ✅ Fixes the quota error

**Start with [DRIVE_QUOTA_CHECKLIST.md](./backend/DRIVE_QUOTA_CHECKLIST.md)** 👈

---

*For complete details, see [SOLUTION_SUMMARY.md](./SOLUTION_SUMMARY.md)*
