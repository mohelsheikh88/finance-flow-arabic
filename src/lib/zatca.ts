// ZATCA Phase 1 (Simplified) e-invoice QR — TLV Base64
// Tags: 1=Seller Name, 2=VAT Reg, 3=Timestamp(ISO8601), 4=Total (incl VAT), 5=VAT amount

function tlv(tag: number, value: string): Uint8Array {
  const v = new TextEncoder().encode(value);
  const out = new Uint8Array(2 + v.length);
  out[0] = tag;
  out[1] = v.length;
  out.set(v, 2);
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return typeof window === "undefined"
    ? Buffer.from(bytes).toString("base64")
    : window.btoa(bin);
}

export function buildZatcaQrPayload(args: {
  sellerName: string;
  vatNumber: string;
  timestamp: string | Date;
  total: number;
  vatAmount: number;
}): string {
  const ts =
    typeof args.timestamp === "string"
      ? new Date(args.timestamp).toISOString()
      : args.timestamp.toISOString();

  const parts = [
    tlv(1, args.sellerName || ""),
    tlv(2, args.vatNumber || ""),
    tlv(3, ts),
    tlv(4, Number(args.total || 0).toFixed(2)),
    tlv(5, Number(args.vatAmount || 0).toFixed(2)),
  ];
  const total = parts.reduce((s, p) => s + p.length, 0);
  const buf = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    buf.set(p, off);
    off += p.length;
  }
  return toBase64(buf);
}
