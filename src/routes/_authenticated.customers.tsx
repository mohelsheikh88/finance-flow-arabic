import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createPartner, listPartners } from "@/lib/api/accounting.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Search, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/customers")({
  component: CustomersPage,
});

function CustomersPage() {
  const { t } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();
  const qc = useQueryClient();
  const list = useServerFn(listPartners);
  const create = useServerFn(createPartner);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const { data: all = [] } = useQuery({
    queryKey: ["partners", companyId],
    queryFn: () => list({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const customers = all.filter((p: any) => p.is_customer);
  const filtered = customers.filter((p: any) =>
    !q || p.code.includes(q) || p.name_ar?.includes(q) || p.name_en?.toLowerCase().includes(q.toLowerCase())
  );
  const totalCredit = customers.reduce((s: number, p: any) => s + Number(p.credit_limit ?? 0), 0);

  const [form, setForm] = useState({
    code: "", name_ar: "", name_en: "", vat_number: "",
    email: "", phone: "", credit_limit: 0, address_ar: "",
  });

  const mut = useMutation({
    mutationFn: () => create({ data: {
      ...form, is_customer: true, is_vendor: false, company_id: companyId!,
    } as any }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["partners"] });
      setOpen(false);
      setForm({ code: "", name_ar: "", name_en: "", vat_number: "", email: "", phone: "", credit_limit: 0, address_ar: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{t("customers.title")}</h1>
          <p className="text-sm text-muted-foreground">{customers.length} {t("customers.activeCustomers")}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 me-1" />{t("common.add")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("customers.title")} — {t("common.add")}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("common.code")} *</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
              <div><Label>{t("partners.vatNumber")}</Label><Input dir="ltr" value={form.vat_number} onChange={(e) => setForm({ ...form, vat_number: e.target.value })} /></div>
              <div><Label>{t("common.nameAr")} *</Label><Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} /></div>
              <div><Label>{t("common.nameEn")} *</Label><Input dir="ltr" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} /></div>
              <div><Label>Email</Label><Input dir="ltr" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>{t("partners.creditLimit")}</Label><Input type="number" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: Number(e.target.value) })} /></div>
              <div className="col-span-2"><Label>{t("setup.address")}</Label><Input value={form.address_ar} onChange={(e) => setForm({ ...form, address_ar: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.code || !form.name_ar || !form.name_en}>{t("common.save")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Users className="h-5 w-5 text-primary" /></div>
            <div>
              <div className="text-xs text-muted-foreground">{t("customers.activeCustomers")}</div>
              <div className="text-2xl font-bold font-mono">{customers.length}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">{t("partners.creditLimit")}</div>
          <div className="text-2xl font-bold font-mono">{totalCredit.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">SAR</span></div>
        </Card>
        <Card className="p-4">
          <Link to="/reports/aging" className="text-xs text-primary underline">{t("nav.aging")}</Link>
          <div className="text-2xl font-bold font-mono text-muted-foreground">—</div>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t("common.search")} value={q} onChange={(e) => setQ(e.target.value)} className="ps-9 h-9" />
      </div>

      <Card>
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-start p-3 font-medium">{t("common.code")}</th>
              <th className="text-start p-3 font-medium">{t("common.name")}</th>
              <th className="text-start p-3 font-medium font-mono">{t("partners.vatNumber")}</th>
              <th className="text-start p-3 font-medium">Email</th>
              <th className="text-start p-3 font-medium">Phone</th>
              <th className="text-end p-3 font-medium font-mono">{t("partners.creditLimit")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p: any) => (
              <tr key={p.id} className="border-t hover:bg-muted/30">
                <td className="p-3 font-mono">{p.code}</td>
                <td className="p-3 font-medium">{localized(p, "name")}</td>
                <td className="p-3 font-mono text-muted-foreground">{p.vat_number || "—"}</td>
                <td className="p-3 text-muted-foreground">{p.email || "—"}</td>
                <td className="p-3 font-mono text-muted-foreground">{p.phone || "—"}</td>
                <td className="p-3 text-end font-mono">{Number(p.credit_limit ?? 0).toLocaleString()}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">{t("common.noData")}</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
