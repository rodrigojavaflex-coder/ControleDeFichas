import { Controller, Get, Query } from '@nestjs/common';
import { PrescritoresService } from './prescritores.service';

@Controller('v1/prescritores')
export class PrescritoresController {
  constructor(private readonly prescritoresService: PrescritoresService) {}

  @Get()
  async buscarPrescritores(@Query('dataMinima') dataMinima: string) {
    return this.prescritoresService.buscarPrescritores(dataMinima);
  }
}
