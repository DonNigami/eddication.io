#!/usr/bin/env bash
# Apply Boonyang Inventory Updates
# Run this script to apply necessary database changes

echo "🚀 Applying Boonyang Inventory Database Updates"
echo "================================================"

PROJECT_REF="cbxicbynxnprscwqnyld"

# Check if SUPABASE_ACCESS_TOKEN is set
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo "❌ SUPABASE_ACCESS_TOKEN not set"
  echo "Please get your access token from: https://supabase.com/dashboard/project/$PROJECT_REF/settings/api"
  exit 1
fi

echo "✅ Token found"

# Function to execute SQL via Supabase API
execute_sql() {
  local sql="$1"
  local description="$2"

  echo "📝 $description..."

  response=$(curl -s -X POST \
    "https://supabase.com/dashboard/proj/$PROJECT_REF/sql" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"query\":\"$sql\"}")

  if echo "$response" | grep -q "error"; then
    echo "❌ Error: $response"
    return 1
  else
    echo "✅ Success"
    return 0
  fi
}

# SQL 1: Add status column
execute_sql "
ALTER TABLE public.userdata
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

ALTER TABLE public.userdata
DROP CONSTRAINT IF EXISTS userdata_status_check;

ALTER TABLE public.userdata
ADD CONSTRAINT userdata_status_check
CHECK (status IN ('pending', 'active', 'suspended'));

CREATE INDEX IF NOT EXISTS idx_userdata_status
ON public.userdata USING btree (status);
" "Add status column to userdata"

# SQL 2: Create cache_metadata table
execute_sql "
CREATE TABLE IF NOT EXISTS public.cache_metadata (
  key TEXT PRIMARY KEY,
  data_type TEXT NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  ttl_seconds INTEGER DEFAULT 1800,
  item_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_cache_metadata_data_type
ON public.cache_metadata USING btree (data_type);

CREATE INDEX IF NOT EXISTS idx_cache_metadata_last_updated
ON public.cache_metadata USING btree (last_updated);
" "Create cache_metadata table"

# SQL 3: Add GIN index for fuzzy search
execute_sql "
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DROP INDEX IF EXISTS public.idx_inventdata_item_name_gin;
CREATE INDEX idx_inventdata_item_name_gin
ON public.inventdata USING gin(item_name gin_trgm_ops);
" "Add GIN index for InventData fuzzy search"

# SQL 4: Add system settings
execute_sql "
INSERT INTO public.system_settings (key, value, description) VALUES
  ('line_channel_token', '', 'LINE Channel Access Token'),
  ('line_channel_secret', '', 'LINE Channel Secret'),
  ('line_bot_basic_id', '', 'LINE Bot Basic ID'),
  ('rich_menu_id', '', 'LINE Rich Menu ID')
ON CONFLICT (key) DO NOTHING;
" "Add system settings"

echo ""
echo "✅ All database updates applied successfully!"
echo "🎯 Next: Deploy Edge Function with:"
echo "   supabase functions deploy boonyang-webhook"
