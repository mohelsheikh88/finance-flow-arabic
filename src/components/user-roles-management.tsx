import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listUsersWithRoles,
  assignUserRole,
  removeUserRole,
  listModuleAccess,
  setUserModules,
  createUser,
  updateUser,
  deleteUser,
} from "@/lib/api/users.functions";
import { listRoles } from "@/lib/api/roles.functions";
import { useBranch } from "@/lib/branch-context";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useI18n } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  X,
  Users as UsersIcon,
  Search,
  Pencil,
  Trash2,
  Wallet,
  ShoppingBag,
  Package,
  UsersRound,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

const APP_ROLES = [
  "admin",
  "finance_manager",
  "accounting_manager",
  "chief_accountant",
  "accountant",
  "internal_auditor",
] as const;

export const MODULES = [
  { key: "accounting", icon: Wallet, tKey: "nav.financialAccounting" },
  { key: "purchase", icon: ShoppingBag, tKey: "nav.purchaseProcurement" },
  { key: "inventory", icon: Package, tKey: "nav.inventoryManagement" },
  { key: "hr", icon: UsersRound, tKey: "nav.humanResources" },
  { key: "settings", icon: Settings, tKey: "nav.generalSetting" },
] as const;

type FormState = {
  id: string | null;
  email: string;
  password: string;
  nameAr: string;
  nameEn: string;
  isActive: boolean;
  roles: string[];
  modules: string[];
};

const emptyForm: FormState = {
  id: null,
  email: "",
  password: "",
  nameAr: "",
  nameEn: "",
  isActive: true,
  roles: [],
  modules: [],
};

