import { Global, Module } from '@nestjs/common';
import { ImportacaoManualProgressService } from './importacao-manual-progress.service';
import { ImportacaoManualProgressController } from './importacao-manual-progress.controller';

@Global()
@Module({
  controllers: [ImportacaoManualProgressController],
  providers: [ImportacaoManualProgressService],
  exports: [ImportacaoManualProgressService],
})
export class ImportacaoManualProgressModule {}
