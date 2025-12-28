/**
 * Google Drive Storage Module
 * Handles uploading images and documents to Google Drive folders
 */

const { google } = require('googleapis');

class DriveStorage {
  constructor(credentialsSource) {
    this.credentialsSource = credentialsSource;
    this.drive = null;
    this.auth = null;
  }

  async initialize() {
    try {
      let credentials;
      
      if (!this.credentialsSource) {
        throw new Error('GOOGLE_SHEETS_CREDENTIALS_JSON or GOOGLE_SHEETS_KEY_FILE environment variable is required');
      }
      
      if (this.credentialsSource.startsWith('{')) {
        credentials = JSON.parse(this.credentialsSource);
      } else {
        const fs = require('fs');
        if (fs.existsSync(this.credentialsSource)) {
          const raw = fs.readFileSync(this.credentialsSource, 'utf-8');
          credentials = JSON.parse(raw);
        } else {
          throw new Error(`Credentials not found: ${this.credentialsSource}`);
        }
      }

      this.auth = new google.auth.GoogleAuth({
        credentials,
        scopes: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/drive.file'
        ]
      });

      this.drive = google.drive({ version: 'v3', auth: this.auth });
      console.log('✅ Google Drive authenticated');
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
      // Search for existing folder
      const response = await this.drive.files.list({
        q: `'${parentFolderId}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        spaces: 'drive',
        fields: 'files(id, name)',
        pageSize: 1
      });

      if (response.data.files && response.data.files.length > 0) {
        console.log(`✅ Found existing folder: ${folderName}`);
        return response.data.files[0].id;
      }

      // Create new folder
      const createResponse = await this.drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentFolderId]
        },
        fields: 'id'
      });

      console.log(`✅ Created new folder: ${folderName}`);
      return createResponse.data.id;
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
      const response = await this.drive.files.create({
        requestBody: {
          name: filename,
          parents: [parentFolderId],
          mimeType: 'image/jpeg'
        },
        media: {
          mimeType: 'image/jpeg',
          body: imageBuffer
        },
        fields: 'id, webViewLink'
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
          }
        });
      } catch (permErr) {
        console.warn('⚠️ Could not set public read permission:', permErr.message);
      }

      console.log(`✅ Uploaded image: ${filename} (${fileId})`);
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
      // Create/get user subfolder
      const userFolderId = await this.getOrCreateFolder(parentFolderId, userId);

      // Upload image to user folder
      const result = await this.uploadImage(imageBuffer, filename, userFolderId);

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
        fields: 'id, name, mimeType, size, createdTime, modifiedTime, webViewLink'
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
      await this.drive.files.delete({ fileId });
      console.log(`✅ Deleted file: ${fileId}`);
    } catch (err) {
      console.error(`❌ Failed to delete file:`, err.message);
      throw err;
    }
  }
}

module.exports = { DriveStorage };
