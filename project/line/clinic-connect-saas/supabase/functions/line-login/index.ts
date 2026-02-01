// =====================================================
// SUPABASE EDGE FUNCTION - LINE LOGIN
// Handle LINE Login callback and user session
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// =====================================================
// CONFIG & TYPES
// =====================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LINE_CHANNEL_ID = Deno.env.get('LINE_CHANNEL_ID')!;
const LINE_CHANNEL_SECRET = Deno.env.get('LINE_CHANNEL_SECRET')!;
const LINE_LOGIN_REDIRECT_URI = Deno.env.get('LINE_LOGIN_REDIRECT_URI')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface LINETokenResponse {
  access_token: string;
  expires_in: number;
  id_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
}

interface LINEProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  email?: string;
}

interface DecodedIDToken {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  name?: string;
  email?: string;
  picture?: string;
}

// =====================================================
// CRYPTO UTILITIES
// =====================================================

// Base64 URL decode
function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return atob(str);
}

// Parse JWT without verification (already verified by LINE)
function parseJWT(token: string): DecodedIDToken {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const payload = parts[1];
  const decoded = base64UrlDecode(payload);
  return JSON.parse(decoded);
}

// =====================================================
// LINE API HELPERS
// =====================================================

async function getAccessToken(code: string, state?: string): Promise<LINETokenResponse | null> {
  const response = await fetch('https://api.line.me/oauth2/v2.1/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: LINE_LOGIN_REDIRECT_URI,
      client_id: LINE_CHANNEL_ID,
      client_secret: LINE_CHANNEL_SECRET,
      state: state || '',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('LINE Token error:', error);
    return null;
  }

  return await response.json();
}

async function getLINEProfile(accessToken: string): Promise<LINEProfile | null> {
  const response = await fetch('https://api.line.me/v2/profile', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('LINE Profile error:', error);
    return null;
  }

  return await response.json();
}

async function verifyIDToken(idToken: string, nonce?: string): Promise<DecodedIDToken | null> {
  const response = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      id_token: idToken,
      client_id: LINE_CHANNEL_ID,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('LINE ID Token verification error:', error);
    return null;
  }

  return await response.json();
}

// =====================================================
// SUPABASE AUTH HELPERS
// =====================================================

async function findOrCreateUser(lineProfile: LINEProfile, email?: string) {
  // Check if user exists by line_user_id
  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('line_user_id', lineProfile.userId)
    .single();

  if (existingUser) {
    // Update user info
    const { data } = await supabase
      .from('users')
      .update({
        display_name: lineProfile.displayName,
        picture_url: lineProfile.pictureUrl,
        email: email || existingUser.email,
        last_login: new Date().toISOString(),
      })
      .eq('user_id', existingUser.user_id)
      .select()
      .single();

    return { user: data, isNew: false };
  }

  // Check if user exists by email
  if (email) {
    const { data: emailUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (emailUser) {
      // Link LINE account
      const { data } = await supabase
        .from('users')
        .update({
          line_user_id: lineProfile.userId,
          display_name: lineProfile.displayName,
          picture_url: lineProfile.pictureUrl,
          last_login: new Date().toISOString(),
        })
        .eq('user_id', emailUser.user_id)
        .select()
        .single();

      return { user: data, isNew: false };
    }
  }

  // Create new user
  const { data: newUser } = await supabase
    .from('users')
    .insert({
      line_user_id: lineProfile.userId,
      display_name: lineProfile.displayName,
      picture_url: lineProfile.pictureUrl,
      email: email || null,
      role: 'patient',
      is_active: true,
      last_login: new Date().toISOString(),
    })
    .select()
    .single();

  return { user: newUser, isNew: true };
}

async function createAuthSession(user: any) {
  // Create a session using Supabase Auth
  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    user_metadata: {
      line_user_id: user.line_user_id,
      display_name: user.display_name,
      picture_url: user.picture_url,
    },
  });

  if (error) {
    // User might already exist, get existing session
    const { data: existing } = await supabase.auth.admin.getUserById(user.user_id);
    return existing;
  }

  return data;
}

// =====================================================
// HTML RESPONSES
// =====================================================

