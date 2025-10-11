import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Laudo } from './entities/laudo.entity';
import { Certificado } from './entities/certificado.entity';

@Injectable()
export class LaudoService {
  constructor(
    @InjectRepository(Laudo)
    private readonly laudoRepository: Repository<Laudo>,
    @InjectRepository(Certificado)
    private readonly certificadoRepository: Repository<Certificado>,
  ) {}

  async create(certificadoId: string, file: Express.Multer.File): Promise<Laudo> {
    const certificado = await this.certificadoRepository.findOneBy({ id: certificadoId });
    if (!certificado) {
      throw new NotFoundException(`Certificado com ID ${certificadoId} não encontrado`);
    }
    // Decodifica nome do arquivo (Multer pode usar Latin1) para UTF-8
    const originalName = file.originalname;
    let decodedName: string;
    try {
      decodedName = Buffer.from(originalName, 'latin1').toString('utf8');
    } catch {
      decodedName = originalName;
    }
    const laudo = this.laudoRepository.create({
      arquivo: file.buffer,
      nomeArquivo: decodedName,
      certificado,
    });
    return this.laudoRepository.save(laudo);
  }

  async findByCertificado(certificadoId: string): Promise<Laudo[]> {
    return this.laudoRepository.find({
      where: { certificado: { id: certificadoId } },
      relations: ['certificado'],
      order: { criadoEm: 'DESC' },
    });
  }
  
  async findOne(id: string): Promise<Laudo> {
    const laudo = await this.laudoRepository.findOne({
      where: { id },
      relations: ['certificado'],
    });
    if (!laudo) {
      throw new NotFoundException(`Laudo com ID ${id} não encontrado`);
    }
    return laudo;
  }
  
  /**
   * Remove um laudo vinculado a um certificado
   */
  async remove(certificadoId: string, laudoId: string): Promise<void> {
    const laudo = await this.findOne(laudoId);
    if (laudo.certificado.id !== certificadoId) {
      throw new BadRequestException('Laudo não pertence ao certificado informado');
    }
    await this.laudoRepository.remove(laudo);
  }
}