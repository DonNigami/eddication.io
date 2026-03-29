# JETSETGO - Deployment Guide

## Prerequisites

1. **Supabase Account** - Free tier project
2. **Groq Account** - Free API key at https://groq.com
3. **LINE Developers Account** - For LINE Messaging API
4. **Node.js** - For deployment scripts
5. **Git** - For version control

---

## Environment Variables Setup

### 1. Create `.env.secrets` file

```bash
# Copy from template
cp .env.secrets.example .env.secrets
```

### 2. Required Environment Variables

| Variable | Description | How to Get |
|----------|-------------|------------|
| `SUPABASE_URL` | Supabase project URL | Dashboard → Settings → API |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Dashboard → Settings → API |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI token | Supabase CLI (`supabase login`) |
| `SUPABASE_PROJECT_REF` | Project reference | e.g., `icgtllieipahixesllux` |
| `GROQ_API_KEY` | Groq API key | https://groq.com → API Keys |
| `HUGGINGFACE_API_KEY` | Hugging Face API (optional) | https://huggingface.co → Settings → Access Tokens |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging API token | LINE Developers Console → Messaging API |
| `LINE_CHANNEL_SECRET` | LINE Channel Secret | LINE Developers Console → Messaging API |

---

## Deployment Steps

### Step 1: Apply Database Migrations

1. Go to Supabase Dashboard → SQL Editor
2. Run each migration file in order:

```sql
-- 1. Enable pgvector
-- File: supabase/migrations/jetsetgo_001_pgvector.sql

-- 2. Create catalog tables
-- File: supabase/migrations/jetsetgo_002_catalog_tables.sql

-- 3. Create ingestion tables
-- File: supabase/migrations/jetsetgo_003_ingestion_tables.sql

-- 4. Create LINE bot tables
-- File: supabase/migrations/jetsetgo_004_linebot_tables.sql

-- 5. Create vector indexes
-- File: supabase/migrations/jetsetgo_005_vector_indexes.sql

-- 6. Create search functions
-- File: supabase/migrations/jetsetgo_006_search_functions.sql

-- 7. Create RLS policies
-- File: supabase/migrations/jetsetgo_007_rls_policies.sql

-- 8. Create agent tables (NEW)
-- File: supabase/migrations/jetsetgo_008_agent_tables.sql
```

### Step 2: Deploy Edge Functions

```bash
# Navigate to project directory
cd JETSETGO

# Login to Supabase (if not already)
supabase login

# Link to project
supabase link --project-ref icgtllieipahixesllux

# Deploy all functions
supabase functions deploy jetsetgo-embed
supabase functions deploy jetsetgo-ingest
supabase functions deploy jetsetgo-ocr
supabase functions deploy jetsetgo-structure
supabase functions deploy jetsetgo-rag-query
supabase functions deploy jetsetgo-line-webhook
supabase functions deploy jetsetgo-agent  # NEW - Agentic AI
```

### Step 3: Configure Environment Variables in Supabase

Go to Supabase Dashboard → Edge Functions → [Function Name] → Settings → Environment Variables

Add the following secrets to each function:

**All Functions:**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

**jetsetgo-embed:**
- `HUGGINGFACE_API_KEY` (optional)

**jetsetgo-rag-query, jetsetgo-agent:**
- `GROQ_API_KEY`

**jetsetgo-line-webhook:**
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`

### Step 4: Set Up LINE Webhook

1. Go to [LINE Developers Console](https://developers.line.biz/)
2. Select your Channel → Messaging API
3. Set Webhook URL:
   ```
   https://icgtllieipahixesllux.supabase.co/functions/v1/jetsetgo-line-webhook
   ```
4. Verify webhook with LINE Channel Secret

### Step 5: Create Storage Buckets

Go to Supabase Dashboard → Storage → Create a new bucket:

1. **catalog-uploads** - For PDF/Excel catalog uploads
2. **ocr-images** - For OCR processing images
3. **product-images** - For product photos

Set public access for `product-images` only.

### Step 6: Test Deployment

#### Test Agent Orchestrator

```bash
curl -X POST https://icgtllieipahixesllux.supabase.co/functions/v1/jetsetgo-agent \
  -H "Content-Type: application/json" \
  -d '{
    "query": "ยาง Michelin",
    "sessionId": "test-session-001"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "🔍 พบ X รายการ...",
  "intent": "search",
  "involvedAgents": ["search"],
  "executionTime": 1234
}
```

#### Test LINE Webhook

```bash
curl -X POST https://icgtllieipahixesllux.supabase.co/functions/v1/jetsetgo-line-webhook \
  -H "Content-Type: application/json" \
  -H "x-line-signature: test" \
  -d '{
    "destination": "test",
    "events": [{
      "type": "message",
      "source": { "type": "user", "userId": "test" },
      "message": { "type": "text", "text": "สวัสดี" },
      "replyToken": "test"
    }]
  }'
