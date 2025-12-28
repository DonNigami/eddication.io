# Google Chat Direct Message (DM) Setup Guide

## 📱 Overview

Send notifications directly to customer's **Personal Google Chat** instead of needing webhooks or spaces.

This is the **recommended approach** for customer notifications.

---

## 🚀 Quick Setup

### 1. Enable Google Chat API

```
Google Cloud Console → APIs & Services → Library
Search: "Google Chat API"
Click: Enable
```

### 2. Set Service Account Scopes

Ensure your service account JSON key has these scopes:
- ✅ `https://www.googleapis.com/auth/chat.bot`
- ✅ `https://www.googleapis.com/auth/chat.messages`

If not, regenerate the key:
```
IAM & Admin → Service Accounts → Select your account
Keys → Create new JSON key → Download
Replace in .env → GOOGLE_APPLICATION_CREDENTIALS
```

### 3. Add Customer Email to Sheet

**CustomerContacts sheet:**

| shipToCode | shipToName | chatEmail | chatWebhook |
|------------|------------|-----------|-------------|
| 001234 | ABC Company | somchai@company.com | (leave blank) |

- Use **Google Workspace email** (e.g., `user@company.com`)
- Leave `chatWebhook` blank (optional)

### 4. Test

```bash
# POST to backend
curl -X POST https://your-railway-backend/api/send-notification \
  -H "Content-Type: application/json" \
  -d '{
    "type": "checkin",
    "shipToCode": "001234",
    "shipmentNo": "SH-2025-001",
    "driverName": "สมชาย",
    "estimatedArrival": "30 นาที"
  }'
```

✅ Check customer's Google Chat for DM from service account

---

## 🎯 How It Works

### Priority-Based Routing

```
1. chatEmail (Google Chat API DM)
   ↓ (if fails or not provided)
2. chatWebhook (Google Chat Space webhook)
   ↓ (if fails or not provided)
3. email (Gmail API)
   ↓ (if fails or not provided)
4. No notification sent
```

### Message Flow

```
Backend Notification API
    ↓
Check customer contact info
    ↓
Does chatEmail exist?
    ├─ YES → Use Google Chat API createDirect()
    │         └─ Send message to personal chat
    ├─ NO → Does chatWebhook exist?
    │         ├─ YES → POST to webhook URL
    │         ├─ NO → Does email exist?
    │         │       └─ Send via Gmail API
    └─ End
```

---

## 📋 API Example

### Send Check-in Notification

```javascript
const response = await fetch('https://your-backend/api/send-notification', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'checkin',
    shipToCode: '001234',
    reference: 'REF001',
    shipmentNo: 'SH-2025-001',
    driverName: 'สมชาย',
    estimatedArrival: '30 นาที'
  })
});

const result = await response.json();
console.log(result);
// {
//   success: true,
//   data: {
//     chat: { success: true },    ← DM sent via Chat API
//     email: null
//   }
// }
```

### Supported Notification Types

1. **checkin** - Driver departed
   ```json
   {
     "type": "checkin",
     "shipToCode": "001234",
     "estimatedArrival": "30 นาที"
   }
   ```

2. **nearby** - Driver approaching (5km)
   ```json
   {
     "type": "nearby",
     "shipToCode": "001234",
     "minutesAway": 5
   }
   ```

3. **completed** - Delivery finished
   ```json
   {
     "type": "completed",
     "shipToCode": "001234",
     "deliveryTime": "14:30"
   }
   ```

4. **issue** - Delivery problem
   ```json
   {
     "type": "issue",
     "shipToCode": "001234",
     "issueType": "customer_not_available",
     "issueDescription": "ลูกค้าไม่พบที่บ้าน"
   }
   ```

---

## 🔍 Troubleshooting

### "Chat API not initialized"
- Check: Service account JSON has correct scopes
- Check: GOOGLE_APPLICATION_CREDENTIALS env var is set
- Check: Server logs for initialization errors

### DM fails but webhook works
- DM permissions issue - need Chat API scopes
- Fallback to chatWebhook is working correctly
- Check Console for error details

### Message doesn't appear in Google Chat
- Verify chatEmail format: `user@company.com`
- Ensure user is in Google Workspace
- Check server logs: `railway logs`
- Test with curl (see Quick Setup step 4)

### Both DM and webhook fail, email sends
- Email is fallback option
- Check Gmail API is initialized
- Verify recipient email is valid

---

## 💡 Best Practices

✅ **Do:**
- Use Google Workspace emails in `chatEmail`
- Test with curl first before integrating
- Monitor server logs: `railway logs`
- Set notification preferences (`notifyOnCheckIn`, etc.)

❌ **Don't:**
- Mix webhook and chatEmail in same row (system will choose chatEmail)
- Use Gmail instead of Google Workspace emails for DM
- Ignore API errors in logs
- Send notifications without checking notification preferences

---

## 📚 Additional Resources

- [Google Chat API Documentation](https://developers.google.com/chat)
- [Service Account Setup](../NOTIFICATION_SETUP.md#-google-chat-direct-message-setup)
- [API Endpoints](../NOTIFICATION_SETUP.md#-api-integration-examples)

