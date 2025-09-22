import {
  Controller,
  Get,
  Query,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuditService } from '../../common/services/audit.service';
import { FindAuditLogsDto } from './dto/find-audit-logs.dto';

@ApiTags('audit')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({
    summary: 'Buscar logs de auditoria (temporariamente desabilitado)',
    description: 'Sistema de auditoria temporariamente desabilitado',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista vazia retornada - sistema desabilitado',
  })
  async findAll(@Query() findDto: FindAuditLogsDto): Promise<any> {
    return this.auditService.findLogs(findDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Buscar log por ID (temporariamente desabilitado)',
    description: 'Sistema de auditoria temporariamente desabilitado',
  })
  @ApiResponse({
    status: 200,
    description: 'Null retornado - sistema desabilitado',
  })
  async findOne(@Param('id') id: string): Promise<any> {
    return this.auditService.findLogById(id);
  }
}