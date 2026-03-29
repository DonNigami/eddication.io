# JETSETGO - Deployment Guide

## 📋 Quick Start Deployment

### Option 1: Web-Based Deployment (Easiest)

1. **Open Deployment Helper**
   - Open `supabase/deploy.html` in your browser
   - Click "Go to Supabase Dashboard"
   - For each function:
     - Click "Copy Code"
     - Create new function in Supabase Dashboard
     - Paste the code
     - Click Deploy

2. **Apply Database Migrations**
   - Go to: https://supabase.com/dashboard/project/icgtllieipahixesllux/sql
   - Open `supabase/migrations/ALL_MIGRATIONS.sql`
   - Copy entire file
   - Paste in SQL Editor
   - Click "Run"

### Option 2: PowerShell Deployment (Windows)

```powershell
# 1. Open PowerShell
# 2. Navigate to project
cd "d:\VS_Code_GitHub_DATA\eddication.io\eddication.io\JETSETGO\supabase"

# 3. Run deployment script (will prompt for login)
.\deploy-functions-v2.ps1
```

### Option 2b: Manual CLI Deployment (Windows)

```powershell
# Step 1: Login to Supabase (ONE TIME)
supabase login

# Step 2: Navigate to project
cd "d:\VS_Code_GitHub_DATA\eddication.io\eddication.io\JETSETGO\supabase"

# Step 3: Deploy each function
supabase functions deploy jetsetgo-embed --project-ref icgtllieipahixesllux --no-verify-jwt
supabase functions deploy jetsetgo-ingest --project-ref icgtllieipahixesllux --no-verify-jwt
supabase functions deploy jetsetgo-ocr --project-ref icgtllieipahixesllux --no-verify-jwt
supabase functions deploy jetsetgo-structure --project-ref icgtllieipahixesllux --no-verify-jwt
supabase functions deploy jetsetgo-rag-query --project-ref icgtllieipahixesllux --no-verify-jwt
supabase functions deploy jetsetgo-line-webhook --project-ref icgtllieipahixesllux --no-verify-jwt
```

### Option 3: Bash Deployment (Mac/Linux)

```bash
# 1. Navigate to project
cd JETSETGO/supabase

# 2. Make script executable
chmod +x deploy-functions-v2.sh

# 3. Run deployment script (will prompt for login)
./deploy-functions-v2.sh
```

### Option 3b: Manual CLI Deployment (Mac/Linux)

```bash
# Step 1: Login to Supabase (ONE TIME)
supabase login

# Step 2: Navigate to project
cd JETSETGO/supabase

# Step 3: Deploy each function
supabase functions deploy jetsetgo-embed --project-ref icgtllieipahixesllux --no-verify-jwt
supabase functions deploy jetsetgo-ingest --project-ref icgtllieipahixesllux --no-verify-jwt
supabase functions deploy jetsetgo-ocr --project-ref icgtllieipahixesllux --no-verify-jwt
supabase functions deploy jetsetgo-structure --project-ref icgtllieipahixesllux --no-verify-jwt
supabase functions deploy jetsetgo-rag-query --project-ref icgtllieipahixesllux --no-verify-jwt
supabase functions deploy jetsetgo-line-webhook --project-ref icgtllieipahixesllux --no-verify-jwt
```

---

## 🔑 Environment Variables

Set these in Supabase Dashboard → Settings → Edge Functions:

| Variable | Source | Required |
|----------|--------|----------|
| `GROQ_API_KEY` | https://groq.com | ✅ Yes |
| `HUGGINGFACE_API_KEY` | https://huggingface.co/settings/tokens | Optional |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developers Console | For LINE Bot |
| `LINE_CHANNEL_SECRET` | LINE Developers Console | For LINE Bot |

---

## 📦 Edge Functions Summary

| Function | Lines | Purpose |
|----------|-------|---------|
| `jetsetgo-embed` | 244 | Generate embeddings |
| `jetsetgo-ingest` | 338 | Document ingestion |
| `jetsetgo-ocr` | 218 | OCR processing |
| `jetsetgo-structure` | 420 | Data structuring |
| `jetsetgo-rag-query` | 443 | RAG search + LLM |
| `jetsetgo-line-webhook` | 398 | LINE Bot |

**Total: 2,061 lines of TypeScript**

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] All 6 functions appear in Supabase Dashboard → Functions
- [ ] Database tables created (run `SELECT * FROM parts_catalog LIMIT 1;`)
- [ ] pgvector extension enabled (run `SELECT * FROM pg_extension WHERE extname='vector';`)
- [ ] Storage buckets created: `jetsetgo-catalogs`, `jetsetgo-ocr-images`
- [ ] Environment variables set
- [ ] Test a search query via Admin Panel

---

## 🧪 Testing

### Test Admin Panel
1. Open `admin/index.html` in browser
2. Should see "Connected" status
3. Try uploading a CSV file

### Test RAG Query (via curl)
```bash
curl -X POST https://icgtllieipahixesllux.supabase.co/functions/v1/jetsetgo-rag-query \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "ผ้าเบรก โตโยต้า", "catalogType": "parts"}'
```

---

## 📚 Documentation Links

- Supabase Functions: https://supabase.com/docs/guides/functions
- Groq API: https://groq.com
- Hugging Face: https://huggingface.co
- LINE Messaging API: https://developers.line.biz
