/**
 * Image Storage Module
 * Handles saving and storing images (can be extended to use cloud storage)
 */

const fs = require('fs');
const path = require('path');

class ImageStorage {
  constructor(dataDir = './data') {
    this.dataDir = dataDir;
    this._ensureDir();
  }

  _ensureDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * Save image buffer to disk
   * @param {Buffer} imageBuffer
   * @param {string} filename
   * @returns {Promise<string>} - file URL or path
   */
  async saveImage(imageBuffer, filename) {
    try {
      const timestamp = Date.now();
      const ext = '.jpg';
      const safeFilename = `${filename}_${timestamp}${ext}`;
      const filepath = path.join(this.dataDir, safeFilename);

      console.log(`💾 Saving image to local storage: ${safeFilename}`);
      console.log(`   Full path: ${filepath}`);

      // Save file
      fs.writeFileSync(filepath, imageBuffer);
      console.log(`✅ Image saved: ${safeFilename} (${imageBuffer.length} bytes)`);

      // Return relative path (can be served by static middleware)
      const url = `/images/${safeFilename}`;
      console.log(`   URL: ${url}`);
      return url;
    } catch (err) {
      console.error('❌ Image save error:', err);
      throw err;
    }
  }

  /**
   * Get image by filename
   * @param {string} filename
   * @returns {Promise<Buffer>}
   */
  async getImage(filename) {
    try {
      const filepath = path.join(this.dataDir, filename);
      return fs.readFileSync(filepath);
    } catch (err) {
      console.error('❌ Image read error:', err);
      throw err;
    }
  }

  /**
   * Delete image
   * @param {string} filename
   */
  async deleteImage(filename) {
    try {
      const filepath = path.join(this.dataDir, filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    } catch (err) {
      console.error('❌ Image delete error:', err);
    }
  }
}

module.exports = { ImageStorage };
