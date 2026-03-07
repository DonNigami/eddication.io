# Environment Variables Setup

## 🔐 Security Notice

**NEVER commit the `.env.local` file to git!** This file contains sensitive secrets.

## 📁 Files

- **`.env.example`** - Template file (safe to commit) - Shows what variables are needed
- **`.env.local`** - Actual secrets (DO NOT commit) - Contains real API keys and tokens

## 🚀 Quick Setup

### 1. Copy the example file

```bash
# If you have .env.example
cp .env.example .env.local
```

### 2. Fill in your actual values

Edit `.env.local` and replace the placeholder values with your real credentials.

### 3. Configure your application

#### For Vite-based projects:

```javascript
// In your config.js or main entry
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
```

#### For Node.js backend:

```javascript
// In your backend code
require('dotenv').config()
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
```

## 📋 Required Variables

### Supabase
| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | ✅ Yes |
| `VITE_SUPABASE_ANON_KEY` | Public anon key (client-side) | ✅ Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-side only) | ✅ Yes |

### LINE Platform

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_LIFF_ID` | LINE LIFF App ID | ✅ Yes |
| `LINE_CHANNEL_ACCESS_TOKEN` | Messaging API token | ✅ Yes |
| `LINE_CHANNEL_SECRET` | Channel secret for webhooks | ✅ Yes |

### Google Apps Script (SCORDS Backend)

| Script Property | Description | Required |
|-----------------|-------------|----------|
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging API token (for webhook & chat) | ✅ Yes |
| `GEMINI_API_KEY` | Google Gemini API (Primary AI) | ✅ Recommended |
| `ZAI_API_KEY` | Zhipu AI API (Fallback AI) | ❌ Optional |
| `OPENAI_API_KEY` | OpenAI API (Fallback AI) | ❌ Optional |
| `PDF_FOLDER_ID` | Google Drive folder for PDF search | ❌ Optional |

### Maps & Geocoding
| Variable | Description | Required |
|----------|-------------|----------|
| `NOMINATIM_API_URL` | Nominatim OSM endpoint (free) | ✅ Yes |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API key (optional) | ❌ No |

## 🔑 Where to get these keys?

### Supabase
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - Project URL
   - anon public key
   - service_role key (⚠️ **NEVER use this client-side!**)

### LINE Platform
1. Go to [LINE Developers Console](https://developers.line.biz/console/)
2. Create/select your channel
3. Get credentials from **Channel settings** → **Basic information**

### Maps & Geocoding
**Nominatim OSM** (Free, OpenStreetMap):
- Default: `https://nominatim.openstreetmap.org`
- No API key required
- Rate limit: 1 request per second

**Google Maps** (Optional):
- Go to [Google Cloud Console](https://console.cloud.google.com/)
- Enable **Maps JavaScript API**
- Create API key with appropriate restrictions
- Only needed if you want to use Google Maps instead of OSM

## ⚠️ Important Security Rules

1. **Client-side (Browser):**
   - Use `VITE_SUPABASE_ANON_KEY` ✅
   - **NEVER** use `SUPABASE_SERVICE_ROLE_KEY` ❌

2. **Server-side (Node.js):**
   - Use `SUPABASE_SERVICE_ROLE_KEY` for admin operations
   - Use `LINE_CHANNEL_ACCESS_TOKEN` for messaging

3. **Git:**
   - `.env.local` is in `.gitignore` ✅
   - Never commit real keys
   - Only commit `.env.example`

## 🛠️ Development vs Production

### Development (.env.local)
```bash
VITE_DEV_MODE=true
VITE_API_BASE_URL=http://localhost:3000
```

### Production
Set environment variables in your hosting platform:
- **Vercel**: Project Settings → Environment Variables
- **Netlify**: Site settings → Environment variables
- **Supabase Edge Functions**: `.env` file in functions folder

## 📝 Adding New Variables

1. Add to `.env.example` (with placeholder value)
2. Add to `.env.local` (with real value)
3. Update this README
4. Use in code: `import.meta.env.VITE_YOUR_VAR` or `process.env.YOUR_VAR`

## 🧪 Testing Setup

```bash
# Verify variables are loaded (Node.js)
node -e "require('dotenv').config(); console.log(process.env.VITE_SUPABASE_URL)"

# In browser console (Vite)
console.log(import.meta.env.VITE_SUPABASE_URL)
```

## 🔍 Troubleshooting

**Variables undefined?**
- Restart your dev server after changing `.env.local`
- Check file is in root directory
- Verify no typos in variable names

**Build failing?**
- Ensure all required variables are set
- Check `.env.local` is not committed to git

## 📚 Related Documentation

- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [LINE LIFF Documentation](https://developers.line.biz/en/docs/liff/)
