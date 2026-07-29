// ============================================================================
// CacaoTrace — Demande de confirmation, aux couleurs de l'application
// ----------------------------------------------------------------------------
// Même raison d'être et même forme que le Toast maison : `Alert.alert` de
// React Native n'est PAS implémenté sur react-native-web — il ne lève rien, il
// ne fait rien, et l'action se poursuit comme si l'agent avait confirmé. Quant
// à `window.confirm`, il fonctionne mais affiche une boîte du navigateur au
// milieu d'une application dessinée : ni la typographie, ni les couleurs, ni le
// thème sombre ne suivent.
//
// D'où cette modale, avec la même mécanique que le Toast : une API impérative
// (`confirmer(...)` depuis n'importe quel module) et un unique <ConfirmationHost/>
// monté à la racine. L'appelant ne connaît qu'une promesse de booléen.
// ============================================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive, useTheme } from '../../theme';

export interface OptionsConfirmation {
  titre: string;
  message: string;
  /** Libellé de l'action qui poursuit. Défaut : « Confirmer ». */
  libelleConfirmer?: string;
  /** Libellé de l'action qui renonce. Défaut : « Annuler ». */
  libelleAnnuler?: string;
  /** Action irréversible : teinte d'alerte et icône d'avertissement. */
  destructif?: boolean;
}

interface DemandeEnCours extends OptionsConfirmation {
  id: number;
  repondre: (accepte: boolean) => void;
}

let compteur = 0;
let emettre: ((d: DemandeEnCours) => void) | null = null;

/**
 * Pose une question fermée et rend `true` si l'agent confirme.
 *
 * Toujours attendre la réponse : `if (await confirmer(...))`. Une forme à
 * rappel invitait à oublier le cas « annulé », qui est précisément celui qu'on
 * cherche à traiter.
 *
 * Si aucun hôte n'est monté — un module appelé hors de l'arbre React, un test —
 * la promesse se résout à `false` : en cas de doute, on ne fait rien plutôt que
 * d'exécuter une action que personne n'a validée.
 */
export function confirmer(options: OptionsConfirmation): Promise<boolean> {
  if (!emettre) return Promise.resolve(false);
  compteur += 1;
  return new Promise((resoudre) => {
    emettre?.({ ...options, id: compteur, repondre: resoudre });
  });
}

export const ConfirmationHost: React.FC = () => {
  const [demande, setDemande] = useState<DemandeEnCours | null>(null);
  const { palette } = useTheme();
  const { contentMaxWidth } = useResponsive();
  const opacite = useRef(new Animated.Value(0)).current;
  const echelle = useRef(new Animated.Value(0.94)).current;

  useEffect(() => {
    emettre = (d) => setDemande(d);
    return () => {
      emettre = null;
    };
  }, []);

  useEffect(() => {
    if (!demande) {
      opacite.setValue(0);
      echelle.setValue(0.94);
      return;
    }
    Animated.parallel([
      Animated.timing(opacite, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.spring(echelle, { toValue: 1, friction: 9, tension: 90, useNativeDriver: true }),
    ]).start();
  }, [demande, opacite, echelle]);

  const repondre = useCallback(
    (accepte: boolean) => {
      // La réponse part AVANT de démonter : la promesse doit être résolue même
      // si le composant appelant disparaît dans la foulée (navigation).
      demande?.repondre(accepte);
      setDemande(null);
    },
    [demande],
  );

  if (!demande) return null;

  const destructif = demande.destructif === true;
  const teinte = destructif ? palette.error : palette.emeraldPrimary;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      // Retour matériel Android : équivaut à renoncer, jamais à confirmer.
      onRequestClose={() => repondre(false)}
    >
      <Animated.View style={[styles.fond, { opacity: opacite }]}>
        {/* Toucher le fond revient à annuler — geste attendu sur mobile. Mais
            l'appui NE traverse PAS jusqu'à la carte : sans cette zone dédiée,
            un appui sur le message fermerait la modale. */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => repondre(false)}
          accessibilityLabel="Annuler"
        />

        <Animated.View
          style={[
            styles.carte,
            {
              backgroundColor: palette.backgroundCard,
              borderColor: palette.borderLight,
              maxWidth: Math.min(contentMaxWidth, 420),
              transform: [{ scale: echelle }],
            },
          ]}
        >
          <View style={[styles.pastille, { backgroundColor: destructif ? palette.errorBg : palette.mintBadge }]}>
            <Ionicons
              name={destructif ? 'alert-circle-outline' : 'help-circle-outline'}
              size={22}
              color={teinte}
            />
          </View>

          <Text style={[styles.titre, { color: palette.textPrimary }]}>{demande.titre}</Text>
          <Text style={[styles.message, { color: palette.textSecondary }]}>{demande.message}</Text>

          {/* L'action qui renonce est à GAUCHE et visuellement discrète : sur un
              téléphone tenu d'une main, le bord droit tombe sous le pouce, et
              c'est la position qu'on touche par réflexe. Elle ne doit pas être
              occupée par l'action irréversible. */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.bouton, styles.boutonSecondaire, { borderColor: palette.borderLight }]}
              onPress={() => repondre(false)}
              activeOpacity={0.85}
            >
              <Text style={[styles.boutonTexteSecondaire, { color: palette.textPrimary }]}>
                {demande.libelleAnnuler ?? 'Annuler'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bouton, { backgroundColor: teinte }]}
              onPress={() => repondre(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.boutonTexte}>{demande.libelleConfirmer ?? 'Confirmer'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fond: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  carte: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 1,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  pastille: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  titre: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    width: '100%',
  },
  bouton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boutonSecondaire: {
    borderWidth: 1,
  },
  boutonTexte: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  boutonTexteSecondaire: {
    fontSize: 14,
    fontWeight: '700',
  },
});
