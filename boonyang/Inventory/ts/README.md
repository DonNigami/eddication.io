# Boonyang Inventory - TypeScript

## Overview

TypeScript rewrite of the Boonyang Inventory system using Supabase as the database. This replaces the Google Apps Script implementation with a modern, scalable TypeScript application.

## Features

- ✅ **Stock Search**: Exact match and fuzzy search for inventory items
- ✅ **User Management**: Registration, permissions, role-based access
- ✅ **LINE Bot Integration**: Webhook handling, flex messages, quick replies
- ✅ **Cache Layer**: In-memory caching for performance
- ✅ **LOT Parsing**: Automatic parsing of LOT numbers (week/year format)
- ✅ **Supabase Database**: PostgreSQL database with RLS policies

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.x
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Messaging**: LINE Messaging API

## Project Structure

```
ts/
├── config/               # Configuration files
│   ├── supabase.config.ts
│   └── line.config.ts
├── controllers/          # Request handlers
│   ├── stock.controller.ts
│   ├── user.controller.ts
│   └── webhook.controller.ts
├── services/             # Business logic
│   ├── cache.service.ts
│   ├── line.service.ts
│   └── supabase.service.ts
├── templates/            # Message templates
│   ├── flex.templates.ts
│   └── reply.templates.ts
├── types/                # TypeScript definitions
│   ├── line-events.ts
│   ├── database.ts
│   └── index.ts
├── utils/                # Helper functions
│   ├── formatters.ts
│   ├── lot-parser.ts
│   └── string-matcher.ts
├── index.ts              # Entry point
├── package.json
└── tsconfig.json
```

## Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your values
# - SUPABASE_SERVICE_ROLE_KEY
# - LINE_CHANNEL_TOKEN
```

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## API Endpoints

### POST /webhook
LINE webhook endpoint for receiving bot events.

### GET /health
Health check endpoint.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |
| `LINE_CHANNEL_TOKEN` | LINE channel access token | Yes |
| `PORT` | Server port (default: 3000) | No |

## Database Tables

The following tables should be created in Supabase:

- `botdata` - Stock inventory data (7 columns)
- `inventdata` - Simplified inventory (2 columns)
- `userdata` - User profiles and registration data
- `system_settings` - Bot configuration
- `reply_templates` - Auto-reply templates

See the import plan for migration details.

## Migration from Google Apps Script

This TypeScript implementation replaces the following Google Apps Script files:

- `checkstock.js` → `controllers/stock.controller.ts`
- `code.js` → `controllers/user.controller.ts` + `controllers/webhook.controller.ts`
- `flex.js` → `templates/flex.templates.ts`
- `reply.js` → `templates/reply.templates.ts`
- `push.js` → `services/line.service.ts`
- `menu.js` → Database-based settings

## License

MIT
