import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly config: ConfigService) {}

  getHello(): string {
    return 'Hello World!';
  }

  /**
   * Chave do Google Maps para o frontend (mobile/web).
   * Restrição recomendada: HTTP referrer / app package no Google Cloud.
   */
  getGoogleMapsKey(): { key: string } {
    const apiKey = this.config.get<string>('app.googleMapsApiKey')?.trim();
    if (!apiKey) {
      this.logger.error('GOOGLE_MAPS_API_KEY não configurada');
      throw new ServiceUnavailableException(
        'Mapa indisponível: chave do Google Maps não configurada.',
      );
    }
    return { key: apiKey };
  }
}
