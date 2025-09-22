import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty({ description: 'Página atual' })
  page: number;

  @ApiProperty({ description: 'Itens por página' })
  limit: number;

  @ApiProperty({ description: 'Total de itens' })
  total: number;

  @ApiProperty({ description: 'Total de páginas' })
  totalPages: number;

  @ApiProperty({ description: 'Página anterior existe' })
  hasPreviousPage: boolean;

  @ApiProperty({ description: 'Próxima página existe' })
  hasNextPage: boolean;

  constructor(page: number, limit: number, total: number) {
    this.page = page;
    this.limit = limit;
    this.total = total;
    this.totalPages = Math.ceil(total / limit);
    this.hasPreviousPage = page > 1;
    this.hasNextPage = page < this.totalPages;
  }
}

export class PaginatedResponseDto<T> {
  @ApiProperty({ description: 'Dados da página' })
  data: T[];

  @ApiProperty({ description: 'Metadados de paginação', type: PaginationMetaDto })
  meta: PaginationMetaDto;

  constructor(data: T[], meta: PaginationMetaDto) {
    this.data = data;
    this.meta = meta;
  }
}