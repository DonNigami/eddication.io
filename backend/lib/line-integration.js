/**
 * LINE Bot Integration Utilities
 * Adapted from GAS for Node.js backend
 * Handles LINE API calls and message responses
 */

const axios = require('axios');

class LineIntegration {
  constructor(channelAccessToken) {
    this.channelAccessToken = channelAccessToken;
    this.baseUrl = 'https://api.line.biz/v2';
  }

  /**
   * Get LINE user profile
   * @param {string} userId - LINE user ID
   * @returns {Promise<object|null>} User profile {displayName, pictureUrl} or null
   */
  async getLineUserProfile(userId) {
    try {
      if (!userId) return null;

      console.log(`📱 getLineUserProfile: userId=${userId}`);

      const response = await axios.get(
        `${this.baseUrl}/bot/profile/${userId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.channelAccessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.data) {
        console.log('❌ getLineUserProfile: empty response');
        return null;
      }

      const profile = {
        displayName: response.data.displayName || '',
        pictureUrl: response.data.pictureUrl || '',
        userId: response.data.userId || userId
      };

      console.log(`✅ getLineUserProfile: got profile for ${profile.displayName}`);
      return profile;
    } catch (err) {
      console.error('❌ getLineUserProfile error:', err.message);
      return null;
    }
  }

  /**
   * Send reply message to user
   * @param {string} replyToken - LINE reply token
   * @param {string|array} messages - Message text or array of messages
   * @returns {Promise<boolean>} Success status
   */
  async sendLineReply(replyToken, messages) {
    try {
      if (!replyToken) {
        console.log('❌ sendLineReply: replyToken required');
        return false;
      }

      console.log(`📤 sendLineReply: sending to replyToken=${replyToken}`);

      const messageArray = Array.isArray(messages)
        ? messages.map(m => ({
            type: 'text',
            text: String(m)
          }))
        : [{ type: 'text', text: String(messages) }];

      const response = await axios.post(
        'https://api.line.biz/v2/bot/message/reply',
        {
          replyToken,
          messages: messageArray
        },
        {
          headers: {
            'Authorization': `Bearer ${this.channelAccessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✅ sendLineReply: sent successfully`);
      return true;
    } catch (err) {
      console.error('❌ sendLineReply error:', err.message);
      return false;
    }
  }

  /**
   * Link rich menu to user
   * @param {string} userId - LINE user ID
   * @param {string} richMenuId - Rich menu ID
   * @returns {Promise<boolean>} Success status
   */
  async linkRichMenuToUser(userId, richMenuId) {
    try {
      if (!userId || !richMenuId) {
        console.log('❌ linkRichMenuToUser: userId and richMenuId required');
        return false;
      }

      console.log(`🔗 linkRichMenuToUser: userId=${userId}, richMenuId=${richMenuId}`);

      const response = await axios.post(
        `${this.baseUrl}/bot/user/${userId}/richmenu/${richMenuId}`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${this.channelAccessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✅ linkRichMenuToUser: linked successfully`);
      return true;
    } catch (err) {
      console.error('❌ linkRichMenuToUser error:', err.message);
      return false;
    }
  }

  /**
   * Unlink rich menu from user
   * @param {string} userId - LINE user ID
   * @returns {Promise<boolean>} Success status
   */
  async unlinkRichMenuFromUser(userId) {
    try {
      if (!userId) {
        console.log('❌ unlinkRichMenuFromUser: userId required');
        return false;
      }

      console.log(`🔓 unlinkRichMenuFromUser: userId=${userId}`);

      const response = await axios.delete(
        `${this.baseUrl}/bot/user/${userId}/richmenu`,
        {
          headers: {
            'Authorization': `Bearer ${this.channelAccessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✅ unlinkRichMenuFromUser: unlinked successfully`);
      return true;
    } catch (err) {
      console.error('❌ unlinkRichMenuFromUser error:', err.message);
      return false;
    }
  }

  /**
   * Handle LINE follow event
   * @param {object} event - LINE webhook event
   * @param {object} userProfileManager - UserProfileManager instance
   * @returns {Promise<boolean>} Success status
   */
  async handleFollowEvent(event, userProfileManager) {
    try {
      if (!event || !event.source || !event.source.userId) {
        console.log('❌ handleFollowEvent: invalid event');
        return false;
      }

      const userId = event.source.userId;
      console.log(`👋 handleFollowEvent: userId=${userId}`);

      // Get LINE profile
      const profile = await this.getLineUserProfile(userId);
      if (!profile) {
        console.log('❌ Could not get LINE profile');
        return false;
      }

      // Update/create user profile in sheet
      const success = await userProfileManager.updateUserProfile(userId, {
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl,
        status: 'PENDING'
      });

      // Send welcome message
      const msg = 'ขอบคุณที่แอดไลน์ครับ 🙏\nระบบได้รับข้อมูลแล้ว กรุณารอแอดมินอนุมัติการใช้งานแอปคนขับ.';
      await this.sendLineReply(event.replyToken, msg);

      return success;
    } catch (err) {
      console.error('❌ handleFollowEvent error:', err.message);
      return false;
    }
  }

  /**
   * Handle LINE message event
   * @param {object} event - LINE webhook event
   * @param {object} userProfileManager - UserProfileManager instance
   * @returns {Promise<boolean>} Success status
   */
  async handleMessageEvent(event, userProfileManager) {
    try {
      if (!event || !event.source || !event.message) {
        console.log('❌ handleMessageEvent: invalid event');
        return false;
      }

      const text = (event.message.text || '').trim();
      const userId = event.source.userId;

      console.log(`💬 handleMessageEvent: userId=${userId}, text="${text}"`);

      let reply = '';

      if (text.toLowerCase() === 'status') {
        // Check user status
        const status = await userProfileManager.getUserStatus(userId);
        reply = `สถานะของคุณ: ${status || 'ไม่พบข้อมูล / ยังไม่ลงทะเบียน'}`;
      } else {
        // Default response
        reply = 'หากคุณเป็นคนขับงานนี้ ให้กดเมนูด้านล่างเพื่อเข้าแอปรับงานครับ';
      }

      await this.sendLineReply(event.replyToken, reply);
      return true;
    } catch (err) {
      console.error('❌ handleMessageEvent error:', err.message);
      return false;
    }
  }

  /**
   * Broadcast message to multiple users
   * @param {string[]} userIds - Array of LINE user IDs
   * @param {string|array} messages - Message(s) to send
   * @returns {Promise<object>} {success: count, failed: count}
   */
  async broadcastToUsers(userIds, messages) {
    try {
      if (!userIds || userIds.length === 0) {
        console.log('❌ broadcastToUsers: userIds required');
        return { success: 0, failed: 0 };
      }

      console.log(`📢 broadcastToUsers: sending to ${userIds.length} users`);

      const messageArray = Array.isArray(messages)
        ? messages.map(m => ({
            type: 'text',
            text: String(m)
          }))
        : [{ type: 'text', text: String(messages) }];

      let success = 0;
      let failed = 0;

      for (const userId of userIds) {
        try {
          await axios.post(
            `${this.baseUrl}/bot/message/push`,
            {
              to: userId,
              messages: messageArray
            },
            {
              headers: {
                'Authorization': `Bearer ${this.channelAccessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          success++;
        } catch (err) {
          console.warn(`⚠️ Failed to send to ${userId}: ${err.message}`);
          failed++;
        }
      }

      console.log(`✅ broadcastToUsers: success=${success}, failed=${failed}`);
      return { success, failed };
    } catch (err) {
      console.error('❌ broadcastToUsers error:', err.message);
      return { success: 0, failed: userIds.length };
    }
  }
}

module.exports = LineIntegration;
