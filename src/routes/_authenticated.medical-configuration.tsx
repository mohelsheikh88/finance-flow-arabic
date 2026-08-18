import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPlaceholder } from "@/components/coming-soon-placeholder";

export const Route = createFileRoute("/_authenticated/medical-configuration")({
  component: MedicalConfigurationPage,
});

function MedicalConfigurationPage() {
  return <ComingSoonPlaceholder />;
}
