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
let sheetActions = null;
let imageStorage = null;

async function initializeServices() {
  try {
    console.log('🔧 Initializing Google Sheets connection...');
    db = new GoogleSheetsDB(
      process.env.GOOGLE_SHEETS_ID,
      process.env.GOOGLE_SHEETS_CREDENTIALS_JSON || process.env.GOOGLE_SHEETS_KEY_FILE
    );
    await db.initialize();
    console.log('✅ Google Sheets connected');

    sheetActions = new SheetActions(db);
    imageStorage = new ImageStorage(process.env.DATA_DIR || './data');
    
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
