import { Controller, Get, Query } from '@nestjs/common';
import { ClientesService } from './clientes.service';

@Controller('v1/clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Get()
  async buscarClientes(
    @Query('dataMinima') dataMinima: string,
    @Query('unit') unit: string,
  ) {
    const unitNum = unit ? parseInt(unit, 10) : 0;

    if (isNaN(unitNum) || unitNum <= 0) {
      throw new Error('unit deve ser um número válido maior que zero');
    }

    return this.clientesService.buscarClientes(dataMinima, unitNum);
  }
}
