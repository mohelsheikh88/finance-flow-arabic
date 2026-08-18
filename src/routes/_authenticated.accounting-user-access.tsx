import { createFileRoute } from "@tanstack/react-router";
import { useI18n } from "@/i18n";
import { useNavGroups } from "@/lib/nav-config";
import { ModuleSectionAccessManagement } from "@/components/module-section-access";
import { UserCog } from "lucide-react";

export const Route = createFileRoute("/_authenticated/accounting-user-access")({
  component: Page,
});

function Page() {
  const { t } = useI18n();
  const groups = useNavGroups();
  const accounting = groups.find((g) => g.key === "accounting");

  // Every section of Accounting EXCEPT Configuration itself — granting
  // access to Configuration is a bigger admin capability handled
  // separately (top-level "Allowed Modules"), not casually from here.
  const sections = (accounting?.subgroups ?? []).filter((sg) => sg.key !== "accountingConfiguration");

  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <UserCog className="h-5 w-5 text-muted-foreground" />
          {t("common.sectionAccessTitle")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("common.sectionAccessSubtitle")}</p>
      </div>

      <ModuleSectionAccessManagement moduleKey="accounting" sections={sections} />
    </div>
  );
}
