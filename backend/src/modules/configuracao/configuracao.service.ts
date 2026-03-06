import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Configuracao } from './entities/configuracao.entity';
import { CreateConfiguracaoDto } from './dto/create-configuracao.dto';
import { UpdateConfiguracaoDto } from './dto/update-configuracao.dto';
import { AuditoriaService } from '../../common/services/auditoria.service';
import { AuditAction } from '../../common/enums/auditoria.enum';

const LOGO_RELATORIO_MARKER = '/configuracao/logo';

export interface LogoUpload {
  buffer: Buffer;
  mime: string;
}

@Injectable()
export class ConfiguracaoService {
  constructor(
    @InjectRepository(Configuracao)
    private readonly configuracaoRepository: Repository<Configuracao>,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async create(
    dto: CreateConfiguracaoDto,
    userId?: string,
    logo?: LogoUpload,
  ): Promise<Configuracao> {
    let config = await this.configuracaoRepository.findOne({ where: {} });
    if (config) {
      const dadosAnteriores = { ...config };
      Object.assign(config, dto);
      if (logo) {
        (config as any).logoImagem = logo.buffer;
        (config as any).logoImagemMime = logo.mime;
        config.logoRelatorio = LOGO_RELATORIO_MARKER;
      }

      const configuracaoAtualizada =
        await this.configuracaoRepository.save(config);

      await this.auditoriaService.createLog({
        acao: AuditAction.UPDATE,
        descricao: `Configuração do sistema atualizada`,
        usuarioId: userId,
        entidade: 'configuracoes',
        entidadeId: config.id,
        dadosAnteriores,
        dadosNovos: dto,
      });

      return this.findOne();
    }

    config = this.configuracaoRepository.create(dto);
    if (logo) {
      (config as any).logoImagem = logo.buffer;
      (config as any).logoImagemMime = logo.mime;
      config.logoRelatorio = LOGO_RELATORIO_MARKER;
    }
    await this.configuracaoRepository.save(config);

    await this.auditoriaService.createLog({
      acao: AuditAction.CREATE,
      descricao: `Nova configuração do sistema criada`,
      usuarioId: userId,
      entidade: 'configuracoes',
      entidadeId: config.id,
      dadosNovos: dto,
    });

    return this.findOne();
  }

  async findOne(): Promise<Configuracao> {
    const config = await this.configuracaoRepository.findOne({ where: {} });
    if (!config) throw new NotFoundException('Configuração não encontrada');
    return config;
  }

  async findOneWithHasLogo(): Promise<Configuracao & { hasLogo: boolean }> {
    const config = await this.findOne();
    const hasLogo = await this.getHasLogo();
    return { ...config, hasLogo };
  }

  async getHasLogo(): Promise<boolean> {
    const row = await this.configuracaoRepository
      .createQueryBuilder('c')
      .select('1')
      .where('c.logoImagem IS NOT NULL')
      .limit(1)
      .getRawOne();
    return !!row;
  }

  async getLogo(): Promise<{ buffer: Buffer; mime: string } | null> {
    const config = await this.configuracaoRepository
      .createQueryBuilder('config')
      .addSelect('config.logoImagem')
      .addSelect('config.logoImagemMime')
      .where('config.id IS NOT NULL')
      .limit(1)
      .getOne();
    if (!config || !(config as any).logoImagem) return null;
    const mime = (config as any).logoImagemMime || 'image/png';
    return { buffer: (config as any).logoImagem as Buffer, mime };
  }

  async update(
    id: string,
    dto: UpdateConfiguracaoDto,
    userId?: string,
    logo?: LogoUpload,
  ): Promise<Configuracao> {
    const config = await this.configuracaoRepository
      .createQueryBuilder('config')
      .addSelect('config.logoImagem')
      .addSelect('config.logoImagemMime')
      .where('config.id = :id', { id })
      .getOne();
    if (!config) throw new NotFoundException('Configuração não encontrada');

    const dadosAnteriores = { ...config };
    Object.assign(config, dto);
    if (logo) {
      (config as any).logoImagem = logo.buffer;
      (config as any).logoImagemMime = logo.mime;
      config.logoRelatorio = LOGO_RELATORIO_MARKER;
    }

    await this.configuracaoRepository.save(config);

    await this.auditoriaService.createLog({
      acao: AuditAction.UPDATE,
      descricao: `Configuração do sistema atualizada via PUT`,
      usuarioId: userId,
      entidade: 'configuracoes',
      entidadeId: id,
      dadosAnteriores,
      dadosNovos: dto,
    });

    return this.findOne();
  }
}
