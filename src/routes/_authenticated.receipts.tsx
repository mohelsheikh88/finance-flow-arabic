import { createFileRoute } from "@tanstack/react-router";
import { PaymentsView } from "@/components/payments-view";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/_authenticated/receipts")({
  component: Page,
});

function Page() {
  const { t } = useI18n();
  return <PaymentsView initialDirection="inbound" lockDirection title={t("ar.receipts")} />;
}
