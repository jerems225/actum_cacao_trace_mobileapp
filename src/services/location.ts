// ============================================================================
// CacaoTrace — Service de géolocalisation
// ----------------------------------------------------------------------------
// Capture GPS haute précision. La simulation (émulateur / permission refusée)
// est désormais EXPLICITE et pilotée par `ALLOW_GPS_SIMULATION` : en production
// on refuse un point simulé pour ne pas fausser les données de terrain du producteur.
// ============================================================================

import * as Location from 'expo-location';
import { ALLOW_GPS_SIMULATION, GPS_MIN_ACCURACY_METERS } from './config';
import { TypePoint } from '../types';
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

  /**
   * Distance en mètres entre deux positions (formule de haversine).
   *
   * La Terre est traitée comme une sphère : l'écart avec l'ellipsoïde réel est
   * de l'ordre de 0,5 %, soit quelques centimètres sur les distances qui nous
   * occupent ici — sans commune mesure avec la précision d'un GPS de téléphone.
   */
  static distanceMetres(
    a: { latitude: number; longitude: number },
    b: { latitude: number; longitude: number },
  ): number {
    const RAYON_TERRE_M = 6_371_000;
    const rad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = rad(b.latitude - a.latitude);
    const dLon = rad(b.longitude - a.longitude);
    const lat1 = rad(a.latitude);
    const lat2 = rad(b.latitude);

    const h =
      Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * RAYON_TERRE_M * Math.asin(Math.sqrt(h));
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
  static async getCurrentPosition(
    typePoint: TypePoint,
    ordreSommet: number,
  ): Promise<PointGPS> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return this.fallbackOrThrow(typePoint, ordreSommet, 'Permission de localisation refusée.');
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const lat = location.coords.latitude;
      const lon = location.coords.longitude;

      if (!this.isWithinIvoryCoast(lat, lon)) {
        return this.fallbackOrThrow(
          typePoint,
          ordreSommet,
          'Position hors des bornes de la Côte d\'Ivoire.',
        );
      }

      return {
        typePoint,
        ordreSommet,
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lon.toFixed(6)),
        altitude: location.coords.altitude ? Number(location.coords.altitude.toFixed(1)) : undefined,
        precision: location.coords.accuracy ? Number(location.coords.accuracy.toFixed(1)) : undefined,
      };
    } catch (e) {
      if (e instanceof LocationError) throw e;
      return this.fallbackOrThrow(typePoint, ordreSommet, 'Capteur GPS indisponible.');
    }
  }

  private static fallbackOrThrow(
    typePoint: TypePoint,
    ordreSommet: number,
    reason: string,
  ): PointGPS {
    if (!ALLOW_GPS_SIMULATION) {
      throw new LocationError(`${reason} Capture GPS réelle requise (mode production).`);
    }
    return this.getSimulatedPoint(typePoint, ordreSommet);
  }

  /** Point de démonstration (région San-Pédro / Soubré) — usage développement uniquement. */
  private static getSimulatedPoint(typePoint: TypePoint, ordreSommet: number): PointGPS {
    const baseLat = 5.6412;
    const baseLon = -6.6031;
    const offsets: Record<number, [number, number]> = {
      1: [0.0, 0.0],
      2: [0.00045, 0.0001],
      3: [0.00042, 0.00055],
      4: [0.00005, 0.00048],
    };
    // Léger décalage par catégorie pour éviter des points superposés en démo.
    const catShift =
      typePoint === TypePoint.MILIEU_INTERMEDIAIRE
        ? 0.0002
        : typePoint === TypePoint.MILIEU_CENTRAL
          ? 0.0001
          : 0;
    const [dLat, dLon] = offsets[ordreSommet] || [0.0003 * ordreSommet, 0.0003 * ordreSommet];
    return {
      typePoint,
      ordreSommet,
      latitude: Number((baseLat + dLat + catShift).toFixed(6)),
      longitude: Number((baseLon + dLon + catShift).toFixed(6)),
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
