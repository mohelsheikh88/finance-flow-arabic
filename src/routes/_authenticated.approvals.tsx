import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listApprovalRequests, listWorkflows, createWorkflow, actOnRequest } from "@/lib/api/approvals.functions";
import { listRoles } from "@/lib/api/roles.functions";
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
import { ShieldCheck, Plus, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { RolesManagement } from "@/components/roles-management";

export const Route = createFileRoute("/_authenticated/approvals")({
  component: ApprovalsPage,
});

const DOC_TYPES = ["journal_entry", "invoice", "payment", "asset_disposal"] as const;


function ApprovalsPage() {
  const { t, locale } = useI18n();
  const localized = useLocalized();
  const { companyId, branchId } = useBranch();
  const qc = useQueryClient();
  const listReq = useServerFn(listApprovalRequests);
  const listWf = useServerFn(listWorkflows);
  const createWf = useServerFn(createWorkflow);
  const act = useServerFn(actOnRequest);
  const listRolesFn = useServerFn(listRoles);

  const { data: rolesData = [] } = useQuery({
    queryKey: ["roles_active"],
    queryFn: () => listRolesFn(),
  });
  const activeRoles = (rolesData as any[]).filter((r) => r.is_active && r.code !== "admin");

  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [wfOpen, setWfOpen] = useState(false);

  const { data: reqData } = useQuery({
    queryKey: ["approval_requests", companyId, branchId, status],
    queryFn: () => listReq({ data: { companyId: companyId!, branchId, status } }),
    enabled: !!companyId,
  });
  const { data: wfData } = useQuery({
    queryKey: ["workflows", companyId],
    queryFn: () => listWf({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const actMut = useMutation({
    mutationFn: (v: { requestId: string; action: "approved" | "rejected"; comments?: string }) =>
      act({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["approval_requests"] });
      toast.success(t("approvals.actionDone"));
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Workflow create form
  const [wfForm, setWfForm] = useState({
    name_ar: "", name_en: "", document_type: "invoice" as typeof DOC_TYPES[number],
    min_amount: 0, max_amount: null as number | null,
  });
  const [steps, setSteps] = useState([
    { step_order: 1, required_role: "chief_accountant", step_name_ar: "مراجعة رئيس الحسابات", step_name_en: "Chief Accountant Review" },
    { step_order: 2, required_role: "finance_manager", step_name_ar: "اعتماد المدير المالي", step_name_en: "Finance Manager Approval" },
  ]);

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
      setWfForm({ name_ar: "", name_en: "", document_type: "invoice", min_amount: 0, max_amount: null });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const requests = reqData?.requests || [];
  const workflows = wfData?.workflows || [];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="page-title">{t("approvals.title")}</h1>
        </div>
        <Dialog open={wfOpen} onOpenChange={setWfOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 me-1" />{t("approvals.newWorkflow")}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{t("approvals.newWorkflow")}</DialogTitle></DialogHeader>
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
                <Label>{t("approvals.docType")}</Label>
                <Select value={wfForm.document_type} onValueChange={(v) => setWfForm({ ...wfForm, document_type: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map((d) => <SelectItem key={d} value={d}>{t(`approvals.doc.${d}`)}</SelectItem>)}
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
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-1 text-center font-bold pt-5">{i + 1}</div>
                    <div className="col-span-4">
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
                    <Button size="icon" variant="ghost" className="col-span-1" onClick={() => setSteps(steps.filter((_, j) => j !== i))}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
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
                  createWfMut.mutate();
                }}
                disabled={createWfMut.isPending}
              >
                {t("common.save")}
              </Button>
            </DialogFooter>

          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">{t("approvals.requests")}</TabsTrigger>
          <TabsTrigger value="workflows">{t("approvals.workflows")} ({workflows.length})</TabsTrigger>
          <TabsTrigger value="roles">{t("roles.title")}</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-3">
          <div className="flex gap-2">
            {(["pending", "approved", "rejected", "all"] as const).map((s) => (
              <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)}>
                {t(`approvals.status.${s}`)}
              </Button>
            ))}
          </div>
          <Card className="overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="text-start px-3 py-2">{t("approvals.document")}</th>
                  <th className="text-start px-3 py-2">{t("approvals.reference")}</th>
                  <th className="text-end px-3 py-2">{t("common.amount")}</th>
                  <th className="text-center px-3 py-2">{t("approvals.step")}</th>
                  <th className="text-center px-3 py-2">{t("common.status")}</th>
                  <th className="text-end px-3 py-2">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">{t("common.noData")}</td></tr>
                ) : requests.map((r: any) => (
                  <tr key={r.id} className="border-t hover:bg-muted/20">
                    <td className="px-3 py-2">{t(`approvals.doc.${r.document_type}`)}</td>
                    <td className="px-3 py-2 font-mono">{r.document_reference || r.document_id.slice(0, 8)}</td>
                    <td className="px-3 py-2 text-end font-mono tabular-nums">{Number(r.amount).toFixed(2)}</td>
                    <td className="px-3 py-2 text-center">#{r.current_step}</td>
                    <td className="px-3 py-2 text-center">
                      <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>
                        {t(`approvals.status.${r.status}`)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-end">
                      {r.status === "pending" && (
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" className="text-success" onClick={() => actMut.mutate({ requestId: r.id, action: "approved" })}>
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => actMut.mutate({ requestId: r.id, action: "rejected" })}>
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="workflows" className="space-y-2">
          {workflows.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground text-sm">{t("approvals.noWorkflows")}</Card>
          ) : workflows.map((w: any) => (
            <Card key={w.id} className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm">{localized(w, "name")}</div>
                  <div className="text-xs text-muted-foreground">
                    {t(`approvals.doc.${w.document_type}`)} • {Number(w.min_amount).toFixed(0)} - {w.max_amount ? Number(w.max_amount).toFixed(0) : "∞"} {w.currency_code}
                  </div>
                </div>
                <Badge variant={w.is_active ? "default" : "secondary"}>{w.is_active ? t("common.active") : t("common.inactive")}</Badge>
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
      </Tabs>
    </div>
  );
}
