import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  StreamableFile,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Response } from 'express';
import { MulterError } from 'multer';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { EnviarMidiaDto } from './dto/enviar-midia.dto';
import { LIMITE_AUDIO_BYTES } from './visita-midia.limits';
import {
  VisitaMidiaResumo,
  VisitasMidiaService,
} from './visitas-midia.service';

type ReqUsuario = { user: Usuario };

@Catch(MulterError)
class VisitaMidiaUploadFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const message =
      exception.code === 'LIMIT_FILE_SIZE'
        ? 'Arquivo excede o limite máximo de 15 MB.'
        : 'Não foi possível receber o arquivo.';
    res.status(400).json({ statusCode: 400, message });
  }
}

@ApiTags('Visitas')
@Controller('visitas')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@UseFilters(VisitaMidiaUploadFilter)
export class VisitasMidiaController {
  constructor(private readonly midias: VisitasMidiaService) {}

  @Get(':id/midias')
  @Permissions(
    Permission.VISITAS_READ,
    Permission.VISITAS_GERIR,
    Permission.VISITAS_AGENDA_READ,
  )
  @ApiOperation({ summary: 'Listar mídias da visita' })
  listar(
    @Req() req: ReqUsuario,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<VisitaMidiaResumo[]> {
    return this.midias.listar(req.user.id, id);
  }

  @Post(':id/midias')
  @Permissions(Permission.VISITAS_UPDATE, Permission.VISITAS_GERIR)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        tipo: { type: 'string', enum: ['imagem', 'audio'] },
        duracaoMs: { type: 'integer' },
      },
      required: ['file', 'tipo'],
    },
  })
  @ApiOperation({ summary: 'Anexar foto ou áudio à visita aberta' })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: LIMITE_AUDIO_BYTES } }),
  )
  enviar(
    @Req() req: ReqUsuario,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: EnviarMidiaDto,
  ): Promise<VisitaMidiaResumo> {
    if (!file) {
      throw new BadRequestException('Arquivo de mídia não enviado.');
    }
    return this.midias.enviar(req.user.id, id, file, dto);
  }

  @Get(':id/midias/:midiaId/arquivo')
  @Permissions(
    Permission.VISITAS_READ,
    Permission.VISITAS_GERIR,
    Permission.VISITAS_AGENDA_READ,
  )
  @ApiOperation({ summary: 'Baixar mídia da visita' })
  async arquivo(
    @Req() req: ReqUsuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('midiaId', ParseUUIDPipe) midiaId: string,
  ): Promise<StreamableFile> {
    const arquivo = await this.midias.ler(req.user.id, id, midiaId);
    const nome = encodeURIComponent(arquivo.nomeArquivo);
    return new StreamableFile(arquivo.buffer, {
      type: arquivo.mimeType,
      disposition: `inline; filename*=UTF-8''${nome}`,
    });
  }

  @Delete(':id/midias/:midiaId')
  @Permissions(Permission.VISITAS_UPDATE, Permission.VISITAS_GERIR)
  @ApiOperation({ summary: 'Remover mídia da visita aberta' })
  excluir(
    @Req() req: ReqUsuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('midiaId', ParseUUIDPipe) midiaId: string,
  ): Promise<void> {
    return this.midias.excluir(req.user.id, id, midiaId);
  }
}
