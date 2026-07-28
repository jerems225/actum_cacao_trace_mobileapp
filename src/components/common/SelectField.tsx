// ============================================================================
// CacaoTrace — Select (liste déroulante) réutilisable
// ----------------------------------------------------------------------------
// React Native n'a pas d'équivalent du <select> HTML. Plutôt qu'ajouter une
// dépendance de picker, ce composant ouvre une feuille modale : un champ fermé
// qui affiche la valeur retenue, et la liste complète au clic.
//
// Pourquoi un select et pas des chips : une liste de référentiel grandit (les
// maladies sont ajoutées par l'administration). Passé une dizaine d'entrées, les
// chips occupent tout l'écran et l'agent doit défiler pour trouver sa valeur.
// Le champ fermé garde le formulaire lisible, et la recherche remplace le
// balayage visuel dès que la liste s'allonge.
// ============================================================================

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';

export interface SelectOption {
  /** Identifiant stable de l'option (clé de sélection). */
  key: string;
  label: string;
  /** Complément affiché en gris à droite (ex. « sans ombre »). */
  hint?: string;
}

interface SelectFieldProps {
  value: string | null;
  options: SelectOption[];
  onChange: (key: string | null) => void;
  placeholder?: string;
  /** Titre de la feuille modale. */
  title?: string;
  /** Autorise le retour à « aucune valeur ». */
  allowClear?: boolean;
  /** Force l'affichage du champ de recherche (sinon : automatique au-delà de 8 options). */
  searchable?: boolean;
  disabled?: boolean;
}

export const SelectField: React.FC<SelectFieldProps> = ({
  value,
  options,
  onChange,
  placeholder = 'Sélectionner…',
  title = 'Sélectionner',
  allowClear = true,
  searchable,
  disabled = false,
}) => {
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState('');

  const selection = options.find((o) => o.key === value) ?? null;
  const avecRecherche = searchable ?? options.length > 8;

  const optionsFiltrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, recherche]);

  const fermer = () => {
    setOuvert(false);
    setRecherche('');
  };

  const choisir = (key: string) => {
    // Re-cliquer sur la valeur déjà retenue la retire, si autorisé.
    onChange(allowClear && key === value ? null : key);
    fermer();
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.champ, disabled && styles.champDesactive]}
        onPress={() => !disabled && setOuvert(true)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={selection ? `${title} : ${selection.label}` : placeholder}
      >
        <Text style={[styles.valeur, !selection && styles.placeholder]} numberOfLines={1}>
          {selection ? selection.label : placeholder}
        </Text>
        <Ionicons name="chevron-down-outline" size={18} color={colors.textSecondary} />
      </TouchableOpacity>

      <Modal visible={ouvert} transparent animationType="fade" onRequestClose={fermer}>
        {/* Fond cliquable : fermer sans choisir est le geste attendu. */}
        <Pressable style={styles.fond} onPress={fermer}>
          <Pressable style={styles.feuille} onPress={(e) => e.stopPropagation()}>
            <View style={styles.entete}>
              <Text style={styles.titre}>{title}</Text>
              <TouchableOpacity onPress={fermer} hitSlop={10}>
                <Ionicons name="close-outline" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {avecRecherche && (
              <View style={styles.rechercheBoite}>
                <Ionicons name="search-outline" size={15} color={colors.textMuted} />
                <TextInput
                  style={styles.rechercheInput}
                  placeholder="Rechercher…"
                  placeholderTextColor={colors.textMuted}
                  value={recherche}
                  onChangeText={setRecherche}
                  autoCorrect={false}
                />
              </View>
            )}

            <ScrollView style={styles.liste} keyboardShouldPersistTaps="handled">
              {optionsFiltrees.length === 0 ? (
                <Text style={styles.vide}>Aucun résultat pour « {recherche.trim()} »</Text>
              ) : (
                optionsFiltrees.map((o) => {
                  const actif = o.key === value;
                  return (
                    <TouchableOpacity
                      key={o.key}
                      style={[styles.ligne, actif && styles.ligneActive]}
                      onPress={() => choisir(o.key)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.ligneTexte}>
                        <Text style={[styles.ligneLabel, actif && styles.ligneLabelActive]}>
                          {o.label}
                        </Text>
                        {o.hint ? <Text style={styles.ligneHint}>{o.hint}</Text> : null}
                      </View>
                      {actif && <Ionicons name="checkmark-outline" size={17} color={colors.emeraldPrimary} />}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            {allowClear && selection && (
              <TouchableOpacity
                style={styles.effacer}
                onPress={() => {
                  onChange(null);
                  fermer();
                }}
              >
                <Ionicons name="arrow-undo-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.effacerTexte}>Effacer la sélection</Text>
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  champ: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: colors.backgroundCard,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  champDesactive: { opacity: 0.5 },
  valeur: { flex: 1, fontSize: 14, color: colors.textPrimary },
  placeholder: { color: colors.textMuted },

  fond: {
    flex: 1,
    backgroundColor: 'rgba(11, 40, 30, 0.55)',
    justifyContent: 'flex-end',
  },
  feuille: {
    backgroundColor: colors.backgroundCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 18,
    paddingBottom: 24,
    maxHeight: '78%',
  },
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  titre: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },

  rechercheBoite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: colors.backgroundLight,
    borderRadius: 9,
  },
  rechercheInput: { flex: 1, fontSize: 14, color: colors.textPrimary, padding: 0 },

  liste: { paddingHorizontal: 12 },
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 13,
    borderRadius: 10,
  },
  ligneActive: { backgroundColor: colors.mintBadge },
  ligneTexte: { flex: 1 },
  ligneLabel: { fontSize: 14.5, color: colors.textPrimary },
  ligneLabelActive: { fontWeight: '600', color: colors.emeraldPrimary },
  ligneHint: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  vide: {
    fontSize: 13.5,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 26,
    paddingHorizontal: 20,
  },

  effacer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 10,
    marginHorizontal: 20,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  effacerTexte: { fontSize: 13, color: colors.textSecondary },
});
