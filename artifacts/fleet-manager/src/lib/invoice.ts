export type InvoiceLine = {
  date: string;
  description: string;
  amount: number;
  duration?: string;
};

export type InvoicePayment = {
  date: string;
  amount: number;
  paymentMode?: string;
  description?: string;
};

export type InvoiceData = {
  invoiceId: string;
  issuedAt: string;
  issuedTime: string;
  businessName: string;
  companyName: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  bankName: string;
  gstNumber: string;
  upiId: string;
  logoUrl?: string;
  customerName: string;
  customerPhone: string;
  customerCompany: string;
  customerAddress: string;
  workStart: string;
  workEnd: string;
  serviceLocation: string;
  lines: InvoiceLine[];
  payments?: InvoicePayment[];
  total: number;
  paidAmount?: number;
  subtotal?: number;
  gstPercentage?: number;
  gstAmount?: number;
  addGst?: boolean;
  balanceDue: number;
  status: "PAID" | "PENDING" | "DELAY";
  paymentDate?: string;
  paymentReference?: string;
  paymentMode?: string;
  delayStartDate?: string;
  delayEndDate?: string;
};

export function amountInWords(amount: number) {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const underThousand = (value: number): string => {
    if (value < 20) return ones[value];
    if (value < 100) return `${tens[Math.floor(value / 10)]}${value % 10 ? ` ${ones[value % 10]}` : ""}`;
    return `${ones[Math.floor(value / 100)]} Hundred${value % 100 ? ` ${underThousand(value % 100)}` : ""}`;
  };
  if (!Number.isFinite(amount) || amount <= 0) return "Zero Rupees Only";
  let value = Math.floor(amount);
  const parts: string[] = [];
  if (value >= 10000000) {
    parts.push(`${underThousand(Math.floor(value / 10000000))} Crore`);
    value %= 10000000;
  }
  if (value >= 100000) {
    parts.push(`${underThousand(Math.floor(value / 100000))} Lakh`);
    value %= 100000;
  }
  if (value >= 1000) {
    parts.push(`${underThousand(Math.floor(value / 1000))} Thousand`);
    value %= 1000;
  }
  if (value) parts.push(underThousand(value));
  return `${parts.join(" ")} Rupees Only`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[character] || character));
}

