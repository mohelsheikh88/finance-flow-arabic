import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listFiscalPeriods,
  upsertFiscalPeriod,
  setFiscalPeriodStatus,
  deleteFiscalPeriod,
  generateFiscalYearPeriods,
} from "@/lib/api/fiscal-periods.functions";
import {
  listLockDates, createLockDate, updateLockDate, deleteLockDate,
} from "@/lib/api/lock-dates.functions";
import { formatLockError } from "@/lib/lock-error";


import { useBranch } from "@/lib/branch-context";
import { useI18n } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Calendar, Plus, Pencil, Trash2, Sparkles, Lock, LockOpen, ShieldCheck,
  CalendarDays, CalendarRange, CalendarClock, FileBarChart, Search,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/fiscal-periods")({
  component: FiscalPeriodsPage,
});

type Status = "open" | "closed" | "locked";
type PeriodRow = {
  id: string;
  name: string;
  date_from: string;
  date_to: string;
  status: Status;
};

type FormState = {
  id?: string;
  name: string;
  date_from: string;
  date_to: string;
  status: Status;
};

const EMPTY_FORM: FormState = {
  name: "",
  date_from: "",
  date_to: "",
  status: "open",
};

const STATUS_BADGE: Record<Status, { ar: string; en: string; cls: string; icon: typeof Lock }> = {
  open: {
    ar: "مفتوحة", en: "Open",
    cls: "bg-success/10 text-success border-success/30",
    icon: LockOpen,
  },
  closed: {
    ar: "مقفلة", en: "Closed",
    cls: "bg-warning/10 text-warning border-warning/30",
    icon: Lock,
  },
  locked: {
    ar: "محجوزة", en: "Locked",
    cls: "bg-destructive/10 text-destructive border-destructive/30",
    icon: ShieldCheck,
  },
};

