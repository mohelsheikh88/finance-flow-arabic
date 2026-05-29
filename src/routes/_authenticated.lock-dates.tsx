import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listLockDates, createLockDate, updateLockDate, deleteLockDate } from "@/lib/api/lock-dates.functions";

import { useBranch } from "@/lib/branch-context";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Lock, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatLockError } from "@/lib/lock-error";

export const Route = createFileRoute("/_authenticated/lock-dates")({
  component: Page,
});

type FormState = { branch_id: string; lock_date: string; notes: string };
const empty: FormState = { branch_id: "__all__", lock_date: "", notes: "" };

function Page() {
  const { t } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();
  const qc = useQueryClient();

  const list = useServerFn(listLockDates);
  const create = useServerFn(createLockDate);
  const update = useServerFn(updateLockDate);
  const remove = useServerFn(deleteLockDate);

  const { data: rows = [] } = useQuery({
    queryKey: ["lock_dates", companyId],
    queryFn: () => list({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });
  const { data: companyBranches = [] } = useQuery({
    queryKey: ["branches", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, code, name_ar, name_en")
        .eq("company_id", companyId!)
        .order("code");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(empty);
    setOpen(true);
  };
  const openEdit = (r: any) => {
    setEditingId(r.id);
    setForm({
      branch_id: r.branch_id ?? "__all__",
      lock_date: r.lock_date,
      notes: r.notes ?? "",
    });
    setOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: () => {
      const branch_id = form.branch_id === "__all__" ? null : form.branch_id;
      if (editingId) {
        return update({ data: { id: editingId, branch_id, lock_date: form.lock_date, notes: form.notes || null } });
      }
      return create({ data: { company_id: companyId!, branch_id, lock_date: form.lock_date, notes: form.notes || null } });
    },
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["lock_dates"] });
      setOpen(false);
      setEditingId(null);
      setForm(empty);
    },
    onError: (e: Error) => toast.error(formatLockError(e, t)),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["lock_dates"] });
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(formatLockError(e, t)),
  });

  const canSave = !!form.lock_date;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title"><Lock className="h-5 w-5" />{t("nav.lockDates")}</h1>
          <p className="text-sm text-muted-foreground">{t("lockDates.description")}</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditingId(null); setForm(empty); } }}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="h-4 w-4 me-1" />{t("common.new")}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editingId ? t("common.edit") : t("lockDates.new")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>{t("lockDates.scope")}</Label>
                <Select value={form.branch_id} onValueChange={(v) => setForm({ ...form, branch_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{t("lockDates.allBranches")}</SelectItem>
                    {companyBranches.map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>{b.code} — {localized(b, "name")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("lockDates.lockDate")} *</Label>
                <Input type="date" value={form.lock_date} onChange={(e) => setForm({ ...form, lock_date: e.target.value })} />
              </div>
              <div>
                <Label>{t("common.notes")}</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={() => saveMut.mutate()} disabled={!canSave || saveMut.isPending}>{t("common.save")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-start p-3 font-medium">{t("lockDates.lockDate")}</th>
              <th className="text-start p-3 font-medium">{t("lockDates.scope")}</th>
              <th className="text-start p-3 font-medium">{t("common.notes")}</th>
              <th className="text-center p-3 font-medium">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id} className="border-t hover:bg-muted/30">
                <td className="p-3 font-mono">{r.lock_date}</td>
                <td className="p-3">
                  {r.branches ? (
                    <Badge variant="outline">{r.branches.code} — {localized(r.branches, "name")}</Badge>
                  ) : (
                    <Badge>{t("lockDates.allBranches")}</Badge>
                  )}
                </td>
                <td className="p-3 text-muted-foreground">{r.notes ?? "—"}</td>
                <td className="p-3 text-center">
                  <div className="inline-flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)} title={t("common.edit")}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteId(r.id)} title={t("common.delete")}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">{t("common.noData")}</td></tr>}
          </tbody>
        </table>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("common.confirmDeleteDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && removeMut.mutate(deleteId)}>
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
