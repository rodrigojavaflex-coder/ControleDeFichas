import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class AuthTokenGuard implements CanActivate {
  private readonly logger = new Logger(AuthTokenGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const configuredToken =
      this.configService.get<string>('agent.authToken') ?? '';
    const fallbackTokens =
      this.configService.get<string[]>('agent.authTokenFallbacks') ?? [];
    const allowedIps =
      this.configService.get<string[]>('agent.allowedIps') ?? [];
    const allTokens = [configuredToken, ...fallbackTokens].filter(Boolean);

    if (!allTokens.length) {
      throw new UnauthorizedException(
        'Token do agente não configurado. Defina AUTH_TOKEN no ambiente.',
      );
    }

    const clientIp = this.extractClientIp(request);
    if (allowedIps.length && !this.isIpAllowed(clientIp, allowedIps)) {
      this.logger.warn(`IP não autorizado bloqueado: ${clientIp ?? 'desconhecido'}`);
      throw new UnauthorizedException('IP não autorizado');
    }

    const incomingToken = this.extractToken(
      request.headers['authorization'],
      request.headers['x-api-key'],
    );

    if (!incomingToken || !allTokens.includes(incomingToken)) {
      this.logger.warn(
        `Token inválido bloqueado do IP ${clientIp ?? 'desconhecido'} (${this.maskToken(
          incomingToken,
        )})`,
      );
      throw new UnauthorizedException('Token inválido');
    }

    return true;
  }

  private extractToken(
    authorization?: string | string[],
    apiKey?: string | string[],
  ): string | undefined {
    if (
      typeof authorization === 'string' &&
      authorization.toLowerCase().startsWith('bearer ')
    ) {
      return authorization.slice(7);
    }

    if (typeof apiKey === 'string' && apiKey.trim().length > 0) {
      return apiKey.trim();
    }

    if (Array.isArray(apiKey) && apiKey[0]) {
      return apiKey[0];
    }

    return undefined;
  }

  private extractClientIp(request: Request): string | undefined {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }

    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return forwarded[0];
    }

    return request.ip || request.socket.remoteAddress || undefined;
  }

  private isIpAllowed(ip: string | undefined, allowedIps: string[]): boolean {
    if (!ip) {
      return false;
    }

    const normalizedIp = this.normalizeIp(ip);
    return allowedIps.some(
      (allowedIp) => this.normalizeIp(allowedIp) === normalizedIp,
    );
  }

  private normalizeIp(ip?: string): string | undefined {
    if (!ip) {
      return undefined;
    }
    return ip.replace(/^::ffff:/, '');
  }

  private maskToken(token?: string): string {
    if (!token) {
      return 'token:ausente';
    }

    if (token.length <= 4) {
      return `${token[0]}***`;
    }

    return `${token.slice(0, 4)}***`;
  }
}
