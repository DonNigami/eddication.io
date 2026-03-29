/**
 * Environment Configuration for DriverConnect
 *
 * This file provides centralized access to all environment variables
 * with validation and fallback values.
 *
 * Security Rules:
 * - Client-side: Only use VITE_ prefixed variables
 * - Server-side: Can use all variables
 * - NEVER commit .env.local to git
 */

// ============================================
// Type Definitions (JSDoc)
// ============================================

/**
 * @typedef {Object} SupabaseConfig
 * @property {string} url - Supabase project URL
 * @property {string} anonKey - Public anon key (client-side)
 * @property {string} serviceRoleKey - Service role key (server-only)
 * @property {string} secretKey - Custom secret key
 * @property {string} publishableKey - Custom publishable key
 */

/**
 * @typedef {Object} LineConfig
 * @property {string} liffId - LINE LIFF App ID
 * @property {string} channelAccessToken - Messaging API token
 * @property {string} channelSecret - Channel secret
 * @property {string} loginChannelId - LINE Login channel ID
 */

/**
 * @typedef {Object} GoogleConfig
 * @property {string} mapsApiKey - Google Maps JavaScript API key
 */

/**
 * @typedef {Object} AppConfig
 * @property {boolean} devMode - Development mode flag
 * @property {string} apiBaseUrl - API base URL
 * @property {string} nominatimApiUrl - Nominatim OSM endpoint
 */

// ============================================
// Environment Variable Helpers
// ============================================

/**
 * Get a Vite environment variable (client-side)
 * @param {string} key - Environment variable name
 * @param {string} defaultValue - Fallback value
 * @returns {string}
 */
const getViteEnv = (key, defaultValue = '') => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || defaultValue
  }
  // Fallback for non-Vite environments
  return process.env?.[key] || defaultValue
}

/**
 * Get a server-side environment variable
 * @param {string} key - Environment variable name
 * @param {string} defaultValue - Fallback value
 * @returns {string}
 */
const getServerEnv = (key, defaultValue = '') => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || defaultValue
  }
  return defaultValue
}

/**
 * Validate required environment variables
 * @param {Object} config - Configuration object to validate
 * @param {string[]} requiredKeys - Required keys
 * @throws {Error} If required keys are missing
 */
const validateConfig = (config, requiredKeys = []) => {
  const missing = requiredKeys.filter(key => !config[key])
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env.local file. See ENV_SETUP.md for instructions.'
    )
  }
}

// ============================================
// Supabase Configuration
// ============================================

/**
 * Get Supabase configuration (client-side)
 * @returns {SupabaseConfig}
 */
export const getSupabaseConfig = () => {
  const config = {
    url: getViteEnv('VITE_SUPABASE_URL', ''),
    anonKey: getViteEnv('VITE_SUPABASE_ANON_KEY', ''),
    serviceRoleKey: getViteEnv('SUPABASE_SERVICE_ROLE_KEY', ''), // Server-only
    secretKey: getViteEnv('SUPABASE_SECRET_KEY', ''),
    publishableKey: getViteEnv('SUPABASE_PUBLISHABLE_KEY', '')
  }

  // Client-side validation
  validateConfig(config, ['url', 'anonKey'])

  return config
}

/**
 * Get Supabase configuration (server-side)
 * @returns {SupabaseConfig}
 */
export const getSupabaseServerConfig = () => {
  const config = {
    url: getServerEnv('VITE_SUPABASE_URL', ''),
    anonKey: getServerEnv('VITE_SUPABASE_ANON_KEY', ''),
    serviceRoleKey: getServerEnv('SUPABASE_SERVICE_ROLE_KEY', ''),
    secretKey: getServerEnv('SUPABASE_SECRET_KEY', ''),
    publishableKey: getServerEnv('SUPABASE_PUBLISHABLE_KEY', '')
  }

  // Server-side validation
  validateConfig(config, ['url', 'serviceRoleKey'])

  return config
}

