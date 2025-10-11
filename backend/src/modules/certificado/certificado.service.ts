import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Certificado } from './entities/certificado.entity';
import { CreateCertificadoDto } from './dto/create-certificado.dto';
import { UpdateCertificadoDto } from './dto/update-certificado.dto';
import { FichaTecnica } from '../ficha-tecnica/entities/ficha-tecnica.entity';

@Injectable()
export class CertificadoService {
  private readonly logger = new Logger(CertificadoService.name);

  constructor(
    @InjectRepository(Certificado)
    private readonly certificadoRepository: Repository<Certificado>,
    @InjectRepository(FichaTecnica)
    private readonly fichaTecnicaRepository: Repository<FichaTecnica>,
  ) {}

  async create(createCertificadoDto: CreateCertificadoDto): Promise<Certificado> {
    this.logger.debug('CertificadoService.create called with:', createCertificadoDto);
    try {
      // Remover fichaTecnicaId do DTO para não conflitar com a entidade
      const { fichaTecnicaId, ...certificadoData } = createCertificadoDto;

      const certificado = this.certificadoRepository.create(certificadoData);

      // Se fichaTecnicaId foi fornecido, associar a ficha técnica
      if (fichaTecnicaId) {
        const fichaTecnica = await this.fichaTecnicaRepository.findOneBy({
          id: fichaTecnicaId,
        });
        if (!fichaTecnica) {
          throw new NotFoundException(`Ficha técnica com ID ${fichaTecnicaId} não encontrada`);
        }
        certificado.fichaTecnica = fichaTecnica;
      }

      return await this.certificadoRepository.save(certificado);
    } catch (error) {
      this.logger.error('Error creating certificado:', error);
      throw error;
    }
  }

  async findAll(): Promise<Certificado[]> {
    this.logger.debug('CertificadoService.findAll called');
    try {
      return await this.certificadoRepository.find({
        order: { criadoEm: 'DESC' },
        relations: ['fichaTecnica'],
      });
    } catch (error) {
      this.logger.error('Error finding all certificados:', error);
      throw error;
    }
  }

  async findOne(id: string): Promise<Certificado> {
    this.logger.debug('CertificadoService.findOne called with id:', id);
    try {
      const certificado = await this.certificadoRepository.findOne({
        where: { id },
        relations: ['fichaTecnica'],
      });
      if (!certificado) {
        throw new NotFoundException(`Certificado com ID ${id} não encontrado`);
      }
      return certificado;
    } catch (error) {
      this.logger.error('Error finding certificado:', error);
      throw error;
    }
  }

  async update(id: string, updateCertificadoDto: UpdateCertificadoDto): Promise<Certificado> {
    this.logger.debug('CertificadoService.update called with id:', id, 'and data:', updateCertificadoDto);
    try {
      const certificado = await this.findOne(id);
      Object.assign(certificado, updateCertificadoDto);
      return await this.certificadoRepository.save(certificado);
    } catch (error) {
      this.logger.error('Error updating certificado:', error);
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    this.logger.debug('CertificadoService.remove called with id:', id);
    try {
      const certificado = await this.findOne(id);
      await this.certificadoRepository.remove(certificado);
    } catch (error) {
      this.logger.error('Error removing certificado:', error);
      throw error;
    }
  }
  
  /**
   * Lista certificados associados a uma ficha técnica
   */
  async findByFichaTecnica(fichaTecnicaId: string): Promise<Certificado[]> {
    this.logger.debug('CertificadoService.findByFichaTecnica called with fichaTecnicaId:', fichaTecnicaId);
    return await this.certificadoRepository.find({
      where: { fichaTecnica: { id: fichaTecnicaId } },
      relations: ['fichaTecnica'],
      order: { criadoEm: 'DESC' },
    });
  }
}