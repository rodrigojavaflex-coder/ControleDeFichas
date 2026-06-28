import { Component, EventEmitter, Input, Output } from '@angular/core';
import { OrcamentoMedicoOpcaoFiltro } from '../../models/orcamento.model';
import { MedicoFilterPickerComponent } from '../medico-filter-picker/medico-filter-picker';

@Component({
  selector: 'app-orcamentos-rejeitados-medico-filtro',
  standalone: true,
  imports: [MedicoFilterPickerComponent],
  template: `
    <app-medico-filter-picker
      [opcoes]="opcoes"
      [loading]="loading"
      [selectedMedicos]="selectedMedicos"
      (selectedMedicosChange)="selectedMedicosChange.emit($event)" />
  `,
})
export class OrcamentosRejeitadosMedicoFiltroComponent {
  @Input() opcoes: OrcamentoMedicoOpcaoFiltro[] = [];
  @Input() loading = false;
  @Input() selectedMedicos = new Set<string>();

  @Output() selectedMedicosChange = new EventEmitter<Set<string>>();
}
