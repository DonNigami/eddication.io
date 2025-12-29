# 🚀 QUICK START CARD

## The Problem
```
Service Account (no quota) → Google Drive ❌
```

## The Solution
```
Service Account → Impersonate User (has quota) → Google Drive ✅
```

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
