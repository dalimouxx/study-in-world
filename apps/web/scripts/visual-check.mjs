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

const PUBLIC_PAGES = ['/', '/destinations', '/programs', '/eligibility', '/blog', '/login', '/portal/login', '/partner-portal/login'];
const ADMIN_PAGES = ['/dashboard', '/reminders', '/candidates', '/candidates/:first', '/settings'];
const PORTAL_EMAIL = process.env.VISUAL_PORTAL_EMAIL ?? 'yasmine@demo.local';
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

async function login(context, kind = 'admin') {
  const page = await context.newPage();
  const portal = kind === 'portal';
  await page.goto(`${BASE}/fr/${portal ? 'portal/' : ''}login`, { waitUntil: 'networkidle' });
  await page.fill('#email', portal ? PORTAL_EMAIL : ADMIN_EMAIL);
  await page.fill('#password', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(portal ? /\/portal\/dashboard/ : /\/(dashboard|account)/, { timeout: 20000 });
  await page.close();
}

// Barre du bas du portail (téléphone) : 4 rubriques fixes + « Plus » qui donne accès aux 5 autres ; Échap ferme.
async function checkPortalBottomNav(page, locale) {
  const ctx = `/portal/dashboard ${locale} 390`;
  await hideDevOverlay(page);
  const nav = page.locator('nav.fixed');
  const visible = await nav.isVisible().catch(() => false);
  report(visible, 'portal-bottom-nav', ctx);
  if (!visible) return;
  const pinned = await nav.locator('a').count();
  await nav.locator('button').click();
  const sheet = page.getByRole('dialog');
  const others = await sheet.locator('a').count();
  report(pinned === 4 && others === 5, 'portal-all-sections', ctx, `${pinned} + ${others}`);
  await page.keyboard.press('Escape');
  report(await sheet.isHidden(), 'portal-sheet-escape', ctx);
}

// Connexion directe dans chaque langue (le changement de langue est couvert par portal-session-reload).
async function checkPortal(browser, width) {
  for (const locale of LOCALES) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
      await page.goto(`${BASE}/${locale}/portal/login`, { waitUntil: 'networkidle' });
      await page.fill('#email', PORTAL_EMAIL);
      await page.fill('#password', ADMIN_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/portal\/dashboard/, { timeout: 20000 });
      await page.waitForLoadState('networkidle');
      await checkPage(page, '/portal/dashboard', locale, width, { navigate: false });
      if (width === 390) await checkPortalBottomNav(page, locale);
    } catch (e) {
      report(false, 'load', `/portal/dashboard ${locale} ${width}`, e.message.split('\n')[0]);
    }
    await context.close();
  }
}

// Le badge de développement de Next.js (absent en production) recouvre le coin bas de l'écran.
const hideDevOverlay = (page) => page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' }).catch(() => {});

