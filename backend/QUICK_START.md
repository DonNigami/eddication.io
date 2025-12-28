# DriverConnect Backend - Quick Start Guide

## 1. Setup Service Account (5 min)

**Goal**: Get credentials to access Google Sheets

### Steps:
1. Visit: https://console.cloud.google.com/iam-admin/serviceaccounts
2. Click **"Create Service Account"**
3. Fill in name: `driverconnect-backend`
4. Click **"Create and Continue"**
5. Skip "Grant this service account access to project" (click Continue)
6. Go to **"Keys"** tab
7. Click **"Add Key"** → **"Create new key"** → **"JSON"**
8. Save file as `google-credentials.json`

## 2. Share Google Sheet (2 min)

**Goal**: Give service account permission to read/write your sheet

### Steps:
1. Open `google-credentials.json`
2. Copy the `"client_email"` value
3. Open your Google Sheet
4. Click **"Share"** button
5. Paste email and select **"Editor"**
6. Click **"Share"**

## 3. Deploy to Railway (5 min) - RECOMMENDED

### Steps:
1. Go to https://railway.app
2. Click **"Start a New Project"**
3. Select **"Deploy from GitHub repo"**
4. Connect your GitHub account and select your repo
5. Click **"Add Service"** → **"GitHub Repo**"
6. Once the project is created, go to **"Variables"**
7. Add these variables:
   ```
   GOOGLE_SHEETS_ID = [your-spreadsheet-id]
   GOOGLE_SHEETS_CREDENTIALS_JSON = [entire content of google-credentials.json]
   CORS_ORIGIN = [your-frontend-url]
   NODE_ENV = production
   ```
8. Deploy automatically triggers on git push!

**Your backend URL**: `https://[project-name].up.railway.app`

## 4. Update Frontend (1 min)

Edit `PTGLG/driverconnect/driverapp/config.js`:

```javascript
window.CONSTANTS = {
  API: {
    LIFF_ID: '...',
    WEB_APP_URL: 'https://your-railway-url-here',  // ← Change this
    ...
  }
};
```

Then commit and push!

## 5. Test It

1. Visit your frontend
2. Search for a job
3. Check the browser console (F12) - should see successful API calls
4. On backend logs, should see: `[timestamp] GET /?action=search...`

---

## If you get errors:

| Error | Solution |
|-------|----------|
| "Service account email not authorized" | Verify you shared the sheet with the service account email |
| "CORS error" | Add your frontend URL to CORS_ORIGIN in Railway |
| "Spreadsheet not found" | Copy exact spreadsheet ID (the long ID in the sheet URL) |
| "Invalid JSON credentials" | Paste the ENTIRE content of google-credentials.json |

---

## Need help?

1. Check Railway logs: Project → Deployments → View logs
2. Check frontend console: Right-click → Inspect → Console tab
3. Visit README.md in `/backend` folder for detailed setup
