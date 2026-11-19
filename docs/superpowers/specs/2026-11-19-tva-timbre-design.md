# TVA, débours et timbre fiscal sur les devis et factures — document de conception

Date : 2026-11-19 · Branche : `feat/tva-timbre` (créée à partir de `feat/documents-arabe`) · Chantier 3 de l'étape 2, seconde partie

## 1. Intention

Le **client**, le **comptable** et l'**administration fiscale** demandent tous les trois des factures **conformes** :
TVA, débours sans TVA et timbre fiscal, avec un total hors taxes et un total toutes taxes comprises. Aujourd'hui,
un devis ou une facture n'est qu'une liste de lignes dont le total est la somme brute : aucune taxe n'apparaît.

## 2. Décisions du propriétaire

| Sujet | Décision |
|---|---|
| Lignes | Certaines lignes sont des **débours** (sommes payées pour le compte du candidat : inscription à l'université, Campus France, visa) **sans TVA** ; le reste est un **service de l'agence à 19 %**. |
| Approche | **A — un type par ligne (« Service » ou « Débours »), taux et timbre recopiés et figés dans le document à sa création.** Écartées : B (taux libre par ligne, plus d'erreurs de saisie, inutile aujourd'hui) et C (taxes calculées à l'affichage depuis les Paramètres : changer un taux modifierait les factures déjà émises). |
| Euros | **Pas de paiement en euros pour le moment.** Tout reste en dinars (TND) : factures, paiements, caisse, rapports. Les euros sont sortis du chantier. |

## 3. Objectifs, non-objectifs, anti-objectifs

**Objectifs**
- Saisie d'un devis ou d'une facture : chaque ligne est « Service » (TVA au taux de l'agence) ou « Débours » (sans TVA). Les prix sont saisis **hors taxes**.
- Calcul et affichage, à l'écran et dans les PDF (français et arabe) :
  Total HT des services · TVA 19 % · Débours · Timbre fiscal · **Total à payer (TTC)**.
- Le taux de TVA (19 %) et le timbre (1,000 TND) se règlent dans les Paramètres et sont **figés** dans chaque document au moment de sa création.
- Partout où un total de facture est utilisé (solde restant, paiement, relances de factures en retard, rapports, portail candidat), c'est le **total TTC enregistré** qui compte.
- Le total d'un contrat est le TTC.

**Non-objectifs**
- Euros, taux de change, paiements en devises (décision du propriétaire).
- Un second taux de TVA (7 % ou 13 %) à l'écran : le taux est enregistré par ligne, donc ajoutable plus tard sans migration de données.
- Rapport de chiffre d'affaires HT ou déclaration de TVA : les rapports gardent leur sens actuel (sommes encaissées), seul le total des factures change (voir §6.6).
- Modification d'une facture après création (impossible aujourd'hui, inchangé).
- Avoirs / factures d'annulation.

**Anti-objectifs (échec même si « ça marche »)**
- **Une facture déjà émise change de montant**, que ce soit au déploiement ou après un changement de taux dans les Paramètres.
- **Un écran et le PDF affichent des totaux différents** pour la même facture (deux calculs qui divergent).
- Erreur d'arrondi visible : TVA ou total qui ne tombe pas juste au millime (3 décimales).
- Un débours soumis à la TVA, ou un service sans TVA, sans que l'employé l'ait choisi.
- Régression : solde restant, refus d'un paiement supérieur au solde, relances « facture en retard » faussés.

## 4. Contraintes constatées

- Modèles Prisma `Quote`/`QuoteItem`, `Invoice`/`InvoiceItem` : `label`, `quantity`, `unitPrice` ; `currency` (toujours `TND` en pratique). Aucune facture n'est modifiable après création.
- Pas de migrations dans le dépôt : le schéma est appliqué par `prisma db push`. Les nouveaux champs doivent donc avoir une valeur par défaut ou être facultatifs, sans script de reprise obligatoire.
- Huit endroits recalculent un total comme somme brute des lignes :
  `finance.service.ts`, `contracts.service.ts`, `reminders.detect.ts`, `reports.service.ts`, `finance/pdf/pdf.service.ts`,
  `web/.../finance-tab.tsx`, `web/.../portal-finance-page.tsx`, `web/src/lib/portal-progress.ts`.
- Un devis accepté se transforme en facture (`POST quotes/:id/to-invoice`) en recopiant ses lignes.
- Le reçu PDF réutilise `PdfService.document` avec une seule ligne « Paiement — facture n ».
- Plateforme multi-agences (`Organization`) : chaque agence a ses `AgencySettings`.

## 5. Approches envisagées

1. **A — type par ligne + taux figés dans le document** *(retenue par le propriétaire)*.
2. B — taux libre par ligne (0/7/13/19 %) : plus souple, plus d'erreurs de saisie, inutile aujourd'hui.
3. C — taxes calculées à l'affichage depuis les Paramètres : rejetée, un changement de taux modifierait l'historique.

## 6. Conception

### 6.1 Données
- `QuoteItem` et `InvoiceItem` : `kind` (`SERVICE` | `DISBURSEMENT`, défaut `SERVICE`) et `vatRate Float @default(0)` (taux recopié à la création : 19 pour un service, 0 pour un débours).
- `Quote` et `Invoice` : totaux **enregistrés** à la création :
  `subtotal` (HT des services), `vatAmount`, `disbursements`, `stampDuty`, `total` (TTC), tous `Float?`.
  **`total` vide = document créé avant cette fonctionnalité** : son total reste la somme brute de ses lignes, sans taxe ni timbre (voir §6.3).
- `AgencySettings` : `vatRate Float @default(19)`, `stampDuty Float @default(1)`, `taxesEnabled Boolean @default(false)` (voir §8).

### 6.2 Calcul (un seul endroit)
- Une fonction pure partagée côté API, `computeTotals(items, { vatRate, stampDuty, taxesEnabled })`, testée :
  - `subtotal` = Σ quantité × prix des lignes `SERVICE` ;
  - `vatAmount` = arrondi au millime de `subtotal × vatRate / 100` (TVA calculée sur le total des services, pas ligne par ligne) ;
  - `disbursements` = Σ des lignes `DISBURSEMENT` ;
  - `stampDuty` = timbre si l'agence applique les taxes, sinon 0 ;
  - `total` = `subtotal + vatAmount + disbursements + stampDuty`, arrondi au millime.
  - Si l'agence n'applique pas les taxes : `vatRate` des lignes = 0, `vatAmount` = 0, timbre = 0, `total` = somme brute.
- Le timbre s'applique aux **factures** ; sur un **devis**, il est affiché pour que le total annoncé soit celui qui sera facturé.

### 6.3 Total d'un document : une seule fonction de lecture
- `invoiceTotal(invoice)` : `invoice.total` s'il est enregistré, sinon la somme brute des lignes (factures anciennes).
- Tous les endroits du §4 (API) l'utilisent. Les réponses de l'API pour les devis et factures incluent les totaux (`subtotal`, `vatAmount`, `disbursements`, `stampDuty`, `total`), toujours remplis (calculés pour une facture ancienne : TVA 0, timbre 0). **Le web n'additionne plus jamais les lignes** : il affiche ces champs.

### 6.4 Création
- Création de devis ou de facture : les totaux sont calculés avec les Paramètres de l'agence **au moment de la création** et enregistrés avec le document.
- Devis → facture : les lignes sont recopiées **avec leur type** ; les taux et le timbre sont ceux des Paramètres **à la date de la facture** (c'est la facture qui fait foi fiscalement).
- Contrat : `totalAmount` = total TTC calculé de la même façon ; la variable `{{total}}` du modèle donne le TTC ; `{{services}}` signale les débours (« (débours) » / « (مصاريف مسبقة) »).

### 6.5 Paiements et relances
- Solde restant = `invoiceTotal − paiements`. Le refus d'un paiement supérieur au solde et le passage au statut « payée » s'appuient sur ce total.
- Les relances « facture en retard » utilisent le même solde.

### 6.6 Rapports
- « Encaissé » reste la somme des paiements (TTC, débours compris). « Reste à encaisser » utilise `invoiceTotal`. Pas de rapport HT dans ce chantier.

### 6.7 PDF (français et arabe)
- Tableau : colonne supplémentaire « TVA » (« 19 % » ou « Débours » / « مصاريف مسبقة »).
- Sous le tableau, aligné comme le total actuel :
  Total HT · TVA 19 % · Débours · Timbre fiscal · **Total à payer TTC**. Une ligne à zéro (pas de débours) n'est pas affichée.
- Facture ancienne (`total` vide) et **reçu** : rendu actuel, une seule ligne de total.
- Libellés dans le dictionnaire FR/AR (`labels.ts`) : Total HT / المجموع دون اعتبار الأداءات, TVA / الأداء على القيمة المضافة, Débours / مصاريف مسبقة, Timbre fiscal / الطابع الجبائي, Total TTC / المجموع باعتبار الأداءات.

### 6.8 Interface web
- Formulaire de devis/facture : pour chaque ligne, un choix « Service » / « Débours » (défaut : Service), et sous les lignes un **récapitulatif en direct** (HT, TVA, débours, timbre, TTC) calculé avec les Paramètres de l'agence, pour voir le total avant de créer.
- Listes (onglet Finance, portail) : affichent `total` renvoyé par l'API.
- Paramètres, section « Facturation » : interrupteur « Appliquer la TVA et le timbre fiscal », taux de TVA (%), montant du timbre (TND).

## 7. Vérification
- Tests de `computeTotals` sur des cas réels : services seuls ; services + débours ; débours seuls ; arrondi au millime (ex. 45,5 × 3 à 19 %) ; taxes désactivées ; quantité > 1.
- Tests des services : une facture enregistre ses totaux ; une facture ancienne (`total` vide) garde la somme brute ; changer `vatRate` dans les Paramètres ne change pas une facture existante ; devis → facture garde les types ; paiement refusé au-delà du TTC ; relance « en retard » sur le solde TTC.
- PDF : facture taxée et facture ancienne, FR et AR, relues en image (`pdftoppm`) ; `pdftotext` contient les cinq lignes du récapitulatif.
- `visual-check` : onglet Finance (formulaire avec récapitulatif), Paramètres, portail.

## 8. Choix laissés au constructeur / pris par défaut (à valider par le propriétaire)
1. **Interrupteur par agence, désactivé par défaut** (`taxesEnabled = false`) : la plateforme héberge plusieurs agences, et une agence non assujettie ne doit pas voir apparaître la TVA au déploiement. Le propriétaire l'active dans les Paramètres de son agence.
2. TVA calculée sur le total des services, arrondie une fois au millime (et non ligne par ligne).
3. Timbre affiché sur le devis pour annoncer le bon total.
4. Devis → facture : taux et timbre de la date de la facture.
5. Le détail visuel du récapitulatif et du formulaire.
6. **Agence sans taxes** (`taxesEnabled = false`) : ses nouveaux documents gardent **la mise en page actuelle**
   (une seule ligne de total, pas de colonne TVA, pas de mention HT/TTC) et le formulaire **n'affiche pas** le choix
   « Service / Débours ». Les totaux sont quand même enregistrés (TVA 0, timbre 0, total = somme brute).
   Le récapitulatif détaillé n'apparaît que si le document a été créé avec les taxes (`vatAmount` ou `stampDuty` > 0,
   ou au moins une ligne `DISBURSEMENT`).
7. **Total d'un contrat créé depuis un devis** : il reprend le **total enregistré du devis** (celui que le candidat a
   accepté, timbre compris), sans recalcul. Contrat saisi à la main (API seulement : l'écran ne crée un contrat que
   depuis un devis) : `ContractItemDto` reçoit un `kind` facultatif (défaut `SERVICE`) et le total est calculé avec
   les Paramètres du moment.
