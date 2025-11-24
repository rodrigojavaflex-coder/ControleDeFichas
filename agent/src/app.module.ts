import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
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
    HealthModule,
    VendasModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthTokenGuard,
    },
  ],
})
export class AppModule {}