function money(value: number) {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function createInvoiceHtml(data: InvoiceData) {
  const rows = data.lines.map((line) => `
    <tr>
      <td>${escapeHtml(line.description)}${line.duration ? `<small>${escapeHtml(line.duration)}</small>` : ""}<span class="date">${escapeHtml(line.date)}</span></td>
      <td class="amount">${money(line.amount)}</td>
    </tr>`).join("");
  const paymentRows = (data.payments || []).map((payment) => `
    <tr class="payment-row">
      <td>Payment received: ${money(payment.amount)} via ${escapeHtml(payment.paymentMode || "Payment")}${payment.description ? ` • ${escapeHtml(payment.description)}` : ""}<span class="date">${escapeHtml(payment.date)}</span></td>
      <td>Received</td>
    </tr>`).join("");
  const paidAmount = Math.max(0, data.paidAmount || 0);
  const grandTotal = Math.max(0, data.total - paidAmount);
  const logo = data.logoUrl
    ? `<img class="logo" src="${data.logoUrl}" alt="Business logo" />`
    : `<div class="logo-fallback">${escapeHtml((data.companyName || "Receipt").slice(0, 2).toUpperCase())}</div>`;
  const statusColor = data.status === "PAID" ? "#4f9c59" : data.status === "DELAY" ? "#c98219" : "#667085";

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(data.customerName)} invoice</title><style>
   *{box-sizing:border-box}body{margin:0;background:#eef1f4;color:#101114;font-family:Arial,Helvetica,sans-serif;font-size:12px}.sheet{width:794px;min-height:1123px;margin:0 auto;background:#fff;padding:28px 30px 22px;overflow:visible}.brand{display:grid;grid-template-columns:96px minmax(0,1fr) 190px;align-items:center;gap:16px;padding-bottom:15px;border-bottom:3px solid #171717}.logo,.logo-fallback{width:96px;height:96px;object-fit:contain;border-radius:16px}.logo-fallback{display:flex;align-items:center;justify-content:center;background:#151515;color:#f5bb16;font-weight:900;font-size:27px}.business{font-size:25px;letter-spacing:1px;font-weight:700;overflow-wrap:anywhere}.subtitle{font-size:15px;margin-top:5px;letter-spacing:.4px}.address{font-size:11px;margin-top:6px;color:#555;max-width:420px;overflow-wrap:anywhere}.brand-contact{font-size:11px;line-height:1.65;overflow-wrap:anywhere}.box{border:1px solid #c9cdd1;border-radius:4px;padding:10px 12px;margin-top:11px;background:#fff}.meta{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;font-weight:700;font-size:13px}.meta span:last-child{text-align:right}.meta-row{margin-top:8px;overflow-wrap:anywhere}.section-title{font-size:15px;font-weight:800;margin:17px 0 6px}.client-grid{display:grid;grid-template-columns:125px minmax(0,1fr);gap:7px 12px}.label{font-weight:700}.summary{width:100%;table-layout:fixed;border-collapse:collapse;margin-top:7px}.summary th,.summary td{border:1px solid #b7bbc0;padding:7px 8px;text-align:left;overflow-wrap:anywhere;vertical-align:top}.summary th:first-child,.summary td:first-child{width:72%}.summary th:last-child,.summary td:last-child{text-align:right;width:28%;white-space:nowrap}.summary small,.summary .date{display:block;color:#555;font-size:10px;margin-top:3px}.total td{font-weight:800}.grand td{background:#252525;color:#fff;text-align:right!important;font-size:15px;font-weight:800}.payment-row td{color:#26733b}.payment-row td:last-child{text-align:left}.words{border-bottom:1px solid #777;padding:11px 0;font-size:13px;overflow-wrap:anywhere}.payment{margin-top:15px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}.payment ul{margin:5px 0 0;padding-left:17px;line-height:1.6}.sign{text-align:center;border-left:1px solid #ddd;padding-top:7px;overflow-wrap:anywhere}.status{display:inline-block;padding:3px 8px;border-radius:4px;color:#fff;background:${statusColor};font-weight:700}.signature{font-family:cursive;font-size:22px;margin-top:14px;opacity:.8}.footer{border-top:1px solid #777;margin-top:16px;padding-top:8px;text-align:center;font-size:11px;overflow-wrap:anywhere}@media print{body{background:#fff}.sheet{width:100%;padding:16mm 14mm}}@media(max-width:600px){body{font-size:10px}.sheet{width:100%;min-height:100vh;padding:14px 11px}.brand-contact{display:none}.logo,.logo-fallback{width:68px;height:68px}.business{font-size:17px}.subtitle{font-size:11px}.meta{font-size:10px}.section-title{font-size:13px}.box{padding:8px}.summary th,.summary td{padding:5px 4px}.payment{gap:7px}.footer{font-size:8px}}
  </style></head><body><main class="sheet">
     <header class="brand">${logo}<div><div class="business">${escapeHtml(data.companyName || "")}</div><div class="address">${escapeHtml(data.address || "")}</div></div><div class="brand-contact">${data.phone ? `☎ ${escapeHtml(data.phone)}<br>` : ""}${data.email ? `✉ ${escapeHtml(data.email)}<br>` : ""}${data.address ? `⌖ ${escapeHtml(data.address)}` : ""}</div></header>
    <section class="box"><div class="meta"><span>INVOICE ID: ${escapeHtml(data.invoiceId)}</span><span>Date &amp; Time: ${escapeHtml(data.issuedAt)} ${escapeHtml(data.issuedTime)}</span></div><div class="meta-row"><b>Work Date Range:</b> ${escapeHtml(data.workStart)} to ${escapeHtml(data.workEnd)} <span style="float:right"><b>Service Location:</b> ${escapeHtml(data.serviceLocation || "—")}</span></div></section>
    <h2 class="section-title">CLIENT INFORMATION</h2><section class="box client-grid"><div class="label">Contact Person:</div><div>${escapeHtml(data.customerName)}</div><div class="label">Phone:</div><div>${escapeHtml(data.customerPhone || "—")}</div><div class="label">Billing Address:</div><div>${escapeHtml(data.customerCompany || data.customerAddress || "—")}</div><div></div><div>${escapeHtml(data.customerAddress || "—")}</div></section>
    <h2 class="section-title">PAYMENT SUMMARY</h2><table class="summary"><thead><tr><th>Description</th><th>Amount (INR)</th></tr></thead><tbody>${rows || `<tr><td>No work entries</td><td class="amount">${money(0)}</td></tr>`}${paymentRows}<tr class="total"><td>Total Amount:</td><td>${money(data.subtotal ?? data.total)}</td></tr>${data.addGst && data.gstAmount ? `<tr><td>GST (${data.gstPercentage || 0}%):</td><td>${money(data.gstAmount)}</td></tr>` : ""}${paidAmount > 0 ? `<tr class="payment-total"><td>Paid Amount:</td><td>-${money(paidAmount)}</td></tr>` : ""}<tr class="grand"><td colspan="2">Grand Total: ${money(grandTotal)}</td></tr></tbody></table>
    <div class="words"><b>Amount in Words:</b> ${escapeHtml(amountInWords(grandTotal))}</div>
     <h2 class="section-title">PAYMENT DETAILS</h2><section class="payment"><div><ul><li>Invoice Issuing Date: ${escapeHtml(data.issuedAt)}</li><li>Payment Terms: 7 Days from Receipt</li><li>Payment Mode: ${escapeHtml(data.paymentMode || "—")}</li><li>Reference UPI: ${escapeHtml(data.paymentReference || data.upiId || "—")}</li><li>Status: <span class="status">${data.status}</span></li>${data.status === "DELAY" ? `<li>Delay Date Range: ${escapeHtml(data.delayStartDate || "—")} to ${escapeHtml(data.delayEndDate || "—")}</li>` : ""}<li>Balance Due: ${money(data.balanceDue)}</li><li>Date of Payment: ${escapeHtml(data.paymentDate || "—")}</li></ul></div><div class="sign">${data.ownerName ? `<div class="signature">${escapeHtml(data.ownerName)}</div><b>Authorized Signatory: ${escapeHtml(data.ownerName)}</b><br>` : ""}Designation: Owner / Authorized Signatory</div></section>
    <footer class="footer">${escapeHtml(data.phone || "—")} &nbsp;•&nbsp; ${escapeHtml(data.email || "—")} &nbsp;•&nbsp; ${escapeHtml(data.bankName || "—")} &nbsp;•&nbsp; GSTIN: ${escapeHtml(data.gstNumber || "—")}</footer>
  </main></body></html>`;
}