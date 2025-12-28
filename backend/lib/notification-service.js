/**
 * Notification Service
 * Handles customer notifications via Google Chat and Email
 */

const { google } = require('googleapis');
const axios = require('axios');

class NotificationService {
  constructor() {
    this.gmail = null;
    this.auth = null;
  }

  /**
   * Initialize Gmail API (optional - only if email notifications needed)
   */
  async initializeGmail(auth) {
    try {
      this.auth = auth;
      this.gmail = google.gmail({ version: 'v1', auth });
      console.log('✅ Gmail API initialized');
    } catch (err) {
      console.error('❌ Failed to initialize Gmail:', err.message);
    }
  }

  /**
   * Send notification to customer when driver checks in
   */
  async notifyCheckIn({ customerName, customerEmail, chatWebhook, driverName, shipmentNo, destination, estimatedArrival }) {
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
      webhook: chatWebhook,
      subject: `แจ้งเตือน: คนขับออกเดินทาง - ${shipmentNo}`,
      message
    });
  }

  /**
   * Send notification when driver is near destination
   */
  async notifyNearby({ customerName, customerEmail, chatWebhook, driverName, shipmentNo, destination, minutesAway }) {
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
      webhook: chatWebhook,
      subject: `แจ้งเตือน: คนขับใกล้ถึงแล้ว - ${shipmentNo}`,
      message
    });
  }

  /**
   * Send notification when delivery is completed
   */
  async notifyCompleted({ customerName, customerEmail, chatWebhook, driverName, shipmentNo, destination, deliveryTime }) {
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
      webhook: chatWebhook,
      subject: `แจ้งเตือน: ส่งของสำเร็จ - ${shipmentNo}`,
      message
    });
  }

  /**
   * Send notification about delivery issue/delay
   */
  async notifyIssue({ customerName, customerEmail, chatWebhook, driverName, shipmentNo, destination, issueType, issueDescription }) {
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
      webhook: chatWebhook,
      subject: `แจ้งเตือน: มีปัญหาในการจัดส่ง - ${shipmentNo}`,
      message
    });
  }

  /**
   * Internal method to send notification via multiple channels
   */
  async _sendNotification({ to, webhook, subject, message }) {
    const results = {
      email: null,
      chat: null
    };

    // Send Google Chat notification (if webhook provided)
    if (webhook) {
      results.chat = await this._sendGoogleChat(webhook, message);
    }

    // Send Email notification (if email provided)
    if (to) {
      results.email = await this._sendEmail(to, subject, message);
    }

    return results;
  }

  /**
   * Send message to Google Chat via webhook
   */
  async _sendGoogleChat(webhookUrl, message) {
    try {
      const response = await axios.post(webhookUrl, {
        text: message
      });

      console.log('✅ Google Chat notification sent');
      return { success: true };
    } catch (err) {
      console.error('❌ Failed to send Google Chat:', err.message);
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
}

module.exports = { NotificationService };
