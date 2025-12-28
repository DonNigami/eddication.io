/**
 * Google Sheets Database Module
 * Handles authentication and read/write operations to Google Sheets
 */

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const { SHEET_TEMPLATES } = require('./sheet-templates');

class GoogleSheetsDB {
  constructor(spreadsheetId, credentialsSource) {
    this.spreadsheetId = spreadsheetId;
    this.credentialsSource = credentialsSource;
    this.sheets = null;
    this.auth = null;
  }

  async initialize() {
    try {
      // Load credentials
      let credentials;
      
      // Check if credentialsSource is provided
      if (!this.credentialsSource) {
        throw new Error('GOOGLE_SHEETS_CREDENTIALS_JSON or GOOGLE_SHEETS_KEY_FILE environment variable is required');
      }
      
      if (this.credentialsSource.startsWith('{')) {
        // JSON string passed directly
        credentials = JSON.parse(this.credentialsSource);
      } else if (fs.existsSync(this.credentialsSource)) {
        // File path to credentials
        const raw = fs.readFileSync(this.credentialsSource, 'utf-8');
        credentials = JSON.parse(raw);
      } else {
        throw new Error(`Credentials not found: ${this.credentialsSource}`);
      }

      // Setup Google Auth
      this.auth = new google.auth.GoogleAuth({
        credentials,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive'
        ]
      });

      // Get Sheets API client
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      
      console.log('✅ Google Sheets authenticated');
    } catch (err) {
      console.error('❌ Failed to initialize Google Sheets:', err.message);
      throw err;
    }
  }

  /**
   * Read data from a sheet by range
   * @param {string} sheetName - Name of the sheet (e.g., 'Jobs')
   * @param {string} range - A1 notation (e.g., 'A1:Z1000')
   * @returns {Promise<Array>}
   */
  async readRange(sheetName, range) {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!${range}`,
        valueRenderOption: 'FORMATTED_VALUE'
      });

      return response.data.values || [];
    } catch (err) {
      console.error(`❌ Failed to read ${sheetName}!${range}:`, err.message);
      throw err;
    }
  }

  /**
   * Write data to a sheet range
   * @param {string} sheetName
   * @param {string} range
   * @param {Array<Array>} values
   * @returns {Promise<Object>}
   */
  async writeRange(sheetName, range, values) {
    try {
      const response = await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!${range}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values }
      });

      return response.data;
    } catch (err) {
      console.error(`❌ Failed to write ${sheetName}!${range}:`, err.message);
      throw err;
    }
  }

  /**
   * Append data to a sheet
   * @param {string} sheetName
   * @param {Array<Array>} values
   * @returns {Promise<Object>}
   */
  async appendRange(sheetName, values) {
    try {
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:Z`,
        valueInputOption: 'USER_ENTERED',
        resource: { values }
      });

      return response.data;
    } catch (err) {
      console.error(`❌ Failed to append to ${sheetName}:`, err.message);
      throw err;
    }
  }

  /**
   * Append a single row to a sheet (alias for appendRange)
   * @param {string} sheetName
   * @param {Array<Array>} values
   * @returns {Promise<Object>}
   */
  async appendRow(sheetName, values) {
    return this.appendRange(sheetName, values);
  }

  /**
   * Get sheet metadata (column headers, etc.)
   * @param {string} sheetName
   * @returns {Promise<Object>}
   */
  async getSheetMetadata(sheetName) {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
        fields: 'sheets(properties(sheetId,title,gridProperties))'
      });

      const sheet = response.data.sheets.find(s => s.properties.title === sheetName);
      return sheet ? sheet.properties : null;
    } catch (err) {
      console.error(`❌ Failed to get metadata for ${sheetName}:`, err.message);
      throw err;
    }
  }

  /**
   * Clear a range
   * @param {string} sheetName
   * @param {string} range
   * @returns {Promise<Object>}
   */
  async clearRange(sheetName, range) {
    try {
      const response = await this.sheets.spreadsheets.values.clear({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!${range}`
      });

      return response.data;
    } catch (err) {
      console.error(`❌ Failed to clear ${sheetName}!${range}:`, err.message);
      throw err;
    }
  }

  /**
   * Check if a sheet exists
   * @param {string} sheetName
   * @returns {Promise<boolean>}
   */
  async sheetExists(sheetName) {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
        fields: 'sheets(properties(title))'
      });

      const exists = response.data.sheets.some(s => s.properties.title === sheetName);
      return exists;
    } catch (err) {
      console.error(`❌ Failed to check if ${sheetName} exists:`, err.message);
      return false;
    }
  }

  /**
   * Create a new sheet with headers
   * @param {string} sheetName
   * @param {Array<string>} headers
   * @returns {Promise<Object>}
   */
  async createSheet(sheetName, headers) {
    try {
      console.log(`🔧 Creating sheet: ${sheetName}...`);
      
      // Create the sheet
      const response = await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: sheetName
              }
            }
          }]
        }
      });

      // Add headers if provided
      if (headers && headers.length > 0) {
        await this.writeRange(sheetName, `A1:${this._getColumnLetter(headers.length - 1)}1`, [headers]);
        console.log(`✅ Created sheet "${sheetName}" with ${headers.length} headers`);
      } else {
        console.log(`✅ Created sheet "${sheetName}"`);
      }

      return response.data;
    } catch (err) {
      console.error(`❌ Failed to create sheet ${sheetName}:`, err.message);
      throw err;
    }
  }

  /**
   * Ensure sheet exists, create if not
   * @param {string} sheetName
   * @param {Array<string>} headers (optional)
   * @returns {Promise<boolean>} true if created, false if already exists
   */
  async ensureSheet(sheetName, headers = null) {
    try {
      const exists = await this.sheetExists(sheetName);
      
      if (!exists) {
        // Use template headers if available
        const template = SHEET_TEMPLATES[sheetName];
        const headersToUse = headers || (template ? template.headers : null);
        
        await this.createSheet(sheetName, headersToUse);
        
        if (template && template.description) {
          console.log(`   📝 ${template.description}`);
        }
        
        return true; // Created
      }
      
      return false; // Already exists
    } catch (err) {
      console.error(`❌ Failed to ensure sheet ${sheetName}:`, err.message);
      throw err;
    }
  }

  /**
   * Initialize all required sheets from templates
   * @returns {Promise<Array>} List of created sheets
   */
  async initializeRequiredSheets() {
    try {
      console.log('🔧 Checking required sheets...');
      
      const createdSheets = [];
      
      for (const [sheetName, template] of Object.entries(SHEET_TEMPLATES)) {
        const created = await this.ensureSheet(sheetName, template.headers);
        if (created) {
          createdSheets.push(sheetName);
        }
      }
      
      if (createdSheets.length > 0) {
        console.log(`✅ Created ${createdSheets.length} new sheet(s): ${createdSheets.join(', ')}`);
      } else {
        console.log('✅ All required sheets already exist');
      }
      
      return createdSheets;
    } catch (err) {
      console.error('❌ Failed to initialize required sheets:', err.message);
      throw err;
    }
  }

  /**
   * Convert column index to letter (0 = A, 1 = B, etc.)
   * @param {number} index
   * @returns {string}
   */
  _getColumnLetter(index) {
    let letter = '';
    let temp = index;
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  }
}

module.exports = { GoogleSheetsDB };
