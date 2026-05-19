import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { PageContextService } from '../../services/page-context.service';
import { HomeShortcutsService } from '../../services/home-shortcuts.service';
import { HomeShortcutDef } from '../../config/home-shortcuts.registry';
import { getNavigationMenuIconHtml } from '../navigation/navigation-lucide-svgs';
import { HomeShortcutsModalComponent } from '../home-shortcuts-modal/home-shortcuts-modal';
import { NavigationService } from '../../services/navigation.service';
import { ErrorModalService } from '../../services/error-modal.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, HomeShortcutsModalComponent],
  templateUrl: './home.html',
  styleUrls: ['./home.css'],
})
export class HomeComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private pageCtx = inject(PageContextService);
  private shortcutsService = inject(HomeShortcutsService);
  private sanitizer = inject(DomSanitizer);
  private navigationService = inject(NavigationService);
  private errors = inject(ErrorModalService);
  private destroy$ = new Subject<void>();

  userName = '';
  userInitial = '';
  shortcuts: HomeShortcutDef[] = [];
  activeShortcutIds: string[] = [];
  showPersonalizeModal = false;

  ngOnInit(): void {
    this.pageCtx.setContext({
      title: 'Início',
      description: 'Acesso rápido às principais funções do sistema.',
    });

    this.auth.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      const nome = user?.nome?.trim() || '';
      this.userName = nome;
      this.userInitial = nome ? nome.charAt(0).toUpperCase() : '';
      this.reloadShortcuts(user?.id);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  iconHtml(key?: string | null): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(getNavigationMenuIconHtml(key));
  }

  openPersonalize(): void {
    this.showPersonalizeModal = true;
  }

  closePersonalize(): void {
    this.showPersonalizeModal = false;
  }

  onShortcutsSaved(ids: string[]): void {
    const userId = this.auth.getCurrentUser()?.id;
    if (!userId) return;

    this.shortcutsService.saveShortcutIds(userId, ids).subscribe({
      next: () => {
        this.reloadShortcuts(userId);
        this.showPersonalizeModal = false;
      },
      error: (e) => {
        const msg =
          e?.error?.message ?? 'Não foi possível salvar os atalhos da tela inicial.';
        this.errors.show(msg, 'Erro');
      },
    });
  }

  onShortcutNavigate(): void {
    this.navigationService.closeOnNavigation();
  }

  private reloadShortcuts(userId: string | undefined): void {
    this.activeShortcutIds = this.shortcutsService.getActiveShortcutIds(userId);
    this.shortcuts = this.shortcutsService.resolveShortcuts(this.activeShortcutIds);
  }
}
