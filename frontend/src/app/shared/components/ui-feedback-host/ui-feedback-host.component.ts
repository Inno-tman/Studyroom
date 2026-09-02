import { Component, inject, ViewChild, ElementRef } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { UiFeedbackService, ToastType } from '../../../core/services/ui-feedback.service';

@Component({
  selector: 'app-ui-feedback-host',
  standalone: true,
  imports: [NgFor, NgIf],
  template: `
    <!-- Toast stack -->
    <div class="toast-stack" aria-live="polite" role="status">
      <div *ngFor="let t of service.toasts()" class="toast" [class]="t.type" (click)="service.dismiss(t.id)">
        <span class="material-icons">{{ icon(t.type) }}</span>
        <span class="toast-msg">{{ t.message }}</span>
        <button class="toast-close" (click)="service.dismiss(t.id)" aria-label="Dismiss">&times;</button>
      </div>
    </div>

    <!-- Confirm / prompt modal -->
    <ng-container *ngIf="service.confirmState() as c">
      <div class="fb-backdrop" (click)="cancel()"></div>
      <div class="fb-modal" role="dialog" aria-modal="true" [attr.aria-label]="c.title" (keydown.escape)="cancel()">
        <h3 class="fb-title">{{ c.title }}</h3>
        <p class="fb-message">{{ c.message }}</p>
        <input
          *ngIf="c.input"
          #fbInput
          class="fb-input"
          [placeholder]="c.input.placeholder"
          [value]="c.input.initial"
          (keyup.enter)="confirm()"
        />        <div class="fb-actions">
          <button class="btn-outline" (click)="cancel()">{{ c.cancelLabel }}</button>
          <button class="btn-primary" [class.danger]="c.danger" (click)="confirm()">{{ c.confirmLabel }}</button>
        </div>
      </div>
    </ng-container>
  `,
  styles: [`
    .toast-stack {
      position: fixed;
      top: calc(var(--navbar-height) + env(safe-area-inset-top) + 12px);
      right: 16px;
      z-index: 4000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: min(380px, calc(100vw - 32px));
      pointer-events: none;
    }
    .toast {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
      border-radius: 12px;
      background: var(--surface);
      border: 1px solid var(--border);
      box-shadow: 0 8px 24px rgba(0,0,0,0.18);
      color: var(--text-primary);
      font-size: var(--font-14);
      animation: fb-in 0.2s ease-out;
      cursor: default;
    }
    .toast .material-icons { font-size: var(--font-20); flex-shrink: 0; }
    .toast.success { border-left: 4px solid var(--success); }
    .toast.success .material-icons { color: var(--success); }
    .toast.error { border-left: 4px solid var(--error); }
    .toast.error .material-icons { color: var(--error); }
    .toast.info { border-left: 4px solid var(--primary); }
    .toast.info .material-icons { color: var(--primary); }
    .toast.warning { border-left: 4px solid #f59e0b; }
    .toast.warning .material-icons { color: #f59e0b; }
    .toast-msg { flex: 1; }
    .toast-close {
      background: none; border: none; cursor: pointer;
      color: var(--text-muted); font-size: var(--font-18); line-height: 1;
      padding: 2px 4px; border-radius: 6px;
    }
    .toast-close:hover { background: var(--surface-hover); color: var(--text-primary); }

    .fb-backdrop {
      position: fixed; inset: 0; z-index: 4100;
      background: rgba(0,0,0,0.5);
      animation: fb-fade 0.15s ease-out;
    }
    .fb-modal {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      z-index: 4200; width: min(420px, calc(100vw - 32px));
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 22px;
      box-shadow: 0 18px 48px rgba(0,0,0,0.35);
      animation: fb-in 0.18s ease-out;
    }
    .fb-title { margin: 0 0 8px; font-size: var(--font-17); color: var(--text-primary); }
    .fb-message { margin: 0 0 16px; font-size: var(--font-14); color: var(--text-secondary); line-height: 1.5; }
    .fb-input {
      width: 100%; box-sizing: border-box;
      padding: 10px 12px; margin-bottom: 16px;
      border: 1px solid var(--border); border-radius: 10px;
      background: var(--surface-2, var(--surface)); color: var(--text-primary);
      font-size: var(--font-14);
    }
    .fb-input:focus { outline: none; border-color: var(--primary); }
    .fb-actions { display: flex; justify-content: flex-end; gap: 10px; }
    .fb-actions .btn-primary.danger { background: var(--error); border-color: var(--error); }

    @keyframes fb-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
    @keyframes fb-fade { from { opacity: 0; } to { opacity: 1; } }
  `]
})
export class UiFeedbackHostComponent {
  service = inject(UiFeedbackService);

  icon(type: ToastType): string {
    switch (type) {
      case 'success': return 'check_circle';
      case 'error': return 'error';
      case 'warning': return 'warning';
      default: return 'info';
    }
  }

  confirm(): void {
    const c = this.service.confirmState();
    const inputEl = document.querySelector<HTMLInputElement>('.fb-input');
    if (c?.input) {
      this.service.resolveModal(inputEl?.value ?? '');
    } else {
      this.service.resolveModal(true);
    }
  }

  cancel(): void {
    this.service.resolveModal(null);
  }

  @ViewChild('fbInput') private fbInput?: ElementRef<HTMLInputElement>;
  private lastFocusedModalId: number | null = null;

  ngAfterViewChecked(): void {
    const c = this.service.confirmState();
    if (c && c.id !== this.lastFocusedModalId) {
      this.lastFocusedModalId = c.id;
      if (this.fbInput?.nativeElement) {
        window.setTimeout(() => this.fbInput!.nativeElement?.focus(), 0);
      }
    }
    if (!c) this.lastFocusedModalId = null;
  }
}
