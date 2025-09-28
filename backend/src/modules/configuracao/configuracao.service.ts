import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Configuracao } from './entities/configuracao.entity';
import { CreateConfiguracaoDto } from './dto/create-configuracao.dto';
import { UpdateConfiguracaoDto } from './dto/update-configuracao.dto';
import { AuditoriaService } from '../../common/services/auditoria.service';
import { AuditAction } from '../../common/enums/auditoria.enum';

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
  ): Promise<Configuracao> {
    // Busca se já existe configuração (só pode haver uma)
    let config = await this.configuracaoRepository.findOne({ where: {} });
    if (config) {
      // Atualiza existente
      const dadosAnteriores = { ...config };
      Object.assign(config, dto);

      const configuracaoAtualizada =
        await this.configuracaoRepository.save(config);

      // Auditar atualização
      await this.auditoriaService.createLog({
        acao: AuditAction.UPDATE,
        descricao: `Configuração do sistema atualizada`,
        usuarioId: userId,
        entidade: 'configuracoes',
        entidadeId: config.id,
        dadosAnteriores,
        dadosNovos: dto,
      });

      return configuracaoAtualizada;
    } else {
      // Cria nova
      config = this.configuracaoRepository.create(dto);
      const novaConfig = await this.configuracaoRepository.save(config);

      // Auditar criação
      await this.auditoriaService.createLog({
        acao: AuditAction.CREATE,
        descricao: `Nova configuração do sistema criada`,
        usuarioId: userId,
        entidade: 'configuracoes',
        entidadeId: config.id,
        dadosNovos: dto,
      });

      return novaConfig;
    }
  }

  async findOne(): Promise<Configuracao> {
    const config = await this.configuracaoRepository.findOne({ where: {} });
    if (!config) throw new NotFoundException('Configuração não encontrada');
    return config;
  }

  async update(
    id: string,
    dto: UpdateConfiguracaoDto,
    userId?: string,
  ): Promise<Configuracao> {
    const config = await this.configuracaoRepository.findOne({ where: { id } });
    if (!config) throw new NotFoundException('Configuração não encontrada');

    const dadosAnteriores = { ...config };
    Object.assign(config, dto);
    const configuracaoAtualizada =
      await this.configuracaoRepository.save(config);

    // Auditar atualização
    await this.auditoriaService.createLog({
      acao: AuditAction.UPDATE,
      descricao: `Configuração do sistema atualizada via PUT`,
      usuarioId: userId,
      entidade: 'configuracoes',
      entidadeId: id,
      dadosAnteriores,
      dadosNovos: dto,
    });

    return configuracaoAtualizada;
  }
}
