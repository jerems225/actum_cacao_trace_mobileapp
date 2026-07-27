import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../../theme';
import { authService, avatarAffichable, UserProfile } from '../../services/auth';
import { ApiSyncService } from '../../services/api';
import { formatRole } from '../../types';
import { toast } from './Toast';

interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onProfileUpdated?: (user: UserProfile) => void;
  onLogout?: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  visible,
  onClose,
  onProfileUpdated,
  onLogout,
}) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [nom, setNom] = useState('');
  const [prenoms, setPrenoms] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [zone, setZone] = useState('');
  // Ce qui est AFFICHÉ (lien signé ou photo locale), distinct de la référence
  // durable conservée dans le profil. Voir `avatarAffichable`.
  const [avatarAffiche, setAvatarAffiche] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (visible) {
      loadProfile();
    }
  }, [visible]);

  const loadProfile = async () => {
    const u = await authService.getCurrentUser();
    setUser(u);
    if (u) {
      setNom(u.nom);
      setPrenoms(u.prenoms);
      setEmail(u.email);
      setTelephone(u.telephone || '');
      setZone(u.zoneAffectation || '');
      setAvatarAffiche(avatarAffichable(u));
    }
  };

  const handlePickAvatar = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        toast.error('Accès à la galerie photo nécessaire pour modifier l\'avatar.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedUri = result.assets[0].uri;
        setAvatarAffiche(selectedUri);

        // Mettre à jour la session immédiatement pour un rendu instantané
        let updated = await authService.updateProfile({ avatarUri: selectedUri });
        if (updated && onProfileUpdated) {
          onProfileUpdated(updated);
        }

        // Envoi au backend ➔ on conserve la RÉFÉRENCE renvoyée et on affiche le
        // lien signé. Stocker le lien reviendrait à garder une adresse expirant
        // dans l'heure, et l'avatar redeviendrait invisible tout seul.
        const uploadRes = await ApiSyncService.uploadImageToSupabase(selectedUri, 'avatars');
        if (uploadRes.reference) {
          updated = await authService.updateProfile({ avatarUri: uploadRes.reference });
          if (updated && onProfileUpdated) {
            onProfileUpdated(updated);
          }
        }
        if (uploadRes.url) setAvatarAffiche(uploadRes.url);
      }
    } catch {
      toast.error('Impossible de charger l\'image.');
    }
  };

  const handleSaveProfile = async () => {
    const updated = await authService.updateProfile({
      nom,
      prenoms,
      email,
      telephone,
      zoneAffectation: zone,
      // Pas d'avatar ici : il est enregistré au moment de la sélection, avec sa
      // référence. Le renvoyer depuis l'état d'affichage écraserait cette
      // référence par un lien temporaire.
    });
    if (updated && onProfileUpdated) onProfileUpdated(updated);
    toast.success('Profil mis à jour avec succès.');
    onClose();
  };

  const handleLogoutPress = async () => {
    await authService.logout();
    if (onLogout) onLogout();
    onClose();
  };

  if (!user) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Gestion du profil</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Section Photo de Profil avec Bouton d'édition Camera */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarWrapper}>
                {avatarAffiche ? (
                  <Image source={{ uri: avatarAffiche }} style={styles.avatarImg} />
                ) : (
                  <Image
                    source={require('../../../assets/images/agent_avatar.jpg')}
                    style={styles.avatarImg}
                  />
                )}
                <TouchableOpacity style={styles.cameraBtn} onPress={handlePickAvatar}>
                  <Feather name="camera" size={14} color="#FFF" />
                </TouchableOpacity>
              </View>

              <Text style={styles.userName}>{prenoms} {nom}</Text>
              <View style={styles.roleBadge}>
                <Feather name="shield" size={12} color={colors.emeraldPrimary} />
                <Text style={styles.roleText}>{formatRole(user.role)}</Text>
              </View>
            </View>

            {/* Champs du Formulaire de Profil */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Nom</Text>
              <TextInput
                style={styles.input}
                value={nom}
                onChangeText={setNom}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Prénoms</Text>
              <TextInput
                style={styles.input}
                value={prenoms}
                onChangeText={setPrenoms}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Email Professionnel</Text>
              <TextInput
                style={styles.input}
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Numéro de Téléphone</Text>
              <TextInput
                style={styles.input}
                keyboardType="phone-pad"
                value={telephone}
                onChangeText={setTelephone}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Zone d'affectation</Text>
              <TextInput
                style={styles.input}
                value={zone}
                onChangeText={setZone}
              />
            </View>

            {/* Boutons d'Action */}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile}>
              <Feather name="check" size={18} color="#FFF" />
              <Text style={styles.saveBtnText}>Enregistrer le Profil</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogoutPress}>
              <Feather name="log-out" size={18} color={colors.error} />
              <Text style={styles.logoutBtnText}>Se Déconnecter</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  scrollContent: {
    marginBottom: 10,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 10,
  },
  avatarImg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: colors.emeraldPrimary,
  },
  cameraBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.pillBlack,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  userName: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.mintBadge,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
    marginTop: 4,
  },
  roleText: {
    color: colors.emeraldPrimary,
    fontSize: 11,
    fontWeight: '800',
  },
  formGroup: {
    marginBottom: 14,
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  input: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.emeraldPrimary,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  saveBtnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 14,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.errorBg,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    marginBottom: 20,
  },
  logoutBtnText: {
    color: colors.error,
    fontWeight: '800',
    fontSize: 14,
  },
});
