import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule, ThrottlerModuleOptions } from '@nestjs/throttler';
import agentConfig from './config/agent.config';
import { AuthTokenGuard } from './common/guards/auth-token.guard';
import { HealthModule } from './health/health.module';
import { VendasModule } from './vendas/vendas.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [agentConfig],
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService): ThrottlerModuleOptions => {
        const rateLimit = configService.get('agent.rateLimit') || {
          ttl: 60,
          limit: 30,
        };
        return {
          throttlers: [
            {
              name: 'default',
              ttl: Number(rateLimit.ttl) || 60,
              limit: Number(rateLimit.limit) || 30,
            },
          ],
        };
      },
    }),
    HealthModule,
    VendasModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthTokenGuard,
    },
  ],
})
export class AppModule {}
