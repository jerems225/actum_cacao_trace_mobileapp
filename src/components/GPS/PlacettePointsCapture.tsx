import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../theme';
import { TypePoint } from '../../types';
import type { PointGPS } from '../../types';

// Bornes Côte d'Ivoire (cohérentes avec la validation backend).
const CI_LAT = [4.0, 10.8] as const;
const CI_LON = [-8.6, -2.5] as const;

export interface ManualPointValues {
  latitude: number;
  longitude: number;
  altitude?: number;
  precision?: number;
}

interface PlacettePointsCaptureProps {
  points: PointGPS[];
  onCapture: (typePoint: TypePoint, ordre: number) => void;
  /** Édition manuelle des coordonnées d'un point déjà relevé. */
  onManualEdit: (typePoint: TypePoint, ordre: number, values: ManualPointValues) => void;
  /**
   * Autorise l'édition manuelle (affiche l'icône crayon). Désactivé par défaut :
   * l'agent terrain ne peut pas corriger les coordonnées ; la fonctionnalité
   * reste disponible pour les rôles habilités (ex. chef d'équipe).
   */
  canEdit?: boolean;
  capturing?: { type: TypePoint; ordre: number } | null;
  areaInHectares?: number;
}

interface GroupDef {
  type: TypePoint;
  prefix: string;
  count: number;
  titre: string;
  desc: string;
}

const GROUPS: GroupDef[] = [
  { type: TypePoint.SOMMET, prefix: 'S', count: 4, titre: 'Sommets', desc: 'Délimitation (obligatoire)' },
  { type: TypePoint.MILIEU_INTERMEDIAIRE, prefix: 'Mi', count: 6, titre: 'Milieux intermédiaires', desc: 'Mi1 à Mi6' },
  { type: TypePoint.MILIEU_CENTRAL, prefix: 'Mc', count: 2, titre: 'Milieux centraux', desc: 'Mc1 à Mc2' },
];

const TOTAL = GROUPS.reduce((n, g) => n + g.count, 0);