```

---

## Monitoring Setup

### 1. Free Tier Monitoring

**Supabase Dashboard:**
- Database size: Dashboard → Database → Usage
- API requests: Dashboard → Database → Metrics
- Storage: Dashboard → Storage → Usage

**Key Metrics to Track:**
- Database size (limit: 500MB)
- Storage usage (limit: 1GB)
- Function invocations (limit: 500K/month)
- Edge function execution time

### 2. Set Up UptimeRobot (Free)

1. Go to https://uptimerobot.com/
2. Add monitor for Webhook URL
3. Set check interval: 5 minutes
4. Add alert email

### 3. Google Analytics (Optional)

Add to admin panel:

```html
<!-- admin/index.html -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

---

## Rollback Procedure

If issues occur after deployment:

### Rollback Edge Function

```bash
# View previous versions
supabase functions list

# Redeploy specific version (if saved)
supabase functions deploy jetsetgo-agent --no-verify-jwt
```

### Rollback Database Migration

```bash
# Create rollback migration
cat > rollback_migration.sql << EOF
-- Rollback agent tables
DROP TABLE IF EXISTS agent_logs CASCADE;
DROP TABLE IF EXISTS conversation_history CASCADE;
DROP TABLE IF EXISTS agent_memory CASCADE;
DROP TABLE IF EXISTS conversation_state CASCADE;
DROP TABLE IF EXISTS promotions CASCADE;
DROP TABLE IF EXISTS vehicle_compatibility CASCADE;
EOF

# Run in Supabase Dashboard → SQL Editor
```

---

## Troubleshooting

### Issue: "Embedding API error"

**Solution:** Hugging Face API may be loading. Try:
1. Use without API key (free tier)
2. Or wait and retry

### Issue: "Search returns no results"

**Solution:**
1. Check data exists: `SELECT COUNT(*) FROM parts_catalog;`
2. Check embeddings exist: `SELECT COUNT(*) FROM parts_catalog WHERE embedding IS NOT NULL;`
3. Re-generate embeddings if needed

### Issue: "LINE webhook not responding"

**Solution:**
1. Check webhook URL is correct
2. Verify LINE Channel Secret matches
3. Check Supabase logs: Dashboard → Edge Functions → Logs

### Issue: "Rate limit exceeded"

**Solution:**
1. Groq free tier: 1 request/second
2. Implement request queuing in your application
3. Or upgrade to paid tier

---

## Post-Deployment Checklist

- [ ] All migrations applied successfully
- [ ] All Edge Functions deployed
- [ ] Environment variables configured
- [ ] LINE webhook verified
- [ ] Storage buckets created
- [ ] Test query returns results
- [ ] LINE bot responds to messages
- [ ] Admin panel loads correctly
- [ ] Monitoring active
- [ ] Documentation updated

---

## Cost Summary (Free Tier)

| Service | Monthly Cost | Limits |
|---------|--------------|--------|
| Supabase | **$0** | 500MB DB, 1GB Storage, 500K API requests |
| Groq | **$0** | 1 req/sec, unlimited tokens |
| Hugging Face | **$0** | 1,000 requests/month |
| LINE Messaging API | **$0** | Unlimited messages (developer tier) |
| UptimeRobot | **$0** | 50 monitors, 5-minute intervals |
| **TOTAL** | **$0/month** | |

---

## Next Steps

1. **Populate Catalog Data** - Upload initial product catalog
2. **Test Real Scenarios** - Run through common user workflows
3. **Train Staff** - Teach team how to use admin panel
4. **Monitor Usage** - Track free tier limits
5. **Gather Feedback** - Collect user feedback for improvements

---

## Contact & Support

For issues or questions:
- GitHub Issues: https://github.com/your-repo/issues
- Email: support@jetsetgo.com
- LINE: @JETSETGO