const firstItem = {};
const API = process.env.VISUAL_API_URL ?? 'http://localhost:4000/api';
async function firstIdFromApi(list) {
  const login = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }) });
  const { accessToken } = await login.json();
  const res = await fetch(`${API}${list}?pageSize=1`, { headers: { authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  const id = (data.items ?? data)[0]?.id;
  if (!id) throw new Error(`aucun élément dans ${list}`);
  return id;
}

async function checkPage(page, path, locale, width, { navigate = true } = {}) {
  const ctx = `${path} ${locale} ${width}`;
  let target = path;
  if (path.endsWith('/:first')) {
    // Premier élément de la liste parente (ex. premier candidat) : l'identifiant change d'une base à l'autre.
    // Identifiant du premier élément, résolu une fois auprès de l'API (plus fiable que de lire la liste affichée).
    const list = path.replace('/:first', '');
    if (!firstItem[list]) firstItem[list] = `${list}/${await firstIdFromApi(list)}`;
    target = firstItem[list];
  }
  if (navigate) await page.goto(`${BASE}/${locale}${target === '/' ? '' : target}`, { waitUntil: 'networkidle', timeout: 60000 });
  await hideDevOverlay(page);
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
    // Les sections du site public apparaissent au défilement : on parcourt la page avant la capture pleine page.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(400);
    const name = `${path.replace(/[/:]/g, '_') || '_home'}-${locale}-${width}`.replace(/^_/, '');
    await page.screenshot({ path: `.visual/${name || 'home'}.png`, fullPage: true });
  }
}

// Contraste WCAG des paires de couleurs de la charte (cible AA : 4,5:1 pour le texte normal).
const lum = (hex) => {
  const c = hex.match(/\w\w/g).map((h) => parseInt(h, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
for (const [fg, bg, label] of [
  ['#2457FF', '#FFFFFF', 'bleu sur blanc'],
  ['#FFFFFF', '#2457FF', 'blanc sur bleu'],
  ['#4B5478', '#F3F6FF', 'texte secondaire sur fond'],
  ['#0B1230', '#F3F6FF', 'encre sur fond'],
  ['#2457FF', '#E4EBFF', 'bleu sur bleu pâle (badges)'],
]) {
  const r = contrast(fg, bg);
  report(r >= 4.5, 'contrast', label, r.toFixed(2));
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
  { pages: withApi ? ADMIN_PAGES.filter(keep) : [], auth: 'admin' },
];

for (const width of WIDTHS) for (const { pages, auth } of groups) {
  if (!pages.length) continue;
  const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, deviceScaleFactor: 1 });
  if (auth) await login(context, auth);
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
// Portail candidat : données en erreur ou vides ne doivent jamais afficher une fausse information.
async function checkPortalRegressions(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.route('**/api/portal/invoices', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }));
  await page.route('**/api/portal/checklist', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'x', label: 'Passeport', status: 'PENDING', note: null, position: 0 }]) }),
  );
  await page.goto(`${BASE}/fr/portal/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', PORTAL_EMAIL);
  await page.fill('#password', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/portal\/dashboard/, { timeout: 20000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  const settled = await page.getByText('Tout est réglé').count();
  report(settled === 0, 'portal-invoices-error', '/portal/dashboard fr 1280', `« Tout est réglé » affiché ${settled} fois`);
  const arcs = await page.locator('[role="img"] svg circle').count();
  report(arcs === 1, 'portal-ring-zero', '/portal/dashboard fr 1280', `${arcs} cercle(s) à 0 %`);
  // Session conservée après un rechargement complet (le refresh par cookie ne doit pas être refusé).
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  report(/\/portal\/dashboard/.test(page.url()), 'portal-session-reload', '/portal/dashboard fr 1280', page.url());
  const loops = await page.locator('main .animate-morph').count();
  report(loops === 0, 'portal-no-loops', '/portal/dashboard fr 1280', `${loops} forme(s) en boucle`);
  await ctx.close();
}

// Régressions relevées en relecture : chacune reproduite ici avant d'être corrigée.
async function checkRegressions(browser) {
  if (ONLY && ONLY !== 'regressions') return; // --only regressions : seulement ce bloc
  const ctxDesk = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctxDesk.newPage();

  // 1. Champ du site public : au focus, le contour devient bleu (et non encre).
  await page.goto(`${BASE}/fr/eligibility`, { waitUntil: 'networkidle' });
  await hideDevOverlay(page);
  const field = page.locator('main input, main select').first();
  await field.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(400); // la couleur du contour est animée (transition)
  const border = await page.evaluate(() => getComputedStyle(document.activeElement).borderTopColor);
  report(border === 'rgb(36, 87, 255)', 'public-field-focus', '/eligibility fr 1280', border);

  // 2. Focus visible sur fond bleu (pied de page) : le contour ne doit pas avoir la couleur du fond.
  await page.goto(`${BASE}/fr`, { waitUntil: 'networkidle' });
  await hideDevOverlay(page);
  const link = page.locator('footer nav a').first();
  await link.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  const ring = await page.evaluate(() => {
    const el = document.activeElement;
    let bg = 'rgba(0, 0, 0, 0)';
    for (let n = el; n && bg === 'rgba(0, 0, 0, 0)'; n = n.parentElement) bg = getComputedStyle(n).backgroundColor;
    return { outline: getComputedStyle(el).outlineColor, style: getComputedStyle(el).outlineStyle, bg };
  });
  report(ring.style !== 'none' && ring.outline !== ring.bg, 'focus-on-blue', '/ fr 1280', `${ring.outline} sur ${ring.bg}`);
  await ctxDesk.close();

  // 3. Moins de mouvement : les animations en boucle s'arrêtent (une seule itération), pas de saut aléatoire.
  const ctxCalm = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const calm = await ctxCalm.newPage();
  await calm.goto(`${BASE}/fr`, { waitUntil: 'networkidle' });
  const iter = await calm.evaluate(() => getComputedStyle(document.querySelector('.animate-morph')).animationIterationCount);
  report(iter === '1', 'reduced-motion-loops', '/ fr 1280', `iteration-count=${iter}`);
  await ctxCalm.close();

  // 5. Écran de chargement : pendant la vérification de session (réponse ralentie), le logo s'affiche dans un
  //    [role=status] Pop, puis disparaît une fois la vérification terminée.
  const ctxLoad = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const load = await ctxLoad.newPage();
  await load.route('**/api/auth/refresh', async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });
  await load.goto(`${BASE}/fr/dashboard`, { waitUntil: 'domcontentloaded' });
  const loader = load.locator('[role="status"][data-page-loader]');
  const shown = await loader.waitFor({ state: 'visible', timeout: 2000 }).then(() => true, () => false);
  const hasLogo = shown && (await loader.locator('img, [data-logo]').count()) > 0;
  report(shown && hasLogo, 'page-loader-shown', '/dashboard fr 1280');
  const gone = await loader.waitFor({ state: 'detached', timeout: 15000 }).then(() => true, () => false);
  report(gone, 'page-loader-gone', '/dashboard fr 1280');
  await ctxLoad.close();

  // 6. Menu mobile de l'admin en arabe : le panneau est collé à droite et glisse depuis la droite (jamais à travers l'écran).
  if (await apiUp()) {
    const ctxDrawer = await browser.newContext({ viewport: { width: 390, height: 844 } });
    // Connexion directement en arabe, sans recharger ensuite : l'API limite le rafraîchissement de session à
    // 30 requêtes par minute et par IP, seuil que la suite complète (une seule IP) peut atteindre.
    const dr = await ctxDrawer.newPage();
    await dr.goto(`${BASE}/ar/login`, { waitUntil: 'networkidle' });
    await dr.fill('#email', ADMIN_EMAIL);
    await dr.fill('#password', ADMIN_PASSWORD);
    await dr.click('button[type="submit"]');
    await dr.waitForURL(/\/ar\/dashboard/, { timeout: 20000 });
    await dr.waitForLoadState('networkidle');
    await hideDevOverlay(dr);
    const opened = await dr.locator('header button[class*="lg:hidden"]').click({ timeout: 15000 }).then(() => true, () => false);
    if (!opened) {
      await dr.screenshot({ path: '.visual/debug-admin-drawer.png' });
      report(false, 'admin-drawer-rtl', '/dashboard ar 390', `bouton du menu introuvable sur ${dr.url()}`);
      await ctxDrawer.close();
    } else {
    const panel = dr.locator('[role="dialog"] > div').last();
    await panel.waitFor({ state: 'attached' });
    await dr.waitForTimeout(60);
    const mid = await panel.boundingBox();
    await dr.waitForTimeout(700);
    const end = await panel.boundingBox();
    const docked = end && Math.abs(end.x + end.width - 390) <= 1;
    const fromRight = mid && end && mid.x >= end.x - 1;
    report(!!docked && !!fromRight, 'admin-drawer-rtl', '/dashboard ar 390', `milieu x=${mid && Math.round(mid.x)}, fin x=${end && Math.round(end.x)}`);
    await ctxDrawer.close();
    }
  }

  // 7. Relances du jour : le clic WhatsApp ouvre wa.me avec un texte sans aucune {variable} restante.
  if (await apiUp()) {
    const ctxRem = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const rp = await ctxRem.newPage();
    await rp.goto(`${BASE}/fr/login`, { waitUntil: 'networkidle' });
    await rp.fill('#email', ADMIN_EMAIL);
    await rp.fill('#password', ADMIN_PASSWORD);
    await rp.click('button[type="submit"]');
    await rp.waitForURL(/\/dashboard/, { timeout: 20000 });
    await rp.evaluate(() => { window.__opened = []; window.open = (u) => { window.__opened.push(String(u)); return null; }; });
    await rp.locator('nav a[href$="/reminders"]').first().click();
    await rp.waitForURL(/\/reminders/, { timeout: 20000 });
    await rp.waitForLoadState('networkidle');
    await hideDevOverlay(rp);
    const btn = rp.locator('main button:has(svg.lucide-message-circle):not([disabled])').first();
    if ((await btn.count()) === 0) {
      console.log('SKIP reminders-whatsapp-text — aucune relance avec téléphone dans les données');
    } else {
      await btn.click();
      await rp.waitForTimeout(300);
      const opened = await rp.evaluate(() => window.__opened[0] ?? '');
      const text = opened.includes('text=') ? decodeURIComponent(opened.split('text=')[1]) : '';
      report(opened.startsWith('https://wa.me/') && !!text && !/[{}]/.test(text), 'reminders-whatsapp-text', '/reminders fr 1280', text.slice(0, 60));
    }
    await ctxRem.close();
  }

  // 4. Menu mobile du site public : se ferme quand on choisit un lien, même une ancre de la même page.
  const ctxPhone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const phone = await ctxPhone.newPage();
  await phone.goto(`${BASE}/fr`, { waitUntil: 'networkidle' });
  await hideDevOverlay(phone);
  await phone.locator('header button[aria-expanded]').click();
  await phone.locator('header nav a[href$="#contact"]').filter({ visible: true }).first().click();
  await phone.waitForTimeout(600);
  const expanded = await phone.locator('header button[aria-expanded]').getAttribute('aria-expanded');
  report(expanded === 'false', 'public-menu-closes', '/ fr 390', `aria-expanded=${expanded}`);
  await ctxPhone.close();
}
await checkRegressions(browser);
if (withApi && (!ONLY || ONLY === 'regressions')) await checkPortalRegressions(browser);

if (withApi && (!ONLY || ONLY.startsWith('/portal/'))) for (const width of WIDTHS) await checkPortal(browser, width);
await browser.close();
console.log(failures ? `\n${failures} échec(s)` : '\nTout passe');
process.exit(failures ? 1 : 0);
