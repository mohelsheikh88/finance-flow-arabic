#!/usr/bin/env bash
# Export all application data (public schema) to CSV files.
# Usage:  DATABASE_URL="postgresql://user:pass@host:5432/postgres" ./export_data.sh ./export
set -euo pipefail

OUT_DIR="${1:-./export}"
mkdir -p "$OUT_DIR"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Set DATABASE_URL first (source database connection string)." >&2
  exit 1
fi

# Order matters for re-import (parents before children).
TABLES=(
  currencies companies branches classifications accounting_buckets account_types accounts
  cost_centers fiscal_periods fiscal_positions journals taxes payment_terms payment_methods
  bank_accounts customer_types partners partner_contacts partner_attachments
  exchange_rates lock_dates roles_registry profiles user_roles user_branch_access
  journal_entries journal_entry_lines invoices invoice_lines payments payment_allocations
  asset_categories fixed_assets depreciation_schedule asset_disposals
  approval_workflows approval_steps_def approval_requests approval_actions
  transaction_attachments audit_log
)

for t in "${TABLES[@]}"; do
  echo "→ exporting $t"
  psql "$DATABASE_URL" -c "\copy (SELECT * FROM public.$t) TO '$OUT_DIR/$t.csv' WITH (FORMAT csv, HEADER true)"
done

echo "Done. CSV files are in $OUT_DIR"
