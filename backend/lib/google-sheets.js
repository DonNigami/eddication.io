/**
 * Google Sheets Database Module
 * Handles authentication and read/write operations to Google Sheets
 */

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

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
}

module.exports = { GoogleSheetsDB };
