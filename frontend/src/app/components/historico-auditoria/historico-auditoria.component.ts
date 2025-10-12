import { Component, Input, OnInit, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuditoriaService } from '../../services/auditoria.service';
import { Auditoria } from '../../models/auditoria.model';

export interface FieldChange {
  field: string;
  fieldLabel: string;
  oldValue: any;
  newValue: any;
  type: 'added' | 'modified' | 'removed';
}

export interface HistoricoAuditoriaItem extends Auditoria {
  changes?: FieldChange[];
}

@Component({
  selector: 'app-historico-auditoria',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="historico-auditoria-modal" *ngIf="showModal">
      <div class="historico-auditoria-overlay" (click)="closeModal()"></div>
      <div class="historico-auditoria-content">
        <div class="historico-auditoria-header">
          <h3>Histórico de Alterações</h3>
          <div class="header-actions">
            <button type="button" class="print-btn" (click)="printReport()" title="Imprimir Relatório">
              🖨️ Imprimir
            </button>
            <button type="button" class="close-btn" (click)="closeModal()">&times;</button>
          </div>
        </div>

        <div class="historico-auditoria-body">
          @if (loading) {
            <div class="loading">Carregando histórico...</div>
          }

          @if (!loading && auditItems.length === 0) {
            <div class="no-history">Nenhum histórico encontrado para este registro</div>
          }

          @for (item of auditItems; track item.id) {
            <div class="historico-item" [class]="'historico-' + item.acao.toLowerCase()">
              <div class="historico-header">
                <span class="historico-action">{{ getActionLabel(item.acao) }}</span>
                <span class="historico-info">
                  por <span class="historico-user-name">{{ item.usuario?.nome || 'Sistema' }}</span>
                  em {{ formatDate(item.criadoEm) }}
                  @if (item.enderecoIp) {
                    ({{ item.enderecoIp }})
                  }
                </span>
              </div>

              <div class="historico-details">
                @if (item.changes && item.changes.length > 0) {
                  <div class="historico-changes">
                    <h4>Alterações realizadas:</h4>
                    @for (change of item.changes; track change.field) {
                      <div class="field-change" [class]="'change-' + change.type">
                        <span class="field-label">{{ change.fieldLabel }}:</span>

                        @switch (change.type) {
                          @case ('added') {
                            <span class="change-value added">
                              <strong>{{ formatValue(change.newValue) }}</strong>
                            </span>
                          }
                          @case ('removed') {
                            <span class="change-value removed">
                              <strong>{{ formatValue(change.oldValue) }}</strong>
                            </span>
                          }
                          @case ('modified') {
                            <span class="change-value modified">
                              <span class="old-value">{{ formatValue(change.oldValue) }}</span>
                              <span class="arrow">→</span>
                              <span class="new-value">{{ formatValue(change.newValue) }}</span>
                            </span>
                          }
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./historico-auditoria.component.css']
})
export class HistoricoAuditoriaComponent implements OnInit, OnChanges {
  @Input() entidade!: string;
  @Input() entidadeId!: string;
  @Input() fieldLabels: Record<string, string> = {};
  @Input() showModal = false;
  @Output() modalClosed = new EventEmitter<void>();

  auditItems: HistoricoAuditoriaItem[] = [];
  loading = false;

  constructor(private auditoriaService: AuditoriaService) {}

  ngOnInit() {
    if (this.showModal) {
      this.loadAuditHistory();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['showModal'] && changes['showModal'].currentValue && this.entidade && this.entidadeId) {
      this.loadAuditHistory();
    }
  }

  async loadAuditHistory() {
    if (!this.entidade || !this.entidadeId) return;

    this.loading = true;
    try {
      const items = await this.auditoriaService.getHistoryByEntity(this.entidade, this.entidadeId);
      this.auditItems = items.map(item => ({
        ...item,
        changes: this.calculateChanges(item)
      }));
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      this.auditItems = [];
    } finally {
      this.loading = false;
    }
  }

  private calculateChanges(item: HistoricoAuditoriaItem): FieldChange[] {
    if (!item.dadosAnteriores && !item.dadosNovos) return [];

    const changes: FieldChange[] = [];
    const oldData = item.dadosAnteriores || {};
    const newData = item.dadosNovos || {};

    // Campos que foram adicionados ou modificados
    Object.keys(newData).forEach(field => {
      if (this.shouldIgnoreField(field)) return;

      const oldValue = oldData[field];
      const newValue = newData[field];

      if (oldValue === undefined) {
        // Campo adicionado
        changes.push({
          field,
          fieldLabel: this.fieldLabels[field] || this.formatFieldName(field),
          oldValue: null,
          newValue,
          type: 'added'
        });
      } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        // Campo modificado
        changes.push({
          field,
          fieldLabel: this.fieldLabels[field] || this.formatFieldName(field),
          oldValue,
          newValue,
          type: 'modified'
        });
      }
    });

    // Campos que foram removidos
    Object.keys(oldData).forEach(field => {
      if (this.shouldIgnoreField(field)) return;

      if (newData[field] === undefined) {
        changes.push({
          field,
          fieldLabel: this.fieldLabels[field] || this.formatFieldName(field),
          oldValue: oldData[field],
          newValue: null,
          type: 'removed'
        });
      }
    });

    return changes;
  }

  private shouldIgnoreField(field: string): boolean {
    // Ignorar campos de controle interno, timestamps automáticos e campos de sistema
    const ignoredFields = [
      'id',
      'createdAt',
      'updatedAt',
      'deletedAt',
      'usuarioId',
      'dataCriacao',
      'dataAtualizacao',
      'dataModificacao',
      'dataUltimaModificacao',
      'ultimaModificacao',
      'modificadoEm',
      'criadoEm',
      'atualizadoEm',
      'created_at',
      'updated_at',
      'deleted_at',
      'modified_at',
      'createdAt',
      'updatedAt',
      'deletedAt',
      'modifiedAt',
      'timestamp',
      'timestamps'
    ];
    return ignoredFields.includes(field);
  }

  private formatFieldName(field: string): string {
    // Converter camelCase para Title Case
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  getActionLabel(action: string): string {
    const labels: Record<string, string> = {
      'CREATE': 'Criado',
      'UPDATE': 'Atualizado',
      'DELETE': 'Excluído',
      'READ': 'Consultado',
      'create': 'Criado',
      'update': 'Atualizado',
      'delete': 'Excluído',
      'read': 'Consultado'
    };
    return labels[action] || action;
  }

  formatDate(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleString('pt-BR');
  }

  formatValue(value: any): string {
    if (value === null || value === undefined) return 'Vazio';
    if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  closeModal() {
    this.modalClosed.emit();
  }

  printReport() {
    // Criar uma nova janela para impressão
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;

    // Gerar HTML do relatório
    const reportHTML = this.generateReportHTML();

    // Escrever o HTML na nova janela
    printWindow.document.write(reportHTML);
    printWindow.document.close();

    // Aguardar o carregamento e imprimir
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  }

  private generateReportHTML(): string {
    const entityName = this.getEntityDisplayName();
    const currentDate = new Date().toLocaleString('pt-BR');

    let html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Relatório de Auditoria - ${entityName}</title>
        <style>
          ${this.getPrintStyles()}
        </style>
      </head>
      <body>
        <div class="report-header">
          <h1>Relatório de Auditoria</h1>
          <h2>${entityName} - ID: ${this.entidadeId}</h2>
          <p class="report-date">Gerado em: ${currentDate}</p>
        </div>

        <div class="report-content">
    `;

    if (this.auditItems.length === 0) {
      html += '<p class="no-data">Nenhum histórico encontrado para este registro.</p>';
    } else {
      this.auditItems.forEach((item, index) => {
        html += `
          <div class="audit-item">
            <div class="audit-header">
              <h3>${index + 1}. ${this.getActionLabel(item.acao)}</h3>
              <div class="audit-info">
                <span><strong>Usuário:</strong> ${item.usuario?.nome || 'Sistema'}</span>
                <span><strong>Data:</strong> ${this.formatDate(item.criadoEm)}</span>
                ${item.enderecoIp ? `<span><strong>IP:</strong> ${item.enderecoIp}</span>` : ''}
              </div>
            </div>

            ${item.changes && item.changes.length > 0 ? `
              <div class="audit-changes">
                <h4>Alterações:</h4>
                <table class="changes-table">
                  <thead>
                    <tr>
                      <th>Campo</th>
                      <th>Anterior</th>
                      <th>Novo</th>
                      <th>Tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${item.changes.map(change => `
                      <tr class="change-${change.type}">
                        <td class="field-name">${change.fieldLabel}</td>
                        <td class="old-value">${this.formatValue(change.oldValue)}</td>
                        <td class="new-value">${this.formatValue(change.newValue)}</td>
                        <td class="change-type">${this.getChangeTypeLabel(change.type)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : ''}
          </div>
        `;
      });
    }

    html += `
        </div>
      </body>
      </html>
    `;

    return html;
  }

  private getEntityDisplayName(): string {
    const entityNames: Record<string, string> = {
      'usuarios': 'Usuário',
      'fichas_tecnicas': 'Ficha Técnica',
      'certificados': 'Certificado',
      'laudos': 'Laudo',
      'configuracao': 'Configuração',
      'perfil': 'Perfil'
    };
    return entityNames[this.entidade] || this.entidade.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  private getChangeTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'added': 'Adicionado',
      'modified': 'Modificado',
      'removed': 'Removido'
    };
    return labels[type] || type;
  }

  private getPrintStyles(): string {
    return `
      body {
        font-family: 'Arial', sans-serif;
        line-height: 1.3;
        color: #333;
        margin: 0;
        padding: 10px;
        background: white;
        font-size: 11px;
      }

      .report-header {
        text-align: center;
        border-bottom: 1px solid #333;
        padding-bottom: 8px;
        margin-bottom: 15px;
      }

      .report-header h1 {
        color: #333;
        margin: 0 0 5px 0;
        font-size: 16px;
      }

      .report-header h2 {
        color: #666;
        margin: 0 0 5px 0;
        font-size: 12px;
      }

      .report-date {
        color: #999;
        font-size: 10px;
        margin: 0;
      }

      .audit-item {
        border: 1px solid #ddd;
        border-radius: 4px;
        margin-bottom: 8px;
        page-break-inside: avoid;
      }

      .audit-header {
        background: #f5f5f5;
        padding: 6px 8px;
        border-radius: 4px 4px 0 0;
      }

      .audit-header h3 {
        margin: 0 0 4px 0;
        color: #333;
        font-size: 12px;
      }

      .audit-info {
        display: flex;
        gap: 12px;
        font-size: 10px;
        flex-wrap: wrap;
      }

      .audit-info span {
        margin: 0;
      }

      .audit-changes {
        padding: 6px 8px;
      }

      .audit-changes h4 {
        margin: 0 0 6px 0;
        color: #333;
        font-size: 11px;
      }

      .changes-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 9px;
      }

      .changes-table th,
      .changes-table td {
        border: 1px solid #ddd;
        padding: 3px 4px;
        text-align: left;
      }

      .changes-table th {
        background: #f5f5f5;
        font-weight: bold;
        font-size: 9px;
      }

      .change-added {
        background: #e8f5e8;
      }

      .change-modified {
        background: #fff3cd;
      }

      .change-removed {
        background: #f8d7da;
      }

      .no-data {
        text-align: center;
        font-style: italic;
        color: #666;
        padding: 20px;
        font-size: 11px;
      }

      @media print {
        body {
          padding: 5px;
        }

        .audit-item {
          break-inside: avoid;
        }
      }
    `;
  }
}