# Visual Guide: Drive Upload Quota Fix

## Problem Visualization

```
┌─────────────────────────────────────────────────────────────┐
│                    Your App (Backend)                       │
│                                                             │
│  Uploads image to Google Drive                             │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────────┐
│              Service Account                                │
│  (my-app@my-project.iam.gserviceaccount.com)              │
│                                                             │
│  ⚠️  NO STORAGE QUOTA ⚠️                                    │
│                                                             │
│  Google Drive rejects upload:                             │
│  "Service Accounts do not have storage quota"             │
└─────────────────────────────────────────────────────────────┘

❌ UPLOAD FAILS
```

---

## Solution 1: OAuth Domain-Wide Delegation

```
┌─────────────────────────────────────────────────────────────┐
│                    Your App (Backend)                       │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ Upload Image
                  ↓
┌─────────────────────────────────────────────────────────────┐
│              Service Account                                │
│  (my-app@my-project.iam.gserviceaccount.com)              │
│                                                             │
│  Has domain-wide delegation enabled                       │
│  Can impersonate other users                              │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ Impersonate:
                  │ GOOGLE_IMPERSONATE_EMAIL=driver@yourdomain.com
                  ↓
┌─────────────────────────────────────────────────────────────┐
│              Real Workspace User                            │
│  (driver@yourdomain.com)                                   │
│                                                             │
│  ✅ HAS STORAGE QUOTA ✅                                    │
│                                                             │
│  Performs upload as this user                             │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────────┐
│                  Google Drive                               │
│                                                             │
│  "You're driver@yourdomain.com? You have quota! ✅"       │
│                                                             │
│  ✅ UPLOAD SUCCEEDS ✅                                      │
└─────────────────────────────────────────────────────────────┘
```

### Setup Diagram

```
Step 1: Google Cloud Console
┌─────────────────────────────────────────┐
│ Service Account                         │
│ └─ Enable Domain-Wide Delegation       │
│    └─ Get Client ID                    │
└─────────────────────────────────────────┘

Step 2: Workspace Admin Console
┌─────────────────────────────────────────┐
│ Security → API Controls                │
│ └─ Paste Client ID                     │
│    └─ Authorize Drive Scopes           │
└─────────────────────────────────────────┘

Step 3: Backend Configuration
┌─────────────────────────────────────────┐
│ .env file                               │
│ GOOGLE_IMPERSONATE_EMAIL=driver@yourdomain.com │
└─────────────────────────────────────────┘

Step 4: Backend Code
┌─────────────────────────────────────────┐
│ server.js                               │
│ └─ Pass impersonateEmail to DriveStorage│
│    └─ Already implemented in code! ✅  │
└─────────────────────────────────────────┘

Step 5: Verify & Test
┌─────────────────────────────────────────┐
│ Run: node validate-drive-quota.js       │
│ Start: npm run dev                      │
│ Test: Upload an image                   │
└─────────────────────────────────────────┘
```

---

## Solution 2: Shared Drive (Alternative)

```
┌─────────────────────────────────────────────────────────────┐
│                    Your App (Backend)                       │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ Upload Image
                  ↓
┌─────────────────────────────────────────────────────────────┐
│              Service Account                                │
│  (my-app@my-project.iam.gserviceaccount.com)              │
│                                                             │
│  Shared with Shared Drive                                 │
│  NO impersonation needed                                   │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────────┐
│              Shared Drive                                   │
│  (Team/Organization Storage)                               │
│                                                             │
│  ✅ UNLIMITED STORAGE ✅                                    │
│  Not counted against individual quotas                     │
│                                                             │
│  ✅ UPLOAD SUCCEEDS ✅                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Configuration Comparison

### ❌ Wrong Configuration

```env
GOOGLE_IMPERSONATE_EMAIL=my-app@my-project.iam.gserviceaccount.com
                         ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑
                         SERVICE ACCOUNT ❌
                         Still no quota!
```

### ✅ Correct Configuration (Option A - OAuth)

```env
GOOGLE_IMPERSONATE_EMAIL=driver@yourdomain.com
                         ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑
                         REAL USER ✅
                         Has quota!
```

### ✅ Correct Configuration (Option B - Shared Drive)

```env
ALC_PARENT_FOLDER_ID=1a2b3c4d5e6f7g8h9i
GOOGLE_IMPERSONATE_EMAIL=  # Leave empty or remove
```

---

## Authentication Flow

### Option A: OAuth Domain-Wide Delegation

```
┌─ googleapis library
│  ├─ Service Account Key (from google-credentials.json)
│  └─ subject: driver@yourdomain.com (impersonate this user)
│
└─ googleapis.auth.GoogleAuth()
   ├─ Authenticates as service account
   ├─ Checks: domain-wide delegation enabled? ✅
   ├─ Checks: scopes authorized in Workspace? ✅
   └─ Returns auth token AS: driver@yourdomain.com
      └─ This user has Drive quota! ✅
