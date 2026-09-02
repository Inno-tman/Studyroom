import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface PromptOptions extends ConfirmOptions {
  initial?: string;
  placeholder?: string;
}

export interface ConfirmState {
  id: number;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
  input?: { placeholder?: string; initial?: string };
  resolve: (value: boolean | string | null) => void;
}

/**
 * Root-shared, app-wide non-blocking user feedback: toasts for transient
 * success/error/info messages and a promise-based confirm/prompt modal to
 * replace native `alert()` / `confirm()` / `prompt()` dialogs.
 * Rendered by <app-ui-feedback-host/> mounted once in the app shell.
 */
@Injectable({ providedIn: 'root' })
export class UiFeedbackService {
  private _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  private _confirmState = signal<ConfirmState | null>(null);
  readonly confirmState = this._confirmState.asReadonly();

  private toastId = 0;
  private confirmId = 0;

  success(message: string): void {
    this.push('success', message);
  }

  error(message: string): void {
    this.push('error', message);
  }

  info(message: string): void {
    this.push('info', message);
  }

  warning(message: string): void {
    this.push('warning', message);
  }

  private push(type: ToastType, message: string): void {
    const id = ++this.toastId;
    this._toasts.update(list => [...list, { id, type, message }]);
    window.setTimeout(() => this.dismiss(id), type === 'error' ? 6000 : 3500);
  }

  dismiss(id: number): void {
    this._toasts.update(list => list.filter(t => t.id !== id));
  }

  /** Non-blocking confirmation. Resolves true/false. */
  confirm(opts: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      this._confirmState.set({
        id: ++this.confirmId,
        title: opts.title ?? 'Are you sure?',
        message: opts.message,
        confirmLabel: opts.confirmLabel ?? 'Confirm',
        cancelLabel: opts.cancelLabel ?? 'Cancel',
        danger: opts.danger ?? false,
        resolve: value => resolve(value === true)
      });
    });
  }

  /** Non-blocking prompt with an optional text input. Resolves string | null. */
  prompt(opts: PromptOptions): Promise<string | null> {
    return new Promise<string | null>(resolve => {
      this._confirmState.set({
        id: ++this.confirmId,
        title: opts.title ?? 'Input required',
        message: opts.message,
        confirmLabel: opts.confirmLabel ?? 'OK',
        cancelLabel: opts.cancelLabel ?? 'Cancel',
        danger: opts.danger ?? false,
        input: { placeholder: opts.placeholder, initial: opts.initial },
        resolve: value => resolve(typeof value === 'string' ? value : null)
      });
    });
  }

  /** Resolve the active modal. value: true (confirm), false/null (cancel), or a string (prompt input). */
  resolveModal(value: boolean | string | null): void {
    const state = this._confirmState();
    if (!state) return;
    this._confirmState.set(null);
    state.resolve(value);
  }
}
