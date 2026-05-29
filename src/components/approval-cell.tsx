import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getApprovalForDocument, actOnRequest } from "@/lib/api/approvals.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { useI18n, useLocalized } from "@/i18n";
import { CheckCircle2, XCircle, ShieldCheck, Clock } from "lucide-react";
import { toast } from "sonner";

type DocType = "journal_entry" | "invoice" | "payment" | "asset_disposal";

export function ApprovalCell({
  documentType,
  documentId,
}: {
  documentType: DocType;
  documentId: string;
}) {
  const { t } = useI18n();
  const localized = useLocalized();
  const qc = useQueryClient();
  const getFn = useServerFn(getApprovalForDocument);
  const actFn = useServerFn(actOnRequest);

  const { data } = useQuery({
    queryKey: ["approval-for-doc", documentType, documentId],
    queryFn: () => getFn({ data: { documentType, documentId } }),
  });

  const req = data?.request as any;

  const actMut = useMutation({
    mutationFn: (action: "approved" | "rejected") =>
      actFn({ data: { requestId: req.id, action } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["approval-for-doc", documentType, documentId] });
      // Also bust list queries so the parent screen status refreshes
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["je-list"] });
      toast.success(t("approvals.actionDone"));
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!req) {
    return <span className="text-[10px] text-muted-foreground">—</span>;
  }

  const variant =
    req.status === "approved" ? "default" :
    req.status === "rejected" ? "destructive" : "secondary";

  const wf = req.approval_workflows;
  const steps = (wf?.approval_steps_def || []).sort((a: any, b: any) => a.step_order - b.step_order);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 gap-1">
          {req.status === "pending" ? <Clock className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
          <Badge variant={variant} className="text-[10px]">
            {t(`approvals.status.${req.status}`)}
          </Badge>
          {req.status === "pending" && (
            <span className="text-[10px] font-mono">#{req.current_step}/{steps.length}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-2">
        <div className="text-xs font-bold">{wf ? localized(wf, "name") : "—"}</div>
        <div className="space-y-1">
          {steps.map((s: any) => {
            const done = s.step_order < req.current_step || req.status === "approved";
            const current = s.step_order === req.current_step && req.status === "pending";
            return (
              <div key={s.id} className="flex items-center gap-2 text-[11px]">
                <span className={`h-1.5 w-1.5 rounded-full ${done ? "bg-success" : current ? "bg-warning" : "bg-muted"}`} />
                <span className="flex-1">{localized(s, "step_name")}</span>
                <span className="text-muted-foreground">{t(`users.${s.required_role}`) || s.required_role}</span>
              </div>
            );
          })}
        </div>
        {req.status === "pending" && (
          <div className="flex gap-2 border-t pt-2">
            <Button size="sm" className="flex-1" onClick={() => actMut.mutate("approved")} disabled={actMut.isPending}>
              <CheckCircle2 className="h-3 w-3 me-1" />{t("approvals.status.approved")}
            </Button>
            <Button size="sm" variant="destructive" className="flex-1" onClick={() => actMut.mutate("rejected")} disabled={actMut.isPending}>
              <XCircle className="h-3 w-3 me-1" />{t("approvals.status.rejected")}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
