import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Configuracao } from './configuracao.entity';
import { CreateConfiguracaoDto } from './dto/create-configuracao.dto';
import { UpdateConfiguracaoDto } from './dto/update-configuracao.dto';

@Injectable()
export class ConfiguracaoService {
  constructor(
    @InjectRepository(Configuracao)
    private readonly configuracaoRepository: Repository<Configuracao>,
  ) {}

  async create(dto: CreateConfiguracaoDto): Promise<Configuracao> {
    // Busca se já existe configuração (só pode haver uma)
  let config = await this.configuracaoRepository.findOne({ where: {} });
    if (config) {
      // Atualiza existente
      Object.assign(config, dto);
      return await this.configuracaoRepository.save(config);
    } else {
      // Cria nova
      config = this.configuracaoRepository.create(dto);
      return await this.configuracaoRepository.save(config);
    }
  }

  async findOne(): Promise<Configuracao> {
  const config = await this.configuracaoRepository.findOne({ where: {} });
  if (!config) throw new NotFoundException('Configuração não encontrada');
  return config;
  }

  async update(id: string, dto: UpdateConfiguracaoDto): Promise<Configuracao> {
    const config = await this.configuracaoRepository.findOne({ where: { id } });
    if (!config) throw new NotFoundException('Configuração não encontrada');
    Object.assign(config, dto);
    return await this.configuracaoRepository.save(config);
  }
}
