import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAccountingBuckets } from "@/lib/api/accounting.functions";
import { useLocalized } from "@/i18n";

/**
 * Fetch accounting buckets for a company and return helpers so any screen
 * (Classifications, Account Types, Chart of Accounts, etc.) can display the
 * user-defined bucket name/order instead of hardcoded translations.
 */
export function useAccountingBuckets(companyId: string | undefined) {
  const list = useServerFn(listAccountingBuckets);
  const localized = useLocalized();

  const { data: buckets = [] } = useQuery({
    queryKey: ["accounting_buckets", companyId],
    queryFn: () => list({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const byCode = useMemo(() => {
    const m = new Map<string, any>();
    (buckets as any[]).forEach((b) => m.set(b.code, b));
    return m;
  }, [buckets]);

  const bucketName = (code?: string | null, fallback?: string) => {
    if (!code) return fallback ?? "—";
    const b = byCode.get(code);
    return b ? localized(b, "name") : (fallback ?? code);
  };

  const bucketOrder = (code?: string | null) =>
    byCode.get(code ?? "")?.sort_order ?? 9999;

  return { buckets: buckets as any[], byCode, bucketName, bucketOrder };
}
