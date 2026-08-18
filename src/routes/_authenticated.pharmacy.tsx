import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPlaceholder } from "@/components/coming-soon-placeholder";

export const Route = createFileRoute("/_authenticated/pharmacy")({
  component: PharmacyPage,
});

function PharmacyPage() {
  return <ComingSoonPlaceholder />;
}
