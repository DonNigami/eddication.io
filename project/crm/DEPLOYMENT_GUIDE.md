# 🚀 CRM Pro - Deployment Guide (Version 2.0)

## ✨ New Features Added

### 1. **API Key Authentication** 🔐
- Secure all Edge Function endpoints with Bearer token
- Prevents unauthorized access
- Configurable via `FUNCTION_API_KEY` environment variable

### 2. **Rate Limiting** ⚡
- IP-based rate limiting (100 requests per minute)
- Prevents abuse and DDoS attacks
- Automatic rate limit window reset

### 3. **Transaction History Logging** 📊
- Complete audit trail of all points changes
- Tracks: before/after amounts, reason, admin ID
- Queryable for reports and analytics

### 4. **Audit Logging** 🔍
- Logs all admin actions (broadcasts, updates)
- Tracks: actor, target, success/failure counts
- Metadata includes request ID for debugging

---

## 📋 Pre-Deployment Checklist

- [ ] Database schema updated (run `database-schema.sql`)
- [ ] Environment variables configured in Supabase
- [ ] FUNCTION_API_KEY generated and stored
- [ ] RLS policies enabled on new tables
- [ ] Test environment validated
- [ ] Backup of current database taken

---

## 🗄️ Step 1: Update Database Schema

### Option A: Supabase Dashboard
1. Go to **SQL Editor** in Supabase Dashboard
2. Copy contents of `database-schema.sql`
3. Click **Run** to create tables and policies

### Option B: Supabase CLI
```bash
supabase db push
```

### Verify Tables Created
```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('transaction_history', 'audit_logs');

-- Verify RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('transaction_history', 'audit_logs');
```

---

## 🔧 Step 2: Configure Environment Variables

### Generate API Key
```bash
# Generate a secure random API key (32 characters)
openssl rand -hex 32
# Or use PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

### Set Environment Variables in Supabase

#### Via Supabase Dashboard:
1. Go to **Project Settings** → **Edge Functions**
2. Add these secrets:

```bash
FUNCTION_API_KEY=<your-generated-key>
LINE_CHUNK_SIZE=500
CHUNK_DELAY_MS=200
MAX_POINTS_CHANGE=10000
```

#### Via Supabase CLI:
```bash
supabase secrets set FUNCTION_API_KEY=<your-generated-key>
supabase secrets set LINE_CHUNK_SIZE=500
supabase secrets set CHUNK_DELAY_MS=200
supabase secrets set MAX_POINTS_CHANGE=10000
```

### Verify Secrets Set
```bash
supabase secrets list
```

---

## 📦 Step 3: Deploy Edge Function

### Deploy Command
```bash
supabase functions deploy crm-pro
```

### Verify Deployment
```bash
# Check function logs
supabase functions logs crm-pro --tail
```

---

## 🧪 Step 4: Testing

### Test 1: API Key Authentication ✅

**Without API Key (Should Fail):**
```bash
curl -X POST https://ckhwouxtrvuthefkxnxb.supabase.co/functions/v1/crm-pro \
  -H "Content-Type: application/json" \
  -d '{
    "action": "update-points",
    "userId": "test123",
    "points": 100
  }'

# Expected: 401 Unauthorized
```

**With Valid API Key (Should Succeed):**
```bash
curl -X POST https://ckhwouxtrvuthefkxnxb.supabase.co/functions/v1/crm-pro \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FUNCTION_API_KEY" \
  -d '{
    "action": "update-points",
    "userId": "test123",
    "points": 100,
    "reason": "Test transaction",
    "adminId": "admin123"
  }'

# Expected: 200 OK with newPoints value
```

### Test 2: Rate Limiting ⚡

**Exceed Rate Limit (100 requests/min):**
```bash
# Run this script to test rate limiting
for i in {1..150}; do
  curl -X POST https://ckhwouxtrvuthefkxnxb.supabase.co/functions/v1/crm-pro \
    -H "Authorization: Bearer YOUR_FUNCTION_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"action":"update-points","userId":"test","points":10}' &
done

# Expected: First 100 succeed, next 50 return 429 Rate Limit Exceeded
```

### Test 3: Transaction History 📊

**Update Points and Check History:**
```bash
# 1. Update points
curl -X POST https://ckhwouxtrvuthefkxnxb.supabase.co/functions/v1/crm-pro \
  -H "Authorization: Bearer YOUR_FUNCTION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "update-points",
    "userId": "U1234567890abcdef",
    "points": 500,
    "reason": "Birthday bonus",
    "adminId": "admin@example.com"
  }'

# 2. Query transaction history
# Go to Supabase SQL Editor and run:
SELECT * FROM transaction_history 
WHERE user_id = 'U1234567890abcdef' 
ORDER BY created_at DESC 
LIMIT 5;

# Expected: New transaction with points_change=500, reason="Birthday bonus"
```

### Test 4: Audit Logging 🔍

**Send Broadcast and Check Audit:**
```bash
# 1. Send test broadcast
curl -X POST https://ckhwouxtrvuthefkxnxb.supabase.co/functions/v1/crm-pro \
  -H "Authorization: Bearer YOUR_FUNCTION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "broadcast",
    "target": "test",
    "testUserId": "U1234567890abcdef",
    "msgType": "text",
    "message": "Test broadcast message",
    "adminId": "admin@example.com"
  }'

# 2. Query audit logs
# Go to Supabase SQL Editor and run:
SELECT * FROM audit_logs 
WHERE action = 'broadcast' 
ORDER BY created_at DESC 
LIMIT 5;

