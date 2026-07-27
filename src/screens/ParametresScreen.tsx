// ============================================================================
// CacaoTrace — Paramètres de l'application
// ----------------------------------------------------------------------------
// Sept rubriques repliables, une seule ouverte à la fois : sur un téléphone
// tenu d'une main, une longue page de réglages à plat oblige à chercher. Ici,
// l'agent voit d'abord la liste de ce qu'il peut régler, puis ouvre le sujet.
//
// Répartition assumée entre local et serveur :
//  - profil et identifiant  → serveur (ils suivent le compte) ;
//  - thème et notifications → appareil (ils décrivent ce téléphone) ;
//  - activité               → serveur, en lecture seule.
// ============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Header } from '../components/common/Header';
import { toast } from '../components/common/Toast';
import { useResponsive, useTheme, type Palette } from '../theme';
import type { Responsive } from '../theme/responsive';
import { authService, type UserProfile } from '../services/auth';
import { apiClient, type ActivityEntry } from '../services/apiClient';
import { ApiSyncService } from '../services/api';
import { HttpError } from '../services/http';
import { offlineStorage } from '../services/storage';
import { preferencesService, type ThemeMode } from '../services/preferences';
import { delegationsService } from '../services/delegations';
import { referentielsService } from '../services/referentiels';
import { settingsService } from '../services/settings';
import { formatRole, type TabType } from '../types';

interface ParametresScreenProps {
  onNavigate?: (tab: TabType) => void;
  onProfilePress?: () => void;
  onNotificationPress?: () => void;
  unreadCount?: number;
  user?: UserProfile | null;
  onProfileUpdated?: (user: UserProfile) => void;
  onLogout?: () => void;
}

type Rubrique = 'compte' | 'securite' | 'notifications' | 'apparence' | 'donnees' | 'activite';

const RUBRIQUES: Array<{
  cle: Rubrique;
  titre: string;
  resume: string;
  icone: keyof typeof Feather.glyphMap;
}> = [
  {
    cle: 'compte',
    titre: 'Compte et profil',
    resume: 'Photo, nom, téléphone, zone d\'affectation',
    icone: 'user',
  },
  {
    cle: 'securite',
    titre: 'Sécurité',
    resume: 'Changer votre code d\'accès',
    icone: 'lock',
  },
  {
    cle: 'notifications',
    titre: 'Notifications',
    resume: 'Alertes affichées par le téléphone',
    icone: 'bell',
  },
  {
    cle: 'apparence',
    titre: 'Apparence',
    resume: 'Thème clair, sombre ou celui du système',
    icone: 'moon',
  },
  {
    cle: 'donnees',
    titre: 'Données et stockage',
    resume: 'Ce que contient l\'appareil, mise à jour des listes',
    icone: 'database',
  },
  {
    cle: 'activite',
    titre: 'Activité du compte',
    resume: 'Connexions, envois et modifications récentes',
    icone: 'activity',
  },
];

const MODES_THEME: Array<{ cle: ThemeMode; libelle: string; aide: string }> = [
  { cle: 'systeme', libelle: 'Système', aide: 'Suit le réglage du téléphone' },
  { cle: 'clair', libelle: 'Clair', aide: 'Lisible en plein soleil' },
  { cle: 'sombre', libelle: 'Sombre', aide: 'Moins éblouissant le soir' },
];

/** Date lisible sans dépendance : « 27/07/2026 à 14:03 ». */
const formatDate = (iso?: string | null): string => {
  if (!iso) return 'jamais';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'date inconnue';
  const deuxChiffres = (n: number) => String(n).padStart(2, '0');
  return `${deuxChiffres(d.getDate())}/${deuxChiffres(d.getMonth() + 1)}/${d.getFullYear()} à ${deuxChiffres(d.getHours())}:${deuxChiffres(d.getMinutes())}`;
};

