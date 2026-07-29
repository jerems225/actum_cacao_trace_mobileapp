// ============================================================================
// CacaoTrace — Demande de confirmation, web et natif
// ----------------------------------------------------------------------------
// Même raison d'être que le Toast maison : `Alert.alert` de React Native n'est
// PAS implémenté sur react-native-web. Il n'y lève aucune erreur — il ne fait
// simplement rien, et l'action se poursuit comme si l'agent avait confirmé.
// Une confirmation invisible est pire que pas de confirmation du tout : elle
// laisse croire à un garde-fou qui n'existe pas.
// ============================================================================

import { Alert, Platform } from 'react-native';

interface OptionsConfirmation {
  titre: string;
  message: string;
  /** Libellé de l'action qui poursuit. Défaut : « Confirmer ». */
  libelleConfirmer?: string;
  /** Libellé de l'action qui renonce. Défaut : « Annuler ». */
  libelleAnnuler?: string;
  /** Marque l'action comme destructive (rouge sur iOS). */
  destructif?: boolean;
}

/**
 * Pose une question fermée et rend `true` si l'agent confirme.
 *
 * Toujours attendre la réponse : `if (await confirmer(...))`. La forme à
 * rappel (`onPress`) invitait à oublier le cas « annulé », qui est justement
 * celui qu'on cherche à traiter.
 */
export function confirmer({
  titre,
  message,
  libelleConfirmer = 'Confirmer',
  libelleAnnuler = 'Annuler',
  destructif = false,
}: OptionsConfirmation): Promise<boolean> {
  if (Platform.OS === 'web') {
    // `window.confirm` est bloquant et sans style, mais il fonctionne partout
    // et rend une vraie réponse. Le remplacer un jour par une modale maison ne
    // changera rien aux appelants : la signature restera la même.
    const reponse =
      typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm(`${titre}\n\n${message}`)
        : true;
    return Promise.resolve(reponse);
  }

  return new Promise((resoudre) => {
    Alert.alert(titre, message, [
      // « Annuler » en premier : sur Android, le dernier bouton est le plus à
      // droite, donc le plus facile à toucher par mégarde. L'action qui
      // détruit ne doit pas être celle qui tombe sous le pouce.
      { text: libelleAnnuler, style: 'cancel', onPress: () => resoudre(false) },
      {
        text: libelleConfirmer,
        style: destructif ? 'destructive' : 'default',
        onPress: () => resoudre(true),
      },
    ]);
  });
}
