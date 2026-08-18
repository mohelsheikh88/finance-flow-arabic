import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPlaceholder } from "@/components/coming-soon-placeholder";

export const Route = createFileRoute("/_authenticated/insurance")({
  component: InsurancePage,
});

function InsurancePage() {
  return <ComingSoonPlaceholder />;
}
