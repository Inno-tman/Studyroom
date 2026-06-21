import { Component, Input, inject, OnInit } from '@angular/core';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AIService, AcademicResponse, PaperReference, ResearchPhase, ConversationSummary } from '../../core/services/ai.service';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
  references?: PaperReference[];
  currentPhase?: string;
  nextPhase?: string;
  researchOutline?: ResearchPhase[];
}

@Component({
  selector: 'app-ai-chat-panel',
  standalone: true,
  imports: [NgFor, NgIf, DatePipe, FormsModule],
  template: `
    <div class="ai-panel">
      <div class="panel-header">
        <div class="header-left">
          <button class="sidebar-toggle" (click)="showSidebar = !showSidebar" title="Conversation history">
            <span>{{ showSidebar ? '✕' : '☰' }}</span>
          </button>
          <h2>{{ researchMode ? '📚 Research' : '🤖 Chat' }}</h2>
        </div>
        <div class="header-actions">
          <button class="mode-toggle" (click)="toggleMode()" [class.active]="researchMode">
            {{ researchMode ? '📄' : '💬' }}
          </button>
          <button class="new-chat-btn" (click)="newConversation()" title="New conversation">+</button>
        </div>
      </div>

      <div class="layout">
        <div class="sidebar" *ngIf="showSidebar">
          <div class="sidebar-title">Conversations</div>
          <div class="conv-list">
            <div class="conv-item" *ngFor="let c of conversations" (click)="loadConversation(c.id)" [class.active]="c.id === currentConvId">
              <div class="conv-subject">{{ c.subject || 'Untitled' }}</div>
              <div class="conv-meta">{{ c.messageCount }} msgs · {{ c.createdAt | date:'short' }}</div>
            </div>
            <div class="conv-empty" *ngIf="conversations.length === 0">No conversations yet</div>
          </div>
        </div>

        <div class="chat-area">
          <div class="research-progress" *ngIf="researchMode && currentOutline.length > 0">
            <div class="phase" *ngFor="let phase of currentOutline" [class.active]="phase.phase === currentPhaseName" [class.done]="phase.completed">
              <span class="phase-dot">{{ phase.completed ? '✓' : (phase.phase === currentPhaseName ? '●' : '○') }}</span>
              <span class="phase-label">{{ phase.phase.split(':')[0] }}</span>
            </div>
          </div>

          <div class="messages" #messageContainer>
            <div class="welcome" *ngIf="messages.length === 0">
              <ng-container *ngIf="!researchMode; else researchWelcome">
                <div class="welcome-icon">🤖</div>
                <h3>Academic Assistant</h3>
                <p>Ask me anything about your studies!</p>
                <div class="suggestions">
                  <button class="chip" (click)="askQuick('Explain derivatives in calculus')">Derivatives</button>
                  <button class="chip" (click)="askQuick('What are Newton three laws of motion')">Newton Laws</button>
                  <button class="chip" (click)="askQuick('Explain binary search tree')">Binary Trees</button>
                  <button class="chip" (click)="askQuick('Difference between DNA and RNA')">DNA vs RNA</button>
                </div>
              </ng-container>
              <ng-template #researchWelcome>
                <div class="welcome-icon">📚</div>
                <h3>Research Assistant</h3>
                <p>Search real academic papers and build your research step by step.</p>
                <div class="suggestions">
                  <button class="chip" (click)="askQuick('Impact of artificial intelligence on healthcare')">AI in Healthcare</button>
                  <button class="chip" (click)="askQuick('Climate change effects on biodiversity')">Climate & Biodiversity</button>
                  <button class="chip" (click)="askQuick('Machine learning for cybersecurity')">ML for Security</button>
                </div>
              </ng-template>
            </div>

            <div class="msg" *ngFor="let msg of messages" [class.user]="msg.role === 'user'" [class.assistant]="msg.role === 'assistant'">
              <div class="bubble">
                <div class="bubble-header" *ngIf="msg.role === 'assistant'">
                  <span class="bubble-avatar">{{ researchMode ? 'R' : 'A' }}</span>
                  <span class="bubble-name">{{ researchMode ? 'Research AI' : 'Academic AI' }}</span>
                  <span class="phase-tag" *ngIf="msg.currentPhase">{{ msg.currentPhase.split(':')[0] }}</span>
                  <span class="bubble-time">{{ msg.createdAt | date:'shortTime' }}</span>
                </div>
                <div class="bubble-header user-header" *ngIf="msg.role === 'user'">
                  <span class="bubble-time">{{ msg.createdAt | date:'shortTime' }}</span>
                </div>
                <div class="bubble-text">{{ msg.content }}</div>
                <div class="refs" *ngIf="msg.references && msg.references.length > 0">
                  <div class="refs-title">References</div>
                  <div class="ref" *ngFor="let ref of msg.references; let i = index">
                    <span class="ref-num">{{ i + 1 }}</span>
                    <div class="ref-body">
                      <span class="ref-authors">{{ ref.authors }} ({{ ref.year }})</span>
                      <span class="ref-title">{{ ref.title }}</span>
                      <span class="ref-venue" *ngIf="ref.venue">{{ ref.venue }}</span>
                      <a *ngIf="ref.url" [href]="ref.url" target="_blank" class="ref-link">View paper →</a>
                    </div>
                  </div>
                </div>
                <div class="next-step" *ngIf="msg.nextPhase">
                  <button class="next-btn" (click)="continueResearch(msg.nextPhase!)">Continue to {{ msg.nextPhase.split(':')[0] }} →</button>
                </div>
              </div>
            </div>

            <div class="typing" *ngIf="loading">
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
            </div>
          </div>

          <div class="chat-input">
            <input
              type="text"
              [(ngModel)]="question"
              (keyup.enter)="sendMessage()"
              [placeholder]="researchMode ? 'Describe your research topic...' : 'Ask an academic question...'"
              [disabled]="loading"
            />
            <button class="send-btn" (click)="sendMessage()" [disabled]="loading || !question.trim()">
              <span>➤</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ai-panel { display: flex; flex-direction: column; height: 100%; background: var(--background); }
    .panel-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid var(--border); background: var(--surface); flex-shrink: 0; }
    .header-left { display: flex; align-items: center; gap: 10px; }
    .header-left h2 { font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 0; }
    .sidebar-toggle, .new-chat-btn { background: none; border: 1px solid var(--border); color: var(--text-secondary); width: 28px; height: 28px; border-radius: 6px; cursor: pointer; font-size: 13px; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
    .sidebar-toggle:hover, .new-chat-btn:hover { border-color: var(--accent); color: var(--accent); }
    .header-actions { display: flex; align-items: center; gap: 6px; }
    .mode-toggle { padding: 4px 8px; font-size: 13px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); color: var(--text-secondary); cursor: pointer; transition: all 0.15s; }
    .mode-toggle.active { border-color: var(--accent); background: rgba(56, 189, 248, 0.1); }

    .layout { display: flex; flex: 1; overflow: hidden; }
    .sidebar { width: 220px; border-right: 1px solid var(--border); background: var(--surface); overflow-y: auto; flex-shrink: 0; }
    .sidebar-title { padding: 10px 12px; font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
    .conv-list { display: flex; flex-direction: column; }
    .conv-item { padding: 10px 12px; cursor: pointer; border-bottom: 1px solid var(--border); transition: background 0.1s; }
    .conv-item:hover { background: var(--surface-hover); }
    .conv-item.active { background: rgba(56, 189, 248, 0.08); border-left: 2px solid var(--accent); }
    .conv-subject { font-size: 12px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .conv-meta { font-size: 10px; color: var(--text-muted); margin-top: 2px; }
    .conv-empty { padding: 16px; text-align: center; font-size: 12px; color: var(--text-muted); }

    .chat-area { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .research-progress { display: flex; gap: 1px; padding: 6px 12px; background: var(--surface); border-bottom: 1px solid var(--border); overflow-x: auto; flex-shrink: 0; }
    .phase { display: flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 4px; font-size: 10px; color: var(--text-muted); white-space: nowrap; }
    .phase.active { background: rgba(56, 189, 248, 0.1); color: var(--accent); }
    .phase.done { color: var(--success); }
    .phase-dot { font-size: 8px; }

    .messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .welcome { text-align: center; padding: 40px 16px; }
    .welcome-icon { font-size: 40px; margin-bottom: 12px; }
    .welcome h3 { font-size: 18px; font-weight: 700; color: var(--text-primary); margin: 0 0 6px; }
    .welcome p { font-size: 13px; color: var(--text-secondary); margin: 0 0 16px; }
    .suggestions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
    .chip { padding: 7px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 20px; color: var(--text-secondary); font-size: 12px; cursor: pointer; transition: all 0.15s; }
    .chip:hover { border-color: var(--accent); color: var(--accent); background: rgba(56, 189, 248, 0.05); }

    .msg { display: flex; flex-direction: column; align-items: flex-start; }
    .msg.user { align-items: flex-end; }

    .bubble { max-width: 85%; padding: 10px 14px; border-radius: 12px; position: relative; }
    .msg.user .bubble { background: var(--primary); color: white; border-bottom-right-radius: 4px; }
    .msg.assistant .bubble { background: var(--surface); border: 1px solid var(--border); border-bottom-left-radius: 4px; }

    .bubble-header { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
    .user-header { justify-content: flex-end; }
    .bubble-avatar { width: 20px; height: 20px; border-radius: 50%; background: rgba(56, 189, 248, 0.2); color: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; }
    .bubble-name { font-size: 11px; font-weight: 600; color: var(--text-primary); }
    .bubble-time { font-size: 9px; color: var(--text-muted); }
    .msg.user .bubble-time { color: rgba(255,255,255,0.6); }
    .phase-tag { font-size: 9px; padding: 1px 5px; border-radius: 3px; background: rgba(56, 189, 248, 0.15); color: var(--accent); }

    .bubble-text { font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
    .msg.user .bubble-text { color: white; }

    .refs { margin-top: 10px; padding: 8px; background: rgba(0,0,0,0.15); border-radius: 8px; }
    .msg.user .refs { display: none; }
    .refs-title { font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px; }
    .ref { display: flex; gap: 8px; padding: 4px 0; }
    .ref-num { color: var(--accent); font-weight: 600; font-size: 10px; flex-shrink: 0; margin-top: 1px; }
    .ref-body { display: flex; flex-direction: column; gap: 1px; }
    .ref-authors { font-size: 10px; color: var(--text-secondary); }
    .ref-title { font-size: 11px; color: var(--text-primary); font-weight: 500; }
    .ref-venue { font-size: 10px; color: var(--text-muted); }
    .ref-link { font-size: 10px; color: var(--accent); text-decoration: none; margin-top: 2px; }
    .ref-link:hover { text-decoration: underline; }

    .next-step { margin-top: 8px; }
    .next-btn { padding: 6px 14px; background: rgba(56, 189, 248, 0.1); border: 1px solid var(--accent); border-radius: 6px; color: var(--accent); font-size: 11px; cursor: pointer; transition: all 0.15s; }
    .next-btn:hover { background: var(--accent); color: white; }

    .typing { display: flex; gap: 4px; padding: 12px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; border-bottom-left-radius: 4px; width: fit-content; }
    .typing-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted); animation: pulse 1.4s infinite ease-in-out; }
    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes pulse { 0%, 60%, 100% { opacity: 0.3; } 30% { opacity: 1; } }

    .chat-input { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-top: 1px solid var(--border); background: var(--surface); flex-shrink: 0; }
    .chat-input input { flex: 1; padding: 10px 14px; background: var(--background); border: 1px solid var(--border); border-radius: 24px; color: var(--text-primary); font-size: 13px; outline: none; transition: border-color 0.15s; }
    .chat-input input:focus { border-color: var(--accent); }
    .chat-input input::placeholder { color: var(--text-muted); }
    .chat-input input:disabled { opacity: 0.5; }
    .send-btn { width: 36px; height: 36px; border-radius: 50%; background: var(--accent); border: none; color: white; cursor: pointer; transition: background 0.15s; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 16px; }
    .send-btn:hover:not(:disabled) { background: var(--primary-hover); }
    .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  `]
})
export class AiChatPanelComponent implements OnInit {
  @Input() subject = '';
  @Input() notesContext = '';

