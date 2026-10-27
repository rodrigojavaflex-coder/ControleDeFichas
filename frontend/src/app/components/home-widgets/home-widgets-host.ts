import { Component, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { HOME_WIDGETS, HomeWidgetId } from '../../config/home-widgets.registry';
import { HomeWidgetComercialMeuComponent } from './home-widget-comercial-meu';
import { HomeWidgetComercialUnidadeComponent } from './home-widget-comercial-unidade';

@Component({
  selector: 'app-home-widgets-host',
  standalone: true,
  imports: [
    CommonModule,
    HomeWidgetComercialMeuComponent,
    HomeWidgetComercialUnidadeComponent,
  ],
  templateUrl: './home-widgets-host.html',
  styleUrls: ['./home-widgets-host.css'],
  encapsulation: ViewEncapsulation.None,
})
export class HomeWidgetsHostComponent {
  private auth = inject(AuthService);

  get widgetsVisiveis() {
    return HOME_WIDGETS.filter((w) => this.auth.hasPermission(w.permission)).sort(
      (a, b) => a.order - b.order,
    );
  }

  get temWidgets(): boolean {
    return this.widgetsVisiveis.length > 0;
  }

  mostrar(id: HomeWidgetId): boolean {
    return this.widgetsVisiveis.some((w) => w.id === id);
  }
}
