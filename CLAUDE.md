# Eddication.io - DriverConnect Project

## Overview

**DriverConnect** is a comprehensive Fuel Delivery Management System built with LINE LIFF (LINE Front-end Framework) for truck drivers to manage their work through the LINE app.

---

## Project Structure

```
eddication.io/
├── PTGLG/driverconnect/           # Main DriverConnect System
│   ├── driverapp/                 # LINE LIFF Driver App
│   ├── admin/                     # Admin Panel (Web Dashboard)
│   └── shared/                    # Shared utilities & config
│
├── backend/                       # Node.js Backend (Express)
│   └── lib/                       # Express server middleware
│
├── supabase/                      # Supabase Configuration
│   ├── functions/                 # Edge Functions
│   │   ├── enrich-coordinates/    # Location enrichment
│   │   └── geocode/               # Geocoding service
│   ├── migrations/                # Database migrations
│   └── apply-migration.js         # Migration helper script
│
└── project/tiktokaff/             # TikTok Affiliate Project (separate)
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend (Driver)** | LINE LIFF, Vanilla JS |
| **Frontend (Admin)** | Vanilla JS, Google Maps API |
| **Backend** | Express.js, Supabase Edge Functions |
| **Database** | Supabase (PostgreSQL) |
| **Storage** | Supabase Storage |
| **External APIs** | LINE Platform, Nominatim OSM, Google Maps |

---

## Core Features

### 1. Driver App (LINE LIFF)
- Job search by reference number
- Multi-stop delivery support
- GPS-based check-in/out with radius validation
- Alcohol testing with photo upload
- Service review with digital signature
- Offline queue for poor signal areas

### 2. Admin Panel
- Real-time fleet dashboard with live map
- Job management and assignment
- Driver approval system
- Performance reports and analytics
- Exception monitoring and alerts

### 3. Location Services
- Geocoding (address → coordinates) via Nominatim
- Reverse geocoding (coordinates → address)
- Distance calculation (Haversine formula)
- GPS tracking with radius-based check-in

### 4. Backend Services
- Supabase Edge Functions for server-side operations
- Google Apps Script integration (legacy)
- Real-time subscriptions via Supabase Realtime

---

## Key Database Tables

| Table | Description |
|-------|-------------|
| `jobdata` | Delivery jobs, stops, check-in/out, odometer |
| `alcohol_checks` | Alcohol test results with photos |
| `review_data` | Service reviews with signatures |
| `process_data` | Fuel pumping data |
| `user_profiles` | Driver/user information |
| `stations` | Service stations/origins |
| `origins` | Job departure points |
| `admin_logs` | Audit logs |
| `extra_costs` | Additional trip costs |

---

## Environment Configuration

### Supabase
- **Project URL**: Set in `shared/config.js`
- **Anon Key**: Set in `shared/config.js`
- **Dashboard**: https://supabase.com/dashboard/project/myplpshpcordggbbtblg

### LINE LIFF
- **LIFF ID**: Set in `driverapp/config.js`
- **LINE Channel Access Token**: For webhook/messaging

### Google Maps
- **API Key**: Set in `admin/js/config.js` or `shared/config.js`

---

## Development Workflow

### Applying Database Migrations

```bash
# Navigate to supabase folder
cd supabase

# Run migration script (outputs SQL to console)
node apply-migration.js

# Copy the SQL output and run in:
# Supabase Dashboard > SQL Editor
```

### Local Development

```bash
# Backend (Express)
cd backend
npm install
npm start

