# Documents en arabe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Générer devis, factures, reçus et contrats en arabe correct (ou en français), dans la langue préférée du candidat, avec un lien vers l'autre langue.

**Architecture:** On garde pdfkit. Un essai (2026-11-18) a montré deux choses. D'abord, fontkit, inclus dans pdfkit, **lie déjà correctement les lettres à l'intérieur d'un mot arabe** quand on dessine ce mot seul avec une police arabe. Ensuite, quand on lui donne une phrase entière, il met les mots de gauche à droite et perd les espaces. La solution validée par l'essai :
- découper chaque ligne en mots ;
- calculer le niveau bidirectionnel de chaque mot avec `bidi-js` (algorithme UBA) ;
- réordonner les mots (règle L2) ;
- dessiner chaque mot à sa position x, avec la police de son écriture : arabe → Noto Naskh Arabic, latin → Helvetica actuelle.

Les textes sans caractère arabe passent par le chemin actuel, inchangé.

**Tech Stack:** NestJS, pdfkit 0.20 (fontkit), `bidi-js@1.0.3` (pur JS), police Noto Naskh Arabic (OFL, fichier `.woff` de `@fontsource/noto-naskh-arabic@5.2.5`, copié dans le dépôt), Jest, poppler (`pdftotext`, `pdftoppm`) pour vérifier.

**Spec:** `docs/superpowers/specs/2026-11-18-documents-en-arabe-design.md` (§6 et §8 font foi).

## Global Constraints

- Une langue par document. Par défaut, la `preferredLanguage` du candidat. `?lang=fr|ar` la remplace, **sauf pour un contrat** : il reste dans sa langue de création (`Contract.language`).
- Montants : format inchangé (`n.toFixed(3) + ' ' + devise`, par exemple `2400.000 TND`), en français comme en arabe. Dates : `fr-TN`, ou `ar-TN` avec chiffres latins (`numberingSystem: 'latn'`).
- Un texte sans caractère arabe est dessiné **exactement comme aujourd'hui**. Aucune régression des PDF français.
- Un contrat signé n'est jamais régénéré ni modifié.
- Aucune dépendance native. Ajout limité à `bidi-js` et au fichier de police (moins de 300 Ko). Mémoire : au plus 50 Mo de plus par rendu.
- Libellés FR/AR dans un seul dictionnaire côté API. Tout nouveau texte de l'interface web en FR **et** AR.
- Gate de chaque tâche : `cd apps/api && npx jest && npx tsc --noEmit` ; pour le web : `npm run typecheck && node scripts/check-i18n.mjs && npm run test:unit`.

## Review Focus

1. **Ligne arabe plus large que la colonne** (longue ligne de prestation, paragraphe de contrat) : retour à la ligne dans l'ordre de lecture (le premier mot logique en haut à droite), sans débordement. Test `wrapRtl coupe en lignes logiques puis réordonne chaque ligne` (Task 1).
2. **Mélange arabe, chiffres et ponctuation en fin de phrase** (« المجموع : 2400.000 TND », « رقم FAC-2026-0012 ») : la ponctuation et les nombres restent à leur place logique. Tests `visualWords` (Task 1) et PDF d'exemple relus (Task 7).
3. **Candidat sans langue préférée**, ou contrat existant sans `language` : français par défaut. Tests Task 4 et Task 5.
4. **Agence sans nom ni adresse en arabe** : on affiche les champs actuels tels quels, sans case vide. Test Task 3.
5. **Caractère arabe hors de la police** (chiffres arabes-indiens, signes rares) : pas de plantage, rendu dégradé accepté. Test `drawText ne lève pas sur ٠١٢ et ﷺ` (Task 2).

---

## File Structure

