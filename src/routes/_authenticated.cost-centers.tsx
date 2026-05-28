import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/_authenticated/cost-centers")({
  component: Page,
});

function Page() {
  const { t } = useI18n();
  return <ComingSoon title={t("nav.cost-centers")} />;
}
