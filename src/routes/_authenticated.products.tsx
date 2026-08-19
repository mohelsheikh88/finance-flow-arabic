import { createFileRoute, Link } from "@tanstack/react-router";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { ProductsTab } from "@/components/purchase/products-tab";
import { ArrowLeft, Tags } from "lucide-react";

export const Route = createFileRoute("/_authenticated/products")({
  component: Page,
});

function Page() {
  const { t } = useI18n();
  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/apps"><ArrowLeft className="h-4 w-4 me-1" />{t("nav.purchaseProcurement")}</Link>
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Tags className="h-5 w-5 text-muted-foreground" />
        <h1 className="page-title">{t("purchase.products")}</h1>
      </div>
      <ProductsTab mode="all" />
    </div>
  );
}
