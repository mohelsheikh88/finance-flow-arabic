import { useNavigate } from "@tanstack/react-router";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Languages, LogOut, User } from "lucide-react";
import { useI18n, useLocalized } from "@/i18n";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useBranch } from "@/lib/branch-context";
import { useQuery, useIsFetching } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getUserContext } from "@/lib/api/context.functions";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { OfflineIndicator } from "@/components/offline-indicator";

export function Topbar({ hideSidebarTrigger = false, transparent = false }: { hideSidebarTrigger?: boolean; transparent?: boolean } = {}) {
  const { t, locale, setLocale } = useI18n();
  const localized = useLocalized();
  const { user, signOut } = useAuth();
  const { companyId, branchId, setCompanyId, setBranchId } = useBranch();
  const navigate = useNavigate();

  const fetchCtx = useServerFn(getUserContext);
  const { data: ctx } = useQuery({
    queryKey: ["user-context"],
    queryFn: () => fetchCtx(),
    enabled: !!user,
  });

  const ctxFetching = useIsFetching({ queryKey: ["user-context"] }) > 0;

  // Auto-select first company/branch
  useEffect(() => {
    if (ctx?.companies?.length && !companyId) {
      setCompanyId(ctx.companies[0].id);
    }
  }, [ctx, companyId, setCompanyId]);

  useEffect(() => {
    if (ctx?.branches?.length && !branchId && companyId) {
      const b = ctx.branches.find((br: any) => br.company_id === companyId);
      if (b) setBranchId(b.id);
    }
  }, [ctx, branchId, companyId, setBranchId]);

  const filteredBranches = (ctx?.branches ?? []).filter((b: any) => b.company_id === companyId);

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const initials = (user?.email ?? "U").slice(0, 2).toUpperCase();

  return (
    <header className={
      "relative h-12 flex items-center px-3 gap-2 shrink-0 " +
      (transparent
        ? "border-b border-white/10 bg-transparent text-white [&_svg]:text-white/90"
        : "border-b bg-card")
    }>
      {ctxFetching && (
        <div className="absolute left-0 right-0 top-0 h-0.5 overflow-hidden">
          <div className="h-full w-1/3 bg-primary animate-[loading-bar_1.2s_ease-in-out_infinite]" />
        </div>
      )}
      {!hideSidebarTrigger && <SidebarTrigger />}

      {ctxFetching && (
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>{locale === "ar" ? "يتم تحديث البيانات…" : "Updating data…"}</span>
        </div>
      )}

      <div className="flex items-center gap-2 ms-2">
        {(ctx?.companies?.length ?? 0) > 0 && (
          <Select value={companyId ?? ""} onValueChange={(v) => { setCompanyId(v); setBranchId(null); }}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue placeholder={t("common.company")} />
            </SelectTrigger>
            <SelectContent>
              {ctx!.companies.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {localized(c, "name")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {filteredBranches.length > 0 && (
          <Select value={branchId ?? ""} onValueChange={setBranchId}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder={t("common.branch")} />
            </SelectTrigger>
            <SelectContent>
              {filteredBranches.map((b: any) => (
                <SelectItem key={b.id} value={b.id}>
                  {localized(b, "name")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex-1" />

      <OfflineIndicator />

      <Button variant="ghost" size="sm" onClick={() => setLocale(locale === "ar" ? "en" : "ar")} className="gap-1">

        <Languages className="h-4 w-4" />
        <span className="text-xs">{locale === "ar" ? "EN" : "ع"}</span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
              {initials}
            </div>
            <span className="text-xs hidden md:inline">{user?.email}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="text-sm">{user?.email}</span>
              {ctx?.isAdmin && <span className="text-[10px] text-primary">{t("users.admin")}</span>}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem><User className="me-2 h-4 w-4" />{t("common.welcome")}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-destructive">
            <LogOut className="me-2 h-4 w-4" /> {t("common.logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
