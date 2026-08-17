// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import {
  SELF_SUPABASE_URL,
  SELF_SUPABASE_PUBLISHABLE_KEY,
} from "./src/integrations/supabase/self-hosted";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    define: {
      // Point the browser client at the project's own Supabase instance,
      // overriding platform-injected VITE_SUPABASE_* values.
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(SELF_SUPABASE_URL),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        SELF_SUPABASE_PUBLISHABLE_KEY,
      ),
    },
  },
});

