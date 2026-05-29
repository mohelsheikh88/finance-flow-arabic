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
    <div className="border rounded-md px-3 py-2 bg-muted/20">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          <span>{t("approvals.workflow") || "مسار الاعتماد"}</span>
          {req?.approval_workflows && (
            <span className="text-[10px] text-muted-foreground font-normal">
              — {localized(req.approval_workflows, "name")}
            </span>
          )}
        </div>
        {req && (
          <Badge
            variant={
              req.status === "approved"
                ? "default"
                : req.status === "rejected"
                  ? "destructive"
                  : "secondary"
            }
            className="text-[9px] h-5 px-1.5"
          >
            {req.status === "pending" && <Clock className="h-2.5 w-2.5 me-1" />}
            {req.status === "approved" && <CheckCircle2 className="h-2.5 w-2.5 me-1" />}
            {req.status === "rejected" && <XCircle className="h-2.5 w-2.5 me-1" />}
            {t(`approvals.status.${req.status}`)}
          </Badge>
        )}
      </div>

      {!req ? (
        <div className="text-[10px] text-muted-foreground text-center py-2">
          {t("approvals.noWorkflow") || "لا يوجد مسار اعتماد مطبق على هذه العملية"}
        </div>
      ) : (
        <>

          {/* Horizontal journey stepper */}
          {(() => {
            const nodes = (req.approval_workflows?.approval_steps_def || [])
              .slice()
              .sort((a: any, b: any) => a.step_order - b.step_order);

            return (
              <div className="w-full overflow-x-auto pb-2">
                <ol className="flex items-start justify-between gap-0 min-w-full px-2" dir="rtl">
                  {nodes.map((step: any, idx: number) => {
                    const action = (req.approval_actions || []).find(
                      (a: any) => a.step_order === step.step_order,
                    );
                    const done = action != null;
                    const isCurrent =
                      req.status === "pending" && step.step_order === req.current_step;
                    const rejected = action?.action === "rejected";

                    let circleCls = "bg-background border-muted text-muted-foreground";
                    let icon: any = <span className="text-[10px] font-semibold">{idx + 1}</span>;
                    let labelCls = "text-muted-foreground";
                    let connectorCls = "bg-muted";

                    if (done && rejected) {
                      circleCls = "bg-destructive border-destructive text-destructive-foreground";
                      icon = <XCircle className="h-3.5 w-3.5" />;
                      labelCls = "text-destructive font-semibold";
                      connectorCls = "bg-destructive";
                    } else if (done) {
                      circleCls = "bg-success border-success text-success-foreground";
                      icon = <CheckCircle2 className="h-3.5 w-3.5" />;
                      labelCls = "text-success font-semibold";
                      connectorCls = "bg-success";
                    } else if (isCurrent) {
                      circleCls =
                        "bg-primary border-primary text-primary-foreground ring-2 ring-primary/20 animate-pulse";
                      icon = <Clock className="h-3.5 w-3.5" />;
                      labelCls = "text-primary font-bold";
                    }

                    const isLast = idx === nodes.length - 1;

                    return (
                      <li
                        key={step.id}
                        className="flex-1 flex flex-col items-center relative min-w-[64px]"
                      >
                        <div className="flex items-center w-full">
                          {idx > 0 && (
                            <div
                              className={`h-0.5 flex-1 ${
                                done || isCurrent ? connectorCls : "bg-muted"
                              }`}
                            />
                          )}
                          {idx === 0 && <div className="flex-1" />}
                          <div
                            className={`h-7 w-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${circleCls}`}
                          >
                            {icon}
                          </div>
                          {!isLast && <div className="h-0.5 flex-1 bg-muted" />}
                          {isLast && <div className="flex-1" />}
                        </div>
                        <div className={`mt-1 text-[10px] leading-tight text-center px-0.5 ${labelCls}`}>
                          {localized(step, "step_name")}
                        </div>
                        <div className="text-[9px] text-muted-foreground/80 text-center leading-tight">
                          {t(`users.${step.required_role}`) || step.required_role}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          })()}

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
