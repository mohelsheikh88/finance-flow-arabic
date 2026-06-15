import { useEffect } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { I18nProvider } from "@/i18n";
import { BrandIdentityProvider } from "@/lib/brand-identity";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { BranchProvider } from "@/lib/branch-context";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { ConflictTrackerProvider, useConflictRealtimeSubscriber } from "@/lib/conflict-tracker";
import { OfflineQueueProvider } from "@/lib/offline-queue";
import { ScopedRealtime } from "@/lib/scoped-realtime";
import { toast } from "sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
          <a href="/" className="rounded-md border border-input px-4 py-2 text-sm hover:bg-accent">Home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Al Hayat ERP" },
      { name: "description", content: "نظام تخطيط موارد المؤسسات - Al Hayat ERP" },
      { property: "og:title", content: "Al Hayat ERP" },
      { name: "twitter:title", content: "Al Hayat ERP" },
      { property: "og:description", content: "نظام تخطيط موارد المؤسسات - Al Hayat ERP" },
      { name: "twitter:description", content: "نظام تخطيط موارد المؤسسات - Al Hayat ERP" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/6a2c5fcf-f50c-4861-9164-9501dee4c0dd/id-preview-e3077e5c--f2afbb96-40cb-4554-8bff-e640d63b4189.lovable.app-1780147695464.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/6a2c5fcf-f50c-4861-9164-9501dee4c0dd/id-preview-e3077e5c--f2afbb96-40cb-4554-8bff-e640d63b4189.lovable.app-1780147695464.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function AuthSync() {
  const router = useRouter();
  const queryClient = useQueryClient();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
      queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);
  return null;
}

// RealtimeSync replaced by ScopedRealtime — subscribes only to tables
// the user is allowed to read, scoped to active branch/company.

function ConflictSubscriber() {
  useConflictRealtimeSubscriber();
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <BrandIdentityProvider>
          <AuthProvider>
            <BranchProvider>
              <ConflictTrackerProvider>
                <OfflineQueueProvider>
                  <AuthSync />
                  <ScopedRealtime />
                  <ConflictSubscriber />
                  <Outlet />
                  <Toaster richColors position="top-center" />
                </OfflineQueueProvider>
              </ConflictTrackerProvider>
            </BranchProvider>
          </AuthProvider>
        </BrandIdentityProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
