import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Configuracao } from './entities/configuracao.entity';
import { CreateConfiguracaoDto } from './dto/create-configuracao.dto';
import { UpdateConfiguracaoDto } from './dto/update-configuracao.dto';
import { MobileVersaoMinimaDto } from './dto/mobile-versao-minima.dto';
import { AuditoriaService } from '../../common/services/auditoria.service';
import { AuditAction } from '../../common/enums/auditoria.enum';
import { MobileAppVersionGuard } from '../../common/guards/mobile-app-version.guard';
import { isValidSemver } from '../../common/utils/semver.util';
import { loadMobileAppVersionsCatalog } from '../../common/utils/mobile-app-versions.util';

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
    private readonly mobileAppVersionGuard: MobileAppVersionGuard,
  ) {}

  private normalizeMobileVersaoMinima(
    input: unknown,
  ): string | null | undefined {
    if (input === undefined) {
      return undefined;
    }
    if (input === null || input === '') {
      return null;
    }
    const texto = String(input).trim();
    if (!texto) {
      return null;
    }
    if (!isValidSemver(texto)) {
      throw new BadRequestException(
        'Versão mínima do app deve estar no formato x.y.z (ex.: 1.0.0).',
      );
    }
    return texto;
  }

  private applyMobileVersaoMinima<T extends { mobileVersaoMinima?: string | null }>(
    dto: T,
  ): T {
    if (dto.mobileVersaoMinima === undefined) {
      return dto;
    }
    dto.mobileVersaoMinima = this.normalizeMobileVersaoMinima(
      dto.mobileVersaoMinima,
    );
    return dto;
  }

  async create(
    dto: CreateConfiguracaoDto,
    userId?: string,
    logo?: LogoUpload,
  ): Promise<Configuracao> {
    let config = await this.configuracaoRepository.findOne({ where: {} });
    if (config) {
      const dadosAnteriores = { ...config };
      Object.assign(config, this.applyMobileVersaoMinima(dto));
      if (logo) {
        config.logoImagem = logo.buffer;
        config.logoImagemMime = logo.mime;
        config.logoRelatorio = LOGO_RELATORIO_MARKER;
      }

      await this.configuracaoRepository.save(config);
      this.mobileAppVersionGuard.invalidateCache();

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

    config = this.configuracaoRepository.create(this.applyMobileVersaoMinima(dto));
    if (logo) {
      config.logoImagem = logo.buffer;
      config.logoImagemMime = logo.mime;
      config.logoRelatorio = LOGO_RELATORIO_MARKER;
    }
    await this.configuracaoRepository.save(config);
    this.mobileAppVersionGuard.invalidateCache();

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

  async findMobileVersaoMinima(): Promise<MobileVersaoMinimaDto> {
    const config = await this.configuracaoRepository.findOne({ where: {} });
    const raw = config?.mobileVersaoMinima?.trim() || null;
    const versaoMinima = raw && isValidSemver(raw) ? raw : null;
    return {
      versaoMinima,
      bloqueioAtivo: !!versaoMinima,
      versoes: loadMobileAppVersionsCatalog(),
    };
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
    if (!config?.logoImagem) return null;
    const mime = config.logoImagemMime || 'image/png';
    return { buffer: config.logoImagem, mime };
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
    Object.assign(config, this.applyMobileVersaoMinima(dto));
    if (logo) {
      config.logoImagem = logo.buffer;
      config.logoImagemMime = logo.mime;
      config.logoRelatorio = LOGO_RELATORIO_MARKER;
    }

    await this.configuracaoRepository.save(config);
    this.mobileAppVersionGuard.invalidateCache();

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
