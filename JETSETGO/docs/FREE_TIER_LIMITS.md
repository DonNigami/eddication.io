# JETSETGO - Free Tier Limits & Optimization

## Overview

JETSETGO is designed to run completely on **FREE tiers** of all services. This document outlines the limits and provides strategies to stay within them.

---

## Supabase Free Tier

### Limits

| Resource | Free Limit | Consequences |
|-----------|------------|--------------|
| Database Size | 500 MB | Need to archive or cleanup old data |
| File Storage | 1 GB | Need to compress images or use external CDN |
| Bandwidth | 1 GB/month | Throttling after limit reached |
| API Requests | 50,000/day | Throttling after limit reached |
| Edge Function Invocations | 500,000/month | Throttling after limit |
| Edge Function Execution Time | 150ms/request average | Need to optimize slow functions |
| Rows Returned | 1,000 per query | Need pagination for large datasets |
| Row Size | 300 MB | Split large tables |

### Monitoring Usage

```sql
-- Check database size
SELECT
  pg_database.datname as database_name,
  pg_size_pretty(pg_database_size(pg_database.datname)) as database_size,
  (pg_database_size(pg_database.datname) / (500 * 1024 * 1024) * 100)::decimal(5,2) as percentage_used
FROM pg_database
WHERE datname = 'postgres';

-- Check largest tables
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  (pg_total_relation_size(schemaname||'.'||tablename) / (500 * 1024 * 1024) * 100)::decimal(5,2) as percentage
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;

-- Check row counts
SELECT
  schemaname,
  tablename,
  n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY n_live_tup DESC;
```

### Optimization Strategies

1. **Data Retention Policy**
   - Archive old search logs after 90 days
   - Clean up expired agent memory
   - Remove old conversation history

2. **Image Optimization**
   - Compress product images to max 500KB each
   - Use WebP format instead of PNG/JPG
   - Store large images externally (Cloudflare R2, etc.)

3. **Query Optimization**
   - Use pagination (`LIMIT`, `OFFSET`)
   - Create indexes on frequently queried columns
   - Use materialized views for analytics

---

## Groq Free Tier

### Limits

| Resource | Free Limit | Notes |
|-----------|------------|-------|
| Requests | 1 request/second | Rate limit |
| Tokens | Unlimited | No per-day limit |
| Models | All free models | Llama 3.1 8B, Mixtral 8x7B, etc. |

### Handling Rate Limiting

The system implements automatic rate limiting:

```typescript
// Automatic queueing for rapid requests
await groqRateLimiter.waitIfNeeded();
return await generateGroqResponse(messages, apiKey);
```

### Optimization Strategies

1. **Batch Requests** - Combine multiple queries when possible
2. **Response Caching** - Cache common responses for 5 minutes
3. **Shorter Prompts** - Use concise system prompts

---

## Hugging Face Free Tier

### Limits

| Resource | Free Limit | Notes |
|-----------|------------|-------|
| Inference API | 1,000 requests/month | For embeddings |
| Model Hosting | FREE | Host up to 10 models |

### Alternative: Transformers.js

For zero-cost embeddings, use client-side Transformers.js:

```typescript
// Runs completely in browser, no API needed
import { pipeline } from '@xenova/transformers';

const generator = await pipeline('feature-extraction', 'KoonJamesZ/nina-thai-v3');
const output = await generator('ยาง Michelin');
const embedding = output.tolist()[0];
```

---

## LINE Messaging API Free Tier

### Limits

| Resource | Free Limit | Notes |
|-----------|------------|-------|
| Messages | Unlimited | Developer tier |
| Webhook | 1 endpoint | Included |
| Rich Menu | Unlimited | Included |
| LIFF Apps | Unlimited | Included |

### Optimization Strategies

1. **Efficient Message Design**
   - Use Flex Messages for rich content
   - Limit carousel items to 10
   - Compress images before sending

2. **Webhook Optimization**
   - Respond within 3 seconds (LINE timeout)
   - Use async for long operations

---

## Free Tier Monitoring Dashboard

### Daily Checks

```bash
# Run daily to check usage
npm run check:usage
```

### Alerts

Set up alerts for:
- Database > 80% (400 MB)
- Storage > 80% (800 MB)
- API requests > 40,000/day

---

## Cost Saving Strategies

### 1. Embedding Caching

```typescript
// Cache embeddings for 24 hours
const cachedEmbedding = await redis.get(`embed:${query}`);
if (cachedEmbedding) {
  return JSON.parse(cachedEmbedding);
}
```

### 2. Search Result Caching

```typescript
// Cache search results for 5 minutes
const cacheKey = `search:${category}:${query}`;
const cached = await redis.get(cacheKey);
if (cached) {
  return JSON.parse(cached);
}
```

### 3. Pagination

```typescript
// Always use pagination
const page = req.query.page || 1;
const limit = 20;
const offset = (page - 1) * limit;

const { data } = await supabase
  .from('parts_catalog')
  .select('*')
  .range(offset, offset + limit - 1);
```

### 4. Lazy Loading

```typescript
// Load images only when visible
const imgObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const img = entry.target;
      img.src = img.dataset.src;
    }
  });
});
```

---

## When to Upgrade

Consider upgrading to paid tiers when:

| Metric | Threshold | Recommended Plan |
|--------|-----------|------------------|
| Monthly Active Users | > 100 | Supabase Pro ($25/month) |
| Catalog Parts | > 10,000 | Supabase Pro |
| Daily API Calls | > 40,000 | Supabase Pro or implement caching |
| Need Faster Response | < 2 second | Groq Paid or dedicated LLM |

---

## Emergency Procedures

### Database Full

1. **Immediate:**
   ```sql
   -- Delete old search logs
   DELETE FROM search_logs WHERE created_at < NOW() - INTERVAL '90 days';

   -- Delete old conversation history
   DELETE FROM conversation_history WHERE created_at < NOW() - INTERVAL '60 days';

   -- Delete expired agent memory
   DELETE FROM agent_memory WHERE expires_at < NOW();
   ```

2. **Long-term:**
   - Set up automated cleanup job
   - Archive old data to external storage

### API Rate Limit Hit

1. **Immediate:**
   - Enable request queuing
   - Return cached responses
   - Show "system busy" message

2. **Long-term:**
   - Implement Redis caching
   - Optimize query performance

---

## Summary

By following these guidelines, JETSETGO can run **100% free** for:
- Up to 1,000 catalog parts
- Up to 100 daily users
- Up to 30,000 monthly searches

Total monthly cost: **$0**

---

Last Updated: 2025-02-11
