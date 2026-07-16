import { BadRequestException } from '@nestjs/common';

export interface PainelContratoRepresentantesConfig {
  cdcon: number;
  cdfun: number[];
  raw: string;
}

const PAINEL_CONFIG_REGEX = /^(\d+)\s+([\d,\s]+)$/;

export function parsePainelContratoRepresentantes(
  value: string | null | undefined,
): PainelContratoRepresentantesConfig | null {
  if (!value?.trim()) {
    return null;
  }

  const match = value.trim().match(PAINEL_CONFIG_REGEX);
  if (!match) {
    throw new BadRequestException(
      'painelContratoRepresentantes deve estar no formato "9999 1,2" (contrato + representantes)',
    );
  }

  const cdcon = Number(match[1]);
  const cdfun = match[2]
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => !isNaN(item) && item > 0);

  if (!cdcon || !cdfun.length) {
    throw new BadRequestException(
      'painelContratoRepresentantes deve conter contrato e ao menos um representante válido',
    );
  }

  return {
    cdcon,
    cdfun,
    raw: value.trim(),
  };
}

export function buildPainelChave(
  crm: string,
  uf: string,
  cdcon: number,
  cdfun: number,
): string {
  return `${crm}|${uf}|${cdcon}|${cdfun}`;
}
