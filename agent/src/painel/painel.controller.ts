import { Controller, Get, Query } from '@nestjs/common';
import { PainelService } from './painel.service';
import { PainelMedicosQueryDto } from './dto/painel-medicos-query.dto';

@Controller('v1/painel')
export class PainelController {
  constructor(private readonly painelService: PainelService) {}

  @Get('medicos-representantes')
  async medicosRepresentantes(@Query() query: PainelMedicosQueryDto) {
    return this.painelService.buscarMedicosRepresentantes(
      query.cdcon,
      query.cdfun,
    );
  }
}
