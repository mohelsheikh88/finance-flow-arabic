import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPlaceholder } from "@/components/coming-soon-placeholder";

export const Route = createFileRoute("/_authenticated/medical-dashboard")({
  component: MedicalDashboardPage,
});

function MedicalDashboardPage() {
  return <ComingSoonPlaceholder />;
}
