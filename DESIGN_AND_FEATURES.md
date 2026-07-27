# CacaoTrace — Application Mobile Terrain (React Native / Expo)

## Design & Inspiration Visuelle
L'application mobile a été conçue en s'inspirant directement de la maquette de référence (`edd616b5d9fc94fad684aeacd5da3a01.webp`) :

- **Palette Eco-Luxury / Forest Canopy** : Fond vert forêt sombre (`#0A261D`, `#0F382C`), cartes en verre dépoli (`rgba(255, 255, 255, 0.92)`), émeraude vif (`#1E6B4C`) et menthe douce (`#8FE4B9`).
- **Barre de Navigation Flottante en Pilule** (`FloatingTabBar`) : Navigation courbée flottante avec icônes vectorielles et pastille de notification pour la file de synchronisation offline.
- **Cartes Métriques Végétales** (`MetricCard`) : Visualisation des indicateurs clés (Superficie totale ha, Parcelles enregistrées, Producteurs, État sanitaire).
- **Accompagnement du producteur** (`ProducteurTipCard`) : Widget inspiré du "Tip of the Day" pour orienter le suivi technique des producteurs.
- **Visualiseur Boussole GPS 4 Sommets** (`CompassGPSGauge`) : Jauge circulaire affichant les 4 sommets de placette et la superficie calculée en temps réel (EPSG:4326).

---

## Fonctionnalités Métier & Protocoles (Blocs A, B, C, D)

### 1. Formulaire Multi-Étapes (Wizard Responsive Mobile & Tablette)
- **Bloc A (Producteur & RGPD)** : Saisie identité, tranche d'âge, situation familiale et switch de consentement obligatoire RGPD du producteur.
- **Bloc B (Pratiques Culturales)** : Année d'installation, superficie déclarée, **B4 — pratiques culturales** (voir ci-dessous) et production estimée. *Pas de saisie d'état sanitaire ici* : il est relevé sujet par sujet au Bloc D, avec photo de diagnostic — un doublon déclaratif au niveau parcelle produisait une donnée redondante et deux réponses possiblement contradictoires.
- **Bloc C (Géoréférencement Placette)** : Numéro de placette, délégation régionale, village et capture GPS haute précision des 4 sommets avec validation des bornes géographiques de Côte d'Ivoire (`lat [4.0, 10.8]`, `lon [-8.6, -2.5]`).
- **Bloc D (Dendrométrie SP1 à SP6)** : voir la section dédiée ci-dessous.

### 1 bis. Bloc B4 — Pratiques culturales, disposition retenue

Le questionnaire papier présente le B4 en tableau : 3 colonnes (Entretien /
Tailles / Engrais) × 4 rubriques (Types de pratiques, Agent(s) pratiquant(s),
Fréquence, Nombre de fois par an). Un tableau à 3 colonnes ne tient pas sur un
écran de téléphone — la structure est donc **pivotée : un volet à la fois**.

Le risque de cette bascule est que l'agent perde le fil de la colonne qu'il
remplit. Trois repères l'en empêchent : les onglets d'accès, un **bandeau qui
nomme le volet actif**, et l'**état d'avancement** de chaque volet.

```
Pratiques culturales (plusieurs réponses possibles)
[✓ Entretien] [✓ Tailles] [✓ Engrais] [ Aucune pratique ] [ Autres ]
Entretien, Tailles et Engrais ouvrent chacun un détail à renseigner.
Aucune pratique et Autres demandent une précision écrite.

┌─────────────────────────────────────────────────┐
│ DÉTAIL DES PRATIQUES            1/3 complété   │
│ [✓ Entretien] [○ Tailles] [⊖ Engrais]          │  ← onglets + état
│ ┃ 📋 TAILLES              volet 2 sur 3        │  ← bandeau d'identité
│                                                 │
│ Types de pratiques                              │
│ [ Égourmandage ] [ Plantes parasitaires ] …     │
│ Agent(s) pratiquant(s)                          │
│ [ Planteur ] [ Manœuvre ] [ Agent ANADER ] …    │
│ Fréquence                                       │
│ [ Mensuel ] [ Trimestriel ] [ Semestriel ] …    │
│ Nombre de fois par an   [    ]                  │
└─────────────────────────────────────────────────┘
```

