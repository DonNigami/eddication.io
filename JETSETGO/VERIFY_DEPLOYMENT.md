# JETSETGO - Deployment Verification Guide

## Quick Verification Checklist

### Step 1: Verify Database Migrations

Open Supabase SQL Editor: https://supabase.com/dashboard/project/icgtllieipahixesllux/sql

Run these verification queries:

```sql
-- 1. Check pgvector extension
SELECT * FROM pg_extension WHERE extname='vector';

-- Expected: 1 row with extname='vector'

-- 2. Check tables exist
SELECT tablename
FROM pg_tables
WHERE schemaname='public'
  AND tablename LIKE '%catalog%'
  OR tablename LIKE '%jetsetgo%'
  OR tablename LIKE '%ingestion%'
ORDER BY tablename;

-- Expected: parts_catalog, tires_catalog, catalog_sources, ingestion_jobs, etc.

-- 3. Check HNSW indexes
SELECT indexname, tablename
FROM pg_indexes
WHERE indexname LIKE '%embedding%';

-- Expected: idx_parts_embedding, idx_tires_embedding

-- 4. Check storage buckets
SELECT * FROM storage.buckets;

-- Expected: jetsetgo-catalogs, jetsetgo-ocr-images
```

### Step 2: Verify Edge Functions

Open Supabase Functions: https://supabase.com/dashboard/project/icgtllieipahixesllux/functions

Expected functions (6 total):
- [ ] `jetsetgo-embed` - Generate embeddings (244 lines)
- [ ] `jetsetgo-ingest` - Document ingestion (338 lines)
- [ ] `jetsetgo-ocr` - OCR processing (218 lines)
- [ ] `jetsetgo-structure` - Data structuring (420 lines)
- [ ] `jetsetgo-rag-query` - RAG search (443 lines)
- [ ] `jetsetgo-line-webhook` - LINE bot (398 lines)

### Step 3: Verify Environment Variables

In Supabase Dashboard → Settings → Edge Functions:

- [ ] `GROQ_API_KEY` - Get from https://groq.com (FREE)
- [ ] `HUGGINGFACE_API_KEY` - Optional, for embeddings (1000 free/month)
- [ ] `LINE_CHANNEL_ACCESS_TOKEN` - From LINE Developers Console
- [ ] `LINE_CHANNEL_SECRET` - From LINE Developers Console

### Step 4: Test Admin Panel

1. Open `admin/index.html` in browser
2. Expected: "Connected" status in header
3. Expected: Dashboard shows statistics

### Step 5: Test RAG Query

```bash
curl -X POST https://icgtllieipahixesllux.supabase.co/functions/v1/jetsetgo-rag-query \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "ผ้าเบรก โตโยต้า", "catalogType": "parts"}'
```

Expected: JSON response with search results

---

## Test Data Insertion

If you want to add test data:

```sql
-- Insert a test part
INSERT INTO parts_catalog (
  part_number, part_name_th, part_name_en, brand, category,
  price, stock_quantity, embedding
) VALUES (
  'TEST-001',
  'ผ้าเบรกหลัง',
  'Rear Brake Pad',
  'Toyota',
  'Brake System',
  1500.00,
  50,
  '[0.1, 0.2, ...]'  -- 768-dimensional vector (use actual embedding)
);

-- Insert a test tire
INSERT INTO tires_catalog (
  part_number, brand, model, size, tire_type, price, stock_quantity
) VALUES (
  'TIRE-001',
  'Michelin',
  'Primacy 4',
  '205/55R16',
  'all-season',
  3500.00,
  20
);
```

---

## Troubleshooting

### Error: "relation does not exist"
**Solution**: Run migrations from `supabase/migrations/ALL_MIGRATIONS.sql`

### Error: "function does not exist"
**Solution**: Deploy Edge Functions or verify they're deployed

### Error: "No embedding service configured"
**Solution**: Set `HUGGINGFACE_API_KEY` environment variable

### Connection error in Admin Panel
**Solution**: Verify SUPABASE_URL and SUPABASE_ANON_KEY in `admin/js/app.js`

---

## File Locations Reference

| Component | Path |
|-----------|------|
| Admin Panel | `JETSETGO/admin/index.html` |
| Edge Functions | `JETSETGO/supabase/functions/*/index.ts` |
| Migrations | `JETSETGO/supabase/migrations/*.sql` |
| Deploy Helper | `JETSETGO/supabase/deploy.html` |
| Deployment Guide | `JETSETGO/DEPLOYMENT.md` |
| Plan | `JETSETGO/jetsetgo_plan.md` |
