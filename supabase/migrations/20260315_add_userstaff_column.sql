-- ============================================
-- Add userstaff column to userdata table
-- ============================================

-- Add userstaff column
ALTER TABLE public.userdata
ADD COLUMN IF NOT EXISTS userstaff text null;

-- Add comment
COMMENT ON COLUMN public.userdata.userstaff IS 'User staff information from Google Sheets';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_userdata_userstaff
ON public.userdata USING btree (userstaff);

-- Verify column exists
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'userdata'
  AND column_name = 'userstaff';
