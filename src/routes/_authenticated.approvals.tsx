import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listWorkflows, createWorkflow, updateWorkflow, deleteWorkflow } from "@/lib/api/approvals.functions";
import { listRoles } from "@/lib/api/roles.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, Plus, Trash2, Pencil, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { RolesManagement } from "@/components/roles-management";
import { UserRolesManagement } from "@/components/user-roles-management";

export const Route = createFileRoute("/_authenticated/approvals")({
  component: ApprovalsPage,
});

const JOURNAL_TYPES = ["sales", "purchase", "bank", "cash", "misc"] as const;

function ApprovalsPage() {
  const { t, locale } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();
  const qc = useQueryClient();
  const listWf = useServerFn(listWorkflows);
  const createWf = useServerFn(createWorkflow);
  const updateWf = useServerFn(updateWorkflow);
  const deleteWf = useServerFn(deleteWorkflow);
  const listRolesFn = useServerFn(listRoles);

  const { data: rolesData = [] } = useQuery({
    queryKey: ["roles_active"],
    queryFn: () => listRolesFn(),
  });
  const activeRoles = (rolesData as any[]).filter((r) => r.is_active && r.code !== "admin");

  const [wfOpen, setWfOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);

  const { data: wfData } = useQuery({
    queryKey: ["workflows", companyId],
    queryFn: () => listWf({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const [wfForm, setWfForm] = useState({
    name_ar: "", name_en: "", journal_type: "sales" as typeof JOURNAL_TYPES[number],
    min_amount: 0, max_amount: null as number | null,
  });
  const [steps, setSteps] = useState([
    { step_order: 1, required_role: "chief_accountant", step_name_ar: "مراجعة رئيس الحسابات", step_name_en: "Chief Accountant Review" },
    { step_order: 2, required_role: "finance_manager", step_name_ar: "اعتماد المدير المالي", step_name_en: "Finance Manager Approval" },
  ]);

  const resetForm = () => {
    setEditingId(null);
    setIsActive(true);
    setWfForm({ name_ar: "", name_en: "", journal_type: "sales", min_amount: 0, max_amount: null });
    setSteps([
      { step_order: 1, required_role: "chief_accountant", step_name_ar: "مراجعة رئيس الحسابات", step_name_en: "Chief Accountant Review" },
      { step_order: 2, required_role: "finance_manager", step_name_ar: "اعتماد المدير المالي", step_name_en: "Finance Manager Approval" },
    ]);
  };

  const openEdit = (w: any) => {
    setEditingId(w.id);
    setIsActive(!!w.is_active);
    setWfForm({
      name_ar: w.name_ar || "",
      name_en: w.name_en || "",
      journal_type: (w.journal_type || "sales") as typeof JOURNAL_TYPES[number],
      min_amount: Number(w.min_amount) || 0,
      max_amount: w.max_amount != null ? Number(w.max_amount) : null,
    });
    const ss = (w.approval_steps_def || [])
      .slice()
      .sort((a: any, b: any) => a.step_order - b.step_order)
      .map((s: any, i: number) => ({
        step_order: i + 1,
        required_role: s.required_role,
        step_name_ar: s.step_name_ar || "",
        step_name_en: s.step_name_en || "",
      }));
    setSteps(ss.length ? ss : [{ step_order: 1, required_role: "accountant", step_name_ar: "", step_name_en: "" }]);
    setWfOpen(true);
  };

  const createWfMut = useMutation({
    mutationFn: () => createWf({
      data: {
        companyId: companyId!,
        ...wfForm,
        steps: steps.map((s, i) => ({ ...s, step_order: i + 1 })),
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflows"] });
      toast.success(t("common.saved"));
      setWfOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateWfMut = useMutation({
    mutationFn: () => updateWf({
      data: {
        id: editingId!,
        ...wfForm,
        is_active: isActive,
        steps: steps.map((s, i) => ({ ...s, step_order: i + 1 })),
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflows"] });
      toast.success(t("common.saved"));
      setWfOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteWfMut = useMutation({
    mutationFn: (id: string) => deleteWf({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflows"] });
      toast.success(t("common.deleted") || t("common.saved"));
      setDeleteId(null);
    },
    onError: (e: any) => {
      toast.error(e.message);
      setDeleteId(null);
    },
  });

  const saveMut = editingId ? updateWfMut : createWfMut;

  const workflows = wfData?.workflows || [];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="page-title">{t("approvals.title")}</h1>
        </div>
        <Dialog open={wfOpen} onOpenChange={(o) => { setWfOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => resetForm()}><Plus className="h-4 w-4 me-1" />{t("approvals.newWorkflow")}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingId ? (t("approvals.editWorkflow") || t("common.edit")) : t("approvals.newWorkflow")}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("common.nameAr")}</Label>
                <Input value={wfForm.name_ar} onChange={(e) => setWfForm({ ...wfForm, name_ar: e.target.value })} />
              </div>
              <div>
                <Label>{t("common.nameEn")}</Label>
                <Input value={wfForm.name_en} onChange={(e) => setWfForm({ ...wfForm, name_en: e.target.value })} />
              </div>
              <div>
                <Label>{t("approvals.journalType")}</Label>
                <Select value={wfForm.journal_type} onValueChange={(v) => setWfForm({ ...wfForm, journal_type: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {JOURNAL_TYPES.map((d) => <SelectItem key={d} value={d}>{t(`approvals.jt.${d}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>{t("approvals.minAmount")}</Label>
                  <Input type="number" value={wfForm.min_amount} onChange={(e) => setWfForm({ ...wfForm, min_amount: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>{t("approvals.maxAmount")}</Label>
                  <Input type="number" value={wfForm.max_amount ?? ""} onChange={(e) => setWfForm({ ...wfForm, max_amount: e.target.value ? Number(e.target.value) : null })} />
                </div>
              </div>
              {editingId && (
                <div className="col-span-2 flex items-center gap-2 pt-2">
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                  <Label className="text-xs">{isActive ? t("common.active") : t("common.inactive")}</Label>
                </div>
              )}
            </div>

            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="font-bold">{t("approvals.steps")}</Label>
                <Button size="sm" variant="outline" onClick={() => setSteps([...steps, { step_order: steps.length + 1, required_role: "accountant", step_name_ar: "", step_name_en: "" }])}>
                  <Plus className="h-3 w-3 me-1" />{t("common.add")}
                </Button>
              </div>
              <div className="space-y-2">
                {steps.map((s, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-12 gap-2 items-end rounded-md border border-transparent hover:border-border transition-colors p-1"
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", String(i)); e.dataTransfer.effectAllowed = "move"; }}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from = Number(e.dataTransfer.getData("text/plain"));
                      if (Number.isNaN(from) || from === i) return;
                      const c = [...steps];
                      const [moved] = c.splice(from, 1);
                      c.splice(i, 0, moved);
                      setSteps(c.map((x, idx) => ({ ...x, step_order: idx + 1 })));
                    }}
                  >
                    <div className="col-span-1 flex items-center justify-center gap-1 pt-5">
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
                      <span className="font-bold">{i + 1}</span>
                    </div>
                    <div className="col-span-3">
                      <Label className="text-[10px]">{t("approvals.role")}</Label>
                      <Select value={s.required_role} onValueChange={(v) => { const c = [...steps]; c[i].required_role = v; setSteps(c); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {activeRoles.map((r: any) => (
                            <SelectItem key={r.code} value={r.code}>
                              {locale === "ar" ? r.name_ar : r.name_en}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <Label className="text-[10px]">{t("common.nameAr")}</Label>
                      <Input value={s.step_name_ar} onChange={(e) => { const c = [...steps]; c[i].step_name_ar = e.target.value; setSteps(c); }} />
                    </div>
                    <div className="col-span-3">
                      <Label className="text-[10px]">{t("common.nameEn")}</Label>
                      <Input value={s.step_name_en} onChange={(e) => { const c = [...steps]; c[i].step_name_en = e.target.value; setSteps(c); }} />
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => {
                        const c = [...steps];
                        [c[i - 1], c[i]] = [c[i], c[i - 1]];
                        setSteps(c.map((x, idx) => ({ ...x, step_order: idx + 1 })));
                      }}>↑</Button>
                      <Button size="icon" variant="ghost" disabled={i === steps.length - 1} onClick={() => {
                        const c = [...steps];
                        [c[i + 1], c[i]] = [c[i], c[i + 1]];
                        setSteps(c.map((x, idx) => ({ ...x, step_order: idx + 1 })));
                      }}>↓</Button>
                      <Button size="icon" variant="ghost" onClick={() => setSteps(steps.filter((_, j) => j !== i).map((x, idx) => ({ ...x, step_order: idx + 1 })))}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  if (!wfForm.name_ar.trim() || !wfForm.name_en.trim()) {
                    toast.error(locale === "ar" ? "من فضلك أدخل اسم الـ Workflow بالعربي والإنجليزي" : "Please enter the workflow name in both Arabic and English");
                    return;
                  }
                  if (steps.length === 0) {
                    toast.error(locale === "ar" ? "أضف خطوة واحدة على الأقل" : "Add at least one approval step");
                    return;
                  }
                  const badStep = steps.findIndex((s) => !s.step_name_ar.trim() || !s.step_name_en.trim() || !s.required_role);
                  if (badStep !== -1) {
                    toast.error(locale === "ar" ? `أكمل بيانات الخطوة رقم ${badStep + 1}` : `Complete step #${badStep + 1} fields`);
                    return;
                  }
                  saveMut.mutate();
                }}
                disabled={saveMut.isPending}
              >
                {t("common.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="workflows">
        <TabsList>
          <TabsTrigger value="workflows">{t("approvals.workflows")} ({workflows.length})</TabsTrigger>
          <TabsTrigger value="roles">{t("roles.title")}</TabsTrigger>
          <TabsTrigger value="user_roles">{t("users.title")}</TabsTrigger>
        </TabsList>

        <TabsContent value="workflows" className="space-y-2">
          {workflows.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground text-sm">{t("approvals.noWorkflows")}</Card>
          ) : workflows.map((w: any) => (
            <Card key={w.id} className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm">{localized(w, "name")}</div>
                  <div className="text-xs text-muted-foreground">
                    {w.journal_type ? t(`approvals.jt.${w.journal_type}`) : t(`approvals.doc.${w.document_type}`)} • {Number(w.min_amount).toFixed(0)} - {w.max_amount ? Number(w.max_amount).toFixed(0) : "∞"} {w.currency_code}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={w.is_active ? "default" : "secondary"}>{w.is_active ? t("common.active") : t("common.inactive")}</Badge>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(w)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(w.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(w.approval_steps_def || []).sort((a: any, b: any) => a.step_order - b.step_order).map((s: any) => (
                  <Badge key={s.id} variant="outline" className="font-mono text-[10px]">
                    {s.step_order}. {localized(s, "step_name")} ({t(`users.${s.required_role}`)})
                  </Badge>
                ))}
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="roles">
          <RolesManagement />
        </TabsContent>

        <TabsContent value="user_roles">
          <UserRolesManagement />
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.confirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {locale === "ar"
                ? "هل أنت متأكد من حذف هذا الـ Workflow؟ لا يمكن التراجع عن هذا الإجراء."
                : "Are you sure you want to delete this workflow? This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{locale === "ar" ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteWfMut.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {locale === "ar" ? "حذف" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