| Règle | Comportement |
|---|---|
| **Titre de section retiré** | L'écran annonce déjà « Bloc B » : réafficher « B4 — Pratiques culturales » était redondant. |
| **Onglets pilotés par les cases** | Cocher « Engrais » fait apparaître son onglet ; le décocher le fait disparaître. L'onglet actif est recalculé, jamais laissé sur un volet décoché. |
| **Bandeau d'identité** | Le nom du volet actif est rappelé juste au-dessus des rubriques, avec son rang (« volet 2 sur 3 »). Après un défilement, la question « je remplis quelle colonne ? » ne se pose plus. |
| **Cadre visuel** | Le détail est encadré et sur fond légèrement teinté : on voit où commence et où finit la colonne du tableau papier. |
| **État par volet** | Pastille sur chaque onglet — plein = complété (types + agents + fréquence renseignés), creux = entamé, barré = pas encore touché. Compteur « n/3 complété » en tête. Le nombre de fois par an n'entre pas dans le compte : la case est vide sur le papier, tous les producteurs ne la connaissent pas. |
| **Un état par volet** | Entretien, Tailles et Engrais ne partagent aucun champ — même principe que les brouillons par sous-placette du Bloc D. |
| **Effet des cases annoncé** | Une ligne d'aide explique que les trois premières cases ouvrent un détail et les deux dernières un champ texte, au lieu de le laisser découvrir en tâtonnant. |
| **Exclusion logique** | « Aucune pratique » décoche les trois volets, et inversement. Une fiche contradictoire ne peut pas être produite. |
| **Précisions conditionnelles** | Les champs « Autres : … » (types, agents, fréquence) n'apparaissent **que** si la case correspondante est cochée, et disparaissent avec elle. |
| **B4.1 / B4.2** | Cocher « Aucune pratique » ou « Autres » ouvre le champ de précision, obligatoire pour passer à l'étape suivante. |
| **Libellé « Agent ANADER »** | Choix assumé de fidélité au formulaire papier ; le code technique reste `AGENT_TERRAIN`. |

### 1 ter. Bloc D — Mesures dendrométriques, règles de saisie

| Règle | Comportement |
|---|---|
| **Un brouillon par sous-placette** | Chaque onglet SP1→SP6 garde ses propres champs. Basculer d'onglet retrouve sa saisie en cours ; rien n'est recopié d'une SP à l'autre. |
| **Comptage contextuel** | Onglet *Cacaoyer* → seul « Nombre de cacaoyers » est affiché ; onglet *Arbre d'ombrage* → seul « Nombre d'arbres ». Les deux valeurs restent mémorisées par SP et partent ensemble à l'enregistrement. |
| **Grosseur du sujet** | Cacaoyer : bascule **cm** ou **DBH (m)**, une seule des deux. Arbre d'ombrage : **DBH (m) uniquement**, pas de bascule. Changer de type vide le champ (unités différentes). |
| **Quota SP2–SP6** | 3 cacaoyers maximum par sous-placette (bloquant) ; SP1 illimité (recensement). Arbres illimités partout. |
| **État MALADE** | Maladie obligatoire (liste déroulante + « autre ») **et** photo de diagnostic obligatoire. |
| **Maladie en liste déroulante** | Composant `SelectField` (`components/common/SelectField.tsx`) : champ fermé qui ouvre une feuille modale, avec recherche automatique au-delà de 8 entrées. Le référentiel s'enrichit au fil des validations — des chips finiraient par occuper tout l'écran. Aucune dépendance de picker ajoutée. |
| **Maladie hors-liste** | Saisie par l'agent → ajoutée au référentiel en `A_VALIDER`, réutilisable par toute l'équipe après validation dans l'administration. |
| **Liste jamais vide** | Si le référentiel n'est pas encore synchronisé (1re installation, terrain sans réseau), un repli embarqué de 12 maladies courantes est proposé (`MALADIES_PAR_DEFAUT`). |

### 1 quater. Typage des champs de saisie

Deux niveaux complémentaires, centralisés dans `src/utils/champs.ts` :

1. **Filtrage à la frappe** — `sanitizeEntier` / `sanitizeDecimal` : l'agent ne
   peut pas taper une lettre dans une hauteur, ni deux virgules, ni plus de
   2 décimales. Un comptage n'accepte que des chiffres.
2. **Bornes de plausibilité** — `verifieBorne` au moment de valider, avec un
   message qui dit quoi corriger (« DBH : maximum 5 m — vérifiez la saisie »).

`LIMITES` (`src/utils/champs.ts`) est le miroir de `LIMITES` côté backend
(`backend/src/schemas/index.ts`) : **les deux doivent bouger ensemble**. Le mobile
guide l'agent, le backend refuse pour de bon.

### 2. Architecture Offline-First & Synchronisation
- **Moteur de Stockage Local** (`offlineStorage.ts`) : Sauvegarde locale instantanée sans connexion Internet.
- **File d'attente Sync Queue** : Stocke toutes les actions (`CREATE`, `UPDATE`) sous forme de batchs.
- **Centre de Sync** (`SyncScreen.tsx` & `api.ts`) : Bouton "Synchroniser le Batch", gestion des retentatives et envoi vers l'API backend `/api/v1/sync/push`.

### 3. Cartographie & SIG (`CarteScreen.tsx`)
- Visualisation interactive du polygone formé par les 4 sommets.
- Calques d'inspection et informations cadastrales pour le suivi de production.
