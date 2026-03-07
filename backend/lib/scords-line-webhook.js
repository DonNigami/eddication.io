/**
 * SCORDS LINE Webhook Integration
 * Handles LINE Bot events for SCORDS project
 * Ported from Google Apps Script to Node.js
 */

const axios = require('axios');

class ScordsLineWebhook {
  constructor(sheetsDB, notificationService) {
    this.sheetsDB = sheetsDB;
    this.notificationService = notificationService;
    this.lineApiBase = 'https://api.line.me/v2/bot';
  }

  /**
   * Verify LINE webhook signature
   */
  verifySignature(body, signature, channelSecret) {
    const crypto = require('crypto');
    const hash = crypto
      .createHmac('sha256', channelSecret)
      .update(body)
      .digest('base64');

    return signature === hash;
  }

  /**
   * Get LINE user profile
   */
  async getUserProfile(userId, channelAccessToken) {
    try {
      const response = await axios.get(
        `${this.lineApiBase}/profile/${userId}`,
        {
          headers: {
            'Authorization': `Bearer ${channelAccessToken}`
          }
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Failed to get user profile:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send reply message to user
   */
  async replyMessage(replyToken, message, channelAccessToken) {
    try {
      const response = await axios.post(
        `${this.lineApiBase}/message/reply`,
        {
          replyToken: replyToken,
          messages: [{
            type: 'text',
            text: message
          }]
        },
        {
          headers: {
            'Authorization': `Bearer ${channelAccessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Failed to send reply:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle follow event - User adds the LINE OA
   */
  async handleFollow(event, channelAccessToken) {
    try {
      const userId = event.source?.userId;
      if (!userId) {
        console.warn('⚠️ No userId in follow event');
        return { success: false, error: 'No userId' };
      }

      console.log(`👋 New follower: ${userId}`);

      // Get user profile from LINE
      const profileResult = await this.getUserProfile(userId, channelAccessToken);
      if (!profileResult.success) {
        console.error('❌ Failed to get user profile');
        return profileResult;
      }

      const profile = profileResult.data;
      console.log(`   Profile: ${profile.displayName}`);

      // Save user to spreadsheet
      const userSaved = await this.saveUser({
        userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl,
        status: 'PENDING'
      });

      if (userSaved.success) {
        console.log('✅ User saved to spreadsheet');

        // Send welcome message
        const welcomeMessage = `ขอบคุณที่แอดไลน์ครับ 🙏\n\n` +
          `ระบบ SCORDS ได้รับข้อมูลของคุณเรียบร้อยแล้ว\n` +
          `กรุณารอแอดมินอนุมัติการใช้งาน\n\n` +
          `สถานะ: รออนุมัติ ⏳`;

        await this.replyMessage(event.replyToken, welcomeMessage, channelAccessToken);
      }

      return { success: true };
    } catch (error) {
      console.error('❌ handleFollow error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle message event - User sends text message
   */
  async handleMessage(event, channelAccessToken) {
    try {
      const userId = event.source?.userId;
      const message = event.message;
      const replyToken = event.replyToken;

      if (!userId || !message || !replyToken) {
        console.warn('⚠️ Missing required fields in message event');
        return { success: false, error: 'Missing required fields' };
      }

      const text = message.text?.trim() || '';
      console.log(`💬 Message from ${userId}: "${text}"`);

      let reply = '';

      // Handle different commands
      const command = text.toLowerCase();

      switch (command) {
        case 'status':
        case 'สถานะ':
        case 'สถานะ':
          reply = await this.getUserStatus(userId);
          break;

        case 'help':
        case 'ช่วยเหลือ':
        case 'วิธีใช้':
          reply = this.getHelpMessage();
          break;

        case 'menu':
        case 'เมนู':
          reply = 'กรุณาใช้เมนูด้านล่างเพื่อเข้าถึงฟีเจอร์ต่างๆ ครับ';
          break;

        default:
          reply = this.getDefaultMessage();
          break;
      }

      await this.replyMessage(replyToken, reply, channelAccessToken);

      return { success: true };
    } catch (error) {
      console.error('❌ handleMessage error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle postback event - User clicks rich menu button
   */
  async handlePostback(event, channelAccessToken) {
    try {
      const userId = event.source?.userId;
      const postback = event.postback;
      const replyToken = event.replyToken;

      if (!userId || !postback || !replyToken) {
        console.warn('⚠️ Missing required fields in postback event');
        return { success: false, error: 'Missing required fields' };
      }

      const data = postback.data;
      console.log(`📎 Postback from ${userId}: ${data}`);

      let reply = '';

      // Handle different postback actions
      switch (data) {
        case 'check_status':
          reply = await this.getUserStatus(userId);
          break;

        case 'get_help':
          reply = this.getHelpMessage();
          break;

        case 'report_issue':
          reply = '📝 รายงานปัญหา\n\n' +
            'กรุณาแจ้งปัญหาที่พบ พร้อมรายละเอียด\n' +
            'แอดมินจะติดต่อกลับไปโดยเร็ว';
          break;

        default:
          reply = 'กรุณาเลือกเมนูจาก Rich Menu ด้านล่างครับ';
          break;
      }

      await this.replyMessage(replyToken, reply, channelAccessToken);

      return { success: true };
    } catch (error) {
      console.error('❌ handlePostback error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle unfollow event - User blocks the LINE OA
   */
  async handleUnfollow(event) {
    try {
      const userId = event.source?.userId;
      if (!userId) {
        console.warn('⚠️ No userId in unfollow event');
        return { success: false, error: 'No userId' };
      }

      console.log(`👋 User unfollowed: ${userId}`);

      // Update user status in spreadsheet
      await this.updateUserStatus(userId, 'INACTIVE');

      return { success: true };
    } catch (error) {
      console.error('❌ handleUnfollow error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Save user to spreadsheet
   */
  async saveUser(userData) {
    try {
      const { userId, displayName, pictureUrl, status } = userData;

      // Check if user already exists
      const existingUsers = await this.sheetsDB.readRange('Users', 'A:E');

      let userExists = false;

      if (existingUsers && existingUsers.length > 1) {
        for (let i = 1; i < existingUsers.length; i++) {
          const row = existingUsers[i];
          if (row[0] === userId) {
            userExists = true;
            break;
          }
        }
      }

      if (!userExists) {
        // Add new user
        const now = new Date().toISOString();
        await this.sheetsDB.appendRow('Users', [
          userId,
          displayName,
          pictureUrl || '',
          status,
          now,
          now
        ]);

        console.log(`✅ Added new user: ${userId}`);
      } else {
        console.log(`ℹ️ User already exists: ${userId}`);
      }

      return { success: true };
    } catch (error) {
      console.error('❌ saveUser error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get user status from spreadsheet
   */
  async getUserStatus(userId) {
    try {
      const users = await this.sheetsDB.readRange('Users', 'A:E');

      if (!users || users.length <= 1) {
        return '❌ ไม่พบข้อมูลผู้ใช้';
      }

      for (let i = 1; i < users.length; i++) {
        const row = users[i];
        if (row[0] === userId) {
          const status = row[3] || 'UNKNOWN';
          const displayName = row[1] || 'ผู้ใช้';

          const statusText = {
            'PENDING': '⏳ รออนุมัติ',
            'ACTIVE': '✅ อนุมัติแล้ว',
            'SUSPENDED': '⛔ ถูกระงับ',
            'INACTIVE': '🚫 ไม่ใช้บัญชี
          }[status] || status;

          return `สวัสดีครับ ${displayName}\n\nสถานะบัญชี: ${statusText}`;
        }
      }

      return '❌ ไม่พบข้อมูลของคุณในระบบ\nกรุณาติดต่อแอดมิน';
    } catch (error) {
      console.error('❌ getUserStatus error:', error);
      return '❌ เกิดข้อผิดพลาดในการตรวจสอบสถานะ';
    }
  }

  /**
   * Update user status
   */
  async updateUserStatus(userId, newStatus) {
    try {
      const users = await this.sheetsDB.readRange('Users', 'A:E');

      if (!users || users.length <= 1) {
        return { success: false, error: 'No users found' };
      }

      for (let i = 1; i < users.length; i++) {
        if (users[i][0] === userId) {
          // Update status in column D (index 3)
          const rowNumber = i + 1;
          await this.sheetsDB.updateCell('Users', rowNumber, 4, newStatus);

          // Update timestamp in column F (index 5)
          const now = new Date().toISOString();
          await this.sheetsDB.updateCell('Users', rowNumber, 6, now);

          console.log(`✅ Updated user ${userId} status to ${newStatus}`);
          return { success: true };
        }
      }

      return { success: false, error: 'User not found' };
    } catch (error) {
      console.error('❌ updateUserStatus error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get help message
   */
  getHelpMessage() {
    return `📖 วิธีใช้งาน SCORDS Bot

คำสั่งที่ใช้ได้:

• "status" หรือ "สถานะ" - ตรวจสอบสถานะบัญชี
• "help" หรือ "ช่วยเหลือ" - แสดงวิธีใช้งาน

เมนู Rich Menu:
• สถานะบัญชี - ตรวจสอบสถานะ
• วิธีใช้งาน - แสดงคำแนะนำ
• รายงานปัญหา - แจ้งปัญหาที่พบ

ติดต่อแอดมิน:
- ตอบกลับใน LINE หรือ
- อีเมล: support@scords.com

ขอบคุณที่ใช้บริการครับ 🙏`;
  }

  /**
   * Get default message
   */
  getDefaultMessage() {
    return `👋 ยินดีต้อนรับสู่ SCORDS Bot

กรุณาเลือกเมนูจาก:
• เมนูด้านล่าง (Rich Menu)
• พิมพ์ "help" สำหรับวิธีใช้งาน

หากมีข้อสงสัย ติดต่อแอดมินได้เลยครับ`;
  }

  /**
   * Log activity to spreadsheet
   */
  async logActivity(userId, action, details = {}) {
    try {
      const now = new Date().toISOString();

      await this.sheetsDB.appendRow('Activities', [
        now,
        userId,
        action,
        JSON.stringify(details)
      ]);

      console.log(`✅ Logged activity: ${action} for ${userId}`);
      return { success: true };
    } catch (error) {
      console.error('❌ logActivity error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Main webhook handler - routes events to appropriate handlers
   */
  async handleWebhook(events, channelAccessToken) {
    const results = [];

    for (const event of events) {
      try {
        console.log(`📥 Processing event type: ${event.type}`);

        let result;

        switch (event.type) {
          case 'follow':
            result = await this.handleFollow(event, channelAccessToken);
            await this.logActivity(event.source?.userId, 'FOLLOW', event);
            break;

          case 'message':
            result = await this.handleMessage(event, channelAccessToken);
            await this.logActivity(event.source?.userId, 'MESSAGE', {
              text: event.message?.text
            });
            break;

          case 'postback':
            result = await this.handlePostback(event, channelAccessToken);
            await this.logActivity(event.source?.userId, 'POSTBACK', {
              data: event.postback?.data
            });
            break;

          case 'unfollow':
            result = await this.handleUnfollow(event);
            await this.logActivity(event.source?.userId, 'UNFOLLOW', event);
            break;

          default:
            console.log(`ℹ️ Unsupported event type: ${event.type}`);
            result = { success: false, error: 'Unsupported event type' };
            break;
        }

        results.push({
          eventType: event.type,
          result
        });
      } catch (error) {
        console.error(`❌ Error processing event ${event.type}:`, error);
        results.push({
          eventType: event.type,
          result: {
            success: false,
            error: error.message
          }
        });
      }
    }

    return {
      success: true,
      processed: results.length,
      results
    };
  }
}

module.exports = ScordsLineWebhook;
