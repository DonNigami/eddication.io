# DriverConnect Backend - Node.js Edition

Convert your DriverConnect backend from Google Apps Script to a standalone Node.js/Express server that still uses Google Sheets for data storage.

## Features

- ✅ Drop-in replacement for Google Apps Script backend
- ✅ Google Sheets API integration (read/write)
- ✅ Image upload support (alcohol check, POD, SOS)
- ✅ CORS-enabled for GitHub Pages frontend
- ✅ Deployable on Railway, Heroku, GitHub Codespaces, or self-hosted
- ✅ Environment-based configuration
- ✅ Error handling and logging
- ✅ Offline queue support (on client side)

## Architecture

```
Frontend (GitHub Pages)
      ↓ HTTP Requests
Node.js Express Server
      ↓ API calls
Google Sheets API
      ↓
Google Sheets (Data storage)
```

## Prerequisites

- Node.js 18+ 
- Google Service Account credentials (for Google Sheets API access)
- A Google Sheet with proper structure
- GitHub repository for deployment

## Setup

### 1. Create Google Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google Sheets API and Google Drive API
4. Create a Service Account:
   - Go to "Service Accounts"
   - Click "Create Service Account"
   - Fill in details and create
5. Add a JSON key:
   - Select the service account
   - Go to "Keys" tab
   - Click "Add Key" → "Create new key" → JSON
   - Download and save as `google-credentials.json`

### 2. Share Google Sheet with Service Account

1. Get the Service Account email from the JSON key file (looks like `xxx@xxx.iam.gserviceaccount.com`)
2. Open your Google Sheet
3. Click "Share" and add the service account email with Editor access

### 3. Get Spreadsheet ID

1. Open your Google Sheet
2. Copy the ID from the URL: `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`

### 4. Setup Backend Environment

```bash
# Clone or navigate to backend directory
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env with your values
# - GOOGLE_SHEETS_ID: Your spreadsheet ID
# - GOOGLE_SHEETS_CREDENTIALS_JSON: Content of google-credentials.json (or use GOOGLE_SHEETS_KEY_FILE)
# - CORS_ORIGIN: Your frontend URL(s)
```

### 5. Create Google Sheet Structure

Your Google Sheet should have these sheets (tabs):

- **Jobs**: Reference, Shipment, Destination, Status, etc.
- **Stops**: Reference, Seq, Destination, CheckInTime, CheckOutTime, CheckInOdo, Distance, etc.
- **Alcohol**: Timestamp, UserId, Reference, DriverName, Result, ImageUrl
- **Awareness**: Timestamp, UserId, Reference, Acknowledged
- **POD**: Timestamp, UserId, Reference, ShipmentNo, Status, ImageUrl
- **SOS**: Timestamp, UserId, Type, Description, Lat, Lng, ImageUrl
- **EndTrip**: Timestamp, UserId, Reference, EndOdo, EndPointName, Lat, Lng, Accuracy
- **MissingSteps**: Timestamp, UserId, Reference, Data, Lat, Lng

## Local Development

```bash
# Development mode (with nodemon)
npm run dev

# Production mode
npm start

# Server runs on http://localhost:3000
```

## Deployment Options

### Option 1: Railway.app (Recommended - 5 min setup)

