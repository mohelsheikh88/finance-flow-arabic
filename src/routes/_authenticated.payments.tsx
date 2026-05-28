import { createFileRoute } from "@tanstack/react-router";
import { PaymentsView } from "@/components/payments-view";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/_authenticated/payments")({
  component: Page,
});

function Page() {
  const { t } = useI18n();
  return <PaymentsView initialDirection="outbound" lockDirection title={t("ap.payments")} />;
}
