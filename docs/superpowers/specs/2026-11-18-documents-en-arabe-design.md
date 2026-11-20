# Documents en arabe (devis, factures, reçus, contrats) — document de conception

Date : 2026-11-18 · Branche : `feat/documents-arabe` (créée à partir de `feat/relances-messages`) · Chantier 3 de l'étape 2, première partie

## 1. Intention

Les **familles** (souvent les parents, qui paient et signent) lisent mieux l'arabe. Aujourd'hui, tous les PDF (devis,
factures, reçus, contrats) sont uniquement en français : l'outil actuel (pdfkit) ne sait pas écrire l'arabe
correctement (lettres détachées, ordre inversé). Le propriétaire veut que ces documents puissent sortir en arabe.

La TVA et les factures en euros, citées au départ, viennent **après**, dans une seconde partie du chantier 3. Elles ne
sont pas couvertes ici.

## 2. Décisions du propriétaire

| Sujet | Décision |
|---|---|
| Forme | **B — une langue par document** : le document sort entièrement en arabe ou entièrement en français, selon la **langue préférée** du candidat (champ `preferredLanguage`, ajouté au chantier précédent). Un bouton permet de télécharger l'autre langue. |
| Technique | **Option 1** : garder pdfkit et lui apprendre l'arabe (police arabe libre embarquée + liaison des lettres + ordre de lecture droite→gauche). Raison : l'API tourne sur un hébergement de 512 Mo (plan gratuit) ; un navigateur sans interface (~300 Mo par rendu) le ferait planter. |

## 3. Objectifs, non-objectifs, anti-objectifs

**Objectifs**
- Devis, facture et reçu générés en **arabe** ou en **français**, au choix, avec par défaut la langue préférée du candidat.
- Contrat créé dans la langue préférée du candidat, à partir d'un **modèle de contrat arabe** que l'agence rédige
  dans les Paramètres. Un modèle arabe par défaut est fourni.
- Le candidat télécharge ses factures et contrats dans sa langue depuis son portail.

**Non-objectifs**
- TVA, timbre fiscal, factures en euros, taux de change (seconde partie du chantier 3).
- Documents bilingues sur une même page (option A, écartée).
- Traduction automatique des lignes de prestation : elles restent telles que l'employé les a saisies (voir §6).
- Refonte visuelle complète des PDF : on garde la mise en page actuelle, en la rendant symétrique pour l'arabe.

**Anti-objectifs (échec même si « ça marche »)**
- **Arabe illisible** : lettres non liées, mots à l'envers, ou glyphes manquants (carrés vides).
- **Ordre faux dans les lignes mixtes** : un numéro de facture (`FAC-2026-0012`), un montant (`2 400,000 TND`), une
  date, un nom latin ou un passeport inversés ou mal placés dans une phrase arabe.
- **Contrat signé modifié** : un contrat signé reste figé dans la langue et le texte signés. Jamais régénéré dans
  une autre langue.
- Mémoire : la génération d'un PDF arabe dépasse nettement la consommation actuelle (cible : moins de 50 Mo de plus
  par rendu), ou alourdit l'image Docker de plus de quelques Mo.
- Régression du PDF français existant.

## 4. Contraintes techniques constatées

- `apps/api/src/finance/pdf/pdf.service.ts` : `PdfService.document(header, items)` (devis, facture, reçu) et
  `PdfService.contract(header, content, signature)`. Les textes sont écrits en dur en français (« Client : »,
  « Description », « Qté », « Total », « Matricule fiscal »…) et les dates en `fr-TN`.
- Routes PDF : `GET quotes/:id/pdf`, `GET invoices/:id/pdf`, `GET payments/:id/receipt`, `GET contracts/:id/pdf`
  (admin, `finance.view`) ; `GET portal/invoices/:id/pdf` et `GET portal/contracts/:id/pdf` (candidat).
