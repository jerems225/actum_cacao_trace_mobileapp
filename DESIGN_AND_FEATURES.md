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

### 1 bis. Navigation libre et cycle de vie de la collecte

Sur le terrain, l'ordre de saisie n'est pas celui du formulaire : un producteur
s'absente, un relevé GPS attend une éclaircie. **La navigation entre blocs n'est
donc jamais bloquée** — les contrôles vivent au moment d'enregistrer, pas au
moment de changer d'écran.

Deux niveaux de contrôle, à ne pas confondre :

| Niveau | Quand | Effet |
|---|---|---|
| **Erreurs de saisie** (`erreursDeSaisie`) | valeur hors bornes de plausibilité | Bloque **tout** enregistrement, brouillon compris — le backend la refuserait à la synchro, et un brouillon impossible à synchroniser serait un piège silencieux |
| **Informations manquantes** (`champsManquants`) | champ requis vide | Bloque **seulement la soumission**. La liste s'affiche en clair à la dernière étape |

À la fin du Bloc D, deux actions explicites — l'agent décide, rien n'est choisi à
sa place :

```
┌─────────────────────────────────┐
│ ⚠ 3 informations requises      │
│   manquantes                    │
│   • Prénoms du producteur (A)   │
│   • Ville (Bloc C)              │
│   • Sommets GPS (2/4) — Bloc C  │
│   Vous pouvez enregistrer en    │
│   brouillon et compléter plus   │
│   tard.                         │
└─────────────────────────────────┘
[ 💾 Enregistrer en brouillon ]
[ ✓  Soumettre la collecte     ]
  Une collecte soumise n'est plus
  modifiable depuis le mobile.
```

| Statut | Comportement mobile |
|---|---|
| **Brouillon** | Badge orange dans « Enquêtes », et bouton **« Compléter la fiche »**. Synchronisé quand même (rien n'est perdu si l'appareil casse) mais exclu des statistiques et des exports côté serveur. |
| **Soumise** | Le bouton disparaît de la fiche, remplacé par un encart verrouillé qui indique où adresser la correction. Le backend refuse aussi la modification arrivée par la synchro. |

**Reprise d'un brouillon** — « Compléter la fiche » réouvre **le parcours de
saisie complet**, prérempli, et non un formulaire réduit : c'est le seul moyen de
compléter les sommets GPS ou l'identité du producteur. L'enregistrement part
alors en **modification** et non en création.

L'appariement se fait sur des clés stables, pour modifier au lieu de recréer :

| Entité | Clé d'appariement | Cas traités |
|---|---|---|
| Producteur, Parcelle, Placette | identifiant local (déjà connu) | UPDATE |
| Sous-placette | `numero` (SP1…SP6) | UPDATE / CREATE / DELETE |
| Mesure | identifiant local, conservé au rechargement | UPDATE / CREATE / DELETE |

Cela suppose que le mobile connaisse les identifiants **serveur** des entités
imbriquées : `SousPlacetteLocal.serverId` et `MesureArbreLocal.serverId` sont
renseignés à la synchronisation (`markSynced`) et alimentent la table de
correspondance du `SyncManager`. Sans eux, une correction repartirait en création.

Le numéro de placette n'est **jamais** régénéré à la reprise : il a été attribué
de façon autoritative par le serveur et sert de référence terrain.

**Informations requises pour soumettre** (liste à ajuster si le terrain la trouve
trop stricte) :

- **Bloc A** : nom, prénoms, consentement du producteur ;
- **Bloc B** : superficie, année d'installation, au moins une case de pratiques
  cochée, type de pratique pour chaque volet coché, précisions B4.1 / B4.2 le cas
  échéant ;
- **Bloc C** : délégation, ville, village, chef d'équipe, les 4 sommets GPS ;
- **Bloc D** : au moins une mesure, et le nombre de cacaoyers recensés en SP1.

**Défilement** — chaque changement d'étape ramène en haut de page : sans cela
l'agent arrive au milieu du bloc suivant, à la hauteur qu'il avait laissée.

Statut métier et état de synchronisation sont **deux axes distincts**, affichés
séparément dans la fiche : une collecte peut être « soumise mais pas encore
synchronisée », ou « brouillon déjà synchronisé ».

### 1 ter. Bloc B4 — Pratiques culturales, disposition retenue

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

### 1 quater. Bloc D — Mesures dendrométriques, règles de saisie

