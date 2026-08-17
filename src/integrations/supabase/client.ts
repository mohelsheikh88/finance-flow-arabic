// Browser Supabase client — bound to the project's own (self-managed) instance.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { SELF_SUPABASE_URL, SELF_SUPABASE_PUBLISHABLE_KEY } from './self-hosted';

// "Remember me" support: when the box is checked at login we persist the
// session in localStorage (survives closing the browser). When unchecked,
// the session lives in sessionStorage only and disappears once the tab/
// browser is closed. The flag itself must live in localStorage so it is
// readable before we know which storage the session token is in.
export const REMEMBER_ME_KEY = 'auth:remember-me';

export function setRememberMe(remember: boolean) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(REMEMBER_ME_KEY, remember ? '1' : '0');
  } catch {}
}

function isRememberMeEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const v = window.localStorage.getItem(REMEMBER_ME_KEY);
    return v === null ? true : v === '1';
  } catch {
    return true;
  }
}

const hybridAuthStorage = {
  getItem: (key: string) => {
    if (typeof window === 'undefined') return null;
    // A session might exist in either backing store (e.g. user unchecked the
    // box on a device that previously had a remembered session) — check both.
    return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (typeof window === 'undefined') return;
    if (isRememberMeEnabled()) {
      window.localStorage.setItem(key, value);
      window.sessionStorage.removeItem(key);
    } else {
      window.sessionStorage.setItem(key, value);
      window.localStorage.removeItem(key);
    }
  },
  removeItem: (key: string) => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

function createSupabaseClient() {
  return createClient<Database>(SELF_SUPABASE_URL, SELF_SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: typeof window !== 'undefined' ? hybridAuthStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
