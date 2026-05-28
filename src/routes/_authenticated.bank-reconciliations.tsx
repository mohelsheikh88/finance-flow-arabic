import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/_authenticated/bank-reconciliations")({
  component: () => {
    const { t } = useI18n();
    return <ComingSoon title={t("banksGroup.reconciliations")} />;
  },
});
