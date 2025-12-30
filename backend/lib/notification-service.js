/**
 * Notification Service
 * Handles customer notifications via Google Chat and Email
 */

const { google } = require('googleapis');
const axios = require('axios');

class NotificationService {
  constructor() {
    this.gmail = null;
    this.chat = null;
    this.auth = null;
    // Admin notification webhook - receives copy of all notifications
    this.ADMIN_WEBHOOK = process.env.ADMIN_NOTIFICATION_WEBHOOK ||
      'https://chat.googleapis.com/v1/spaces/AAQAAH60ZLc/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=RJhjQpH0wC8IPM20dvfa9Z3aBSQL98UGc-udv4UEvFw';
  }

  /**
   * Initialize Gmail API and Google Chat API
   */
  async initializeGmail(auth) {
    try {
      this.auth = auth;
      this.gmail = google.gmail({ version: 'v1', auth });
      this.chat = google.chat({ version: 'v1', auth });
      console.log('✅ Gmail API initialized');
      console.log('✅ Google Chat API initialized');
    } catch (err) {
      console.error('❌ Failed to initialize APIs:', err.message);
    }
  }

  /**
   * Send notification to customer when driver checks in
   */
  async notifyCheckIn({ customerName, customerEmail, chatEmail, chatWebhook, driverName, shipmentNo, destination, estimatedArrival }) {
    const message = `
🚛 *แจ้งเตือน: คนขับออกเดินทาง*

สวัสดีครับคุณ ${customerName}

คนขับ *${driverName}* ได้ออกเดินทางมาส่งของแล้วครับ

📦 *เลขที่ shipment:* ${shipmentNo}
📍 *ปลายทาง:* ${destination}
⏰ *เวลาถึงโดยประมาณ:* ${estimatedArrival || 'ไม่ระบุ'}

ขอบคุณที่ใช้บริการครับ
    `.trim();

    return this._sendNotification({
      to: customerEmail,
      chatEmail: chatEmail,
      webhook: chatWebhook,
      subject: `แจ้งเตือน: คนขับออกเดินทาง - ${shipmentNo}`,
      message
    });
  }

  /**
   * Send notification when approaching destination
   */
  async notifyNearby({ customerName, customerEmail, chatEmail, chatWebhook, driverName, shipmentNo, destination, minutesAway }) {
    const message = `
🚛 *แจ้งเตือน: คนขับใกล้ถึงแล้ว*

สวัสดีครับคุณ ${customerName}

คนขับ *${driverName}* กำลังเดินทางมาถึงแล้วครับ

📦 *เลขที่ shipment:* ${shipmentNo}
📍 *ปลายทาง:* ${destination}
⏰ *คาดว่าจะถึงใน:* ประมาณ ${minutesAway} นาที

กรุณาเตรียมรับสินค้าด้วยครับ
    `.trim();

    return this._sendNotification({
      to: customerEmail,
      chatEmail: chatEmail,
      webhook: chatWebhook,
      subject: `แจ้งเตือน: คนขับใกล้ถึงแล้ว - ${shipmentNo}`,
      message
    });
  }

  /**
   * Send notification when delivery is completed
   */
  async notifyCompleted({ customerName, customerEmail, chatEmail, chatWebhook, driverName, shipmentNo, destination, deliveryTime }) {
    const message = `
✅ *แจ้งเตือน: ส่งของสำเร็จ*

สวัสดีครับคุณ ${customerName}

คนขับ *${driverName}* ได้ส่งของเรียบร้อยแล้วครับ

📦 *เลขที่ shipment:* ${shipmentNo}
📍 *ปลายทาง:* ${destination}
⏰ *เวลาส่งของ:* ${deliveryTime}

ขอบคุณที่ใช้บริการครับ 🙏
    `.trim();

    return this._sendNotification({
      to: customerEmail,
      chatEmail: chatEmail,
      webhook: chatWebhook,
      subject: `แจ้งเตือน: ส่งของสำเร็จ - ${shipmentNo}`,
      message
    });
  }

