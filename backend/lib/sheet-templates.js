/**
 * Sheet Templates
 * Defines structure for auto-creating sheets
 */

const SHEET_TEMPLATES = {
  CustomerContacts: {
    headers: [
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
    ],
    description: 'Customer contact information for notifications'
  },
  
  Awareness: {
    headers: [
      'timestamp',
      'userId',
      'reference',
      'acknowledged'
    ],
    description: 'Awareness popup acknowledgments'
  },
  
  POD: {
    headers: [
      'timestamp',
      'userId',
      'reference',
      'shipmentNo',
      'status',
      'imageUrl'
    ],
    description: 'Proof of Delivery records'
  },
  
  Emergency: {
    headers: [
      'timestamp',
      'userId',
      'type',
      'description',
      'lat',
      'lng',
      'imageUrl',
      'reference'
    ],
    description: 'Emergency SOS reports'
  },
  
  EndTrip: {
    headers: [
      'timestamp',
      'userId',
      'reference',
      'endOdo',
      'endPointName',
      'lat',
      'lng',
      'accuracy'
    ],
    description: 'End of trip records'
  },
  
  MissingSteps: {
    headers: [
      'timestamp',
      'userId',
      'reference',
      'data',
      'lat',
      'lng'
    ],
    description: 'Missing steps data'
  }
};

module.exports = { SHEET_TEMPLATES };