  private aiService = inject(AIService);

  messages: ChatMessage[] = [];
  question = '';
  loading = false;
  researchMode = false;
  currentPhaseName = '';
  currentOutline: ResearchPhase[] = [];
  currentConvId = '';
  showSidebar = false;
  conversations: ConversationSummary[] = [];

  async ngOnInit() {
    await this.loadConversations();
  }

  toggleMode() {
    this.researchMode = !this.researchMode;
    this.newConversation();
  }

  async newConversation() {
    this.messages = [];
    this.currentConvId = '';
    this.currentPhaseName = '';
    this.currentOutline = [];
    this.question = '';
    try {
      const conv = await this.aiService.createConversation(this.subject || undefined, this.researchMode, this.currentPhaseName || undefined).toPromise();
      if (conv) {
        this.currentConvId = conv.id;
        await this.loadConversations();
      }
    } catch {}
  }

  async loadConversations() {
    try {
      this.conversations = await this.aiService.getConversations(50).toPromise() || [];
    } catch {}
  }

  async loadConversation(id: string) {
    try {
      const conv = await this.aiService.getConversation(id).toPromise();
      if (conv) {
        this.currentConvId = conv.id;
        this.researchMode = conv.isResearchMode;
        this.currentPhaseName = conv.currentPhase || '';
        this.messages = conv.messages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
          createdAt: new Date(m.createdAt)
        }));
        this.showSidebar = false;
      }
    } catch {}
  }

  async sendMessage() {
    if (!this.question.trim() || this.loading) return;
    if (!this.currentConvId) await this.newConversation();

    const userMsg: ChatMessage = { role: 'user', content: this.question, createdAt: new Date() };
    this.messages.push(userMsg);

    const q = this.question;
    this.question = '';
    this.loading = true;

    try {
      const history = this.messages.slice(0, -1).map(m => ({ role: m.role, content: m.content }));

      const response = await this.aiService.ask({
        question: q,
        subject: this.subject || undefined,
        context: this.notesContext || undefined,
        researchMode: this.researchMode || undefined,
        researchPhase: this.currentPhaseName || undefined,
        previousMessages: history.length > 0 ? history : undefined,
        conversationId: this.currentConvId || undefined
      }).toPromise();

      if (response) {
        this.currentPhaseName = response.currentPhase || '';
        if (response.researchOutline) this.currentOutline = response.researchOutline;
        if (response.conversationId) this.currentConvId = response.conversationId;

        this.messages.push({
          role: 'assistant',
          content: response.answer,
          createdAt: new Date(response.createdAt),
          references: response.references,
          currentPhase: response.currentPhase,
          nextPhase: response.nextPhase,
          researchOutline: response.researchOutline
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

  askQuick(question: string) {
    this.question = question;
    this.sendMessage();
  }

  continueResearch(phase: string) {
    this.question = `Continue with ${phase}. Please provide detailed content for this phase based on the previous discussion.`;
    this.currentPhaseName = phase;
    this.sendMessage();
  }
}
