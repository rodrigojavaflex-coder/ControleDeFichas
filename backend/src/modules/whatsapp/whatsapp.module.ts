import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { FolhaReciboImagemService } from './folha-recibo-imagem.service';
import { WhatsappService } from './whatsapp.service';
import { WhatsappConversa } from './entities/whatsapp-conversa.entity';
import { WhatsappMensagem } from './entities/whatsapp-mensagem.entity';
import { Funcionario } from '../folha/entities/funcionario.entity';
import { FolhaCapa } from '../folha/entities/folha-capa.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { FolhaWhatsappController } from './folha-whatsapp.controller';
import { WhatsappWebhookService } from './whatsapp-webhook.service';
import { WhatsappConversaService } from './whatsapp-conversa.service';
import { FolhaWhatsappAtendimentoService } from './folha-whatsapp-atendimento.service';
import { WhatsappMediaStorageService } from './whatsapp-media-storage.service';
import { WhatsappAudioConvertService } from './whatsapp-audio-convert.service';
import { WhatsappMediaInboundService } from './whatsapp-media-inbound.service';
import { WhatsappMediaCleanupService } from './whatsapp-media-cleanup.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  imports: [
    ConfigModule,
    JwtModule,
    TypeOrmModule.forFeature([
      WhatsappConversa,
      WhatsappMensagem,
      Funcionario,
      FolhaCapa,
      Usuario,
    ]),
  ],
  controllers: [WhatsappWebhookController, FolhaWhatsappController],
  providers: [
    WhatsappService,
    FolhaReciboImagemService,
    WhatsappWebhookService,
    WhatsappConversaService,
    FolhaWhatsappAtendimentoService,
    WhatsappMediaStorageService,
    WhatsappAudioConvertService,
    WhatsappMediaInboundService,
    WhatsappMediaCleanupService,
    PermissionsGuard,
  ],
  exports: [
    WhatsappService,
    FolhaReciboImagemService,
    WhatsappConversaService,
  ],
})
export class WhatsappModule {}
