/**
 * ClinicConnect SaaS - Environment Variable Loader
 *
 * Centralized environment variable management with validation
 */

interface EnvConfig {
  // Supabase
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey?: string;

  // LINE
  lineLiffId: string;
  lineChannelId: string;
  lineChannelSecret: string;
  lineChannelAccessToken: string;

  // App
  apiUrl: string;
  environment: 'development' | 'staging' | 'production';
}

interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  config?: EnvConfig;
}

/**
 * Get environment variable from various sources
 * Handles both Vite (import.meta.env) and Next.js (process.env)
 */
function getEnv(key: string): string | undefined {
  // Vite/LIFF apps
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const viteKey = key.startsWith('VITE_') ? key : `VITE_${key}`;
    if (import.meta.env[viteKey]) return import.meta.env[viteKey];
  }

  // Next.js/Node.js
  if (typeof process !== 'undefined' && process.env) {
    if (process.env[key]) return process.env[key];
  }

  return undefined;
}

/**
 * Validate required environment variables
 */
export function validateEnv(requiredVars: string[]): EnvValidationResult {
  const errors: string[] = [];
  const config: Partial<EnvConfig> = {};

  // Helper to get and validate
  const getRequired = (key: string, displayName: string): string => {
    const value = getEnv(key);
    if (!value) {
      errors.push(`Missing required environment variable: ${displayName} (${key})`);
    }
    return value || '';
  };

  const getOptional = (key: string): string | undefined => {
    return getEnv(key);
  };

  // Supabase
  config.supabaseUrl = getRequired('SUPABASE_URL', 'Supabase URL');
  config.supabaseAnonKey = getRequired('SUPABASE_ANON_KEY', 'Supabase Anon Key');
  config.supabaseServiceRoleKey = getOptional('SUPABASE_SERVICE_ROLE_KEY');

  // LINE
  config.lineLiffId = getRequired('LINE_LIFF_ID', 'LINE LIFF ID');
  config.lineChannelId = getRequired('LINE_CHANNEL_ID', 'LINE Channel ID');
  config.lineChannelSecret = getRequired('LINE_CHANNEL_SECRET', 'LINE Channel Secret');
  config.lineChannelAccessToken = getRequired('LINE_CHANNEL_ACCESS_TOKEN', 'LINE Channel Access Token');

  // App
  config.apiUrl = getRequired('API_BASE_URL', 'API Base URL');
  config.environment = (getEnv('NODE_ENV') || getEnv('MODE') || 'development') as any;

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], config: config as EnvConfig };
}

/**
 * Load environment configuration with defaults
 */
export function loadEnv(): EnvConfig {
  const supabaseUrl = getEnv('SUPABASE_URL') || '';
  const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY') || '';

  const lineLiffId = getEnv('LINE_LIFF_ID') || '';
  const lineChannelId = getEnv('LINE_CHANNEL_ID') || '';
  const lineChannelSecret = getEnv('LINE_CHANNEL_SECRET') || '';
  const lineChannelAccessToken = getEnv('LINE_CHANNEL_ACCESS_TOKEN') || '';

  const apiUrl = getEnv('API_BASE_URL') || '/api';
  const environment = (getEnv('NODE_ENV') || getEnv('MODE') || 'development') as 'development' | 'staging' | 'production';

  return {
    supabaseUrl,
    supabaseAnonKey,
    lineLiffId,
    lineChannelId,
    lineChannelSecret,
    lineChannelAccessToken,
    apiUrl,
    environment,
  };
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  const env = getEnv('NODE_ENV') || getEnv('MODE') || 'development';
  return env === 'development';
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  const env = getEnv('NODE_ENV') || getEnv('MODE') || 'development';
  return env === 'production';
}

/**
 * Get API base URL
 */
export function getApiBaseUrl(): string {
  return getEnv('API_BASE_URL') || '/api';
}

/**
 * Get Supabase configuration
 */
export function getSupabaseConfig() {
  return {
    url: getEnv('SUPABASE_URL') || '',
    anonKey: getEnv('SUPABASE_ANON_KEY') || '',
    serviceRoleKey: getEnv('SUPABASE_SERVICE_ROLE_KEY'),
  };
}

/**
 * Get LINE configuration
 */
export function getLineConfig() {
  return {
    liffId: getEnv('LINE_LIFF_ID') || '',
    channelId: getEnv('LINE_CHANNEL_ID') || '',
    channelSecret: getEnv('LINE_CHANNEL_SECRET') || '',
    channelAccessToken: getEnv('LINE_CHANNEL_ACCESS_TOKEN') || '',
  };
}

/**
 * Log environment status (for debugging)
 */
export function logEnvStatus(): void {
  if (!isDevelopment()) return;

  console.group('🔧 Environment Status');
  console.log('Environment:', getEnv('NODE_ENV') || getEnv('MODE') || 'unknown');
  console.log('Supabase URL:', getEnv('SUPABASE_URL') ? '✓ Configured' : '✗ Missing');
  console.log('Supabase Anon Key:', getEnv('SUPABASE_ANON_KEY') ? '✓ Configured' : '✗ Missing');
  console.log('LINE LIFF ID:', getEnv('LINE_LIFF_ID') ? '✓ Configured' : '✗ Missing');
  console.log('LINE Channel ID:', getEnv('LINE_CHANNEL_ID') ? '✓ Configured' : '✗ Missing');
  console.groupEnd();
}

/**
 * Validate and throw error if critical env vars are missing
 */
export function ensureEnv(): EnvConfig {
  const result = validateEnv([
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'LINE_LIFF_ID',
    'LINE_CHANNEL_ID',
  ]);

  if (!result.valid) {
    throw new Error(
      `Missing required environment variables:\n${result.errors.join('\n')}`
    );
  }

  return result.config!;
}

// Export a default config object
export const env = loadEnv();

export default {
  loadEnv,
  validateEnv,
  isDevelopment,
  isProduction,
  getApiBaseUrl,
  getSupabaseConfig,
  getLineConfig,
  logEnvStatus,
  ensureEnv,
  env,
};