export const ParametresScreen: React.FC<ParametresScreenProps> = ({
  onNavigate,
  onProfilePress,
  onNotificationPress,
  unreadCount,
  user,
  onProfileUpdated,
  onLogout,
}) => {
  const responsive = useResponsive();
  const { paddingHorizontal, contentStyle } = responsive;
  const { palette, mode, changerMode } = useTheme();
  const styles = useMemo(() => createStyles(palette, responsive), [palette, responsive]);

  const [ouverte, setOuverte] = useState<Rubrique | null>(null);
  const [profil, setProfil] = useState<UserProfile | null>(user ?? null);

  // --- Compte et profil ---
  const [nom, setNom] = useState('');
  const [prenoms, setPrenoms] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [zone, setZone] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | undefined>(undefined);
  const [enregistrementProfil, setEnregistrementProfil] = useState(false);

  // --- Sécurité ---
  const [ancien, setAncien] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [changementEnCours, setChangementEnCours] = useState(false);

  // --- Notifications ---
  const [notificationsActives, setNotificationsActives] = useState(true);

  // --- Données et stockage ---
  const [stats, setStats] = useState<{
    totalProducteurs: number;
    totalParcelles: number;
    totalPlacettes: number;
    totalMesures: number;
    pendingSyncCount: number;
  } | null>(null);
  const [derniereSynchro, setDerniereSynchro] = useState<string | null>(null);
  const [rafraichissement, setRafraichissement] = useState(false);

  // --- Activité ---
  const [activite, setActivite] = useState<ActivityEntry[] | null>(null);
  const [activiteEnCours, setActiviteEnCours] = useState(false);
  const [activiteErreur, setActiviteErreur] = useState<string | null>(null);

  /**
   * Un agent terrain n'a pas de mot de passe : son facteur est le code de
   * sécurité. Le serveur tranche de son côté ; on reprend ici la même règle
   * pour ne pas afficher « mot de passe » à quelqu'un qui saisit un code.
   */
  const estAgentTerrain = !!profil?.codeAgent;
  const libelleSecret = estAgentTerrain ? 'code de sécurité' : 'mot de passe';
  const longueurMini = estAgentTerrain ? 4 : 6;

  useEffect(() => {
    void (async () => {
      const u = await authService.getCurrentUser();
      if (u) appliquerProfil(u);
      const prefs = await preferencesService.get();
      setNotificationsActives(prefs.notificationsActives);
      await chargerDonnees();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const appliquerProfil = (u: UserProfile) => {
    setProfil(u);
    setNom(u.nom);
    setPrenoms(u.prenoms);
    setEmail(u.email ?? '');
    setTelephone(u.telephone ?? '');
    setZone(u.zoneAffectation ?? '');
    setAvatarUri(u.avatarUri);
  };

  const chargerDonnees = useCallback(async () => {
    const [s, historique] = await Promise.all([
      offlineStorage.getStats(),
      offlineStorage.getSyncHistory(),
    ]);
    setStats({
      totalProducteurs: s.totalProducteurs,
      totalParcelles: s.totalParcelles,
      totalPlacettes: s.totalPlacettes,
      totalMesures: s.totalMesures,
      pendingSyncCount: s.pendingSyncCount,
    });
    setDerniereSynchro(historique.length > 0 ? historique[0].date : null);
  }, []);

  /** Le journal serveur n'est chargé qu'à l'ouverture de la rubrique. */
  const chargerActivite = useCallback(async () => {
    setActiviteEnCours(true);
    setActiviteErreur(null);
    try {
      setActivite(await apiClient.getActivity(20));
    } catch (e) {
      setActivite(null);
      setActiviteErreur(
        e instanceof HttpError
          ? e.message
          : 'Serveur injoignable. L\'activité est conservée en ligne, elle réapparaîtra une fois la connexion revenue.',
      );
    } finally {
      setActiviteEnCours(false);
    }
  }, []);

  const basculer = (cle: Rubrique) => {
    const suivante = ouverte === cle ? null : cle;
    setOuverte(suivante);
    if (suivante === 'activite' && activite === null && !activiteEnCours) {
      void chargerActivite();
    }
    if (suivante === 'donnees') void chargerDonnees();
  };

  // --- Actions : profil ---

  const choisirAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        toast.error('Accès à la galerie nécessaire pour changer la photo.');
        return;
      }
      const resultat = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (resultat.canceled || !resultat.assets?.length) return;

      // Affichage immédiat avec le fichier local, puis remplacement par l'URL
      // distante une fois l'envoi fait : l'agent voit sa photo tout de suite,
      // même si le réseau met du temps (ou échoue).
      const uriLocale = resultat.assets[0].uri;
      setAvatarUri(uriLocale);
      let miseAJour = await authService.updateProfile({ avatarUri: uriLocale });
      if (miseAJour) onProfileUpdated?.(miseAJour);

      const envoi = await ApiSyncService.uploadImageToSupabase(uriLocale, 'avatars');
      if (envoi.url) {
        setAvatarUri(envoi.url);
        miseAJour = await authService.updateProfile({ avatarUri: envoi.url });
        if (miseAJour) onProfileUpdated?.(miseAJour);
      }
    } catch {
      toast.error('Impossible de charger cette image.');
    }
  };

  const enregistrerProfil = async () => {
    if (!nom.trim() || !prenoms.trim()) {
      toast.error('Le nom et les prénoms sont obligatoires.');
      return;
    }
    setEnregistrementProfil(true);
    const miseAJour = await authService.updateProfile({
      nom: nom.trim(),
      prenoms: prenoms.trim(),
      // Un agent terrain n'a pas d'email : ne pas en envoyer un vide, qui
      // écraserait la valeur d'un compte administration par erreur.
      ...(estAgentTerrain ? {} : { email: email.trim() }),
      telephone: telephone.trim(),
      zoneAffectation: zone.trim(),
    });
    setEnregistrementProfil(false);
    if (miseAJour) {
      setProfil(miseAJour);
      onProfileUpdated?.(miseAJour);
      toast.success('Profil enregistré.');
    } else {
      toast.error('Enregistrement impossible : aucune session active.');
    }
  };

  // --- Actions : sécurité ---

  const changerSecret = async () => {
    if (nouveau.length < longueurMini) {
      toast.error(`Le nouveau ${libelleSecret} doit faire au moins ${longueurMini} caractères.`);
      return;
    }
    if (nouveau !== confirmation) {
      toast.error('La confirmation ne correspond pas.');
      return;
    }
    if (nouveau === ancien) {
      toast.error(`Le nouveau ${libelleSecret} doit être différent de l'ancien.`);
      return;
    }

    setChangementEnCours(true);
    try {
      const reponse = await apiClient.changeCredential({
        ancien: ancien.length > 0 ? ancien : undefined,
        nouveau,
      });
      setAncien('');
      setNouveau('');
      setConfirmation('');
      toast.success(
        reponse.premiereDefinition
          ? `Votre ${reponse.libelle} est défini.`
          : `Votre ${reponse.libelle} est modifié.`,
      );
    } catch (e) {
      toast.error(
        e instanceof HttpError
          ? e.message
          : 'Changement impossible hors connexion : cette opération se fait sur le serveur.',
      );
    } finally {
      setChangementEnCours(false);
    }
  };

  // --- Actions : préférences et données ---

  const basculerNotifications = async (valeur: boolean) => {
    setNotificationsActives(valeur);
    await preferencesService.set({ notificationsActives: valeur });
  };

  const rafraichirReferentiels = async () => {
    setRafraichissement(true);
    // `Promise.all` : les trois listes sont indépendantes, aucune raison de les
    // enchaîner. Chaque service retombe déjà sur son cache en cas d'échec.
    await Promise.all([
      delegationsService.refresh(),
      referentielsService.refresh(),
      settingsService.refresh(),
    ]);
    setRafraichissement(false);
    toast.success('Listes de référence mises à jour.');
  };

  // --- Rendu ---

  const champ = (
    label: string,
    valeur: string,
    onChange: (v: string) => void,
    options?: { clavier?: 'default' | 'email-address' | 'phone-pad'; secret?: boolean; aide?: string },
  ) => (
    <View style={styles.champ}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={valeur}
        onChangeText={onChange}
        keyboardType={options?.clavier ?? 'default'}
        secureTextEntry={options?.secret}
        autoCapitalize={options?.clavier === 'email-address' ? 'none' : 'sentences'}
        placeholderTextColor={palette.textMuted}
      />
      {options?.aide ? <Text style={styles.aide}>{options.aide}</Text> : null}
    </View>
  );

  const ligneInfo = (label: string, valeur: string) => (
    <View style={styles.ligneInfo} key={label}>
      <Text style={styles.ligneInfoLabel}>{label}</Text>
      <Text style={styles.ligneInfoValeur}>{valeur}</Text>
    </View>
  );

  const contenu = (cle: Rubrique) => {
    switch (cle) {
      case 'compte':
        return (
          <View style={styles.corps}>
            <View style={styles.avatarBloc}>
              <TouchableOpacity onPress={choisirAvatar} activeOpacity={0.85}>
                <Image
                  source={
                    avatarUri
                      ? { uri: avatarUri }
                      : require('../../assets/images/agent_avatar.png')
                  }
                  style={styles.avatar}
                />
                <View style={styles.avatarBouton}>
                  <Feather name="camera" size={13} color={palette.textLight} />
                </View>
              </TouchableOpacity>
              <View style={styles.avatarTexte}>
                <Text style={styles.avatarNom}>
                  {prenoms} {nom}
                </Text>
                <Text style={styles.avatarRole}>
                  {profil ? formatRole(profil.role) : ''}
                  {profil?.codeAgent ? ` • ${profil.codeAgent}` : ''}
                </Text>
              </View>
            </View>

            {champ('Nom', nom, setNom)}
            {champ('Prénoms', prenoms, setPrenoms)}
            {!estAgentTerrain && champ('Email', email, setEmail, { clavier: 'email-address' })}
            {champ('Téléphone', telephone, setTelephone, { clavier: 'phone-pad' })}
            {champ('Zone d\'affectation', zone, setZone)}

            <TouchableOpacity
              style={[styles.boutonPrincipal, enregistrementProfil && styles.boutonInactif]}
              onPress={enregistrerProfil}
              disabled={enregistrementProfil}
            >
              <Feather name="check" size={17} color={palette.textLight} />
              <Text style={styles.boutonPrincipalTexte}>
                {enregistrementProfil ? 'Enregistrement…' : 'Enregistrer'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.aide}>
              Les modifications sont visibles tout de suite sur l&apos;appareil et envoyées
              au serveur dès que la connexion le permet.
            </Text>
          </View>
        );

      case 'securite':
        return (
          <View style={styles.corps}>
            <Text style={styles.paragraphe}>
              {estAgentTerrain
                ? 'Vous vous connectez avec votre code agent et un code de sécurité. C\'est ce code que vous changez ici.'
                : 'Vous vous connectez avec votre email et un mot de passe. C\'est ce mot de passe que vous changez ici.'}
            </Text>

            {champ(`Ancien ${libelleSecret}`, ancien, setAncien, {
              secret: true,
              aide: 'À laisser vide uniquement si un administrateur vient de le réinitialiser.',
            })}
            {champ(`Nouveau ${libelleSecret}`, nouveau, setNouveau, {
              secret: true,
              aide: `${longueurMini} caractères minimum.`,
            })}
            {champ('Confirmation', confirmation, setConfirmation, { secret: true })}

            <TouchableOpacity
              style={[styles.boutonPrincipal, changementEnCours && styles.boutonInactif]}
              onPress={changerSecret}
              disabled={changementEnCours}
            >
              <Feather name="shield" size={17} color={palette.textLight} />
              <Text style={styles.boutonPrincipalTexte}>
                {changementEnCours ? 'Modification…' : `Changer mon ${libelleSecret}`}
              </Text>
            </TouchableOpacity>
            <Text style={styles.aide}>
              Cette opération se fait sur le serveur : elle demande une connexion. Vos
              collectes déjà saisies ne sont pas touchées.
            </Text>
          </View>
        );

      case 'notifications':
        return (
          <View style={styles.corps}>
            <View style={styles.ligneInterrupteur}>
              <View style={styles.ligneInterrupteurTexte}>
                <Text style={styles.ligneInfoLabel}>Alertes sur le téléphone</Text>
                <Text style={styles.aide}>
                  Collecte enregistrée, envoi terminé, alerte sanitaire.
                </Text>
              </View>
              <Switch
                value={notificationsActives}
                onValueChange={basculerNotifications}
                trackColor={{ false: palette.borderLight, true: palette.mintSoft }}
                thumbColor={notificationsActives ? palette.emeraldPrimary : palette.textMuted}
              />
            </View>
            <Text style={styles.aide}>
              Désactivées, les notifications ne s&apos;affichent plus sur l&apos;écran du
              téléphone mais restent consultables dans la cloche, en haut de
              l&apos;application : rien n&apos;est perdu.
            </Text>
          </View>
        );

      case 'apparence':
        return (
          <View style={styles.corps}>
            <View style={styles.choix}>
              {MODES_THEME.map((m) => {
                const actif = mode === m.cle;
                return (
                  <TouchableOpacity
                    key={m.cle}
                    style={[styles.choixItem, actif && styles.choixItemActif]}
                    onPress={() => void changerMode(m.cle)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.choixLibelle, actif && styles.choixLibelleActif]}>
                      {m.libelle}
                    </Text>
                    <Text style={[styles.choixAide, actif && styles.choixAideActif]}>
                      {m.aide}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.aide}>
              Le thème sombre s&apos;applique pour l&apos;instant à cet écran, à
              l&apos;en-tête et à la barre du bas. Les autres écrans suivront ; d&apos;ici là
              ils restent clairs.
            </Text>
          </View>
        );

      case 'donnees':
        return (
          <View style={styles.corps}>
            {ligneInfo('Dernier envoi', formatDate(derniereSynchro))}
            {ligneInfo(
              'Collectes en attente d\'envoi',
              stats ? String(stats.pendingSyncCount) : '—',
            )}
            {ligneInfo('Producteurs sur l\'appareil', stats ? String(stats.totalProducteurs) : '—')}
            {ligneInfo('Parcelles sur l\'appareil', stats ? String(stats.totalParcelles) : '—')}
            {ligneInfo('Placettes sur l\'appareil', stats ? String(stats.totalPlacettes) : '—')}
            {ligneInfo('Mesures enregistrées', stats ? String(stats.totalMesures) : '—')}

            <TouchableOpacity
              style={[styles.boutonSecondaire, rafraichissement && styles.boutonInactif]}
              onPress={rafraichirReferentiels}
              disabled={rafraichissement}
            >
              <Feather name="refresh-cw" size={16} color={palette.textPrimary} />
              <Text style={styles.boutonSecondaireTexte}>
                {rafraichissement ? 'Mise à jour…' : 'Mettre à jour les listes de référence'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.aide}>
              Délégations, villes, espèces et maladies. Utile après l&apos;ajout d&apos;une
              nouvelle entrée par l&apos;administration.
            </Text>

            {stats && stats.pendingSyncCount > 0 && (
              <TouchableOpacity
                style={styles.boutonSecondaire}
                onPress={() => onNavigate?.('sync')}
              >
                <Feather name="upload-cloud" size={16} color={palette.textPrimary} />
                <Text style={styles.boutonSecondaireTexte}>
                  Aller à l&apos;envoi ({stats.pendingSyncCount} en attente)
                </Text>
              </TouchableOpacity>
            )}
          </View>
        );

      case 'activite':
        return (
          <View style={styles.corps}>
            {activiteEnCours && (
              <View style={styles.centre}>
                <ActivityIndicator color={palette.emeraldPrimary} />
              </View>
            )}

            {!activiteEnCours && activiteErreur && (
              <View style={styles.encadreAlerte}>
                <Feather name="wifi-off" size={15} color={palette.warning} />
                <Text style={styles.encadreAlerteTexte}>{activiteErreur}</Text>
              </View>
            )}

            {!activiteEnCours && activite?.length === 0 && (
              <Text style={styles.paragraphe}>
                Aucune activité enregistrée pour l&apos;instant. Elle se remplira à vos
                prochaines connexions et envois.
              </Text>
            )}

            {!activiteEnCours &&
              activite?.map((entree) => (
                <View style={styles.entree} key={entree.id}>
                  <View style={styles.entreePuce} />
                  <View style={styles.entreeTexte}>
                    <Text style={styles.entreeLibelle}>{entree.libelle}</Text>
                    <Text style={styles.entreeDate}>{formatDate(entree.createdAt)}</Text>
                  </View>
                </View>
              ))}

            <TouchableOpacity style={styles.boutonSecondaire} onPress={() => void chargerActivite()}>
              <Feather name="refresh-cw" size={16} color={palette.textPrimary} />
              <Text style={styles.boutonSecondaireTexte}>Actualiser</Text>
            </TouchableOpacity>
            <Text style={styles.aide}>
              Journal tenu par le serveur : connexions, changements d&apos;identifiant,
              modifications de profil et envois de collectes. Il ne contient aucun code ni
              donnée de producteur.
            </Text>
          </View>
        );
    }
  };

  return (
    <View style={styles.ecran}>
      <Header
        title="Paramètres"
        subtitle="Votre compte, cet appareil et vos préférences"
        userName={profil ? `${profil.prenoms} ${profil.nom}` : undefined}
        userRole={
          profil
            ? `${formatRole(profil.role)}${profil.zoneAffectation ? ` • ${profil.zoneAffectation}` : ''}`
            : undefined
        }
        avatarUri={profil?.avatarUri}
        onNewAction={() => onNavigate?.('collecte')}
        onNotificationPress={onNotificationPress}
        onProfilePress={onProfilePress}
        unreadCount={unreadCount}
      />

      <ScrollView
        style={styles.defilement}
        contentContainerStyle={[styles.contenu, { paddingHorizontal }, contentStyle]}
        showsVerticalScrollIndicator={false}
      >
        {RUBRIQUES.map((r) => {
          const estOuverte = ouverte === r.cle;
          return (
            <View key={r.cle} style={[styles.carte, estOuverte && styles.carteOuverte]}>
              <TouchableOpacity
                style={styles.entete}
                onPress={() => basculer(r.cle)}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                <View style={styles.icone}>
                  <Feather name={r.icone} size={17} color={palette.emeraldPrimary} />
                </View>
                <View style={styles.enteteTexte}>
                  <Text style={styles.titre}>{r.titre}</Text>
                  <Text style={styles.resume}>{r.resume}</Text>
                </View>
                <Feather
                  name={estOuverte ? 'chevron-up' : 'chevron-down'}
                  size={19}
                  color={palette.textMuted}
                />
              </TouchableOpacity>

              {estOuverte && contenu(r.cle)}
            </View>
          );
        })}

        <TouchableOpacity style={styles.deconnexion} onPress={() => onLogout?.()}>
          <Feather name="log-out" size={17} color={palette.error} />
          <Text style={styles.deconnexionTexte}>Se déconnecter</Text>
        </TouchableOpacity>
        <Text style={styles.aideCentre}>
          Vos collectes non envoyées restent sur l&apos;appareil après déconnexion.
        </Text>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
};

const createStyles = (palette: Palette, { scale }: Responsive) =>
  StyleSheet.create({
    ecran: {
      flex: 1,
      backgroundColor: palette.backgroundLight,
    },
    defilement: {
      flex: 1,
    },
    contenu: {
      paddingTop: scale(4),
      gap: scale(10),
    },

    // --- Carte de rubrique ---
    carte: {
      backgroundColor: palette.backgroundCard,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.borderLight,
      overflow: 'hidden',
    },
    carteOuverte: {
      borderColor: palette.mintSoft,
    },
    entete: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scale(11),
      padding: scale(14),
    },
    icone: {
      width: scale(34),
      height: scale(34),
      borderRadius: scale(17),
      backgroundColor: palette.mintBadge,
      alignItems: 'center',
      justifyContent: 'center',
    },
    enteteTexte: {
      flex: 1,
      minWidth: 0,
    },
    titre: {
      fontSize: scale(14),
      lineHeight: scale(19),
      fontWeight: '800',
      color: palette.textPrimary,
    },
    resume: {
      fontSize: scale(11.5),
      lineHeight: scale(16),
      color: palette.textSecondary,
    },
    corps: {
      paddingHorizontal: scale(14),
      paddingBottom: scale(16),
      gap: scale(11),
      borderTopWidth: 1,
      borderTopColor: palette.borderLight,
      paddingTop: scale(14),
    },

    // --- Champs de formulaire ---
    champ: {
      gap: 4,
    },
    label: {
      fontSize: scale(11.5),
      fontWeight: '700',
      color: palette.textSecondary,
    },
    input: {
      backgroundColor: palette.backgroundLight,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.borderLight,
      paddingHorizontal: scale(13),
      paddingVertical: scale(10),
      fontSize: scale(13.5),
      color: palette.textPrimary,
    },
    aide: {
      fontSize: scale(11),
      lineHeight: scale(16),
      color: palette.textMuted,
    },
    aideCentre: {
      fontSize: scale(11),
      lineHeight: scale(16),
      color: palette.textMuted,
      textAlign: 'center',
    },
    paragraphe: {
      fontSize: scale(12.5),
      lineHeight: scale(18),
      color: palette.textSecondary,
    },

    // --- Avatar ---
    avatarBloc: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scale(13),
      marginBottom: scale(4),
    },
    avatar: {
      width: scale(62),
      height: scale(62),
      borderRadius: scale(31),
      borderWidth: 2,
      borderColor: palette.emeraldPrimary,
    },
    avatarBouton: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: scale(24),
      height: scale(24),
      borderRadius: scale(12),
      backgroundColor: palette.pillBlack,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: palette.backgroundCard,
    },
    avatarTexte: {
      flex: 1,
      minWidth: 0,
    },
    avatarNom: {
      fontSize: scale(15),
      lineHeight: scale(21),
      fontWeight: '800',
      color: palette.textPrimary,
    },
    avatarRole: {
      fontSize: scale(11.5),
      color: palette.textSecondary,
    },

    // --- Boutons ---
    boutonPrincipal: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: scale(13),
      borderRadius: 14,
      backgroundColor: palette.emeraldPrimary,
    },
    boutonPrincipalTexte: {
      fontSize: scale(13.5),
      fontWeight: '800',
      color: palette.textLight,
      flexShrink: 1,
    },
    boutonSecondaire: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: scale(12),
      paddingHorizontal: scale(10),
      borderRadius: 14,
      backgroundColor: palette.backgroundLight,
      borderWidth: 1,
      borderColor: palette.borderLight,
    },
    boutonSecondaireTexte: {
      fontSize: scale(12.5),
      fontWeight: '700',
      color: palette.textPrimary,
      flexShrink: 1,
    },
    boutonInactif: {
      opacity: 0.6,
    },

    // --- Lignes d'information ---
    ligneInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: scale(10),
      paddingVertical: scale(7),
      borderBottomWidth: 1,
      borderBottomColor: palette.borderLight,
    },
    ligneInfoLabel: {
      flex: 1,
      minWidth: 0,
      fontSize: scale(12.5),
      lineHeight: scale(18),
      color: palette.textSecondary,
    },
    ligneInfoValeur: {
      fontSize: scale(13),
      fontWeight: '800',
      color: palette.textPrimary,
    },
    ligneInterrupteur: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scale(10),
    },
    ligneInterrupteurTexte: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },

    // --- Choix de thème ---
    choix: {
      flexDirection: 'row',
      gap: scale(8),
    },
    choixItem: {
      flexGrow: 1,
      flexBasis: '30%',
      minWidth: 0,
      paddingVertical: scale(11),
      paddingHorizontal: scale(9),
      borderRadius: 13,
      borderWidth: 1.5,
      borderColor: palette.borderLight,
      backgroundColor: palette.backgroundLight,
      gap: 2,
    },
    choixItemActif: {
      borderColor: palette.emeraldPrimary,
      backgroundColor: palette.mintBadge,
    },
    choixLibelle: {
      fontSize: scale(13),
      fontWeight: '800',
      color: palette.textPrimary,
    },
    choixLibelleActif: {
      color: palette.emeraldPrimary,
    },
    choixAide: {
      fontSize: scale(10.5),
      lineHeight: scale(14),
      color: palette.textMuted,
    },
    choixAideActif: {
      color: palette.textSecondary,
    },

    // --- Activité ---
    centre: {
      alignItems: 'center',
      paddingVertical: scale(14),
    },
    entree: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: scale(10),
      paddingVertical: scale(6),
    },
    entreePuce: {
      width: 7,
      height: 7,
      borderRadius: 4,
      marginTop: scale(6),
      backgroundColor: palette.emeraldPrimary,
    },
    entreeTexte: {
      flex: 1,
      minWidth: 0,
    },
    entreeLibelle: {
      fontSize: scale(12.5),
      lineHeight: scale(18),
      fontWeight: '700',
      color: palette.textPrimary,
    },
    entreeDate: {
      fontSize: scale(11),
      color: palette.textMuted,
    },
    encadreAlerte: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: palette.warningBg,
      borderWidth: 1,
      borderColor: palette.warningBorder,
      borderRadius: 12,
      padding: scale(12),
    },
    encadreAlerteTexte: {
      flex: 1,
      minWidth: 0,
      fontSize: scale(11.5),
      lineHeight: scale(17),
      color: palette.textSecondary,
    },

    // --- Déconnexion ---
    deconnexion: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: scale(6),
      paddingVertical: scale(14),
      borderRadius: 16,
      backgroundColor: palette.errorBg,
    },
    deconnexionTexte: {
      fontSize: scale(13.5),
      fontWeight: '800',
      color: palette.error,
    },
  });
