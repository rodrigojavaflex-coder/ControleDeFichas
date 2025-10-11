import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuditoriaModule } from './modules/auditoria/auditoria.module';
import { FichaTecnicaModule } from './modules/ficha-tecnica/ficha-tecnica.module';
import { ConfiguracaoModule } from './modules/configuracao/configuracao.module';
import { PerfilModule } from './modules/perfil/perfil.module';
import { CertificadoModule } from './modules/certificado/certificado.module';
import { AuditoriaInterceptor } from './common/interceptors/auditoria.interceptor';
import databaseConfig from './config/database.config';
import appConfig from './config/app.config';
import { Configuracao } from './modules/configuracao/entities/configuracao.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, appConfig],
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        ...configService.get('database'),
      }),
    }),
    UsuariosModule,
    AuthModule,
    AuditoriaModule,
    FichaTecnicaModule,
  ConfiguracaoModule,
  PerfilModule,
  CertificadoModule,
    TypeOrmModule.forFeature([Configuracao]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditoriaInterceptor,
    },
  ],
})
export class AppModule {}
