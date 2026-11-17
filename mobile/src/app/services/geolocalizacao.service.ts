import { Injectable } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';

export interface CoordenadaVisita {
  latitude: number;
  longitude: number;
}

@Injectable({ providedIn: 'root' })
export class GeolocalizacaoService {
  async obter(): Promise<CoordenadaVisita> {
    try {
      const permissao = await Geolocation.requestPermissions();
      const concedida =
        permissao.location === 'granted' ||
        permissao.coarseLocation === 'granted';
      if (!concedida) {
        throw new Error(
          'Sem permissão de localização. A visita não pode continuar.',
        );
      }
      const posicao = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      });
      const latitude = posicao.coords.latitude;
      const longitude = posicao.coords.longitude;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error('Localização inválida.');
      }
      return { latitude, longitude };
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith('Sem permissão de localização')
      ) {
        throw error;
      }
      throw new Error(
        'Não foi possível obter a localização. Tente novamente em local aberto.',
      );
    }
  }
}
