import { Controller, Post, Get, Body, Param, Put, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { ConfiguracaoService } from './configuracao.service';
import { CreateConfiguracaoDto } from './dto/create-configuracao.dto';
import { UpdateConfiguracaoDto } from './dto/update-configuracao.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@ApiTags('configuracao')
@Controller('configuracao')
export class ConfiguracaoController {
  constructor(private readonly configuracaoService: ConfiguracaoService) {}

  @Post()
  @UseInterceptors(FileInterceptor('logoRelatorio', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + extname(file.originalname));
      }
    })
  }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateConfiguracaoDto })
  async create(
  @Body() body: CreateConfiguracaoDto,
  @UploadedFile() file?: any
  ) {
    if (file) {
      body.logoRelatorio = `/uploads/${file.filename}`;
    }
    return this.configuracaoService.create(body);
  }

  @Get()
  @ApiOperation({ summary: 'Buscar configuração' })
  async findOne() {
    return this.configuracaoService.findOne();
  }

  @Put(':id')
  @UseInterceptors(FileInterceptor('logoRelatorio', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + extname(file.originalname));
      }
    })
  }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateConfiguracaoDto })
  async update(
  @Param('id') id: string,
  @Body() body: UpdateConfiguracaoDto,
  @UploadedFile() file?: any
  ) {
    if (file) {
      body.logoRelatorio = `/uploads/${file.filename}`;
    }
    return this.configuracaoService.update(id, body);
  }
}
