import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, useResponsive } from '../theme';
import { authService, UserProfile } from '../services/auth';
import { OtpInput } from '../components/common/OtpInput';

interface LoginScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
}

/** Format attendu pour le code agent (généré à la création : CT + 4 chiffres). */
const CODE_AGENT_REGEX = /^CT-\d{4}$/;
const OTP_LENGTH = 4;

type Step = 'identifiant' | 'code';
type CodeMode = 'saisie' | 'creation';

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const { paddingHorizontal } = useResponsive();
  const [step, setStep] = useState<Step>('identifiant');
  const [mode, setMode] = useState<CodeMode>('saisie');
  const [codeAgent, setCodeAgent] = useState('');
  const [otp, setOtp] = useState('');
  const [nouveauOtp, setNouveauOtp] = useState('');
  const [confirmOtp, setConfirmOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto-format : l'agent ne saisit que les chiffres, le préfixe "CT-" est
  // ajouté automatiquement (accepte aussi "CT-1234", "ct 1234", "1234"...).
  const onChangeCodeAgent = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    setCodeAgent(digits ? `CT-${digits}` : '');
  };

  // Messages inline uniquement (pas de toast sur l'écran de connexion).
  const fail = (msg: string) => setErrorMsg(msg);

  // --- Étape 1 : identifiant → on vérifie l'existence du code agent ---
  // Existe sans code secret ⇒ « paramétrer » ; existe avec code ⇒ « vérifier ».
  const goToCodeStep = async () => {
    setErrorMsg(null);
    if (!CODE_AGENT_REGEX.test(codeAgent.trim())) {
      fail('Entrez les 4 chiffres de votre code.');
      return;
    }

    setLoading(true);
    const check = await authService.checkAgentCode(codeAgent.trim());
    setLoading(false);

    if (check.status === 'introuvable') {
      fail('Ce code agent est introuvable. Vérifiez-le auprès de votre administrateur.');
      return;
    }
    if (check.status === 'desactive') {
      fail('Ce compte est désactivé. Contactez votre administrateur.');
      return;
    }
    // Serveur injoignable : on n'avance que si une session en cache existe pour
    // ce code agent (reconnexion hors-ligne vérifiée ensuite par empreinte).
    if (check.status === 'hors-ligne') {
      const saved = await authService.getCurrentUser();
      const cached = saved?.token && saved.codeAgent === codeAgent.trim();
      if (!cached) {
        fail('Serveur injoignable. Vérifiez votre connexion et réessayez.');
        return;
      }
    }

    setMode(check.status === 'creation' ? 'creation' : 'saisie');
    setOtp('');
    setNouveauOtp('');
    setConfirmOtp('');
    setStep('code');
  };

  // --- Étape 2a : saisie du code secret existant ---
  const submitCode = async (value: string) => {
    if (loading) return;
    setErrorMsg(null);
    setLoading(true);
    const res = await authService.agentLogin(codeAgent.trim(), value);
    setLoading(false);

    if (res.success && res.user) {
      onLoginSuccess(res.user);
      return;
    }
    if (res.doitDefinirCodeSecurite) {
      // 1re connexion : on réutilise le code saisi et on demande confirmation.
      setMode('creation');
      setNouveauOtp(value);
      setConfirmOtp('');
      setErrorMsg(null);
      return;
    }
    setOtp('');
    fail(res.message || 'Code agent ou code de sécurité incorrect.');
  };

  // --- Étape 2b : création du code secret (1re connexion) ---
  const submitCreation = async () => {
    setErrorMsg(null);
    if (nouveauOtp.length < OTP_LENGTH) {
      fail(`Le code doit contenir ${OTP_LENGTH} chiffres.`);
      return;
    }
    if (nouveauOtp !== confirmOtp) {
      fail('Les deux codes ne correspondent pas.');
      return;
    }
    setLoading(true);
    const res = await authService.agentLogin(codeAgent.trim(), undefined, nouveauOtp);
    setLoading(false);

    if (res.success && res.user) {
      onLoginSuccess(res.user);
      return;
    }
    setConfirmOtp('');
    fail(res.message || 'Impossible de créer le code de sécurité. Réessayez.');
  };

  const backToIdentifiant = () => {
    setStep('identifiant');
    setMode('saisie');
    setOtp('');
    setNouveauOtp('');
    setConfirmOtp('');
    setErrorMsg(null);
  };

  const renderError = () =>
    errorMsg ? (
      <View style={styles.errorBox}>
        <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
        <Text style={styles.errorBoxText}>{errorMsg}</Text>
      </View>
    ) : null;

  return (
    <View style={styles.container}>
      {/* Fond bas : plantation de cacao, fondu vers le fond de page */}
      <Image
        source={require('../../assets/images/cocoa_farm_hero.jpg')}
        style={styles.bgImage}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['#F5F7F6', 'rgba(245,247,246,0.82)', 'rgba(245,247,246,0)']}
        locations={[0, 0.4, 1]}
        style={styles.bgFade}
        pointerEvents="none"
      />

      <View style={[styles.content, { paddingHorizontal }]}>
        <View style={styles.formWrap}>
          <View style={styles.topLogoSection}>
            <Image
              source={require('../../assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.appTitle}>ActumCollect</Text>
            <Text style={styles.appSub}>Espace agent terrain • Connexion par code</Text>
          </View>

          {/* Fil d'étapes */}
          <View style={styles.steps}>
            <View style={[styles.stepDot, styles.stepDotActive]} />
            <View style={styles.stepLine} />
            <View style={[styles.stepDot, step === 'code' && styles.stepDotActive]} />
          </View>

          {step === 'identifiant' ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Votre code agent</Text>
              <Text style={styles.cardSub}>
                Saisissez le code agent remis par votre administrateur.
              </Text>

              {renderError()}

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Code agent</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="keypad-outline" size={16} color={colors.textSecondary} />
                  <TextInput
                    style={styles.textInput}
                    keyboardType="number-pad"
                    autoFocus
                    placeholder="CT-1234"
                    placeholderTextColor={colors.textMuted}
                    value={codeAgent}
                    onChangeText={onChangeCodeAgent}
                    onSubmitEditing={goToCodeStep}
                    returnKeyType="next"
                  />
                </View>
                <Text style={styles.hint}>Tapez les 4 chiffres, le « CT- » est ajouté automatiquement.</Text>
              </View>

              <TouchableOpacity
                style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
                onPress={goToCodeStep}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Text style={styles.loginBtnText}>Continuer</Text>
                    <Ionicons name="arrow-forward-outline" size={18} color="#FFF" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {mode === 'saisie' ? 'Code de sécurité' : 'Première connexion'}
              </Text>
              <Text style={styles.cardSub}>
                {mode === 'saisie'
                  ? `Saisissez votre code à ${OTP_LENGTH} chiffres.`
                  : `Créez votre code à ${OTP_LENGTH} chiffres, puis confirmez-le.`}
              </Text>

              {renderError()}

              {mode === 'saisie' ? (
                <View style={styles.otpGroup}>
                  <OtpInput
                    value={otp}
                    onChange={setOtp}
                    length={OTP_LENGTH}
                    autoFocus
                    editable={!loading}
                    onComplete={submitCode}
                  />
                  {loading && (
                    <ActivityIndicator style={styles.otpSpinner} color={colors.emeraldPrimary} />
                  )}
                </View>
              ) : (
                <>
                  <View style={styles.otpGroup}>
                    <Text style={styles.otpLabel}>Nouveau code</Text>
                    <OtpInput
                      value={nouveauOtp}
                      onChange={setNouveauOtp}
                      length={OTP_LENGTH}
                      // Le curseur ne se pose ici que si le champ est vide. Le code
                      // arrive souvent déjà rempli, reporté de l'écran précédent :
                      // y ramener le focus ferait taper la confirmation par-dessus.
                      autoFocus={nouveauOtp.length === 0}
                      editable={!loading}
                    />
                  </View>
                  <View style={styles.otpGroup}>
                    <Text style={styles.otpLabel}>Confirmer le code</Text>
                    <OtpInput
                      value={confirmOtp}
                      onChange={setConfirmOtp}
                      length={OTP_LENGTH}
                      // Le code du dessus est complet : c'est ici qu'on attend
                      // l'agent, et c'est donc ici que le curseur se pose.
                      autoFocus={nouveauOtp.length === OTP_LENGTH}
                      editable={!loading}
                      onComplete={() => submitCreation()}
                    />
                  </View>

                  <Text style={styles.otpAide}>
                    Le code du haut est celui que vous venez de choisir. Retapez-le en dessous pour
                    le confirmer.
                  </Text>

                  <TouchableOpacity
                    style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
                    onPress={submitCreation}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <>
                        <Text style={styles.loginBtnText}>Créer et me connecter</Text>
                        <Ionicons name="arrow-forward-outline" size={18} color="#FFF" />
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity style={styles.linkBtn} onPress={backToIdentifiant} disabled={loading}>
                <Ionicons name="arrow-back-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.linkText}>Changer de code agent</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    zIndex: 2,
  },
  bgImage: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '46%',
    width: '100%',
    zIndex: 0,
  },
  bgFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '46%',
    zIndex: 1,
  },
  formWrap: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  topLogoSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 22,
    marginBottom: 12,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  appSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  steps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  stepDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.borderLight,
  },
  stepDotActive: {
    backgroundColor: colors.emeraldPrimary,
  },
  stepLine: {
    width: 28,
    height: 2,
    backgroundColor: colors.borderLight,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  cardSub: {
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 20,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorBoxText: {
    color: '#991B1B',
    fontSize: 12.5,
    fontWeight: '600',
    flex: 1,
  },
  inputGroup: {
    marginBottom: 16,
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  hint: {
    fontSize: 11.5,
    color: colors.textMuted,
    marginTop: 2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  otpGroup: {
    marginBottom: 18,
    gap: 10,
  },
  otpLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  otpAide: {
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 4,
  },
  otpSpinner: {
    marginTop: 4,
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pillBlack,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 10,
    marginTop: 6,
  },
  loginBtnDisabled: {
    opacity: 0.6,
  },
  loginBtnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 15,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
});
