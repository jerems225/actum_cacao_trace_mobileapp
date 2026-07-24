# CacaoTrace — Application Mobile (Expo / React Native)

Application mobile de collecte de données terrain pour l'inventaire géoréférencé et la traçabilité des parcelles cacaoyères en Côte d'Ivoire.

## Fonctionnalités Principales
- **Mode Offline-First** : Saisie complète sans connexion via SQLite local.
- **Capture GPS Haute Précision** : Validation des 4 sommets de placette et sous-placettes (SP1-SP6).
- **Mesures Dendrométriques** : Saisie unitaire et mode lot rapide.
- **Queue de Synchronisation** : Synchronisation automatique/manuelle avec le backend avec résolution de conflits.

## Démarrage

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer l'environnement
cp .env.example .env

# 3. Lancer Expo
npx expo start
```
