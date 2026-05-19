import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HomeShortcutsService } from '../../services/home-shortcuts.service';
import {
  HOME_SHORTCUTS_MAX,
  HomeShortcutDef,
} from '../../config/home-shortcuts.registry';
import { getNavigationMenuIconHtml } from '../navigation/navigation-lucide-svgs';
import { ConfirmationModalComponent } from '../confirmation-modal/confirmation-modal';

interface ShortcutGroup {
  category: string;
  items: HomeShortcutDef[];
}

@Component({
  selector: 'app-home-shortcuts-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmationModalComponent],
  templateUrl: './home-shortcuts-modal.html',
  styleUrls: ['./home-shortcuts-modal.css'],
})
export class HomeShortcutsModalComponent implements OnChanges {
  private shortcutsService = inject(HomeShortcutsService);
  private sanitizer = inject(DomSanitizer);

  @Input() visible = false;
  @Input() initialIds: string[] = [];
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<string[]>();

  readonly maxShortcuts = HOME_SHORTCUTS_MAX;

  searchTerm = '';
  draftSelectedIds: string[] = [];
  draggingIndex: number | null = null;
  showDiscardConfirm = false;

  private snapshotIds: string[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.openDraft();
    }
  }

  get previewShortcuts(): HomeShortcutDef[] {
    return this.shortcutsService.resolveShortcuts(this.draftSelectedIds);
  }

  get selectedCount(): number {
    return this.draftSelectedIds.length;
  }

  get atMax(): boolean {
    return this.draftSelectedIds.length >= HOME_SHORTCUTS_MAX;
  }

  get isDirty(): boolean {
    if (this.draftSelectedIds.length !== this.snapshotIds.length) return true;
    return this.draftSelectedIds.some((id, i) => id !== this.snapshotIds[i]);
  }

  get availableGroups(): ShortcutGroup[] {
    const selected = new Set(this.draftSelectedIds);
    const term = this.searchTerm.trim().toLowerCase();
    const allowed = this.shortcutsService.getAllowedShortcuts().filter((s) => {
      if (selected.has(s.id)) return false;
      if (!term) return true;
      return (
        s.label.toLowerCase().includes(term) ||
        s.category.toLowerCase().includes(term)
      );
    });

    const byCategory = new Map<string, HomeShortcutDef[]>();
    for (const s of allowed) {
      const list = byCategory.get(s.category) ?? [];
      list.push(s);
      byCategory.set(s.category, list);
    }

    return [...byCategory.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
      .map(([category, items]) => ({
        category,
        items: items.sort((x, y) => x.label.localeCompare(y.label, 'pt-BR')),
      }));
  }

  get selectedShortcuts(): HomeShortcutDef[] {
    return this.draftSelectedIds
      .map((id) => this.shortcutsService.resolveShortcuts([id])[0])
      .filter((s): s is HomeShortcutDef => !!s);
  }

  get previewPlaceholderCount(): number[] {
    const n = Math.max(0, HOME_SHORTCUTS_MAX - this.previewShortcuts.length);
    return Array.from({ length: n }, (_, i) => i);
  }

  iconHtml(key?: string | null): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(getNavigationMenuIconHtml(key));
  }

  isSelected(id: string): boolean {
    return this.draftSelectedIds.includes(id);
  }

  addShortcut(id: string): void {
    if (this.isSelected(id) || this.atMax) return;
    this.draftSelectedIds = [...this.draftSelectedIds, id];
  }

  removeShortcut(id: string): void {
    this.draftSelectedIds = this.draftSelectedIds.filter((x) => x !== id);
  }

  toggleAvailable(shortcut: HomeShortcutDef, checked: boolean): void {
    if (checked) {
      this.addShortcut(shortcut.id);
    } else {
      this.removeShortcut(shortcut.id);
    }
  }

  onDragStart(index: number, event: DragEvent): void {
    this.draggingIndex = index;
    event.dataTransfer?.setData('text/plain', String(index));
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDrop(targetIndex: number, event: DragEvent): void {
    event.preventDefault();
    const from =
      this.draggingIndex ??
      Number.parseInt(event.dataTransfer?.getData('text/plain') ?? '', 10);
    this.draggingIndex = null;
    if (Number.isNaN(from) || from === targetIndex) return;
    const next = [...this.draftSelectedIds];
    const [moved] = next.splice(from, 1);
    next.splice(targetIndex, 0, moved);
    this.draftSelectedIds = next;
  }

  onDragEnd(): void {
    this.draggingIndex = null;
  }

  moveSelected(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= this.draftSelectedIds.length) return;
    const next = [...this.draftSelectedIds];
    [next[index], next[target]] = [next[target], next[index]];
    this.draftSelectedIds = next;
  }

  restoreDefaults(): void {
    this.draftSelectedIds = this.shortcutsService.getDefaultIds();
  }

  requestClose(): void {
    if (this.isDirty) {
      this.showDiscardConfirm = true;
      return;
    }
    this.emitClose();
  }

  confirmDiscard(): void {
    this.showDiscardConfirm = false;
    this.emitClose();
  }

  cancelDiscard(): void {
    this.showDiscardConfirm = false;
  }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('home-shortcuts-overlay')) {
      this.requestClose();
    }
  }

  save(): void {
    const sanitized = this.shortcutsService.sanitizeIds(this.draftSelectedIds);
    this.saved.emit(sanitized);
    this.emitClose();
  }

  private openDraft(): void {
    this.searchTerm = '';
    this.draftSelectedIds = [...this.initialIds];
    this.snapshotIds = [...this.initialIds];
    this.draggingIndex = null;
    this.showDiscardConfirm = false;
  }

  private emitClose(): void {
    this.closed.emit();
  }
}
