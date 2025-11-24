import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class AuthTokenGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const configuredToken = this.configService.get<string>('agent.authToken') ?? '';

    if (!configuredToken) {
      throw new UnauthorizedException('Token do agente não configurado');
    }

    const incomingToken = this.extractToken(request.headers['authorization'], request.headers['x-api-key']);

    if (!incomingToken || incomingToken !== configuredToken) {
      throw new UnauthorizedException('Token inválido');
    }

    return true;
  }

  private extractToken(authorization?: string | string[], apiKey?: string | string[]): string | undefined {
    if (typeof authorization === 'string' && authorization.toLowerCase().startsWith('bearer ')) {
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
}