- Contrat : `ContractsService.create` remplit `AgencySettings.contractTemplate` (ou `DEFAULT_TEMPLATE`, en français)
  avec des espaces réservés `{{…}}`, et **enregistre le texte rempli** dans `Contract.content`. Le PDF reproduit ce
  texte, qui est figé une fois signé.
- `Candidate.preferredLanguage` (`fr` | `ar`) existe (branche `feat/relances-messages`).
- Image Docker : `node:22-alpine`, plan à 512 Mo de mémoire.
- `pdftotext` et `pdftoppm` (poppler) sont disponibles dans l'environnement de développement pour vérifier les PDF.

## 5. Approches envisagées

1. **pdfkit + arabe** *(retenue)* : police arabe libre (Amiri ou Noto Naskh Arabic, licence OFL), liaison des
   lettres et ordre bidirectionnel. Léger, mais demande de soigner les lignes mixtes.
2. HTML → PDF avec un navigateur sans interface : rendu parfait, mais environ 300 Mo par rendu, ce qui est
   incompatible avec 512 Mo.
3. Service externe payant : coût récurrent, et données clients envoyées à un tiers.

## 6. Conception

### 6.1 Langue d'un document
- Paramètre `?lang=fr|ar` sur toutes les routes PDF. **Par défaut** : la `preferredLanguage` du candidat du document.
- Contrat : sa langue est **celle de sa création** (nouveau champ `Contract.language`, `fr` par défaut pour les
  contrats existants). `?lang` est ignoré pour un contrat. On ne peut pas produire « l'autre version » d'un texte
  figé.
- Nom de fichier : `Facture-FAC-2026-0012.pdf` ou `فاتورة-FAC-2026-0012.pdf`.

### 6.2 Libellés des documents
- Tous les libellés fixes (Devis/عرض سعر, Facture/فاتورة, Reçu/وصل, Client/الحريف, Description/البيان,
  Qté/الكمية, Prix unitaire/سعر الوحدة, Total/المجموع, Matricule fiscal/المعرف الجبائي, Payé/مدفوع,
  Signature du candidat/إمضاء المترشح, Signé le/أُمضي يوم…) sont regroupés dans **un seul dictionnaire FR/AR**
  côté API, et non plus écrits en dur.
- Dates au format de la langue : `ar-TN` en chiffres latins, pour rester cohérent avec les montants. Montants
  **exactement comme aujourd'hui** (`2400.000 TND`, 3 décimales), en français comme en arabe ; la devise reste
  son code (`TND`, `EUR`).

### 6.3 Mise en page arabe
- Le document en arabe est **en miroir** : bloc agence à droite, numéro et date à gauche, colonnes du tableau
  inversées (Description à droite, Total à gauche), texte aligné à droite.
- Les **lignes de prestation** (texte libre) et les **noms** s'affichent tels que saisis. Une ligne en français
  dans une facture arabe reste lisible et correctement placée.

### 6.4 Écrire l'arabe avec pdfkit
- Police arabe embarquée dans le dépôt (`apps/api/assets/fonts/`, avec son fichier de licence OFL), chargée une
  seule fois au démarrage.
- Une fonction `prepareRtl(text)` testée prend un texte (arabe, latin, chiffres, ou mélange) et renvoie des
  segments à dessiner de gauche à droite, avec la bonne police pour chacun. Elle s'appuie sur :
  - la liaison contextuelle des lettres arabes (formes initiale, médiane, finale, isolée, ligature lam-alef), via
    le façonnage OpenType de fontkit (inclus dans pdfkit) si le rendu est correct, sinon via une petite
    bibliothèque dédiée ;
  - l'ordre bidirectionnel Unicode (algorithme UBA, via une bibliothèque légère et éprouvée), pour que les nombres,
    références et mots latins gardent leur sens de lecture au milieu de l'arabe.
- Le choix précis des bibliothèques est laissé au constructeur (§9), sous les contraintes du §3 : pur JavaScript,
  sans dépendance native, quelques centaines de Ko au plus.

