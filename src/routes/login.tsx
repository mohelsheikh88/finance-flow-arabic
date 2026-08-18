import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase, setRememberMe } from "@/integrations/supabase/client";
import { employeeIdToAuthEmail, isLikelyEmail } from "@/lib/employee-auth";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Languages } from "lucide-react";
import { BrandMark } from "@/components/brand-logo";


export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { t, locale, setLocale } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && user) navigate({ to: "/apps", replace: true });
  }, [user, authLoading, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    // Must be set BEFORE sign-in so the session token lands in the right
    // storage (localStorage if remembered, sessionStorage otherwise).
    setRememberMe(remember);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: identifier,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { display_name_en: displayName, display_name_ar: displayName },
          },
        });
        if (error) throw error;
        toast.success(t("common.saved"));
      } else {
        // Accepts either a real email (existing accounts) or an Employee
        // ID (the normal way to log in now) — transparently mapped to the
        // internal auth email either way.
        const authEmail = isLikelyEmail(identifier) ? identifier : employeeIdToAuthEmail(identifier);
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password });
        if (error) throw error;
      }
    } catch (e: any) {
      toast.error(e.message ?? t("common.error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-primary-deep via-primary to-primary-light">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 text-primary-foreground relative">
          <button
            type="button"
            onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
            className="absolute top-0 end-0 flex items-center gap-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 text-xs text-white transition-colors"
          >
            <Languages className="h-3.5 w-3.5" />
            {locale === "ar" ? "English" : "العربية"}
          </button>
          <div className="inline-flex items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 mb-4 p-3">
            <BrandMark size={56} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{t("common.appName")}</h1>
          <p className="mt-2 text-sm text-white/80">{t(mode === "login" ? "auth.loginSubtitle" : "auth.signupSubtitle")}</p>
        </div>


        <Card className="p-8">
          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name">{t("auth.displayName")}</Label>
                <Input id="name" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
            )}
            <div>
              <Label htmlFor="email">{mode === "login" ? t("auth.employeeIdOrEmail") : t("auth.email")}</Label>
              <Input
                id="email"
                type={mode === "login" ? "text" : "email"}
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                dir="ltr"
              />
            </div>
            <div>
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
            </div>
            {mode === "login" && (
              <div className="flex items-center gap-2">
                <Checkbox id="remember" checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
                <Label htmlFor="remember" className="cursor-pointer font-normal text-sm text-muted-foreground">
                  {t("auth.rememberMe")}
                </Label>
              </div>
            )}
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
              {t(mode === "login" ? "auth.login" : "auth.signup")}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? t("auth.noAccount") : t("auth.hasAccount")}{" "}
            <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-primary font-medium hover:underline">
              {t(mode === "login" ? "auth.signupNow" : "auth.loginNow")}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
