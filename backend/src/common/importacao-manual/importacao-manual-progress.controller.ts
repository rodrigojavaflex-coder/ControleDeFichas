import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ImportacaoManualProgressService } from './importacao-manual-progress.service';
import { ImportacaoManualProgress } from './importacao-manual-progress.types';

@ApiTags('Importação manual')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('importacao-manual')
export class ImportacaoManualProgressController {
  constructor(
    private readonly progressService: ImportacaoManualProgressService,
  ) {}

  @Get('progresso')
  @ApiOperation({ summary: 'Obter progresso da importação manual em andamento' })
  @ApiResponse({ status: 200, description: 'Progresso atual ou null' })
  getProgresso(): ImportacaoManualProgress | null {
    return this.progressService.getProgress();
  }
}
