/**
 * Webhook Controller
 * Main webhook handler for LINE bot
 * Routes events to appropriate controllers
 */

import { stockController } from './stock.controller';
import { userController } from './user.controller';
import { createLineService } from '../services/line.service';
import { supabaseService } from '../services/supabase.service';
import { createReplyMessage } from '../templates/reply.templates';
import { LineEvent, LineWebhook } from '../types';

export class WebhookController {
  private lineService = createLineService(process.env.LINE_CHANNEL_TOKEN || '');

  // ============================================
  // Main Webhook Handler
  // ============================================

  async handleWebhook(reqObj: LineWebhook): Promise<void> {
    console.log('🎯 Webhook received');
    console.log(`📦 Events: ${reqObj.events.length}`);

    for (const reqEvent of reqObj.events) {
      await this.handleEvent(reqEvent);
    }
  }

  async handleEvent(reqEvent: LineEvent): Promise<void> {
    console.log(`📍 Event type: ${reqEvent.type}`);

    switch (reqEvent.type) {
      case 'follow':
        await this.executeFollow(reqEvent);
        break;

      case 'unfollow':
        await this.executeUnfollow(reqEvent);
        break;

      case 'message':
        await this.executeMessage(reqEvent);
        break;

      case 'postback':
        await this.executePostback(reqEvent);
        break;

      case 'join':
        await this.executeJoin(reqEvent);
        break;

      case 'leave':
        await this.executeLeave(reqEvent);
        break;

      case 'memberJoined':
        await this.executeMemberJoined(reqEvent);
        break;

      case 'memberLeft':
        await this.executeMemberLeft(reqEvent);
        break;

      default:
        console.log(`⚠️ Unknown event type: ${reqEvent.type}`);
    }
  }

  // ============================================
  // Event Handlers
  // ============================================

  private async executeFollow(reqEvent: LineEvent): Promise<void> {
    const userId = reqEvent.source.userId!;

    try {
      // Start loading animation
      await this.lineService.startLoading(userId, 60);

      // Register or update user
      await userController.executeFollow(reqEvent);

      // Send welcome message from settings or default
      // TODO: Fetch from system_settings or reply_templates
      await this.lineService.replyMessage(reqEvent.replyToken!, [
        {
          type: 'text',
          text: 'ยินดีต้อนรับสู่ Boonyang Inventory 🤖\n\nพิมพ์ "ลงทะเบียน" เพื่อเริ่มต้นใช้งาน',
        },
      ]);
    } catch (error) {
      console.error('❌ ERROR @ executeFollow:', error);
    }
  }

  private async executeUnfollow(reqEvent: LineEvent): Promise<void> {
    const userId = reqEvent.source.userId!;
    await userController.removeUserFromDatabase(userId);
  }

  private async executeMessage(reqEvent: LineEvent): Promise<void> {
    const userId = reqEvent.source.userId!;
    const messageText = reqEvent.message?.text?.trim() || '';

    try {
      // Update last interaction
      await userController.updateUserLastInteraction(userId);

      // Start loading animation
      await this.lineService.startLoading(userId, 60);

      // Check if bot is enabled
      const botEnabled = await userController.isBotEnabled();
      if (!botEnabled) {
        await this.lineService.replyMessage(reqEvent.replyToken!, [
          { type: 'text', text: '⛔ ระบบปิดชั่วคราว กรุณาลองใหม่ภายหลัง' },
        ]);
        return;
      }

      // Check registration requirement
      const registerRequired = await userController.isRegisterRequired();
      const userStatus = await userController.getUserStatusRegister(userId);

      if (registerRequired && userStatus !== 'สำเร็จ') {
        // Handle registration flow
        if (messageText === 'ลงทะเบียน' || userStatus) {
          await userController.handleRegistrationFlow(reqEvent);
          return;
        }

        // Prompt registration
        await this.lineService.replyMessage(reqEvent.replyToken!, [
          {
            type: 'text',
            text: '⛔ กรุณาลงทะเบียนก่อนใช้งาน\nพิมพ์ "ลงทะเบียน" เพื่อเริ่มต้น',
          },
        ]);
        return;
      }

      // Check for reply template match
      const replyTemplate = await supabaseService.getReplyTemplate(messageText);
      if (replyTemplate) {
        const replyMsg = createReplyMessage(replyTemplate.reply_content);
        await this.lineService.replyMessage(reqEvent.replyToken!, [replyMsg]);
        return;
      }

      // Check if it looks like a stock query
      if (this.looksLikeStockQuery(messageText)) {
        const canAskStock = await userController.canUserAskStock(userId);

        if (!canAskStock) {
          await this.lineService.replyMessage(reqEvent.replyToken!, [
            {
              type: 'text',
              text: '⛔ ไม่มีสิทธิ์สอบถามสต็อก\nกรุณาติดต่อแอดมิน',
            },
          ]);
          return;
        }

        await stockController.findItemAndPrepareReply(reqEvent);
        return;
      }

      // No match - silent return
      console.log(`🔇 No match - silent return for: ${messageText}`);
    } catch (error) {
      console.error('❌ ERROR @ executeMessage:', error);
    }
  }

  private async executePostback(reqEvent: LineEvent): Promise<void> {
    // Handle postback data
    console.log('📬 Postback received');
    // TODO: Implement postback handling
  }

  private async executeJoin(reqEvent: LineEvent): Promise<void> {
    // Handle group join event
    console.log('👥 Bot joined group');
    // TODO: Implement group join logic
  }

  private async executeLeave(reqEvent: LineEvent): Promise<void> {
    // Handle group leave event
    console.log('👋 Bot left group');
  }

  private async executeMemberJoined(reqEvent: LineEvent): Promise<void> {
    // Handle member joined event
    console.log('👤 New member joined');
    // TODO: Implement member joined logic
  }

  private async executeMemberLeft(reqEvent: LineEvent): Promise<void> {
    // Handle member left event
    console.log('👤 Member left');
    // TODO: Implement member left logic
  }

  // ============================================
  // Helper Functions
  // ============================================

  private looksLikeStockQuery(text: string): boolean {
    const t = text.toLowerCase().trim();

    if (!t) return false;

    // System commands
    const systemCommands = [
      'ลงทะเบียน',
      'เปิดระบบ',
      'ปิดระบบ',
      'bot on',
      'bot off',
      'เปิดสต็อก',
      'ปิดสต็อก',
      'stock on',
      'stock off',
    ];

    if (systemCommands.some((cmd) => t === cmd)) return false;

    // Explicit stock keywords
    if (
      t.startsWith('สต็อก') ||
      t.startsWith('สต๊อก') ||
      t.startsWith('stock') ||
      t.startsWith('เช็คสต็อก') ||
      t.startsWith('เช็คสต็อก')
    ) {
      return true;
    }

    // SKU-like patterns (alphanumeric with dashes/underscores)
    const skuLike = /^[a-z0-9][a-z0-9\-_]{2,}$/i.test(t);
    if (skuLike) return true;

    // Any other text (at least 2 chars) - treat as inventory search
    if (t.length >= 2) return true;

    return false;
  }
}

// Singleton instance
export const webhookController = new WebhookController();
