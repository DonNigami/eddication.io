/**
 * JETSETGO - LINE Webhook Edge Function
 * Handles LINE Messaging API webhooks for chatbot interface
 *
 * Features:
 * - Thai intent detection
 * - Part/tire search via RAG
 * - Flex Message responses
 * - Session management
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ==================== CONFIGURATION ====================
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const LINE_CHANNEL_ACCESS_TOKEN = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')!;
const LINE_CHANNEL_SECRET = Deno.env.get('LINE_CHANNEL_SECRET')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== TYPES ====================
interface LINEEvent {
  type: string;
  replyToken: string;
  source: {
    userId: string;
    groupId?: string;
    roomId?: string;
  };
  message?: {
    id: string;
    type: string;
    text: string;
  };
  postback?: {
    data: string;
  };
}

interface LINEWebhookRequest {
  destination: string;
  events: LINEEvent[];
}

interface FlexMessage {
  type: 'flex';
  altText: string;
  contents: any;
}

// ==================== INTENT DETECTION ====================
interface Intent {
  type: 'search' | 'stock' | 'price' | 'compatibility' | 'help' | 'greeting';
  catalogType: 'parts' | 'tires' | 'all';
  query: string;
}

function detectIntent(text: string): Intent {
  const normalized = text.toLowerCase().trim();

  // Greetings
  if (/^(สวัสดี| hello | hi | หวัดดี| ดีจ้า)/.test(normalized)) {
    return { type: 'greeting', catalogType: 'all', query: '' };
  }

  // Help
  if (/(help| ช่วยเหลือ| วิธีใช้| ใช้ยังไง)/.test(normalized)) {
    return { type: 'help', catalogType: 'all', query: '' };
  }

  // Stock check
  if (/(มีสินค้าไหม| สต็อก| stock | มีของไหม| เหลือไหม)/.test(normalized)) {
    return {
      type: 'stock',
      catalogType: /ยาง|tire/i.test(normalized) ? 'tires' : 'parts',
      query: normalized.replace(/(มีสินค้าไหม| สต็อก| stock | มีของไหม| เหลือไหม)/gi, '').trim(),
    };
  }

  // Price inquiry
  if (/(ราคาเท่าไหร่| ราคา| price | ราคายังไง| กี่บาท)/.test(normalized)) {
    return {
      type: 'price',
      catalogType: /ยาง|tire/i.test(normalized) ? 'tires' : 'parts',
      query: normalized.replace(/(ราคาเท่าไหร่| ราคา| price | ราคายังไง| กี่บาท)/gi, '').trim(),
    };
  }

  // Compatibility check
  if (/(ใส่.*ได้ไหม| ใส่.*ได้บ้าง| fit | compatible | รองรับ)/.test(normalized)) {
    return {
      type: 'compatibility',
      catalogType: 'parts',
      query: normalized,
    };
  }

  // Tire search
  if (/ยาง|tire| ล้อ/.test(normalized)) {
    return {
      type: 'search',
      catalogType: 'tires',
      query: normalized.replace(/(ยาง|tire| ล้อ)/gi, '').trim(),
    };
  }

  // Default: search
  return {
    type: 'search',
    catalogType: 'parts',
    query: normalized,
  };
}

// ==================== SEARCH RAG ====================
async function searchRAG(query: string, catalogType: 'parts' | 'tires', userId: string): Promise<{
  results: any[];
  response: string;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('jetsetgo-rag-query', {
      body: {
        query,
        catalogType,
        maxResults: 5,
        userId,
      },
    });

    if (error) throw error;

    return {
      results: data.results || [],
      response: data.response || '',
    };
  } catch (error) {
    console.error('RAG search error:', error);
    return {
      results: [],
      response: 'ขอโทษครับ ระบบขัดข้อง ลองใหม่อีกครั้งนะครับ',
    };
  }
}

// ==================== CREATE FLEX MESSAGE ====================
function createSearchFlexMessage(results: any[], response: string): FlexMessage {
  if (results.length === 0) {
    return {
      type: 'flex',
      altText: 'ไม่พบผลการค้นหา',
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '😕 ไม่พบสินค้า',
              weight: 'bold',
              size: 'xl',
              margin: 'md',
            },
            {
              type: 'text',
              text: response || 'ลองค้นหาด้วยชื่ออะไหล่ ยี่ห้อรถ หรือ Part Number ครับ',
              wrap: true,
              margin: 'md',
            },
          ],
        },
      },
    };
  }

  // Build result cards
  const cards = results.slice(0, 3).map((result) => ({
    type: 'bubble',
    hero: result.imageUrl ? {
      type: 'image',
      url: result.imageUrl,
      size: 'full',
      aspectRatio: '20:13',
      aspectMode: 'cover',
    } : undefined,
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: result.partNumber || result.brand || 'สินค้า',
          weight: 'bold',
          size: 'lg',
        },
        {
          type: 'text',
          text: result.nameTh || result.nameEn || result.model || '',
          wrap: true,
          margin: 'md',
        },
        result.price ? {
          type: 'text',
          text: `฿${result.price.toLocaleString()}`,
          weight: 'bold',
          color: '#EF4444',
          margin: 'md',
        } : undefined,
        {
          type: 'box',
          layout: 'baseline',
          margin: 'md',
          contents: [
            {
              type: 'text',
              text: result.stock && result.stock > 0 ? '✅ มีสินค้า' : '❌ หมด',
              color: result.stock && result.stock > 0 ? '#00C853' : '#FF1744',
              size: 'sm',
            },
          ],
        },
      ].filter(Boolean),
    },
  }));

  return {
    type: 'flex',
    altText: `พบ ${results.length} รายการ`,
    contents: {
      type: 'carousel',
      contents: cards,
    },
  };
}

// ==================== CREATE GREETING MESSAGE ====================
function createGreetingMessage(): FlexMessage {
  return {
    type: 'flex',
    altText: 'ยินดีต้อนรับสู่ JETSETGO',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '🚗 JETSETGO',
            weight: 'bold',
            color: '#FFFFFF',
            size: 'xl',
          },
          {
            type: 'text',
            text: 'ระบบค้นหาอะไหล่รถยนต์',
            color: '#FFFFFF',
            size: 'sm',
          },
        ],
        backgroundColor: '#3B82F6',
        paddingAll: '20px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'สวัสดีครับ! ยินดีต้อนรับ',
            margin: 'md',
          },
          {
            type: 'text',
            text: 'ผมช่วยคุณค้นหาอะไหล่รถยนต์และยางรถยนต์ได้ครับ',
            wrap: true,
            margin: 'md',
          },
          {
            type: 'text',
            text: '🔍 ลองพิมพ์คำถาม เช่น:',
            weight: 'bold',
            margin: 'lg',
          },
          {
            type: 'text',
            text: '• "ผ้าเบรก Toyota Camry"',
            margin: 'sm',
            size: 'sm',
          },
          {
            type: 'text',
            text: '• "ยาง 205/55R16"',
            margin: 'sm',
            size: 'sm',
          },
          {
            type: 'text',
            text: '• "ราคา กรองอากาศ"',
            margin: 'sm',
            size: 'sm',
          },
        ],
      },
    },
  };
}

// ==================== CREATE HELP MESSAGE ====================
function createHelpMessage(): FlexMessage {
  return {
    type: 'flex',
    altText: 'วิธีใช้งาน',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '📖 วิธีใช้งาน JETSETGO',
            weight: 'bold',
            size: 'xl',
            margin: 'md',
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            spacing: 'sm',
            contents: [
              {
                type: 'text',
                text: '🔍 ค้นหาอะไหล่',
                weight: 'bold',
              },
              {
                type: 'text',
                text: 'พิมพ์ชื่ออะไหล่ ยี่ห้อรถ หรือ Part Number',
                size: 'sm',
                wrap: true,
              },
              {
                type: 'text',
                text: '',
              },
              {
                type: 'text',
                text: '🔎 ค้นหายาง',
                weight: 'bold',
              },
              {
                type: 'text',
                text: 'พิมพ์ขนาดยาง เช่น "205/55R16" หรือ "ยาง 16"',
                size: 'sm',
                wrap: true,
              },
              {
                type: 'text',
                text: '',
              },
              {
                type: 'text',
                text: '💰 ถามราคา',
                weight: 'bold',
              },
              {
                type: 'text',
                text: 'พิมพ์ "ราคา [ชื่อสินค้า]"',
                size: 'sm',
                wrap: true,
              },
              {
                type: 'text',
                text: '',
              },
              {
                type: 'text',
                text: '📦 เช็คสต็อก',
                weight: 'bold',
              },
              {
                type: 'text',
                text: 'พิมพ์ "มีสินค้าไหม" หรือ "สต็อก [ชื่อสินค้า]"',
                size: 'sm',
                wrap: true,
              },
            ],
          },
        ],
      },
    },
  };
}

// ==================== SEND REPLY ====================
async function sendReply(replyToken: string, messages: any[]): Promise<void> {
  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LINE API error: ${response.status} - ${errorText}`);
  }
}

// ==================== SAVE USER SESSION ====================
async function saveSession(userId: string, intent: Intent, response: string): Promise<void> {
  try {
    await supabase.from('line_sessions').upsert({
      user_id: userId,
      last_intent: intent.type,
      last_query: intent.query,
      last_response: response,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to save session:', error);
  }
}

// ==================== VERIFY LINE SIGNATURE ====================
function verifySignature(body: string, signature: string): boolean {
  if (!LINE_CHANNEL_SECRET) return false;

  const cryptoProvider = require('crypto');
  const hash = cryptoProvider
    .createHmac('sha256', LINE_CHANNEL_SECRET)
    .update(body)
    .digest('base64');

  return hash === signature;
}

// ==================== HTTP HANDLER ====================
serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.text();
    const signature = req.headers.get('x-line-signature');

    // Verify signature (optional in development)
    if (LINE_CHANNEL_SECRET && !verifySignature(body, signature || '')) {
      return new Response('Invalid signature', { status: 401, headers: corsHeaders });
    }

    const data: LINEWebhookRequest = JSON.parse(body);

    if (!data.events || data.events.length === 0) {
      return new Response('OK', { headers: corsHeaders });
    }

    // Process each event
    for (const event of data.events) {
      if (event.type !== 'message' || event.message?.type !== 'text') {
        continue;
      }

      const { replyToken, source, message } = event;
      const userId = source.userId;
      const userText = message.text;

      // Detect intent
      const intent = detectIntent(userText);

      let replyMessages: any[] = [];

      switch (intent.type) {
        case 'greeting':
          replyMessages = [createGreetingMessage()];
          break;

        case 'help':
          replyMessages = [createHelpMessage()];
          break;

        case 'search':
        case 'stock':
        case 'price':
        case 'compatibility': {
          const { results, response } = await searchRAG(intent.query, intent.catalogType, userId);

          replyMessages = [
            {
              type: 'text',
              text: response,
            },
            createSearchFlexMessage(results, response),
          ];

          await saveSession(userId, intent, response);
          break;
        }

        default:
          replyMessages = [
            {
              type: 'text',
              text: 'ผมไม่เข้าใจครับ ลองถามเรื่องอะไหล่รถยนต์หรือยางรถยนต์ได้เลยครับ',
            },
          ];
      }

      // Send reply
      await sendReply(replyToken, replyMessages);
    }

    return new Response('OK', { headers: corsHeaders });

  } catch (error) {
    console.error('Webhook error:', error);

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
