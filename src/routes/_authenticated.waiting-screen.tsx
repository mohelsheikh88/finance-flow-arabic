import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPlaceholder } from "@/components/coming-soon-placeholder";

export const Route = createFileRoute("/_authenticated/waiting-screen")({
  component: WaitingScreenPage,
});

function WaitingScreenPage() {
  return <ComingSoonPlaceholder />;
}
