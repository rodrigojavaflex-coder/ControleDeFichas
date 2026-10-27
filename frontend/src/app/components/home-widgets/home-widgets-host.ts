import {
  Component,
  EventEmitter,
  Output,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { HOME_WIDGETS, HomeWidgetId } from '../../config/home-widgets.registry';
import { HomeWidgetComercialMeuComponent } from './home-widget-comercial-meu';
import { HomeWidgetComercialUnidadeComponent } from './home-widget-comercial-unidade';

export type HomeWidgetsProcessamentoEstado = {
  ativo: boolean;
  titulo: string;
  subtitulo: string;
};

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
  private carregandoPorWidget: Partial<Record<HomeWidgetId, boolean>> = {};
  private jaCarregouUmaVez = false;

  @Output() processamentoChange =
    new EventEmitter<HomeWidgetsProcessamentoEstado>();

  get widgetsVisiveis() {
    return HOME_WIDGETS.filter((w) => this.auth.hasPermission(w.permission)).sort(
      (a, b) => a.order - b.order,
    );
  }

  get temWidgets(): boolean {
    return this.widgetsVisiveis.length > 0;
  }

  get bloqueando(): boolean {
    return Object.values(this.carregandoPorWidget).some((v) => v === true);
  }

  mostrar(id: HomeWidgetId): boolean {
    return this.widgetsVisiveis.some((w) => w.id === id);
  }

  onCarregandoChange(id: HomeWidgetId, carregando: boolean): void {
    this.carregandoPorWidget = {
      ...this.carregandoPorWidget,
      [id]: carregando,
    };
    const ativo = this.bloqueando;
    if (!ativo && Object.keys(this.carregandoPorWidget).length > 0) {
      this.jaCarregouUmaVez = true;
    }
    this.processamentoChange.emit({
      ativo,
      titulo: this.jaCarregouUmaVez
        ? 'Atualizando indicadores…'
        : 'Carregando indicadores…',
      subtitulo: 'Aguarde um momento. A tela ficará disponível ao concluir.',
    });
  }
}
