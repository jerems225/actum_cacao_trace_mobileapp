// ============================================================================
// CacaoTrace — Fourniture du thème (clair / sombre / système)
// ----------------------------------------------------------------------------
// Un écran migré remplace `import { colors } from '../theme'` par
// `const { palette } = useTheme()`. Tant qu'il ne l'est pas, il continue de
// fonctionner en clair : les deux formes cohabitent sans rien casser.
//
// État de la migration : écran Paramètres, en-tête et barre d'onglets sont
// branchés. Les autres écrans suivront, un commit par écran.
// ============================================================================

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, type ColorSchemeName } from 'react-native';
import { paletteClaire, paletteSombre, type Palette } from './palettes';
import { preferencesService, type ThemeMode } from '../services/preferences';

interface ThemeContexte {
  /** Choix de l'agent : 'systeme' | 'clair' | 'sombre'. */
  mode: ThemeMode;
  /** Ce qui est réellement affiché une fois le mode « système » résolu. */
  estSombre: boolean;
  palette: Palette;
  changerMode: (mode: ThemeMode) => Promise<void>;
}

const Contexte = createContext<ThemeContexte>({
  mode: 'systeme',
  estSombre: false,
  palette: paletteClaire,
  changerMode: async () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>(preferencesService.getCacheOuDefauts().theme);
  // Depuis RN 0.86, `ColorSchemeName` vaut 'light' | 'dark' : l'indéterminé en
  // a été retiré, alors que `getColorScheme()` peut toujours ne rien rendre
  // (thème système pas encore connu). On garde donc `null` dans l'état.
  // Sans conséquence à l'affichage : seul `=== 'dark'` est testé plus bas,
  // tout le reste retombe sur le thème clair.
  const [schemaSysteme, setSchemaSysteme] = useState<ColorSchemeName | null>(
    Appearance.getColorScheme() ?? null,
  );

  // Préférence enregistrée, relue au démarrage.
  useEffect(() => {
    let vivant = true;
    void preferencesService.get().then((p) => {
      if (vivant) setMode(p.theme);
    });
    const desabonner = preferencesService.souscrire((p) => setMode(p.theme));
    return () => {
      vivant = false;
      desabonner();
    };
  }, []);

  // Réglage système : on suit les changements en direct (bascule nuit d'Android).
  useEffect(() => {
    const abonnement = Appearance.addChangeListener(({ colorScheme }) =>
      setSchemaSysteme(colorScheme ?? null),
    );
    return () => abonnement.remove();
  }, []);

  const estSombre = mode === 'sombre' || (mode === 'systeme' && schemaSysteme === 'dark');

  const changerMode = useCallback(async (suivant: ThemeMode) => {
    setMode(suivant); // Retour visuel immédiat, l'écriture disque suit.
    await preferencesService.set({ theme: suivant });
  }, []);

  const valeur = useMemo<ThemeContexte>(
    () => ({
      mode,
      estSombre,
      palette: estSombre ? paletteSombre : paletteClaire,
      changerMode,
    }),
    [mode, estSombre, changerMode],
  );

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
};

export const useTheme = (): ThemeContexte => useContext(Contexte);
