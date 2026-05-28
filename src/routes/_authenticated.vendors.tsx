import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/vendors")({
  beforeLoad: () => {
    throw redirect({ to: "/partners" });
  },
});
