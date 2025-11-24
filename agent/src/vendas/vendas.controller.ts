import { Body, Controller, Post } from '@nestjs/common';
import { TotalDiaDto } from './dto/total-dia.dto';
import { VendasService } from './vendas.service';

@Controller('v1/vendas')
export class VendasController {
  constructor(private readonly vendasService: VendasService) {}

  @Post('total-dia')
  async totalDia(@Body() body: TotalDiaDto) {
    return this.vendasService.totalDeVendasDoDia(body);
  }
}
