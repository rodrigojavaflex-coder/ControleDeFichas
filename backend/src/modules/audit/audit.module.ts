import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuditController } from './audit.controller';
import { AuditService } from '../../common/services/audit.service';
import { AuditLog } from '../../common/entities/audit-log.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([AuditLog]),
  ],
  controllers: [AuditController],
  providers: [
    AuditService,
  ],
  exports: [
    AuditService,
  ],
})
export class AuditModule {}