  /**
   * Send notification about delivery issue/delay
   */
  async notifyIssue({ customerName, customerEmail, chatEmail, chatWebhook, driverName, shipmentNo, destination, issueType, issueDescription }) {
    const issueIcons = {
      delay: '⏰',
      damaged: '📦',
      customer_not_available: '🚫',
      road_closed: '🚧',
      accident: '⚠️',
      other: 'ℹ️'
    };

    const icon = issueIcons[issueType] || 'ℹ️';

    const message = `
${icon} *แจ้งเตือน: มีปัญหาในการจัดส่ง*

สวัสดีครับคุณ ${customerName}

เกิดปัญหาในการจัดส่งครับ

📦 *เลขที่ shipment:* ${shipmentNo}
📍 *ปลายทาง:* ${destination}
👤 *คนขับ:* ${driverName}
⚠️ *ปัญหา:* ${issueDescription}

เราจะติดต่อกลับไปให้เร็วที่สุดครับ
    `.trim();

    return this._sendNotification({
      to: customerEmail,
      chatEmail: chatEmail,
      webhook: chatWebhook,
      subject: `แจ้งเตือน: มีปัญหาในการจัดส่ง - ${shipmentNo}`,
      message
    });
  }

  /**
   * Internal method to send notification via multiple channels
   * Supports: chatEmail (direct DM) → chatWebhook (space) → email
   * Also sends copy to admin webhook for monitoring
   */
  async _sendNotification({ to, chatEmail, webhook, subject, message }) {
    const results = {
      chat: null,
      email: null,
      admin: null
    };

    // Priority 1: Send Google Chat direct message (if chatEmail provided)
    if (chatEmail) {
      results.chat = await this._sendGoogleChat(chatEmail, message);
    }

    // Priority 2: Send to webhook (if chatEmail not provided)
    if (!chatEmail && webhook) {
      results.chat = await this._sendGoogleChat(webhook, message);
    }

    // Priority 3: Send Email notification (if email provided)
    if (to) {
      results.email = await this._sendEmail(to, subject, message);
    }

    // Send copy to admin webhook (always)
    if (this.ADMIN_WEBHOOK) {
      const adminMessage = `📋 *สำเนาการแจ้งเตือน*\n\n` +
        `👤 ถึง: ${to || chatEmail || 'N/A'}\n` +
        `📝 หัวข้อ: ${subject || 'Notification'}\n` +
        `⏰ เวลา: ${new Date().toLocaleString('th-TH')}\n\n` +
        `${message}`;

      results.admin = await this._sendGoogleChatWebhook(this.ADMIN_WEBHOOK, adminMessage);
    }

    return results;
  }

  /**
   * Send message to Google Chat via webhook OR direct DM
   * Supports both webhook (space) and direct message to user email
   */
  async _sendGoogleChat(webhookUrlOrUserEmail, message) {
    // Check if it's a webhook URL (starts with https://)
    if (webhookUrlOrUserEmail && webhookUrlOrUserEmail.startsWith('https://')) {
      return this._sendGoogleChatWebhook(webhookUrlOrUserEmail, message);
    }

    // Otherwise treat as user email for direct message
    if (webhookUrlOrUserEmail && webhookUrlOrUserEmail.includes('@')) {
      return this._sendGoogleChatDM(webhookUrlOrUserEmail, message);
    }

    return { success: false, error: 'Invalid webhook URL or email address' };
  }

