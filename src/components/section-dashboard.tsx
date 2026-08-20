import { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useI18n } from "@/i18n";

export function StatCard({
  icon, label, value, sublabel, accent = "muted",
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  sublabel?: string;
  accent?: "primary" | "success" | "warning" | "destructive" | "info" | "muted";
}) {
  const colors: Record<string, string> = {
    primary: "from-primary/15 to-primary/5 border-primary/30",
    success: "from-success/15 to-success/5 border-success/30",
    warning: "from-warning/15 to-warning/5 border-warning/30",
    destructive: "from-destructive/15 to-destructive/5 border-destructive/30",
    info: "from-info/15 to-info/5 border-info/30",
    muted: "from-muted/40 to-muted/10 border-border",
  };
  return (
    <Card className={`p-4 bg-gradient-to-br ${colors[accent]} border`}>
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
        </div>
        <div className="opacity-80">{icon}</div>
      </div>
    </Card>
  );
}

export function QuickActions({
  actions,
}: { actions: { to: string; label: string; icon?: ReactNode }[] }) {
  const { t } = useI18n();
  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold mb-3">{t("common.quickActions") || "Quick actions"}</h3>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button key={a.to} asChild variant="outline" size="sm">
            <Link to={a.to}>{a.icon}<span className="mx-1">{a.label}</span><ArrowRight className="h-3.5 w-3.5 opacity-60" /></Link>
          </Button>
        ))}
      </div>
    </Card>
  );
}

export function SectionDashboardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h1 className="page-title">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}

export function formatMoney(n: number, locale: string, currency = "SAR") {
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", {
    style: "currency", currency, maximumFractionDigits: 0, minimumFractionDigits: 0,
  }).format(Math.round(n));
}
