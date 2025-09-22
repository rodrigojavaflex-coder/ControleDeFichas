import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-container">
      <h1>Dashboard</h1>
      <p>Bem-vindo ao sistema de gerenciamento!</p>
      
      <div class="stats-grid">
        <div class="stat-card">
          <h3>Usuários Ativos</h3>
          <p class="stat-number">142</p>
        </div>
        <div class="stat-card">
          <h3>Relatórios</h3>
          <p class="stat-number">28</p>
        </div>
        <div class="stat-card">
          <h3>Configurações</h3>
          <p class="stat-number">5</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      padding: 2rem;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
      margin-top: 2rem;
    }
    
    .stat-card {
      background: white;
      padding: 1.5rem;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      text-align: center;
    }
    
    .stat-card h3 {
      margin: 0 0 0.5rem 0;
      color: #555;
      font-size: 0.9rem;
      font-weight: 500;
    }
    
    .stat-number {
      font-size: 2.5rem;
      font-weight: bold;
      margin: 0;
      color: #667eea;
    }
  `]
})
export class DashboardComponent {}