### 6.5 Contrat en arabe
- Nouveau champ `AgencySettings.contractTemplateAr`, éditable dans Paramètres à côté du modèle français. Mêmes
  espaces réservés `{{…}}` que le modèle français (aucune nouvelle variable).
- Modèle arabe par défaut `DEFAULT_TEMPLATE_AR`, traduction fidèle du modèle français existant, en arabe standard
  et en termes juridiques simples. À faire relire par l'agence.
- À la création d'un contrat : la langue est la `preferredLanguage` du candidat. Le texte est rempli avec le modèle
  de cette langue. Si l'agence a effacé le modèle arabe, le texte par défaut est utilisé. Les montants et dates
  sont formatés dans la langue. Le résultat est enregistré dans `Contract.content` avec `Contract.language`.
- La signature (image du tracé) et la mention « Signé le » s'affichent dans la langue du contrat.

### 6.6 Interface
- Dossier candidat, onglet Finance : chaque bouton PDF (devis, facture, reçu, contrat) ouvre le document dans la
  langue préférée du candidat. À côté, un petit lien « العربية » ou « Français » ouvre l'autre langue (sauf pour un
  contrat).
- Portail candidat : les PDF s'ouvrent dans la langue préférée du candidat.
- Paramètres : un second champ « Modèle de contrat (arabe) », en `dir="rtl"`.

## 7. Vérification
- Tests unitaires de `prepareRtl` sur des cas réels :
  - « فاتورة » ;
  - « المجموع : 2 400,000 TND » ;
  - « الفاتورة FAC-2026-0012 » ;
  - un nom latin dans une phrase arabe ;
  - un texte uniquement français (inchangé) ;
  - la ligature lam-alef « لا ».
- Tests des services : la langue par défaut suit `preferredLanguage` ; `?lang` la remplace ; le contrat garde sa
  langue ; le contrat arabe utilise `contractTemplateAr` ou le défaut.
- Vérification sur de vrais PDF générés : `pdftotext` (ordre logique du texte extrait) et `pdftoppm` (image relue à
  l'œil) pour une facture, un reçu, un devis et un contrat signé, en arabe et en français.
- Mesure de la mémoire (rss) avant et après génération de 20 factures arabes d'affilée.
- `visual-check` : onglet Finance et portail (liens de langue), en FR et AR.

## 8. Précisions après relecture (choix de conception, à valider par le propriétaire)

1. **Langue du contrat au moment de sa création.** La langue préférée du candidat est proposée par défaut, mais
   l'employé peut **choisir l'autre langue** dans le formulaire de création. Un contrat **non signé** (brouillon ou
   envoyé) se refait dans l'autre langue en l'annulant puis en en créant un nouveau, comme aujourd'hui. Seul un
   contrat signé est définitivement figé.
2. **Coordonnées de l'agence en arabe.** On ajoute deux champs facultatifs dans Paramètres : « Nom de l'agence
   (arabe) » et « Adresse (arabe) ». Sur un document arabe, ils sont utilisés s'ils sont remplis, sinon les champs
   actuels s'affichent tels quels. Le pied de page « Document généré par… » est traduit.
3. **Aucune nouvelle variable** de contrat : le nom du candidat reste en caractères latins, tel que saisi.
4. **Format des montants inchangé** (voir §6.2), donc aucune modification des PDF français existants.
5. **L'arabe s'affiche aussi correctement dans un document français** (par exemple une ligne de prestation saisie
   en arabe). Seuls les textes qui contiennent des caractères arabes passent par `prepareRtl` et la police arabe ;
   un texte entièrement latin est dessiné exactement comme aujourd'hui, sans risque de régression.

## 9. Laissé au constructeur
- Le choix de la police (Amiri ou Noto Naskh Arabic) et des bibliothèques de façonnage et d'ordre bidirectionnel,
  dans les contraintes du §3 et du §6.4.
- Le texte exact du modèle de contrat arabe par défaut.
- Les détails de mise en miroir des colonnes et des marges.
