import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPlaceholder } from "@/components/coming-soon-placeholder";

export const Route = createFileRoute("/_authenticated/ambulance")({
  component: AmbulancePage,
});

function AmbulancePage() {
  return <ComingSoonPlaceholder />;
}
