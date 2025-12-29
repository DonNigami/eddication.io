# SOLUTION IMPLEMENTED: Google Drive Upload Quota Fix

## Problem Summary
You received an error when trying to upload files to Google Drive:
```
Service Accounts do not have storage quota. Leverage shared drives or use OAuth delegation instead.
```

This happens because **Service Accounts in Google Workspace don't have personal storage quota**.

---

## Solution Implemented: OAuth Domain-Wide Delegation

Your codebase already had partial support for this! I've now:

### 1. ✅ Updated Code Files

**[server.js](./server.js)** - Now passes OAuth delegation config to DriveStorage:
```javascript
driveStorage = new DriveStorage(
  process.env.GOOGLE_SHEETS_CREDENTIALS_JSON || process.env.GOOGLE_SHEETS_KEY_FILE,
  {
    impersonateEmail: process.env.GOOGLE_IMPERSONATE_EMAIL,  // ← NEW
    makePublic: process.env.DRIVE_PUBLIC_READ === 'true'
  }
);
```

**[drive-storage.js](./lib/drive-storage.js)** - Already supports it via:
```javascript
subject: this.impersonateEmail || undefined // domain-wide delegation
```

### 2. ✅ Created Documentation

| File | Purpose |
|------|---------|
| [DRIVE_QUOTA_FIX.md](./DRIVE_QUOTA_FIX.md) | Complete setup guide |
| [DRIVE_QUOTA_CHECKLIST.md](./DRIVE_QUOTA_CHECKLIST.md) | Step-by-step checklist |
| [validate-drive-quota.js](./validate-drive-quota.js) | Automated config validator |

### 3. ✅ Updated Configuration

**[.env.example](./.env.example)** - Added clear OAuth delegation settings:
```env
GOOGLE_IMPERSONATE_EMAIL=driver@yourdomain.com  # Real user, NOT service account
DRIVE_PUBLIC_READ=true
ALC_PARENT_FOLDER_ID=your_folder_id
```

**[README.md](./README.md)** - Added warning and link to DRIVE_QUOTA_FIX.md

---

## How to Implement (5 Steps)

### 1. Google Cloud Console
- Go to **APIs & Services** → **Credentials**
- Open your service account
- Enable **Domain-wide Delegation**
- Copy the **Client ID**

### 2. Google Workspace Admin
- Go to **Security** → **API Controls** → **Domain-wide Delegation**
- Click **Add new**
- Paste Client ID
- Add OAuth Scopes:
  ```
  https://www.googleapis.com/auth/drive,
  https://www.googleapis.com/auth/drive.file,
  https://www.googleapis.com/auth/spreadsheets
  ```

### 3. Update .env
```env
GOOGLE_IMPERSONATE_EMAIL=driver@yourdomain.com
```
**CRITICAL**: Must be a REAL user, NOT service account email!

### 4. Validate
```bash
node backend/validate-drive-quota.js
```

### 5. Restart
```bash
npm run dev
```

---

## How It Works

```
Your App
  ↓
Service Account (no quota)
  ↓ (impersonates)
User: driver@yourdomain.com (HAS quota)
  ↓
Google Drive ✅ Upload succeeds!
```

---

## Alternative: Shared Drives (No OAuth)

If OAuth delegation is too complex, use **Shared Drives** instead:

1. Create Shared Drive in Google Drive
2. Grant service account access
3. Upload files to Shared Drive (unlimited storage)
4. Set `ALC_PARENT_FOLDER_ID=shared_drive_folder_id`
5. Remove `GOOGLE_IMPERSONATE_EMAIL` from config

Shared Drives have **unlimited storage** and don't use user quotas.

---

## Files Modified

- ✅ [server.js](./server.js) - Pass `impersonateEmail` option
- ✅ [.env.example](./.env.example) - Add OAuth configuration
- ✅ [README.md](./README.md) - Add Drive quota warning

## Files Created

- ✨ [DRIVE_QUOTA_FIX.md](./DRIVE_QUOTA_FIX.md) - Complete guide
- ✨ [DRIVE_QUOTA_CHECKLIST.md](./DRIVE_QUOTA_CHECKLIST.md) - Checklist
- ✨ [validate-drive-quota.js](./validate-drive-quota.js) - Validator script

---

## Next Steps

1. **Read**: [DRIVE_QUOTA_CHECKLIST.md](./DRIVE_QUOTA_CHECKLIST.md)
2. **Follow**: Steps 1-2 in Google Cloud Console and Workspace Admin
3. **Configure**: Set `GOOGLE_IMPERSONATE_EMAIL` in `.env`
4. **Validate**: Run `node validate-drive-quota.js`
5. **Test**: Restart server and try uploading

---

## Need Help?

- See [DRIVE_QUOTA_FIX.md](./DRIVE_QUOTA_FIX.md) for detailed instructions
- Run `node validate-drive-quota.js` to diagnose issues
- Check server logs for "✅ Google Drive authenticated successfully"

---

**Key Point**: The difference between **service account** and **real user**:
- ❌ Service Account: `my-app@my-project.iam.gserviceaccount.com` (NO quota)
- ✅ Real User: `driver@yourdomain.com` (HAS quota)

Your code already supports this - you just need to configure it! 🚀
