import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getApprovalForDocument, actOnRequest } from "@/lib/api/approvals.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  CircleDot,
  Circle,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n, useLocalized } from "@/i18n";

type DocType = "journal_entry" | "invoice" | "payment" | "asset_disposal";

export function ApprovalWorkflowTimeline({
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

  const queryKey = ["approval-for-doc", documentType, documentId];
  const { data } = useQuery({
    queryKey,
    queryFn: () => getFn({ data: { documentType, documentId } }),
  });

  const req: any = data?.request;
  const actMut = useMutation({
    mutationFn: (action: "approved" | "rejected") =>
      actFn({ data: { requestId: req.id, action } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["je-list"] });
      toast.success(t("approvals.actionDone"));
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="border rounded-lg p-3 bg-muted/20">
      <div className="flex items-center gap-2 text-sm font-semibold mb-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <span>{t("approvals.workflow") || "مسار الاعتماد"}</span>
      </div>

      {!req ? (
        <div className="text-[11px] text-muted-foreground text-center py-3">
          {t("approvals.noWorkflow") || "لا يوجد مسار اعتماد مطبق على هذه العملية"}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-xs font-medium">
              {req.approval_workflows ? localized(req.approval_workflows, "name") : "—"}
            </span>
            <Badge
              variant={
                req.status === "approved"
                  ? "default"
                  : req.status === "rejected"
                    ? "destructive"
                    : "secondary"
              }
              className="text-[10px]"
            >
              {req.status === "pending" && <Clock className="h-3 w-3 me-1" />}
              {req.status === "approved" && <CheckCircle2 className="h-3 w-3 me-1" />}
              {req.status === "rejected" && <XCircle className="h-3 w-3 me-1" />}
              {t(`approvals.status.${req.status}`)}
            </Badge>
          </div>

          {/* Steps timeline */}
          <ol className="relative border-s-2 border-muted ms-2 space-y-3">
            {(req.approval_workflows?.approval_steps_def || [])
              .slice()
              .sort((a: any, b: any) => a.step_order - b.step_order)
              .map((step: any) => {
                const action = (req.approval_actions || []).find(
                  (a: any) => a.step_order === step.step_order,
                );
                const done = action != null;
                const isCurrent = req.status === "pending" && step.step_order === req.current_step;
                const rejected = action?.action === "rejected";

                let dot;
                if (done && rejected) dot = <XCircle className="h-4 w-4 text-destructive" />;
                else if (done) dot = <CheckCircle2 className="h-4 w-4 text-success" />;
                else if (isCurrent) dot = <CircleDot className="h-4 w-4 text-warning animate-pulse" />;
                else dot = <Circle className="h-4 w-4 text-muted-foreground" />;

                return (
                  <li key={step.id} className="ms-4">
                    <span className="absolute -start-[9px] flex items-center justify-center w-4 h-4 bg-background rounded-full">
                      {dot}
                    </span>
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="text-xs font-medium">
                        <span className="text-muted-foreground font-mono me-1">#{step.step_order}</span>
                        {localized(step, "step_name")}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {t(`users.${step.required_role}`) || step.required_role}
                      </span>
                    </div>
                    {action && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(action.acted_at).toLocaleString()}
                        {action.comments && <> — {action.comments}</>}
                      </div>
                    )}
                  </li>
                );
              })}
          </ol>

          {req.status === "pending" && (
            <div className="flex gap-2 border-t mt-3 pt-3">
              <Button
                size="sm"
                className="flex-1"
                onClick={() => actMut.mutate("approved")}
                disabled={actMut.isPending}
              >
                <CheckCircle2 className="h-3.5 w-3.5 me-1" />
                {t("approvals.status.approved")}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1"
                onClick={() => actMut.mutate("rejected")}
                disabled={actMut.isPending}
              >
                <XCircle className="h-3.5 w-3.5 me-1" />
                {t("approvals.status.rejected")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
