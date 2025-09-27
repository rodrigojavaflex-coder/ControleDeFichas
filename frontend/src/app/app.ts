import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LayoutComponent } from './components/layout/layout';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [LayoutComponent],
  template: '<app-layout></app-layout>',
  styleUrl: './app.css'
})
export class App implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  async ngOnInit() {
    // Verificar se há token e se ainda é válido na inicialização
    const currentPath = this.router.url;
    const isLoginPage = currentPath.includes('/login');
    
    if (!isLoginPage && this.authService.isAuthenticated()) {
      // Verificar se token ainda é válido
      const isValid = await this.authService.validateToken();
      
      if (!isValid) {
        console.log('Token expirado detectado na inicialização, redirecionando para login');
        this.router.navigate(['/login']);
      }
    }
  }
}
