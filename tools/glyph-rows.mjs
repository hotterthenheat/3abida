/* close-ups of the landing's glyph rows: the rooms' tabs and the closing row, at 2x: PORT OUT TAG THEME node glyphrows.mjs */
import { chromium } from '/home/user/3abida/node_modules/playwright/index.mjs';
import fs from 'fs';
const { PORT, OUT, TAG, THEME = 'dark' } = process.env;
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: THEME, reducedMotion: 'reduce' })).newPage();
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
await page.waitForTimeout(1500);
const tabs = page.getByRole('tablist').first();
await tabs.scrollIntoViewIfNeeded();
await page.waitForTimeout(600);
await tabs.screenshot({ path: `${OUT}/${TAG}-tabs-${THEME}.png` });
const row = page.locator('a[aria-label="Open Pulse"]').last().locator('xpath=ancestor::*[count(.//a[starts-with(@aria-label,"Open ")])>=8][1]');
await row.scrollIntoViewIfNeeded();
await page.waitForTimeout(900);
await row.screenshot({ path: `${OUT}/${TAG}-closerow-${THEME}.png` });
console.log(TAG, THEME, 'ok');
await browser.close();
