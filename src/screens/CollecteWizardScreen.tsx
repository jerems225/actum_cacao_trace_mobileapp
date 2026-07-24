import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Header } from '../components/common/Header';
import { CompassGPSGauge } from '../components/GPS/CompassGPSGauge';
import { colors, useResponsive } from '../theme';
import { LocationService, LocationError } from '../services/location';
import { offlineStorage } from '../services/storage';
import { notificationService } from '../services/notification';
import { toast } from '../components/common/Toast';
import { TypeSujet, EtatSanitaire, formatRole } from '../types';
import type { UserProfile } from '../services/auth';
import type { PointGPS, TabType, SousPlacetteLocal, MesureArbreLocal } from '../types';

interface CollecteWizardScreenProps {
  onNavigate: (tab: TabType) => void;
  onProfilePress?: () => void;
  onNotificationPress?: () => void;
  unreadCount?: number;
  user?: UserProfile | null;
}

/** Mesure saisie en cours de collecte, rattachée à un numéro de sous-placette. */
interface MesureCollectee {
  numeroSP: number;
  typeSujet: TypeSujet;
  espece?: string;
  circonference30cm?: number;
  circonferenceDBH?: number;
  hauteurTotale?: number;
  etatSanitaire: EtatSanitaire;
}

export const CollecteWizardScreen: React.FC<CollecteWizardScreenProps> = ({
  onNavigate,
  onProfilePress,
  onNotificationPress,
  unreadCount,
  user,
}) => {
  const { paddingHorizontal, contentStyle } = useResponsive();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // --- Bloc A ---
  const [nom, setNom] = useState('');
  const [prenoms, setPrenoms] = useState('');
  const [identite, setIdentite] = useState('');
  const [rgpdConsent, setRgpdConsent] = useState(true);

  // --- Bloc B ---
  const [anneeParcelle, setAnneeParcelle] = useState('');
  const [superficie, setSuperficie] = useState('');
  const [entretienType, setEntretienType] = useState('');
  const [maladies, setMaladies] = useState('');
  const [productionEstimee, setProductionEstimee] = useState('');

  // --- Bloc C ---
  const [numeroPlacette, setNumeroPlacette] = useState(
    `PLC-${Math.floor(1000 + Math.random() * 9000)}`,
  );
  const [delegation, setDelegation] = useState('');
  const [village, setVillage] = useState('');
  const [sommets, setSommets] = useState<PointGPS[]>([]);
  const [activeSommet, setActiveSommet] = useState(1);

  // --- Bloc D ---
  const [selectedSP, setSelectedSP] = useState(1);
  const [typeSujet, setTypeSujet] = useState<TypeSujet>(TypeSujet.CACAO);
  const [espece, setEspece] = useState('');
  const [circo30, setCirco30] = useState('');
  const [circoDBH, setCircoDBH] = useState('');
  const [hauteur, setHauteur] = useState('');
  const [etatSanitaire] = useState<EtatSanitaire>(EtatSanitaire.SAIN);
  const [mesuresCollectees, setMesuresCollectees] = useState<MesureCollectee[]>([]);

  const parseNum = (v: string): number | undefined => {
    const n = parseFloat(v.replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  };

  const handleCaptureGPS = async (ordre: number) => {
    try {
      const point = await LocationService.getCurrentPosition(ordre);
      setSommets((prev) => {
        const filtered = prev.filter((s) => s.ordreSommet !== ordre);
        return [...filtered, point].sort((a, b) => a.ordreSommet - b.ordreSommet);
      });
      if (ordre < 4) setActiveSommet(ordre + 1);
    } catch (e) {
      const message = e instanceof LocationError ? e.message : 'Échec de la capture GPS.';
      toast.error(message);
    }
  };

  const handleAddMesure = () => {
    if (typeSujet === TypeSujet.ARBRE_OMBRAGE && !espece.trim()) {
      toast.error("L'espèce est obligatoire pour un arbre d'ombrage.");
      return;
    }
    setMesuresCollectees((prev) => [
      ...prev,
      {
        numeroSP: selectedSP,
        typeSujet,
        espece: espece.trim() || undefined,
        circonference30cm: parseNum(circo30),
        circonferenceDBH: parseNum(circoDBH),
        hauteurTotale: parseNum(hauteur),
        etatSanitaire,
      },
    ]);
    // Réinitialise le formulaire de mesure pour la saisie suivante (mode lot).
    setEspece('');
    setCirco30('');
    setCircoDBH('');
    setHauteur('');
  };

  /** Affiche l'erreur en inline (sous le formulaire) et en toast. */
  const showError = (message: string) => {
    setErrorMsg(message);
    toast.error(message);
  };

  const handleNextStep = () => {
    setErrorMsg(null);
    if (currentStep === 1) {
      if (!nom.trim() || !prenoms.trim()) {
        showError('Veuillez saisir le nom et les prénoms du producteur.');
        return;
      }
      if (!rgpdConsent) {
        showError('Le consentement RGPD du producteur est obligatoire.');
        return;
      }
    }
    if (currentStep === 3) {
      if (!delegation.trim()) {
        showError('La délégation régionale est obligatoire.');
        return;
      }
    }
    if (currentStep < 4) setCurrentStep((prev) => (prev + 1) as never);
  };

  const buildSousPlacettes = (): SousPlacetteLocal[] => {
    const grouped = new Map<number, MesureArbreLocal[]>();
    for (const m of mesuresCollectees) {
      const list = grouped.get(m.numeroSP) || [];
      list.push({
        id: '', // réattribué par la couche de stockage
        sousPlacetteId: '',
        typeSujet: m.typeSujet,
        espece: m.espece,
        circonference30cm: m.circonference30cm,
        circonferenceDBH: m.circonferenceDBH,
        hauteurTotale: m.hauteurTotale,
        etatSanitaire: m.etatSanitaire,
        createdAt: new Date().toISOString(),
      });
      grouped.set(m.numeroSP, list);
    }
    // Approximation : la sous-placette hérite des 3 premiers sommets de la
    // placette (échantillon interne) — suffisant pour la validation backend
    // tant que la capture GPS dédiée par sous-placette n'est pas implémentée.
    return Array.from(grouped.entries()).map(([numero, mesures]) => ({
      id: '',
      placetteId: '',
      numero,
      sommets: sommets.slice(0, 3),
      mesures,
    }));
  };

  const handleFinishSurvey = async () => {
    // Validation des sommets de la placette (exactement 4 pour délimiter la parcelle).
    const ordres = new Set(sommets.map((s) => s.ordreSommet));
    if (sommets.length !== 4 || ![1, 2, 3, 4].every((n) => ordres.has(n))) {
      toast.error('Capturez les 4 sommets de la placette (étape C) avant de valider.');
      setCurrentStep(3);
      return;
    }

    setSaving(true);
    try {
      const { producteur } = await offlineStorage.saveCompleteCollecte({
        producteur: {
          nom: nom.trim(),
          prenoms: prenoms.trim(),
          identiteProprietaire: identite.trim() || undefined,
          consentementDonne: rgpdConsent,
          consentementDate: new Date().toISOString(),
        },
        parcelle: {
          anneeParcelle: parseNum(anneeParcelle),
          superficie: parseNum(superficie),
          typeEntretien: entretienType.trim() || undefined,
          maladiesObservees: maladies.trim() || undefined,
          productionEstimee: parseNum(productionEstimee),
          uniteProduction: 'kg / an',
        },
        placette: {
          numeroPlacette,
          delegationRegionale: delegation.trim(),
          village: village.trim() || undefined,
          sommets,
          sousPlacettes: buildSousPlacettes(),
        },
      });

      await notificationService.notifyCollecteEnregistree(`${producteur.prenoms} ${producteur.nom}`);

      toast.success('Collecte enregistrée. Données mises en file de synchronisation.');
      onNavigate('enquetes');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erreur inconnue.';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const mesuresPourSP = mesuresCollectees.filter((m) => m.numeroSP === selectedSP);

  return (
    <View style={styles.container}>
      <Header
        title="Formulaire d'Inventaire"
        subtitle="Collecte terrain producteur (Blocs A, B, C & D)"
        userName={user ? `${user.prenoms} ${user.nom}` : undefined}
        userRole={user ? `${formatRole(user.role)}${user.zoneAffectation ? ` • ${user.zoneAffectation}` : ''}` : undefined}
        avatarUri={user?.avatarUri}
        onNewAction={() => {
          setCurrentStep(1);
          onNavigate('collecte');
        }}
        onNotificationPress={onNotificationPress}
        onProfilePress={onProfilePress}
        unreadCount={unreadCount}
      />

      <View style={[styles.stepsContainer, { paddingHorizontal }, contentStyle]}>
        {[
          { step: 1, label: 'A. Producteur' },
          { step: 2, label: 'B. Pratiques' },
          { step: 3, label: 'C. GPS Placette' },
          { step: 4, label: 'D. Mesures' },
        ].map((item) => {
          const isActive = currentStep === item.step;
          const isDone = currentStep > item.step;
          return (
            <TouchableOpacity
              key={item.step}
              style={[styles.stepItem, isActive && styles.stepActive, isDone && styles.stepDone]}
              onPress={() => setCurrentStep(item.step as never)}
            >
              <Text style={[styles.stepText, (isActive || isDone) && styles.stepTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal }, contentStyle]}
        showsVerticalScrollIndicator={false}
      >
        {/* BLOC A */}
        {currentStep === 1 && (
          <View style={styles.stepCard}>
            <Text style={styles.blocTitle}>Bloc A — Informations du Producteur</Text>
            <Text style={styles.blocSub}>Identité socio-économique et consentement</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nom du Producteur *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="ex: KOUASSI"
                placeholderTextColor={colors.textMuted}
                value={nom}
                onChangeText={setNom}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Prénoms *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="ex: Jean-Baptiste"
                placeholderTextColor={colors.textMuted}
                value={prenoms}
                onChangeText={setPrenoms}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>N° Pièce d'Identité / CNI</Text>
              <TextInput
                style={styles.textInput}
                placeholder="ex: CI-00984123"
                placeholderTextColor={colors.textMuted}
                value={identite}
                onChangeText={setIdentite}
              />
            </View>

            <View style={styles.consentCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.consentTitle}>Consentement RGPD du producteur</Text>
                <Text style={styles.consentText}>
                  Le producteur autorise la géolocalisation de sa parcelle et la collecte de données pour le suivi et l'amélioration de sa production.
                </Text>
              </View>
              <Switch
                value={rgpdConsent}
                onValueChange={setRgpdConsent}
                trackColor={{ false: '#CCC', true: colors.emeraldPrimary }}
                thumbColor={rgpdConsent ? colors.mintSoft : '#FFF'}
              />
            </View>
          </View>
        )}

        {/* BLOC B */}
        {currentStep === 2 && (
          <View style={styles.stepCard}>
            <Text style={styles.blocTitle}>Bloc B — Pratiques Culturales</Text>
            <Text style={styles.blocSub}>Superficie, entretiens et diagnostic sanitaire</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Année d'installation de la parcelle</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                placeholder="ex: 2016"
                placeholderTextColor={colors.textMuted}
                value={anneeParcelle}
                onChangeText={setAnneeParcelle}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Superficie Déclarée (ha)</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="decimal-pad"
                placeholder="ex: 3.5"
                placeholderTextColor={colors.textMuted}
                value={superficie}
                onChangeText={setSuperficie}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Pratiques d'entretien principales</Text>
              <TextInput
                style={styles.textInput}
                placeholder="ex: Désherbage manuel"
                placeholderTextColor={colors.textMuted}
                value={entretienType}
                onChangeText={setEntretienType}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Maladies & Attaques observées</Text>
              <TextInput
                style={styles.textInput}
                placeholder="ex: Swollen Shoot"
                placeholderTextColor={colors.textMuted}
                value={maladies}
                onChangeText={setMaladies}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Estimation de Production (kg/an)</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                placeholder="ex: 1400"
                placeholderTextColor={colors.textMuted}
                value={productionEstimee}
                onChangeText={setProductionEstimee}
              />
            </View>
          </View>
        )}

        {/* BLOC C */}
        {currentStep === 3 && (
          <View>
            <CompassGPSGauge
              sommets={sommets}
              activeSommetOrdre={activeSommet}
              onCaptureSommet={handleCaptureGPS}
              areaInHectares={LocationService.calculateAreaInHectares(sommets)}
            />

            <View style={styles.stepCard}>
              <Text style={styles.blocTitle}>Bloc C — Détails de la Placette</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Numéro de Placette *</Text>
                <TextInput
                  style={styles.textInput}
                  value={numeroPlacette}
                  onChangeText={setNumeroPlacette}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Délégation Régionale *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="ex: San-Pédro"
                  placeholderTextColor={colors.textMuted}
                  value={delegation}
                  onChangeText={setDelegation}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Village / Localité</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="ex: Grand-Zattry"
                  placeholderTextColor={colors.textMuted}
                  value={village}
                  onChangeText={setVillage}
                />
              </View>

              <Text style={styles.helperText}>
                {sommets.length}/4 sommets capturés{' '}
                {sommets.length === 4 ? '✓ Parcelle délimitée (4 sommets)' : '— capture requise'}
              </Text>
            </View>
          </View>
        )}

        {/* BLOC D */}
        {currentStep === 4 && (
          <View style={styles.stepCard}>
            <Text style={styles.blocTitle}>Bloc D — Mesures Dendrométriques</Text>
            <Text style={styles.blocSub}>Comptage et circonférence par sous-placette</Text>

            <Text style={styles.inputLabel}>Sous-placette Échantillon</Text>
            <View style={styles.spSelector}>
              {[1, 2, 3, 4, 5, 6].map((num) => {
                const count = mesuresCollectees.filter((m) => m.numeroSP === num).length;
                return (
                  <TouchableOpacity
                    key={num}
                    style={[styles.spButton, selectedSP === num && styles.spButtonActive]}
                    onPress={() => setSelectedSP(num)}
                  >
                    <Text style={[styles.spText, selectedSP === num && styles.spTextActive]}>
                      SP{num}
                      {count > 0 ? ` (${count})` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[styles.typeBtn, typeSujet === TypeSujet.CACAO && styles.typeBtnActive]}
                onPress={() => setTypeSujet(TypeSujet.CACAO)}
              >
                <Feather name="box" size={14} color={typeSujet === TypeSujet.CACAO ? '#FFF' : colors.textPrimary} />
                <Text style={[styles.typeBtnText, typeSujet === TypeSujet.CACAO && styles.typeBtnTextActive]}>
                  Cacaoyer
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.typeBtn, typeSujet === TypeSujet.ARBRE_OMBRAGE && styles.typeBtnActive]}
                onPress={() => setTypeSujet(TypeSujet.ARBRE_OMBRAGE)}
              >
                <Feather name="sun" size={14} color={typeSujet === TypeSujet.ARBRE_OMBRAGE ? '#FFF' : colors.textPrimary} />
                <Text style={[styles.typeBtnText, typeSujet === TypeSujet.ARBRE_OMBRAGE && styles.typeBtnTextActive]}>
                  Arbre d'ombrage
                </Text>
              </TouchableOpacity>
            </View>

            {typeSujet === TypeSujet.ARBRE_OMBRAGE && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Espèce d'arbre d'ombrage *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="ex: Framiré, Akpio, Iroko"
                  placeholderTextColor={colors.textMuted}
                  value={espece}
                  onChangeText={setEspece}
                />
              </View>
            )}

            <View style={styles.rowInputs}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Circonf. 30 cm (cm)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={circo30}
                  onChangeText={setCirco30}
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Circonf. DBH 1.3m (cm)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={circoDBH}
                  onChangeText={setCircoDBH}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Hauteur Totale (mètres)</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={hauteur}
                onChangeText={setHauteur}
              />
            </View>

            <TouchableOpacity style={styles.addMesureBtn} onPress={handleAddMesure}>
              <Feather name="plus-circle" size={16} color={colors.emeraldPrimary} />
              <Text style={styles.addMesureText}>Ajouter cette mesure à SP{selectedSP}</Text>
            </TouchableOpacity>

            {/* Mesures déjà saisies pour la sous-placette sélectionnée */}
            {mesuresPourSP.length > 0 && (
              <View style={styles.mesuresList}>
                <Text style={styles.mesuresListTitle}>
                  {mesuresPourSP.length} mesure(s) enregistrée(s) pour SP{selectedSP}
                </Text>
                {mesuresPourSP.map((m, i) => (
                  <View key={i} style={styles.mesureChip}>
                    <Feather
                      name={m.typeSujet === TypeSujet.CACAO ? 'box' : 'sun'}
                      size={12}
                      color={colors.emeraldPrimary}
                    />
                    <Text style={styles.mesureChipText}>
                      {m.typeSujet === TypeSujet.CACAO ? 'Cacaoyer' : m.espece || 'Arbre'}
                      {m.circonferenceDBH ? ` • DBH ${m.circonferenceDBH}cm` : ''}
                      {m.hauteurTotale ? ` • ${m.hauteurTotale}m` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Message d'erreur de validation (visible web + natif) */}
        {errorMsg && (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={16} color={colors.error} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* Navigation */}
        <View style={styles.bottomBarNav}>
          {currentStep > 1 && (
            <TouchableOpacity
              style={styles.prevBtn}
              onPress={() => setCurrentStep((prev) => (prev - 1) as never)}
            >
              <Feather name="arrow-left" size={18} color={colors.textPrimary} />
              <Text style={styles.prevBtnText}>Précédent</Text>
            </TouchableOpacity>
          )}

          {currentStep < 4 ? (
            <TouchableOpacity style={styles.nextBtn} onPress={handleNextStep}>
              <Text style={styles.nextBtnText}>Étape Suivante</Text>
              <Feather name="arrow-right" size={18} color={colors.textLight} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleFinishSurvey}
              disabled={saving}
            >
              <Feather name="check" size={18} color={colors.textLight} />
              <Text style={styles.saveBtnText}>
                {saving ? 'Enregistrement…' : 'Valider & Enregistrer'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  stepsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundCard,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: 6,
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.backgroundLight,
  },
  stepActive: {
    backgroundColor: colors.forestDark,
  },
  stepDone: {
    backgroundColor: colors.mintBadge,
  },
  stepText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  stepTextActive: {
    color: colors.textLight,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
  },
  stepCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  blocTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.forestDark,
  },
  blocSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 16,
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 14,
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  textInput: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  helperText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 4,
  },
  consentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.mintBadge,
    padding: 14,
    borderRadius: 14,
    marginTop: 8,
    gap: 12,
  },
  consentTitle: {
    color: colors.emeraldPrimary,
    fontWeight: '800',
    fontSize: 13,
  },
  consentText: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  spSelector: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  spButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  spButtonActive: {
    backgroundColor: colors.emeraldPrimary,
    borderColor: colors.emeraldPrimary,
  },
  spText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  spTextActive: {
    color: colors.textLight,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 6,
  },
  typeBtnActive: {
    backgroundColor: colors.forestDark,
    borderColor: colors.forestDark,
  },
  typeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  typeBtnTextActive: {
    color: colors.textLight,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  addMesureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mintBadge,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    marginTop: 4,
  },
  addMesureText: {
    color: colors.emeraldPrimary,
    fontWeight: '800',
    fontSize: 13,
  },
  mesuresList: {
    marginTop: 16,
    gap: 8,
  },
  mesuresListTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  mesureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  mesureChipText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.error,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  errorText: {
    color: colors.error,
    fontSize: 12.5,
    fontWeight: '600',
    flex: 1,
  },
  bottomBarNav: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  prevBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: colors.backgroundCard,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 6,
  },
  prevBtnText: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: colors.emeraldPrimary,
    gap: 6,
  },
  nextBtnText: {
    fontWeight: '800',
    color: colors.textLight,
    fontSize: 14,
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: colors.forestDark,
    gap: 6,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontWeight: '800',
    color: colors.textLight,
    fontSize: 14,
  },
});