function FiscalPeriodsPage() {
  const { t, locale } = useI18n();
  const isAr = locale === "ar";
  const { companyId } = useBranch();
  const qc = useQueryClient();

  const list = useServerFn(listFiscalPeriods);
  const save = useServerFn(upsertFiscalPeriod);
  const setStatus = useServerFn(setFiscalPeriodStatus);
  const remove = useServerFn(deleteFiscalPeriod);
  const generate = useServerFn(generateFiscalYearPeriods);

  const { data: rows = [], isLoading } = useQuery<PeriodRow[]>({
    queryKey: ["fiscal_periods", companyId],
    queryFn: () => list({ data: { companyId: companyId! } }) as any,
    enabled: !!companyId,
  });

  // ---------- Filters ----------
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");

  const filtered = useMemo(() => {
    const txt = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (txt && !r.name.toLowerCase().includes(txt)) return false;
      return true;
    });
  }, [rows, search, statusFilter]);

  // ---------- Stats ----------
  const today = new Date().toISOString().slice(0, 10);
  const stats = useMemo(() => {
    const open = rows.filter((r) => r.status === "open").length;
    const closed = rows.filter((r) => r.status === "closed").length;
    const locked = rows.filter((r) => r.status === "locked").length;
    const current = rows.find((r) => r.date_from <= today && r.date_to >= today);
    return { total: rows.length, open, closed, locked, current };
  }, [rows, today]);

  // ---------- Create/Edit dialog ----------
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setOpen(true);
  };
  const openEdit = (p: PeriodRow) => {
    setForm({
      id: p.id,
      name: p.name,
      date_from: p.date_from,
      date_to: p.date_to,
      status: p.status,
    });
    setOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: () =>
      save({
        data: {
          id: form.id,
          company_id: companyId!,
          name: form.name.trim(),
          date_from: form.date_from,
          date_to: form.date_to,
          status: form.status,
        },
      }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["fiscal_periods"] });
      setOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: (v: { id: string; status: Status }) => setStatus({ data: v }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["fiscal_periods"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [delId, setDelId] = useState<string | null>(null);
  const removeMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["fiscal_periods"] });
      setDelId(null);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setDelId(null);
    },
  });

  // ---------- Generate dialog ----------
  const [genOpen, setGenOpen] = useState(false);
  const currentYear = new Date().getFullYear();
  const [genForm, setGenForm] = useState({
    year: currentYear,
    start_month: 1,
    frequency: "monthly" as "monthly" | "quarterly" | "yearly",
    prefix: "FY",
  });

  const generateMut = useMutation({
    mutationFn: () =>
      generate({
        data: {
          company_id: companyId!,
          year: genForm.year,
          start_month: genForm.start_month,
          frequency: genForm.frequency,
          prefix: genForm.prefix,
        },
      }),
    onSuccess: (res: any) => {
      toast.success(isAr ? `تم إنشاء ${res.created} فترة` : `Created ${res.created} period(s)`);
      qc.invalidateQueries({ queryKey: ["fiscal_periods"] });
      setGenOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---------- Lock Date (single, company-wide) ----------
  const listLD = useServerFn(listLockDates);
  const createLD = useServerFn(createLockDate);
  const updateLD = useServerFn(updateLockDate);
  const removeLD = useServerFn(deleteLockDate);

  const { data: lockRows = [] } = useQuery({
    queryKey: ["lock_dates", companyId],
    queryFn: () => listLD({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  // The single company-wide lock row (branch_id null). Pick the latest if multiple exist.
  const currentLock = useMemo(() => {
    const rows = (lockRows as any[]).filter((r) => !r.branch_id);
    if (rows.length === 0) return null;
    return rows.slice().sort((a, b) => (a.lock_date < b.lock_date ? 1 : -1))[0];
  }, [lockRows]);

  const [ldEditOpen, setLdEditOpen] = useState(false);
  const [ldDate, setLdDate] = useState<string>("");
  const [ldNotes, setLdNotes] = useState<string>("");

  // Keep inputs in sync with current value when it loads/changes
  useMemo(() => {
    setLdDate(currentLock?.lock_date ?? "");
    setLdNotes(currentLock?.notes ?? "");
  }, [currentLock?.id]);

  const ldSaveMut = useMutation({
    mutationFn: async () => {
      // Cleanup: delete any extra company-wide rows so only one remains
      const extras = (lockRows as any[]).filter(
        (r) => !r.branch_id && r.id !== currentLock?.id,
      );
      for (const r of extras) {
        await removeLD({ data: { id: r.id } });
      }
      if (currentLock) {
        return updateLD({ data: { id: currentLock.id, branch_id: null, lock_date: ldDate, notes: ldNotes || null } });
      }
      return createLD({ data: { company_id: companyId!, branch_id: null, lock_date: ldDate, notes: ldNotes || null } });
    },
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["lock_dates"] });
      setLdEditOpen(false);
    },
    onError: (e: Error) => toast.error(formatLockError(e, t)),
  });

  const canSaveLD = !!ldDate && (ldDate !== (currentLock?.lock_date ?? "") || (ldNotes || "") !== (currentLock?.notes ?? ""));





  const canSave = !!(form.name && form.date_from && form.date_to && companyId);
  const monthsLabels = isAr
    ? ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"]
    : ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">
            <Calendar className="h-5 w-5" />
            {isAr ? "الفترات المالية" : "Fiscal Periods"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAr
              ? "إدارة السنة المالية وفتراتها (شهرية / ربع سنوية / سنوية) وحالاتها"
              : "Manage fiscal year periods (monthly / quarterly / yearly) and their status"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setGenOpen(true)}>
            <Sparkles className="h-4 w-4 me-1" />
            {isAr ? "إنشاء فترات سنة" : "Generate Year"}
          </Button>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 me-1" />
            {isAr ? "فترة جديدة" : "New Period"}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{isAr ? "إجمالي الفترات" : "Total Periods"}</p>
              <p className="text-2xl font-semibold mt-1">{stats.total}</p>
            </div>
            <CalendarDays className="h-8 w-8 text-muted-foreground/40" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{isAr ? "مفتوحة" : "Open"}</p>
              <p className="text-2xl font-semibold mt-1 text-success">{stats.open}</p>
            </div>
            <LockOpen className="h-8 w-8 text-success/40" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{isAr ? "مقفلة" : "Closed"}</p>
              <p className="text-2xl font-semibold mt-1 text-warning">{stats.closed}</p>
            </div>
            <Lock className="h-8 w-8 text-warning/40" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{isAr ? "محجوزة" : "Locked"}</p>
              <p className="text-2xl font-semibold mt-1 text-destructive">{stats.locked}</p>
            </div>
            <ShieldCheck className="h-8 w-8 text-destructive/40" />
          </div>
        </Card>
      </div>

      {/* Current period spotlight */}
      {stats.current && (
        <Card className="p-4 border-primary/30 bg-primary/5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary grid place-items-center">
                <CalendarClock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{isAr ? "الفترة الحالية" : "Current Period"}</p>
                <p className="font-semibold">{stats.current.name}</p>
                <p className="text-xs text-muted-foreground">
                  {stats.current.date_from} → {stats.current.date_to}
                </p>
              </div>
            </div>
            <Badge variant="outline" className={STATUS_BADGE[stats.current.status].cls}>
              {isAr ? STATUS_BADGE[stats.current.status].ar : STATUS_BADGE[stats.current.status].en}
            </Badge>
          </div>
        </Card>
      )}

      {/* Quick links */}
      <Card className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
          {isAr ? "أدوات مرتبطة" : "Related Tools"}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => document.getElementById("lock-dates-section")?.scrollIntoView({ behavior: "smooth" })}
          >
            <Lock className="h-4 w-4 me-1" />
            {isAr ? "تواريخ الإقفال" : "Lock Dates"}
          </Button>

          <Link to="/companies">
            <Button variant="outline" size="sm">
              <CalendarRange className="h-4 w-4 me-1" />
              {isAr ? "بداية السنة المالية" : "Fiscal Year Setup"}
            </Button>
          </Link>
          <Link to="/reports">
            <Button variant="outline" size="sm">
              <FileBarChart className="h-4 w-4 me-1" />
              {isAr ? "التقارير" : "Reports"}
            </Button>
          </Link>
        </div>
      </Card>

      {/* Filters + Table */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="h-4 w-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={isAr ? "بحث بالاسم..." : "Search by name..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isAr ? "كل الحالات" : "All Statuses"}</SelectItem>
              <SelectItem value="open">{isAr ? "مفتوحة" : "Open"}</SelectItem>
              <SelectItem value="closed">{isAr ? "مقفلة" : "Closed"}</SelectItem>
              <SelectItem value="locked">{isAr ? "محجوزة" : "Locked"}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{isAr ? "الاسم" : "Name"}</TableHead>
                <TableHead>{isAr ? "من تاريخ" : "From"}</TableHead>
                <TableHead>{isAr ? "إلى تاريخ" : "To"}</TableHead>
                <TableHead>{isAr ? "المدة" : "Duration"}</TableHead>
                <TableHead>{isAr ? "الحالة" : "Status"}</TableHead>
                <TableHead className="text-end">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {t("common.loading")}
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {t("common.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => {
                  const B = STATUS_BADGE[p.status];
                  const days =
                    Math.round(
                      (new Date(p.date_to).getTime() - new Date(p.date_from).getTime()) /
                        86400000,
                    ) + 1;
                  const isCurrent = p.date_from <= today && p.date_to >= today;
                  return (
                    <TableRow key={p.id} className={isCurrent ? "bg-primary/5" : ""}>
                      <TableCell className="font-medium">
                        {p.name}
                        {isCurrent && (
                          <Badge variant="outline" className="ms-2 bg-primary/10 text-primary border-primary/30">
                            {isAr ? "الحالية" : "Current"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{p.date_from}</TableCell>
                      <TableCell className="font-mono text-xs">{p.date_to}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {days} {isAr ? "يوم" : "days"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={B.cls}>
                          <B.icon className="h-3 w-3 me-1" />
                          {isAr ? B.ar : B.en}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end">
                          {p.status !== "open" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => statusMut.mutate({ id: p.id, status: "open" })}
                              title={isAr ? "إعادة فتح" : "Reopen"}
                            >
                              <LockOpen className="h-3.5 w-3.5 text-success" />
                            </Button>
                          )}
                          {p.status === "open" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => statusMut.mutate({ id: p.id, status: "closed" })}
                              title={isAr ? "إقفال" : "Close"}
                            >
                              <Lock className="h-3.5 w-3.5 text-warning" />
                            </Button>
                          )}
                          {p.status !== "locked" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => statusMut.mutate({ id: p.id, status: "locked" })}
                              title={isAr ? "حجز نهائي" : "Lock"}
                            >
                              <ShieldCheck className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEdit(p)}
                            title={t("common.edit")}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDelId(p.id)}
                            className="text-destructive hover:text-destructive"
                            title={t("common.delete")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* ---------- Lock Date (single) ---------- */}
      <Card className="p-4" id="lock-dates-section">
        <div className="mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Lock className="h-4 w-4" />
            {isAr ? "تاريخ الإقفال" : "Lock Date"}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {isAr
              ? "تاريخ إقفال واحد على مستوى الشركة. لا يمكن إدخال أو تعديل أي بيانات في هذا التاريخ أو ما قبله."
              : "A single company-wide lock date. No data can be entered or modified on or before this date."}
          </p>
        </div>

        {currentLock && (
          <div className="mb-4 flex items-center gap-3 rounded-md border border-warning/30 bg-warning/5 p-3">
            <ShieldCheck className="h-4 w-4 text-warning" />
            <div className="text-sm">
              <span className="text-muted-foreground">
                {isAr ? "التاريخ الحالي المقفل: " : "Currently locked through: "}
              </span>
              <span className="font-mono font-semibold">{currentLock.lock_date}</span>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>{isAr ? "تاريخ الإقفال" : "Lock Date"} *</Label>
            <Input type="date" value={ldDate} onChange={(e) => setLdDate(e.target.value)} />
          </div>
          <div>
            <Label>{t("common.notes")}</Label>
            <Input value={ldNotes} onChange={(e) => setLdNotes(e.target.value)} />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={() => ldSaveMut.mutate()} disabled={!canSaveLD || ldSaveMut.isPending}>
            {t("common.save")}
          </Button>
        </div>
      </Card>




      {/* Create / Edit dialog */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(EMPTY_FORM); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {form.id
                ? (isAr ? "تعديل فترة مالية" : "Edit Fiscal Period")
                : (isAr ? "فترة مالية جديدة" : "New Fiscal Period")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>{isAr ? "اسم الفترة" : "Period Name"}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="FY 2026 / FY 2026-01 / FY 2026 Q1"
                maxLength={100}
              />
            </div>
            <div>
              <Label>{isAr ? "من تاريخ" : "From Date"}</Label>
              <Input
                type="date"
                value={form.date_from}
                onChange={(e) => setForm({ ...form, date_from: e.target.value })}
              />
            </div>
            <div>
              <Label>{isAr ? "إلى تاريخ" : "To Date"}</Label>
              <Input
                type="date"
                value={form.date_to}
                onChange={(e) => setForm({ ...form, date_to: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label>{isAr ? "الحالة" : "Status"}</Label>
              <Select
                value={form.status}
                onValueChange={(v: Status) => setForm({ ...form, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">{isAr ? "مفتوحة" : "Open"}</SelectItem>
                  <SelectItem value="closed">{isAr ? "مقفلة" : "Closed"}</SelectItem>
                  <SelectItem value="locked">{isAr ? "محجوزة" : "Locked"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => saveMut.mutate()} disabled={!canSave || saveMut.isPending}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate dialog */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              <Sparkles className="h-4 w-4 inline me-2" />
              {isAr ? "إنشاء فترات السنة المالية" : "Generate Fiscal Year Periods"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{isAr ? "السنة" : "Year"}</Label>
              <Input
                type="number"
                value={genForm.year}
                min={2000}
                max={2100}
                onChange={(e) => setGenForm({ ...genForm, year: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>{isAr ? "البادئة" : "Prefix"}</Label>
              <Input
                value={genForm.prefix}
                onChange={(e) => setGenForm({ ...genForm, prefix: e.target.value })}
                maxLength={20}
                placeholder="FY"
              />
            </div>
            <div>
              <Label>{isAr ? "شهر البداية" : "Start Month"}</Label>
              <Select
                value={String(genForm.start_month)}
                onValueChange={(v) => setGenForm({ ...genForm, start_month: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthsLabels.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{isAr ? "التكرار" : "Frequency"}</Label>
              <Select
                value={genForm.frequency}
                onValueChange={(v: any) => setGenForm({ ...genForm, frequency: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">{isAr ? "شهرية (12 فترة)" : "Monthly (12)"}</SelectItem>
                  <SelectItem value="quarterly">{isAr ? "ربع سنوية (4 فترات)" : "Quarterly (4)"}</SelectItem>
                  <SelectItem value="yearly">{isAr ? "سنوية (فترة واحدة)" : "Yearly (1)"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {isAr
              ? "سيتم إنشاء فترات تغطي السنة المالية كاملة بدءاً من شهر البداية المحدد. لا يمكن أن تتداخل مع فترات موجودة."
              : "Periods will cover the full fiscal year starting at the selected month. Existing periods must not overlap."}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => generateMut.mutate()} disabled={generateMut.isPending}>
              <Sparkles className="h-4 w-4 me-1" />
              {isAr ? "إنشاء" : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isAr ? "تأكيد الحذف" : "Confirm Delete"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isAr
                ? "سيتم حذف الفترة نهائياً. لا يمكن الحذف إذا كانت مرتبطة بقيود."
                : "This period will be permanently deleted. Cannot delete if linked to journal entries."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => delId && removeMut.mutate(delId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
