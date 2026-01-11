import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PrescritoresService } from '../../services/prescritores.service';
import { AuthService } from '../../services/auth.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { Prescritor, CreatePrescritorDto } from '../../models/prescritor.model';
import { Permission } from '../../models/usuario.model';

@Component({
  selector: 'app-prescritor-quick-create-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './prescritor-quick-create-modal.html',
  styleUrls: ['./prescritor-quick-create-modal.css']
})
export class PrescritorQuickCreateModalComponent implements OnInit {
  @Input() initialNome: string = '';
  @Input() showModal: boolean = true;
  @Output() created = new EventEmitter<Prescritor>();
  @Output() cancelled = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private prescritoresService = inject(PrescritoresService);
  private authService = inject(AuthService);
  private errorModalService = inject(ErrorModalService);

  quickForm!: FormGroup;
  isLoading = false;

  ufs = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

  ngOnInit(): void {
    // Criar form com todos os campos
    this.quickForm = this.fb.group({
      nome: [this.initialNome?.toUpperCase() || '', [Validators.required, Validators.maxLength(500)]],
      numeroCRM: [''],
      UFCRM: ['']
    });
  }

  onNomeInput(event: any): void {
    const value = event.target.value;
    const upperValue = value.toUpperCase();
    // Atualizar o valor no form control
    this.quickForm.get('nome')?.setValue(upperValue, { emitEvent: false });
    // Atualizar o valor no input
    event.target.value = upperValue;
  }

  onSubmit(): void {
    if (this.quickForm.valid) {
      this.isLoading = true;

      // Desabilitar campos durante o submit
      this.quickForm.disable();

      // Usar getRawValue() para incluir valores de campos desabilitados
      const formValue = this.quickForm.getRawValue();

      const createDto: CreatePrescritorDto = {
        nome: formValue.nome.trim().toUpperCase(),
        numeroCRM: formValue.numeroCRM ? Number(formValue.numeroCRM) : undefined,
        UFCRM: formValue.UFCRM?.trim().toUpperCase() || undefined
      };

      this.prescritoresService.create(createDto).subscribe({
        next: (prescritor) => {
          this.isLoading = false;
          this.quickForm.enable();
          this.created.emit(prescritor);
        },
        error: (error) => {
          this.isLoading = false;
          this.quickForm.enable();
          const message = error.error?.message || 'Erro ao criar prescritor';
          this.errorModalService.show(message, 'Erro');
        }
      });
    } else {
      this.markFormGroupTouched();
    }
  }

  closeModal(): void {
    if (!this.isLoading) {
      this.cancelled.emit();
    }
  }

  hasFieldError(fieldName: string): boolean {
    const field = this.quickForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  getFieldError(fieldName: string): string {
    const field = this.quickForm.get(fieldName);
    if (!field || !field.errors || !field.touched) {
      return '';
    }

    if (field.errors['required']) {
      return 'Nome é obrigatório';
    }
    if (field.errors['maxlength']) {
      return `Nome não pode ter mais que 500 caracteres`;
    }

    return 'Campo inválido';
  }

  private markFormGroupTouched(): void {
    Object.keys(this.quickForm.controls).forEach(key => {
      this.quickForm.get(key)?.markAsTouched();
    });
  }
}
