import { In, Repository } from 'typeorm';
import { Funcionario } from '../../folha/entities/funcionario.entity';
import { Unidade } from '../../../common/enums/unidade.enum';
import { ProducaoEtapaResumo } from '../entities/producao-etapa-resumo.entity';

export type ProducaoCodigoErpTipo = 'USUARIO' | 'FUNCIONARIO';

export interface ProducaoCodigoCredito {
  tipo: ProducaoCodigoErpTipo;
  codigo: number;
}

export interface MapasFuncionariosProducao {
  porUsuarioErp: Map<number, Funcionario[]>;
  porFuncionarioErp: Map<number, Funcionario[]>;
}

export interface MapaNomesFuncionarioProducao {
  porUsuarioErp: Map<string, string>;
  porFuncionarioErp: Map<string, string>;
}

function codigoInteiroPositivo(valor: number | null | undefined): number | null {
  if (valor == null || !Number.isFinite(valor) || valor <= 0) {
    return null;
  }
  return Math.trunc(valor);
}

export function codigoCreditoSaida(
  row: Pick<ProducaoEtapaResumo, 'usuarioSaida' | 'funcionarioSaida'>,
): ProducaoCodigoCredito | null {
  const usuario = codigoInteiroPositivo(row.usuarioSaida ?? null);
  if (usuario != null) {
    return { tipo: 'USUARIO', codigo: usuario };
  }
  const funcionario = codigoInteiroPositivo(row.funcionarioSaida ?? null);
  if (funcionario != null) {
    return { tipo: 'FUNCIONARIO', codigo: funcionario };
  }
  return null;
}

export function codigoCreditoEntrada(
  row: Pick<
    ProducaoEtapaResumo,
    'usuarioEntrada' | 'funcionarioEntrada' | 'usuarioEntradaFila' | 'emAndamentoFila' | 'dataEntradaFila'
  >,
): ProducaoCodigoCredito | null {
  if (row.emAndamentoFila && row.dataEntradaFila) {
    const usuarioFila = codigoInteiroPositivo(row.usuarioEntradaFila ?? null);
    if (usuarioFila != null) {
      return { tipo: 'USUARIO', codigo: usuarioFila };
    }
    return null;
  }

  const usuario = codigoInteiroPositivo(row.usuarioEntrada ?? null);
  if (usuario != null) {
    return { tipo: 'USUARIO', codigo: usuario };
  }
  const funcionario = codigoInteiroPositivo(row.funcionarioEntrada ?? null);
  if (funcionario != null) {
    return { tipo: 'FUNCIONARIO', codigo: funcionario };
  }
  return null;
}

export function linhaResumoTemCreditoSaida(
  row: Pick<ProducaoEtapaResumo, 'usuarioSaida' | 'funcionarioSaida'>,
): boolean {
  return codigoCreditoSaida(row) != null;
}

export function chaveAlertaSemCadastro(credito: ProducaoCodigoCredito): string {
  return `${credito.tipo}:${credito.codigo}`;
}

export function construirMapasFuncionarios(
  funcionarios: Funcionario[],
): MapasFuncionariosProducao {
  const porUsuarioErp = new Map<number, Funcionario[]>();
  const porFuncionarioErp = new Map<number, Funcionario[]>();

  for (const funcionario of funcionarios) {
    const codUsuario = codigoInteiroPositivo(funcionario.codigoUsuarioErp ?? null);
    if (codUsuario != null) {
      const lista = porUsuarioErp.get(codUsuario) ?? [];
      lista.push(funcionario);
      porUsuarioErp.set(codUsuario, lista);
    }

    const codFuncionario = codigoInteiroPositivo(
      funcionario.codigoFuncionarioErp ?? null,
    );
    if (codFuncionario != null) {
      const lista = porFuncionarioErp.get(codFuncionario) ?? [];
      lista.push(funcionario);
      porFuncionarioErp.set(codFuncionario, lista);
    }
  }

  return { porUsuarioErp, porFuncionarioErp };
}