| Règle | Comportement |
|---|---|
| **Un brouillon par sous-placette** | Chaque onglet SP1→SP6 garde ses propres champs. Basculer d'onglet retrouve sa saisie en cours ; rien n'est recopié d'une SP à l'autre. |
| **Comptage contextuel** | Onglet *Cacaoyer* → seul « Nombre de cacaoyers » est affiché ; onglet *Arbre d'ombrage* → seul « Nombre d'arbres ». Les deux valeurs restent mémorisées par SP et partent ensemble à l'enregistrement. |
| **Grosseur du sujet** | Cacaoyer : bascule **cm** ou **DBH (m)**, une seule des deux. Arbre d'ombrage : **DBH (m) uniquement**, pas de bascule. Changer de type vide le champ (unités différentes). |
| **Quota SP2–SP6** | 3 cacaoyers maximum par sous-placette (bloquant) ; SP1 illimité (recensement). Arbres illimités partout. |
| **État sanitaire = cacaoyers seuls** | L'onglet *Arbre d'ombrage* n'affiche **pas** l'état de santé : le diagnostic porte sur la production de cacao, un arbre est relevé pour son espèce et sa grosseur. Basculer vers *Arbre* remet l'état à `VIVANT` et efface maladie et photo, pour ne pas transmettre un diagnostic saisi sur un cacaoyer. Le backend refuse tout état non `VIVANT` sur un arbre. |
| **État MALADE** | Maladie obligatoire (liste déroulante) **et** photo de diagnostic obligatoire. |
| **Espèce et maladie en listes déroulantes** | Composant `SelectField` (`components/common/SelectField.tsx`) : champ fermé qui ouvre une feuille modale, avec recherche automatique au-delà de 8 entrées. Les deux référentiels s'enrichissent au fil des validations — des chips finiraient par occuper tout l'écran. Aucune dépendance de picker ajoutée. |
| **« Autres » en fin de liste** | L'option « Autres (à préciser) » est **la dernière** de chaque liste déroulante, et le champ de saisie n'apparaît **que** si elle est retenue. Auparavant un champ libre restait visible en permanence sous les puces, ce qui laissait croire à deux réponses possibles. |
| **Valeur hors-liste** | Espèce ou maladie saisie par l'agent → ajoutée au référentiel en `A_VALIDER`, réutilisable par toute l'équipe après validation dans l'administration. Une espèce hors-liste est enregistrée comme non émettrice d'ombre. |
| **Liste jamais vide** | Si le référentiel n'est pas encore synchronisé (1re installation, terrain sans réseau), un repli embarqué de 12 maladies courantes est proposé (`MALADIES_PAR_DEFAUT`). |

### 1 quinquies. Responsive et lisibilité

Le système responsive vit dans `src/theme/responsive.ts` (`useResponsive`) :
classe d'appareil déduite du **côté court** — donc stable à la rotation —,
échelle typographique bornée, largeur de contenu maximale centrée.

Le wizard de collecte n'en profitait pas : sa feuille de styles était figée, avec
des tailles de texte en dur. Elle est désormais une **fabrique**
(`createStyles(responsive)`, mémoïsée) :

| Aspect | Traitement |
|---|---|
| **Tailles de texte** | Toutes passent par `scale()` : bornées entre ×0,88 (petit téléphone) et ×1,3 (tablette). Plus de texte tassé ni de texte perdu. |
| **Hauteurs de ligne** | `lineHeight` explicite sur les titres, sous-titres et libellés : les majuscules accentuées (É, À) ne sont plus rognées. |
| **Marges des titres** | Espace avant un titre de section proportionnel à l'écran (`avantTitre`), respiration nette entre titre et sous-titre. |
| **Padding des cartes** | 15 px sur petit téléphone, 18 px en standard, 24 px sur tablette. |
| **Anti-débordement** | Les puces reçoivent `maxWidth: '100%'` + `flexShrink` — un libellé long (« Plantes parasitaires (loranthacées, épiphytes) ») passe à la ligne au lieu de sortir de la carte. Les conteneurs en ligne reçoivent `minWidth: 0`, les textes longs `flex: 1`. |
| **Répartition régulière** | Les 6 sous-placettes et les 3 onglets de volet se partagent la largeur (`flexGrow` + `flexBasis`) et se replient proprement. |
| **Numéro de placette** | Taille et interlettrage réduits sur petit écran : `D-ABJ-ABJ-001` tenait mal dans sa carte. |

### 1 sexies. Typage des champs de saisie

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