# Driver App (LIFF)
# Serve via VS Code Live Server or similar
# Access via LINE LIFF URL
```

### Edge Functions Deployment

```bash
# Using Supabase CLI
supabase functions deploy enrich-coordinates
supabase functions deploy geocode
```

---

## Important File Locations

| Purpose | File |
|---------|------|
| Driver App Entry | [PTGLG/driverconnect/driverapp/index.html](PTGLG/driverconnect/driverapp/index.html) |
| Admin Entry | [PTGLG/driverconnect/admin/index.html](PTGLG/driverconnect/admin/index.html) |
| Shared Config | [PTGLG/driverconnect/shared/config.js](PTGLG/driverconnect/shared/config.js) |
| Location Service | [PTGLG/driverconnect/driverapp/js/location-service.js](PTGLG/driverconnect/driverapp/js/location-service.js) |
| Geocoding Edge Function | [supabase/functions/geocode/index.ts](supabase/functions/geocode/index.ts) |
| Development Plan | [PTGLG/driverconnect/gleaming-crafting-wreath.md](PTGLG/driverconnect/gleaming-crafting-wreath.md) |

---

## Current Status

### Completed
- Driver App core functionality (check-in/out, GPS, alcohol test, reviews)
- Admin Panel with real-time map and dashboard
- Supabase Edge Functions for geocoding
- Driver approval system
- Security hardening (XSS fixes, centralized API keys)

### In Progress
- Row-Level Security (RLS) policies
- Application-layer auth verification
- Performance optimization

---

## Security Notes

- **RLS Status**: Partially implemented - verify policies before production
- **API Keys**: Centralized in `shared/config.js` - never commit to git
- **XSS Protection**: All HTML output uses `sanitizeHTML()` utility
- **Dev Mode**: Remove any `?dev=1` bypass code before production

---

## Getting Started

1. **Setup Supabase**: Apply migrations in `supabase/migrations/`
2. **Configure Environment**: Update API keys in `shared/config.js`
3. **Deploy Edge Functions**: Use Supabase CLI to deploy functions
4. **Register LIFF App**: Add to LINE Developers Console
5. **Test Driver App**: Access via LINE LIFF URL
6. **Access Admin Panel**: Open `admin/index.html` in browser

---

## Additional Resources

- [Development Plan](PTGLG/driverconnect/gleaming-crafting-wreath.md) - Detailed phase-by-phase roadmap
- [LINE LIFF Documentation](https://developers.line.biz/en/docs/liff/)
- [Supabase Documentation](https://supabase.com/docs)

---

## Skills Reference

This project uses specialized Claude Code skills for context-aware assistance:

| Skill | Purpose | When to Use |
| :--- | :--- | :--- |
| **supabase-database** | PostgreSQL, RLS, Edge Functions, Realtime | Database queries, migrations, RLS policies |
| **line-messaging** | LIFF, Messaging API, Rich Menus | Driver app features, LINE integration |
| **4pl-director** | Logistics strategy, 4PL operations | Route optimization, delivery workflows |
| **fullstack-dev** | JavaScript/Node.js, architecture | Full-stack features, refactoring |
| **typescript-dev** | TypeScript patterns, types | Edge Functions, type safety |
| **frontend-design** | UI/UX, CSS architecture | Admin panel, driver app design |
| **webapp-testing** | Playwright E2E testing | Test automation, quality assurance |
| **n8n-ai-automation** | Workflow automation | Notifications, data sync workflows |
| **logistics-analyst** | Data analytics, KPIs | Performance reports, metrics |
| **mcp-builder** | MCP server development | Google Maps MCP, LINE MCP, Supabase MCP |
| **web-artifacts-builder** | React/TypeScript artifacts | HTML artifacts, UI components |
| **sales-marketing-saas** | SaaS growth, marketing | Business model, go-to-market strategy |
| **financial-accounting** | SaaS finance, Thailand tax | Pricing, unit economics, VAT/PDPA |

### Skill Context Files

Skills have been updated with DriverConnect project context:
- `.claude/skills/supabase-database/SKILL.md` - Database tables, RLS status, Edge Functions
- `.claude/skills/line-messaging/SKILL.md` - LIFF app details, configuration
- `.claude/skills/4pl-director/SKILL.md` - Development plan status, roadmap
- `.claude/skills/fullstack-dev/SKILL.md` - Architecture, refactoring notes
- `.claude/skills/typescript-dev/SKILL.md` - Edge Functions, shared types
- `.claude/skills/frontend-design/SKILL.md` - Admin panel, driver app screens
- `.claude/skills/webapp-testing/SKILL.md` - Testing strategy, fixtures
- `.claude/skills/n8n-ai-automation/SKILL.md` - Workflow examples, webhooks
- `.claude/skills/logistics-analyst/SKILL.md` - KPIs, Thailand-specific context
- `.claude/skills/mcp-builder/SKILL.md` - MCP use cases, integration notes
- `.claude/skills/web-artifacts-builder/SKILL.md` - UI components, design constraints
- `.claude/skills/sales-marketing-saas/SKILL.md` - Business model, growth levers
- `.claude/skills/financial-accounting/SKILL.md` - Unit economics, Thailand tax
