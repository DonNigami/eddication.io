/**
 * Boonyang Inventory - Main Entry Point
 * TypeScript + Supabase implementation
 */

import express from 'express';
import { webhookController } from './controllers/webhook.controller';
import { validateSupabaseConfig } from './config/supabase.config';
import { validateLineConfig } from './config/line.config';

// Validate configurations
validateSupabaseConfig();
validateLineConfig();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Webhook endpoint
app.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-line-signature'];

    // TODO: Verify LINE signature
    // if (!verifySignature(signature, req.body)) {
    //   return res.status(401).send('Unauthorized');
    // }

    await webhookController.handleWebhook(req.body);
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'boonyang-inventory',
    timestamp: new Date().toISOString(),
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Boonyang Inventory API running on port ${PORT}`);
  console.log(`📡 Webhook endpoint: http://localhost:${PORT}/webhook`);
});

export default app;
