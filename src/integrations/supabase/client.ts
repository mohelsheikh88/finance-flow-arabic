// Browser Supabase client — bound to the project's own (self-managed) instance.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { SELF_SUPABASE_URL, SELF_SUPABASE_PUBLISHABLE_KEY } from './self-hosted';

function createSupabaseClient() {
  return createClient<Database>(SELF_SUPABASE_URL, SELF_SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
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
