// ============================================================================
// Actum Collect — Le nom de la solution
// ----------------------------------------------------------------------------
// Reproduit `actum_collect_name.svg` en éléments natifs plutôt que d'afficher
// le fichier. Trois raisons, dans l'ordre :
//
//   1. React Native ne lit pas le SVG sans `react-native-svg`, absent d'ici ;
//   2. le fichier porte du TEXTE non vectorisé en « Segoe UI » / « Montserrat »,
//      polices absentes d'Android. Même avec la bibliothèque, le rendu
//      retomberait sur Roboto — donc sur le même résultat qu'ici, au prix
//      d'une dépendance en plus ;
//   3. en éléments natifs, le nom reste net à toute taille, suit la mise à
//      l'échelle de l'écran et se lit par les lecteurs d'écran.
//
// Les couleurs, elles, sont reprises AU PIXEL du fichier source : c'est la
// marque, elle ne se réinterprète pas.
// ============================================================================

import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

/**
 * Teintes du fichier de marque, utilisées TELLES QUELLES en thème clair.
 * En sombre, elles cèdent la place aux équivalents de la palette : le brun
 * #2E1A17 sur le fond #0B1512 tombe à 1,3:1, soit un nom invisible.
 */
const BRUN_ACTUM = '#2E1A17';
const VERT_COLLECT = '#1B5E20';
const AMBRE_PASTILLE = '#D97706';

interface NomSolutionProps {
  /** Hauteur des capitales, en points. Tout le reste s'en déduit. */
  taille?: number;
  style?: StyleProp<ViewStyle>;
}

export const NomSolution: React.FC<NomSolutionProps> = ({ taille = 20, style }) => {
  const { palette, estSombre } = useTheme();

  // En clair, la marque exacte ; en sombre, les pas déjà mesurés de la palette.
  // L'ambre suit celui des avertissements : le même ambre vif éblouit de nuit,
  // et la pastille est un petit aplat, donc d'autant plus agressive.
  const couleurActum = estSombre ? palette.textPrimary : BRUN_ACTUM;
  const couleurCollect = estSombre ? palette.emeraldPrimary : VERT_COLLECT;
  const couleurPastille = estSombre ? palette.warning : AMBRE_PASTILLE;
  // Le « O » de COLLECT est remplacé par une épingle de carte. Elle est
  // légèrement plus petite que les capitales : à taille égale, sa pointe
  // débordait sous la ligne de base et déséquilibrait le mot.
  const epingle = Math.round(taille * 0.78);
  const pastille = Math.round(epingle * 0.34);

  return (
    <View
      style={[styles.ligne, style]}
      // Lu d'un seul tenant : sans cela, un lecteur d'écran énoncerait
      // « ACTUM C LLECT » avec un blanc à la place de l'épingle.
      accessible
      accessibilityRole="header"
      accessibilityLabel="Actum Collect"
    >
      <Text style={[styles.mot, { fontSize: taille, color: couleurActum }]}>ACTUM</Text>
      <View style={{ width: Math.round(taille * 0.28) }} />
      <Text style={[styles.mot, { fontSize: taille, color: couleurCollect }]}>C</Text>

      {/* Épingle : un carré arrondi sur trois coins, pivoté d'un huitième de
          tour — la pointe se forme au coin resté droit. Le disque intérieur
          est un cercle, donc insensible à la rotation : rien à contre-pivoter. */}
      <View style={styles.emplacementEpingle}>
        <View
          style={{
            width: epingle,
            height: epingle,
            backgroundColor: couleurCollect,
            borderTopLeftRadius: epingle / 2,
            borderTopRightRadius: epingle / 2,
            borderBottomRightRadius: epingle / 2,
            borderBottomLeftRadius: 2,
            transform: [{ rotate: '45deg' }],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: pastille,
              height: pastille,
              borderRadius: pastille / 2,
              backgroundColor: couleurPastille,
            }}
          />
        </View>
      </View>

      <Text style={[styles.mot, { fontSize: taille, color: couleurCollect }]}>LLECT</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  ligne: {
    flexDirection: 'row',
    // Alignement sur la BASE et non au centre : les lettres et l'épingle n'ont
    // pas la même hauteur, un centrage ferait flotter l'épingle au-dessus de
    // la ligne d'écriture.
    alignItems: 'flex-end',
  },
  mot: {
    fontWeight: '800',
    letterSpacing: 0.5,
    // Interligne collé à la hauteur de police : la valeur par défaut ajoute un
    // talon sous la ligne de base qui décale l'épingle vers le haut.
    includeFontPadding: false,
  },
  emplacementEpingle: {
    justifyContent: 'flex-end',
    // Le carré pivoté déborde de sa boîte en diagonale ; ces marges lui
    // rendent la place qu'il occupe réellement à l'écran.
    marginHorizontal: 3,
    marginBottom: 1,
  },
});