export function resolverFuncionarioProducao(
  credito: ProducaoCodigoCredito,
  unidadeResumo: Unidade,
  mapas: MapasFuncionariosProducao,
  creditarResumoOutrasUnidades: boolean,
  consultaMultiplasUnidadesResumo: boolean,
): Funcionario | undefined {
  const candidatos =
    credito.tipo === 'USUARIO'
      ? mapas.porUsuarioErp.get(credito.codigo)
      : mapas.porFuncionarioErp.get(credito.codigo);
  if (!candidatos?.length) {
    return undefined;
  }

  const porUnidade = candidatos.find((f) => f.unidade === unidadeResumo);
  if (porUnidade) {
    return porUnidade;
  }

  if (creditarResumoOutrasUnidades || consultaMultiplasUnidadesResumo) {
    if (candidatos.length === 1) {
      return candidatos[0];
    }
  }

  return undefined;
}

export function codigoExibicaoFuncionario(
  funcionario: Funcionario,
): number | null {
  return (
    codigoInteiroPositivo(funcionario.codigoUsuarioErp ?? null) ??
    codigoInteiroPositivo(funcionario.codigoFuncionarioErp ?? null)
  );
}

export function rotuloCodigoCredito(credito: ProducaoCodigoCredito): string {
  return credito.tipo === 'USUARIO'
    ? `Usuário ERP ${credito.codigo}`
    : `Func. ERP ${credito.codigo}`;
}

export async function carregarMapaNomesFuncionarioProducao(
  funcionarioRepo: Repository<Funcionario>,
  unidades: Unidade[],
  codigosUsuario: number[],
  codigosFuncionario: number[],
): Promise<MapaNomesFuncionarioProducao> {
  const porUsuarioErp = new Map<string, string>();
  const porFuncionarioErp = new Map<string, string>();

  const usuarios = [...new Set(codigosUsuario.filter((c) => c > 0))];
  const funcionarios = [...new Set(codigosFuncionario.filter((c) => c > 0))];

  if (usuarios.length === 0 && funcionarios.length === 0) {
    return { porUsuarioErp, porFuncionarioErp };
  }

  const where: Array<Record<string, unknown>> = [];
  if (usuarios.length > 0) {
    where.push({
      unidade: In(unidades),
      codigoUsuarioErp: In(usuarios),
    });
  }
  if (funcionarios.length > 0) {
    where.push({
      unidade: In(unidades),
      codigoFuncionarioErp: In(funcionarios),
    });
  }

  const rows = await funcionarioRepo.find({
    where,
  });

  for (const f of rows) {
    const nome = f.nome?.trim() || 'Nome não informado';
    const codUsuario = codigoInteiroPositivo(f.codigoUsuarioErp ?? null);
    if (codUsuario != null) {
      porUsuarioErp.set(`${f.unidade}:${codUsuario}`, nome);
    }
    const codFuncionario = codigoInteiroPositivo(f.codigoFuncionarioErp ?? null);
    if (codFuncionario != null) {
      porFuncionarioErp.set(`${f.unidade}:${codFuncionario}`, nome);
    }
  }

  return { porUsuarioErp, porFuncionarioErp };
}

export function nomeFuncionarioProducao(
  mapa: MapaNomesFuncionarioProducao,
  unidade: Unidade,
  credito: ProducaoCodigoCredito | null,
): string | null {
  if (!credito) {
    return null;
  }
  if (credito.tipo === 'USUARIO') {
    return (
      mapa.porUsuarioErp.get(`${unidade}:${credito.codigo}`) ??
      rotuloCodigoCredito(credito)
    );
  }
  return (
    mapa.porFuncionarioErp.get(`${unidade}:${credito.codigo}`) ??
    rotuloCodigoCredito(credito)
  );
}
