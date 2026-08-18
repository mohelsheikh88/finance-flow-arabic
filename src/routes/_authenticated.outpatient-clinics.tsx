import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPlaceholder } from "@/components/coming-soon-placeholder";

export const Route = createFileRoute("/_authenticated/outpatient-clinics")({
  component: OutpatientClinicsPage,
});

function OutpatientClinicsPage() {
  return <ComingSoonPlaceholder />;
}
