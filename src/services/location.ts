// ============================================================================
// CacaoTrace — Service de géolocalisation
// ----------------------------------------------------------------------------
// Capture GPS haute précision. La simulation (émulateur / permission refusée)
// est désormais EXPLICITE et pilotée par `ALLOW_GPS_SIMULATION` : en production
// on refuse un point simulé pour ne pas fausser les données de terrain du producteur.
// ============================================================================

import * as Location from 'expo-location';
import { ALLOW_GPS_SIMULATION, GPS_MIN_ACCURACY_METERS } from './config';
import type { PointGPS } from '../types';

export class LocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LocationError';
  }
}

export class LocationService {
  /** Bornes géographiques de la Côte d'Ivoire. */
  static isWithinIvoryCoast(lat: number, lon: number): boolean {
    return lat >= 4.0 && lat <= 10.8 && lon >= -8.6 && lon <= -2.5;
  }

  /** Indique si la précision (mètres) respecte le seuil minimal configuré. */
  static isAccuracyAcceptable(precision?: number): boolean {
    if (precision === undefined) return false;
    return precision <= GPS_MIN_ACCURACY_METERS;
  }

  /**
   * Capture un point GPS réel. Lève `LocationError` si le capteur est
   * indisponible et que la simulation n'est pas autorisée.
   */
  static async getCurrentPosition(ordreSommet: number): Promise<PointGPS> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return this.fallbackOrThrow(ordreSommet, 'Permission de localisation refusée.');
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const lat = location.coords.latitude;
      const lon = location.coords.longitude;

      if (!this.isWithinIvoryCoast(lat, lon)) {
        return this.fallbackOrThrow(
          ordreSommet,
          'Position hors des bornes de la Côte d\'Ivoire.',
        );
      }

      return {
        ordreSommet,
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lon.toFixed(6)),
        altitude: location.coords.altitude ? Number(location.coords.altitude.toFixed(1)) : undefined,
        precision: location.coords.accuracy ? Number(location.coords.accuracy.toFixed(1)) : undefined,
      };
    } catch (e) {
      if (e instanceof LocationError) throw e;
      return this.fallbackOrThrow(ordreSommet, 'Capteur GPS indisponible.');
    }
  }

  private static fallbackOrThrow(ordreSommet: number, reason: string): PointGPS {
    if (!ALLOW_GPS_SIMULATION) {
      throw new LocationError(`${reason} Capture GPS réelle requise (mode production).`);
    }
    return this.getSimulatedPoint(ordreSommet);
  }

  /** Point de démonstration (région San-Pédro / Soubré) — usage développement uniquement. */
  private static getSimulatedPoint(ordreSommet: number): PointGPS {
    const baseLat = 5.6412;
    const baseLon = -6.6031;
    const offsets: Record<number, [number, number]> = {
      1: [0.0, 0.0],
      2: [0.00045, 0.0001],
      3: [0.00042, 0.00055],
      4: [0.00005, 0.00048],
    };
    const [dLat, dLon] = offsets[ordreSommet] || [0, 0];
    return {
      ordreSommet,
      latitude: Number((baseLat + dLat).toFixed(6)),
      longitude: Number((baseLon + dLon).toFixed(6)),
      altitude: 125.0,
      precision: 2.8,
    };
  }

  /** Superficie approximative d'un polygone (hectares) — formule du lacet. */
  static calculateAreaInHectares(sommets: PointGPS[]): number {
    if (sommets.length < 3) return 0;
    const rad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6378137; // Rayon terrestre (m)

    const coords = sommets.map((s) => {
      const x = R * rad(s.longitude) * Math.cos(rad(s.latitude));
      const y = R * rad(s.latitude);
      return [x, y];
    });

    let area = 0;
    const n = coords.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += coords[i][0] * coords[j][1];
      area -= coords[j][0] * coords[i][1];
    }
    area = Math.abs(area) / 2.0;
    return Number((area / 10000.0).toFixed(2));
  }
}
