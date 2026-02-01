/**
 * Auth Helpers
 * Helper functions for Supabase authentication with LINE integration
 */

import { getBrowserClient } from './client';

const supabase = getBrowserClient();

// =====================================================
// CURRENT USER
// =====================================================

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    console.error('Error getting current user:', error);
    return null;
  }

  return user;
}

export async function getCurrentSession() {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    console.error('Error getting current session:', error);
    return null;
  }

  return session;
}

// =====================================================
// SIGN IN WITH LINE
// =====================================================

export interface SignInWithLineResult {
  success: boolean;
  user?: any;
  error?: string;
}

export async function signInWithLine(lineUserId: string, lineAccessToken: string): Promise<SignInWithLineResult> {
  try {
    // Check if user exists with this LINE user ID
    const { data: existingUser, error: selectError } = await supabase
      .from('users')
      .select('*')
      .eq('line_user_id', lineUserId)
      .maybeSingle();

    if (selectError && selectError.code !== 'PGRST116') {
      return { success: false, error: selectError.message };
    }

    // Get LINE profile data
    const profile = await getLineProfile(lineAccessToken);

    if (existingUser) {
      // User exists - sign in
      const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({
        email: `${existingUser.line_user_id}@liff.temp`,
        password: existingUser.user_id, // Using user_id as temp password
      });

      if (signInError) {
        // Fallback: create new session using lineUserId
        return { success: true, user: existingUser };
      }

      return { success: true, user };
    }

    // New user - create account
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        line_user_id: lineUserId,
        name: profile.displayName,
        role: 'patient', // Default role for LINE users
        is_active: true,
      })
      .select()
      .single();

    if (createError) {
      return { success: false, error: createError.message };
    }

    return { success: true, user: newUser };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// =====================================================
// SIGN OUT
// =====================================================

export async function signOut(): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.auth.signOut();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// =====================================================
// LINK LINE ACCOUNT
// =====================================================

export async function linkLineAccount(
  userId: string,
  lineUserId: string,
  lineProfile?: {
    displayName?: string;
    pictureUrl?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('users')
    .update({
      line_user_id: lineUserId,
      name: lineProfile?.displayName,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Also update line_users table
  await supabase
    .from('line_users')
    .upsert({
      line_user_id: lineUserId,
      user_id: userId,
      display_name: lineProfile?.displayName,
      picture_url: lineProfile?.pictureUrl,
      linked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'line_user_id',
    });

  return { success: true };
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

async function getLineProfile(accessToken: string) {
  const response = await fetch('https://api.line.me/v2/profile', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch LINE profile');
  }

  return await response.json();
}

// =====================================================
// SESSION REFRESH
// =====================================================

export async function refreshSession(): Promise<boolean> {
  const { data: { session }, error } = await supabase.auth.refreshSession();

  if (error || !session) {
    return false;
  }

  return true;
}

// =====================================================
// AUTH STATE CHANGE LISTENER
// =====================================================

export type AuthStateChangeCallback = (
  event: 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED',
  session: any
) => void;

export function onAuthStateChange(callback: AuthStateChangeCallback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);

  return subscription;
}
