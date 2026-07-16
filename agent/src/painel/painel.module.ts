import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PainelController } from './painel.controller';
import { PainelService } from './painel.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PainelController],
  providers: [PainelService],
})
export class PainelModule {}
