import { Component, Input, inject } from '@angular/core';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AIService, AcademicResponse } from '../../core/services/ai.service';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

@Component({
  selector: 'app-ai-chat-panel',
  standalone: true,
  imports: [NgFor, NgIf, DatePipe, FormsModule],
  template: `
    <div class="ai-panel">
      <div class="panel-header">
        <h2>
          <span class="ai-icon">🤖</span>
          Academic Assistant
        </h2>
        <span class="badge" *ngIf="loading">thinking...</span>
      </div>

      <div class="messages" #messageContainer>
        <div class="welcome" *ngIf="messages.length === 0">
          <p>Ask me anything about your studies! I can help with:</p>
          <div class="suggestions">
            <button class="suggestion-chip" (click)="askQuick('Explain derivatives in calculus')">Derivatives</button>
            <button class="suggestion-chip" (click)="askQuick('What are Newton three laws of motion')">Newton Laws</button>
            <button class="suggestion-chip" (click)="askQuick('Explain binary search tree')">Binary Trees</button>
            <button class="suggestion-chip" (click)="askQuick('Difference between DNA and RNA')">DNA vs RNA</button>
          </div>
        </div>

        <div class="message" *ngFor="let msg of messages" [class.user]="msg.role === 'user'" [class.assistant]="msg.role === 'assistant'">
          <div class="message-avatar">{{ msg.role === 'user' ? 'You' : 'AI' }}</div>
          <div class="message-body">
            <div class="message-header">
              <span class="message-user">{{ msg.role === 'user' ? 'You' : 'Academic AI' }}</span>
              <span class="message-time">{{ msg.createdAt | date:'shortTime' }}</span>
            </div>
            <div class="message-content">{{ msg.content }}</div>
          </div>
        </div>
      </div>

      <div class="chat-input">
        <select [(ngModel)]="subject" class="subject-picker">
          <option value="">General</option>
          <option value="Mathematics">Mathematics</option>
          <option value="Physics">Physics</option>
          <option value="Chemistry">Chemistry</option>
          <option value="Biology">Biology</option>
          <option value="Computer Science">Computer Science</option>
          <option value="Literature">Literature</option>
          <option value="History">History</option>
        </select>
        <input
          type="text"
          [(ngModel)]="question"
          (keyup.enter)="sendMessage()"
          placeholder="Ask an academic question..."
          [disabled]="loading"
        />
        <button class="send-btn" (click)="sendMessage()" [disabled]="loading || !question.trim()">
          <span class="material-icons">send</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .ai-panel { display: flex; flex-direction: column; height: 100%; }

    .panel-header { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid var(--border); }
    .panel-header h2 { font-size: 15px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 8px; }
    .ai-icon { font-size: 18px; }

    .badge { font-size: 11px; background: rgba(56, 189, 248, 0.1); color: var(--accent); padding: 3px 8px; border-radius: 4px; }

    .messages { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; }

    .welcome { text-align: center; padding: 24px 16px; }
    .welcome p { color: var(--text-secondary); font-size: 13px; margin-bottom: 16px; }

    .suggestions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
    .suggestion-chip { padding: 6px 14px; background: var(--surface-hover); border: 1px solid var(--border); border-radius: 16px; color: var(--text-secondary); font-size: 12px; cursor: pointer; transition: all 0.15s; }
    .suggestion-chip:hover { border-color: var(--accent); color: var(--accent); background: rgba(56, 189, 248, 0.05); }

    .message { display: flex; gap: 10px; padding: 8px; border-radius: 8px; }
    .message.user { flex-direction: row-reverse; }
    .message.assistant { }

    .message-avatar { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; flex-shrink: 0; }
    .message.user .message-avatar { background: var(--primary); color: white; }
    .message.assistant .message-avatar { background: rgba(56, 189, 248, 0.2); color: var(--accent); }

    .message-body { max-width: 85%; }
    .message.user .message-body { text-align: right; }

    .message-header { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
    .message.user .message-header { justify-content: flex-end; flex-direction: row-reverse; }
    .message-user { font-size: 12px; font-weight: 600; color: var(--text-primary); }
    .message-time { font-size: 10px; color: var(--text-muted); }

    .message-content { font-size: 13px; color: var(--text-secondary); line-height: 1.5; white-space: pre-wrap; word-break: break-word; }

    .chat-input { display: flex; align-items: center; gap: 8px; padding: 12px; border-top: 1px solid var(--border); }

    .subject-picker { padding: 8px; background: var(--background); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); font-size: 12px; outline: none; cursor: pointer; }

    .chat-input input { flex: 1; padding: 10px 12px; background: var(--background); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); font-size: 13px; outline: none; }
    .chat-input input:focus { border-color: var(--accent); }
    .chat-input input::placeholder { color: var(--text-muted); }
    .chat-input input:disabled { opacity: 0.5; }

    .send-btn { width: 36px; height: 36px; border-radius: 8px; background: var(--accent); border: none; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.15s; flex-shrink: 0; }
    .send-btn:hover:not(:disabled) { background: var(--primary); }
    .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .send-btn .material-icons { font-size: 18px; }
  `]
})
export class AiChatPanelComponent {
  @Input() subject = '';
  @Input() notesContext = '';

  private aiService = inject(AIService);

  messages: ChatMessage[] = [];
  question = '';
  loading = false;

  async sendMessage() {
    if (!this.question.trim() || this.loading) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: this.question,
      createdAt: new Date()
    };
    this.messages.push(userMsg);

    const q = this.question;
    this.question = '';
    this.loading = true;

    try {
      const response = await this.aiService.ask({
        question: q,
        subject: this.subject || undefined,
        context: this.notesContext || undefined
      }).toPromise();

      if (response) {
        this.messages.push({
          role: 'assistant',
          content: response.answer,
          createdAt: new Date(response.createdAt)
        });
      }
    } catch {
      this.messages.push({
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please check your API key configuration and try again.',
        createdAt: new Date()
      });
    } finally {
      this.loading = false;
    }
  }

  async askQuick(question: string) {
    this.question = question;
    await this.sendMessage();
  }
}
