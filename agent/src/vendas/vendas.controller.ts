import { Body, Controller, Post } from '@nestjs/common';
import { TotalDiaDto } from './dto/total-dia.dto';
import { ValorCompraDto } from './dto/valor-compra.dto';
import { TotalDiaResponse, ValorCompraResponse, VendasService } from './vendas.service';

@Controller('v1/vendas')
export class VendasController {
  constructor(private readonly vendasService: VendasService) {}

  @Post('total-dia')
  async totalDia(@Body() body: TotalDiaDto): Promise<TotalDiaResponse> {
    return this.vendasService.totalDeVendasDoDia(body);
  }

  @Post('valor-compra')
  async valorCompra(@Body() body: ValorCompraDto): Promise<ValorCompraResponse> {
    return this.vendasService.buscarValorCompra(body);
  }
}
