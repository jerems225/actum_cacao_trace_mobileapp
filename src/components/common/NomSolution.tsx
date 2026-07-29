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

/** Teintes du SVG de marque. À ne modifier qu'avec le fichier source. */
const BRUN_ACTUM = '#2E1A17';
const VERT_COLLECT = '#1B5E20';
const AMBRE_PASTILLE = '#D97706';

interface NomSolutionProps {
  /** Hauteur des capitales, en points. Tout le reste s'en déduit. */
  taille?: number;
  /** Force la teinte du mot « ACTUM » — utile sur fond sombre. */
  couleurActum?: string;
  style?: StyleProp<ViewStyle>;
}

export const NomSolution: React.FC<NomSolutionProps> = ({
  taille = 20,
  couleurActum = BRUN_ACTUM,
  style,
}) => {
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
      <Text style={[styles.mot, { fontSize: taille, color: VERT_COLLECT }]}>C</Text>

      {/* Épingle : un carré arrondi sur trois coins, pivoté d'un huitième de
          tour — la pointe se forme au coin resté droit. Le disque intérieur
          est un cercle, donc insensible à la rotation : rien à contre-pivoter. */}
      <View style={styles.emplacementEpingle}>
        <View
          style={{
            width: epingle,
            height: epingle,
            backgroundColor: VERT_COLLECT,
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
              backgroundColor: AMBRE_PASTILLE,
            }}
          />
        </View>
      </View>

      <Text style={[styles.mot, { fontSize: taille, color: VERT_COLLECT }]}>LLECT</Text>
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
