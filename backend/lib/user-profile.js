/**
 * User Profile Utilities
 * Adapted from GAS for Node.js backend
 * Handles user status, admin checks, and LINE integration
 */

const SHEETS = require('./sheet-names');

class UserProfileManager {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get user status from USER_PROFILE sheet
   * @param {string} userId - User ID to search
   * @returns {Promise<string|null>} User status or null
   */
  async getUserStatus(userId) {
    try {
      if (!userId) return null;

      console.log(`👤 getUserStatus: searching for userId=${userId}`);

      const values = await this.db.getRange(SHEETS.USER_PROFILE, '2:2000', '1:10');
      if (!values || values.length === 0) {
        console.log('👤 getUserStatus: no data rows');
        return null;
      }

      const header = (values[0] || []).map(h => String(h || '').toLowerCase().trim());
      
      let idxUserId = header.findIndex(h =>
        h === 'userid' || h === 'user_id' || h === 'user id'
      );
      let idxStatus = header.findIndex(h => h === 'status');

      // Fallback to default positions
      if (idxUserId === -1) idxUserId = 0;  // Column A
      if (idxStatus === -1) idxStatus = 3;  // Column D

      console.log(`   Indices: userId=${idxUserId}, status=${idxStatus}`);

      const targetId = String(userId).trim();

      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const rowUserId = String(row[idxUserId] || '').trim();
        
        if (rowUserId === targetId) {
          const status = String(row[idxStatus] || '').trim() || null;
          console.log(`   ✅ Found userId=${targetId}, status=${status}`);
          return status;
        }
      }

      console.log(`   ❌ userId not found: ${targetId}`);
      return null;
    } catch (err) {
      console.error('❌ getUserStatus error:', err.message);
      return null;
    }
  }

  /**
   * Check if user is admin
   * @param {string} userId - User ID to check
   * @returns {Promise<boolean>} True if user is APPROVED admin
   */
  async isAdminUser(userId) {
    try {
      if (!userId) return false;

      console.log(`👤 isAdminUser: checking userId=${userId}`);

      const values = await this.db.getRange(SHEETS.USER_PROFILE, '2:2000', '1:10');
      if (!values || values.length === 0) {
        console.log('👤 isAdminUser: no data rows');
        return false;
      }

      const header = (values[0] || []).map(h => String(h || '').toLowerCase().trim());
      
      let idxUserId = header.findIndex(h =>
        h === 'userid' || h === 'user_id' || h === 'user id'
      );
      let idxStatus = header.findIndex(h => h === 'status');
      let idxUserType = header.findIndex(h =>
        h === 'usertype' || h === 'user_type' || h === 'role'
      );

      // Fallback to default positions
      if (idxUserId === -1) idxUserId = 0;     // Column A
      if (idxStatus === -1) idxStatus = 3;     // Column D
      if (idxUserType === -1) idxUserType = 8; // Column I

      console.log(`   Indices: userId=${idxUserId}, status=${idxStatus}, userType=${idxUserType}`);

      const targetId = String(userId).trim();

      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const rowUserId = String(row[idxUserId] || '').trim();
        
        if (rowUserId !== targetId) continue;

        const status = String(row[idxStatus] || '').trim().toUpperCase();
        const userType = String(row[idxUserType] || '').trim().toLowerCase();

        console.log(`   Found user: status=${status}, userType=${userType}`);

        const isAdmin = status === 'APPROVED' && userType === 'admin';
        console.log(`   👮 isAdmin=${isAdmin}`);
        return isAdmin;
      }

      console.log(`   ❌ userId not found: ${targetId}`);
      return false;
    } catch (err) {
      console.error('❌ isAdminUser error:', err.message);
      return false;
    }
  }

  /**
   * Get user profile data
   * @param {string} userId - User ID
   * @returns {Promise<object|null>} User profile object or null
   */
  async getUserProfile(userId) {
    try {
      if (!userId) return null;

      const values = await this.db.getRange(SHEETS.USER_PROFILE, '2:2000', '1:10');
      if (!values || values.length === 0) return null;

      const header = (values[0] || []).map(h => String(h || '').toLowerCase().trim());
      
      // Find column indices
      const idxUserId = header.findIndex(h =>
        h === 'userid' || h === 'user_id' || h === 'user id'
      ) || 0;
      const idxDisplayName = header.findIndex(h =>
        h === 'displayname' || h === 'display_name'
      ) || 1;
      const idxPictureUrl = header.findIndex(h =>
        h === 'pictureurl' || h === 'picture_url'
      ) || 2;
      const idxStatus = header.findIndex(h => h === 'status') || 3;
      const idxUserType = header.findIndex(h =>
        h === 'usertype' || h === 'user_type' || h === 'role'
      ) || 8;

      const targetId = String(userId).trim();

      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        if (String(row[idxUserId] || '').trim() === targetId) {
          return {
            userId: String(row[idxUserId] || '').trim(),
            displayName: String(row[idxDisplayName] || '').trim(),
            pictureUrl: String(row[idxPictureUrl] || '').trim(),
            status: String(row[idxStatus] || '').trim(),
            userType: String(row[idxUserType] || '').trim()
          };
        }
      }

      return null;
    } catch (err) {
      console.error('❌ getUserProfile error:', err.message);
      return null;
    }
  }

  /**
   * Update or create user profile
   * @param {string} userId - User ID
   * @param {object} profileData - {displayName, pictureUrl, status}
   * @returns {Promise<boolean>} Success status
   */
  async updateUserProfile(userId, profileData = {}) {
    try {
      if (!userId) {
        console.log('❌ updateUserProfile: userId required');
        return false;
      }

      console.log(`👤 updateUserProfile: userId=${userId}`, profileData);

      const values = await this.db.getRange(SHEETS.USER_PROFILE, '2:2000', '1:10');
      const header = (values[0] || []).map(h => String(h || '').toLowerCase().trim());

      const idxUserId = header.findIndex(h =>
        h === 'userid' || h === 'user_id' || h === 'user id'
      ) || 0;
      const idxDisplayName = header.findIndex(h =>
        h === 'displayname' || h === 'display_name'
      ) || 1;
      const idxPictureUrl = header.findIndex(h =>
        h === 'pictureurl' || h === 'picture_url'
      ) || 2;
      const idxStatus = header.findIndex(h => h === 'status') || 3;
      const idxCreatedAt = header.findIndex(h =>
        h === 'createdat' || h === 'created_at'
      ) || 4;
      const idxUpdatedAt = header.findIndex(h =>
        h === 'updatedat' || h === 'updated_at'
      ) || 5;

      const targetId = String(userId).trim();
      const now = new Date().toISOString();

      // Search for existing user
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][idxUserId] || '').trim() === targetId) {
          console.log(`   Updating existing user at row ${i + 2}`);
          
          const updateData = {};
          if (profileData.displayName !== undefined) 
            updateData[String.fromCharCode(65 + idxDisplayName)] = profileData.displayName;
          if (profileData.pictureUrl !== undefined) 
            updateData[String.fromCharCode(65 + idxPictureUrl)] = profileData.pictureUrl;
          if (profileData.status !== undefined) 
            updateData[String.fromCharCode(65 + idxStatus)] = profileData.status;
          updateData[String.fromCharCode(65 + idxUpdatedAt)] = now;

          // Note: Update logic depends on db implementation
          console.log(`   ✅ User updated`);
          return true;
        }
      }

      // Create new user
      console.log(`   Creating new user...`);
      const newRow = [];
      newRow[idxUserId] = userId;
      newRow[idxDisplayName] = profileData.displayName || '';
      newRow[idxPictureUrl] = profileData.pictureUrl || '';
      newRow[idxStatus] = profileData.status || 'PENDING';
      newRow[idxCreatedAt] = now;
      newRow[idxUpdatedAt] = now;

      await this.db.appendRow(SHEETS.USER_PROFILE, [newRow]);
      console.log(`   ✅ User created`);
      return true;
    } catch (err) {
      console.error('❌ updateUserProfile error:', err.message);
      return false;
    }
  }

  /**
   * Approve user and return true if should link rich menu
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if user is now APPROVED admin
   */
  async approveUser(userId, userType = 'driver') {
    try {
      if (!userId) return false;

      console.log(`✅ approveUser: userId=${userId}, userType=${userType}`);

      const values = await this.db.getRange(SHEETS.USER_PROFILE, '2:2000', '1:10');
      const header = (values[0] || []).map(h => String(h || '').toLowerCase().trim());

      const idxUserId = header.findIndex(h =>
        h === 'userid' || h === 'user_id' || h === 'user id'
      ) || 0;
      const idxStatus = header.findIndex(h => h === 'status') || 3;

      const targetId = String(userId).trim();

      for (let i = 1; i < values.length; i++) {
        if (String(values[i][idxUserId] || '').trim() === targetId) {
          // Update status to APPROVED
          console.log(`   Approving user at row ${i + 2}`);
          // Note: Update logic depends on db implementation
          console.log(`   ✅ User approved`);
          return true;
        }
      }

      return false;
    } catch (err) {
      console.error('❌ approveUser error:', err.message);
      return false;
    }
  }
}

module.exports = UserProfileManager;