```

### Option B: Direct Shared Drive Access

```
┌─ googleapis library
│  ├─ Service Account Key (from google-credentials.json)
│  └─ subject: (undefined - no impersonation)
│
└─ googleapis.auth.GoogleAuth()
   ├─ Authenticates as service account
   └─ Accesses Shared Drive directly
      └─ Shared Drive has unlimited storage! ✅
```

---

## Error Diagnosis Tree

```
Error: "Service Accounts do not have storage quota"
│
├─ Is GOOGLE_IMPERSONATE_EMAIL set?
│  ├─ NO → Set it to a real user email
│  └─ YES → Continue
│
├─ Is it a real user email (not service account)?
│  ├─ NO (ends in iam.gserviceaccount.com) → Change to real user
│  └─ YES → Continue
│
├─ Is domain-wide delegation enabled?
│  ├─ NO → Enable in Google Cloud Console
│  └─ YES → Continue
│
├─ Are Drive scopes authorized?
│  ├─ NO → Authorize in Workspace Admin Console
│  └─ YES → Continue
│
├─ Does the user exist?
│  ├─ NO → Create user in Workspace
│  └─ YES → Continue
│
└─ SUCCESS! ✅
```

---

## File Upload Process (With Fix)

```
User takes photo in app
    │
    ↓
Frontend: canvas.toBlob() → base64 string
    │
    ↓
POST /api/updateStop
│   ├─ Base64 image data
│   ├─ userId: "DRIVER001"
│   └─ reference: "JOB123"
    │
    ↓
Backend: server.js
│   ├─ Decode base64 → buffer
│   └─ Check: ALC_PARENT_FOLDER_ID set?
    │
    ├─ YES → Use DriveStorage
    │   └─ DriveStorage.uploadImageWithUserFolder(buffer, filename, parentId, userId)
    │       │
    │       ├─ getOrCreateFolder("DRIVER001", parentId)
    │       │   └─ API Call (as driver@yourdomain.com via OAuth) ✅
    │       │
    │       └─ uploadImage(buffer, filename, userFolderId)
    │           └─ API Call (as driver@yourdomain.com via OAuth) ✅
    │               └─ File saved: https://drive.google.com/file/d/FILE_ID/view
    │
    └─ NO → Use ImageStorage (local disk)
        └─ Save to ./data/photo_timestamp.jpg
            └─ File saved: /images/photo_timestamp.jpg

Return to frontend
    ├─ fileId: "FILE_ID"
    ├─ fileUrl: "https://drive.google.com/file/d/FILE_ID/view"
    └─ Success! ✅
```

---

## Key Concepts

### Service Account ❌
- Google Cloud project service account
- Email: `xxxx@your-project.iam.gserviceaccount.com`
- NO personal storage quota
- Used for backend authentication
- **Cannot** directly upload to Drive

### Real User ✅
- Workspace user account
- Email: `driver@yourdomain.com`
- HAS personal storage quota
- Registered in Workspace Admin
- **Can** upload to Drive

### Domain-Wide Delegation
- Allows service account to impersonate users
- Service account "becomes" the user for API calls
- Must be:
  1. Enabled in Cloud Console (on service account)
  2. Authorized in Workspace Admin (grant scopes to service account)
  3. Implemented in code (pass `subject` parameter)

### Shared Drive
- Team/organization storage
- Unlimited storage (no per-user quota)
- Doesn't require domain-wide delegation
- Service account accesses it directly
- All files belong to the team, not individual users

---

## Summary Table

| Aspect | OAuth Delegation | Shared Drive |
|--------|------------------|--------------|
| **Setup Complexity** | Medium (3 steps) | Simple (2 steps) |
| **Storage Quota** | User's quota used | Unlimited (team) |
| **File Ownership** | User's Drive | Team's Drive |
| **Service Account** | Must have delegation | Direct access |
| **Domain-Wide Delegation** | ✅ Required | ❌ Not needed |
| **When to Use** | Individual user tracking | Team collaboration |

---

## Recommended Approach

```
For eddication.io (Driver App):

Use OAuth Delegation ✅
├─ Track which driver uploaded which image
├─ Files go to individual driver's Drive
├─ Can see upload history per driver
└─ Works with existing infrastructure
```

Or if you prefer simplicity:

```
Use Shared Drive ✅
├─ All uploads in one team Drive
├─ No individual quota limits
├─ Simpler setup (no domain-wide delegation)
└─ Less per-driver tracking (but still possible)
```
