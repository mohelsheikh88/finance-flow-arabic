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
import { Plus, Building2, MapPin, Pencil } from "lucide-react";
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

  const coMut = useMutation({
    mutationFn: async () => {
      const { id, ...payload } = coForm;
      if (id) return updateCompanyFn({ data: { id, ...payload } });
      return createCompanyFn({ data: payload });
    },
    onSuccess: (_data, _vars, _ctx) => {
      const isNew = !coForm.id;
      const name = coForm.name_ar || coForm.name_en || coForm.code;
      toast.success(
        isNew ? `تم إنشاء الشركة "${name}" بنجاح` : `تم تحديث الشركة "${name}" بنجاح`,
        {
          description: isNew
            ? "السبب: إضافة شركة جديدة — تم تحديث القوائم المنسدلة (Topbar/Sidebar) تلقائيًا."
            : "السبب: تعديل بيانات شركة — تم تحديث القوائم المنسدلة (Topbar/Sidebar) تلقائيًا.",
        }
      );
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["user-context"] });
      setCoOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
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
    onSuccess: () => {
      const isNew = !brForm.id;
      const name = brForm.name_ar || brForm.name_en || brForm.code;
      toast.success(
        isNew ? `تم إنشاء الفرع "${name}" بنجاح` : `تم تحديث الفرع "${name}" بنجاح`,
        {
          description: isNew
            ? "السبب: إضافة فرع جديد — تم تحديث منتقي الفروع في الـ Topbar والقوائم تلقائيًا."
            : "السبب: تعديل بيانات فرع — تم تحديث منتقي الفروع في الـ Topbar والقوائم تلقائيًا.",
        }
      );
      qc.invalidateQueries({ queryKey: ["branches"] });
      qc.invalidateQueries({ queryKey: ["user-context"] });
      setBrOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const branchesByCompany = useMemo(() => {
    const m: Record<string, Branch[]> = {};
    for (const b of branches as Branch[]) {
      (m[b.company_id] ??= []).push(b);
    }
    return m;
  }, [branches]);

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
          <h1 className="text-2xl font-bold">{t("nav.companiesBranches")}</h1>
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
                  <th className="text-start p-3 font-medium">Phone</th>
                  <th className="text-center p-3 font-medium">Main</th>
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
      </Tabs>

      {/* COMPANY DIALOG */}
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
            <Field label="Currency" value={coForm.default_currency} onChange={(v) => setCoForm({ ...coForm, default_currency: v.toUpperCase() })} dir="ltr" />
            <Field label={t("setup.vatNumber")} value={coForm.vat_number} onChange={(v) => setCoForm({ ...coForm, vat_number: v })} dir="ltr" />
            <Field label={t("setup.crNumber")} value={coForm.cr_number} onChange={(v) => setCoForm({ ...coForm, cr_number: v })} dir="ltr" />
            <Field label="Email" type="email" value={coForm.email} onChange={(v) => setCoForm({ ...coForm, email: v })} dir="ltr" />
            <Field label="Phone" value={coForm.phone} onChange={(v) => setCoForm({ ...coForm, phone: v })} dir="ltr" />
            <Field label="Website" value={coForm.website} onChange={(v) => setCoForm({ ...coForm, website: v })} dir="ltr" />
            <div>
              <Label className="text-xs">FY Start Month</Label>
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
            <Field label="Phone" value={brForm.phone ?? ""} onChange={(v) => setBrForm({ ...brForm, phone: v })} dir="ltr" />
            <Field label={t("common.name") + " (AR)"} required value={brForm.name_ar} onChange={(v) => setBrForm({ ...brForm, name_ar: v })} />
            <Field label={t("common.name") + " (EN)"} required value={brForm.name_en} onChange={(v) => setBrForm({ ...brForm, name_en: v })} dir="ltr" />
            <div className="col-span-2">
              <Field label={t("setup.address")} value={brForm.address_ar ?? ""} onChange={(v) => setBrForm({ ...brForm, address_ar: v })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={brForm.is_main} onCheckedChange={(v) => setBrForm({ ...brForm, is_main: v })} />
              <Label>Main Branch</Label>
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
