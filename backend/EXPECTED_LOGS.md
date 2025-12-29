# Expected Logs After Fix

## When Starting Server

### ✅ Success Logs (What You Should See)

```
🔧 Initializing database...
✅ Google Sheets connected

🔧 Initializing Google Drive storage...
   🔧 DriveStorage.initialize() starting...
   Parsing credentials...
   ✓ Parsed from JSON string
   Authenticating with Google...
✅ Google Drive authenticated successfully
✅ Google Drive storage connected

🔧 Checking and creating required sheets...
✅ All required sheets exist

🚀 Server running on http://localhost:3000
```

### 🚨 Failure Logs (Problems)

#### Missing GOOGLE_IMPERSONATE_EMAIL
```
✅ Google Drive authenticated successfully
✅ Google Drive storage connected
(But will fail when uploading)
```

#### Domain-Wide Delegation Not Enabled
```
❌ Failed to initialize Google Drive: unauthorized_client
   Error: unauthorized_client: The OAuth client was not recognized 
   as a valid desktop or web application client
```

**Fix**: Enable domain-wide delegation in Google Cloud Console

#### Invalid OAuth Scopes
```
❌ Failed to initialize Google Drive: access_denied
   Error: access_denied: Invalid Oauth scope(s)
```

**Fix**: Authorize scopes in Workspace Admin Console

#### Wrong Email (Service Account Instead of User)
```
✅ Google Drive authenticated successfully (misleading!)
❌ When uploading: Service Accounts do not have storage quota
```

**Fix**: Set `GOOGLE_IMPERSONATE_EMAIL` to a REAL user email

---

## When Uploading an Image

### ✅ Success Logs

```
POST /api/updateStop with image upload
Received image: 45,823 bytes

📤 uploadImageWithUserFolder: filename=photo_1234567890.jpg, 
   parentId=ALC_FOLDER_ID, userId=DRIVER001

   Step 1: Get/create user folder...
   📁 getOrCreateFolder: name=DRIVER001, parent=ALC_FOLDER_ID
   ✅ Found existing folder: DRIVER001 → USER_FOLDER_ID
   ✓ User folder ID: USER_FOLDER_ID

   Step 2: Upload image to user folder...
   📤 uploadImage: filename=photo_1234567890.jpg, size=45823 bytes
   ✅ Uploaded to Drive: photo_1234567890.jpg → FILE_ID
   ✓ File uploaded: FILE_ID

✅ Image saved: Drive URL returned

{
  success: true,
  fileId: "FILE_ID",
  fileUrl: "https://drive.google.com/file/d/FILE_ID/view",
  userFolder: "USER_FOLDER_ID"
}
```

### ❌ Failure Logs

#### No Storage Quota
```
❌ Failed to upload image photo_1234567890.jpg: 
   Error: 403 Forbidden
   Reason: Service Accounts do not have storage quota. 
   Leverage shared drives, or use OAuth delegation instead.
```

**Fix**: Set `GOOGLE_IMPERSONATE_EMAIL` to a user with quota

#### Permission Denied on Folder
```
❌ Failed to get/create folder DRIVER001: 
   Error: 403 Forbidden
   Reason: The user does not have permission to access the file
```

**Fix**: 
- Verify `ALC_PARENT_FOLDER_ID` exists
- Verify the folder is shared with the impersonate user
- Or use a Shared Drive

#### User Not Found
```
❌ Failed to initialize Google Drive: invalid_grant
   Error: Invalid OAuth 2.0 Credentials
```

**Fix**: 
- Verify `GOOGLE_IMPERSONATE_EMAIL` is a valid Workspace user
- Verify the user exists in your domain

#### Domain-Wide Delegation Not Authorized
```
❌ Failed to upload image: 
   Error: 403 Forbidden
   Reason: Access denied. The Workspace domain has restricted...
```

**Fix**: Authorize the service account in Workspace Admin → API Controls

---

## Validation Script Output

### ✅ All Good
```
🔍 Google Drive OAuth Delegation Validator

✓ Check 1: Service Account Credentials
   ✅ Credentials loaded from ./google-credentials.json
   ✅ Valid service account: my-app@my-project.iam.gserviceaccount.com

✓ Check 2: OAuth Delegation User
   ✅ Workspace user set: driver@yourdomain.com

✓ Check 3: Service Account vs Impersonate
   ✅ Service Account and Impersonate User are different
       Service Account: my-app@my-project.iam.gserviceaccount.com
       Impersonate User: driver@yourdomain.com

✓ Check 4: Upload Folder Configuration
   ✅ Parent folder set: FOLDER_ID

============================================================

✅ Configuration looks good!

Next steps:
1. Verify domain-wide delegation is enabled in Google Cloud Console
2. Verify OAuth scopes are authorized in Workspace Admin
3. Test with: npm run dev
4. Try uploading an image
```

### ❌ Configuration Issues
```
✓ Check 1: Service Account Credentials
   ❌ GOOGLE_SHEETS_CREDENTIALS_JSON or GOOGLE_SHEETS_KEY_FILE not set

✓ Check 2: OAuth Delegation User
   ❌ GOOGLE_IMPERSONATE_EMAIL not set
   ℹ️  This is REQUIRED for Google Drive uploads in Workspace

✓ Check 3: Service Account vs Impersonate
   ❌ Service Account and Impersonate User are the SAME
       This won't work - they must be DIFFERENT

============================================================

⚠️  Configuration needs attention

Fix the issues above and run this validator again
```

---

## Checklist for Debugging

When uploads fail, check in this order:

1. **Is GOOGLE_IMPERSONATE_EMAIL set?**
   ```bash
   echo $GOOGLE_IMPERSONATE_EMAIL
   # Should show: driver@yourdomain.com (not empty, not service account email)
   ```

2. **Is domain-wide delegation enabled?**
   - Google Cloud Console → Credentials → Service Account → Credentials tab
   - Should see "Domain-wide delegation" enabled with a Client ID

3. **Are scopes authorized?**
   - Workspace Admin → Security → API Controls → Domain-wide Delegation
   - Service account should be listed with drive/spreadsheets scopes

4. **Is the user real?**
   - Workspace Admin → Users
   - `driver@yourdomain.com` should exist

5. **Is the folder accessible?**
   - Google Drive → Find folder with ID from ALC_PARENT_FOLDER_ID
   - Folder should exist and be shared with the impersonate user

6. **Run validation script**
   ```bash
   node backend/validate-drive-quota.js
   ```

---

## What Success Looks Like

1. Server starts without Drive errors
2. Validator script shows all ✅ 
3. Upload request completes successfully
4. Logs show "✅ Uploaded to Drive: filename → FILE_ID"
5. File appears in Google Drive at the specified location
