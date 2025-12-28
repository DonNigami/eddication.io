/**
 * DriverConnect Backend - Node.js Express Server
 * Replaces Google Apps Script with standalone Node.js backend
 * Integrates with Google Sheets for data persistence
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const { GoogleSheetsDB } = require('./lib/google-sheets');
const { SheetActions } = require('./lib/sheet-actions');
const { ImageStorage } = require('./lib/image-storage');
const { DriveStorage } = require('./lib/drive-storage');
const { ErrorHandler } = require('./lib/error-handler');
const { NotificationService } = require('./lib/notification-service');
const { CustomerContacts } = require('./lib/customer-contacts');
const SHEETS = require('./lib/sheet-names');

// ============================================================================
// Initialize Express App
// ============================================================================
const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Middleware
// Capture raw body to verify LINE webhook signatures
app.use(express.json({
  limit: '50mb',
  verify: (req, res, buf) => {
    try {
      req.rawBody = buf.toString('utf8');
    } catch (_) {
      req.rawBody = '';
    }
  }
}));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
  credentials: true
}));

// Serve saved images (e.g., alcohol/POD/SOS) from DATA_DIR at /images
const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
app.use('/images', express.static(DATA_DIR));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// File upload
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// ============================================================================
// Database Initialization
// ============================================================================
let db = null;
let zoileDb = null;
let driveStorage = null;
let sheetActions = null;
let imageStorage = null;
let notificationService = null;
let customerContacts = null;

async function initializeServices() {
  try {
    console.log('🔧 Initializing Google Sheets connection...');
    db = new GoogleSheetsDB(
      process.env.GOOGLE_SHEETS_ID,
      process.env.GOOGLE_SHEETS_CREDENTIALS_JSON || process.env.GOOGLE_SHEETS_KEY_FILE
    );
    await db.initialize();
    console.log('✅ Google Sheets connected');

    // Initialize Zoile sheet (separate instance)
    if (process.env.ZOILE_SHEET_ID) {
      console.log('🔧 Initializing Zoile30Connect sheet...');
      zoileDb = new GoogleSheetsDB(
        process.env.ZOILE_SHEET_ID,
        process.env.GOOGLE_SHEETS_CREDENTIALS_JSON || process.env.GOOGLE_SHEETS_KEY_FILE
      );
      await zoileDb.initialize();
      console.log('✅ Zoile30Connect sheet connected');
    }

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

    // Auto-create missing sheets
    console.log('🔧 Checking and creating required sheets...');
    await db.initializeRequiredSheets();

    sheetActions = new SheetActions(db, zoileDb, driveStorage);
    imageStorage = new ImageStorage(process.env.DATA_DIR || './data');
    notificationService = new NotificationService();
    customerContacts = new CustomerContacts(db);
    
    console.log('✅ Services initialized');
  } catch (err) {
    console.error('❌ Failed to initialize services:', err.message);
    process.exit(1);
  }
}

// ============================================================================
// Health Check
// ============================================================================
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    backend: 'driverconnect-nodejs'
  });
});

app.get('/ping', (req, res) => {
  res.send('pong');
});

/**
 * DEBUG: Force create/ensure all sheets
 * GET /api/debug/ensure-sheets
 */