1. Push code to GitHub
2. Go to [Railway.app](https://railway.app)
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Add environment variables:
   - `GOOGLE_SHEETS_ID`
   - `GOOGLE_SHEETS_CREDENTIALS_JSON` (paste entire JSON file content)
   - `CORS_ORIGIN` (your frontend URL)
   - `PORT` (Railway will assign)
6. Deploy

Railway provides:
- Free tier ($5/month credit)
- Automatic deployments on git push
- Automatic HTTPS
- Custom domain support

### Option 2: Heroku

1. Install [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
2. Create app: `heroku create your-app-name`
3. Set config vars:
   ```bash
   heroku config:set GOOGLE_SHEETS_ID=...
   heroku config:set GOOGLE_SHEETS_CREDENTIALS_JSON='...'
   heroku config:set CORS_ORIGIN=your-frontend-url
   ```
4. Deploy: `git push heroku main`

### Option 3: GitHub Codespaces (Testing)

```bash
# In GitHub Codespaces terminal
npm install
npm run dev

# Codespaces will provide a public URL
```

### Option 4: Self-Hosted (VPS, Docker, etc.)

```bash
# On your server
git clone your-repo
cd backend
npm install
export GOOGLE_SHEETS_ID=...
export GOOGLE_SHEETS_CREDENTIALS_JSON='...'
npm start

# Or use PM2 for process management
npm install -g pm2
pm2 start server.js
pm2 save
pm2 startup
```

## Environment Variables

```env
# Required
GOOGLE_SHEETS_ID=your_spreadsheet_id_here
GOOGLE_SHEETS_CREDENTIALS_JSON={"type":"service_account",...}
# OR
GOOGLE_SHEETS_KEY_FILE=./google-credentials.json

# Optional
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://yourdomain.com,http://localhost:8000
DATA_DIR=./data
BACKEND_URL=https://your-backend-url.com
```

## API Endpoints

### Search Job
```
GET /?action=search&keyword=REF001&userId=user123
Response: { success, data: { job, stops } }
```

### Update Stop Status
```
POST /api/updateStop
Body: { rowIndex, status, type, userId, lat, lng, odo }
Response: { success, data: { stop } }
```

### Upload Alcohol Check
```
POST /api/uploadAlcohol (multipart/form-data)
Fields: driverName, result, timestamp, userId, reference, image
Response: { success, data: { checkedDrivers } }
```

### Save Awareness
```
POST /api/saveAwareness
Body: { userId, reference, timestamp, acknowledged }
Response: { success }
```

### Upload POD
```
POST /api/uploadPOD (multipart/form-data)
Fields: rowIndex, shipmentNo, userId, reference, timestamp, image
Response: { success }
```

### Emergency SOS
```
POST /api/emergencySOS (multipart/form-data)
Fields: type, description, userId, lat, lng, timestamp, image
Response: { success }
```

### End Trip
```
POST /api/endTrip
Body: { reference, userId, endOdo, endPointName, lat, lng, accuracy, timestamp }
Response: { success }
```

### Close Job
```
GET /?action=closeJob&reference=REF001&userId=user123
Response: { success }
```

## Update Frontend

Update `config.js` to point to your new backend:

```javascript
window.CONSTANTS = {
  API: {
    LIFF_ID: '1234567890-abcdef',
    // Old: WEB_APP_URL: 'https://script.google.com/macros/...',
    // New:
    WEB_APP_URL: 'https://your-backend-url.railway.app',
    // For local development:
    // WEB_APP_URL: 'http://localhost:3000',
    ...
  }
};
```

## Troubleshooting

### "Google Sheets not authorized"
- Verify service account email is shared with Google Sheet
- Check credentials JSON is valid and complete
- Ensure Google Sheets API is enabled in Cloud Console

### "CORS error"
- Add your frontend URL to `CORS_ORIGIN` environment variable
- Use comma-separated list for multiple origins

### "Sheet not found"
- Verify sheet names match exactly (case-sensitive)
- Check that all required sheets exist in Google Sheet

### "Cannot connect to Google Sheets"
- Verify internet connection
- Check `GOOGLE_SHEETS_ID` is correct
- Verify `GOOGLE_SHEETS_CREDENTIALS_JSON` is complete

## Performance Tips

1. **Image Compression**: Frontend already compresses images before upload
2. **Caching**: Add Redis/Memcached for frequently read data (optional)
3. **Rate Limiting**: Add `express-rate-limit` to prevent abuse
4. **Logging**: Use Winston or Pino for better logging

## Security Notes

- ✅ Credentials stored in environment variables (not in code)
- ✅ CORS restricted to allowed origins only
- ✅ File uploads validated
- ⚠️  Add authentication (JWT/OAuth) if needed
- ⚠️  Add rate limiting for production

## Monitoring

Add monitoring to your deployment:
- **Railway**: Built-in logs and monitoring
- **Heroku**: Use Papertrail add-on for logs
- **Self-hosted**: Use PM2 Plus or similar

## Next Steps

1. **Setup Service Account** (if not done)
2. **Create Google Sheet** with proper structure
3. **Deploy Backend** using Railway or Heroku
4. **Update Frontend** config.js with backend URL
5. **Test** a complete workflow (search → check-in → check-out)

## Support

For issues:
1. Check logs: `npm run dev` locally or check deployment logs
2. Verify Google Sheets API access
3. Check environment variables are set correctly
4. Verify service account has Editor access to sheet

---

**Created**: 2025-12-28  
**Tested with**: Node.js 18+, Express 4.18+, Google Sheets API v4
