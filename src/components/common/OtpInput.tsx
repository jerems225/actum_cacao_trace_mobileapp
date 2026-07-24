import React, { useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from 'react-native';
import { colors } from '../../theme';

interface OtpInputProps {
  /** Valeur courante (chaîne de chiffres, tassée à gauche). */
  value: string;
  onChange: (value: string) => void;
  /** Nombre de cases (défaut : 4). */
  length?: number;
  autoFocus?: boolean;
  /** Appelé quand toutes les cases sont remplies. */
  onComplete?: (value: string) => void;
  /** Masque les chiffres (affiche des points) — pour un code secret sensible. */
  secure?: boolean;
  editable?: boolean;
}

/**
 * Saisie type OTP : une case par chiffre, avance/recul automatique du focus.
 * Sans dépendance externe. La valeur est une chaîne de chiffres tassée à
 * gauche (ex. "12" = les deux premières cases remplies).
 */
export const OtpInput: React.FC<OtpInputProps> = ({
  value,
  onChange,
  length = 4,
  autoFocus = false,
  onComplete,
  secure = false,
  editable = true,
}) => {
  const inputs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => inputs.current[0]?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  const handleChange = (index: number, text: string) => {
    const digits = text.replace(/\D/g, '');
    if (!digits) return; // suppression gérée par onKeyPress (Backspace)

    // Reconstruit la valeur : on conserve le préfixe avant la case éditée,
    // puis on ajoute les chiffres saisis (gère aussi le collage multi-chiffres).
    let next = value.slice(0, index);
    for (const c of digits) {
      if (next.length < length) next += c;
    }
    next = next.slice(0, length);
    onChange(next);

    const focusIdx = Math.min(next.length, length - 1);
    inputs.current[focusIdx]?.focus();
    if (next.length === length) onComplete?.(next);
  };

  const handleKeyPress = (
    _index: number,
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
  ) => {
    if (e.nativeEvent.key !== 'Backspace') return;
    if (value.length === 0) return;
    const next = value.slice(0, value.length - 1);
    onChange(next);
    inputs.current[Math.min(next.length, length - 1)]?.focus();
  };

  return (
    <View style={styles.row}>
      {Array.from({ length }).map((_, i) => {
        const filled = i < value.length;
        const isActive = i === Math.min(value.length, length - 1);
        return (
          <TextInput
            key={i}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            style={[styles.box, isActive && styles.boxActive, filled && styles.boxFilled]}
            keyboardType="number-pad"
            maxLength={length} // autorise le collage
            editable={editable}
            secureTextEntry={secure}
            value={filled ? value[i] : ''}
            onChangeText={(t) => handleChange(i, t)}
            onKeyPress={(e) => handleKeyPress(i, e)}
            textAlign="center"
            returnKeyType="done"
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  box: {
    width: 56,
    height: 64,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    backgroundColor: colors.backgroundLight,
    fontSize: 26,
    fontWeight: '800',
    color: colors.textPrimary,
    padding: 0,
    textAlign: 'center',
    textAlignVertical: 'center', // centrage vertical (Android)
  },
  boxActive: {
    borderColor: colors.emeraldPrimary,
    backgroundColor: '#FFFFFF',
  },
  boxFilled: {
    borderColor: colors.emeraldPrimary,
    backgroundColor: '#FFFFFF',
  },
});
