import { Body, Controller, Post } from '@nestjs/common';
import { ValorCompraDto } from './dto/valor-compra.dto';
import { ValorCompraResponse, VendasService } from './vendas.service';

@Controller('v1/vendas')
export class VendasController {
  constructor(private readonly vendasService: VendasService) {}

  @Post('valor-compra')
  async valorCompra(@Body() body: ValorCompraDto): Promise<ValorCompraResponse> {
    return this.vendasService.buscarValorCompra(body);
  }
}
