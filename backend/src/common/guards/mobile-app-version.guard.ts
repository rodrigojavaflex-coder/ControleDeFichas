import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { Configuracao } from '../../modules/configuracao/entities/configuracao.entity';
import { compareSemver, isValidSemver } from '../utils/semver.util';

export const APP_VERSION_REQUIRED_CODE = 'APP_VERSION_REQUIRED';
export const APP_VERSION_HEADER = 'x-app-version';

@Injectable()
export class MobileAppVersionGuard implements CanActivate {
  private cachedMinima: string | null | undefined;
  private cachedAt = 0;
  private readonly cacheTtlMs = 30_000;

  constructor(
    @InjectRepository(Configuracao)
    private readonly configuracaoRepository: Repository<Configuracao>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const rawHeader = request.headers[APP_VERSION_HEADER];
    const appVersion = Array.isArray(rawHeader)
      ? rawHeader[0]?.trim()
      : rawHeader?.trim();

    // Web, Postman e clientes sem o header não são bloqueados.
    if (!appVersion) {
      return true;
    }

    const minima = await this.resolveVersaoMinima();
    if (!minima) {
      return true;
    }

    if (!isValidSemver(appVersion) || compareSemver(appVersion, minima) < 0) {
      throw new HttpException(
        {
          statusCode: 426,
          message: 'Atualize o aplicativo para continuar.',
          code: APP_VERSION_REQUIRED_CODE,
          versaoMinima: minima,
          versaoApp: appVersion,
        },
        426,
      );
    }

    return true;
  }

  private async resolveVersaoMinima(): Promise<string | null> {
    const now = Date.now();
    if (
      this.cachedMinima !== undefined &&
      now - this.cachedAt < this.cacheTtlMs
    ) {
      return this.cachedMinima;
    }

    const config = await this.configuracaoRepository.findOne({ where: {} });
    const raw = config?.mobileVersaoMinima?.trim() || null;
    const minima = raw && isValidSemver(raw) ? raw : null;
    this.cachedMinima = minima;
    this.cachedAt = now;
    return minima;
  }

  invalidateCache(): void {
    this.cachedMinima = undefined;
    this.cachedAt = 0;
  }
}
