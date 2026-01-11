import { Controller, Post, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { MigracaoService, MigracaoResult, MigracaoProgress, MigracaoCadastrosProgress } from './migracao.service';

@ApiTags('Migração')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('migracao')
export class MigracaoController {
  constructor(private readonly migracaoService: MigracaoService) {}

  @Post('executar-migration')
  @ApiOperation({ 
    summary: 'Executar migration do banco de dados',
    description: 'Executa a migration para adicionar campos de relacionamento na tabela vendas'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Migration executada com sucesso',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        success: { type: 'boolean' }
      }
    }
  })
  async executarMigration() {
    return await this.migracaoService.executarMigration();
  }

  @Post('vendas-relacoes')
  @ApiOperation({ 
    summary: 'Migrar vendas para relacionamentos com Cliente, Vendedor e Prescritor',
    description: 'Busca dados nos bancos legados Firebird e cria/vincula os relacionamentos nas vendas'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Migração executada com sucesso',
    schema: {
      type: 'object',
      properties: {
        totalVendas: { type: 'number' },
        clientesCriados: { type: 'number' },
        vendedoresCriados: { type: 'number' },
        prescritoresCriados: { type: 'number' },
        vendasAtualizadas: { type: 'number' },
        erros: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              vendaId: { type: 'string' },
              protocolo: { type: 'string' },
              motivo: { type: 'string' }
            }
          }
        }
      }
    }
  })
  async migrarVendas(): Promise<MigracaoResult> {
    return await this.migracaoService.migrarVendasParaRelacoes();
  }

  @Get('progresso')
  @ApiOperation({ 
    summary: 'Obter progresso da migração em andamento',
    description: 'Retorna o status atual da migração de dados'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Progresso da migração',
    schema: {
      type: 'object',
      properties: {
        totalVendas: { type: 'number' },
        vendasProcessadas: { type: 'number' },
        clientesCriados: { type: 'number' },
        vendedoresCriados: { type: 'number' },
        prescritoresCriados: { type: 'number' },
        vendasAtualizadas: { type: 'number' },
        erros: { type: 'number' },
        status: { type: 'string', enum: ['running', 'completed', 'error'] },
        message: { type: 'string' }
      }
    }
  })
  getProgresso(): MigracaoProgress | null {
    return this.migracaoService.getProgress();
  }

  @Post('cadastros-completos')
  @ApiOperation({ 
    summary: 'Migrar todos os cadastros (clientes e prescritores) das bases legadas',
    description: 'Importa todos os registros das tabelas legadas de clientes e prescritores. Vendedores são migrados apenas durante a migração de vendas.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Migração de cadastros executada com sucesso',
    schema: {
      type: 'object',
      properties: {
        clientesCriados: { type: 'number' },
        prescritoresCriados: { type: 'number' },
        erros: { type: 'number' }
      }
    }
  })
  async migrarTodosCadastros() {
    return await this.migracaoService.migrarTodosCadastros();
  }

  @Get('cadastros-progresso')
  @ApiOperation({ 
    summary: 'Obter progresso da migração de cadastros em andamento',
    description: 'Retorna o status atual da migração completa de cadastros'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Progresso da migração de cadastros'
  })
  getCadastrosProgresso(): MigracaoCadastrosProgress | null {
    return this.migracaoService.getCadastrosProgress();
  }

  @Post('padronizar-nomes-vendas')
  @ApiOperation({ 
    summary: 'Padronizar nomes nas vendas existentes',
    description: 'Converte todos os nomes (cliente, vendedor, prescritor) para maiúsculas e normaliza espaços. Ex: "Abnil C. L  Neto" -> "ABNIL C. L NETO"'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Padronização executada com sucesso',
    schema: {
      type: 'object',
      properties: {
        vendasAtualizadas: { type: 'number', description: 'Número de vendas atualizadas' },
        erros: { type: 'number', description: 'Número de erros encontrados' }
      }
    }
  })
  async padronizarNomesVendas() {
    return await this.migracaoService.padronizarNomesVendas();
  }

  @Post('remover-campos-texto')
  @ApiOperation({ 
    summary: 'Remover campos texto (cliente, vendedor, prescritor) da tabela vendas',
    description: '⚠️ ATENÇÃO: Esta migration remove permanentemente os campos texto (cliente, vendedor, prescritor) da tabela vendas. Execute apenas após validar que todos os dados foram migrados para os relacionamentos (clienteId, vendedorId, prescritorId). A migration inclui verificações de segurança que bloqueiam a execução se houver vendas sem relacionamento válido. FAÇA BACKUP DO BANCO ANTES!'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Campos texto removidos com sucesso',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        success: { type: 'boolean' }
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Erro: Existem vendas sem relacionamento. Execute primeiro a migração de dados (POST /api/migracao/vendas-relacoes)'
  })
  async removerCamposTexto() {
    return await this.migracaoService.removerCamposTexto();
  }
}

