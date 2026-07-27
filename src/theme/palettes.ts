// ============================================================================
// CacaoTrace — Palettes claire et sombre
// ----------------------------------------------------------------------------
// La palette claire (`colors`) reste la référence : c'est elle que les écrans
// importent aujourd'hui. La palette sombre en reprend EXACTEMENT les clés, si
// bien qu'un écran migré n'a qu'à lire `useTheme().palette` au lieu de `colors`.
//
// ⚠️ Limite assumée de cette première passe : certaines clés servent à la fois
// de fond et de couleur de texte (`emeraldPrimary` par exemple). Les valeurs
// sombres ci-dessous sont choisies pour rester lisibles dans les deux emplois,
// mais la vraie réponse est un jeu de jetons sémantiques (surface / sur-surface
// / accent). Ce découpage viendra avec la migration des écrans restants.
// ============================================================================

import { colors } from './colors';

export type Palette = typeof colors;

export const paletteClaire: Palette = colors;

export const paletteSombre: Palette = {
  // Verts de marque : on ne les inverse pas — un fond « forêt » doit rester
  // sombre, sinon le texte blanc posé dessus devient illisible. On les éclaircit
  // juste assez pour qu'ils se détachent du fond de page.
  forestDark: '#1B4D3C',
  forestCard: '#16382B',
  forestLight: '#22624D',

  emeraldPrimary: '#2F9E6C',
  emeraldBright: '#3FBE84',
  mintLight: '#34D399',
  mintSoft: '#2A6B52',
  mintBadge: '#15342A',

  // Surfaces : fond de page plus sombre que les cartes, pour que la hiérarchie
  // reste lisible sans ombre portée (les ombres ne se voient pas sur du noir).
  backgroundLight: '#0B1512',
  backgroundCard: '#111F1A',
  backgroundCardGlass: 'rgba(17, 31, 26, 0.95)',
  backgroundDarkCard: '#0A1C16',

  // Textes : jamais de blanc pur sur fond sombre, il vibre. Un blanc légèrement
  // verdi fatigue moins en plein écran.
  textPrimary: '#E7EFEA',
  textSecondary: '#9BB0A6',
  textMuted: '#6E8579',
  textLight: '#FFFFFF',
  textMint: '#4ADE9B',

  conformiteSuccess: '#34D399',
  conformiteBadgeBg: '#14392C',

  // Statuts : teintes désaturées. Un ambre ou un rouge vif sur fond sombre
  // éblouit en usage nocturne, ce qui est précisément le cas d'usage.
  warning: '#F0B76A',
  warningBg: '#2A2113',
  warningBorder: '#4A3A20',
  error: '#F87171',
  errorBg: '#3A1A1A',

  draftBg: '#1A242A',
  draftBorder: '#33424B',
  draftText: '#AFC0CA',
  slate: '#C3D0CA',

  borderLight: '#24352E',
  borderDark: '#2E5A49',

  pillBlack: '#20493A',
  pillEmerald: '#2F9E6C',
};
