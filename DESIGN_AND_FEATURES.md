# CacaoTrace — Application Mobile Terrain (React Native / Expo)

## Design & Inspiration Visuelle
L'application mobile a été conçue en s'inspirant directement de la maquette de référence (`edd616b5d9fc94fad684aeacd5da3a01.webp`) :

- **Palette Eco-Luxury / Forest Canopy** : Fond vert forêt sombre (`#0A261D`, `#0F382C`), cartes en verre dépoli (`rgba(255, 255, 255, 0.92)`), émeraude vif (`#1E6B4C`) et menthe douce (`#8FE4B9`).
- **Barre de Navigation Flottante en Pilule** (`FloatingTabBar`) : Navigation courbée flottante avec icônes vectorielles et pastille de notification pour la file de synchronisation offline.
- **Cartes Métriques Végétales** (`MetricCard`) : Visualisation des indicateurs clés (Superficie totale ha, Parcelles enregistrées, Producteurs, Statut de conformité).
- **Accompagnement du producteur** (`ProducteurTipCard`) : Widget inspiré du "Tip of the Day" pour orienter le suivi technique des producteurs.
- **Visualiseur Boussole GPS 4 Sommets** (`CompassGPSGauge`) : Jauge circulaire affichant les 4 sommets de placette et la superficie calculée en temps réel (EPSG:4326).

---

## Fonctionnalités Métier & Protocoles (Blocs A, B, C, D)

### 1. Formulaire Multi-Étapes (Wizard Responsive Mobile & Tablette)
- **Bloc A (Producteur & RGPD)** : Saisie identité, tranche d'âge, situation familiale et switch de consentement obligatoire RGPD du producteur.
- **Bloc B (Pratiques Culturales)** : Année d'installation, superficie déclarée, entretiens, engrais, diagnostic maladies (Swollen Shoot, Pourriture brune) et production estimée.
- **Bloc C (Géoréférencement Placette)** : Numéro de placette, délégation régionale, village et capture GPS haute précision des 4 sommets avec validation des bornes géographiques de Côte d'Ivoire (`lat [4.0, 10.8]`, `lon [-8.6, -2.5]`).
- **Bloc D (Dendrométrie SP1 à SP6)** : Sélection dynamique des 6 sous-placettes et mesure des cacaoyers (circonférence à 30cm, DBH à 1.30m, hauteur) et arbres d'ombrage (espèce, maturité, fût).

### 2. Architecture Offline-First & Synchronisation
- **Moteur de Stockage Local** (`offlineStorage.ts`) : Sauvegarde locale instantanée sans connexion Internet.
- **File d'attente Sync Queue** : Stocke toutes les actions (`CREATE`, `UPDATE`) sous forme de batchs.
- **Centre de Sync** (`SyncScreen.tsx` & `api.ts`) : Bouton "Synchroniser le Batch", gestion des retentatives et envoi vers l'API backend `/api/v1/sync/push`.

### 3. Cartographie & SIG (`CarteScreen.tsx`)
- Visualisation interactive du polygone formé par les 4 sommets.
- Calques d'inspection et informations cadastrales pour la traçabilité (non-déforestation).
