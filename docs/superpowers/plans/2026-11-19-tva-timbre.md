# TVA, débours et timbre fiscal — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** des devis et factures conformes (lignes Service à 19 % ou Débours sans TVA, timbre fiscal, HT/TTC), avec des totaux figés à la création et utilisés partout.

**Architecture :** un module pur `totals.ts` calcule et relit les totaux ; ils sont enregistrés sur `Quote`/`Invoice` à la création et renvoyés par l'API (le web n'additionne plus de lignes). Le PDF affiche le récapitulatif quand le document est taxé. Un interrupteur par agence, désactivé par défaut.

**Tech Stack :** NestJS 11, Prisma 6 (`db push`), Jest ; Next.js 15, next-intl, TanStack Query ; pdfkit (rendu FR/AR existant).

**Spec :** `docs/superpowers/specs/2026-11-19-tva-timbre-design.md`

## Global Constraints

- Montants en TND, 3 décimales ; arrondi au millime : `Math.round(x * 1000) / 1000`.
- TVA calculée sur le total des services, arrondie une fois (pas ligne par ligne).
- Défauts des Paramètres : `taxesEnabled = false`, `vatRate = 19`, `stampDuty = 1`.
- Document dont `total` est vide (créé avant la fonctionnalité) : total = somme brute des lignes, sans TVA ni timbre ; jamais recalculé.
- Devis ancien → facture ou contrat : somme brute conservée, sans TVA ni timbre (décision du propriétaire).
- Agence sans taxes : mise en page PDF et formulaire inchangés (pas de colonne TVA, pas de choix Service/Débours).
- Pas d'euros, pas de migration de données : nouveaux champs facultatifs ou avec défaut.
- Libellés FR/AR dans `labels.ts` et `messages/{fr,ar}.json` (clés fr = ar).

## Review Focus

1. Changer `vatRate`/`stampDuty`/`taxesEnabled` dans les Paramètres après coup → les devis et factures existants gardent exactement leurs totaux (test Task 2).
2. Paiement du montant TTC exact avec des flottants (ex. 3 × 45,5 à 19 % + timbre) → accepté et facture « payée », pas « dépasse le solde » (test Task 2).
3. Facture de débours seuls avec taxes activées → TVA 0, timbre 1,000, total = débours + 1 (test Task 1).
4. Taux de TVA invalide dans les Paramètres (négatif, > 100, texte) → refusé 400 (test Task 2).
5. Contrat créé depuis un devis ancien, taxes activées → total = somme brute (test Task 3).

---

### Task 1 : Calcul des totaux (module pur)

**Files :** Create `apps/api/src/finance/totals.ts`, `apps/api/src/finance/totals.spec.ts`

**Interfaces — Produces :**
- `type LineKind = 'SERVICE' | 'DISBURSEMENT'`
- `type TaxSettings = { taxesEnabled: boolean; vatRate: number; stampDuty: number }`
- `type Totals = { subtotal: number; vatAmount: number; disbursements: number; stampDuty: number; total: number }`
- `round3(n: number): number`
- `lineVatRate(kind: LineKind, s: TaxSettings): number` — 0 si débours ou taxes désactivées, sinon `s.vatRate`.
- `computeTotals(items: { kind?: LineKind; quantity: number; unitPrice: number; vatRate?: number }[], s: TaxSettings): Totals` — `subtotal` = Σ services, `vatAmount` = round3(Σ services × taux / 100) (taux de la première ligne service, toutes identiques), `stampDuty` = taxes activées ? `s.stampDuty` : 0.
- `documentTotals(doc: { items: …; subtotal?: number|null; vatAmount?: number|null; disbursements?: number|null; stampDuty?: number|null; total?: number|null }): Totals & { taxed: boolean }` — totaux enregistrés si `total` non nul, sinon somme brute (services = toutes les lignes, TVA 0, timbre 0). `taxed` = `vatAmount > 0 || stampDuty > 0 || une ligne DISBURSEMENT`.
- `NO_TAXES: TaxSettings = { taxesEnabled: false, vatRate: 0, stampDuty: 0 }`.

- [ ] **Step 1 : tests** (`totals.spec.ts`) :
  - services seuls : `[{SERVICE,1,2000}]`, taxes on → `{subtotal:2000, vatAmount:380, disbursements:0, stampDuty:1, total:2381}` ;
  - services + débours (exemple du spec) : `[{SERVICE,1,2000},{DISBURSEMENT,1,1500}]` → total `3881` ;
  - débours seuls : `[{DISBURSEMENT,2,750}]` → `{vatAmount:0, stampDuty:1, total:1501}` ;
  - arrondi : `[{SERVICE,3,45.5}]` → `vatAmount: 25.935`, `total: 163.435` ;
  - taxes désactivées : `[{SERVICE,1,100},{DISBURSEMENT,1,50}]` → `{vatAmount:0, stampDuty:0, total:150}` ;
  - `documentTotals` d'un document ancien (`total: null`, lignes 1×500 + 2×100) → `{total:700, vatAmount:0, stampDuty:0, taxed:false}` ;
  - `documentTotals` d'un document enregistré → renvoie les valeurs enregistrées, `taxed: true`.
