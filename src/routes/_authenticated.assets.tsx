import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAssets, listCategories, createAsset, createCategory, getDepreciationSchedule, postDueDepreciation } from "@/lib/api/assets.functions";

import { listAccounts } from "@/lib/api/accounting.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AccountCombobox } from "@/components/account-combobox";
import { Briefcase, Plus, Eye, PlayCircle } from "lucide-react";

import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/assets")({
  component: AssetsPage,
});

const fmt = (n: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

function AssetsPage() {
  const { t } = useI18n();
  const localized = useLocalized();
  const { companyId, branchId } = useBranch();
  const qc = useQueryClient();
  const list = useServerFn(listAssets);
  const listCat = useServerFn(listCategories);
  const listAcc = useServerFn(listAccounts);
  const create = useServerFn(createAsset);
  const createCat = useServerFn(createCategory);
  const getSched = useServerFn(getDepreciationSchedule);
  const postDep = useServerFn(postDueDepreciation);
  const postDepMut = useMutation({
    mutationFn: () => postDep({ data: { companyId: companyId! } }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["depreciation_schedule"] });
      if (r?.errors?.length) {
        toast.warning(`${r.posted} posted, ${r.skipped} skipped`);
      } else {
        toast.success(`${r.posted} depreciation entries posted`);
      }
    },
    onError: (e: any) => toast.error(e.message),
  });


  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [schedOpen, setSchedOpen] = useState<string | null>(null);

  const { data: assetsData } = useQuery({
    queryKey: ["assets", companyId, branchId],
    queryFn: () => list({ data: { companyId: companyId!, branchId } }),
    enabled: !!companyId,
  });
  const { data: catsData } = useQuery({
    queryKey: ["asset_categories", companyId],
    queryFn: () => listCat({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });
  const { data: accountsData } = useQuery({
    queryKey: ["accounts", companyId],
    queryFn: () => listAcc({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const assets = assetsData?.assets || [];
  const categories = catsData?.categories || [];
  const accounts = (accountsData as any[]) || [];
  const leafAccounts = accounts.filter((a: any) => !a.is_group);

  // Asset form
  const [form, setForm] = useState({
    category_id: "" as string,
    code: "", name_ar: "", name_en: "", description: "",
    acquisition_date: new Date().toISOString().split("T")[0],
    acquisition_cost: 0, salvage_value: 0,
    useful_life_months: 60, depreciation_method: "straight_line" as "straight_line" | "declining_balance",
    depreciation_start_date: new Date().toISOString().split("T")[0],
    asset_account_id: "" as string,
    depreciation_account_id: "" as string,
    accumulated_depreciation_account_id: "" as string,
  });

  const createMut = useMutation({
    mutationFn: () => create({
      data: {
        companyId: companyId!,
        branchId: branchId!,
        category_id: form.category_id || null,
        code: form.code,
        name_ar: form.name_ar,
        name_en: form.name_en,
        description: form.description || undefined,
        acquisition_date: form.acquisition_date,
        acquisition_cost: Number(form.acquisition_cost),
        salvage_value: Number(form.salvage_value),
        useful_life_months: Number(form.useful_life_months),
        depreciation_method: form.depreciation_method,
        depreciation_start_date: form.depreciation_start_date,
        asset_account_id: form.asset_account_id || null,
        depreciation_account_id: form.depreciation_account_id || null,
        accumulated_depreciation_account_id: form.accumulated_depreciation_account_id || null,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      toast.success(t("common.saved"));
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Category form
  const [catForm, setCatForm] = useState({
    code: "", name_ar: "", name_en: "",
    asset_account_id: "", depreciation_account_id: "", accumulated_depreciation_account_id: "",
    default_useful_life_months: 60,
    default_depreciation_method: "straight_line" as "straight_line" | "declining_balance",
  });

  const createCatMut = useMutation({
    mutationFn: () => createCat({
      data: {
        companyId: companyId!,
        code: catForm.code,
        name_ar: catForm.name_ar,
        name_en: catForm.name_en,
        asset_account_id: catForm.asset_account_id || null,
        depreciation_account_id: catForm.depreciation_account_id || null,
        accumulated_depreciation_account_id: catForm.accumulated_depreciation_account_id || null,
        default_useful_life_months: Number(catForm.default_useful_life_months),
        default_depreciation_method: catForm.default_depreciation_method,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset_categories"] });
      toast.success(t("common.saved"));
      setCatOpen(false);
      setCatForm({ ...catForm, code: "", name_ar: "", name_en: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: schedData } = useQuery({
    queryKey: ["dep_schedule", schedOpen],
    queryFn: () => getSched({ data: { assetId: schedOpen! } }),
    enabled: !!schedOpen,
  });

  const totalCost = assets.reduce((s: number, a: any) => s + Number(a.acquisition_cost), 0);
  const totalAccDep = assets.reduce((s: number, a: any) => s + Number(a.accumulated_depreciation), 0);
  const totalNbv = assets.reduce((s: number, a: any) => s + Number(a.current_book_value), 0);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          <h1 className="page-title">{t("assets.title")}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => postDepMut.mutate()} disabled={postDepMut.isPending || !companyId}>
            <PlayCircle className="h-4 w-4 me-1" />{t("assets.postDueDep")}
          </Button>


          <Dialog open={catOpen} onOpenChange={setCatOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Plus className="h-4 w-4 me-1" />{t("assets.newCategory")}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader><DialogTitle>{t("assets.newCategory")}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t("common.code")}</Label><Input value={catForm.code} onChange={(e) => setCatForm({ ...catForm, code: e.target.value })} /></div>
                <div><Label>{t("assets.usefulLife")}</Label><Input type="number" value={catForm.default_useful_life_months} onChange={(e) => setCatForm({ ...catForm, default_useful_life_months: Number(e.target.value) })} /></div>
                <div><Label>{t("common.nameAr")}</Label><Input value={catForm.name_ar} onChange={(e) => setCatForm({ ...catForm, name_ar: e.target.value })} /></div>
                <div><Label>{t("common.nameEn")}</Label><Input value={catForm.name_en} onChange={(e) => setCatForm({ ...catForm, name_en: e.target.value })} /></div>
                <div className="col-span-2"><Label>{t("assets.assetAccount")}</Label>
                  <AccountCombobox accounts={leafAccounts.filter((a) => a.account_type === "asset")} value={catForm.asset_account_id || null} onChange={(v) => setCatForm({ ...catForm, asset_account_id: v ?? "" })} allowClear={false} />
                </div>
                <div className="col-span-2"><Label>{t("assets.depAccount")}</Label>
                  <AccountCombobox accounts={leafAccounts.filter((a) => a.account_type === "expense")} value={catForm.depreciation_account_id || null} onChange={(v) => setCatForm({ ...catForm, depreciation_account_id: v ?? "" })} allowClear={false} />
                </div>
                <div className="col-span-2"><Label>{t("assets.accAccount")}</Label>
                  <AccountCombobox accounts={leafAccounts.filter((a) => a.account_type === "asset")} value={catForm.accumulated_depreciation_account_id || null} onChange={(v) => setCatForm({ ...catForm, accumulated_depreciation_account_id: v ?? "" })} allowClear={false} />
                </div>
              </div>
              <DialogFooter><Button onClick={() => createCatMut.mutate()} disabled={createCatMut.isPending}>{t("common.save")}</Button></DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 me-1" />{t("assets.newAsset")}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{t("assets.newAsset")}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>{t("common.code")}</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
                <div className="col-span-2"><Label>{t("assets.category")}</Label>
                  <Select value={form.category_id} onValueChange={(v) => {
                    const c = categories.find((x: any) => x.id === v);
                    setForm({
                      ...form, category_id: v,
                      useful_life_months: c?.default_useful_life_months || form.useful_life_months,
                      depreciation_method: c?.default_depreciation_method || form.depreciation_method,
                      asset_account_id: c?.asset_account_id || form.asset_account_id,
                      depreciation_account_id: c?.depreciation_account_id || form.depreciation_account_id,
                      accumulated_depreciation_account_id: c?.accumulated_depreciation_account_id || form.accumulated_depreciation_account_id,
                    });
                  }}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.code} — {localized(c, "name")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>{t("common.nameAr")}</Label><Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} /></div>
                <div><Label>{t("common.nameEn")}</Label><Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} /></div>
                <div><Label>{t("assets.acquisitionDate")}</Label><Input type="date" value={form.acquisition_date} onChange={(e) => setForm({ ...form, acquisition_date: e.target.value })} /></div>
                <div><Label>{t("assets.cost")}</Label><Input type="number" value={form.acquisition_cost} onChange={(e) => setForm({ ...form, acquisition_cost: Number(e.target.value) })} /></div>
                <div><Label>{t("assets.salvage")}</Label><Input type="number" value={form.salvage_value} onChange={(e) => setForm({ ...form, salvage_value: Number(e.target.value) })} /></div>
                <div><Label>{t("assets.usefulLife")}</Label><Input type="number" value={form.useful_life_months} onChange={(e) => setForm({ ...form, useful_life_months: Number(e.target.value) })} /></div>
                <div><Label>{t("assets.depStart")}</Label><Input type="date" value={form.depreciation_start_date} onChange={(e) => setForm({ ...form, depreciation_start_date: e.target.value })} /></div>
                <div><Label>{t("assets.method")}</Label>
                  <Select value={form.depreciation_method} onValueChange={(v) => setForm({ ...form, depreciation_method: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="straight_line">{t("assets.straightLine")}</SelectItem>
                      <SelectItem value="declining_balance">{t("assets.declining")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-3"><Label>{t("common.description")}</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !branchId}>{t("common.save")}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <Card className="p-3"><div className="text-[10px] text-muted-foreground uppercase">{t("assets.count")}</div><div className="text-lg font-bold">{assets.length}</div></Card>
        <Card className="p-3"><div className="text-[10px] text-muted-foreground uppercase">{t("assets.totalCost")}</div><div className="text-sm font-mono font-bold">{fmt(totalCost)}</div></Card>
        <Card className="p-3"><div className="text-[10px] text-muted-foreground uppercase">{t("assets.totalAccDep")}</div><div className="text-sm font-mono font-bold text-destructive">{fmt(totalAccDep)}</div></Card>
        <Card className="p-3 bg-primary/5 border-primary/40"><div className="text-[10px] text-muted-foreground uppercase">{t("assets.totalNbv")}</div><div className="text-sm font-mono font-bold">{fmt(totalNbv)}</div></Card>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="text-start px-3 py-2">{t("common.code")}</th>
              <th className="text-start px-3 py-2">{t("common.name")}</th>
              <th className="text-start px-3 py-2">{t("assets.category")}</th>
              <th className="text-center px-3 py-2">{t("assets.acquisitionDate")}</th>
              <th className="text-end px-3 py-2">{t("assets.cost")}</th>
              <th className="text-end px-3 py-2">{t("assets.accDep")}</th>
              <th className="text-end px-3 py-2">{t("assets.nbv")}</th>
              <th className="text-center px-3 py-2">{t("common.status")}</th>
              <th className="text-center px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {assets.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">{t("common.noData")}</td></tr>
            ) : assets.map((a: any) => (
              <tr key={a.id} className="border-t hover:bg-muted/20">
                <td className="px-3 py-2 font-mono">{a.code}</td>
                <td className="px-3 py-2 font-medium">{localized(a, "name")}</td>
                <td className="px-3 py-2 text-muted-foreground">{a.asset_categories ? localized(a.asset_categories, "name") : "—"}</td>
                <td className="px-3 py-2 text-center font-mono">{a.acquisition_date}</td>
                <td className="px-3 py-2 text-end font-mono tabular-nums">{fmt(a.acquisition_cost)}</td>
                <td className="px-3 py-2 text-end font-mono tabular-nums text-destructive">{fmt(a.accumulated_depreciation)}</td>
                <td className="px-3 py-2 text-end font-mono tabular-nums font-bold">{fmt(a.current_book_value)}</td>
                <td className="px-3 py-2 text-center"><Badge variant={a.status === "active" ? "default" : "secondary"}>{t(`assets.status.${a.status}`)}</Badge></td>
                <td className="px-3 py-2 text-center"><Button size="icon" variant="ghost" onClick={() => setSchedOpen(a.id)}><Eye className="h-3 w-3" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Dialog open={!!schedOpen} onOpenChange={(o) => !o && setSchedOpen(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("assets.depSchedule")}</DialogTitle></DialogHeader>
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-start px-3 py-2">{t("common.date")}</th>
                <th className="text-end px-3 py-2">{t("assets.monthlyDep")}</th>
                <th className="text-end px-3 py-2">{t("assets.accDep")}</th>
                <th className="text-end px-3 py-2">{t("assets.nbv")}</th>
                <th className="text-center px-3 py-2">{t("common.status")}</th>
              </tr>
            </thead>
            <tbody>
              {(schedData?.schedule || []).map((s: any) => (
                <tr key={s.id} className="border-t">
                  <td className="px-3 py-2 font-mono">{s.period_date}</td>
                  <td className="px-3 py-2 text-end font-mono tabular-nums">{fmt(s.depreciation_amount)}</td>
                  <td className="px-3 py-2 text-end font-mono tabular-nums">{fmt(s.accumulated_depreciation)}</td>
                  <td className="px-3 py-2 text-end font-mono tabular-nums">{fmt(s.book_value)}</td>
                  <td className="px-3 py-2 text-center">{s.is_posted ? <Badge variant="default">{t("je.posted")}</Badge> : <Badge variant="secondary">{t("je.draft")}</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DialogContent>
      </Dialog>
    </div>
  );
}
