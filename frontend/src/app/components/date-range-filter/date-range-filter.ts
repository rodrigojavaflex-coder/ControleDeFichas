import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type PresetValue = 'clear' | 'custom' | 'today' | 'yesterday' | 'month' | 'year';

interface PresetOption {
  value: PresetValue;
  label: string;
  description: string;
}

export interface DateRangeValue {
  start: string;
  end: string;
}

@Component({
  selector: 'app-date-range-filter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './date-range-filter.html',
  styleUrls: ['./date-range-filter.css'],
})
export class DateRangeFilterComponent implements OnChanges {
  @Input() label = 'Período';
  @Input() startLabel = 'Início';
  @Input() endLabel = 'Fim';
  @Input() start = '';
  @Input() end = '';
  @Input() description = '';

  @Output() rangeChange = new EventEmitter<DateRangeValue>();

  preset: PresetValue = 'custom';

  presets: PresetOption[] = [
    { value: 'today', label: 'Hoje', description: 'Filtrar data atual' },
    { value: 'yesterday', label: 'Ontem', description: 'Filtrar data de ontem' },
    { value: 'month', label: 'Mês', description: 'Filtrar todo o mês atual' },
    { value: 'year', label: 'Ano', description: 'Filtrar todo o ano atual' },
    { value: 'custom', label: 'Personalizado', description: 'Selecione início e fim manualmente' },
    { value: 'clear', label: 'Limpar', description: 'Limpar datas de início e fim' },
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['start'] || changes['end']) {
      // Não alterar preset automaticamente para evitar reset da seleção
    }
  }

  onPresetChange(value: PresetValue): void {
    this.preset = value;
    if (value === 'clear') {
      this.start = '';
      this.end = '';
      this.preset = 'custom';
      this.emit();
      return;
    }
    const { start, end } = this.getRangeForPreset(value);
    this.start = start;
    this.end = end;
    this.emit();
  }

  onStartChange(value: string): void {
    this.start = value;
    this.preset = 'custom';
    this.emit();
  }

  onEndChange(value: string): void {
    this.end = value;
    this.preset = 'custom';
    this.emit();
  }

  clearRange(): void {
    this.start = '';
    this.end = '';
    this.preset = 'custom';
    this.emit();
  }

  private emit(): void {
    this.rangeChange.emit({ start: this.start, end: this.end });
  }

  private format(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private getRangeForPreset(preset: PresetValue): DateRangeValue {
    const today = new Date();

    if (preset === 'today') {
      const d = this.format(today);
      return { start: d, end: d };
    }

    if (preset === 'yesterday') {
      const yest = new Date(today);
      yest.setDate(yest.getDate() - 1);
      const d = this.format(yest);
      return { start: d, end: d };
    }

    if (preset === 'month') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { start: this.format(first), end: this.format(last) };
    }

    if (preset === 'year') {
      const first = new Date(today.getFullYear(), 0, 1);
      const last = new Date(today.getFullYear(), 11, 31);
      return { start: this.format(first), end: this.format(last) };
    }

    // Custom
    return { start: this.start || '', end: this.end || '' };
  }
}
