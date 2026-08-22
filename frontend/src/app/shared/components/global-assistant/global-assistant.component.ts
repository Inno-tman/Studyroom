import { Component, HostListener, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { AssistantService } from '../../../core/services/assistant.service';
import { AiChatPanelComponent } from '../../../ai/ai-chat-panel/ai-chat-panel.component';

@Component({
  selector: 'app-global-assistant',
  standalone: true,
  imports: [NgIf, AiChatPanelComponent],
  template: `
    <div class="assistant-overlay" *ngIf="assistant.open()" (click)="onBackdrop($event)">
      <div class="assistant-dialog" role="dialog" aria-label="AI Assistant">
        <div class="assistant-bar">
          <span class="assistant-title"><span class="material-icons">smart_toy</span> AI Assistant</span>
          <button class="assistant-close" (click)="assistant.close()" aria-label="Close">
            <span class="material-icons">close</span>
          </button>
        </div>
        <app-ai-chat-panel [showHeader]="false" [subject]="''" />
      </div>
    </div>
  `,
  styles: [`
    .assistant-overlay {
      position: fixed;
      top: calc(var(--navbar-height) + env(safe-area-inset-top));
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1400;
      padding: 16px;
    }

    .assistant-dialog {
      width: min(460px, 100%);
      height: min(720px, 100%);
      max-height: 100%;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
    }

    .assistant-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      background: var(--secondary);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }

    .assistant-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: var(--font-14);
      font-weight: 600;
      color: var(--text-primary);
    }

    .assistant-title .material-icons { font-size: var(--font-20); color: var(--accent); }

    .assistant-close {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      width: 34px;
      height: 34px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, color 0.15s;
    }

    .assistant-close:hover { background: var(--surface-hover); color: var(--text-primary); }
    .assistant-close .material-icons { font-size: var(--font-20); }

    app-ai-chat-panel {
      flex: 1;
      display: flex;
      min-height: 0;
    }

    @media (max-width: 520px) {
      .assistant-overlay { padding: 0; }
      .assistant-dialog {
        width: 100%;
        height: 100%;
        border-radius: 0;
        border: none;
      }
    }
  `]
})
export class GlobalAssistantComponent {
  assistant = inject(AssistantService);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.assistant.close();
  }

  onBackdrop(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('assistant-overlay')) {
      this.assistant.close();
    }
  }
}
