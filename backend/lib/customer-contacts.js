/**
 * Customer Contact Management
 * Manages customer email and Google Chat webhook information
 */

class CustomerContacts {
  constructor(db) {
    this.db = db;
    this.SHEET_NAME = 'CustomerContacts';
  }

  /**
   * Get customer contact info by ship-to code or name
   * Searches multiple sheets: CustomerContacts → Email_STA → Customer
   */
  async getContactInfo(shipToCode) {
    try {
      // Try CustomerContacts first
      const customerContact = await this._searchInSheet('CustomerContacts', shipToCode);
      if (customerContact) {
        return customerContact;
      }

      // Fallback to Email_STA sheet
      const emailStaContact = await this._searchInSheet('Email_STA', shipToCode);
      if (emailStaContact) {
        return emailStaContact;
      }

      // Fallback to Customer sheet
      const customerSheetContact = await this._searchInSheet('Customer', shipToCode);
      if (customerSheetContact) {
        return customerSheetContact;
      }

      console.log(`⚠️ No contact found for shipToCode: ${shipToCode}`);
      return null;
    } catch (err) {
      console.error('❌ Failed to get customer contact:', err);
      return null;
    }
  }

  /**
   * Search for contact in a specific sheet
   * Looks for email column (email, E-mail, EMAIL, etc.)
   */
  async _searchInSheet(sheetName, shipToCode) {
    try {
      const data = await this.db.readRange(sheetName, 'A:AZ');
      if (!data || data.length === 0) {
        return null;
      }

      const headers = data[0];
      
      // Find shipToCode column (case-insensitive)
      const shipToIdx = this._findColumnIndex(headers, ['shipToCode', 'shiptocode', 'ship_to_code', 'ShipToCode']);
      if (shipToIdx === -1) {
        return null;
      }

      // Find email column (case-insensitive: email, E-mail, EMAIL, etc.)
      const emailIdx = this._findColumnIndex(headers, ['email', 'e-mail', 'e_mail', 'Email', 'E-Mail']);
      
      // Find chatEmail column
      const chatEmailIdx = this._findColumnIndex(headers, ['chatEmail', 'chatemail', 'chat_email', 'ChatEmail']);

      // Search for matching row
      for (let i = 1; i < data.length; i++) {
        if (data[i][shipToIdx] && 
            String(data[i][shipToIdx]).toUpperCase() === String(shipToCode).toUpperCase()) {
          
          const contact = {
            shipToCode: data[i][shipToIdx] || '',
            shipToName: data[i][this._findColumnIndex(headers, ['shipToName', 'shiptoname', 'ship_to_name'])] || '',
            customerName: data[i][this._findColumnIndex(headers, ['customerName', 'customername', 'customer_name'])] || '',
            email: emailIdx !== -1 ? (data[i][emailIdx] || '') : '',
            chatEmail: chatEmailIdx !== -1 ? (data[i][chatEmailIdx] || '') : '',
            chatWebhook: data[i][this._findColumnIndex(headers, ['chatWebhook', 'chatwebhook', 'chat_webhook'])] || '',
            phoneNumber: data[i][this._findColumnIndex(headers, ['phoneNumber', 'phonenumber', 'phone_number', 'phone'])] || '',
            notifyOnCheckIn: data[i][this._findColumnIndex(headers, ['notifyOnCheckIn'])] === 'TRUE',
            notifyOnNearby: data[i][this._findColumnIndex(headers, ['notifyOnNearby'])] === 'TRUE',
            notifyOnComplete: data[i][this._findColumnIndex(headers, ['notifyOnComplete'])] === 'TRUE',
            notifyOnIssue: data[i][this._findColumnIndex(headers, ['notifyOnIssue'])] === 'TRUE'
          };

          console.log(`✅ Found contact in ${sheetName}: ${contact.email || contact.chatEmail}`);
          return contact;
        }
      }

      return null;
    } catch (err) {
      // Sheet might not exist, just return null
      console.log(`⚠️ Could not search in ${sheetName}:`, err.message);
      return null;
    }
  }

  /**
   * Find column index by multiple possible names (case-insensitive)
   */
  _findColumnIndex(headers, possibleNames) {
    for (const name of possibleNames) {
      const idx = headers.findIndex(h => 
        h && String(h).toLowerCase().trim() === name.toLowerCase().trim()
      );
      if (idx !== -1) {
        return idx;
      }
    }
    return -1;
  }

  /**
   * Add or update customer contact info
   */
  async upsertContact(contactData) {
    try {
      // Ensure sheet exists with headers
      await this.db.ensureSheet(this.SHEET_NAME);
      
      const contacts = await this.db.readRange(this.SHEET_NAME, 'A:Z');
      
      // If sheet doesn't exist or is empty, create headers
      if (!contacts || contacts.length === 0) {
        const headers = [
          'shipToCode',
          'shipToName',
          'customerName',
          'email',
          'chatEmail',
          'chatWebhook',
          'phoneNumber',
          'notifyOnCheckIn',
          'notifyOnNearby',
          'notifyOnComplete',
          'notifyOnIssue',
          'createdAt',
          'updatedAt'
        ];
        await this.db.writeRange(this.SHEET_NAME, 'A1:M1', [headers]);
      }

      const headers = contacts[0] || [];
      const shipToIdx = headers.indexOf('shipToCode');

      // Check if contact exists
      let existingRowIndex = -1;
      if (contacts.length > 1) {
        for (let i = 1; i < contacts.length; i++) {
          if (contacts[i][shipToIdx] && 
              String(contacts[i][shipToIdx]).toUpperCase() === String(contactData.shipToCode).toUpperCase()) {
            existingRowIndex = i;
            break;
          }
        }
      }

      const timestamp = new Date().toISOString();
      const row = [
        contactData.shipToCode || '',
        contactData.shipToName || '',
        contactData.customerName || '',
        contactData.email || '',
        contactData.chatEmail || '',
        contactData.chatWebhook || '',
        contactData.phoneNumber || '',
        contactData.notifyOnCheckIn ? 'TRUE' : 'FALSE',
        contactData.notifyOnNearby ? 'TRUE' : 'FALSE',
        contactData.notifyOnComplete ? 'TRUE' : 'FALSE',
        contactData.notifyOnIssue ? 'TRUE' : 'FALSE',
        existingRowIndex === -1 ? timestamp : (contacts[existingRowIndex][11] || timestamp),
        timestamp
      ];

      if (existingRowIndex !== -1) {
        // Update existing
        const rowNum = existingRowIndex + 1;
        await this.db.writeRange(this.SHEET_NAME, `A${rowNum}:M${rowNum}`, [row]);
        console.log('✅ Updated customer contact:', contactData.shipToCode);
      } else {
        // Append new
        await this.db.appendRow(this.SHEET_NAME, [row]);
        console.log('✅ Added customer contact:', contactData.shipToCode);
      }

      return { success: true };
    } catch (err) {
      console.error('❌ Failed to upsert customer contact:', err);
      return { success: false, error: err.message };
    }
  }
}

module.exports = { CustomerContacts };
