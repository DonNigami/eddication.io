# LINE LIFF SaaS Architecture - DriverConnect

## Overview

DriverConnect is built on LINE LIFF (LINE Front-end Framework) as a SaaS platform for truck drivers to manage fuel delivery operations through the LINE app.

---

## Platform Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         LINE Platform                             │
├─────────────────────────────────────────────────────────────────┤
│  LINE App (Client)                                               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  LIFF App (driverapp/)                                   │    │
│  │  - Job search                                            │    │
│  │  - Check-in/out                                         │    │
│  │  - Alcohol test                                         │    │
│  │  - Service review                                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                          ↕ LIFF API                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  LINE Messaging API                                      │    │
│  │  - Push notifications                                    │    │
│  │  - Rich menus                                            │    │
│  │  - Webhook events                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                          ↕ HTTPS
┌─────────────────────────────────────────────────────────────────┐
│                      Backend Services                            │
├─────────────────────────────────────────────────────────────────┤
│  Supabase (PostgreSQL + Edge Functions)                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Database Tables                                         │    │
│  │  - jobdata, alcohol_checks, review_data                  │    │
│  │  - user_profiles, stations, origins                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Edge Functions                                         │    │
│  │  - enrich-coordinates, geocode                           │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Realtime Subscriptions                                  │    │
│  │  - Live updates to admin panel                          │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────────────┐
│                      Admin Panel (Web)                           │
│  - Real-time fleet dashboard                                     │
│  - Job management & assignment                                    │
│  - Driver approval system                                         │
│  - Incentive & payment workflow                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## LINE LIFF Configuration

### LIFF App Settings

| Setting | Value | Description |
|---------|-------|-------------|
| **LIFF ID** | `config.js` | LINE Front-end Framework app identifier |
| **LIFF Size** | Tall / Full | View size in LINE app |
| **Endpoint URL** | Production domain | HTTPS URL of driver app |
| **Scope** | profile, email | User permissions |
| **Bot Link** | Enabled | Allow 1-on-1 chat with bot |

### LINE Developers Console

1. **Channel Type**: Messaging API
2. **Provider**: DriverConnect / Eddication
3. **LINE Official Account**: DriverConnect Bot

---

## User Authentication Flow

```
┌─────────┐     Open LIFF      ┌─────────────┐
│  User   │ ─────────────────> │  LINE App   │
└─────────┘                    └─────────────┘
                                      │
                                      │ LIFF.init()
                                      ▼
                             ┌─────────────────┐
                             │  Login Screen   │
                             │  (if not auth)  │
                             └─────────────────┘
                                      │
                                      │ User grants permission
                                      ▼
                             ┌─────────────────┐
                             │  LIFF.getProfile()│
                             └─────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
                    ▼                                   ▼
            ┌───────────────┐                   ┌───────────────┐
            │ LINE Profile  │                   │ Store in      │
            │ - userId      │ ─────────────────> │ Supabase      │
            │ - displayName │                   │ user_profiles │
            │ - pictureUrl  │                   │               │
            │ - statusMsg   │                   │               │
            └───────────────┘                   └───────────────┘
```

---

## Database Schema for LINE Integration

### user_profiles Table

```sql
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    line_user_id TEXT UNIQUE NOT NULL,
    display_name TEXT,
    picture_url TEXT,
    status_message TEXT,
    email TEXT,
    role TEXT DEFAULT 'driver',
    is_active BOOLEAN DEFAULT true,
    approved BOOLEAN DEFAULT false,
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `line_user_id` | TEXT | LINE User ID (from LIFF profile) |
| `role` | TEXT | `driver`, `admin`, `accounting`, `supervisor` |
| `approved` | BOOLEAN | Driver approval status |
| `approved_by` | TEXT | LINE User ID of approving admin |

---

## LIFF API Methods Used

### Authentication & Profile

```javascript
// Initialize LIFF
await liff.init({ liffId: config.LIFF_ID });

// Get login status
const isLoggedIn = liff.isLoggedIn();

// Login (redirect to LINE authorization)
liff.login();

// Logout
liff.logout();

// Get user profile
const profile = await liff.getProfile();
// Returns: { userId, displayName, pictureUrl, statusMessage }
```

### Context & Features

```javascript
// Get LIFF context
const context = liff.getContext();
// Returns: { type, viewType, userId, utouId, groupId, roomId }

// Get OS
const os = liff.getOS(); // 'ios', 'android', 'web'

