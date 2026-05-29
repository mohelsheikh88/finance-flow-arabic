// Renders a self-contained ZATCA-style tax invoice in a new window and triggers print.
import QRCode from "qrcode";
import { buildZatcaQrPayload } from "@/lib/zatca";

type Line = {
  description?: string | null;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  accounts?: { code?: string; name_ar?: string; name_en?: string } | null;
};

export async function printTaxInvoice(args: {
  invoice: any;
  company: { name_ar?: string; name_en?: string; vat_number?: string; cr_number?: string; address_ar?: string; address_en?: string; phone?: string; logo_url?: string } | null;
  lang: "ar" | "en";
}) {
  const { invoice, company, lang } = args;
  const isAr = lang === "ar";

  const lines: Line[] = invoice.invoice_lines || [];
  const subtotal = lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unit_price), 0);
  const vat = lines.reduce(
    (s, l) => s + Number(l.quantity) * Number(l.unit_price) * (Number(l.tax_rate || 0) / 100),
    0,
  );
  const total = subtotal + vat;

  const sellerName = isAr ? company?.name_ar || company?.name_en || "" : company?.name_en || company?.name_ar || "";
  const qrPayload = buildZatcaQrPayload({
    sellerName,
    vatNumber: company?.vat_number || "",
    timestamp: invoice.invoice_date,
    total,
    vatAmount: vat,
  });
  const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 180 });

  const partner = invoice.partners || {};
  const partnerName = isAr ? partner.name_ar : partner.name_en;

  const fmt = (n: number) =>
    Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const labels = isAr
    ? {
        title: "فاتورة ضريبية",
        invNo: "رقم الفاتورة",
        date: "التاريخ",
        due: "تاريخ الاستحقاق",
        seller: "البائع",
        buyer: "المشتري",
        vatNo: "الرقم الضريبي",
        crNo: "السجل التجاري",
        ref: "المرجع",
        description: "الوصف",
        qty: "الكمية",
        price: "السعر",
        vatRate: "الضريبة",
        lineTotal: "الإجمالي",
        subtotal: "المجموع قبل الضريبة",
        vat: "ضريبة القيمة المضافة",
        total: "الإجمالي شامل الضريبة",
        notes: "ملاحظات",
        qr: "رمز الاستجابة الضريبي",
        footer: "هذه الفاتورة مُولّدة إلكترونياً ومطابقة لمتطلبات هيئة الزكاة والضريبة والجمارك",
      }
    : {
        title: "TAX INVOICE",
        invNo: "Invoice No.",
        date: "Date",
        due: "Due Date",
        seller: "Seller",
        buyer: "Buyer",
        vatNo: "VAT No.",
        crNo: "CR No.",
        ref: "Reference",
        description: "Description",
        qty: "Qty",
        price: "Price",
        vatRate: "VAT",
        lineTotal: "Total",
        subtotal: "Subtotal",
        vat: "VAT",
        total: "Total (incl. VAT)",
        notes: "Notes",
        qr: "ZATCA QR",
        footer: "This invoice is electronically generated and complies with ZATCA requirements",
      };

  const html = `<!doctype html><html dir="${isAr ? "rtl" : "ltr"}" lang="${isAr ? "ar" : "en"}">
<head>
<meta charset="utf-8" />
<title>${labels.title} — ${invoice.invoice_number}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: ${isAr ? "'Segoe UI','Tahoma','Arial'" : "'Segoe UI','Helvetica','Arial'"}, sans-serif; color: #111; margin: 0; padding: 24px; background: #fff; font-size: 12px; }
  .doc { max-width: 800px; margin: 0 auto; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px double #111; padding-bottom: 16px; margin-bottom: 16px; }
  .brand h1 { margin: 0 0 4px; font-size: 22px; letter-spacing: 0.5px; }
  .brand .sub { color: #555; font-size: 11px; line-height: 1.6; }
  .logo { max-height: 70px; max-width: 180px; object-fit: contain; }
  .title-bar { background: #111; color: #fff; padding: 8px 14px; font-size: 16px; font-weight: 700; letter-spacing: 1px; display: flex; justify-content: space-between; margin-bottom: 16px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .box { border: 1px solid #ddd; border-radius: 4px; padding: 10px 12px; }
  .box h3 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; color: #666; letter-spacing: 1px; }
  .box .name { font-weight: 700; font-size: 13px; }
  .box .meta { color: #555; font-size: 11px; margin-top: 2px; }
  table.lines { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  table.lines th { background: #f4f4f4; padding: 8px 6px; text-align: ${isAr ? "right" : "left"}; font-size: 11px; border-bottom: 2px solid #111; }
  table.lines td { padding: 8px 6px; border-bottom: 1px solid #eee; font-size: 11px; vertical-align: top; }
  table.lines .num { text-align: ${isAr ? "left" : "right"}; font-variant-numeric: tabular-nums; font-family: 'Consolas','Menlo',monospace; }
  .totals { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; margin-top: 8px; }
  .qr { text-align: center; }
  .qr img { border: 1px solid #ddd; padding: 4px; background: #fff; }
  .qr .lbl { font-size: 10px; color: #666; margin-top: 4px; }
  .totals-table { width: 320px; }
  .totals-table tr td { padding: 6px 8px; font-size: 12px; }
  .totals-table tr td:last-child { text-align: ${isAr ? "left" : "right"}; font-family: 'Consolas','Menlo',monospace; }
  .totals-table tr.grand td { border-top: 2px solid #111; border-bottom: 3px double #111; font-weight: 700; font-size: 14px; padding-top: 10px; padding-bottom: 10px; }
  .notes { margin-top: 18px; padding-top: 10px; border-top: 1px dashed #ccc; color: #555; font-size: 11px; }
  .footer { margin-top: 24px; text-align: center; font-size: 10px; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
  @media print { body { padding: 0; } .no-print { display: none; } }
  .toolbar { position: fixed; top: 12px; ${isAr ? "left" : "right"}: 12px; }
  .toolbar button { padding: 8px 16px; font-size: 13px; cursor: pointer; border: 1px solid #111; background: #111; color: #fff; border-radius: 4px; }
</style>
</head>
<body>
<div class="toolbar no-print"><button onclick="window.print()">${isAr ? "طباعة" : "Print"}</button></div>
<div class="doc">
  <div class="head">
    <div class="brand">
      ${company?.logo_url ? `<img class="logo" src="${company.logo_url}" alt="logo" />` : ""}
      <h1>${sellerName || ""}</h1>
      <div class="sub">
        ${company?.vat_number ? `${labels.vatNo}: <b>${company.vat_number}</b><br/>` : ""}
        ${company?.cr_number ? `${labels.crNo}: ${company.cr_number}<br/>` : ""}
        ${(isAr ? company?.address_ar : company?.address_en) || ""}
        ${company?.phone ? `<br/>${company.phone}` : ""}
      </div>
    </div>
    <div class="qr">
      <img src="${qrDataUrl}" alt="QR" />
      <div class="lbl">${labels.qr}</div>
    </div>
  </div>

  <div class="title-bar">
    <span>${labels.title}</span>
    <span style="font-family:'Consolas','Menlo',monospace;">${invoice.invoice_number}</span>
  </div>

  <div class="grid2">
    <div class="box">
      <h3>${labels.buyer}</h3>
      <div class="name">${partnerName || partner.name_en || partner.name_ar || ""}</div>
      ${partner.vat_number ? `<div class="meta">${labels.vatNo}: ${partner.vat_number}</div>` : ""}
      ${partner.code ? `<div class="meta">${partner.code}</div>` : ""}
    </div>
    <div class="box">
      <h3>${labels.date}</h3>
      <div class="name">${invoice.invoice_date}</div>
      ${invoice.due_date ? `<div class="meta">${labels.due}: ${invoice.due_date}</div>` : ""}
      ${invoice.reference ? `<div class="meta">${labels.ref}: ${invoice.reference}</div>` : ""}
    </div>
  </div>

  <table class="lines">
    <thead>
      <tr>
        <th style="width:30px;">#</th>
        <th>${labels.description}</th>
        <th class="num" style="width:60px;">${labels.qty}</th>
        <th class="num" style="width:90px;">${labels.price}</th>
        <th class="num" style="width:70px;">${labels.vatRate}</th>
        <th class="num" style="width:110px;">${labels.lineTotal}</th>
      </tr>
    </thead>
    <tbody>
      ${lines
        .map((l, i) => {
          const sub = Number(l.quantity) * Number(l.unit_price);
          const lt = sub * (1 + Number(l.tax_rate || 0) / 100);
          const accName = isAr ? l.accounts?.name_ar : l.accounts?.name_en;
          const desc = l.description || accName || "";
          return `<tr>
            <td>${i + 1}</td>
            <td>${desc}</td>
            <td class="num">${fmt(Number(l.quantity))}</td>
            <td class="num">${fmt(Number(l.unit_price))}</td>
            <td class="num">${Number(l.tax_rate || 0)}%</td>
            <td class="num"><b>${fmt(lt)}</b></td>
          </tr>`;
        })
        .join("")}
    </tbody>
  </table>

  <div class="totals">
    <div style="flex:1; min-width:0;">
      ${invoice.notes ? `<div class="notes"><b>${labels.notes}:</b> ${invoice.notes}</div>` : ""}
    </div>
    <table class="totals-table">
      <tr><td>${labels.subtotal}</td><td>${fmt(subtotal)}</td></tr>
      <tr><td>${labels.vat}</td><td>${fmt(vat)}</td></tr>
      <tr class="grand"><td>${labels.total}</td><td>${fmt(total)} ${invoice.currency_code || "SAR"}</td></tr>
    </table>
  </div>

  <div class="footer">${labels.footer}</div>
</div>
<script>setTimeout(() => window.print(), 350);</script>
</body></html>`;

  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) {
    throw new Error("Popup blocked. Allow pop-ups to print.");
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
