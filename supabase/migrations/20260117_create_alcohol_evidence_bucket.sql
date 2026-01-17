-- =====================================================
-- Storage Bucket Migration: alcohol-checks -> alcohol-evidence
-- Align with app/PLAN.md specification
-- =====================================================
-- Run this in Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/myplpshpcordggbbtblg/sql/new
-- =====================================================

-- Step 1: Create new storage bucket 'alcohol-evidence'
-- Note: This must be done via Supabase Dashboard Storage UI if SQL fails
-- =====================================================

-- Insert bucket (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'alcohol-evidence',
  'alcohol-evidence',
  true,  -- public access
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Create storage policies for alcohol-evidence bucket
-- =====================================================

-- Allow public read access
CREATE POLICY IF NOT EXISTS "Public read access for alcohol-evidence"
ON storage.objects FOR SELECT
USING (bucket_id = 'alcohol-evidence');

-- Allow anonymous/authenticated uploads
CREATE POLICY IF NOT EXISTS "Allow uploads to alcohol-evidence"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'alcohol-evidence');

-- Step 3: Copy existing files from alcohol-checks to alcohol-evidence (optional)
-- =====================================================
-- Note: This step must be done manually via:
-- 1. Supabase Dashboard -> Storage -> alcohol-checks
-- 2. Download all files
-- 3. Upload to alcohol-evidence bucket
-- Or use Supabase CLI: supabase storage cp -r alcohol-checks alcohol-evidence

-- Step 4: Update existing records to use new bucket URL
-- =====================================================
-- Note: Run this AFTER copying files to new bucket

-- UPDATE alcohol_checks
-- SET image_url = REPLACE(image_url, 'alcohol-checks', 'alcohol-evidence')
-- WHERE image_url LIKE '%alcohol-checks%';

-- =====================================================
-- Migration Notes:
-- =====================================================
-- After running this migration:
-- 1. Verify bucket was created in Dashboard -> Storage
-- 2. Copy existing images from alcohol-checks to alcohol-evidence
-- 3. Uncomment and run the UPDATE statement above
-- 4. Test image uploads work with new bucket
-- 5. (Optional) Delete old alcohol-checks bucket after verification
-- =====================================================

SELECT 'Storage bucket migration prepared. Check Dashboard to complete.' as status;