| Fichier | Responsabilité |
|---|---|
| `apps/api/assets/fonts/NotoNaskhArabic-Regular.woff` + `OFL.txt` | police arabe et sa licence |
| `apps/api/src/finance/pdf/rtl.ts` | pur : `hasArabic`, `visualWords`, `wrapRtl` |
| `apps/api/src/finance/pdf/pdf-text.ts` | `PdfText` : dessin d'un texte (LTR inchangé ou RTL mot par mot), polices |
| `apps/api/src/finance/pdf/labels.ts` | dictionnaire FR/AR des libellés des documents |
| `apps/api/src/finance/pdf/pdf.service.ts` | `document(header, items, lang)` et `contract(header, content, signature, lang)` en miroir pour l'arabe |
| `apps/api/src/contracts/contract-templates.ts` | `DEFAULT_TEMPLATE` (déplacé) + `DEFAULT_TEMPLATE_AR` |
| `apps/api/scripts/pdf-samples.ts` | génère des PDF d'exemple FR et AR, pour la vérification visuelle |

---

### Task 1: Ordre de lecture arabe (fonctions pures)

**Files:** Create `apps/api/src/finance/pdf/rtl.ts`, `apps/api/src/finance/pdf/rtl.spec.ts` ; Modify `apps/api/package.json` (`bidi-js@1.0.3`)

**Interfaces — Produces:**
- `hasArabic(text: string): boolean` : plages `؀-ۿ ݐ-ݿ ࢠ-ࣿ ﭐ-﷿ ﹰ-﻿`.
- `type Word = { text: string; rtl: boolean }`, avec `rtl = hasArabic(text)`.
- `visualWords(line: string, base: 'rtl' | 'ltr' = 'rtl'): Word[]` : mots (séparés par des espaces) dans l'**ordre visuel de gauche à droite**. On prend les niveaux de `bidi.getEmbeddingLevels(line, base)`, avec le niveau du premier caractère de chaque mot, puis on applique la règle L2 de l'UBA au niveau des mots : du niveau max à 1, inverser chaque suite contiguë de mots de niveau ≥ k. C'est l'algorithme validé par l'essai.
- `wrapRtl(text: string, maxWidth: number, measure: (w: Word) => number, spaceWidth: number): Word[][]` : découpe d'abord les mots en ordre **logique** en lignes qui tiennent dans `maxWidth` (un `\n` force une nouvelle ligne), puis applique `visualWords` à chaque ligne.

- [ ] **Step 1 : tests** (texte = ordre visuel attendu, de gauche à droite).
  - `visualWords('المجموع المطلوب')` → `['المطلوب','المجموع']`.
  - `visualWords('الفاتورة رقم FAC-2026-0012')` → `['FAC-2026-0012','رقم','الفاتورة']`.
  - `visualWords('المجموع : 2400.000 TND')` → `['2400.000','TND',':','المجموع']`. Le nombre et la devise restent dans l'ordre latin, à gauche.
  - `visualWords('السيدة Yasmine Ben Ali مترشحة')` → `['مترشحة','Yasmine','Ben','Ali','السيدة']`.
  - `visualWords('Facture 12', 'ltr')` → `['Facture','12']`, inchangé.
  - `wrapRtl coupe en lignes logiques puis réordonne chaque ligne` : 4 mots arabes de largeur 10, `maxWidth` 25, espace 2 → 2 lignes ; la ligne 1 contient les mots logiques 1 et 2, dans l'ordre visuel `[2, 1]`.
  - `wrapRtl` respecte `\n`.
- [ ] **Step 2 :** `npx jest rtl` → FAIL. **Step 3 :** `npm i bidi-js@1.0.3`, implémenter. **Step 4 :** PASS.
- [ ] **Step 5 :** commit `feat(api): ordre de lecture arabe pour les PDF (fonctions pures testées)`.

### Task 2: Dessin du texte dans pdfkit

**Files:** Create `apps/api/assets/fonts/NotoNaskhArabic-Regular.woff`, `apps/api/assets/fonts/OFL.txt`, `apps/api/src/finance/pdf/pdf-text.ts`, `apps/api/src/finance/pdf/pdf-text.spec.ts` ; Modify `apps/api/nest-cli.json` (ou `Dockerfile`) pour que `assets/fonts` soit disponible à l'exécution (`dist`, ou chemin résolu depuis `process.cwd()`).

