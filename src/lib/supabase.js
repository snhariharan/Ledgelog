import { createClient } from '@supabase/supabase-js';

// Supports both the Vite-conventional VITE_ prefix (local .env) and the
// unprefixed names the Vercel Supabase integration creates automatically.
const supabaseUrl            = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.SUPABASE_PUBLISHABLE_KEY;

/**
 * True when the required env vars are present.
 * The app falls back to demo/mock mode when false.
 */
export const IS_SUPABASE_CONFIGURED =
  typeof supabaseUrl            === 'string' && supabaseUrl.startsWith('https://') &&
  typeof supabasePublishableKey === 'string' && supabasePublishableKey.length > 20;

export const supabase = IS_SUPABASE_CONFIGURED
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
