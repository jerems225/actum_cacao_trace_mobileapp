// ============================================================================
// CacaoTrace — Toast multiplateforme (web + natif)
// ----------------------------------------------------------------------------
// Remplace React Native `Alert` (non implémenté sur react-native-web) par un
// retour visuel cohérent partout. API impérative simple (pub/sub) : n'importe
// quel module appelle `toast.success(...)` / `toast.error(...)` ; un unique
// <ToastHost/> monté à la racine affiche le message.
// ============================================================================

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Animated, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, useResponsive } from '../../theme';

export type ToastType = 'success' | 'error' | 'info';

interface ToastPayload {
  id: number;
  message: string;
  type: ToastType;
}

let counter = 0;
let emit: ((p: ToastPayload) => void) | null = null;

export const toast = {
  show(message: string, type: ToastType = 'info') {
    counter += 1;
    emit?.({ id: counter, message, type });
  },
  success(message: string) {
    this.show(message, 'success');
  },
  error(message: string) {
    this.show(message, 'error');
  },
  info(message: string) {
    this.show(message, 'info');
  },
};

const CONFIG: Record<
  ToastType,
  { icon: keyof typeof Feather.glyphMap; color: string; bg: string; border: string }
> = {
  success: { icon: 'check-circle', color: colors.emeraldPrimary, bg: '#ECFDF5', border: colors.emeraldPrimary },
  error: { icon: 'alert-circle', color: colors.error, bg: colors.errorBg, border: colors.error },
  info: { icon: 'info', color: colors.textPrimary, bg: '#FFFFFF', border: colors.borderLight },
};

export const ToastHost: React.FC = () => {
  const { topInset, contentMaxWidth } = useResponsive();
  const [current, setCurrent] = useState<ToastPayload | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
      setCurrent(null),
    );
  }, [opacity]);

  useEffect(() => {
    emit = (p) => {
      if (timer.current) clearTimeout(timer.current);
      setCurrent(p);
    };
    return () => {
      emit = null;
    };
  }, []);

  useEffect(() => {
    if (!current) return;
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    timer.current = setTimeout(hide, 3200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [current, opacity, hide]);

  if (!current) return null;

  const cfg = CONFIG[current.type];

  return (
    <View pointerEvents="box-none" style={[styles.host, { top: topInset + 8 }]}>
      <Animated.View
        style={[
          styles.toast,
          { opacity, maxWidth: contentMaxWidth, backgroundColor: cfg.bg, borderColor: cfg.border },
        ]}
      >
        <Feather name={cfg.icon} size={18} color={cfg.color} />
        <Text style={[styles.text, { color: cfg.color }]} numberOfLines={3}>
          {current.message}
        </Text>
        <TouchableOpacity onPress={hide} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="x" size={16} color={cfg.color} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
});
