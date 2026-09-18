import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

const FIELD_LABELS: Record<string, string> = {
  idvenda: 'ID da venda',
  idVenda: 'ID da venda',
  protocolo: 'Protocolo',
  valorProcessado: 'Valor processado',
  valorBaixa: 'Valor da baixa',
  valor: 'Valor',
  falhas: 'Falhas',
  sucesso: 'Sucesso',
  entidade: 'Entidade',
  entidadeId: 'ID da entidade',
  enderecoIp: 'IP',
  descricao: 'Descrição',
  nome: 'Nome',
  email: 'E-mail',
  cpf: 'CPF',
  unidade: 'Unidade',
  status: 'Status',
  mensagem: 'Mensagem',
  erro: 'Erro',
  error: 'Erro',
};

const IGNORED_KEYS = new Set([
  'senha',
  'password',
  'token',
  'hash',
  'refreshToken',
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(?:[T ][\d:.+-Z]+)?$/;

@Component({
  selector: 'app-auditoria-dados-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './auditoria-dados-view.html',
  styleUrls: ['./auditoria-dados-view.css'],
})
export class AuditoriaDadosViewComponent {
  @Input({ required: true }) data: unknown;
  @Input() compact = false;
  @Input() depth = 0;

  private readonly maxDepth = 6;

  get tooDeep(): boolean {
    return this.depth > this.maxDepth;
  }

  get isEmpty(): boolean {
    if (this.data === null || this.data === undefined) {
      return true;
    }
    if (Array.isArray(this.data)) {
      return this.data.length === 0;
    }
    if (this.isPlainObject(this.data)) {
      return this.objectEntries.length === 0;
    }
    return false;
  }

  get isArray(): boolean {
    return Array.isArray(this.data);
  }

  get asArray(): unknown[] {
    return Array.isArray(this.data) ? this.data : [];
  }

  get isArrayOfObjects(): boolean {
    const arr = this.asArray;
    return arr.length > 0 && arr.every((item) => this.isPlainObject(item));
  }

  get tableColumns(): string[] {
    const keys = new Set<string>();
    for (const row of this.asArray) {
      if (!this.isPlainObject(row)) {
        continue;
      }
      for (const key of Object.keys(row)) {
        if (!IGNORED_KEYS.has(key)) {
          keys.add(key);
        }
      }
    }
    return [...keys].sort((a, b) => this.columnWeight(a) - this.columnWeight(b));
  }

  get primitiveEntries(): Array<{ key: string; value: unknown }> {
    return this.objectEntries.filter((e) => !this.isComplex(e.value));
  }

  get complexEntries(): Array<{ key: string; value: unknown }> {
    return this.objectEntries.filter((e) => this.isComplex(e.value));
  }

  get objectEntries(): Array<{ key: string; value: unknown }> {
    if (!this.isPlainObject(this.data)) {
      return [];
    }
    return Object.entries(this.data)
      .filter(([key]) => !IGNORED_KEYS.has(key))
      .map(([key, value]) => ({ key, value }));
  }

  get rawJson(): string {
    try {
      return JSON.stringify(this.data, null, 2);
    } catch {
      return String(this.data);
    }
  }

  isPlainObject(value: unknown): value is Record<string, unknown> {
    return (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    );
  }

  isComplex(value: unknown): boolean {
    return Array.isArray(value) || this.isPlainObject(value);
  }

  isArrayValue(value: unknown): boolean {
    return Array.isArray(value);
  }

  arrayLength(value: unknown): number {
    return Array.isArray(value) ? value.length : 0;
  }

  labelFor(key: string): string {
    if (FIELD_LABELS[key]) {
      return FIELD_LABELS[key];
    }
    return key
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/^./, (ch) => ch.toUpperCase())
      .trim();
  }

  formatPrimitive(key: string, value: unknown): string {
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    if (typeof value === 'boolean') {
      return value ? 'Sim' : 'Não';
    }
    if (value instanceof Date) {
      return value.toLocaleString('pt-BR');
    }
    if (typeof value === 'number') {
      return this.isMoneyKey(key)
        ? this.formatMoney(value)
        : value.toLocaleString('pt-BR');
    }
    if (typeof value === 'string') {
      if (this.isMoneyKey(key) && value.trim() !== '' && !Number.isNaN(Number(value))) {
        return this.formatMoney(Number(value));
      }
      if (ISO_DATE_RE.test(value) && !UUID_RE.test(value)) {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
          return value.length <= 10
            ? parsed.toLocaleDateString('pt-BR')
            : parsed.toLocaleString('pt-BR');
        }
      }
      if (UUID_RE.test(value)) {
        return `${value.slice(0, 8)}…`;
      }
      return value;
    }
    return String(value);
  }

  titleFor(value: unknown): string {
    if (typeof value === 'string' && UUID_RE.test(value)) {
      return value;
    }
    return '';
  }

  cellValue(row: unknown, key: string): unknown {
    if (!this.isPlainObject(row)) {
      return undefined;
    }
    return row[key];
  }

  nestedKeyClass(key: string): string {
    const normalized = key.toLowerCase();
    if (normalized === 'sucesso' || normalized === 'success') {
      return 'is-success';
    }
    if (normalized === 'falhas' || normalized === 'erros' || normalized === 'error') {
      return 'is-danger';
    }
    return '';
  }

  private isMoneyKey(key: string): boolean {
    return /valor|preco|preço|vlr|amount|price/i.test(key);
  }

  private formatMoney(value: number): string {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }

  private columnWeight(key: string): number {
    const order = ['protocolo', 'nome', 'descricao', 'status', 'mensagem'];
    const idx = order.indexOf(key);
    if (idx >= 0) {
      return idx;
    }
    if (this.isMoneyKey(key)) {
      return 50;
    }
    if (/^id/i.test(key)) {
      return 80;
    }
    return 20;
  }
}
