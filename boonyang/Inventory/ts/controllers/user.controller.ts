/**
 * User Controller
 * Handles user management, permissions, and registration
 * Replaces user management logic from code.js
 */

import { supabaseService } from '../services/supabase.service';
import { createLineService } from '../services/line.service';
import { LineEvent, FlowStatus, RegistrationStatus, UserRole } from '../types';
import { flexRegister, ansFlex } from '../templates/flex.templates';

export class UserController {
  private lineService = createLineService(process.env.LINE_CHANNEL_TOKEN || '');

  // ============================================
  // User Lookup
  // ============================================

  async findUserRow(userId: string): Promise<number | null> {
    const user = await supabaseService.getUserById(userId);
    return user ? user.id : null;
  }

  async getUserStaff(userId: string): Promise<UserRole | null> {
    const statusRegister = await this.getUserStatusRegister(userId);

    if (statusRegister === 'สำเร็จ') {
      return 'customer'; // For now, all completed registrations are customers
    }

    return null;
  }

  async isApprovedUser(userId: string): Promise<boolean> {
    const staff = await this.getUserStaff(userId);
    return staff === 'admin' || staff === 'customer';
  }

  async canUserAskStock(userId: string): Promise<boolean> {
    const systemSettings = await supabaseService.getSystemSettings();

    if (!systemSettings?.stock_enabled) return false;
    if (!systemSettings?.stock_require_approval) return true;

    return await this.isApprovedUser(userId);
  }

  async getUserStatusRegister(userId: string): Promise<RegistrationStatus | null> {
    const user = await supabaseService.getUserById(userId);
    return user?.status_register || null;
  }

  // ============================================
  // User Registration
  // ============================================

  async executeFollow(reqEvent: LineEvent): Promise<void> {
    try {
      const profile = await this.lineService.getUserProfile(
        reqEvent.source.userId!
      );

      const { userId, displayName, pictureUrl, statusMessage } = profile;

      // Check if user already exists
      const existingUser = await supabaseService.getUserById(userId);

      if (!existingUser) {
        const now = new Date();
        const registrationDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const registrationTime = now.toTimeString().split(' ')[0]; // HH:mm:ss

        await supabaseService.createUser({
          user_id: userId,
          display_name: displayName,
          picture_url: pictureUrl,
          status_message: statusMessage || '',
          image_formula: '', // Could generate from pictureUrl
          registration_date: registrationDate,
          registration_time: registrationTime,
          language: profile.language || 'th',
          group_name: '',
          group_id: '',
          status_register: '', // Empty initially
          reference: '',
          name: '',
          surname: '',
          shop_name: '',
          tax_id: '',
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
          last_interaction_at: now.toISOString(),
        });

        // TODO: Send telegram notification
        console.log(`✅ New user registered: ${displayName} (${userId})`);

        // TODO: Send follow message from settings
      }
    } catch (error) {
      console.error('❌ ERROR @ executeFollow:', error);
    }
  }

  async registerNewUser(reqEvent: LineEvent): Promise<void> {
    const profile = await this.lineService.getUserProfile(
      reqEvent.source.userId!
    );

    const now = new Date();
    const registrationDate = now.toISOString().split('T')[0];
    const registrationTime = now.toTimeString().split(' ')[0];

    await supabaseService.createUser({
      user_id: profile.userId,
      display_name: profile.displayName,
      picture_url: profile.pictureUrl || '',
      status_message: profile.statusMessage || '',
      image_formula: '',
      registration_date: registrationDate,
      registration_time: registrationTime,
      language: profile.language || 'th',
      group_name: '',
      group_id: '',
      status_register: '',
      reference: '',
      name: '',
      surname: '',
      shop_name: '',
      tax_id: '',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      last_interaction_at: now.toISOString(),
    });
  }

  async removeUserFromDatabase(senderId: string): Promise<void> {
    await supabaseService.deleteUser(senderId);
    console.log(`✅ User removed: ${senderId}`);
  }

  // ============================================
  // Registration Flow
  // ============================================

