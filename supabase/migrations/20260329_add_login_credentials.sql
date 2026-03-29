-- ============================================
-- Add Login Credentials to userdata Table
-- ============================================

-- Add username column (nullable, for backward compatibility)
ALTER TABLE public.userdata
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Add password column (nullable, will store hashed passwords)
ALTER TABLE public.userdata
ADD COLUMN IF NOT EXISTS password TEXT;

-- Add index for username lookup
CREATE INDEX IF NOT EXISTS idx_userdata_username
ON public.userdata USING btree (username);

-- Add comments for documentation
COMMENT ON COLUMN public.userdata.username IS 'Username for login (can be same as user_id)';
COMMENT ON COLUMN public.userdata.password IS 'Hashed password for login (use bcrypt/argon2)';
