# Drive Upload Quota Fix - Troubleshooting Checklist

## 🎯 Quick Fix

Your Google Drive uploads are failing because service accounts **don't have storage quota**. 

**Solution**: Use **OAuth domain-wide delegation** to impersonate a user who DOES have quota.

---

## ✅ Implementation Checklist

### Step 1: Google Cloud Console Setup
- [ ] Go to [console.cloud.google.com](https://console.cloud.google.com)
- [ ] Select your project
- [ ] Click **APIs & Services** → **Credentials**
- [ ] Click your service account name
- [ ] Go to **Credentials** tab (blue area)
- [ ] Scroll to "Domain-wide delegation"
- [ ] Click **Enable domain-wide delegation** (if not already enabled)
- [ ] Copy the **Client ID** shown (looks like a big number)

### Step 2: Google Workspace Admin Console
- [ ] Go to [admin.google.com](https://admin.google.com)
- [ ] Click **Security** → **API Controls** → **Domain-wide Delegation**
- [ ] Click **Add new**
- [ ] Paste your Client ID
- [ ] In **OAuth Scopes**, paste this exactly:
  ```
  https://www.googleapis.com/auth/drive,
  https://www.googleapis.com/auth/drive.file,
  https://www.googleapis.com/auth/spreadsheets
  ```
- [ ] Click **Authorize**

### Step 3: Environment Variables
In your `.env` file:
```env
# Your service account credentials (unchanged)
GOOGLE_SHEETS_CREDENTIALS_JSON={...your existing JSON...}

# Add this: a REAL Workspace user who has Drive quota
GOOGLE_IMPERSONATE_EMAIL=driver@yourdomain.com

# Where to store files (Shared Drive folder ID or personal Drive folder ID)
ALC_PARENT_FOLDER_ID=your_folder_id

# Optional
DRIVE_PUBLIC_READ=true
```

**⚠️ CRITICAL**: 
- `GOOGLE_IMPERSONATE_EMAIL` must be a **real user email** (like `driver@yourdomain.com`)
- It **CANNOT** be a service account email (ending in `iam.gserviceaccount.com`)
- It must be **DIFFERENT** from your service account email

### Step 4: Test Configuration
Run this to verify:
```bash
node backend/validate-drive-quota.js
```

Expected output:
```
✅ Service Account Configured
✅ Impersonate User Set
✅ Impersonate is Real User
✅ Different Email Addresses
```

### Step 5: Restart and Test
```bash
# Kill existing server
npm stop  # or Ctrl+C

# Start with new config
npm run dev

# Try uploading an image
# Should see in logs: "✅ Uploaded to Drive: filename.jpg → FILE_ID"
```

---

## 🔍 Debugging If Still Not Working

### Error: "Service Accounts do not have storage quota"

**Cause**: `GOOGLE_IMPERSONATE_EMAIL` not set or domain-wide delegation not enabled

**Fix**:
1. Verify `GOOGLE_IMPERSONATE_EMAIL` is in `.env`
2. Run `node validate-drive-quota.js` - it will show what's missing
3. Check Google Cloud Console - is domain-wide delegation enabled?
4. Check Workspace Admin - are the scopes authorized?

### Error: "Permission denied" or "Invalid impersonation"

**Cause**: User doesn't have permission or domain-wide delegation isn't set up right

**Fix**:
1. Is `GOOGLE_IMPERSONATE_EMAIL` a **real user** or a **service account**?
   - Good: `driver@yourdomain.com`
   - Bad: `my-app@my-project.iam.gserviceaccount.com`
2. Does the user exist in Workspace?
3. Did you authorize the scopes in Workspace Admin?

### Files upload but appear empty/broken

**Cause**: User doesn't have permission to the folder

**Fix**:
1. Make sure the folder (in `ALC_PARENT_FOLDER_ID`) exists
2. Give the impersonate user access to that folder
3. Or use a Shared Drive instead (see below)

---

## 🎁 Alternative: Shared Drive (No OAuth Needed)

If domain-wide delegation is too complex, use a **Shared Drive** instead:

1. In Google Drive, click **+ New** → **Shared drive**
2. Name it "eddication-uploads"
3. Get the folder ID from the URL (or right-click → Get link → copy ID part)
4. Share it with your service account email
5. Set in `.env`:
   ```env
   ALC_PARENT_FOLDER_ID=shared_drive_folder_id
   # Don't set GOOGLE_IMPERSONATE_EMAIL
   ```

**Advantages**:
- Unlimited storage (not counted against user quotas)
- No OAuth delegation needed
- Simpler setup

**Disadvantages**:
- Requires creating a Shared Drive
- Need to manage permissions manually

---

## 📞 Support Resources

- [Google Drive Storage Quota](https://support.google.com/a/answer/7281227)
- [Domain-Wide Delegation Setup](https://developers.google.com/identity/protocols/oauth2/service-account#delegating_domain-wide_authority_to_the_service_account)
- [About Shared Drives](https://developers.google.com/workspace/drive/api/guides/about-shareddrives)

---

## 🚀 Verification

After setup, you should see in server logs:

```
🔧 Initializing Google Drive storage...
   🔧 DriveStorage.initialize() starting...
   Parsing credentials...
   ✓ Parsed from JSON string
   Authenticating with Google...
✅ Google Drive authenticated successfully
✅ Google Drive storage connected
```

When uploading:
```
   📤 uploadImage: filename=photo_1234567890.jpg, size=45823 bytes
   Step 1: Get/create user folder...
   📁 getOrCreateFolder: name=user123, parent=FOLDER_ID
   ✅ Found existing folder: user123 → USER_FOLDER_ID
   Step 2: Upload image to user folder...
   ✅ Uploaded to Drive: photo_1234567890.jpg → FILE_ID
```

---

## 📝 Summary

| Component | Required | Value |
|-----------|----------|-------|
| Service Account | Yes | From google-credentials.json |
| Domain-wide Delegation | Yes* | Enabled in Cloud Console |
| OAuth Scopes | Yes* | Authorized in Workspace Admin |
| Impersonate User | Yes* | Real user: driver@yourdomain.com |
| Parent Folder | Recommended | Shared Drive or personal Drive folder ID |

*Only needed if using OAuth delegation. If using Shared Drive, only need service account access to the Shared Drive.

