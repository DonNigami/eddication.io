/**
 * Google Drive Storage Module
 * Handles uploading images and documents to Google Drive folders
 */

const { google } = require('googleapis');
const { Readable } = require('stream');

class DriveStorage {
  constructor(credentialsSource, options = {}) {
    this.credentialsSource = credentialsSource;
    this.impersonateEmail = options.impersonateEmail || process.env.GOOGLE_IMPERSONATE_EMAIL || null;
    this.drive = null;
    this.auth = null;
  }

  async initialize() {
    try {
      console.log('🔧 DriveStorage.initialize() starting...');
      let credentials;
      
      if (!this.credentialsSource) {
        throw new Error('GOOGLE_SHEETS_CREDENTIALS_JSON or GOOGLE_SHEETS_KEY_FILE environment variable is required');
      }
      
      console.log('   Parsing credentials...');
      if (this.credentialsSource.startsWith('{')) {
        credentials = JSON.parse(this.credentialsSource);
        console.log('   ✓ Parsed from JSON string');
      } else {
        const fs = require('fs');
        if (fs.existsSync(this.credentialsSource)) {
          const raw = fs.readFileSync(this.credentialsSource, 'utf-8');
          credentials = JSON.parse(raw);
          console.log(`   ✓ Loaded from file: ${this.credentialsSource}`);
        } else {
          throw new Error(`Credentials not found: ${this.credentialsSource}`);
        }
      }

      console.log('   Authenticating with Google...');
      this.auth = new google.auth.GoogleAuth({
        credentials,
        scopes: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/drive.file'
        ],
        subject: this.impersonateEmail || undefined // domain-wide delegation to a user with Drive quota
      });

      this.drive = google.drive({ version: 'v3', auth: this.auth });
      console.log('✅ Google Drive authenticated successfully');
    } catch (err) {
      console.error('❌ Failed to initialize Google Drive:', err.message);
      throw err;
    }
  }

  /**
   * Get or create a folder by name within a parent folder
   * @param {string} parentFolderId - Parent folder ID
   * @param {string} folderName - Name of folder to find/create
   * @returns {Promise<string>} Folder ID
   */
  async getOrCreateFolder(parentFolderId, folderName) {
    try {
      console.log(`   📁 getOrCreateFolder: name=${folderName}, parent=${parentFolderId}`);
      
      // Search for existing folder
      const response = await this.drive.files.list({
        q: `'${parentFolderId}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        spaces: 'drive',
        fields: 'files(id, name)',
        pageSize: 1,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      });

      if (response.data.files && response.data.files.length > 0) {
        const folderId = response.data.files[0].id;
        console.log(`   ✅ Found existing folder: ${folderName} → ${folderId}`);
        return folderId;
      }

      // Create new folder
      console.log(`   🆕 Creating new folder: ${folderName}`);
      const createResponse = await this.drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentFolderId]
        },
        fields: 'id',
        supportsAllDrives: true
      });

      const newFolderId = createResponse.data.id;
      console.log(`   ✅ Created new folder: ${folderName} → ${newFolderId}`);
      return newFolderId;
    } catch (err) {
      console.error(`❌ Failed to get/create folder ${folderName}:`, err.message);
      throw err;
    }
  }

  /**
   * Upload image buffer to Drive
   * @param {Buffer} imageBuffer - Image data
   * @param {string} filename - File name
   * @param {string} parentFolderId - Parent folder ID in Drive
   * @returns {Promise<string>} File URL
   */
  async uploadImage(imageBuffer, filename, parentFolderId) {
    try {
      console.log(`   📤 uploadImage: filename=${filename}, size=${imageBuffer.length} bytes`);
      
      // Convert buffer to stream for compatibility with newer googleapis
      const stream = Readable.from(imageBuffer);
      
      const response = await this.drive.files.create({
        requestBody: {
          name: filename,
          parents: [parentFolderId],
          mimeType: 'image/jpeg'
        },
        media: {
          mimeType: 'image/jpeg',
          body: stream
        },
        fields: 'id, webViewLink',
        supportsAllDrives: true
      });

      const fileId = response.data.id;
      const fileUrl = `https://drive.google.com/file/d/${fileId}/view?usp=drivesdk`;

      // Make file publicly readable (optional - adjust as needed)
      try {
        await this.drive.permissions.create({
          fileId: fileId,
          requestBody: {
            role: 'reader',
            type: 'anyone'
          },
          supportsAllDrives: true
        });
      } catch (permErr) {
        console.warn('⚠️ Could not set public read permission:', permErr.message);
      }

      console.log(`   ✅ Uploaded to Drive: ${filename} → ${fileId}`);
      return { fileId, fileUrl };
    } catch (err) {
      console.error(`❌ Failed to upload image ${filename}:`, err.message);
      throw err;
    }
  }

  /**
   * Upload image to Drive with user folder organization
   * @param {Buffer} imageBuffer - Image data
   * @param {string} filename - File name
   * @param {string} parentFolderId - Parent folder ID (e.g., ALC_PARENT_FOLDER_ID)
   * @param {string} userId - User ID for subfolder organization
   * @returns {Promise<{fileId, fileUrl, fullPath}>}
   */
  async uploadImageWithUserFolder(imageBuffer, filename, parentFolderId, userId) {
    try {
      console.log(`📤 uploadImageWithUserFolder: filename=${filename}, parentId=${parentFolderId}, userId=${userId}`);
      
      // Create/get user subfolder
      console.log(`   Step 1: Get/create user folder...`);
      const userFolderId = await this.getOrCreateFolder(parentFolderId, userId);
      console.log(`   ✓ User folder ID: ${userFolderId}`);

      // Upload image to user folder
      console.log(`   Step 2: Upload image to user folder...`);
      const result = await this.uploadImage(imageBuffer, filename, userFolderId);
      console.log(`   ✓ File uploaded: ${result.fileId}`);

      return {
        fileId: result.fileId,
        fileUrl: result.fileUrl,
        userFolder: userFolderId,
        parentFolder: parentFolderId
      };
    } catch (err) {
      console.error(`❌ Failed to upload image with user folder:`, err.message);
      throw err;
    }
  }

  /**
   * Upload base64 image to Drive
   * @param {string} base64Data - Base64 encoded image data
   * @param {string} filename - File name
   * @param {string} parentFolderId - Parent folder ID
   * @param {string} userId - User ID for subfolder
   * @returns {Promise<{fileId, fileUrl, fullPath}>}
   */
  async uploadBase64Image(base64Data, filename, parentFolderId, userId) {
    try {
      // Clean base64 if needed
      let cleanBase64 = base64Data;
      if (cleanBase64.includes(',')) {
        cleanBase64 = cleanBase64.split(',')[1];
      }

      // Convert base64 to buffer
      const buffer = Buffer.from(cleanBase64, 'base64');

      // Upload using buffer method
      return await this.uploadImageWithUserFolder(buffer, filename, parentFolderId, userId);
    } catch (err) {
      console.error(`❌ Failed to upload base64 image:`, err.message);
      throw err;
    }
  }

  /**
   * Get file metadata
   * @param {string} fileId - File ID
   * @returns {Promise<Object>} File metadata
   */
  async getFileMetadata(fileId) {
    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        fields: 'id, name, mimeType, size, createdTime, modifiedTime, webViewLink',
        supportsAllDrives: true
      });
      return response.data;
    } catch (err) {
      console.error(`❌ Failed to get file metadata:`, err.message);
      throw err;
    }
  }

  /**
   * Delete file from Drive
   * @param {string} fileId - File ID
   * @returns {Promise<void>}
   */
  async deleteFile(fileId) {
    try {
      await this.drive.files.delete({ fileId, supportsAllDrives: true });
      console.log(`✅ Deleted file: ${fileId}`);
    } catch (err) {
      console.error(`❌ Failed to delete file:`, err.message);
      throw err;
    }
  }
}

module.exports = { DriveStorage };
