import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listUsersWithRoles,
  assignUserRole,
  removeUserRole,
} from "@/lib/api/users.functions";
import { listRoles } from "@/lib/api/roles.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, Users as UsersIcon, Search } from "lucide-react";
import { toast } from "sonner";

const APP_ROLES = [
  "admin",
  "finance_manager",
  "accounting_manager",
  "chief_accountant",
  "accountant",
  "internal_auditor",
] as const;

export function UserRolesManagement() {
  const { t, locale } = useI18n();
  const { companyId } = useBranch();
  const qc = useQueryClient();
  const listFn = useServerFn(listUsersWithRoles);
  const assignFn = useServerFn(assignUserRole);
  const removeFn = useServerFn(removeUserRole);
  const listRolesFn = useServerFn(listRoles);

  const [search, setSearch] = useState("");
  const [pickRole, setPickRole] = useState<Record<string, string>>({});

  const { data: rolesRegistry = [] } = useQuery({
    queryKey: ["roles_registry"],
    queryFn: () => listRolesFn(),
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users_with_roles", companyId],
    queryFn: () => listFn({ data: { companyId: companyId ?? null } }),
  });

  const roleLabel = (code: string) => {
    const r = (rolesRegistry as any[]).find((x) => x.code === code);
    if (r) return locale === "ar" ? r.name_ar : r.name_en;
    return t(`users.${code}`) || code;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users as any[];
    return (users as any[]).filter(
      (u) =>
        u.email?.toLowerCase().includes(q) ||
        u.display_name_en?.toLowerCase().includes(q) ||
        u.display_name_ar?.toLowerCase().includes(q),
    );
  }, [users, search]);

  const assignMut = useMutation({
    mutationFn: (v: { userId: string; role: string }) =>
      assignFn({
        data: { userId: v.userId, role: v.role as any, companyId: companyId ?? null },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users_with_roles"] });
      toast.success(t("common.saved"));
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (v: { userId: string; role: string }) =>
      removeFn({
        data: { userId: v.userId, role: v.role as any, companyId: companyId ?? null },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users_with_roles"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <UsersIcon className="h-4 w-4 text-muted-foreground" />
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute start-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={t("common.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-7 h-8 text-xs"
          />
        </div>
        <div className="text-xs text-muted-foreground">
          {filtered.length} / {users.length}
        </div>
      </div>

      {isLoading ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">…</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          {t("common.noData")}
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((u: any) => {
            const available = APP_ROLES.filter((r) => !u.roles.includes(r));
            return (
              <Card key={u.id} className="p-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-[180px]">
                    <div className="font-bold text-sm">
                      {locale === "ar" ? u.display_name_ar : u.display_name_en}
                    </div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </div>
                  <div className="flex-1 flex flex-wrap gap-1.5 items-center justify-end">
                    {u.roles.length === 0 && (
                      <span className="text-xs text-muted-foreground italic">
                        {t("users.noRoles")}
                      </span>
                    )}
                    {u.roles.map((r: string) => (
                      <Badge
                        key={r}
                        variant="secondary"
                        className="gap-1 pe-1"
                      >
                        {roleLabel(r)}
                        <button
                          onClick={() =>
                            removeMut.mutate({ userId: u.id, role: r })
                          }
                          className="hover:bg-destructive/20 rounded-sm p-0.5"
                          title={t("common.remove")}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    {available.length > 0 && (
                      <div className="flex gap-1 items-center">
                        <Select
                          value={pickRole[u.id] || ""}
                          onValueChange={(v) =>
                            setPickRole((p) => ({ ...p, [u.id]: v }))
                          }
                        >
                          <SelectTrigger className="h-7 text-xs w-[160px]">
                            <SelectValue placeholder={t("users.assignRole")} />
                          </SelectTrigger>
                          <SelectContent>
                            {available.map((r) => (
                              <SelectItem key={r} value={r} className="text-xs">
                                {roleLabel(r)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          disabled={!pickRole[u.id]}
                          onClick={() => {
                            const r = pickRole[u.id];
                            if (!r) return;
                            assignMut.mutate({ userId: u.id, role: r });
                            setPickRole((p) => ({ ...p, [u.id]: "" }));
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