**Interfaces — Produces:**
- `registerFonts(doc: PDFKit.PDFDocument): void` : enregistre `ar` (Noto Naskh) ; la police latine reste `Helvetica`. Le fichier est lu **une seule fois** (cache module) et passé en Buffer.
- `drawText(doc, text: string, opts: { x: number; y: number; width: number; size: number; align: 'left' | 'right' | 'center'; dir: 'ltr' | 'rtl'; color?: string; lineGap?: number }): number`. Renvoie le `y` après le texte.
  - Sans arabe et `dir='ltr'` : appel `doc.font('Helvetica').fontSize(size).text(text, x, y, { width, align, lineGap })`, identique au comportement actuel.
  - Sinon : `wrapRtl` avec `measure = widthOfString` dans la police du mot. Chaque ligne est placée selon `align` (pour `right`, le bord droit est à `x + width`). Chaque mot est dessiné avec `lineBreak: false` dans sa police. Mots latins décalés de `+size*0.12` en y, pour aligner les lignes de base des deux polices (valeur à ajuster sur l'image, Task 7).
- [ ] **Step 1 : tests** avec un faux `doc` qui enregistre les appels `font`, `text` et `widthOfString` (largeur = longueur × 5).
  - Texte latin : un seul appel `text(text, x, y, {width, align})`.
  - `drawText(…'المجموع المطلوب', dir rtl, align right, x 50, width 495)` : deux appels `text`, `'المطلوب'` puis `'المجموع'`, avec x croissants. Le dernier se termine à `545`.
  - `drawText ne lève pas sur ٠١٢ et ﷺ`.
- [ ] **Step 2–4 :** RED → copier la police depuis `@fontsource/noto-naskh-arabic@5.2.5` (fichier `noto-naskh-arabic-arabic-400-normal.woff`), avec la licence OFL, sans garder la dépendance npm → implémenter → GREEN.
- [ ] **Step 5 :** commit `feat(api): dessin du texte arabe dans les PDF (police Noto Naskh embarquée)`.

### Task 3: Libellés FR/AR et mise en page miroir

**Files:** Create `apps/api/src/finance/pdf/labels.ts` ; Modify `apps/api/src/finance/pdf/pdf.service.ts` ; Test `apps/api/src/finance/pdf/pdf.service.spec.ts` ; Create `apps/api/scripts/pdf-samples.ts`

**Interfaces — Produces:**
- `type DocLang = 'fr' | 'ar'` ; `LABELS: Record<DocLang, { quote, invoice, receipt, contract, client, description, qty, unitPrice, total, taxId, generatedBy, candidateSignature, signedOn }>`.
  - FR = textes actuels (`Devis`, `Facture`, `Reçu`, `Contrat`, `Client :`, `Description`, `Qté`, `Prix unitaire`, `Total`, `Total :`, `Matricule fiscal :`, `Document généré par {agence}.`, `Signature du candidat`, `Signé le`).
  - AR = `عرض سعر`, `فاتورة`, `وصل`, `عقد`, `الحريف:`, `البيان`, `الكمية`, `سعر الوحدة`, `المجموع`, `المجموع:`, `المعرف الجبائي:`, `وثيقة صادرة عن {agence}.`, `إمضاء المترشح`, `أُمضي يوم`.
- `DocumentHeader.kind` devient `'quote' | 'invoice' | 'receipt'`. On ajoute `agency.nameAr?`, `agency.addressAr?` et `lang: DocLang`. Les appelants actuels passent la clé au lieu du libellé français.
- `PdfService.document(header, items)` utilise `LABELS[header.lang]`, les dates `formatDate(lang, date)`, et en `ar` la **mise en page miroir** :
  - agence alignée à droite (`nameAr ?? name`, `addressAr ?? address`) ;
  - numéro et date à gauche ;
  - colonnes de x décroissants : Description à droite (x 285, w 260, align right), Qté, Prix unitaire, Total à gauche ;
  - tout le texte passe par `drawText` avec `dir: 'rtl'`.

  En `fr`, la mise en page actuelle est conservée, mais chaque texte passe par `drawText`, ce qui garde le comportement inchangé pour le latin.
- `PdfService.contract(header, content, signature, lang)` : même logique (contenu en `drawText` avec retour à la ligne).
- `scripts/pdf-samples.ts` : écrit `apps/api/.pdf-samples/{facture,devis,recu,contrat}-{fr,ar}.pdf` (dossier ignoré par git), avec des données d'exemple incluant une ligne en arabe et une ligne en français.
- [ ] **Step 1 : tests.**
  - `le PDF français garde ses libellés` : `pdftotext` du PDF FR contient `Facture FAC-1`, `Description` et `Total : 2400.000 TND`. Exécution via `child_process.execFileSync('pdftotext', [file, '-'])` ; ignoré (`it.skip`) si poppler est absent.
  - `le PDF arabe contient les glyphes de فاتورة` : le PDF `ar` intègre la police Noto Naskh (le buffer contient `NotoNaskhArabic`).
  - `agence sans nom arabe → nom actuel affiché`.
- [ ] **Step 2–4 :** RED → GREEN.
- [ ] **Step 5 :** `npx ts-node scripts/pdf-samples.ts`, puis `pdftoppm -r 70` des 8 PDF, relus à l'œil. Ajuster le décalage de ligne de base latin/arabe si besoin.
- [ ] **Step 6 :** commit `feat(api): devis, factures, reçus et contrats en arabe (mise en page miroir)`.

### Task 4: Schéma et contrats en arabe

**Files:** Modify `apps/api/prisma/schema.prisma`, `apps/api/src/contracts/contracts.service.ts`, `apps/api/src/contracts/dto/*.ts`, `apps/api/src/settings/dto/agency-settings.dto.ts` ; Create `apps/api/src/contracts/contract-templates.ts` ; Test `contracts.service.spec.ts`

**Interfaces — Produces:**
- `Contract.language Language @default(fr)`.
- `AgencySettings.contractTemplateAr String?`, `nameAr String?`, `addressAr String?`, éditables via le DTO de paramètres (`@IsOptional() @IsString() @MaxLength`, mêmes limites que les champs FR).
- `CreateContractDto.language?: 'fr' | 'ar'` (`@IsOptional() @IsIn`).
- `ContractsService.create` :
  - `lang = dto.language ?? candidate.preferredLanguage ?? 'fr'` ;
  - modèle = `lang === 'ar' ? settings.contractTemplateAr || DEFAULT_TEMPLATE_AR : settings.contractTemplate || DEFAULT_TEMPLATE` ;
  - `date` formatée avec `formatDate(lang, …)` ; montants inchangés ;
  - `services` : même format de ligne, avec `×`.
  - Enregistre `language: lang`.
- `DEFAULT_TEMPLATE_AR` : traduction fidèle de `DEFAULT_TEMPLATE`, avec les mêmes `{{variables}}`.
- [ ] **Step 1 : tests.**
  - `crée le contrat dans la langue préférée du candidat (ar) avec le modèle arabe par défaut` : le contenu contient un mot du modèle arabe, et `language: 'ar'`.
  - `dto.language l'emporte sur la préférence`.
  - `utilise contractTemplateAr de l'agence s'il existe`.
  - `candidat sans préférence → fr`.
  - Les tests existants passent.
- [ ] **Step 2–4 :** RED → `prisma db push && generate` → GREEN.
- [ ] **Step 5 :** commit `feat(api): contrats en arabe (modèle modifiable, langue choisie à la création)`.

### Task 5: Routes PDF avec langue

**Files:** Modify `apps/api/src/finance/finance.service.ts`, `finance.controller.ts`, `apps/api/src/contracts/contracts.service.ts`, `contracts.controller.ts`, `apps/api/src/portal/portal.controller.ts` (+ son service) ; Test `finance.service.spec.ts`, `contracts.service.spec.ts`

**Interfaces — Produces:**
- `quotePdf(actor, id, lang?: DocLang)`, `invoicePdf(actor, id, lang?)`, `receiptPdf(actor, id, lang?)`, `portalInvoicePdf(…, lang?)`. La langue effective est `lang ?? candidate.preferredLanguage ?? 'fr'`.
- `contractPdf(…)` : langue = `contract.language`, quel que soit `?lang`.
- Contrôleurs : `@Query('lang')` validé par un `PdfLangQueryDto` (`@IsOptional() @IsIn(['fr','ar'])`).
- Nom de fichier : `${LABELS[lang].invoice}-${number}.pdf`. En-tête `Content-Disposition: inline; filename*=UTF-8''<encodeURIComponent>` pour les noms arabes, avec en plus `filename="Facture-<number>.pdf"` en ASCII.
- [ ] **Step 1 : tests.**
  - `facture : langue par défaut = préférence du candidat`.
  - `?lang=fr remplace ar`.
  - `contrat : ?lang ignoré, langue du contrat`.
  - `contrat existant sans language → fr`.
- [ ] **Step 2–4 :** RED → GREEN.
- [ ] **Step 5 :** commit `feat(api): routes PDF dans la langue du candidat (?lang pour l'autre version)`.

### Task 6: Interface web

**Files:** Modify `apps/web/src/features/candidates/tabs/finance-tab.tsx`, `apps/web/src/features/portal/portal-finance-page.tsx`, `apps/web/src/features/portal/portal-contracts-page.tsx`, `apps/web/src/features/settings/settings-page.tsx`, `apps/web/src/lib/types.ts`, `apps/web/src/lib/download.ts` (si le téléchargement y passe), `messages/{fr,ar}.json`
- [ ] **Step 1 :** Onglet Finance. Chaque bouton PDF (devis, facture, reçu) ouvre la langue par défaut. À côté, un lien secondaire « العربية » ou « Français » ajoute `?lang=` de l'autre langue. Pas de lien pour un contrat, qui affiche à la place un `Badge` avec sa langue. Le formulaire de création de contrat reçoit un `LanguagePreferenceSelect` « Langue du contrat », réglé par défaut sur la préférence du candidat.
- [ ] **Step 2 :** Portail : les PDF s'ouvrent sans `?lang` (la préférence s'applique).
- [ ] **Step 3 :** Paramètres :
  - « Nom de l'agence (arabe) » et « Adresse (arabe) » en `dir="rtl"` ;
  - « Modèle de contrat (arabe) » en `dir="rtl"`, à côté du modèle français, avec la même aide sur les variables.
- [ ] **Step 4 :** gate web PASS ; `visual-check --only /candidates/:first` et `--only /settings` PASS (fr/ar, 1280/390).
- [ ] **Step 5 :** commit `feat(web): documents en arabe — liens de langue, langue du contrat, modèle arabe`.

### Task 7: Vérification finale

- [ ] **Step 1 :** API locale : créer pour Yasmine (préférence `ar`) un devis, une facture avec une ligne en arabe, un paiement et un contrat signé. Télécharger chaque PDF en `ar` et en `fr` par les vraies routes (`curl` avec jeton). Lancer `pdftoppm`, relire les 8 images, et les joindre à la page de captures.
- [ ] **Step 2 :** Mémoire : script qui génère 20 factures arabes d'affilée et affiche `process.memoryUsage().rss` avant et après. L'écart doit être inférieur à 50 Mo.
- [ ] **Step 3 :** Build web de production + `visual-check` complet PASS.
- [ ] **Step 4 :** Push, relecture indépendante, compte rendu au propriétaire, avec une demande de relecture du modèle de contrat arabe par l'agence.
