// Shared staging mechanism: "Create Bill" on a Purchase Order stashes a
// pre-filled draft here, then navigates to the Vendor Bills page, which
// picks it up on mount and opens the New Bill dialog already populated —
// no new invoice table/schema needed, just a handoff between two screens.
export const POBILL_STAGING_KEY = "po_to_bill_draft";

export type PoToBillLine = {
  description: string;
  product_id: string | null;
  account_id: string | null;
  quantity: number;
  /** Unit price already net of Discount 1 & 2 — the invoice schema has no discount fields of its own. */
  unit_price: number;
  tax_id: string | null;
  tax_rate: number;
};

export type PoToBillDraft = {
  purchase_order_id: string;
  vendor_id: string;
  reference: string;
  lines: PoToBillLine[];
};
