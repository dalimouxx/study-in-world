// Vérification visuelle Bento Pop : charge les pages clés en fr/ar, sur ordinateur (1280) et téléphone (390),
// et vérifie des propriétés mesurables du rendu (pas de défilement horizontal, tokens présents, ombre Pop dans le
// bon sens selon la langue, police arabe, focus visible, champ invalide distinct).
// Usage : node scripts/visual-check.mjs [--base http://localhost:3000] [--shots] [--only /login]
// Prérequis : `npm run dev` (ou start) lancé ; l'API sur NEXT_PUBLIC_API_URL pour les pages authentifiées.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const arg = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const BASE = arg('--base', 'http://localhost:3000');
const SHOTS = args.includes('--shots');
const ONLY = arg('--only', null);
const ADMIN_EMAIL = process.env.VISUAL_ADMIN_EMAIL ?? 'admin@demo.local';
const ADMIN_PASSWORD = process.env.VISUAL_ADMIN_PASSWORD ?? 'LocalTest-2026-Pass';

const PUBLIC_PAGES = ['/', '/destinations', '/programs', '/login', '/portal/login', '/partner-portal/login'];
const ADMIN_PAGES = ['/dashboard', '/candidates', '/settings'];
const LOCALES = ['fr', 'ar'];
const WIDTHS = [1280, 390];

let failures = 0;
const report = (ok, name, ctx, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${ctx}${detail ? ` — ${detail}` : ''}`);
};

async function apiUp() {
  try {
    const r = await fetch('http://localhost:4000/api/health');
    return r.ok;
  } catch {
    return false;
  }
}

async function login(context) {
  const page = await context.newPage();
  await page.goto(`${BASE}/fr/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', ADMIN_EMAIL);
  await page.fill('#password', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|account)/, { timeout: 20000 });
  await page.close();
}

async function checkPage(page, path, locale, width) {
  const ctx = `${path} ${locale} ${width}`;
  await page.goto(`${BASE}/${locale}${path === '/' ? '' : path}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(700); // laisse finir les animations d'entrée

  const m = await page.evaluate(() => {
    const root = document.documentElement;
    const btn = [...document.querySelectorAll('[data-variant="primary"]')].find((b) => b.offsetParent !== null);
    const shadow = btn ? getComputedStyle(btn).boxShadow : null;
    // box-shadow calculé : "rgb(...) 4px 4px 0px 0px" → premier décalage horizontal
    const x = shadow && shadow !== 'none' ? parseFloat(shadow.replace(/rgba?\([^)]*\)/, '').trim().split(/\s+/)[0]) : null;
    return {
      overflow: root.scrollWidth - root.clientWidth,
      ink: getComputedStyle(root).getPropertyValue('--ink').trim(),
      surface: !!document.querySelector('[data-surface]'),
      shadowX: x,
      font: getComputedStyle(document.body).fontFamily,
    };
  });

  report(m.overflow <= 1, 'no-hscroll', ctx, m.overflow > 1 ? `${m.overflow}px de trop` : '');
  report(!!m.ink, 'ink-token', ctx);
  report(m.surface, 'surface', ctx);
  if (m.shadowX === null) console.log(`SKIP pop-button ${ctx} — aucun bouton primaire visible sur cette page`);
  else report(locale === 'ar' ? m.shadowX < 0 : m.shadowX > 0, locale === 'ar' ? 'rtl-shadow' : 'pop-button', ctx, `x=${m.shadowX}`);
  if (locale === 'ar') report(/readex/i.test(m.font), 'font-ar', ctx, m.font);

  await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const s = getComputedStyle(el);
    return { outline: s.outlineStyle, shadow: s.boxShadow };
  });
  report(!!focus && (focus.outline !== 'none' || focus.shadow !== 'none'), 'focus-visible', ctx);

  if (path === '/login' && locale === 'fr' && width === 1280) {
    const valid = await page.$eval('#password', (el) => getComputedStyle(el).borderColor);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);
    const invalid = await page.$eval('[aria-invalid="true"]', (el) => getComputedStyle(el).borderColor).catch(() => null);
    report(!!invalid && invalid !== valid, 'invalid-field', ctx, `${valid} → ${invalid}`);
  }

  if (SHOTS) {
    const name = `${path.replace(/\//g, '_') || '_home'}-${locale}-${width}`.replace(/^_/, '');
    await page.screenshot({ path: `.visual/${name || 'home'}.png`, fullPage: true });
  }
}

const browser = await chromium.launch();
mkdirSync('.visual', { recursive: true });
const withApi = await apiUp();
if (!withApi) console.log('INFO API injoignable : pages admin ignorées');
const keep = (p) => !ONLY || p === ONLY;
// Les pages publiques et de connexion sont vues déconnecté (sinon /login redirige vers le tableau de bord),
// les pages admin dans un contexte connecté séparé.
const groups = [
  { pages: PUBLIC_PAGES.filter(keep), auth: false },
  { pages: withApi ? ADMIN_PAGES.filter(keep) : [], auth: true },
];

for (const width of WIDTHS) for (const { pages, auth } of groups) {
  if (!pages.length) continue;
  const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, deviceScaleFactor: 1 });
  if (auth) await login(context);
  const page = await context.newPage();
  for (const locale of LOCALES) for (const path of pages) {
    try {
      await checkPage(page, path, locale, width);
    } catch (e) {
      report(false, 'load', `${path} ${locale} ${width}`, e.message.split('\n')[0]);
    }
  }
  await context.close();
}
await browser.close();
console.log(failures ? `\n${failures} échec(s)` : '\nTout passe');
process.exit(failures ? 1 : 0);