// ============================================
// LINE Platform Configuration
// ============================================

/**
 * Get LINE Platform configuration
 * @returns {LineConfig}
 */
export const getLineConfig = () => {
  const config = {
    liffId: getViteEnv('VITE_LIFF_ID', ''),
    channelAccessToken: getServerEnv('LINE_CHANNEL_ACCESS_TOKEN', ''),
    channelSecret: getServerEnv('LINE_CHANNEL_SECRET', ''),
    loginChannelId: getViteEnv('VITE_LINE_LOGIN_CHANNEL_ID', '')
  }

  // Client-side validation
  if (typeof window !== 'undefined') {
    validateConfig(config, ['liffId'])
  }

  return config
}

// ============================================
// Google Maps Configuration
// ============================================

/**
 * Get Google Maps configuration
 * @returns {GoogleConfig}
 */
export const getGoogleConfig = () => {
  const config = {
    mapsApiKey: getViteEnv('VITE_GOOGLE_MAPS_API_KEY', '')
  }

  return config
}

// ============================================
// Application Configuration
// ============================================

/**
 * Get application configuration
 * @returns {AppConfig}
 */
export const getAppConfig = () => {
  const config = {
    devMode: getViteEnv('VITE_DEV_MODE', 'false') === 'true',
    apiBaseUrl: getViteEnv('VITE_API_BASE_URL', 'http://localhost:3000'),
    nominatimApiUrl: getViteEnv('NOMINATIM_API_URL', 'https://nominatim.openstreetmap.org')
  }

  return config
}

// ============================================
// Combined Configuration
// ============================================

/**
 * Get all configuration (client-side)
 * @returns {Object}
 */
export const getConfig = () => {
  return {
    supabase: getSupabaseConfig(),
    line: getLineConfig(),
    google: getGoogleConfig(),
    app: getAppConfig()
  }
}

/**
 * Get all configuration (server-side)
 * @returns {Object}
 */
export const getServerConfig = () => {
  return {
    supabase: getSupabaseServerConfig(),
    line: getLineConfig(),
    google: getGoogleConfig(),
    app: getAppConfig()
  }
}

// ============================================
// Debug Helper
// ============================================

/**
 * Log configuration status (for debugging)
 * @param {boolean} showValues - Whether to show actual values (⚠️ SECURITY RISK)
 */
export const debugConfig = (showValues = false) => {
  const config = getConfig()

  console.group('🔧 Environment Configuration Status')

  // Supabase
  console.group('Supabase')
  console.log('URL:', config.supabase.url ? '✅ Set' : '❌ Missing')
  console.log('Anon Key:', config.supabase.anonKey ? '✅ Set' : '❌ Missing')
  console.log('Service Role:', config.supabase.serviceRoleKey ? '✅ Set' : '❌ Missing')
  if (showValues) {
    console.log('Actual URL:', config.supabase.url)
    console.log('Actual Anon:', config.supabase.anonKey.substring(0, 20) + '...')
  }
  console.groupEnd()

  // LINE
  console.group('LINE Platform')
  console.log('LIFF ID:', config.line.liffId ? '✅ Set' : '❌ Missing')
  console.log('Channel Access Token:', config.line.channelAccessToken ? '✅ Set' : '❌ Missing')
  console.groupEnd()

  // Google
  console.group('Google Maps')
  console.log('API Key:', config.google.mapsApiKey ? '✅ Set' : '❌ Missing')
  console.groupEnd()

  // App
  console.group('Application')
  console.log('Dev Mode:', config.app.devMode)
  console.log('API Base URL:', config.app.apiBaseUrl)
  console.groupEnd()

  console.groupEnd()
}

// Export default
export default {
  getSupabaseConfig,
  getSupabaseServerConfig,
  getLineConfig,
  getGoogleConfig,
  getAppConfig,
  getConfig,
  getServerConfig,
  debugConfig
}
