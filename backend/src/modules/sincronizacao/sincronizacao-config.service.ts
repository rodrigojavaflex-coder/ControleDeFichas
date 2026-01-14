import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SincronizacaoConfig } from './entities/sincronizacao-config.entity';
import { CreateSincronizacaoConfigDto } from './dto/create-sincronizacao-config.dto';
import { UpdateSincronizacaoConfigDto } from './dto/update-sincronizacao-config.dto';

@Injectable()
export class SincronizacaoConfigService {
  constructor(
    @InjectRepository(SincronizacaoConfig)
    private readonly configRepository: Repository<SincronizacaoConfig>,
  ) {}

  async create(dto: CreateSincronizacaoConfigDto): Promise<SincronizacaoConfig> {
    // Verificar se já existe configuração para este agente
    const existing = await this.configRepository.findOne({
      where: { agente: dto.agente },
    });

    if (existing) {
      throw new ConflictException(
        `Já existe uma configuração para o agente: ${dto.agente}`,
      );
    }

    const config = this.configRepository.create({
      ...dto,
      // Manter como string YYYY-MM-DD, o transformer cuidará da conversão
      ultimaDataCliente: dto.ultimaDataCliente || undefined,
      ultimaDataPrescritor: dto.ultimaDataPrescritor || undefined,
    });

    return this.configRepository.save(config);
  }

  async findAll(): Promise<SincronizacaoConfig[]> {
    return this.configRepository.find({
      order: { agente: 'ASC' },
    });
  }

  async findOne(id: string): Promise<SincronizacaoConfig> {
    const config = await this.configRepository.findOne({ where: { id } });
    if (!config) {
      throw new NotFoundException(
        `Configuração de sincronização não encontrada: ${id}`,
      );
    }
    return config;
  }

  async findByAgente(agente: string): Promise<SincronizacaoConfig | null> {
    return this.configRepository.findOne({ where: { agente } });
  }

  async update(
    id: string,
    dto: UpdateSincronizacaoConfigDto,
  ): Promise<SincronizacaoConfig> {
    const config = await this.findOne(id);

    // Se está tentando mudar o agente, verificar se não existe outro com o mesmo nome
    if (dto.agente && dto.agente !== config.agente) {
      const existing = await this.configRepository.findOne({
        where: { agente: dto.agente },
      });
      if (existing) {
        throw new ConflictException(
          `Já existe uma configuração para o agente: ${dto.agente}`,
        );
      }
    }

    Object.assign(config, {
      ...dto,
      // Manter como string YYYY-MM-DD, o transformer cuidará da conversão
      ultimaDataCliente: dto.ultimaDataCliente !== undefined
        ? dto.ultimaDataCliente || null
        : config.ultimaDataCliente,
      ultimaDataPrescritor: dto.ultimaDataPrescritor !== undefined
        ? dto.ultimaDataPrescritor || null
        : config.ultimaDataPrescritor,
    });

    return this.configRepository.save(config);
  }

  async remove(id: string): Promise<void> {
    const config = await this.findOne(id);
    await this.configRepository.remove(config);
  }

  async findAllAtivos(): Promise<SincronizacaoConfig[]> {
    return this.configRepository.find({
      where: { ativo: true },
      order: { agente: 'ASC' },
    });
  }
}
