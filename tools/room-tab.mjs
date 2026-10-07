/* the rooms under reduced motion, a room picked by its tab: PORT OUT TAG ROOM THEME node dossier.mjs */
import { chromium } from '/home/user/3abida/node_modules/playwright/index.mjs';
import fs from 'fs';
const { PORT, OUT, TAG, ROOM = 'Dossier', THEME = 'dark' } = process.env;
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: THEME, reducedMotion: 'reduce' })).newPage();
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
await page.waitForTimeout(1500);
await page.evaluate(() => { const el = document.querySelector('#rooms-head'); scrollTo(0, el.getBoundingClientRect().top + scrollY - 110); });
await page.waitForTimeout(800);
const tab = page.getByRole('tab', { name: ROOM });
await tab.click();
await page.mouse.move(1430, 890);
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/${TAG}-${ROOM.toLowerCase()}-${THEME}.png` });
const src = await page.evaluate(() => [...document.querySelectorAll('[data-terminal-window]')].map(w => w.getAttribute('data-terminal-window')).join(','));
console.log(TAG, ROOM, THEME, 'window', src);
await browser.close();
