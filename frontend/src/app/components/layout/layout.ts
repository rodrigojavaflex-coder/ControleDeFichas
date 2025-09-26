import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { NavigationComponent } from '../navigation/navigation';
import { HeaderComponent } from '../header/header'; // Importar HeaderComponent
import { AuthService, NavigationService } from '../../services/index';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavigationComponent, HeaderComponent], // Adicionar HeaderComponent
  templateUrl: './layout.html',
  styleUrl: './layout.css'
})
export class LayoutComponent implements OnInit {
  private authService = inject(AuthService);
  private navigationService = inject(NavigationService);
  
  isAuthenticated = false;
  isMenuOpen = true;
  isDesktop = window.innerWidth > 768;

  ngOnInit() {
    this.authService.isAuthenticated$.subscribe(
      authenticated => this.isAuthenticated = authenticated
    );
    
    // Para desktop, usar o estado isMobileOpen para controlar visibilidade
    // Para mobile, também usar isMobileOpen
    this.navigationService.isMobileOpen$.subscribe(
      isOpen => {
        this.isMenuOpen = isOpen;
        console.log('Menu visibility changed:', isOpen); // Debug
      }
    );

    // Detectar mudanças de tamanho da tela
    window.addEventListener('resize', () => {
      this.isDesktop = window.innerWidth > 768;
    });
  }

  closeMenu() {
    this.navigationService.closeMobile();
  }
}