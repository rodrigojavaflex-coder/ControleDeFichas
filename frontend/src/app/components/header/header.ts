import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService, NavigationService } from '../../services/index';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class HeaderComponent {
  private authService = inject(AuthService);
  private navigationService = inject(NavigationService);
  private destroy$ = new Subject<void>();
  
  currentUser$ = this.authService.currentUser$;

  ngOnInit() {
    // Observar mudanças nos estados do menu se necessário
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleMenu() {
    this.navigationService.toggleMobile();
  }

  logout() {
    this.authService.logout();
  }
}