  /**
   * Send message to Google Chat via webhook (space)
   */
  async _sendGoogleChatWebhook(webhookUrl, message) {
    try {
      const response = await axios.post(webhookUrl, {
        text: message
      });

      console.log('✅ Google Chat webhook notification sent');
      return { success: true };
    } catch (err) {
      console.error('❌ Failed to send Google Chat webhook:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Send direct message to user's personal Google Chat
   * Requires service account with Chat API enabled and permission to send DMs
   */
  async _sendGoogleChatDM(userEmail, message) {
    try {
      if (!this.chat) {
        console.warn('⚠️ Google Chat API not initialized, cannot send DM to', userEmail);
        return { success: false, error: 'Chat API not initialized' };
      }

      // Create a direct message space with the user
      // The space name format for DMs is: users/{user}/spaces/{space}
      // We need to find or create the space first

      const response = await this.chat.users.spaces.createDirect({
        requestBody: {
          displayName: `Chat with ${userEmail}`
        }
      });

      const spaceName = response.data.name;

      // Send message to the direct message space
      await this.chat.spaces.messages.create({
        parent: spaceName,
        requestBody: {
          text: message
        }
      });

      console.log(`✅ Google Chat DM sent to ${userEmail}`);
      return { success: true };
    } catch (err) {
      // If DM creation fails (user doesn't exist or permissions issue)
      console.error(`❌ Failed to send Google Chat DM to ${userEmail}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Send email via Gmail API
   */
  async _sendEmail(to, subject, body) {
    try {
      // If Gmail not initialized, return success but don't send
      if (!this.gmail) {
        console.log('⚠️ Gmail API not initialized, skipping email');
        return { success: true, skipped: true };
      }

      const message = [
        `To: ${to}`,
        'Content-Type: text/plain; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${subject}`,
        '',
        body
      ].join('\n');

      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage
        }
      });

      console.log('✅ Email notification sent to', to);
      return { success: true };
    } catch (err) {
      console.error('❌ Failed to send email:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Send subscription notification to Telegram
   * Sends customer information, package details, and payment slip
   */
  async notifySubscriptionTelegram(subscriptionData) {
    try {
      const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
      const telegramChatId = process.env.TELEGRAM_CHAT_ID;

      if (!telegramBotToken || !telegramChatId) {
        console.warn('⚠️ Telegram credentials not configured');
        return { success: false, error: 'Telegram not configured' };
      }

      const {
        package_name,
        customer_info,
        duration_months,
        total_price,
        original_price,
        discount_percent,
        slip_url,
        submission_time,
        line_user_id
      } = subscriptionData;

      // Format message with customer and payment details
      const message = `
🎉 *แจ้งเตือนใหม่: การสมัครสมาชิก*

👤 *ข้อมูลลูกค้า:*
• ชื่อ: ${customer_info.name}
• เบอร์โทร: ${customer_info.phone}
• LINE User ID: ${line_user_id || 'ไม่ระบุ'}

📦 *รายละเอียดแพคเกจ:*
• ชื่อแพคเกจ: ${package_name}
• ระยะเวลา: ${duration_months} เดือน
• ราคาตั้งต้น: ฿${original_price.toLocaleString()}
• ส่วนลด: ${discount_percent}%
• ราคาสุดท้าย: ฿${total_price.toLocaleString()}

📝 *เลขที่อ้างอิง:* ${Date.now()}
🕐 *เวลา:* ${new Date(submission_time).toLocaleString('th-TH', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })}

🖼️ *สลิปการโอนเงิน:*
${slip_url}
      `.trim();

      // Send to Telegram
      const response = await axios.post(
        `https://api.telegram.org/bot${telegramBotToken}/sendMessage`,
        {
          chat_id: telegramChatId,
          text: message,
          parse_mode: 'Markdown'
        }
      );

      if (response.data.ok) {
        console.log('✅ Telegram notification sent successfully');

        // Send slip image as photo
        if (slip_url) {
          await axios.post(
            `https://api.telegram.org/bot${telegramBotToken}/sendPhoto`,
            {
              chat_id: telegramChatId,
              photo: slip_url,
              caption: `สลิปการโอนเงิน - ${customer_info.name}`,
              parse_mode: 'Markdown'
            }
          );
          console.log('✅ Slip image sent to Telegram');
        }

        return { success: true };
      } else {
        throw new Error(response.data.description);
      }
    } catch (error) {
      console.error('❌ Failed to send Telegram notification:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = { NotificationService };