function createRedirectHTML(url: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Redirecting...</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #00B900 0%, #00C300 100%);
        }
        .container {
          text-align: center;
          color: white;
        }
        .spinner {
          border: 4px solid rgba(255,255,255,0.3);
          border-top: 4px solid white;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="spinner"></div>
        <p>กำลังล็อกอิน...</p>
      </div>
      <script>
        setTimeout(function() {
          window.location.href = '${url}';
        }, 500);
      </script>
    </body>
    </html>
  `;
}

function createErrorHTML(message: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Login Error</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
          background: #f5f5f5;
        }
        .container {
          text-align: center;
          background: white;
          padding: 40px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          max-width: 400px;
        }
        .error-icon {
          font-size: 48px;
          margin-bottom: 20px;
        }
        h1 { margin: 0 0 10px; color: #333; }
        p { color: #666; margin-bottom: 20px; }
        button {
          background: #00B900;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="error-icon">❌</div>
        <h1>เกิดข้อผิดพลาด</h1>
        <p>${message}</p>
        <button onclick="window.close()">ปิดหน้าต่าง</button>
      </div>
    </body>
    </html>
  `;
}

// =====================================================
// MAIN HANDLER
// =====================================================

serve(async (req) => {
  const url = new URL(req.url);

  // Handle callback
  if (url.pathname.endsWith('/callback')) {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    // Handle errors from LINE
    if (error) {
      return new Response(createErrorHTML(errorDescription || error), {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    if (!code) {
      return new Response(createErrorHTML('ไม่พบ authorization code'), {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Exchange code for access token
    const tokenData = await getAccessToken(code, state);

    if (!tokenData) {
      return new Response(createErrorHTML('ไม่สามารถรับ access token ได้'), {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Get user profile
    const profile = await getLINEProfile(tokenData.access_token);

    if (!profile) {
      return new Response(createErrorHTML('ไม่สามารถรับข้อมูลผู้ใช้ได้'), {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Verify ID token
    const idTokenData = await verifyIDToken(tokenData.id_token);

    // Find or create user
    const { user, isNew } = await findOrCreateUser(profile, idTokenData?.email);

    if (!user) {
      return new Response(createErrorHTML('ไม่สามารถสร้างผู้ใช้ได้'), {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Create Supabase session
    const session = await createAuthSession(user);

    // Determine redirect URL
    const redirectUrl = new URL(state || '/dashboard', url.origin);
    redirectUrl.searchParams.set('session', session?.session?.access_token || '');
    redirectUrl.searchParams.set('user_id', user.user_id);
    redirectUrl.searchParams.set('is_new', isNew.toString());

    return new Response(createRedirectHTML(redirectUrl.toString()), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Handle logout
  if (req.method === 'POST' && url.pathname.endsWith('/logout')) {
    const body = await req.json();
    const { user_id } = body;

    if (user_id) {
      await supabase
        .from('users')
        .update({ last_logout: new Date().toISOString() })
        .eq('user_id', user_id);
    }

    return Response.json({ success: true });
  }

  // Handle link LINE account
  if (req.method === 'POST' && url.pathname.endsWith('/link')) {
    const body = await req.json();
    const { user_id, line_user_id } = body;

    if (!user_id || !line_user_id) {
      return Response.json({
        success: false,
        error: { message: 'Missing user_id or line_user_id', code: 'MISSING_PARAM' },
      }, { status: 400 });
    }

    const { error } = await supabase
      .from('users')
      .update({ line_user_id })
      .eq('user_id', user_id);

    if (error) {
      return Response.json({
        success: false,
        error: { message: error.message, code: error.code },
      }, { status: 500 });
    }

    return Response.json({ success: true });
  }

  // Handle verify session
  if (req.method === 'GET' && url.pathname.endsWith('/verify')) {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return Response.json({
        success: false,
        error: { message: 'Missing token', code: 'MISSING_TOKEN' },
      }, { status: 401 });
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return Response.json({
        success: false,
        error: { message: 'Invalid token', code: 'INVALID_TOKEN' },
      }, { status: 401 });
    }

    // Get full user data
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', data.user.id)
      .single();

    return Response.json({
      success: true,
      data: userData,
    });
  }

  return new Response('Not found', { status: 404 });
});
