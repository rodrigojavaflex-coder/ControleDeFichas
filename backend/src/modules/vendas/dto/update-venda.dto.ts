import { PartialType } from '@nestjs/swagger';
import {
  CreateVendaDto,
  ValorCompraMenorOuIgualAoCliente,
} from './create-venda.dto';

export class UpdateVendaDto extends PartialType(CreateVendaDto) {
  @ValorCompraMenorOuIgualAoCliente({
    message: 'O valor da compra não pode ser maior que o valor do cliente',
  })
  valorCliente?: number;
}
