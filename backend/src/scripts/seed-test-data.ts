import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { VendasService } from '../modules/vendas/vendas.service';
import { BaixasService } from '../modules/baixas/baixas.service';
import { TipoDaBaixa } from '../common/enums/baixa.enum';
import { VendaStatus, VendaOrigem } from '../common/enums/venda.enum';
import { Unidade } from '../common/enums/unidade.enum';

async function seedTestData() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const vendasService = app.get(VendasService);
  const baixasService = app.get(BaixasService);

  try {
    console.log('🌱 Iniciando seed de dados de teste...');

    // Criar uma venda de teste
    const venda = await vendasService.create({
      protocolo: 'TEST-001',
      dataVenda: '2025-10-28',
      cliente: 'Cliente Teste',
      origem: VendaOrigem.GOIANIA,
      vendedor: 'Vendedor Teste',
      valorCompra: 1400.00,
      valorCliente: 1500.00,
      status: VendaStatus.REGISTRADO,
      unidade: Unidade.INHUMAS,
      observacao: 'Venda de teste para verificar cálculos'
    });

    console.log('✅ Venda criada:', venda.id);

    // Criar algumas baixas para esta venda
    const baixa1 = await baixasService.create({
      idvenda: venda.id,
      tipoDaBaixa: TipoDaBaixa.DINHEIRO,
      valorBaixa: 500.00,
      dataBaixa: '2025-10-28',
      observacao: 'Primeira parcela'
    });

    const baixa2 = await baixasService.create({
      idvenda: venda.id,
      tipoDaBaixa: TipoDaBaixa.CARTAO_PIX,
      valorBaixa: 300.00,
      dataBaixa: '2025-10-28',
      observacao: 'Segunda parcela'
    });

    console.log('✅ Baixas criadas:', baixa1.id, baixa2.id);

    // Verificar os cálculos
    const baixas = await baixasService.findAll({ idvenda: venda.id });
    const totalBaixas = baixas.data.reduce((total, baixa) => total + baixa.valorBaixa, 0);
    const valorRestante = venda.valorCliente - totalBaixas;

    console.log('📊 Verificação dos cálculos:');
    console.log('Valor Cliente:', venda.valorCliente);
    console.log('Total Baixado:', totalBaixas);
    console.log('Valor Restante:', valorRestante);

    console.log('🎉 Seed concluído com sucesso!');
  } catch (error) {
    console.error('❌ Erro durante seed:', error);
  } finally {
    await app.close();
  }
}

seedTestData();