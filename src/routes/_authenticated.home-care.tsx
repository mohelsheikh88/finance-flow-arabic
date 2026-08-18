import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPlaceholder } from "@/components/coming-soon-placeholder";

export const Route = createFileRoute("/_authenticated/home-care")({
  component: HomeCarePage,
});

function HomeCarePage() {
  return <ComingSoonPlaceholder />;
}
