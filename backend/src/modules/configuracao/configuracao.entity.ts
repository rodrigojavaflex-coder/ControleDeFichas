import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('configuracoes')
export class Configuracao {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  nomeCliente: string;


  @Column({ nullable: true })
  logoRelatorio: string; // Caminho/URL da imagem

  @Column({ nullable: true })
  farmaceuticoResponsavel: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