export const PlacettePointsCapture: React.FC<PlacettePointsCaptureProps> = ({
  points,
  onCapture,
  onManualEdit,
  canEdit = false,
  capturing = null,
  areaInHectares = 0,
}) => {
  const find = (type: TypePoint, ordre: number) =>
    points.find((p) => p.typePoint === type && p.ordreSommet === ordre) ?? null;

  // --- Édition manuelle (modale) ---
  const [editor, setEditor] = useState<{ type: TypePoint; ordre: number; label: string } | null>(
    null,
  );
  const [latStr, setLatStr] = useState('');
  const [lonStr, setLonStr] = useState('');
  const [altStr, setAltStr] = useState('');
  const [precStr, setPrecStr] = useState('');
  const [editErr, setEditErr] = useState<string | null>(null);

  const openEditor = (type: TypePoint, ordre: number, label: string, pt: PointGPS) => {
    setEditor({ type, ordre, label });
    setLatStr(String(pt.latitude));
    setLonStr(String(pt.longitude));
    setAltStr(pt.altitude !== undefined ? String(pt.altitude) : '');
    setPrecStr(pt.precision !== undefined ? String(pt.precision) : '');
    setEditErr(null);
  };

  const num = (s: string) => {
    const n = parseFloat(s.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  const saveEditor = () => {
    if (!editor) return;
    const lat = num(latStr);
    const lon = num(lonStr);
    if (lat === null || lon === null) {
      setEditErr('Latitude et longitude sont obligatoires (nombres).');
      return;
    }
    if (lat < CI_LAT[0] || lat > CI_LAT[1] || lon < CI_LON[0] || lon > CI_LON[1]) {
      setEditErr(`Hors bornes Côte d'Ivoire (lat ${CI_LAT[0]}–${CI_LAT[1]}, lon ${CI_LON[0]}–${CI_LON[1]}).`);
      return;
    }
    const alt = altStr.trim() ? num(altStr) ?? undefined : undefined;
    const prec = precStr.trim() ? num(precStr) ?? undefined : undefined;
    onManualEdit(editor.type, editor.ordre, {
      latitude: lat,
      longitude: lon,
      altitude: alt,
      precision: prec,
    });
    setEditor(null);
  };

  const capturedCount = points.length;

  // Premier point non capturé (dans l'ordre des groupes) — pour la capture rapide.
  let next: { type: TypePoint; ordre: number; label: string } | null = null;
  for (const g of GROUPS) {
    for (let o = 1; o <= g.count; o += 1) {
      if (!find(g.type, o)) {
        next = { type: g.type, ordre: o, label: `${g.prefix}${o}` };
        break;
      }
    }
    if (next) break;
  }

  const isCapturing = (type: TypePoint, ordre: number) =>
    capturing?.type === type && capturing?.ordre === ordre;

  return (
    <View style={styles.card}>
      {/* En-tête : progression + superficie */}
      <View style={styles.header}>
        <View style={styles.progressWrap}>
          <Text style={styles.progressValue}>
            {capturedCount}
            <Text style={styles.progressTotal}>/{TOTAL}</Text>
          </Text>
          <Text style={styles.progressLabel}>points relevés</Text>
        </View>
        <View style={styles.areaBadge}>
          <Feather name="maximize" size={12} color={colors.emeraldPrimary} />
          <Text style={styles.areaText}>{areaInHectares > 0 ? `${areaInHectares} ha` : '— ha'}</Text>
        </View>
      </View>

      {/* Capture rapide du point suivant */}
      <TouchableOpacity
        style={[styles.nextBtn, !next && styles.nextBtnDone]}
        onPress={() => next && onCapture(next.type, next.ordre)}
        disabled={!next || !!capturing}
        activeOpacity={0.85}
      >
        {capturing ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : next ? (
          <>
            <Feather name="crosshair" size={18} color="#FFFFFF" />
            <Text style={styles.nextBtnText}>Capturer {next.label}</Text>
          </>
        ) : (
          <>
            <Feather name="check-circle" size={18} color="#FFFFFF" />
            <Text style={styles.nextBtnText}>Tous les points relevés</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Sections : Sommets / Milieux intermédiaires / Milieux centraux */}
      {GROUPS.map((g) => {
        const done = Array.from({ length: g.count }).filter((_, i) => find(g.type, i + 1)).length;
        return (
          <View key={g.type} style={styles.group}>
            <View style={styles.groupHead}>
              <Text style={styles.groupTitle}>{g.titre}</Text>
              <Text style={styles.groupCount}>
                {done}/{g.count}
              </Text>
            </View>
            <Text style={styles.groupDesc}>{g.desc}</Text>

            <View style={styles.tiles}>
              {Array.from({ length: g.count }).map((_, i) => {
                const ordre = i + 1;
                const pt = find(g.type, ordre);
                const captured = !!pt;
                const busy = isCapturing(g.type, ordre);
                const isNext = next?.type === g.type && next?.ordre === ordre;
                return (
                  <TouchableOpacity
                    key={ordre}
                    style={[
                      styles.tile,
                      captured && styles.tileCaptured,
                      isNext && styles.tileNext,
                    ]}
                    onPress={() => onCapture(g.type, ordre)}
                    disabled={!!capturing}
                    activeOpacity={0.8}
                  >
                    <View style={styles.tileTop}>
                      <Text style={[styles.tileLabel, captured && styles.tileLabelCaptured]}>
                        {g.prefix}
                        {ordre}
                      </Text>
                      {busy ? (
                        <ActivityIndicator size="small" color={colors.emeraldPrimary} />
                      ) : (
                        <View style={styles.tileIcons}>
                          {captured && canEdit && (
                            <TouchableOpacity
                              onPress={() => openEditor(g.type, ordre, `${g.prefix}${ordre}`, pt!)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Feather name="edit-2" size={13} color={colors.textSecondary} />
                            </TouchableOpacity>
                          )}
                          <Feather
                            name={captured ? 'check-circle' : 'crosshair'}
                            size={14}
                            color={captured ? colors.emeraldPrimary : colors.textMuted}
                          />
                        </View>
                      )}
                    </View>
                    {captured ? (
                      <>
                        <Text style={styles.tileCoords} numberOfLines={1}>
                          {pt!.latitude.toFixed(4)}, {pt!.longitude.toFixed(4)}
                        </Text>
                        {pt!.precision !== undefined && (
                          <Text style={styles.tilePrecision}>±{pt!.precision} m</Text>
                        )}
                      </>
                    ) : (
                      <Text style={styles.tilePending}>Toucher</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      })}

      {/* Modale d'édition manuelle des coordonnées d'un point */}
      <Modal
        visible={!!editor}
        transparent
        animationType="fade"
        onRequestClose={() => setEditor(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Feather name="edit-2" size={16} color={colors.emeraldPrimary} />
              <Text style={styles.modalTitle}>Corriger le point {editor?.label}</Text>
            </View>
            <Text style={styles.modalSub}>
              Ajustez manuellement les coordonnées relevées par le GPS.
            </Text>

            {editErr && <Text style={styles.modalErr}>{editErr}</Text>}

            <View style={styles.modalRow}>
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Latitude</Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numbers-and-punctuation"
                  value={latStr}
                  onChangeText={setLatStr}
                  placeholder="5.641200"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Longitude</Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numbers-and-punctuation"
                  value={lonStr}
                  onChangeText={setLonStr}
                  placeholder="-6.603100"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            <View style={styles.modalRow}>
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Altitude (m)</Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numbers-and-punctuation"
                  value={altStr}
                  onChangeText={setAltStr}
                  placeholder="optionnel"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Précision (m)</Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numbers-and-punctuation"
                  value={precStr}
                  onChangeText={setPrecStr}
                  placeholder="optionnel"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setEditor(null)}>
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={saveEditor}>
                <Feather name="check" size={16} color="#FFFFFF" />
                <Text style={styles.modalSaveText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  progressWrap: {
    flexDirection: 'column',
  },
  progressValue: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.emeraldPrimary,
  },
  progressTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textMuted,
  },
  progressLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: -2,
  },
  areaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.mintBadge,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  areaText: {
    color: colors.emeraldPrimary,
    fontWeight: '800',
    fontSize: 12,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.emeraldPrimary,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 18,
  },
  nextBtnDone: {
    backgroundColor: colors.forestLight,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  group: {
    marginBottom: 16,
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  groupCount: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.emeraldPrimary,
  },
  groupDesc: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
    marginBottom: 8,
  },
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tile: {
    width: '31.5%',
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  tileCaptured: {
    backgroundColor: colors.mintBadge,
    borderColor: colors.emeraldPrimary,
  },
  tileNext: {
    borderColor: colors.emeraldPrimary,
    borderWidth: 2,
  },
  tileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  tileIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tileLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.textSecondary,
  },
  tileLabelCaptured: {
    color: colors.emeraldPrimary,
  },
  tileCoords: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  tilePrecision: {
    fontSize: 9.5,
    color: colors.textSecondary,
    marginTop: 1,
  },
  tilePending: {
    fontSize: 10.5,
    fontStyle: 'italic',
    color: colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.backgroundCard,
    borderRadius: 20,
    padding: 20,
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  modalSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 14,
  },
  modalErr: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.error,
    backgroundColor: colors.errorBg,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  modalRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  modalField: {
    flex: 1,
    gap: 6,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  modalInput: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  modalCancel: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  modalSave: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.emeraldPrimary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  modalSaveText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
