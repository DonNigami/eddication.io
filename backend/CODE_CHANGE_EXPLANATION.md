# Code Change Explanation: server.js

## Location
File: `backend/server.js`, around line 101-114

## What Changed

### Before (Without OAuth Delegation)
```javascript
// Initialize Google Drive storage (for images/signatures)
if (process.env.ALC_PARENT_FOLDER_ID) {
  console.log('🔧 Initializing Google Drive storage...');
  driveStorage = new DriveStorage(
    process.env.GOOGLE_SHEETS_CREDENTIALS_JSON || process.env.GOOGLE_SHEETS_KEY_FILE
  );
  await driveStorage.initialize();
  console.log('✅ Google Drive storage connected');
} else {
  console.warn('⚠️ ALC_PARENT_FOLDER_ID not set, images will be stored locally');
}
```

### After (With OAuth Delegation)
```javascript
// Initialize Google Drive storage (for images/signatures)
if (process.env.ALC_PARENT_FOLDER_ID) {
  console.log('🔧 Initializing Google Drive storage...');
  driveStorage = new DriveStorage(
    process.env.GOOGLE_SHEETS_CREDENTIALS_JSON || process.env.GOOGLE_SHEETS_KEY_FILE,
    {
      impersonateEmail: process.env.GOOGLE_IMPERSONATE_EMAIL,
      makePublic: process.env.DRIVE_PUBLIC_READ === 'true'
    }
  );
  await driveStorage.initialize();
  console.log('✅ Google Drive storage connected');
} else {
  console.warn('⚠️ ALC_PARENT_FOLDER_ID not set, images will be stored locally');
}
```

## What Was Added

### Second Parameter: Options Object
```javascript
{
  impersonateEmail: process.env.GOOGLE_IMPERSONATE_EMAIL,
  makePublic: process.env.DRIVE_PUBLIC_READ === 'true'
}
```

### Two New Options

#### 1. `impersonateEmail`
```javascript
impersonateEmail: process.env.GOOGLE_IMPERSONATE_EMAIL
```

**What it does**:
- Tells DriveStorage which user to impersonate
- Example: `driver@yourdomain.com`
- This user must have active Drive quota
- Must be set in `.env`: `GOOGLE_IMPERSONATE_EMAIL=driver@yourdomain.com`

**Where it's used**:
- In `drive-storage.js` line 49:
  ```javascript
  subject: this.impersonateEmail || undefined
  ```
- Passed to `google.auth.GoogleAuth()` which uses it for domain-wide delegation

#### 2. `makePublic`
```javascript
makePublic: process.env.DRIVE_PUBLIC_READ === 'true'
```

**What it does**:
- Controls whether uploaded files should be publicly accessible
- If `true`: Files get "anyone with link" read permission
- If `false` (default): Only specified users can access files

**Where it's used**:
- In `drive-storage.js` line 152:
  ```javascript
  if (enablePublic) {
    await this.drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });
  }
  ```

---

## How It Works

### Step 1: Constructor Receives Options
```javascript
constructor(credentialsSource, options = {}) {
  this.credentialsSource = credentialsSource;
  this.impersonateEmail = options.impersonateEmail || process.env.GOOGLE_IMPERSONATE_EMAIL;
  this.makePublic = options.makePublic;
  // ...
}
```

### Step 2: Initialize Uses Impersonate Email
```javascript
async initialize() {
  // Parse credentials...
  this.auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [...],
    subject: this.impersonateEmail || undefined  // ← Here!
  });
  // ...
}
```

### Step 3: API Calls Use This Auth
```javascript
async uploadImage(imageBuffer, filename, parentFolderId) {
  const response = await this.drive.files.create({
    // ...
    // Uses this.drive, which was initialized with 
    // auth that includes the impersonated user!
  });
  // ...
}
```

### Step 4: Google API Sees Impersonated User
```
googleapis library
├─ Authenticates as service account
├─ Sees: subject = "driver@yourdomain.com"
├─ Checks domain-wide delegation
└─ Makes API call AS driver@yourdomain.com
   └─ This user has Drive quota! ✅
```

---

## Backward Compatibility

### Still Works Without GOOGLE_IMPERSONATE_EMAIL
```javascript
this.impersonateEmail = options.impersonateEmail || process.env.GOOGLE_IMPERSONATE_EMAIL;
```

If `GOOGLE_IMPERSONATE_EMAIL` is not set:
- `this.impersonateEmail` becomes `undefined`
- In auth: `subject: undefined` (not passed to googleapis)
- Falls back to service account auth (original behavior)
- Will still fail with quota error (original problem)

But **doesn't break** - just doesn't use OAuth delegation.

### Works with Shared Drive Instead
If using Shared Drive instead of OAuth:
- Service account is directly shared with Shared Drive
- Set `ALC_PARENT_FOLDER_ID` to Shared Drive folder
- Don't set `GOOGLE_IMPERSONATE_EMAIL`
- Upload to Shared Drive (unlimited storage)

