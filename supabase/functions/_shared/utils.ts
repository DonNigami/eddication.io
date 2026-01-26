// ============================================
// SHARED UTILITIES
// ============================================

import { ApiResponse } from './types.ts';

/**
 * CORS headers for Edge Functions
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-runtime, x-supabase-client-platform',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

/**
 * Success response helper
 */
export function successResponse<T>(data: T, message?: string): Response {
  const response: ApiResponse<T> = {
    success: true,
    data,
    ...(message && { message }),
  };
  
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Error response helper
 */
export function errorResponse(message: string, status = 400): Response {
  const response: ApiResponse = {
    success: false,
    error: message,
  };
  
  return new Response(JSON.stringify(response), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Validate required fields
 */
export function validateRequired(data: Record<string, any>, fields: string[]): string | null {
  for (const field of fields) {
    if (!data[field]) {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}

/**
 * Sanitize input string
 */
export function sanitizeInput(str: string | null | undefined): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .trim()
    .replace(/[<>"'`]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '');
}

/**
 * Get current timestamp in ISO format
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Decode base64 to Uint8Array
 */
export function decodeBase64(base64: string): Uint8Array {
  // Remove data URI prefix if present
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
  
  // Decode base64
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return bytes;
}

/**
 * Validate alcohol value
 */
export function validateAlcoholValue(value: number): boolean {
  return value >= 0 && value <= 5;
}

/**
 * Validate ODO value
 */
export function validateOdo(value: number): boolean {
  return value >= 0 && value <= 9999999;
}

/**
 * Validate reference format
 */
export function validateReference(reference: string): boolean {
  const pattern = /^[a-zA-Z0-9\-_]+$/;
  return pattern.test(reference) && reference.length >= 3 && reference.length <= 50;
}

/**
 * Parse request body with error handling
 */
export async function parseRequestBody<T>(req: Request): Promise<T | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/**
 * Log with timestamp
 */
export function log(message: string, data?: any): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, data || '');
}

/**
 * Get success message based on action type
 */
export function getSuccessMessage(type: string): string {
  const messages: Record<string, string> = {
    'checkin': 'Check-in สำเร็จ',
    'checkout': 'Check-out สำเร็จ',
    'fuel': 'ลงน้ำมันสำเร็จ',
    'unload': 'ลงเสร็จสำเร็จ',
    'alcohol': 'บันทึกการตรวจแอลกอฮอล์สำเร็จ',
    'close': 'ปิดงานสำเร็จ',
    'endtrip': 'จบทริปสำเร็จ',
  };
  return messages[type] || 'อัปเดตสำเร็จ';
}
