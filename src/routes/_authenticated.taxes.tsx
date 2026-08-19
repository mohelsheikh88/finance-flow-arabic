import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTaxes, upsertTax, deleteTax, toggleTaxActive } from "@/lib/api/vat.functions";
import { listAccounts } from "@/lib/api/accounting.functions";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AccountCombobox } from "@/components/account-combobox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Pencil, Trash2, Percent, Scale, FileBarChart, Calendar,
  TrendingUp, TrendingDown, Search,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/taxes")({
  component: TaxesPage,
});

type TaxRow = {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  rate: number;
  tax_type: "sale" | "purchase";
  account_id: string | null;
  is_active: boolean;
};

type FormState = {
  id?: string;
  code: string;
  name_ar: string;
  name_en: string;
  tax_type: "sale" | "purchase";
  rate: string;
  account_id: string | null;
  is_active: boolean;
};

const EMPTY: FormState = {
  code: "",
  name_ar: "",
  name_en: "",
  tax_type: "sale",
  rate: "15",
  account_id: null,
  is_active: true,
};

function TaxesPage() {
  const { t, locale } = useI18n();
  const isRtl = locale === "ar";
  const localized = useLocalized();
  const { companyId } = useBranch();
  const { user } = useAuth();
  const qc = useQueryClient();

  const list = useServerFn(listTaxes);
  const accountsFn = useServerFn(listAccounts);
  const save = useServerFn(upsertTax);
  const remove = useServerFn(deleteTax);
  const toggle = useServerFn(toggleTaxActive);

  const { data: taxes = [], isLoading } = useQuery({
    queryKey: ["taxes", companyId],
    queryFn: () => list({ data: { companyId: companyId! } }),
    enabled: !!user && !!companyId,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts-all", companyId],
    queryFn: () => accountsFn({ data: { companyId: companyId! } }),
    enabled: !!user && !!companyId,
  });

  const [tab, setTab] = useState<"all" | "sale" | "purchase">("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [confirmDel, setConfirmDel] = useState<TaxRow | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (taxes as TaxRow[])
      .filter((r) => tab === "all" || r.tax_type === tab)
      .filter((r) =>
        !q
          ? true
          : r.code.toLowerCase().includes(q) ||
            r.name_ar.toLowerCase().includes(q) ||
            r.name_en.toLowerCase().includes(q),
      );
  }, [taxes, tab, search]);

  const stats = useMemo(() => {
    const all = taxes as TaxRow[];
    return {
      total: all.length,
      sale: all.filter((r) => r.tax_type === "sale").length,
      purchase: all.filter((r) => r.tax_type === "purchase").length,
      active: all.filter((r) => r.is_active).length,
    };
  }, [taxes]);

  const saveMut = useMutation({
    mutationFn: () =>
      save({
        data: {
          ...(form.id ? { id: form.id } : {}),
          company_id: companyId!,
          code: form.code,
          name_ar: form.name_ar,
          name_en: form.name_en,
          tax_type: form.tax_type,
          rate: Number(form.rate),
          account_id: form.account_id,
          is_active: form.is_active,
        },
      }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["taxes"] });
      setOpen(false);
      setForm(EMPTY);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: (r: TaxRow) => toggle({ data: { id: r.id, is_active: !r.is_active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["taxes"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success(t("common.deleted"));
      qc.invalidateQueries({ queryKey: ["taxes"] });
      setConfirmDel(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => {
    setForm(EMPTY);
    setOpen(true);
  };
  const openEdit = (r: TaxRow) => {
    setForm({
      id: r.id,
      code: r.code,
      name_ar: r.name_ar,
      name_en: r.name_en,
      tax_type: r.tax_type,
      rate: String(r.rate),
      account_id: r.account_id,
      is_active: r.is_active,
    });
    setOpen(true);
  };

  const taxAccounts = (accounts as Array<{ id: string; code: string; name_ar: string; name_en: string; is_group: boolean }>)
    .filter((a) => !a.is_group);


  return (
    <div className="p-6 space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Percent className="h-6 w-6 text-primary" />
            {isRtl ? "أنواع الضرائب والزكاة" : "Tax & Zakat Settings"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isRtl
              ? "مركز إعدادات الضرائب والزكاة — معدلات، مواقع ضريبية، تقارير، فترات مالية"
              : "Tax & Zakat configuration hub — rates, fiscal positions, reports, periods"}
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          {isRtl ? "ضريبة جديدة" : "New Tax"}
        </Button>
      </div>

      {/* Quick-access tools */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Percent}
          label={isRtl ? "إجمالي الأنواع" : "Total Taxes"}
          value={stats.total}
          hint={`${stats.active} ${isRtl ? "نشط" : "active"}`}
          tone="primary"
        />
        <StatCard
          icon={TrendingUp}
          label={isRtl ? "ضرائب المبيعات" : "Output (Sales)"}
          value={stats.sale}
          tone="emerald"
        />
        <StatCard
          icon={TrendingDown}
          label={isRtl ? "ضرائب المشتريات" : "Input (Purchases)"}
          value={stats.purchase}
          tone="sky"
        />
        <Card className="p-4 hover:shadow-md transition-shadow">
          <div className="text-xs font-medium text-muted-foreground mb-2">
            {isRtl ? "إجراءات سريعة" : "Quick Actions"}
          </div>
          <div className="flex flex-wrap gap-2">
            <ToolLink to="/fiscal-positions" icon={Scale} label={isRtl ? "المواقع الضريبية" : "Fiscal Positions"} />
            <ToolLink to="/reports/vat" icon={FileBarChart} label={isRtl ? "تقرير الضريبة" : "VAT Report"} />
            <ToolLink to="/fiscal-periods" icon={Calendar} label={isRtl ? "الفترات المالية" : "Fiscal Periods"} />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="all">{isRtl ? "الكل" : "All"} ({stats.total})</TabsTrigger>
              <TabsTrigger value="sale">{isRtl ? "مبيعات" : "Sales"} ({stats.sale})</TabsTrigger>
              <TabsTrigger value="purchase">{isRtl ? "مشتريات" : "Purchases"} ({stats.purchase})</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:w-72">
            <Search className="absolute top-2.5 start-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isRtl ? "بحث بالكود أو الاسم..." : "Search by code or name..."}
              className="ps-9"
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">{isRtl ? "الكود" : "Code"}</TableHead>
              <TableHead>{isRtl ? "الاسم" : "Name"}</TableHead>
              <TableHead className="w-32">{isRtl ? "النوع" : "Type"}</TableHead>
              <TableHead className="w-24 text-end">{isRtl ? "المعدل" : "Rate"}</TableHead>
              <TableHead>{isRtl ? "حساب الضريبة" : "Tax Account"}</TableHead>
              <TableHead className="w-24 text-center">{isRtl ? "نشط" : "Active"}</TableHead>
              <TableHead className="w-28 text-end">{isRtl ? "إجراءات" : "Actions"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {isRtl ? "جاري التحميل..." : "Loading..."}
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <Percent className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                  <div className="text-muted-foreground">
                    {isRtl ? "لا توجد ضرائب — أضف ضريبة جديدة للبدء" : "No taxes yet — add one to get started"}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => {
                const acc = taxAccounts.find((a) => a.id === r.account_id);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">{r.code}</TableCell>
                    <TableCell className="font-medium">
                      {localized(r, "name")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.tax_type === "sale" ? "default" : "secondary"} className="gap-1">
                        {r.tax_type === "sale"
                          ? <TrendingUp className="h-3 w-3" />
                          : <TrendingDown className="h-3 w-3" />}
                        {r.tax_type === "sale"
                          ? (isRtl ? "مبيعات" : "Sale")
                          : (isRtl ? "مشتريات" : "Purchase")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end font-mono tabular-nums">
                      {Number(r.rate).toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {acc ? `${acc.code} — ${localized(acc, "name")}` : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={r.is_active}
                        onCheckedChange={() => toggleMut.mutate(r)}
                      />
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setConfirmDel(r)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl" dir={isRtl ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>
              {form.id
                ? (isRtl ? "تعديل ضريبة" : "Edit Tax")
                : (isRtl ? "ضريبة جديدة" : "New Tax")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>{isRtl ? "الكود" : "Code"} *</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="VAT15"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{isRtl ? "النوع" : "Type"} *</Label>
              <Select
                value={form.tax_type}
                onValueChange={(v) => setForm({ ...form, tax_type: v as "sale" | "purchase" })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sale">{isRtl ? "مبيعات (مخرجات)" : "Sale (Output)"}</SelectItem>
                  <SelectItem value="purchase">{isRtl ? "مشتريات (مدخلات)" : "Purchase (Input)"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{isRtl ? "الاسم بالعربية" : "Name (Arabic)"} *</Label>
              <Input
                value={form.name_ar}
                onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
                placeholder="ضريبة القيمة المضافة 15%"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{isRtl ? "الاسم بالإنجليزية" : "Name (English)"} *</Label>
              <Input
                value={form.name_en}
                onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                placeholder="VAT 15%"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{isRtl ? "المعدل (%)" : "Rate (%)"} *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.rate}
                onChange={(e) => setForm({ ...form, rate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{isRtl ? "حساب الضريبة" : "Tax Account"}</Label>
              <AccountCombobox
                accounts={taxAccounts}
                value={form.account_id}
                onChange={(v) => setForm({ ...form, account_id: v })}
                placeholder={isRtl ? "اختر حساب..." : "Select account..."}
              />
            </div>
            <div className="col-span-2 flex items-center gap-3 pt-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
              <Label className="cursor-pointer" onClick={() => setForm({ ...form, is_active: !form.is_active })}>
                {isRtl ? "نشط" : "Active"}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {isRtl ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={() => saveMut.mutate()}
              disabled={
                saveMut.isPending ||
                !form.code.trim() ||
                !form.name_ar.trim() ||
                !form.name_en.trim() ||
                !form.rate
              }
            >
              {saveMut.isPending
                ? (isRtl ? "جاري الحفظ..." : "Saving...")
                : (isRtl ? "حفظ" : "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent dir={isRtl ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{isRtl ? "حذف الضريبة؟" : "Delete tax?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isRtl
                ? `سيتم حذف "${confirmDel ? localized(confirmDel, "name") : ""}" نهائياً. لا يمكن الحذف إذا كانت الضريبة مستخدمة في فواتير أو قيود.`
                : `"${confirmDel ? localized(confirmDel, "name") : ""}" will be permanently deleted. Cannot delete if used in invoices or journals.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRtl ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDel && deleteMut.mutate(confirmDel.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRtl ? "حذف" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, hint, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  hint?: string;
  tone: "primary" | "emerald" | "sky";
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  };
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
      </div>
    </Card>
  );
}

function ToolLink({
  to, icon: Icon, label,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}
