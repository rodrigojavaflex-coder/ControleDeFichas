import { Module } from '@nestjs/common';
import { PrescritoresController } from './prescritores.controller';
import { PrescritoresService } from './prescritores.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [PrescritoresController],
  providers: [PrescritoresService],
})
export class PrescritoresModule {}
