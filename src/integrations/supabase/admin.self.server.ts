// Server-only admin client for the project's own Supabase instance.
// Uses the MY_SUPABASE_SERVICE_ROLE_KEY secret (the reserved SUPABASE_* names
// are injected by the platform and point at the managed backend).
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { SELF_SUPABASE_URL } from './self-hosted';

function createSupabaseAdminClient() {
  const key = process.env.MY_SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    const message =
      'Missing MY_SUPABASE_SERVICE_ROLE_KEY. Add it in project secrets.';
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }

  return createClient<Database>(SELF_SUPABASE_URL, key, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

export const supabaseAdmin = new Proxy(
  {} as ReturnType<typeof createSupabaseAdminClient>,
  {
    get(_, prop, receiver) {
      if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
      return Reflect.get(_supabaseAdmin, prop, receiver);
    },
  },
);
