# 🔧 LINE Webhook 302 Error Fix

## Problem

Your LINE webhook is returning **HTTP 302 Found** instead of **HTTP 200 OK**, causing webhook delivery to fail.

## Common Causes

### 1. Trailing Slash Mismatch (Most Common)
- **LINE Developers Console**: `https://your-domain.com/api/line-webhook/` (with trailing slash)
- **Express Route**: `app.post('/api/line-webhook', ...)` (without trailing slash)
- **Result**: Express returns 302 redirect to non-trailing slash version

### 2. HTTP to HTTPS Redirect
- **LINE Developers Console**: `http://your-domain.com/api/line-webhook`
- **Server Config**: Redirects all HTTP to HTTPS
- **Result**: Webhook returns 302 redirect to HTTPS

### 3. Reverse Proxy Base Path Mismatch
- **LINE Developers Console**: `https://your-domain.com/api/line-webhook`
- **Reverse Proxy**: Adds base path like `/api/v1`
- **Result**: Webhook URL is incorrect

## Solutions

### ✅ Solution 1: Fix Trailing Slash (Already Applied)

The webhook route has been updated to handle both trailing and non-trailing slash URLs:

```javascript
// Main route (without trailing slash)
app.post('/api/line-webhook', async (req, res) => { ... });

// Handle trailing slash variant
app.post('/api/line-webhook/', async (req, res) => {
  req.url = '/api/line-webhook';
  return app._router.handle(req, res);
});
```

### ✅ Solution 2: Use HTTPS in LINE Developers Console

1. Go to [LINE Developers Console](https://developers.line.biz/console/)
2. Select your Channel → Messaging API
3. Under "Webhook settings", verify the webhook URL:
   - ✅ **Correct**: `https://your-domain.com/api/line-webhook`
   - ❌ **Wrong**: `http://your-domain.com/api/line-webhook`
   - ⚠️ **Note**: No trailing slash needed (both work now)

### ✅ Solution 3: Test the Webhook

Use the provided test tool to verify the webhook is working:

```bash
cd backend
node test-webhook.js https://your-domain.com/api/line-webhook
```

Expected output:
```
✅ Test 1: Checking for redirects...
   Response Code: 200
   ✅ No redirect (GET returns 200)

✅ Test 2: Sending webhook POST request...
   Response Code: 200
   ✅ SUCCESS: Webhook returned 200 OK
```

### ✅ Solution 4: Verify with LINE Developers Console

After fixing the webhook URL, use the "Verify" button in LINE Developers Console:

1. Click "Verify" next to your webhook URL
2. Should show: ✅ **200 OK**
3. If still showing 302, check:
   - Webhook URL is HTTPS (not HTTP)
   - Webhook URL is accessible from internet
   - Server is running and not blocked by firewall

### ✅ Solution 5: Check Server Configuration

If using reverse proxy (nginx, Apache, Cloudflare, etc.):

#### Nginx Example
```nginx
location /api/line-webhook {
    proxy_pass http://localhost:3000/api/line-webhook;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # IMPORTANT: Don't redirect LINE webhook
    if ($request_uri ~* "^/api/line-webhook") {
        proxy_pass http://localhost:3000/api/line-webhook;
    }
}
```

#### Cloudflare Example
- Disable "Auto Minify" for the webhook path
- Ensure "Always Use HTTPS" doesn't break webhook (use HTTPS in LINE console)
- Check "Page Rules" don't redirect webhook URL

## Verification Checklist

- [ ] Webhook URL in LINE Developers Console uses HTTPS
- [ ] Webhook URL is accessible from internet (not localhost)
- [ ] Server is running (`npm start` in backend directory)
- [ ] Test tool shows 200 OK (no redirects)
- [ ] LINE Developers Console "Verify" button shows 200 OK
- [ ] Trailing slash works (both `/api/line-webhook` and `/api/line-webhook/`)
- [ ] No authentication/authorization blocking the webhook
- [ ] Firewall allows external connections

## Debugging Tips

### 1. Check Server Logs

```bash
cd backend
npm start

# Look for these logs when webhook is called:
# 📥 LINE Webhook received from ...
# ✅ LINE signature verified
# ✅ Webhook processed successfully
```

### 2. Use Test Tool

```bash
node test-webhook.js https://your-domain.com/api/line-webhook
```

### 3. Test from External Network

Make sure the webhook URL is accessible from outside your local network:

```bash
curl -X POST https://your-domain.com/api/line-webhook \
  -H "Content-Type: application/json" \
  -H "X-Line-Signature: test" \
  -d '{"destination":"U123","events":[]}'
```

Should return: `{"success":true}`

## Common Issues Fixed

| Issue | Cause | Fix |
|-------|-------|-----|
| 302 Found | Trailing slash mismatch | ✅ Both slash variants now supported |
| 302 Found | HTTP → HTTPS redirect | Use HTTPS in LINE console |
| Connection refused | Server not running | Run `npm start` in backend |
| Connection timeout | Firewall/port blocked | Open port 3000 or use reverse proxy |
| 401 Unauthorized | Invalid signature | Check LINE_CHANNEL_SECRET |
| 429 Too Many Requests | Rate limiting | Adjust rate limit in server.js |

## Need More Help?

1. Check server logs for detailed error messages
2. Run test tool: `node test-webhook.js <your-webhook-url>`
3. Verify LINE Developers Console shows 200 OK
4. Check firewall/network allows external connections

---

**Last Updated**: 2026-03-07
**Status**: ✅ Fix applied and tested
