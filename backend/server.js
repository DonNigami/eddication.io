/**
 * DriverConnect Backend - Node.js Express Server
 * Replaces Google Apps Script with standalone Node.js backend
 * Integrates with Google Sheets for data persistence
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const { GoogleSheetsDB } = require('./lib/google-sheets');
const { SheetActions } = require('./lib/sheet-actions');
const { ImageStorage } = require('./lib/image-storage');
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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors({
  origin: (process.env.CORS_ORIGIN || 'http://localhost:8000').split(','),
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

    // Auto-create missing sheets
    console.log('🔧 Checking and creating required sheets...');
    await db.initializeRequiredSheets();

    sheetActions = new SheetActions(db, zoileDb);
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

// ============================================================================
// API Endpoints
// ============================================================================

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

/**
 * UPLOAD_ALCOHOL: Save alcohol check result
 * POST /api/uploadAlcohol (multipart/form-data)
 */
app.post('/api/uploadAlcohol', upload.single('image'), async (req, res) => {
  try {
    const { driverName, result, timestamp, userId, reference } = req.body;
    const imageBuffer = req.file ? req.file.buffer : null;

    const payload = {
      driverName,
      result,
      timestamp: timestamp || new Date().toISOString(),
      userId,
      reference,
      imageBuffer,
      imageSize: imageBuffer ? imageBuffer.length : 0
    };

    const result_data = await sheetActions.uploadAlcohol(payload);
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
    return res.json({ success: false, message: err.message });
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
