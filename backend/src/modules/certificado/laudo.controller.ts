import { Controller, Post, Get, Delete, Param, UploadedFile, UseInterceptors, ParseUUIDPipe, BadRequestException, UseGuards, Res, HttpCode } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { LaudoService } from './laudo.service';
import { AuditLog } from '../../common/interceptors/auditoria.interceptor';
import { AuditAction } from '../../common/enums/auditoria.enum';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';

@ApiTags('Laudos')
@Controller('certificados/:certificadoId/laudos')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class LaudoController {
  constructor(private readonly laudoService: LaudoService) {}

  @Post()
  @Permissions(Permission.CERTIFICADO_UPDATE)
  @ApiOperation({ summary: 'Upload de laudo PDF' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Laudo enviado com sucesso' })
  @ApiResponse({ status: 400, description: 'Arquivo inválido' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 } }))
  async upload(
    @Param('certificadoId', ParseUUIDPipe) certificadoId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file || file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Somente arquivos PDF são aceitos');
    }
    return this.laudoService.create(certificadoId, file);
  }

  @Get()
  @Permissions(Permission.CERTIFICADO_READ)
  @ApiOperation({ summary: 'Listar laudos de um certificado' })
  @ApiResponse({ status: 200, description: 'Lista de laudos', type: [Object] })
  findAll(
    @Param('certificadoId', ParseUUIDPipe) certificadoId: string,
  ) {
    return this.laudoService.findByCertificado(certificadoId);
  }
  
  @Delete(':laudoId')
  @AuditLog(AuditAction.DELETE, 'laudos')
  @Permissions(Permission.CERTIFICADO_DELETE)
  @ApiOperation({ summary: 'Remover um laudo PDF' })
  @ApiResponse({ status: 204, description: 'Laudo removido com sucesso' })
  @ApiResponse({ status: 400, description: 'Laudo não pertence ao certificado informado' })
    @HttpCode(204)
    async remove(
      @Param('certificadoId', ParseUUIDPipe) certificadoId: string,
      @Param('laudoId', ParseUUIDPipe) laudoId: string,
    ): Promise<void> {
      await this.laudoService.remove(certificadoId, laudoId);
    }
  
  @Get(':laudoId/download')
  @Permissions(Permission.CERTIFICADO_READ)
  @ApiOperation({ summary: 'Download de laudo PDF' })
  @ApiResponse({ status: 200, description: 'Arquivo PDF enviado' })
  async download(
    @Param('certificadoId', ParseUUIDPipe) certificadoId: string,
    @Param('laudoId', ParseUUIDPipe) laudoId: string,
    @Res() res,
  ) {
    const laudo = await this.laudoService.findOne(laudoId);
    if (laudo.certificado.id !== certificadoId) {
      throw new BadRequestException('Laudo não pertence ao certificado informado');
    }
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="laudo-${laudoId}.pdf"`,
    });
    res.send(laudo.arquivo);
  }
}