  async handleRegistrationFlow(reqEvent: LineEvent): Promise<void> {
    const userId = reqEvent.source.userId!;
    const messageText = reqEvent.message?.text?.trim() || '';
    const replyToken = reqEvent.replyToken!;

    // Get current user status
    const user = await supabaseService.getUserById(userId);

    if (!user) {
      await this.registerNewUser(reqEvent);
      return;
    }

    const statusRegister = user.status_register;

    // Step 1: Start registration
    if (messageText === 'ลงทะเบียน') {
      await supabaseService.updateUser(userId, {
        status_register: 'รอชื่อ',
      });

      const icon =
        'https://cdn4.iconfinder.com/data/icons/business-331/24/name_id_tag_license_identity_office_1-512.png';
      const flexMsg = ansFlex(icon, 'ลงทะเบียน', 'โปรดกรอกชื่อของคุณ');

      await this.lineService.replyMessage(replyToken, [flexMsg]);
      return;
    }

    // Step 2: Waiting for name
    if (statusRegister === 'รอชื่อ') {
      await supabaseService.updateUser(userId, {
        name: messageText,
        status_register: 'รอนามสกุล',
      });

      const icon =
        'https://cdn4.iconfinder.com/data/icons/business-331/24/name_id_tag_license_identity_office_1-512.png';
      const flexMsg = ansFlex(icon, user.name, 'โปรดกรอกนามสกุลของคุณ');

      await this.lineService.replyMessage(replyToken, [flexMsg]);
      return;
    }

    // Step 3: Waiting for surname
    if (statusRegister === 'รอนามสกุล') {
      await supabaseService.updateUser(userId, {
        surname: messageText,
        status_register: 'รอชื่อร้าน',
      });

      const icon =
        'https://cdn4.iconfinder.com/data/icons/business-331/24/name_id_tag_license_identity_office_1-512.png';
      const flexMsg = ansFlex(icon, user.surname, 'กรุณากรอกชื่อร้าน');

      await this.lineService.replyMessage(replyToken, [flexMsg]);
      return;
    }

    // Step 4: Waiting for shop name
    if (statusRegister === 'รอชื่อร้าน') {
      await supabaseService.updateUser(userId, {
        shop_name: messageText,
        status_register: 'รอเลขที่ภาษี',
      });

      const icon =
        'https://cdn4.iconfinder.com/data/icons/business-331/24/name_id_tag_license_identity_office_1-512.png';
      const flexMsg = ansFlex(icon, user.shop_name, 'กรุณากรอกเลขที่ผู้เสียภาษี');

      await this.lineService.replyMessage(replyToken, [flexMsg]);
      return;
    }

    // Step 5: Waiting for tax ID (final step)
    if (statusRegister === 'รอเลขที่ภาษี') {
      await supabaseService.updateUser(userId, {
        tax_id: messageText,
        status_register: 'สำเร็จ',
      });

      const profile = await this.lineService.getUserProfile(userId);

      const flexMsg = flexRegister(
        profile.pictureUrl || '',
        profile.displayName,
        user.name,
        user.surname,
        user.shop_name,
        messageText
      );

      await this.lineService.replyMessage(replyToken, [flexMsg]);
      return;
    }
  }

  // ============================================
  // Permission Checks
  // ============================================

  async isBotEnabled(): Promise<boolean> {
    const settings = await supabaseService.getSystemSettings();
    return settings?.bot_enabled ?? true;
  }

  async isStockEnabled(): Promise<boolean> {
    const settings = await supabaseService.getSystemSettings();
    return settings?.stock_enabled ?? true;
  }

  async isStockRequireApproval(): Promise<boolean> {
    const settings = await supabaseService.getSystemSettings();
    return settings?.stock_require_approval ?? true;
  }

  async isRegisterRequired(): Promise<boolean> {
    const settings = await supabaseService.getSystemSettings();
    return settings?.register_required ?? true;
  }

  async setUserStaffById(
    targetUserId: string,
    roleValue: UserRole
  ): Promise<boolean> {
    try {
      // Map role to status_register
      const statusRegister = roleValue === 'admin' || roleValue === 'customer' ? 'สำเร็จ' : '';

      await supabaseService.updateUser(targetUserId, {
        status_register: statusRegister,
      });

      console.log(`✅ Updated ${targetUserId} role to ${roleValue}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to update user role: ${error}`);
      return false;
    }
  }

  async updateUserLastInteraction(userId: string): Promise<void> {
    await supabaseService.updateUser(userId, {
      last_interaction_at: new Date().toISOString(),
    });
  }
}

// Singleton instance
export const userController = new UserController();
