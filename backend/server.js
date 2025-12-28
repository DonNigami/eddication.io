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
