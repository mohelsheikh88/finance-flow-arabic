import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listCompanies,
  listBranches,
  createCompany,
  updateCompany,
  createBranch,
  updateBranch,
} from "@/lib/api/companies.functions";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Building2, MapPin, Pencil, Network, ChevronRight, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/companies")({
  component: Page,
});

type Company = any;
type Branch = any;

const emptyCompany = {
  code: "",
  name_ar: "",
  name_en: "",
  vat_number: "",
  cr_number: "",
  address_ar: "",
  address_en: "",
  phone: "",
  email: "",
  website: "",
  default_currency: "SAR",
  fiscal_year_start_month: 1,
};

const emptyBranch = {
  company_id: "",
  code: "",
  name_ar: "",
  name_en: "",
  cr_number: "",
  address_ar: "",
  phone: "",
  is_main: false,
  is_active: true,
};

function Page() {
  const { t } = useI18n();
  const localized = useLocalized();
  const qc = useQueryClient();

  const companiesFn = useServerFn(listCompanies);
  const branchesFn = useServerFn(listBranches);
  const createCompanyFn = useServerFn(createCompany);
  const updateCompanyFn = useServerFn(updateCompany);
  const createBranchFn = useServerFn(createBranch);
  const updateBranchFn = useServerFn(updateBranch);

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => companiesFn(),
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches", "all"],
    queryFn: () => branchesFn({ data: {} }),
  });

  // Company dialog
  const [coOpen, setCoOpen] = useState(false);
  const [coForm, setCoForm] = useState<typeof emptyCompany & { id?: string }>(emptyCompany);
  const openCompany = (c?: Company) => {
    if (c) {
      setCoForm({
        id: c.id,
        code: c.code ?? "",
        name_ar: c.name_ar ?? "",
        name_en: c.name_en ?? "",
        vat_number: c.vat_number ?? "",
        cr_number: c.cr_number ?? "",
        address_ar: c.address_ar ?? "",
        address_en: c.address_en ?? "",
        phone: c.phone ?? "",
        email: c.email ?? "",
        website: c.website ?? "",
        default_currency: c.default_currency ?? "SAR",
        fiscal_year_start_month: c.fiscal_year_start_month ?? 1,
      });
    } else {
      setCoForm(emptyCompany);
    }
    setCoOpen(true);
  };

  // Helper: apply optimistic upsert to a query list
  const optimisticUpsert = <T extends { id: string }>(
    key: readonly unknown[],
    row: T
  ) => {
    const prev = qc.getQueryData<T[]>(key as any);
    qc.setQueryData<T[]>(key as any, (old) => {
      const list = old ?? [];
      const idx = list.findIndex((x) => x.id === row.id);
      if (idx >= 0) {
        const next = list.slice();
        next[idx] = { ...list[idx], ...row };
        return next;
      }
      return [...list, row];
    });
    return prev;
  };

  const coMut = useMutation({
    mutationFn: async () => {
      const { id, ...payload } = coForm;
      if (id) return updateCompanyFn({ data: { id, ...payload } });
      return createCompanyFn({ data: payload });
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["companies"] });
      await qc.cancelQueries({ queryKey: ["user-context"] });
      const tempId = coForm.id ?? `optimistic-${crypto.randomUUID()}`;
      const optimisticRow: any = {
        id: tempId,
        is_active: true,
        ...coForm,
        __optimistic: true,
      };
      const prevCompanies = optimisticUpsert(["companies"], optimisticRow);
      const prevCtx = qc.getQueryData<any>(["user-context"]);
      if (prevCtx) {
        qc.setQueryData(["user-context"], {
          ...prevCtx,
          companies: (() => {
            const list = prevCtx.companies ?? [];
            const idx = list.findIndex((x: any) => x.id === optimisticRow.id);
            if (idx >= 0) {
              const next = list.slice();
              next[idx] = { ...list[idx], ...optimisticRow };
              return next;
            }
            return [...list, optimisticRow];
          })(),
        });
      }
      setCoOpen(false);
      return { prevCompanies, prevCtx, tempId };
    },
    onSuccess: (data: any, _vars, ctx) => {
      // Replace optimistic row with server row
      if (ctx?.tempId && data?.id && ctx.tempId !== data.id) {
        qc.setQueryData<any[]>(["companies"], (old) =>
          (old ?? []).map((x) => (x.id === ctx.tempId ? data : x))
        );
      }
      const isNew = !coForm.id;
      const name = data?.name_ar || data?.name_en || coForm.name_ar || coForm.code;
      toast.success(
        isNew ? `تم إنشاء الشركة "${name}" بنجاح` : `تم تحديث الشركة "${name}" بنجاح`,
        {
          description: isNew
            ? "السبب: إضافة شركة جديدة — تم تحديث القوائم المنسدلة (Topbar/Sidebar) تلقائيًا."
            : "السبب: تعديل بيانات شركة — تم تحديث القوائم المنسدلة (Topbar/Sidebar) تلقائيًا.",
        }
      );
    },
    onError: (e: Error, _vars, ctx) => {
      // Roll back optimistic state
      if (ctx?.prevCompanies !== undefined)
        qc.setQueryData(["companies"], ctx.prevCompanies);
      if (ctx?.prevCtx !== undefined) qc.setQueryData(["user-context"], ctx.prevCtx);
      toast.error(e.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["user-context"] });
    },
  });


  // Branch dialog
  const [brOpen, setBrOpen] = useState(false);
  const [brForm, setBrForm] = useState<typeof emptyBranch & { id?: string }>(emptyBranch);
  const openBranch = (b?: Branch, defaultCompanyId?: string) => {
    if (b) {
      setBrForm({
        id: b.id,
        company_id: b.company_id,
        code: b.code ?? "",
        name_ar: b.name_ar ?? "",
        name_en: b.name_en ?? "",
        cr_number: b.cr_number ?? "",
        address_ar: b.address_ar ?? "",
        phone: b.phone ?? "",
        is_main: !!b.is_main,
        is_active: b.is_active !== false,
      });
    } else {
      setBrForm({ ...emptyBranch, company_id: defaultCompanyId ?? companies[0]?.id ?? "" });
    }
    setBrOpen(true);
  };

  const brMut = useMutation({
    mutationFn: async () => {
      const { id, ...payload } = brForm;
      if (id) return updateBranchFn({ data: { id, ...payload } });
      return createBranchFn({ data: payload });
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["branches"] });
      await qc.cancelQueries({ queryKey: ["user-context"] });
      const tempId = brForm.id ?? `optimistic-${crypto.randomUUID()}`;
      const optimisticRow: any = {
        id: tempId,
        ...brForm,
        __optimistic: true,
      };
      const prevBranches = optimisticUpsert(["branches", "all"], optimisticRow);
      const prevCtx = qc.getQueryData<any>(["user-context"]);
      if (prevCtx) {
        qc.setQueryData(["user-context"], {
          ...prevCtx,
          branches: (() => {
            const list = prevCtx.branches ?? [];
            const idx = list.findIndex((x: any) => x.id === optimisticRow.id);
            if (idx >= 0) {
              const next = list.slice();
              next[idx] = { ...list[idx], ...optimisticRow };
              return next;
            }
            return [...list, optimisticRow];
          })(),
        });
      }
      setBrOpen(false);
      return { prevBranches, prevCtx, tempId };
    },
    onSuccess: (data: any, _vars, ctx) => {
      if (ctx?.tempId && data?.id && ctx.tempId !== data.id) {
        qc.setQueryData<any[]>(["branches", "all"], (old) =>
          (old ?? []).map((x) => (x.id === ctx.tempId ? data : x))
        );
      }
      const isNew = !brForm.id;
      const name = data?.name_ar || data?.name_en || brForm.name_ar || brForm.code;
      toast.success(
        isNew ? `تم إنشاء الفرع "${name}" بنجاح` : `تم تحديث الفرع "${name}" بنجاح`,
        {
          description: isNew
            ? "السبب: إضافة فرع جديد — تم تحديث منتقي الفروع في الـ Topbar والقوائم تلقائيًا."
            : "السبب: تعديل بيانات فرع — تم تحديث منتقي الفروع في الـ Topbar والقوائم تلقائيًا.",
        }
      );
    },
    onError: (e: Error, _vars, ctx) => {
      if (ctx?.prevBranches !== undefined)
        qc.setQueryData(["branches", "all"], ctx.prevBranches);
      if (ctx?.prevCtx !== undefined) qc.setQueryData(["user-context"], ctx.prevCtx);
      toast.error(e.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["branches"] });
      qc.invalidateQueries({ queryKey: ["user-context"] });
    },
  });


  const branchesByCompany = useMemo(() => {
    const m: Record<string, Branch[]> = {};
    for (const b of branches as Branch[]) {
      (m[b.company_id] ??= []).push(b);
    }
    return m;
  }, [branches]);

  // ===== Departments — independent org-chart tree, scoped to a COMPANY.
  // A branch is just an optional tag on a department, not a nesting scope
  // (mirrors the "HR & Personnel Request System" organization model). =====
  const [deptCompanyId, setDeptCompanyId] = useState<string>("");
  const activeDeptCompanyId = deptCompanyId || companies[0]?.id || "";

  const { data: departments = [] } = useQuery({
    queryKey: ["departments", activeDeptCompanyId],
    enabled: !!activeDeptCompanyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .eq("company_id", activeDeptCompanyId)
        .order("sort_order")
        .order("code");
      if (error) throw error;
      return data as any[];
    },
  });

  const companyBranches = useMemo(
    () => (branches as Branch[]).filter((b) => b.company_id === activeDeptCompanyId),
    [branches, activeDeptCompanyId]
  );

  const emptyDept = { company_id: "", branch_id: "", parent_id: "", code: "", name_ar: "", name_en: "", notes: "" };
  const [deptOpen, setDeptOpen] = useState(false);
  const [deptForm, setDeptForm] = useState<typeof emptyDept & { id?: string }>(emptyDept);

  const openDept = (parentId?: string, existing?: any) => {
    if (existing) {
      setDeptForm({
        id: existing.id,
        company_id: existing.company_id,
        branch_id: existing.branch_id ?? "",
        parent_id: existing.parent_id ?? "",
        code: existing.code ?? "",
        name_ar: existing.name_ar ?? "",
        name_en: existing.name_en ?? "",
        notes: existing.notes ?? "",
      });
    } else {
      setDeptForm({ ...emptyDept, company_id: activeDeptCompanyId, parent_id: parentId ?? "" });
    }
    setDeptOpen(true);
  };

  const deptMut = useMutation({
    mutationFn: async () => {
      const payload = {
        company_id: deptForm.company_id,
        branch_id: deptForm.branch_id || null,
        parent_id: deptForm.parent_id || null,
        code: deptForm.code,
        name_ar: deptForm.name_ar,
        name_en: deptForm.name_en,
        notes: deptForm.notes || null,
      };
      if (deptForm.id) {
        const { error } = await supabase.from("departments").update(payload).eq("id", deptForm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("departments").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(deptForm.id ? "تم تحديث الإدارة بنجاح" : "تم إنشاء الإدارة بنجاح");
      setDeptOpen(false);
      qc.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteDept = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("departments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("common.deleted"));
      qc.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deptTree = useMemo(() => {
    const byParent: Record<string, any[]> = {};
    for (const d of departments) {
      const key = d.parent_id ?? "root";
      (byParent[key] ??= []).push(d);
    }
    return byParent;
  }, [departments]);

  const reorderDept = useMutation({
    mutationFn: async ({ siblings, from, to }: { siblings: any[]; from: number; to: number }) => {
      const arr = siblings.slice();
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      for (let i = 0; i < arr.length; i++) {
        const { error } = await supabase.from("departments").update({ sort_order: i }).eq("id", arr[i].id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["departments"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const moveDept = (node: any, dir: -1 | 1) => {
    const siblings = deptTree[node.parent_id ?? "root"] ?? [];
    const idx = siblings.findIndex((x) => x.id === node.id);
    const to = idx + dir;
    if (to < 0 || to >= siblings.length) return;
    reorderDept.mutate({ siblings, from: idx, to });
  };

  // Who currently holds the "direct_manager" role scoped to this department
  // (read-only here — assigning approvers happens on a dedicated screen).
  const { data: directManagersByDept } = useQuery({
    queryKey: ["dept-direct-managers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approver_scopes")
        .select("user_id, scope_id")
        .eq("scope_type", "department")
        .eq("role", "direct_manager");
      if (error) throw error;
      const userIds = Array.from(new Set((data ?? []).map((r: any) => r.user_id)));
      const namesById = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, display_name_ar, display_name_en, email").in("id", userIds);
        for (const p of profs ?? []) {
          namesById.set(p.id, (p as any).display_name_ar || (p as any).display_name_en || (p as any).email);
        }
      }
      const map = new Map<string, string>();
      for (const r of data as any[]) {
        const name = namesById.get(r.user_id);
        if (name) map.set(r.scope_id, name);
      }
      return map;
    },
  });

  const canSaveDept = deptForm.company_id && deptForm.code && deptForm.name_ar && deptForm.name_en;


  const canSaveCompany = coForm.code && coForm.name_ar && coForm.name_en;
  const canSaveBranch = brForm.company_id && brForm.code && brForm.name_ar && brForm.name_en;

  if (companies.length === 0) {
    return (
      <div className="p-6">
        <Card className="p-10 text-center max-w-xl mx-auto">
          <Building2 className="h-12 w-12 mx-auto mb-4 text-primary" />
          <h2 className="text-xl font-bold mb-2">{t("nav.companiesBranches")}</h2>
          <p className="text-muted-foreground mb-6">{t("setup.subtitle")}</p>
          <Button asChild>
            <Link to="/setup">{t("setup.create")}</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{t("nav.companiesBranches")}</h1>
          <p className="text-sm text-muted-foreground">
            {companies.length} {t("nav.companies")} · {branches.length} {t("nav.branches")}
          </p>
        </div>
      </div>

      <Tabs defaultValue="companies">
        <TabsList>
          <TabsTrigger value="companies">
            <Building2 className="h-4 w-4 me-2" />
            {t("nav.companies")}
          </TabsTrigger>
          <TabsTrigger value="branches">
            <MapPin className="h-4 w-4 me-2" />
            {t("nav.branches")}
          </TabsTrigger>
          <TabsTrigger value="departments">
            <Network className="h-4 w-4 me-2" />
            {t("nav.departments")}
          </TabsTrigger>
        </TabsList>

        {/* COMPANIES TAB */}
        <TabsContent value="companies" className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => openCompany()}>
              <Plus className="h-4 w-4 me-1" />
              {t("common.new")} {t("nav.companies")}
            </Button>
          </div>
          <Card>
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="text-start p-3 font-medium">{t("common.code")}</th>
                  <th className="text-start p-3 font-medium">{t("common.name")}</th>
                  <th className="text-start p-3 font-medium">{t("setup.vatNumber")}</th>
                  <th className="text-start p-3 font-medium">{t("setup.crNumber")}</th>
                  <th className="text-center p-3 font-medium">{t("nav.branches")}</th>
                  <th className="text-center p-3 font-medium">{t("common.status")}</th>
                  <th className="text-end p-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c: Company) => (
                  <tr key={c.id} className="border-t hover:bg-muted/30">
                    <td className="p-3 font-mono">{c.code}</td>
                    <td className="p-3 font-medium">{localized(c, "name")}</td>
                    <td className="p-3 text-muted-foreground">{c.vat_number || "—"}</td>
                    <td className="p-3 text-muted-foreground">{c.cr_number || "—"}</td>
                    <td className="p-3 text-center">
                      <Badge variant="outline">
                        {branchesByCompany[c.id]?.length ?? 0}
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant={c.is_active ? "default" : "secondary"}>
                        {c.is_active ? t("common.active") : t("common.inactive")}
                      </Badge>
                    </td>
                    <td className="p-3 text-end">
                      <Button variant="ghost" size="sm" onClick={() => openCompany(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openBranch(undefined, c.id)}
                      >
                        <Plus className="h-3.5 w-3.5 me-1" />
                        {t("nav.branches")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        {/* BRANCHES TAB */}
        <TabsContent value="branches" className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => openBranch()}>
              <Plus className="h-4 w-4 me-1" />
              {t("common.new")} {t("nav.branches")}
            </Button>
          </div>
          <Card>
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="text-start p-3 font-medium">{t("nav.companies")}</th>
                  <th className="text-start p-3 font-medium">{t("common.code")}</th>
                  <th className="text-start p-3 font-medium">{t("common.name")}</th>
                  <th className="text-start p-3 font-medium">{t("common.phone")}</th>
                  <th className="text-center p-3 font-medium">{t("common.mainBranch")}</th>
                  <th className="text-center p-3 font-medium">{t("common.status")}</th>
                  <th className="text-end p-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {(branches as Branch[]).map((b) => {
                  const co = companies.find((c: Company) => c.id === b.company_id);
                  return (
                    <tr key={b.id} className="border-t hover:bg-muted/30">
                      <td className="p-3 text-muted-foreground">
                        {co ? localized(co, "name") : "—"}
                      </td>
                      <td className="p-3 font-mono">{b.code}</td>
                      <td className="p-3 font-medium">{localized(b, "name")}</td>
                      <td className="p-3 text-muted-foreground">{b.phone || "—"}</td>
                      <td className="p-3 text-center">{b.is_main ? "★" : ""}</td>
                      <td className="p-3 text-center">
                        <Badge variant={b.is_active ? "default" : "secondary"}>
                          {b.is_active ? t("common.active") : t("common.inactive")}
                        </Badge>
                      </td>
                      <td className="p-3 text-end">
                        <Button variant="ghost" size="sm" onClick={() => openBranch(b)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {branches.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      {t("common.noData")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        {/* DEPARTMENTS TAB */}
        <TabsContent value="departments" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="w-64">
              <Select value={activeDeptCompanyId} onValueChange={setDeptCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("nav.companies")} />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c: Company) => (
                    <SelectItem key={c.id} value={c.id}>
                      {localized(c, "name")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => openDept()} disabled={!activeDeptCompanyId}>
              <Plus className="h-4 w-4 me-1" />
              {t("common.new")} {t("nav.departments")}
            </Button>
          </div>

          <Card className="p-2">
            {(deptTree["root"] ?? []).length === 0 && (
              <p className="p-8 text-center text-muted-foreground text-sm">{t("common.noData")}</p>
            )}
            <div className="space-y-0.5">
              {(deptTree["root"] ?? []).map((d, i, arr) => (
                <DepartmentNode
                  key={d.id}
                  node={d}
                  depth={0}
                  index={i}
                  siblingCount={arr.length}
                  tree={deptTree}
                  branches={companyBranches}
                  directManagersByDept={directManagersByDept}
                  localized={localized}
                  t={t}
                  onAdd={openDept}
                  onEdit={(n) => openDept(undefined, n)}
                  onDelete={(id) => deleteDept.mutate(id)}
                  onMove={moveDept}
                />
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DEPARTMENT DIALOG */}
      <Dialog open={deptOpen} onOpenChange={setDeptOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {deptForm.id ? t("common.edit") : t("common.new")} {deptForm.parent_id ? t("common.subDepartment") : t("nav.departments")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("common.name")} (EN)</Label>
                <Input value={deptForm.name_en} onChange={(e) => setDeptForm((f) => ({ ...f, name_en: e.target.value }))} dir="ltr" />
              </div>
              <div>
                <Label>{t("common.name")} (AR)</Label>
                <Input value={deptForm.name_ar} onChange={(e) => setDeptForm((f) => ({ ...f, name_ar: e.target.value }))} dir="rtl" />
              </div>
            </div>
            <div>
              <Label>{t("common.code")}</Label>
              <Input value={deptForm.code} onChange={(e) => setDeptForm((f) => ({ ...f, code: e.target.value }))} />
            </div>
            <div>
              <Label>{t("common.parentDepartment")}</Label>
              <Select
                value={deptForm.parent_id || "__top__"}
                onValueChange={(v) => setDeptForm((f) => ({ ...f, parent_id: v === "__top__" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__top__">{t("common.topLevel")}</SelectItem>
                  {departments
                    .filter((d) => d.id !== deptForm.id) // can't be its own parent
                    .map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {localized(d, "name")}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("nav.branches")}</Label>
              <Select value={deptForm.branch_id || "__none__"} onValueChange={(v) => setDeptForm((f) => ({ ...f, branch_id: v === "__none__" ? "" : v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("common.noBranch")}</SelectItem>
                  {companyBranches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {localized(b, "name")} / {b.name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Direct Manager — read-only here; assigned from the approvers screen */}
            <div className="space-y-1.5 rounded-md border bg-muted/20 p-3">
              <div className="text-xs font-semibold">{t("common.directManagerOfDepartment")}</div>
              <p className="text-[11px] text-muted-foreground">{t("common.directManagerHint")}</p>
              {!deptForm.id ? (
                <p className="text-[11px] text-muted-foreground">{t("common.saveDeptFirstHint")}</p>
              ) : (
                <p className="text-sm font-medium">
                  {directManagersByDept?.get(deptForm.id) ?? (
                    <span className="text-muted-foreground font-normal">{t("common.noDirectManagerAssigned")}</span>
                  )}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeptOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => deptMut.mutate()} disabled={!canSaveDept || deptMut.isPending}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={coOpen} onOpenChange={setCoOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {coForm.id ? t("common.edit") : t("common.new")} — {t("nav.companies")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("common.code")} required value={coForm.code} onChange={(v) => setCoForm({ ...coForm, code: v })} />
            <Field label={t("common.name") + " (AR)"} required value={coForm.name_ar} onChange={(v) => setCoForm({ ...coForm, name_ar: v })} />
            <Field label={t("common.name") + " (EN)"} required value={coForm.name_en} onChange={(v) => setCoForm({ ...coForm, name_en: v })} dir="ltr" />
            <Field label={t("common.currency")} value={coForm.default_currency} onChange={(v) => setCoForm({ ...coForm, default_currency: v.toUpperCase() })} dir="ltr" />
            <Field label={t("setup.vatNumber")} value={coForm.vat_number} onChange={(v) => setCoForm({ ...coForm, vat_number: v })} dir="ltr" />
            <Field label={t("setup.crNumber")} value={coForm.cr_number} onChange={(v) => setCoForm({ ...coForm, cr_number: v })} dir="ltr" />
            <Field label={t("common.email")} type="email" value={coForm.email} onChange={(v) => setCoForm({ ...coForm, email: v })} dir="ltr" />
            <Field label={t("common.phone")} value={coForm.phone} onChange={(v) => setCoForm({ ...coForm, phone: v })} dir="ltr" />
            <Field label={t("common.website")} value={coForm.website} onChange={(v) => setCoForm({ ...coForm, website: v })} dir="ltr" />
            <div>
              <Label className="text-xs">{t("setup.fyStartMonth")}</Label>
              <Select
                value={String(coForm.fiscal_year_start_month)}
                onValueChange={(v) => setCoForm({ ...coForm, fiscal_year_start_month: Number(v) })}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={String(m)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Field label={t("setup.address") + " (AR)"} value={coForm.address_ar} onChange={(v) => setCoForm({ ...coForm, address_ar: v })} />
            </div>
            <div className="col-span-2">
              <Field label={t("setup.address") + " (EN)"} value={coForm.address_en} onChange={(v) => setCoForm({ ...coForm, address_en: v })} dir="ltr" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCoOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => coMut.mutate()} disabled={!canSaveCompany || coMut.isPending}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BRANCH DIALOG */}
      <Dialog open={brOpen} onOpenChange={setBrOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {brForm.id ? t("common.edit") : t("common.new")} — {t("nav.branches")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">{t("nav.companies")} *</Label>
              <Select
                value={brForm.company_id}
                onValueChange={(v) => setBrForm({ ...brForm, company_id: v })}
                disabled={!!brForm.id}
              >
                <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {companies.map((c: Company) => (
                    <SelectItem key={c.id} value={c.id}>{c.code} — {localized(c, "name")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field label={t("common.code")} required value={brForm.code} onChange={(v) => setBrForm({ ...brForm, code: v })} />
            <Field label={t("common.phone")} value={brForm.phone ?? ""} onChange={(v) => setBrForm({ ...brForm, phone: v })} dir="ltr" />
            <Field label={t("common.name") + " (AR)"} required value={brForm.name_ar} onChange={(v) => setBrForm({ ...brForm, name_ar: v })} />
            <Field label={t("common.name") + " (EN)"} required value={brForm.name_en} onChange={(v) => setBrForm({ ...brForm, name_en: v })} dir="ltr" />
            <Field label={t("setup.crNumber")} value={brForm.cr_number ?? ""} onChange={(v) => setBrForm({ ...brForm, cr_number: v })} dir="ltr" />
            <div className="col-span-2">
              <Field label={t("setup.address")} value={brForm.address_ar ?? ""} onChange={(v) => setBrForm({ ...brForm, address_ar: v })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={brForm.is_main} onCheckedChange={(v) => setBrForm({ ...brForm, is_main: v })} />
              <Label>{t("common.mainBranch")}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={brForm.is_active} onCheckedChange={(v) => setBrForm({ ...brForm, is_active: v })} />
              <Label>{t("common.active")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBrOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => brMut.mutate()} disabled={!canSaveBranch || brMut.isPending}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  dir,
  type,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (v: string) => void;
  required?: boolean;
  dir?: string;
  type?: string;
}) {
  return (
    <div>
      <Label className="text-xs">
        {label}
        {required && <span className="text-destructive ms-1">*</span>}
      </Label>
      <Input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        dir={dir}
        type={type ?? "text"}
        className="h-9"
      />
    </div>
  );
}

/** One row in the departments tree, recursively rendering its children. */
function DepartmentNode({
  node,
  depth,
  index,
  siblingCount,
  tree,
  branches,
  directManagersByDept,
  localized,
  t,
  onAdd,
  onEdit,
  onDelete,
  onMove,
}: {
  node: any;
  depth: number;
  index: number;
  siblingCount: number;
  tree: Record<string, any[]>;
  branches: any[];
  directManagersByDept?: Map<string, string>;
  localized: (row: any, base: string) => string;
  t: (k: string) => string;
  onAdd: (parentId?: string) => void;
  onEdit: (node: any) => void;
  onDelete: (id: string) => void;
  onMove: (node: any, dir: -1 | 1) => void;
}) {
  const [open, setOpen] = useState(true);
  const children = tree[node.id] ?? [];
  const hasChildren = children.length > 0;
  const branch = node.branch_id ? branches.find((b) => b.id === node.branch_id) : null;
  const manager = directManagersByDept?.get(node.id);

  return (
    <div>
      <div
        className="flex items-center gap-1.5 rounded-md px-2 py-2 hover:bg-muted/40 group"
        style={{ paddingInlineStart: `${8 + depth * 22}px` }}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={"h-5 w-5 flex items-center justify-center shrink-0 rounded " + (hasChildren ? "text-muted-foreground hover:bg-muted" : "opacity-0 pointer-events-none")}
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>

        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{localized(node, "name")}</span>
          <span className="text-xs text-muted-foreground font-mono">{node.code}</span>
          {branch && (
            <span className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-1.5 py-0.5 text-[10.5px] text-muted-foreground">
              <MapPin className="h-2.5 w-2.5" />
              {localized(branch, "name")}
            </span>
          )}
          {manager && (
            <span className="inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary/5 px-1.5 py-0.5 text-[10.5px] text-primary">
              {manager}
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button variant="ghost" size="icon" className="h-6 w-6" disabled={index <= 0} onClick={() => onMove(node, -1)} title={t("common.moveUp")}>
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" disabled={index >= siblingCount - 1} onClick={() => onMove(node, 1)} title={t("common.moveDown")}>
            <ChevronDown className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => onAdd(node.id)}>
            <Plus className="h-3 w-3 me-1" />
            {t("common.subDepartment")}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 p-0" onClick={() => onEdit(node)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 p-0 text-destructive" onClick={() => onDelete(node.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {open && hasChildren && (
        <div>
          {children.map((child, i) => (
            <DepartmentNode
              key={child.id}
              node={child}
              depth={depth + 1}
              index={i}
              siblingCount={children.length}
              tree={tree}
              branches={branches}
              directManagersByDept={directManagersByDept}
              localized={localized}
              t={t}
              onAdd={onAdd}
              onEdit={onEdit}
              onDelete={onDelete}
              onMove={onMove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
