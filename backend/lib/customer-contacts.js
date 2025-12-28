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
   */
  async getContactInfo(shipToCode) {
    try {
      // Ensure sheet exists
      await this.db.ensureSheet(this.SHEET_NAME);
      
      const contacts = await this.db.readRange(this.SHEET_NAME, 'A:Z');
      if (!contacts || contacts.length === 0) {
        return null;
      }

      const headers = contacts[0];
      const shipToIdx = headers.indexOf('shipToCode');
      
      if (shipToIdx === -1) {
        return null;
      }

      // Find matching contact
      for (let i = 1; i < contacts.length; i++) {
        if (contacts[i][shipToIdx] && 
            String(contacts[i][shipToIdx]).toUpperCase() === String(shipToCode).toUpperCase()) {
          
          return {
            shipToCode: contacts[i][shipToIdx] || '',
            shipToName: contacts[i][headers.indexOf('shipToName')] || '',
            customerName: contacts[i][headers.indexOf('customerName')] || '',
            email: contacts[i][headers.indexOf('email')] || '',
            chatWebhook: contacts[i][headers.indexOf('chatWebhook')] || '',
            phoneNumber: contacts[i][headers.indexOf('phoneNumber')] || '',
            notifyOnCheckIn: contacts[i][headers.indexOf('notifyOnCheckIn')] === 'TRUE',
            notifyOnNearby: contacts[i][headers.indexOf('notifyOnNearby')] === 'TRUE',
            notifyOnComplete: contacts[i][headers.indexOf('notifyOnComplete')] === 'TRUE',
            notifyOnIssue: contacts[i][headers.indexOf('notifyOnIssue')] === 'TRUE'
          };
        }
      }

      return null;
    } catch (err) {
      console.error('❌ Failed to get customer contact:', err);
      return null;
    }
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
          'chatWebhook',
          'phoneNumber',
          'notifyOnCheckIn',
          'notifyOnNearby',
          'notifyOnComplete',
          'notifyOnIssue',
          'createdAt',
          'updatedAt'
        ];
        await this.db.writeRange(this.SHEET_NAME, 'A1:L1', [headers]);
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
        contactData.chatWebhook || '',
        contactData.phoneNumber || '',
        contactData.notifyOnCheckIn ? 'TRUE' : 'FALSE',
        contactData.notifyOnNearby ? 'TRUE' : 'FALSE',
        contactData.notifyOnComplete ? 'TRUE' : 'FALSE',
        contactData.notifyOnIssue ? 'TRUE' : 'FALSE',
        existingRowIndex === -1 ? timestamp : (contacts[existingRowIndex][10] || timestamp),
        timestamp
      ];

      if (existingRowIndex !== -1) {
        // Update existing
        const rowNum = existingRowIndex + 1;
        await this.db.writeRange(this.SHEET_NAME, `A${rowNum}:L${rowNum}`, [row]);
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
