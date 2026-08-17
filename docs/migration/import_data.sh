#!/usr/bin/env bash
# Import CSV files (produced by export_data.sh) into YOUR own Supabase/Postgres project.
# Run 01_schema_full.sql on the target database FIRST.
# Usage:  TARGET_DATABASE_URL="postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres" ./import_data.sh ./export
set -euo pipefail

IN_DIR="${1:-./export}"

if [ -z "${TARGET_DATABASE_URL:-}" ]; then
  echo "Set TARGET_DATABASE_URL first (destination database connection string)." >&2
  exit 1
fi

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

# Disable triggers during load so lock-date / audit triggers don't block historical rows.
psql "$TARGET_DATABASE_URL" -c "SET session_replication_role = replica;" >/dev/null

for t in "${TABLES[@]}"; do
  f="$IN_DIR/$t.csv"
  [ -f "$f" ] || { echo "skip $t (no file)"; continue; }
  echo "→ importing $t"
  psql "$TARGET_DATABASE_URL" \
    -c "SET session_replication_role = replica;" \
    -c "\copy public.$t FROM '$f' WITH (FORMAT csv, HEADER true)"
done

echo "Done. Verify row counts, then re-enable normal trigger behaviour (new sessions do this automatically)."
