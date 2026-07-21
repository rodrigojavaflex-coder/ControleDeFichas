import {
  Component,
  Input,
  OnChanges,
  inject,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { getNavigationMenuIconHtml } from '../navigation/navigation-lucide-svgs';

@Component({
  selector: 'app-menu-icon',
  standalone: true,
  template: `<span
    class="menu-icon"
    [class.menu-icon-sm]="size === 'sm'"
    [class.menu-icon-md]="size === 'md'"
    [innerHTML]="iconHtml"
    aria-hidden="true"
  ></span>`,
  styles: [
    `
      .menu-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        color: currentColor;
      }

      .menu-icon :deep(svg) {
        display: block;
        width: 100%;
        height: 100%;
      }

      .menu-icon-sm {
        width: 1rem;
        height: 1rem;
      }

      .menu-icon-md {
        width: 1.125rem;
        height: 1.125rem;
      }
    `,
  ],
})
export class MenuIconComponent implements OnChanges {
  private sanitizer = inject(DomSanitizer);

  @Input() iconKey = 'feather-file-text';
  @Input() size: 'sm' | 'md' = 'sm';

  iconHtml: SafeHtml = this.sanitizer.bypassSecurityTrustHtml(
    getNavigationMenuIconHtml('feather-file-text'),
  );

  ngOnChanges(): void {
    this.iconHtml = this.sanitizer.bypassSecurityTrustHtml(
      getNavigationMenuIconHtml(this.iconKey),
    );
  }
}
