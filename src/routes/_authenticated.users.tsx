import { createFileRoute } from "@tanstack/react-router";
import { useI18n } from "@/i18n";
import { UserRolesManagement } from "@/components/user-roles-management";
import { Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/users")({
  component: Page,
});

function Page() {
  const { t } = useI18n();
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        <h1 className="page-title">{t("users.title")}</h1>
      </div>
      <UserRolesManagement />
    </div>
  );
}
