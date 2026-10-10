/*
==================================================
  SLAYER TERMINAL - WHO WE ARE, IN ONE PLACE (data/company.ts)

  The names and addresses the footer, the legal pages, the status page and the mail all print. The legal name and the
  mailing address are the Logo System's own placeholders until the company is formed — fill them here, once. A
  placeholder never shows: `filled` reads it as missing, and the page leaves it out (the owner, 2026-10-01).
==================================================
*/

export const COMPANY = {
  product: 'Slayer Terminal',
  legalName: '[Company legal name]',
  address: '[Mailing address]',
  site: 'slayerterminal.com',
  handle: '@JoinSlayer',
  x: 'https://x.com/JoinSlayer',
  info: 'info@slayerterminal.com',
  support: 'support@slayerterminal.com',
  billing: 'billing@slayerterminal.com',
  press: 'press@slayerterminal.com',
  /** what a card statement reads */
  descriptor: 'SLAYER TERMINAL',
} as const;

/** WHEN A MAINTENANCE WINDOW ENDS (an instant, ISO 8601), for /maintenance to say — set here when one is planned; the
    host's maintenance page may name it in the address instead (`/maintenance?until=…`). Null: none is planned, and the
    page says only that the terminal is down. */
export const MAINTENANCE_UNTIL: string | null = null;

/** A field as written, or null while it is still a "[placeholder]" */
export const filled = (value: string): string | null => (/^\[.*\]$/.test(value.trim()) ? null : value);