# Expected: New audit log with action="broadcast", success_count=1
```

---

## 📊 Step 5: Update Frontend (test.html)

Add API Key to fetch requests:

```javascript
// In test.html, update all Supabase function calls
const apiKey = 'YOUR_FUNCTION_API_KEY'; // Store securely, not in frontend!

async function updatePoints(userId, points, reason) {
  const { data, error } = await supabase.functions.invoke('crm-pro', {
    body: { 
      action: 'update-points', 
      userId, 
      points,
      reason: reason || 'Manual adjustment',
      adminId: userProfile.line_user_id
    },
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });
  
  if (error) throw error;
  return data;
}
```

**⚠️ Security Warning:** 
- For production, API key should be stored server-side
- Frontend should authenticate via Supabase Auth
- Use RLS policies for database access control

---

## 📈 Step 6: Monitoring & Analytics

### View Transaction Summary
```sql
-- Top 10 users by points earned this month
SELECT 
    user_id,
    SUM(points_change) as total_points,
    COUNT(*) as transaction_count,
    MAX(created_at) as last_transaction
FROM transaction_history
WHERE created_at >= DATE_TRUNC('month', NOW())
GROUP BY user_id
ORDER BY total_points DESC
LIMIT 10;
```

### View Admin Activity Report
```sql
-- Admin actions in last 7 days
SELECT 
    actor_id,
    action,
    COUNT(*) as count,
    SUM(target_count) as total_users_affected,
    SUM(success_count) as total_success,
    SUM(failed_count) as total_failed
FROM audit_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY actor_id, action
ORDER BY count DESC;
```

### View Broadcast Performance
```sql
-- Broadcast success rate by day
SELECT 
    DATE(created_at) as date,
    COUNT(*) as broadcast_count,
    SUM(success_count) as total_sent,
    SUM(failed_count) as total_failed,
    ROUND(SUM(success_count)::numeric / NULLIF(SUM(success_count + failed_count), 0) * 100, 2) as success_rate
FROM audit_logs
WHERE action = 'broadcast'
GROUP BY DATE(created_at)
ORDER BY date DESC
LIMIT 30;
```

---

## 🔒 Step 7: Security Best Practices

### 1. Secure API Key Storage
- ✅ Store in environment variables (Supabase secrets)
- ✅ Never commit to Git
- ✅ Rotate every 90 days
- ❌ Never expose in frontend JavaScript

### 2. Enable Database RLS
```sql
-- Ensure all tables have RLS enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_promotions ENABLE ROW LEVEL SECURITY;
```

### 3. Monitor Failed Requests
```sql
-- Check for suspicious activity
SELECT 
    ip_address,
    COUNT(*) as failed_attempts,
    MAX(created_at) as last_attempt
FROM audit_logs
WHERE metadata->>'error' IS NOT NULL
GROUP BY ip_address
HAVING COUNT(*) > 10
ORDER BY failed_attempts DESC;
```

---

## 🐛 Troubleshooting

### Issue: "Unauthorized: Invalid API Key"
**Solution:** Verify API key is set and matches in both Supabase secrets and frontend

```bash
# Check secrets
supabase secrets list

# Test with correct key
curl -H "Authorization: Bearer $(supabase secrets get FUNCTION_API_KEY)" ...
```

### Issue: "Rate limit exceeded"
**Solution:** Wait 1 minute or increase rate limit in code

```typescript
// In crm-pro.ts
const RATE_LIMIT_MAX = 200; // Increase from 100
```

### Issue: Transaction history not logging
**Solution:** Check if table exists and RLS policies are correct

```sql
-- Verify table exists
\dt transaction_history

-- Check policies
SELECT * FROM pg_policies WHERE tablename = 'transaction_history';

-- Test insert manually
INSERT INTO transaction_history (user_id, points_change, points_before, points_after, action, reason)
VALUES ('test123', 100, 0, 100, 'test', 'Manual test');
```

### Issue: Audit logs not appearing
**Solution:** Ensure `adminId` is passed in request body

```javascript
// Make sure to include adminId
{
  action: 'broadcast',
  adminId: userProfile.line_user_id, // ⬅️ Add this
  target: 'all',
  msgType: 'text',
  message: 'Hello'
}
```

---

## 📚 Additional Resources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [LINE Messaging API Docs](https://developers.line.biz/en/docs/messaging-api/)

---

## 🎯 Next Steps

After deployment, consider implementing:

1. **Frontend Dashboard for Analytics** 📊
   - Transaction history viewer
   - Admin activity report
   - Broadcast performance metrics

2. **Scheduled Reports** 📧
   - Daily summary emails
   - Weekly performance reports
   - Monthly analytics dashboard

3. **Advanced Features** 🚀
   - Webhook handler for LINE messages
   - Automated segment updates
   - A/B testing for broadcasts
   - Push notification scheduling

---

## ✅ Deployment Checklist Summary

- [ ] Database schema updated
- [ ] Environment variables set
- [ ] Edge function deployed
- [ ] API key authentication tested
- [ ] Rate limiting verified
- [ ] Transaction logging confirmed
- [ ] Audit logging validated
- [ ] Frontend updated with API key
- [ ] Monitoring queries saved
- [ ] Security best practices applied
- [ ] Documentation shared with team

---

**Version:** 2.0.0  
**Last Updated:** 2025-12-30  
**Author:** GitHub Copilot  
**Status:** ✅ Production Ready
