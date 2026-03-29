// JETSETGO Shared Configuration
// FREE/OPEN SOURCE Edition - $0 Monthly Cost

export const config = {
  // Supabase Configuration
  supabase: {
    url: 'https://icgtllieipahixesllux.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljZ3RsbGllaXBhaGl4ZXNzbHV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MTczNjEsImV4cCI6MjA4NjI5MzM2MX0._9U_u91RaJ3B6k5iPxI0AKUL8DZ8m5zmpi9hJQAyX1U',
    // Service role key should be set via environment variable for security
    serviceRoleKey: typeof Deno !== 'undefined'
      ? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
      : import.meta.env?.VITE_SUPABASE_SERVICE_ROLE_KEY || '',
  },

  // Groq FREE API Configuration
  groq: {
    apiKey: typeof Deno !== 'undefined'
      ? Deno.env.get('GROQ_API_KEY') || ''
      : import.meta.env?.VITE_GROQ_API_KEY || '',
    apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.1-8b-instant', // Fast, free model
  },

  // Ollama Local Configuration (Alternative FREE option)
  ollama: {
    apiUrl: 'http://localhost:11434/api/generate',
    model: 'llama3.1',
  },

  // Hugging Face FREE API Configuration (for embeddings)
  huggingFace: {
    apiKey: typeof Deno !== 'undefined'
      ? Deno.env.get('HUGGINGFACE_API_KEY') || ''
      : import.meta.env?.VITE_HUGGINGFACE_API_KEY || '',
    apiUrl: 'https://api-inference.huggingface.co/models/KoonJamesZ/nina-thai-v3',
  },

  // LINE Messaging API Configuration
  line: {
    channelAccessToken: typeof Deno !== 'undefined'
      ? Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') || ''
      : import.meta.env?.VITE_LINE_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: typeof Deno !== 'undefined'
      ? Deno.env.get('LINE_CHANNEL_SECRET') || ''
      : import.meta.env?.VITE_LINE_CHANNEL_SECRET || '',
    webhookUrl: '/functions/v1/jetsetgo-line-webhook',
  },

  // Embedding Configuration (768 dimensions for nina-thai-v3)
  embeddings: {
    dimension: 768,
    model: 'KoonJamesZ/nina-thai-v3',
    maxTokens: 512,
  },

  // OCR Configuration (Tesseract.js)
  ocr: {
    languages: ['tha', 'eng'],
    oem: 3, // Default OCR engine mode
    psm: 6, // Assume uniform block of text
  },

  // Search Configuration
  search: {
    maxResults: 10,
    similarityThreshold: 0.7,
    hnswM: 16,
    hnswEfConstruction: 64,
  },

  // Ingestion Configuration
  ingestion: {
    maxFileSize: 50 * 1024 * 1024, // 50MB (Supabase free tier limit)
    chunkSize: 100,
    supportedFormats: ['pdf', 'xlsx', 'xls', 'csv', 'jpg', 'jpeg', 'png'],
  },

  // Storage Buckets
  storage: {
    catalogs: 'jetsetgo-catalogs',
    ocrImages: 'jetsetgo-ocr-images',
    productImages: 'jetsetgo-product-images',
  },
};

// Environment variable validation helper
export function validateConfig(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  // Required for production
  if (!config.supabase.serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!config.groq.apiKey) missing.push('GROQ_API_KEY');
  if (!config.line.channelAccessToken) missing.push('LINE_CHANNEL_ACCESS_TOKEN');
  if (!config.line.channelSecret) missing.push('LINE_CHANNEL_SECRET');

  return {
    valid: missing.length === 0,
    missing,
  };
}

// Export for Deno Edge Functions
export { config as default };