// Get Language
const lang = liff.getLanguage();

// Get Version
const version = liff.getVersion();

// Check feature availability
const isAvailable = liff.isApiAvailable(featureName);
```

### Scanning

```javascript
// Open QR/Barcode scanner
const scanResult = await liff.scanCodeV2();
```

### Window Operations

```javascript
// Open URL in external browser
liff.openWindow({ url: 'https://example.com', external: true });

// Close LIFF window
liff.closeWindow();
```

---

## Messaging API Integration

### Push Notifications

```javascript
// Server-side (Edge Function / Express)
const axios = require('axios');

async function pushNotification(lineUserId, message) {
  await axios.post('https://api.line.me/v2/bot/message/push', {
    to: lineUserId,
    messages: [{
      type: 'text',
      text: message
    }]
  }, {
    headers: {
      'Authorization': `Bearer ${config.LINE_CHANNEL_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
}
```

### Message Templates

#### Flex Message (Rich Card)

```javascript
{
  type: 'flex',
  altText: 'New Job Assigned',
  contents: {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: 'New Job',
          weight: 'bold',
          color: '#FFFFFF',
          size: 'xl'
        }
      ],
      backgroundColor: '#0066CC'
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: 'Ref: JD-2024-001' },
        { type: 'text', text: 'From: Bang Phli' },
        { type: 'text', text: 'Stops: 3' }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          action: {
            type: 'uri',
            label: 'View Details',
            uri: 'https://app.driverconnect.io/job/JD-2024-001'
          }
        }
      ]
    }
  }
}
```

### Quick Reply Buttons

```javascript
{
  type: 'text',
  text: 'Select action:',
  quickReply: {
    items: [
      {
        type: 'action',
        action: {
          type: 'message',
          label: 'Check In',
          text: '/checkin'
        }
      },
      {
        type: 'action',
        action: {
          type: 'message',
          label: 'Check Out',
          text: '/checkout'
        }
      },
      {
        type: 'action',
        action: {
          type: 'message',
          label: 'Alcohol Test',
          text: '/alcohol'
        }
      }
    ]
  }
}
```

---

## Rich Menu Configuration

### Rich Menu Structure

```
┌─────────────────────────────────────────┐
│              Driver Menu                 │
├──────────────┬──────────────┬────────────┤
│   📋 Jobs    │   📍 Status  │  👤 Profile│
│              │              │            │
├──────────────┼──────────────┼────────────┤
│  📷 Alcohol  │  ⭐ Review   │  📞 Support│
│              │              │            │
└──────────────┴──────────────┴────────────┘
```

### Rich Menu Setup (via API)

```bash
# Create rich menu
curl -X POST https://api.line.me/v2/bot/richmenu \
-H "Authorization: Bearer {CHANNEL_ACCESS_TOKEN}" \
-H "Content-Type: application/json" \
-d '{
  "size": {
    "width": 2500,
    "height": 1686
  },
  "selected": false,
  "name": "Driver Menu",
  "chatBarText": "Menu",
  "areas": [
    {
      "bounds": {
        "x": 0,
        "y": 0,
        "width": 833,
        "height": 843
      },
      "action": {
        "type": "uri",
        "uri": "https://liff.line.me/{LIFF_ID}/jobs"
      }
    }
    // ... more areas
  ]
}'

# Set as default menu
curl -X POST https://api.line.me/v2/bot/user/all/richmenu/{RICH_MENU_ID} \
-H "Authorization: Bearer {CHANNEL_ACCESS_TOKEN}"
```

---

## Webhook Events

### Event Types Handled

| Event | Description | Handler |
|-------|-------------|---------|
| `follow` | User adds bot as friend | Create user profile |
| `unfollow` | User blocks bot | Deactivate user |
| `message` | User sends message | Command processing |
| `postback` | Button/quick reply | Action handler |

### Webhook Payload Example

```javascript
// POST /webhook/line
{
  "destination": "xxxxxxxxxx",
  "events": [
    {
      "type": "message",
      "mode": "active",
      "timestamp": 1234567890,
      "source": {
        "type": "user",
        "userId": "U1234567890"
      },
      "message": {
        "id": "100001",
        "type": "text",
        "text": "/checkin JD-2024-001"
      },
      "replyToken": "nHuyWiB7yP5Zw52FIkcQobQuGDXCTA"
    }
  ]
}
```

### Webhook Handler (Edge Function)

```typescript
// supabase/functions/webhook/line/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const signature = req.headers.get('x-line-signature');
  const body = await req.text();

  // Verify signature
  // const expectedSignature = crypto.createHmac('SHA256', CHANNEL_SECRET)
  //   .update(body).digest('base64');

  const data = JSON.parse(body);

  for (const event of data.events) {
    switch (event.type) {
      case 'message':
        await handleMessage(event);
        break;
      case 'follow':
        await handleFollow(event);
        break;
      case 'postback':
        await handlePostback(event);
        break;
    }
  }

  return new Response('OK', { status: 200 });
});
```

---

## Security Considerations

### 1. LIFF ID Protection

```javascript
// config.js - Never commit actual values
const config = {
  LIFF_ID: import.meta.env.VITE_LIFF_ID || localStorage.getItem('liff_id'),
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY
};
```

### 2. Webhook Signature Verification

```typescript
function verifySignature(body: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('SHA256', secret);
  hmac.update(body);
  const expectedSignature = hmac.digest('base64');
  return signature === expectedSignature;
}
```

### 3. User ID Validation

```sql
-- RLS Policy: Users can only see their own data
CREATE POLICY user_isolation ON jobdata
FOR ALL
TO authenticated
USING (line_user_id = auth.jwt()->>'line_user_id');
```

### 4. Rate Limiting

```typescript
// Edge Function rate limiting
const rateLimit = new Map<string, number[]>();

function checkRateLimit(userId: string, limit = 100): boolean {
  const now = Date.now();
  const requests = rateLimit.get(userId) || [];
  const recentRequests = requests.filter(t => now - t < 60000); // 1 minute

  if (recentRequests.length >= limit) {
    return false;
  }

  recentRequests.push(now);
  rateLimit.set(userId, recentRequests);
  return true;
}
```

---

## Deployment Checklist

### LINE Developers Console

- [ ] Create Messaging API channel
- [ ] Generate Channel Access Token (Long-lived)
- [ ] Generate Channel Secret
- [ ] Create LIFF app
- [ ] Set LIFF endpoint URL (HTTPS required)
- [ ] Configure webhook URL
- [ ] Enable auto-reply messages (optional)
- [ ] Design and upload Rich Menu image

### Supabase

- [ ] Set environment variables: `LIFF_ID`, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`
- [ ] Deploy webhook Edge Function
- [ ] Configure RLS policies for `user_profiles`
- [ ] Set up realtime subscriptions

### Domain

- [ ] Obtain SSL certificate (Let's Encrypt)
- [ ] Configure DNS records
- [ ] Set up CDN (optional)

---

## Best Practices

### 1. Error Handling

```javascript
async function safeLiffInit() {
  try {
    await liff.init({ liffId: config.LIFF_ID });
  } catch (error) {
    console.error('LIFF init failed:', error);
    if (error.message.includes('liffId is not found')) {
      alert('LIFF app not configured. Please contact admin.');
    } else {
      alert('Unable to open app. Please try again later.');
    }
  }
}
```

### 2. Offline Queue

```javascript
// Queue operations for poor signal areas
class OfflineQueue {
  constructor() {
    this.queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
  }

  add(operation) {
    this.queue.push({
      ...operation,
      timestamp: Date.now(),
      synced: false
    });
    this.save();
  }

  async sync() {
    if (!navigator.onLine) return;

    for (const item of this.queue.filter(q => !q.synced)) {
      try {
        await fetch(item.url, item.options);
        item.synced = true;
      } catch (error) {
        console.error('Sync failed:', error);
      }
    }
    this.save();
  }

  save() {
    localStorage.setItem('offlineQueue', JSON.stringify(this.queue));
  }
}
```

### 3. Performance Optimization

```javascript
// Lazy load LIFF SDK
function loadLiffSDK() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
```

---

## Testing

### LIFF Simulator

Use LINE LIFF Simulator for testing:
https://developers.line.biz/console/lift/simulator

### Test Scenarios

| Scenario | Test Method |
|----------|-------------|
| Login flow | LIFF Simulator + Real LINE app |
| Push notifications | Direct API call |
| Webhook events | ngrok + localhost |
| Rich menu | LINE app on mobile |

---

## References

- [LINE LIFF Documentation](https://developers.line.biz/en/docs/liff/)
- [Messaging API Documentation](https://developers.line.biz/en/docs/messaging-api/)
- [LINE Developers Console](https://developers.line.biz/console/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-01-27 | Initial documentation |
