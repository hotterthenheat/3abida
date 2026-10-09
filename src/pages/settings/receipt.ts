/*
==================================================
  SLAYER TERMINAL - A RECEIPT, AS A PDF (pages/settings/receipt.ts)

  Settings › Billing's "PDF" door (the audit's SE-1:
  it did nothing). The receipt is built here, on this
  machine, from the invoice's own row — the date, the
  plan, the amount, its standing, the card's face —
  as a one-page PDF in the PDF's own Helvetica: a few
  hundred bytes of text, no library. Words are kept
  to plain ASCII, which the base font draws as typed.
==================================================
*/

import type { Billing, Invoice } from '../../data/billing';

/** Plain ASCII for the base font: dashes, dots and quotes as the keyboard types them; brackets and backslashes escaped */
const pdfText = (s: string): string =>
  s
    .replace(/[–—]/g, '-')
    .replace(/[·•]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7e]/g, '')
    .replace(/([\\()])/g, '\\$1');

interface Line {
  text: string;
  size: number;
  y: number;
  x?: number;
  bold?: boolean;
}

/** One page of lines, as the bytes of a PDF */
function buildPdf(lines: Line[]): string {
  const content = lines.map(l => `BT /${l.bold ? 'F2' : 'F1'} ${l.size} Tf ${l.x ?? 56} ${l.y} Td (${pdfText(l.text)}) Tj ET`).join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  /* every byte is ASCII, so the string's length is its byte count and the offsets above hold */
  return out;
}

/** The receipt for one invoice, downloaded as "slayer-receipt-<id>.pdf" */
export function downloadReceipt(inv: Invoice, ctx: { planName: string; date: string; billing: Billing; name: string; email: string; descriptor: string; company: string }): void {
  const card = ctx.billing.card ? `${ctx.billing.card.brand} ending ${ctx.billing.card.last4}` : 'No card on file';
  const amount = `$${inv.amount.toFixed(2)} USD`;
  let y = 770;
  const next = (gap: number) => (y -= gap);
  const lines: Line[] = [
    { text: ctx.company, size: 18, y, bold: true },
    { text: 'Receipt', size: 12, y: next(26) },
    { text: `Receipt ${inv.id}`, size: 10, y: next(30) },
    { text: `Date: ${ctx.date}`, size: 10, y: next(16) },
    { text: `Billed to: ${[ctx.name, ctx.email].filter(Boolean).join(', ')}`, size: 10, y: next(16) },
    { text: `Paid with: ${card}`, size: 10, y: next(16) },
    { text: 'Description', size: 10, y: next(36), bold: true },
    { text: 'Amount', size: 10, y, x: 440, bold: true },
    { text: `${ctx.planName} plan, one month`, size: 10, y: next(18) },
    { text: amount, size: 10, y, x: 440 },
    { text: 'Total', size: 11, y: next(28), bold: true },
    { text: amount, size: 11, y, x: 440, bold: true },
    { text: `Status: ${inv.status}`, size: 10, y: next(28) },
    { text: `Your card statement reads: ${ctx.descriptor}`, size: 9, y: next(40) },
  ];
  const blob = new Blob([buildPdf(lines)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `slayer-receipt-${inv.id}.pdf`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