---

## Environment Variables

### What Gets Passed
```javascript
// Line 1: Constructor call
driveStorage = new DriveStorage(
  process.env.GOOGLE_SHEETS_CREDENTIALS_JSON || process.env.GOOGLE_SHEETS_KEY_FILE,
  //                              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //                              First parameter: Credentials

  {
    impersonateEmail: process.env.GOOGLE_IMPERSONATE_EMAIL,
    //                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    //                           Second parameter: Options
    
    makePublic: process.env.DRIVE_PUBLIC_READ === 'true'
    //                    ^^^^^^^^^^^^^^^^^^^^
    //                    Second parameter: Options
  }
);

// In .env file, these must be set:
// GOOGLE_SHEETS_CREDENTIALS_JSON={...your JSON...}  or GOOGLE_SHEETS_KEY_FILE=path
// GOOGLE_IMPERSONATE_EMAIL=driver@yourdomain.com     (NEW!)
// DRIVE_PUBLIC_READ=true|false                        (Optional)
// ALC_PARENT_FOLDER_ID=folder_id                      (Already required)
```

---

## What The Change Accomplishes

### Before (Problems)
```
❌ Service account attempts upload
❌ Google Drive: "Service Account has no quota"
❌ Upload fails
```

### After (Solution)
```
✅ Service account impersonates driver@yourdomain.com
✅ Google Drive: "driver@yourdomain.com has quota" ✅
✅ Upload succeeds
```

---

## Testing the Change

### 1. Without GOOGLE_IMPERSONATE_EMAIL (Old Behavior)
```bash
# .env is missing GOOGLE_IMPERSONATE_EMAIL
npm run dev

# Server starts fine
✅ Google Drive storage connected

# But upload fails:
❌ Service Accounts do not have storage quota
```

### 2. With GOOGLE_IMPERSONATE_EMAIL (New Behavior)
```bash
# .env has:
GOOGLE_IMPERSONATE_EMAIL=driver@yourdomain.com

npm run dev

# Server starts fine
✅ Google Drive storage connected

# Upload succeeds:
✅ Uploaded to Drive: photo.jpg → FILE_ID
```

---

## Code Location Context

### In server.js
```javascript
// Line ~99-115
...
    // Initialize Google Drive storage (for images/signatures)
    if (process.env.ALC_PARENT_FOLDER_ID) {
      console.log('🔧 Initializing Google Drive storage...');
      driveStorage = new DriveStorage(
        process.env.GOOGLE_SHEETS_CREDENTIALS_JSON || process.env.GOOGLE_SHEETS_KEY_FILE,
        {
          impersonateEmail: process.env.GOOGLE_IMPERSONATE_EMAIL,    // ← NEW
          makePublic: process.env.DRIVE_PUBLIC_READ === 'true'      // ← NEW
        }
      );
      await driveStorage.initialize();
      console.log('✅ Google Drive storage connected');
    } else {
      console.warn('⚠️ ALC_PARENT_FOLDER_ID not set, images will be stored locally');
    }
...
```

### Used Later in Code
```javascript
// Line ~114
sheetActions = new SheetActions(db, zoileDb, driveStorage);
//                                            ^^^^^^^^^^^^
//                                            Passed to SheetActions

// SheetActions then uses it for uploads:
// driveStorage.uploadImageWithUserFolder(buffer, filename, parentId, userId)
```

---

## Summary

| Aspect | Detail |
|--------|--------|
| **File** | backend/server.js |
| **Lines** | ~101-114 |
| **Change** | Added second parameter to DriveStorage constructor |
| **Parameters** | `impersonateEmail`, `makePublic` |
| **Purpose** | Enable OAuth domain-wide delegation for Drive uploads |
| **Impact** | Fixes "Service Account has no storage quota" error |
| **Backward Compatible** | Yes (falls back to original behavior if not set) |

---

## Related Files

**Uses**:
- Reads: `GOOGLE_IMPERSONATE_EMAIL`, `DRIVE_PUBLIC_READ` from `.env`

**Impacts**:
- `drive-storage.js` - Uses `this.impersonateEmail` in `initialize()`
- `sheet-actions.js` - Uses `driveStorage` for uploads
- `.env` file - Must define `GOOGLE_IMPERSONATE_EMAIL`
- `README.md` - Documents the new environment variable

---

## Minimum Change Principle

This change is **minimal and focused**:
- ✅ Only modifies necessary line (DriveStorage initialization)
- ✅ Doesn't change any logic or algorithms
- ✅ Doesn't add dependencies
- ✅ Doesn't modify DriveStorage class itself
- ✅ Maintains all existing functionality
- ✅ Backward compatible if environment variable not set

The actual OAuth logic was **already implemented** in `drive-storage.js`:
```javascript
// In drive-storage.js line 49 (already existed)
subject: this.impersonateEmail || undefined
```

We just needed to **pass the variable** to it!