export function UserRolesManagement() {
  const { t, locale } = useI18n();
  const { companyId } = useBranch();
  const { user } = useAuth();
  const qc = useQueryClient();
  const listFn = useServerFn(listUsersWithRoles);
  const assignFn = useServerFn(assignUserRole);
  const removeFn = useServerFn(removeUserRole);
  const listRolesFn = useServerFn(listRoles);
  const listModulesFn = useServerFn(listModuleAccess);
  const setModulesFn = useServerFn(setUserModules);
  const createFn = useServerFn(createUser);
  const updateFn = useServerFn(updateUser);
  const deleteFn = useServerFn(deleteUser);

  const [search, setSearch] = useState("");
  const [pickRole, setPickRole] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

  const { data: rolesRegistry = [] } = useQuery({
    queryKey: ["roles_registry"],
    queryFn: () => listRolesFn(),
    enabled: !!user,
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users_with_roles", companyId],
    queryFn: () => listFn({ data: { companyId: companyId ?? null } }),
    enabled: !!user,
  });

  const { data: moduleAccess = [] } = useQuery({
    queryKey: ["user_module_access"],
    queryFn: () => listModulesFn({ data: {} } as any),
    enabled: !!user,
  });

  const modulesByUser = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const r of moduleAccess as any[]) {
      const arr = m.get(r.user_id) ?? [];
      arr.push(r.module_key);
      m.set(r.user_id, arr);
    }
    return m;
  }, [moduleAccess]);

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

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["users_with_roles"] });
    qc.invalidateQueries({ queryKey: ["user_module_access"] });
  };

  const assignMut = useMutation({
    mutationFn: (v: { userId: string; role: string }) =>
      assignFn({
        data: { userId: v.userId, role: v.role as any, companyId: companyId ?? null },
      }),
    onSuccess: () => {
      invalidate();
      toast.success(t("common.saved"));
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (v: { userId: string; role: string }) =>
      removeFn({
        data: { userId: v.userId, role: v.role as any, companyId: companyId ?? null },
      }),
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActiveMut = useMutation({
    mutationFn: (v: { userId: string; isActive: boolean }) =>
      updateFn({ data: { userId: v.userId, isActive: v.isActive } }),
    onSuccess: () => {
      invalidate();
      toast.success(t("common.saved"));
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (userId: string) => deleteFn({ data: { userId } }),
    onSuccess: () => {
      invalidate();
      setConfirmDelete(null);
      toast.success(t("common.deleted"));
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveMut = useMutation({
    mutationFn: async (f: FormState) => {
      if (f.id) {
        await updateFn({
          data: {
            userId: f.id,
            displayNameAr: f.nameAr,
            displayNameEn: f.nameEn,
            isActive: f.isActive,
            ...(f.password ? { password: f.password } : {}),
          },
        });
        await setModulesFn({ data: { userId: f.id, modules: f.modules as any } });
        // sync roles
        const current: string[] =
          (users as any[]).find((u) => u.id === f.id)?.roles ?? [];
        for (const r of f.roles.filter((r) => !current.includes(r))) {
          await assignFn({
            data: { userId: f.id, role: r as any, companyId: companyId ?? null },
          });
        }
        for (const r of current.filter((r) => !f.roles.includes(r))) {
          await removeFn({
            data: { userId: f.id, role: r as any, companyId: companyId ?? null },
          });
        }
      } else {
        await createFn({
          data: {
            email: f.email,
            password: f.password,
            displayNameAr: f.nameAr || f.nameEn,
            displayNameEn: f.nameEn || f.nameAr,
            roles: f.roles,
            modules: f.modules as any,
            companyId: companyId ?? null,
          },
        });
      }
    },
    onSuccess: () => {
      invalidate();
      setOpen(false);
      toast.success(t("common.saved"));
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openCreate = () => {
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (u: any) => {
    setForm({
      id: u.id,
      email: u.email,
      password: "",
      nameAr: u.display_name_ar ?? "",
      nameEn: u.display_name_en ?? "",
      isActive: u.is_active !== false,
      roles: [...(u.roles ?? [])],
      modules: [...(modulesByUser.get(u.id) ?? [])],
    });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) setForm(emptyForm);
  }, [open]);

  const toggleIn = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
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
        <Button size="sm" className="h-8 gap-1.5" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          {t("users.newUser")}
        </Button>
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
            const mods = modulesByUser.get(u.id) ?? [];
            const active = u.is_active !== false;
            return (
              <Card key={u.id} className={"p-3 " + (active ? "" : "opacity-60")}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">
                        {locale === "ar" ? u.display_name_ar : u.display_name_en}
                      </span>
                      {!active && (
                        <Badge variant="outline" className="text-[10px]">
                          {t("users.disabled")}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {mods.length === 0 ? (
                        <span className="text-[11px] text-muted-foreground italic">
                          {t("users.noModules")}
                        </span>
                      ) : (
                        mods.map((m) => {
                          const def = MODULES.find((x) => x.key === m);
                          if (!def) return null;
                          const Icon = def.icon;
                          return (
                            <Badge
                              key={m}
                              variant="outline"
                              className="gap-1 text-[10px] border-primary/40 text-primary"
                            >
                              <Icon className="h-3 w-3" />
                              {t(def.tKey)}
                            </Badge>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="flex-1 flex flex-wrap gap-1.5 items-center justify-end">
                    {u.roles.length === 0 && (
                      <span className="text-xs text-muted-foreground italic">
                        {t("users.noRoles")}
                      </span>
                    )}
                    {u.roles.map((r: string) => (
                      <Badge key={r} variant="secondary" className="gap-1 pe-1">
                        {roleLabel(r)}
                        <button
                          onClick={() => removeMut.mutate({ userId: u.id, role: r })}
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
                          onValueChange={(v) => setPickRole((p) => ({ ...p, [u.id]: v }))}
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

                    <div className="flex items-center gap-2 ms-2 ps-2 border-s">
                      <Switch
                        checked={active}
                        onCheckedChange={(v) =>
                          toggleActiveMut.mutate({ userId: u.id, isActive: v })
                        }
                        title={active ? t("users.disable") : t("users.enable")}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => openEdit(u)}
                        title={t("common.edit")}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        disabled={u.id === user?.id}
                        onClick={() => setConfirmDelete(u)}
                        title={t("common.delete")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {form.id ? t("users.editUser") : t("users.newUser")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-[65vh] overflow-y-auto pe-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("common.email")}</Label>
                <Input
                  value={form.email}
                  disabled={!!form.id}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {form.id ? t("users.newPassword") : t("users.password")}
                </Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="h-8 text-xs"
                  placeholder={form.id ? t("users.leaveBlank") : ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("users.nameAr")}</Label>
                <Input
                  value={form.nameAr}
                  onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("users.nameEn")}</Label>
                <Input
                  value={form.nameEn}
                  onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
              />
              <span className="text-xs">{t("users.activeUser")}</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                {t("users.roles")}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {APP_ROLES.map((r) => (
                  <label
                    key={r}
                    className="flex items-center gap-2 rounded-md border p-2 text-xs cursor-pointer hover:bg-accent/40"
                  >
                    <Checkbox
                      checked={form.roles.includes(r)}
                      onCheckedChange={() =>
                        setForm((f) => ({ ...f, roles: toggleIn(f.roles, r) }))
                      }
                    />
                    {roleLabel(r)}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <Package className="h-3.5 w-3.5 text-primary" />
                {t("users.modules")}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t("users.modulesHint")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {MODULES.map((m) => {
                  const Icon = m.icon;
                  return (
                    <label
                      key={m.key}
                      className="flex items-center gap-2 rounded-md border p-2.5 text-xs cursor-pointer hover:bg-accent/40"
                    >
                      <Checkbox
                        checked={form.modules.includes(m.key)}
                        onCheckedChange={() =>
                          setForm((f) => ({ ...f, modules: toggleIn(f.modules, m.key) }))
                        }
                      />
                      <Icon className="h-4 w-4 text-primary" />
                      {t(m.tKey)}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              disabled={
                saveMut.isPending ||
                (!form.id && (!form.email || form.password.length < 8))
              }
              onClick={() => saveMut.mutate(form)}
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("users.deleteUser")}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.email} — {t("users.deleteWarning")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => confirmDelete && deleteMut.mutate(confirmDelete.id)}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