app.get('/api/debug/ensure-sheets', async (req, res) => {
  try {
    console.log('🔧 Forcing sheet creation...');
    await db.initializeRequiredSheets();
    console.log('✅ All sheets ensured');
    
    // Also ensure alcoholcheck specifically
    const created = await db.ensureSheet('alcoholcheck', [
      'timestamp',
      'userId',
      'reference',
      'driverName',
      'result',
      'lat',
      'lng',
      'accuracy',
      'imageUrl'
    ]);
    
    return res.json({ 
      success: true, 
      message: 'All sheets ensured',
      alcoholcheckCreated: created,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ Ensure sheets error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================================================
// DEBUG Endpoints (development troubleshooting)
// ============================================================================

/**
 * DEBUG: Show raw Zoile data for a reference (ALL matching rows)
 * GET /api/debug/zoile?keyword=REF001
 */
app.get('/api/debug/zoile', async (req, res) => {
  try {
    const { keyword } = req.query;
    if (!keyword) {
      return res.status(400).json({ success: false, message: 'Missing keyword param' });
    }

    const target = String(keyword).trim().toUpperCase();
    const results = {
      InputZoile30: [],
      ZoileData: []
    };

    // Check all matching rows in InputZoile30
    if (zoileDb) {
      const inputZoile = await zoileDb.readRange(SHEETS.ZOILE_INPUT, 'A:AZ');
      if (inputZoile && inputZoile.length > 1) {
        const refColIdx = 30;
        for (let i = 1; i < inputZoile.length; i++) {
          if (inputZoile[i][refColIdx] && String(inputZoile[i][refColIdx]).toUpperCase() === target) {
            const row = inputZoile[i];
            results.InputZoile30.push({
              rowIndex: i + 1,
              col_15_P: row[15] + ' (Distance UOM)',
              col_16_Q: row[16] + ' (Date)',
              col_17_R: row[17] + ' (Date)',
              col_33_AH: row[33] + ' (ShipToCode)',
              col_34_AI: row[34] + ' (ShipToName)',
              col_35_AJ: row[35] || 'undefined',
              col_36_AK: row[36] || 'undefined',
              col_37_AL: row[37] || 'undefined',
              col_38_AM: row[38] || 'undefined',
              col_39_AN: row[39] || 'undefined',
              col_40_AO: row[40] + ' (Material?)',
              col_41_AP: row[41] + ' (MaterialDesc?)',
              col_42_AQ: row[42] + ' (DeliveryQty?)'
            });
          }
        }
      }

      // Check all matching rows in ZoileData
      const zoileData = await zoileDb.readRange(SHEETS.ZOILE_DATA, 'A:AZ');
      if (zoileData && zoileData.length > 1) {
        const refColIdx = 12;
        for (let i = 1; i < zoileData.length; i++) {
          if (zoileData[i][refColIdx] && String(zoileData[i][refColIdx]).toUpperCase() === target) {
            const row = zoileData[i];
            results.ZoileData.push({
              rowIndex: i + 1,
              col_13_N: row[13] + ' (ShipToCode)',
              col_14_O: row[14] + ' (ShipToName)',
              col_15_P: row[15] + ' (Material)',
              col_16_Q: row[16] + ' (MaterialDesc)',
              col_17_R: row[17] + ' (DeliveryQty)'
            });
          }
        }
      }
    }

    return res.json({ success: true, keyword, results });
  } catch (err) {
    console.error('❌ Debug zoile error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DEBUG: Detailed search trace for troubleshooting
 * GET /api/debug/search?keyword=REF001
 */
app.get('/api/debug/search', async (req, res) => {
  try {
    const { keyword } = req.query;
    if (!keyword) {
      return res.status(400).json({ success: false, message: 'Missing keyword param' });
    }

    const trace = [];
    const log = (msg) => {
      console.log('[DEBUG-SEARCH]', msg);
      trace.push(msg);
    };

    log(`🔍 Starting debug search for: "${keyword}"`);

    // Step 1: Check Zoile sheets
    let zoileRef = null;
    if (zoileDb) {
      try {
        log('📖 Reading Zoile InputZoile30 sheet...');
        const inputZoile = await zoileDb.readRange(SHEETS.ZOILE_INPUT, 'A:AZ');
        log(`   Found ${inputZoile.length} rows in InputZoile30`);
        
        if (inputZoile.length > 1) {
          log(`   Headers: ${inputZoile[0].slice(0, 35).join(' | ')}`);
          const refColIdx = 30; // Column 31 (0-based)
          log(`   Looking for reference in column index ${refColIdx} (column ${String.fromCharCode(65 + refColIdx)})`);
          
          for (let i = 1; i < Math.min(inputZoile.length, 10); i++) {
            const cellValue = inputZoile[i][refColIdx];
            log(`   Row ${i+1}: col[${refColIdx}] = "${cellValue}"`);
            if (cellValue && String(cellValue).toUpperCase() === String(keyword).toUpperCase()) {
              zoileRef = String(cellValue);
              log(`   ✅ MATCH in InputZoile30 row ${i+1}!`);
              break;
            }
          }
        }

        if (!zoileRef) {
          log('📖 Reading Zoile data sheet...');
          const zoileData = await zoileDb.readRange(SHEETS.ZOILE_DATA, 'A:AZ');
          log(`   Found ${zoileData.length} rows in data`);
          
          if (zoileData.length > 1) {
            log(`   Headers: ${zoileData[0].slice(0, 20).join(' | ')}`);
            const refColIdx = 12; // Column M (0-based)
            log(`   Looking for reference in column index ${refColIdx} (column ${String.fromCharCode(65 + refColIdx)})`);
            
            for (let i = 1; i < Math.min(zoileData.length, 10); i++) {
              const cellValue = zoileData[i][refColIdx];
              log(`   Row ${i+1}: col[${refColIdx}] = "${cellValue}"`);
              if (cellValue && String(cellValue).toUpperCase() === String(keyword).toUpperCase()) {
                zoileRef = String(cellValue);
                log(`   ✅ MATCH in data sheet row ${i+1}!`);
                break;
              }
            }
          }
        }
      } catch (zoileErr) {
        log(`⚠️ Zoile read error: ${zoileErr.message}`);
      }
    } else {
      log('⚠️ zoileDb not initialized');
    }

    const searchRef = zoileRef || keyword;
    log(`🔎 Final search reference: "${searchRef}"`);

    // Step 2: Search in jobdata
    log('📖 Reading jobdata sheet...');
    const jobdata = await db.readRange(SHEETS.JOBDATA, 'A:AZ');
    log(`   Found ${jobdata.length} rows in jobdata`);

    if (jobdata.length > 1) {
      const headers = jobdata[0];
      log(`   Headers (first 15): ${headers.slice(0, 15).join(' | ')}`);
      
      const referenceIdx = headers.indexOf('referenceNo');
      log(`   referenceNo column index: ${referenceIdx} (column ${referenceIdx >= 0 ? String.fromCharCode(65 + referenceIdx) : 'NOT FOUND'})`);

      if (referenceIdx === -1) {
        log(`❌ ERROR: referenceNo column not found!`);
        log(`   Available columns: ${headers.map((h, i) => `${i}:${h}`).join(', ')}`);
        return res.json({ success: false, message: 'referenceNo column not found', trace });
      }

      // Show first 10 rows of jobdata
      log('   Sample jobdata rows:');
      for (let i = 1; i < Math.min(jobdata.length, 11); i++) {
        const refVal = jobdata[i][referenceIdx];
        log(`   Row ${i+1}: referenceNo="${refVal}"`);
      }

      // Search
      const matchingStops = [];
      const target = String(searchRef || '').trim().toUpperCase();
      log(`   Searching for exact match: "${target}"`);

      for (let i = 1; i < jobdata.length; i++) {
        const cell = jobdata[i][referenceIdx];
        if (!cell) continue;
        const value = String(cell).trim().toUpperCase();
        if (value === target) {
          matchingStops.push(i + 1); // Store row number (1-based)
          log(`   ✅ MATCH at row ${i+1}`);
        }
      }

      if (matchingStops.length > 0) {
        log(`🎯 Found ${matchingStops.length} matching stops at rows: ${matchingStops.join(', ')}`);
      } else {
        log(`❌ No exact matches found, trying partial/contains match...`);
        for (let i = 1; i < jobdata.length; i++) {
          const cell = jobdata[i][referenceIdx];
          if (!cell) continue;
          const value = String(cell).trim().toUpperCase();
          if (value.includes(target) || target.includes(value)) {
            matchingStops.push(i + 1);
            log(`   ⚠️ PARTIAL MATCH at row ${i+1}: "${cell}"`);
          }
        }
        if (matchingStops.length > 0) {
          log(`   Found ${matchingStops.length} partial matches`);
        } else {
          log(`   No partial matches either`);
        }
      }
    }

    return res.json({ success: true, trace, zoileConnected: !!zoileDb });
  } catch (err) {
    console.error('❌ Debug search error:', err);
    return res.status(500).json({ success: false, message: err.message, stack: err.stack });
  }
});

// ============================================================================
// API Endpoints
// ============================================================================

// ----------------------------------------------------------------------------
// LINE Webhook Security Helpers
// ----------------------------------------------------------------------------
function verifyLineSignature(req) {
  const channelSecret = process.env.CHANNEL_SECRET;
  if (!channelSecret) {
    console.warn('⚠️ CHANNEL_SECRET not set; skipping signature verification');
    return true; // Allow if not configured, to avoid breaking dev
  }
  const signatureHeader = req.get('X-Line-Signature') || req.get('x-line-signature') || '';
  if (!signatureHeader) {
    console.warn('⚠️ Missing X-Line-Signature header');
    return false;
  }
  const raw = req.rawBody || '';
  try {
    const hmac = crypto.createHmac('sha256', channelSecret);
    hmac.update(raw);
    const expected = hmac.digest('base64');
    const a = Buffer.from(signatureHeader, 'base64');
    const b = Buffer.from(expected, 'base64');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (err) {
    console.error('❌ Signature verification error:', err);
    return false;
  }
}

// Simple in-memory rate limiter for webhook endpoint
const _webhookRate = new Map();
function isRateLimited(ip, windowMs = 2000) {
  const now = Date.now();
  const last = _webhookRate.get(ip) || 0;
  if (now - last < windowMs) return true;
  _webhookRate.set(ip, now);
  return false;
}

/**
 * Unified GET handler for query actions
 * Supported:
 *  - /?action=search&keyword=REF001&userId=USER
 *  - /?action=closeJob&reference=REF001&userId=USER
 */
app.get('/', async (req, res) => {
  try {
    const { action } = req.query;

    if (action === 'search') {
      const { keyword, userId } = req.query;
      if (!keyword || !userId) {
        return res.status(400).json({ success: false, message: 'Missing keyword or userId' });
      }
      const result = await sheetActions.search(keyword, userId);
      return res.json(result);
    }

    if (action === 'closeJob') {
      const { reference, userId } = req.query;
      if (!reference || !userId) {
        return res.status(400).json({ success: false, message: 'Missing reference or userId' });
      }
      const result = await sheetActions.closeJob(reference, userId);
      return res.json(result);
    }

    // Default: return online message
    return res.json({ success: true, message: 'Backend online' });
  } catch (err) {
    console.error('❌ GET / error:', err);
    return ErrorHandler.sendError(res, err);
  }
});

/**
 * UPDATE_STOP: Update stop status (check-in, check-out, etc.)
 * POST /api/updateStop
 */
app.post('/api/updateStop', async (req, res) => {
  try {
    const payload = req.body;
    const result = await sheetActions.updateStop(payload);
    return res.json(result);
  } catch (err) {
    console.error('❌ POST /api/updateStop error:', err);
    return ErrorHandler.sendError(res, err);
  }
});

/**
 * ADMIN_ADD_STOP: Add extra stop for a reference
 * POST /api/adminAddStop
 */
app.post('/api/adminAddStop', async (req, res) => {
  try {
    const payload = req.body;
    const result = await sheetActions.adminAddStop(payload);
    return res.json(result);
  } catch (err) {
    console.error('❌ POST /api/adminAddStop error:', err);
    return ErrorHandler.sendError(res, err);
  }
});

/**
 * CLOSE_JOB: Close job (all stops completed)
 * POST /api/closeJob
 */
app.post('/api/closeJob', async (req, res) => {
  try {
    const payload = req.body;
    const result = await sheetActions.closeJob(payload);
    return res.json(result);
  } catch (err) {
    console.error('❌ POST /api/closeJob error:', err);
    return ErrorHandler.sendError(res, err);
  }
});

/**
 * END_TRIP_SUMMARY: Record end trip information
 * POST /api/endTripSummary
 */
app.post('/api/endTripSummary', async (req, res) => {
  try {
    const payload = req.body;
    const result = await sheetActions.endTripSummary(payload);
    return res.json(result);
  } catch (err) {
    console.error('❌ POST /api/endTripSummary error:', err);
    return ErrorHandler.sendError(res, err);
  }
});

/**
 * ALCOHOL_UPLOAD: Record alcohol check
 * POST /api/alcoholUpload
 */
app.post('/api/alcoholUpload', async (req, res) => {
  try {
    const payload = req.body;
    const result = await sheetActions.alcoholUpload(payload);
    return res.json(result);
  } catch (err) {
    console.error('❌ POST /api/alcoholUpload error:', err);
    return ErrorHandler.sendError(res, err);
  }
});

/**
 * REVIEW_UPLOAD: Record delivery review
 * POST /api/reviewUpload
 */
app.post('/api/reviewUpload', async (req, res) => {
  try {
    const payload = req.body;
    const result = await sheetActions.reviewUpload(payload);
    return res.json(result);
  } catch (err) {
    console.error('❌ POST /api/reviewUpload error:', err);
    return ErrorHandler.sendError(res, err);
  }
});

// =============================================================================
// Admin APIs
// =============================================================================

/**
 * ADMIN_CHECK: Check admin privileges
 * POST /api/admin/check
 */
app.post('/api/admin/check', async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });
    const result = await sheetActions.adminCheck(userId);
    return res.json(result);
  } catch (err) {
    console.error('❌ POST /api/admin/check error:', err);
    return ErrorHandler.sendError(res, err);
  }
});

/**
 * ADMIN_JOBDATA: List jobdata
 * POST /api/admin/jobdata
 */
app.post('/api/admin/jobdata', async (req, res) => {
  try {
    const payload = req.body || {};
    const result = await sheetActions.adminJobdata(payload);
    return res.json(result);
  } catch (err) {
    console.error('❌ POST /api/admin/jobdata error:', err);
    return ErrorHandler.sendError(res, err);
  }
});

/**
 * ADMIN_ALCOHOL: List alcohol checks
 * POST /api/admin/alcohol
 */
app.post('/api/admin/alcohol', async (req, res) => {
  try {
    const payload = req.body || {};
    const result = await sheetActions.adminAlcohol(payload);
    return res.json(result);
  } catch (err) {
    console.error('❌ POST /api/admin/alcohol error:', err);
    return ErrorHandler.sendError(res, err);
  }
});

/**
 * ADMIN_USERPROFILE: List user profiles
 * POST /api/admin/userprofile
 */
app.post('/api/admin/userprofile', async (req, res) => {
  try {
    const payload = req.body || {};
    const result = await sheetActions.adminUserprofile(payload);
    return res.json(result);
  } catch (err) {
    console.error('❌ POST /api/admin/userprofile error:', err);
    return ErrorHandler.sendError(res, err);
  }
});

/**
 * ADMIN_UPDATE_JOB: Update jobdata status
 * POST /api/admin/update-job
 */
app.post('/api/admin/update-job', async (req, res) => {
  try {
    const payload = req.body || {};
    const result = await sheetActions.adminUpdateJob(payload);
    return res.json(result);
  } catch (err) {
    console.error('❌ POST /api/admin/update-job error:', err);
    return ErrorHandler.sendError(res, err);
  }
});

/**
 * ADMIN_UPDATE_ALCOHOL: Update alcohol value
 * POST /api/admin/update-alcohol
 */
app.post('/api/admin/update-alcohol', async (req, res) => {
  try {
    const payload = req.body || {};
    const result = await sheetActions.adminUpdateAlcohol(payload);
    return res.json(result);
  } catch (err) {
    console.error('❌ POST /api/admin/update-alcohol error:', err);
    return ErrorHandler.sendError(res, err);
  }
});

/**
 * ADMIN_UPDATE_USER_STATUS: Update user status and link rich menu when APPROVED
 * POST /api/admin/update-user-status
 */
app.post('/api/admin/update-user-status', async (req, res) => {
  try {
    const payload = req.body || {};
    const result = await sheetActions.adminUpdateUserStatus(payload);
    if (result.success && result.linkRichMenu && result.userId) {
      // Best-effort link rich menu; ignore failure
      await linkRichMenuToUser(result.userId, process.env.RICH_MENU_ID_MENU1 || '');
    }
    return res.json(result);
  } catch (err) {
    console.error('❌ POST /api/admin/update-user-status error:', err);
    return ErrorHandler.sendError(res, err);
  }
});

/**
 * UPLOAD_ALCOHOL: Save alcohol check result
 * POST /api/uploadAlcohol (multipart/form-data)
 */
app.post('/api/uploadAlcohol', upload.single('image'), async (req, res) => {
  try {
    const { driverName, result, timestamp, userId, reference, lat, lng, accuracy } = req.body;
    const imageBuffer = req.file ? req.file.buffer : null;

    console.log(`🍷 POST /api/uploadAlcohol - ref=${reference}, driver=${driverName}, user=${userId}, result=${result}`);
    console.log(`   lat=${lat}, lng=${lng}, accuracy=${accuracy}, imageSize=${imageBuffer ? imageBuffer.length : 0}`);

    const payload = {
      driverName,
      result,
      timestamp: timestamp || new Date().toISOString(),
      userId,
      reference,
      imageBuffer,
      lat: lat ? parseFloat(lat) : undefined,
      lng: lng ? parseFloat(lng) : undefined,
      accuracy: accuracy ? parseFloat(accuracy) : undefined,
      imageSize: imageBuffer ? imageBuffer.length : 0
    };

    console.log(`   Payload after parse: lat=${payload.lat}, lng=${payload.lng}`);

    const result_data = await sheetActions.uploadAlcohol(payload);
    console.log(`✅ uploadAlcohol returned:`, result_data);
    return res.json(result_data);
  } catch (err) {
    console.error('❌ POST /api/uploadAlcohol error:', err);
    return ErrorHandler.sendError(res, err);
  }
});

/**
 * SAVE_AWARENESS: Save awareness acknowledgment
 * POST /api/saveAwareness
 */
app.post('/api/saveAwareness', async (req, res) => {
  try {
    const payload = req.body;
    const result = await sheetActions.saveAwareness(payload);
    return res.json(result);
  } catch (err) {
    console.error('❌ POST /api/saveAwareness error:', err);
    return ErrorHandler.sendError(res, err);
  }
});

/**
 * UPLOAD_POD: Save proof of delivery
 * POST /api/uploadPOD (multipart/form-data)
 */
app.post('/api/uploadPOD', upload.single('image'), async (req, res) => {
  try {
    const { rowIndex, shipmentNo, userId, reference, timestamp } = req.body;
    const imageBuffer = req.file ? req.file.buffer : null;

    const payload = {
      rowIndex,
      shipmentNo,
      userId,
      reference,
      timestamp: timestamp || new Date().toISOString(),
      imageBuffer,
      imageSize: imageBuffer ? imageBuffer.length : 0
    };

    const result = await sheetActions.uploadPOD(payload);
    return res.json(result);
  } catch (err) {
    console.error('❌ POST /api/uploadPOD error:', err);
    return ErrorHandler.sendError(res, err);
  }
});

/**
 * EMERGENCY_SOS: Report emergency
 * POST /api/emergencySOS (multipart/form-data)
 */
app.post('/api/emergencySOS', upload.single('image'), async (req, res) => {
  try {
    const { type, description, userId, lat, lng, timestamp } = req.body;
    const imageBuffer = req.file ? req.file.buffer : null;

    const payload = {
      type,
      description,
      userId,
      lat,
      lng,
      timestamp: timestamp || new Date().toISOString(),
      imageBuffer,
      imageSize: imageBuffer ? imageBuffer.length : 0
    };

    const result = await sheetActions.emergencySOS(payload);
    return res.json(result);
  } catch (err) {
    console.error('❌ POST /api/emergencySOS error:', err);
    return ErrorHandler.sendError(res, err);
  }
});

/**
 * END_TRIP: Save end of trip summary
 * POST /api/endTrip
 */
app.post('/api/endTrip', async (req, res) => {
  try {
    const payload = req.body;
    const result = await sheetActions.endTrip(payload);
    return res.json(result);
  } catch (err) {
    console.error('❌ POST /api/endTrip error:', err);
    return ErrorHandler.sendError(res, err);
  }
});

// (Removed duplicate GET '/' handler; unified above)

/**
 * FILL_MISSING: Fill missing steps data
 * POST /api/fillMissing
 */
app.post('/api/fillMissing', async (req, res) => {
  try {
    const payload = req.body;
    const result = await sheetActions.fillMissing(payload);
    return res.json(result);
  } catch (err) {
    console.error('❌ POST /api/fillMissing error:', err);
    return ErrorHandler.sendError(res, err);
  }
});

// ============================================================================
// Error Handling
// ============================================================================
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: NODE_ENV === 'development' ? err.message : undefined
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// ============================================================================
// Customer Notification Endpoints
// ============================================================================

/**
 * GET_CUSTOMER_CONTACT: Get customer contact information
 * GET /api/customer-contact?shipToCode=12345
 */
app.get('/api/customer-contact', async (req, res) => {
  try {
    const { shipToCode } = req.query;
    if (!shipToCode) {
      return res.status(400).json({ success: false, message: 'Missing shipToCode' });
    }

    const contact = await customerContacts.getContactInfo(shipToCode);
    if (!contact) {
      return res.json({ success: false, message: 'Customer contact not found' });
    }

    return res.json({ success: true, data: contact });
  } catch (err) {
    console.error('❌ GET /api/customer-contact error:', err);
    return ErrorHandler.sendError(res, err);
  }
});

/**
 * UPSERT_CUSTOMER_CONTACT: Add or update customer contact
 * POST /api/customer-contact
 */
app.post('/api/customer-contact', async (req, res) => {
  try {
    const contactData = req.body;
    if (!contactData.shipToCode) {
      return res.status(400).json({ success: false, message: 'Missing shipToCode' });
    }

    const result = await customerContacts.upsertContact(contactData);
    return res.json(result);
  } catch (err) {
    console.error('❌ POST /api/customer-contact error:', err);
    return ErrorHandler.sendError(res, err);
  }
});

/**
 * SEND_NOTIFICATION: Send notification to customer
 * POST /api/send-notification
 */
app.post('/api/send-notification', async (req, res) => {
  try {
    const { type, shipToCode, reference, shipmentNo, driverName, ...extraData } = req.body;

    if (!type || !shipToCode) {
      return res.status(400).json({ success: false, message: 'Missing type or shipToCode' });
    }

    // Get customer contact info
    const contact = await customerContacts.getContactInfo(shipToCode);
    if (!contact) {
      return res.json({ success: false, message: 'Customer contact not found' });
    }

    // Check if notification is enabled for this type
    if (type === 'checkin' && !contact.notifyOnCheckIn) {
      return res.json({ success: true, skipped: true, message: 'Notification disabled for check-in' });
    }
    if (type === 'nearby' && !contact.notifyOnNearby) {
      return res.json({ success: true, skipped: true, message: 'Notification disabled for nearby' });
    }
    if (type === 'completed' && !contact.notifyOnComplete) {
      return res.json({ success: true, skipped: true, message: 'Notification disabled for completed' });
    }
    if (type === 'issue' && !contact.notifyOnIssue) {
      return res.json({ success: true, skipped: true, message: 'Notification disabled for issue' });
    }

    // Send notification
    let result;
    const notifyData = {
      customerName: contact.customerName || contact.shipToName,
      customerEmail: contact.email,
      chatEmail: contact.chatEmail,
      chatWebhook: contact.chatWebhook,
      driverName: driverName || 'คนขับ',
      shipmentNo: shipmentNo || '',
      destination: contact.shipToName || '',
      ...extraData
    };

    switch (type) {
      case 'checkin':
        result = await notificationService.notifyCheckIn(notifyData);
        break;
      case 'nearby':
        result = await notificationService.notifyNearby(notifyData);
        break;
      case 'completed':
        result = await notificationService.notifyCompleted(notifyData);
        break;
      case 'issue':
        result = await notificationService.notifyIssue(notifyData);
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid notification type' });
    }

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('❌ POST /api/send-notification error:', err);
    return ErrorHandler.sendError(res, err);
  }
});

// ============================================================================
// LINE Webhook - Handle Follow & Message Events
// ============================================================================

/**
 * Handle LINE follow event - Save user profile to userprofile sheet
 */
async function handleFollowEvent(event, sheetActions) {
  try {
    const userId = event.source.userId;
    if (!userId) {
      console.warn('⚠️ handleFollowEvent: no userId');
      return;
    }

    // Get LINE user profile
    const profile = await getLineUserProfile(userId);
    const displayName = (profile && profile.displayName) || '';
    const pictureUrl = (profile && profile.pictureUrl) || '';

    // Read userprofile sheet
    const userdata = await sheetActions.db.readRange(SHEETS.USER_PROFILE, 'A:J');
    const headers = userdata[0];
    
    // Check if user already exists
    let userExists = false;
    for (let i = 1; i < userdata.length; i++) {
      if (String(userdata[i][0] || '').trim() === String(userId).trim()) {
        userExists = true;
        break;
      }
    }

    if (!userExists) {
      // Append new user: [userId, displayName, pictureUrl, PENDING, now, now]
      const now = new Date().toISOString();
      await sheetActions.db.appendRow(SHEETS.USER_PROFILE, [
        userId,
        displayName,
        pictureUrl,
        'PENDING',
        now,
        now
      ]);
      console.log('✅ Added new user on follow event:', userId);
    } else {
      console.log('ℹ️ User already exists:', userId);
    }
  } catch (err) {
    console.error('❌ handleFollowEvent error:', err);
  }
}

/**
 * Handle LINE message event
 */
async function handleMessageEvent(event, sheetActions) {
  try {
    const text = (event.message && event.message.text) ? String(event.message.text).trim() : '';
    const userId = event.source.userId;
    const replyToken = event.replyToken;

    if (!replyToken) {
      console.warn('⚠️ handleMessageEvent: no replyToken');
      return;
    }

    let reply = '';
    if (text.toLowerCase() === 'status') {
      const status = await sheetActions.getUserStatus(userId);
      reply = 'สถานะของคุณ: ' + (status || 'ไม่พบข้อมูล / ยังไม่ลงทะเบียน');
    } else {
      reply = 'หากคุณเป็นคนขับงานนี้ ให้กดเมนูด้านล่างเพื่อเข้าแอปรับงานครับ';
    }

    // Send reply via LINE Push API
    await sendLineReply(process.env.CHANNEL_ACCESS_TOKEN, replyToken, reply);
    console.log('✅ Replied to user:', userId);
  } catch (err) {
    console.error('❌ handleMessageEvent error:', err);
  }
}

/**
 * Get LINE user profile
 */
async function getLineUserProfile(userId) {
  try {
    const response = await fetch('https://api.line.biz/v2/bot/profile/' + userId, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + process.env.CHANNEL_ACCESS_TOKEN
      }
    });
    if (!response.ok) {
      console.warn('⚠️ getLineUserProfile failed:', response.status);
      return null;
    }
    return await response.json();
  } catch (err) {
    console.error('❌ getLineUserProfile error:', err);
    return null;
  }
}

/**
 * Send LINE reply message
 */
async function sendLineReply(channelAccessToken, replyToken, message) {
  try {
    const response = await fetch('https://api.line.biz/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + channelAccessToken
      },
      body: JSON.stringify({
        replyToken: replyToken,
        messages: [
          {
            type: 'text',
            text: message
          }
        ]
      })
    });
    if (!response.ok) {
      console.warn('⚠️ sendLineReply failed:', response.status);
    }
  } catch (err) {
    console.error('❌ sendLineReply error:', err);
  }
}

/**
 * Link LINE Rich Menu to a specific user
 */
async function linkRichMenuToUser(userId, richMenuId) {
  try {
    const url = `https://api.line.biz/v2/bot/user/${encodeURIComponent(userId)}/richmenu/${encodeURIComponent(richMenuId)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.CHANNEL_ACCESS_TOKEN
      }
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn('⚠️ linkRichMenuToUser failed:', response.status, text);
      return { success: false, status: response.status, body: text };
    }

    return { success: true };
  } catch (err) {
    console.error('❌ linkRichMenuToUser error:', err);
    return { success: false, message: err.message };
  }
}

/**
 * POST /api/link-rich-menu
 * Body: { userId: string, richMenuId: string }
 */
app.post('/api/link-rich-menu', async (req, res) => {
  try {
    const { userId, richMenuId } = req.body || {};
    if (!userId || !richMenuId) {
      return res.status(400).json({ success: false, message: 'Missing userId or richMenuId' });
    }

    const result = await linkRichMenuToUser(userId, richMenuId);
    return res.json(result);
  } catch (err) {
    console.error('❌ POST /api/link-rich-menu error:', err);
    return ErrorHandler.sendError(res, err);
  }
});

/**
 * POST /api/line-webhook - Handle LINE Bot webhook (both messages and rich menu linking)
 */
app.post('/api/line-webhook', async (req, res) => {
  try {
    // Basic rate limiting
    if (isRateLimited(req.ip)) {
      return res.status(429).json({ success: false, message: 'Too Many Requests' });
    }

    // Verify LINE signature
    const ok = verifyLineSignature(req);
    if (!ok) {
      return res.status(401).json({ success: false, message: 'Invalid signature' });
    }

    const body = req.body || {};
    const events = body.events || [];

    // Handle LINE events (follow, message)
    for (const event of events) {
      if (event.type === 'follow') {
        await handleFollowEvent(event, sheetActions);
      } else if (event.type === 'message') {
        await handleMessageEvent(event, sheetActions);
      }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('❌ POST /api/line-webhook error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================================================
// Server Startup
// ============================================================================
async function startServer() {
  try {
    await initializeServices();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 DriverConnect Backend running on http://0.0.0.0:${PORT}`);
      console.log(`📊 Google Sheets ID: ${process.env.GOOGLE_SHEETS_ID}`);
      console.log(`🌍 CORS Origins: ${process.env.CORS_ORIGIN || 'localhost'}`);
      console.log(`📝 Environment: ${NODE_ENV}\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;
