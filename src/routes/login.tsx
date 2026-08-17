import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { BrandMark } from "@/components/brand-logo";


export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { t, locale, setLocale } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && user) navigate({ to: "/apps", replace: true });
  }, [user, authLoading, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { display_name_en: displayName, display_name_ar: displayName },
          },
        });
        if (error) throw error;
        toast.success(t("common.saved"));
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
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
        <div className="text-center mb-8 text-primary-foreground">
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
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
            </div>
            <div>
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
            </div>
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

        <div className="mt-6 text-center">
          <button
            onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
            className="text-sm text-white/80 hover:text-white"
          >
            {locale === "ar" ? "English" : "العربية"}
          </button>
        </div>
      </div>
    </div>
  );
}
