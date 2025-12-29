# Google Drive Upload Quota Fix

## Problem
Service Accounts in Google Workspace do **not** have personal storage quota. When uploading to Google Drive with a service account, you'll get this error:

```
Service Accounts do not have storage quota. Leverage shared drives 
(https://developers.google.com/workspace/drive/api/guides/about-shareddrives), 
or use OAuth delegation instead.
```

## Solution: Domain-Wide Delegation (OAuth)

The best solution is to use **domain-wide delegation** to impersonate a Workspace user who HAS storage quota. This is already partially implemented in your code.

## Setup Steps

### 1. Enable Domain-Wide Delegation for Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Go to **APIs & Services** → **Credentials**
4. Click on your service account
5. Go to the **Credentials** tab (the blue area showing the JSON key info)
6. Look for **"Domain-wide delegation"** section
7. Click **"Enable domain-wide delegation"** if not already enabled
8. You'll see:
   - **Client ID** (looks like a number)
   - **Client Secret** (if applicable - service accounts use OAuth 2.0 instead)
9. Click **Create OAuth 2.0 Client ID** (or it may already be auto-created)
10. Copy the **Client ID** for the next step

### 2. Grant Drive API Scope to Service Account in Google Workspace

1. Go to [Google Workspace Admin Console](https://admin.google.com)
2. Go to **Security** → **API Controls** → **Domain-wide Delegation**
3. Click **Add new**
4. Paste your service account **Client ID**
5. In **OAuth Scopes**, enter (comma-separated):
   ```
   https://www.googleapis.com/auth/drive,
   https://www.googleapis.com/auth/drive.file,
   https://www.googleapis.com/auth/spreadsheets
   ```
6. Click **Authorize**

### 3. Configure Backend Environment Variables

Update your `.env` file:

```env
# Service Account (from google-credentials.json)
GOOGLE_SHEETS_CREDENTIALS_JSON={...your service account JSON...}

# USER ACCOUNT EMAIL TO IMPERSONATE (has Drive quota)
# This must be a real Workspace user, NOT the service account email
GOOGLE_IMPERSONATE_EMAIL=driver@yourdomain.com

# Optional: Make uploaded files public
DRIVE_PUBLIC_READ=true
```

**IMPORTANT**: `GOOGLE_IMPERSONATE_EMAIL` must be:
- ✅ A real Workspace user email (user@yourdomain.com)
- ❌ NOT the service account email (xxxx@iam.gserviceaccount.com)
- A user who has active Drive quota
- Ideally, a shared admin/service account user dedicated to this app

### 4. Set Parent Folder in Shared Drive (Recommended)

To avoid quota issues entirely, store files in a **Shared Drive** instead of personal Drive:

```env
# Create a Shared Drive, then use its folder ID
ALC_PARENT_FOLDER_ID=YOUR_SHARED_DRIVE_FOLDER_ID

# This works with domain-wide delegation too
GOOGLE_IMPERSONATE_EMAIL=driver@yourdomain.com
```

Shared Drives have **unlimited storage** and don't count against individual user quotas.

### 5. Create Shared Drive (Optional but Recommended)

If using Shared Drives:

1. In Google Drive, click **+ New** → **Shared drive**
2. Give it a name (e.g., "eddication-uploads")
3. Get the folder ID from the URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`
4. Grant the service account access to this folder
5. Set `ALC_PARENT_FOLDER_ID=FOLDER_ID_HERE`

## How It Works

```
Your App (Backend)
    ↓
Service Account (no quota)
    ↓ (domain-wide delegation)
Impersonates: driver@yourdomain.com (HAS quota)
    ↓
Google Drive / Shared Drive ✅ (file upload succeeds)
```

## Environment Variables Reference

```env
# Core Google Sheets
GOOGLE_SHEETS_ID=your_spreadsheet_id
GOOGLE_SHEETS_CREDENTIALS_JSON={...service account JSON...}

# OAuth Delegation (REQUIRED for Drive uploads in Workspace)
GOOGLE_IMPERSONATE_EMAIL=driver@yourdomain.com  # Real user, not service account

# Optional Drive Settings
ALC_PARENT_FOLDER_ID=folder_id_for_uploads
DRIVE_PUBLIC_READ=true  # Make files public (optional)

# Optional Shared Drive (best for avoiding quota issues)
SHARED_DRIVE_ID=shared_drive_folder_id
```

## Troubleshooting

### ❌ Still getting "Service Account has no storage quota"

**Solution**: Check that `GOOGLE_IMPERSONATE_EMAIL` is:
- ✅ Set in `.env`
- ✅ A REAL Workspace user email
- ✅ Different from the service account email
- ✅ Passed to DriveStorage constructor

### ❌ "Permission denied" or "Invalid impersonation"

**Check**:
1. Is domain-wide delegation enabled? (Google Cloud Console)
2. Did you authorize the scopes in Workspace Admin? (API Controls)
3. Does the user account exist and have Drive access?
4. Is the user NOT a service account?

### ❌ Files uploaded but can't access them

**If using Shared Drives**: Make sure the Shared Drive is properly configured and user has access.

**If using personal Drive**: The impersonated user's personal Drive storage is being used.

## Testing

Test your setup:

```bash
# On your backend server
curl -X POST http://localhost:3000/upload-test \
  -H "Content-Type: application/json" \
  -d '{"testFile": "test.jpg"}'

# Should see logs like:
# 🔧 DriveStorage.initialize() starting...
# ✅ Google Drive authenticated successfully
# 📤 uploadImage: filename=test.jpg
# ✅ Uploaded to Drive: test.jpg → FILE_ID
```

## Alternative: Shared Drives Only (No OAuth)

If you don't want to use domain-wide delegation:

1. Create a Shared Drive
2. Create a service account
3. Grant the service account Editor access to the Shared Drive
4. Upload to Shared Drive (no quota issue)
5. Remove `GOOGLE_IMPERSONATE_EMAIL` from config

The code already supports Shared Drives via `supportsAllDrives: true` in the API calls.

## References

- [Google Workspace Domain-wide Delegation](https://developers.google.com/identity/protocols/oauth2/service-account#delegating_domain-wide_authority_to_the_service_account)
- [About Shared Drives](https://developers.google.com/workspace/drive/api/guides/about-shareddrives)
- [Service Account Limitations](https://support.google.com/a/answer/7281227)