- [ ] **Step 2 :** RED (`npx jest src/finance/totals`).
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** GREEN.
- [ ] **Step 5 :** commit `feat(api): calcul des totaux HT, TVA, débours, timbre et TTC`.

### Task 2 : Schéma, Paramètres, création des devis et factures, paiements

**Files :** Modify `apps/api/prisma/schema.prisma`, `src/finance/dto/finance.dto.ts`, `src/finance/finance.service.ts`, `src/finance/finance.controller.ts`, `src/settings/dto/agency-settings.dto.ts` ; Test `src/finance/finance.service.spec.ts`, `src/settings/dto/agency-settings.dto.spec.ts`

**Interfaces — Consumes :** Task 1. **Produces :**
- Prisma : `enum LineKind { SERVICE DISBURSEMENT }` ; `QuoteItem`/`InvoiceItem` : `kind LineKind @default(SERVICE)`, `vatRate Float @default(0)` ; `Quote`/`Invoice` : `subtotal Float?`, `vatAmount Float?`, `disbursements Float?`, `stampDuty Float?`, `total Float?` ; `AgencySettings` : `taxesEnabled Boolean @default(false)`, `vatRate Float @default(19)`, `stampDuty Float @default(1)`.
- `ItemDto.kind?: 'SERVICE' | 'DISBURSEMENT'` (`@IsOptional() @IsIn`).
- Settings DTO : `taxesEnabled?: boolean` (`@IsBoolean`), `vatRate?: number` (`@IsNumber() @Min(0) @Max(100)`), `stampDuty?: number` (`@IsNumber() @Min(0) @Max(1000)`).
- `FinanceService.taxSettings(orgId): Promise<TaxSettings>` (défauts si pas de Paramètres).
- `GET finance/tax-settings` (`finance.view`) → `TaxSettings` (pour le formulaire web, sans exiger `settings.view`).
- Toute réponse de devis ou de facture (listes, création, statut, devis → facture) passe par `withTotals(doc)` = `{ ...doc, ...documentTotals(doc) }`.
- Création : lignes enregistrées avec `kind` et `vatRate = lineVatRate(kind, s)` ; totaux `computeTotals` enregistrés. Agence sans taxes : `kind` forcé à `SERVICE`.
- Devis → facture : devis ancien (`total` nul) → lignes `SERVICE`, `vatRate 0`, totaux `computeTotals(items, NO_TAXES)` ; sinon lignes avec leur `kind` et totaux recalculés avec les Paramètres du jour.
- `recordPayment` : solde = `documentTotals(invoice).total − payé` ; facture « payée » quand le reste ≤ 0,001.
- [ ] **Step 1 : tests.**
  - `facture créée avec taxes : lignes et totaux enregistrés` (prisma `invoice.create` reçoit `total: 3881`, ligne débours `vatRate: 0`, service `vatRate: 19`).
  - `agence sans taxes : débours forcé en service, total brut`.
  - `devis ancien → facture garde la somme brute, sans TVA ni timbre`.
  - `devis récent → facture garde les types et recalcule avec les Paramètres du jour`.
  - `paiement du TTC exact (3 × 45,5 à 19 % + timbre = 163.435) accepté et facture payée`.
  - `paiement au-delà du TTC refusé`.
  - `facture existante : changer vatRate des Paramètres ne change pas ses totaux` (documentTotals sur l'objet enregistré).
  - DTO Paramètres : `vatRate: -1` et `vatRate: 101` refusés ; `19` accepté.
- [ ] **Step 2–4 :** RED → `prisma db push` → GREEN ; `npx jest && npx tsc --noEmit`.
- [ ] **Step 5 :** commit `feat(api): TVA, débours et timbre enregistrés sur les devis et factures`.

### Task 3 : Contrats, relances, rapports, portail

**Files :** Modify `src/contracts/contracts.service.ts`, `src/contracts/dto/contract.dto.ts`, `src/reminders/reminders.detect.ts`, `src/reports/reports.service.ts`, `src/portal/portal.service.ts` ; Test les `*.spec.ts` correspondants.

**Interfaces — Consumes :** Task 1, `FinanceService.taxSettings` (ou lecture directe des Paramètres). **Produces :**
- Contrat depuis un devis : `totalAmount = documentTotals(quote).total` (devis ancien → somme brute) ; `{{total}}` = ce montant ; `{{services}}` ajoute « (débours) » / « (مصاريف مسبقة) » aux lignes `DISBURSEMENT`.
- Contrat manuel : `ContractItemDto.kind?` ; total `computeTotals(items, taxSettings)`.
- Relances « facture en retard » et rapports (reste à encaisser) : solde via `documentTotals`. Les requêtes Prisma sélectionnent les champs de totaux et `kind`.
- Portail : factures renvoyées avec `withTotals`.
- [ ] **Step 1 : tests.**
  - `contrat depuis un devis taxé : totalAmount = total du devis (3881) et {{total}} = 3881.000`.
  - `contrat depuis un devis ancien, taxes activées : total = somme brute`.
  - `ligne débours marquée dans {{services}}` (FR et AR).
  - `relance en retard : reste = TTC − payé` (facture taxée).
  - `rapport : reste à encaisser utilise le TTC`.
- [ ] **Step 2–4 :** RED → GREEN ; suite complète.
- [ ] **Step 5 :** commit `feat(api): contrats, relances, rapports et portail sur le total TTC`.

### Task 4 : PDF (FR/AR)

**Files :** Modify `src/finance/pdf/labels.ts`, `src/finance/pdf/pdf.service.ts`, `src/finance/finance.service.ts` (renderPdf), `scripts/pdf-samples.ts` ; Test `src/finance/pdf/pdf.service.spec.ts`

**Interfaces — Produces :**
- `DocumentItem` gagne `kind?: LineKind; vatRate?: number`.
- `PdfService.document(header, items, totals?: Totals & { taxed: boolean; vatRate: number })` : si `totals?.taxed`, colonne « TVA » (`19 %` ou libellé débours) et récapitulatif sous le tableau (lignes à zéro masquées : débours, timbre) ; sinon rendu actuel. Le reçu n'en passe pas.
- `LABELS.fr/ar` : `vat` (« TVA » / « الأداء »), `subtotal` (« Total HT » / « المجموع دون اعتبار الأداءات »), `vatLine(rate)` (« TVA 19 % » / « الأداء على القيمة المضافة 19 % »), `disbursement` (« Débours » / « مصاريف مسبقة »), `stampDuty` (« Timbre fiscal » / « الطابع الجبائي »), `totalTtc` (« Total à payer TTC » / « المجموع باعتبار الأداءات »).
- [ ] **Step 1 : tests** (pdftotext) : facture taxée FR contient `Total HT`, `TVA 19 %`, `Débours`, `Timbre fiscal`, `3881.000 TND` ; idem AR avec les libellés arabes ; facture non taxée et reçu ne contiennent pas `Total HT`.
- [ ] **Step 2–4 :** RED → GREEN ; `pdf-samples` étendu (facture taxée FR/AR), `pdftoppm`, relecture à l'œil (alignement des montants, miroir AR).
- [ ] **Step 5 :** commit `feat(api): récapitulatif HT, TVA, débours, timbre et TTC dans les PDF`.

### Task 5 : Interface web

**Files :** Create `apps/web/src/lib/invoice-totals.ts`, `apps/web/scripts/tests/invoice-totals.test.mjs` ; Modify `src/lib/types.ts`, `src/features/candidates/tabs/finance-tab.tsx`, `src/features/portal/portal-finance-page.tsx`, `src/lib/portal-progress.ts`, `src/features/settings/settings-page.tsx`, `messages/{fr,ar}.json`.

**Interfaces — Produces :**
- `types.ts` : `LineItem.kind?`, `vatRate?` ; `Quote`/`Invoice` : `subtotal, vatAmount, disbursements, stampDuty, total: number; taxed: boolean` ; `AgencySettings` : `taxesEnabled, vatRate, stampDuty`.
- `invoice-totals.ts` : `previewTotals(items, settings)` — même règle que `computeTotals` (aperçu uniquement ; le montant qui fait foi vient de l'API).
- Formulaire devis/facture : si `taxesEnabled`, un `Select` « Service / Débours » par ligne et un récapitulatif en direct (HT, TVA x %, Débours, Timbre, TTC) ; sinon formulaire inchangé. Réglages lus via `GET /finance/tax-settings`.
- Listes (onglet Finance, portail, `portal-progress`) : `total` de l'API, plus aucune somme de lignes.
- Paramètres : section « Facturation » (interrupteur, taux %, timbre TND), visible et éditable selon les droits actuels.
- [ ] **Step 1 :** test node `previewTotals` (mêmes cas que Task 1 : 2381, 3881, 163.435).
- [ ] **Step 2 :** implémentation ; gate web (tsc, `test:unit`, `check-i18n`, build).
- [ ] **Step 3 :** captures onglet Finance (formulaire avec récapitulatif) et Paramètres, FR/AR, 1280/390, sans débordement.
- [ ] **Step 4 :** commit `feat(web): lignes service ou débours, récapitulatif TTC, réglages de facturation`.

### Task 6 : Vérification finale

- [ ] Scénario réel par les routes : activer les taxes ; devis service + débours, accepté → facture ; paiement du TTC exact ; contrat depuis le devis ; devis ancien → facture (somme brute). PDF FR et AR relus en image.
- [ ] Changer le taux dans les Paramètres puis relire une facture existante : inchangée.
- [ ] `visual-check` complet sur le build de production.
- [ ] Push, relecture indépendante de la branche, PR (base `feat/documents-arabe`), compte rendu au propriétaire : **activer « Appliquer la TVA et le timbre fiscal » dans les Paramètres** et lancer `prisma db push` en production.
