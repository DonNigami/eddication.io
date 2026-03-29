/**
 * Supabase Configuration
 */

export const supabaseConfig = {
  url: process.env.SUPABASE_URL || 'https://cbxicbynxnprscwqnyld.supabase.co',
  anonKey: process.env.SUPABASE_ANON_KEY || 'sb_publishable_39HASmWqCZ3y9NqvGOdf8A_-I_QIPt2',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
};

export const validateSupabaseConfig = (): void => {
  if (!supabaseConfig.serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY environment variable is required. ' +
      'Set it in .env file or deployment environment.'
    );
  }
};
