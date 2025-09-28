import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../services/user.service';
import { Usuario } from '../../models/usuario.model';

interface UserPrintData {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
  permissoes: Array<{
    group: string;
    permissions: string[];
  }>;
  totalPermissions: number;
  printedAt: string;
}

@Component({
  selector: 'app-user-print',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="print-container" *ngIf="userPrintData">
      <div class="print-header">
        <h1>Relatório de Usuário</h1>
        <div class="print-date">Impresso em: {{ formatDate(userPrintData.printedAt) }}</div>
      </div>

      <div class="user-info-section">
        <h2>Informações do Usuário</h2>
        <div class="info-grid">
          <div class="info-item">
            <label>ID:</label>
            <span>{{ userPrintData.id }}</span>
          </div>
          <div class="info-item">
            <label>Nome:</label>
            <span>{{ userPrintData.nome }}</span>
          </div>
          <div class="info-item">
            <label>Email:</label>
            <span>{{ userPrintData.email }}</span>
          </div>
          <div class="info-item">
            <label>Status:</label>
            <span [class]="userPrintData.ativo ? 'status-active' : 'status-inactive'">
              {{ userPrintData.ativo ? 'Ativo' : 'Inativo' }}
            </span>
          </div>
          <div class="info-item">
            <label>Criado em:</label>
            <span>{{ formatDate(userPrintData.criadoEm) }}</span>
          </div>
          <div class="info-item">
            <label>Atualizado em:</label>
            <span>{{ formatDate(userPrintData.atualizadoEm) }}</span>
          </div>
        </div>
      </div>

      <div class="permissions-section">
        <h2>Permissões ({{ userPrintData.totalPermissions }} total)</h2>
        <div class="permissions-groups" *ngIf="userPrintData.permissoes.length > 0; else noPermissions">
          <div class="permission-group" *ngFor="let group of userPrintData.permissoes">
            <h3>{{ group.group }}</h3>
            <ul>
              <li *ngFor="let permission of group.permissions">{{ permission }}</li>
            </ul>
          </div>
        </div>
        <ng-template #noPermissions>
          <p class="no-permissions">Este usuário não possui permissões atribuídas.</p>
        </ng-template>
      </div>

      <div class="print-footer">
        <div class="footer-line"></div>
        <p>Este relatório foi gerado automaticamente pelo Sistema de Gestão de Usuários</p>
      </div>
    </div>
  `,
  styleUrls: ['./user-print.css']
})
export class UserPrintComponent implements OnInit {
  @Input() userId!: string;
  userPrintData: UserPrintData | null = null;
  loading = false;
  error: string | null = null;

  constructor(private userService: UserService) {}

  ngOnInit() {
    if (this.userId) {
      this.loadUserPrintData();
    }
  }

  private loadUserPrintData() {
    this.loading = true;
    this.error = null;

    this.userService.getUserPrintData(this.userId).subscribe({
      next: (data) => {
        this.userPrintData = data;
        this.loading = false;
        
        // Aguardar um pouco para o DOM atualizar e então imprimir
        setTimeout(() => {
          this.print();
        }, 100);
      },
      error: (err) => {
        console.error('Erro ao carregar dados para impressão:', err);
        this.error = 'Erro ao carregar dados do usuário';
        this.loading = false;
      }
    });
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  print() {
    window.print();
  }
}