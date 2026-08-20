import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listRFQs, upsertRFQHeader, deleteRFQ } from "@/lib/api/rfq.functions";
import { listWarehouses } from "@/lib/api/purchase.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileQuestion, Plus, Search, Trash2, Users, ListChecks } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/rfqs")({
  component: RFQListPage,
});

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  sent: "bg-info/10 text-info border-info/30",
  quotes_received: "bg-warning/10 text-warning border-warning/30",
  awarded: "bg-primary/10 text-primary border-primary/30",
  converted: "bg-success/10 text-success border-success/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
};

function RFQListPage() {
  const { t } = useI18n();
  const { companyId } = useBranch();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(listRFQs);
  const upsertFn = useServerFn(upsertRFQHeader);
  const deleteFn = useServerFn(deleteRFQ);
  const listWh = useServerFn(listWarehouses);

  const { data: rfqs = [], isLoading } = useQuery({
    queryKey: ["rfqs", companyId],
    queryFn: () => listFn({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });
  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", companyId],
    queryFn: () => listWh({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const emptyForm = { title: "", request_date: new Date().toISOString().slice(0, 10), needed_by_date: "", warehouse_id: null as string | null, notes: "" };
  const [form, setForm] = useState(emptyForm);

  const createMut = useMutation({
    mutationFn: () => upsertFn({
      data: {
        company_id: companyId!,
        title: form.title.trim(),
        request_date: form.request_date,
        needed_by_date: form.needed_by_date || null,
        warehouse_id: form.warehouse_id,
        notes: form.notes || null,
      },
    }),
    onSuccess: (row: any) => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["rfqs"] });
      setOpen(false);
      setForm(emptyForm);
      navigate({ to: "/rfqs/$rfqId", params: { rfqId: row.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success(t("common.deleted")); qc.invalidateQueries({ queryKey: ["rfqs"] }); setDeleteId(null); },
    onError: (e: Error) => { toast.error(e.message); setDeleteId(null); },
  });

  const filtered = (rfqs as any[]).filter((r) =>
    !q || r.rfq_number.toLowerCase().includes(q.toLowerCase()) || r.title.toLowerCase().includes(q.toLowerCase())
  );

  const statusLabel = (s: string) => t(`rfq.status.${s}`) || s;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileQuestion className="h-5 w-5 text-primary" />
          <h1 className="page-title">{t("rfq.title")}</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={!companyId}><Plus className="h-4 w-4 me-1" />{t("rfq.newRfq")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("rfq.newRfq")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{t("rfq.rfqTitle")} *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t("rfq.requestDate")}</Label><Input type="date" value={form.request_date} onChange={(e) => setForm({ ...form, request_date: e.target.value })} /></div>
                <div><Label>{t("rfq.neededBy")}</Label><Input type="date" value={form.needed_by_date} onChange={(e) => setForm({ ...form, needed_by_date: e.target.value })} /></div>
              </div>
              <div>
                <Label>{t("purchase.deliverTo")}</Label>
                <Select value={form.warehouse_id ?? "__none__"} onValueChange={(v) => setForm({ ...form, warehouse_id: v === "__none__" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {(warehouses as any[]).map((w) => <SelectItem key={w.id} value={w.id}>{w.name_ar}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={() => createMut.mutate()} disabled={!form.title.trim() || createMut.isPending}>{t("common.save")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t("common.search")} value={q} onChange={(e) => setQ(e.target.value)} className="ps-9 h-9" />
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="p-2.5 text-start">{t("rfq.rfqNumber")}</th>
              <th className="p-2.5 text-start">{t("rfq.rfqTitle")}</th>
              <th className="p-2.5 text-start">{t("rfq.requestDate")}</th>
              <th className="p-2.5 text-center">{t("rfq.lines")}</th>
              <th className="p-2.5 text-center">{t("rfq.vendorsInvited")}</th>
              <th className="p-2.5 text-center">{t("common.status")}</th>
              <th className="p-2.5 text-center">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">{t("common.loading")}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">{t("common.noData")}</td></tr>
            ) : (
              filtered.map((r: any) => (
                <tr key={r.id} className="border-t hover:bg-muted/20 cursor-pointer" onClick={() => navigate({ to: "/rfqs/$rfqId", params: { rfqId: r.id } })}>
                  <td className="p-2.5 font-mono">{r.rfq_number}</td>
                  <td className="p-2.5 font-medium">{r.title}</td>
                  <td className="p-2.5 text-muted-foreground">{r.request_date}</td>
                  <td className="p-2.5 text-center"><Badge variant="outline" className="gap-1"><ListChecks className="h-3 w-3" />{r.line_count}</Badge></td>
                  <td className="p-2.5 text-center"><Badge variant="outline" className="gap-1"><Users className="h-3 w-3" />{r.quoted_count}/{r.vendor_count}</Badge></td>
                  <td className="p-2.5 text-center"><Badge variant="outline" className={STATUS_STYLES[r.status]}>{statusLabel(r.status)}</Badge></td>
                  <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle><AlertDialogDescription>{t("common.deleteWarning")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => deleteId && deleteMut.mutate(deleteId)}>{t("common.delete")}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
