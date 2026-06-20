import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RoomService } from '../../core/services/room.service';
import { SignalRService } from '../../core/services/signalr.service';
import { ChatService } from '../../core/services/chat.service';
import { NotesService } from '../../core/services/notes.service';
import { AuthService } from '../../core/services/auth.service';
import { Room } from '../../shared/models/room.model';
import { Message } from '../../shared/models/message.model';
import { LoadingComponent } from '../../shared/components/loading/loading.component';
import { NotesEditorComponent } from '../../notes/notes-editor/notes-editor.component';
import { PomodoroTimerComponent } from '../../timer/pomodoro-timer/pomodoro-timer.component';
import { AiChatPanelComponent } from '../../ai/ai-chat-panel/ai-chat-panel.component';

@Component({
  selector: 'app-room-detail',
  standalone: true,
  imports: [NgFor, NgIf, DatePipe, FormsModule, RouterLink, LoadingComponent, NotesEditorComponent, PomodoroTimerComponent, AiChatPanelComponent],
  template: `
    <div class="room-detail">
      <div class="room-header">
        <div class="room-info">
          <a routerLink="/rooms" class="back-link">
            <span class="material-icons">arrow_back</span>
            Rooms
          </a>
          <h1>{{ room?.name }}</h1>
          <div class="room-badges">
            <span class="subject-badge">{{ room?.subject || 'General' }}</span>
            <span class="members-badge">{{ room?.memberCount }} members</span>
            <span *ngIf="room?.isPrivate" class="private-badge">Private</span>
          </div>
          <p class="room-description">{{ room?.description }}</p>
        </div>
        <div class="room-actions">
          <button *ngIf="!isMember" class="btn-primary" (click)="joinRoom()" [disabled]="joining">
            {{ joining ? 'Joining...' : 'Join Room' }}
          </button>
          <button *ngIf="isMember" class="btn-outline-danger" (click)="leaveRoom()">Leave</button>
        </div>
      </div>

      <div class="room-content" *ngIf="isMember">
        <div class="content-grid">
          <div class="panel chat-panel">
            <div class="panel-header">
              <h2>Chat</h2>
              <span class="online-count">{{ onlineUsers.length }} online</span>
            </div>
            <div class="messages" #messageContainer>
              <div class="message" *ngFor="let msg of messages">
                <div class="message-avatar">{{ msg.username.charAt(0).toUpperCase() }}</div>
                <div class="message-body">
                  <div class="message-header">
                    <span class="message-user">{{ msg.username }}</span>
                    <span class="message-time">{{ msg.createdAt | date:'shortTime' }}</span>
                  </div>
                  <p class="message-content">{{ msg.content }}</p>
                </div>
              </div>
            </div>
            <div class="chat-input">
              <input
                type="text"
                [(ngModel)]="newMessage"
                (keyup.enter)="sendMessage()"
                placeholder="Type a message..."
                [disabled]="!isMember"
              />
              <button class="send-btn" (click)="sendMessage()" [disabled]="!newMessage.trim()">
                <span class="material-icons">send</span>
              </button>
            </div>
          </div>

          <div class="panel notes-panel">
            <div class="panel-header">
              <h2>Notes</h2>
            </div>
            <app-notes-editor [roomId]="roomId" />
          </div>

          <div class="panel ai-panel">
            <app-ai-chat-panel [subject]="room?.subject || ''" [notesContext]="notesContext" />
          </div>
        </div>

        <div class="timer-section">
          <app-pomodoro-timer [roomId]="roomId" />
        </div>
      </div>

      <div class="join-prompt" *ngIf="!isMember && room">
        <p>Join this room to start studying with others!</p>
      </div>
    </div>
  `,
  styles: [`
    .room-detail { max-width: 1200px; }

    .room-header { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 24px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }

    .back-link { display: inline-flex; align-items: center; gap: 4px; color: var(--text-secondary); text-decoration: none; font-size: 13px; margin-bottom: 12px; }
    .back-link:hover { color: var(--accent); }
    .back-link .material-icons { font-size: 18px; }

    .room-info h1 { font-size: 22px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }

    .room-badges { display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
    .subject-badge { background: rgba(56, 189, 248, 0.1); color: var(--accent); padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
    .members-badge { background: rgba(34, 197, 94, 0.1); color: var(--success); padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
    .private-badge { background: rgba(245, 158, 11, 0.1); color: var(--warning); padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }

    .room-description { font-size: 13px; color: var(--text-secondary); }

    .room-actions { display: flex; gap: 8px; }

    .btn-primary { padding: 10px 20px; background: var(--primary); color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: background 0.15s; }
    .btn-primary:hover:not(:disabled) { background: var(--primary-hover); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

    .btn-outline-danger { padding: 10px 20px; background: transparent; border: 1px solid var(--error); border-radius: 8px; color: var(--error); font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: all 0.15s; }
    .btn-outline-danger:hover { background: rgba(239, 68, 68, 0.1); }

    .room-content { margin-top: 16px; }

    .content-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 16px; }

    .panel { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }

    .panel-header { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid var(--border); }
    .panel-header h2 { font-size: 15px; font-weight: 600; color: var(--text-primary); }

    .online-count { font-size: 12px; color: var(--success); }

    .chat-panel { height: 500px; }

    .messages { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; }

    .message { display: flex; gap: 10px; padding: 8px; border-radius: 8px; transition: background 0.15s; }
    .message:hover { background: rgba(255,255,255,0.02); }

    .message-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 12px; color: white; flex-shrink: 0; }

    .message-body { flex: 1; min-width: 0; }
    .message-header { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
    .message-user { font-size: 13px; font-weight: 600; color: var(--text-primary); }
    .message-time { font-size: 11px; color: var(--text-muted); }
    .message-content { font-size: 13px; color: var(--text-secondary); word-break: break-word; }

    .chat-input { display: flex; align-items: center; padding: 12px; border-top: 1px solid var(--border); gap: 8px; }
    .chat-input input { flex: 1; padding: 10px 12px; background: var(--background); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); font-size: 13px; outline: none; }
    .chat-input input:focus { border-color: var(--primary); }
    .chat-input input::placeholder { color: var(--text-muted); }

    .send-btn { width: 36px; height: 36px; border-radius: 8px; background: var(--primary); border: none; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.15s; }
    .send-btn:hover:not(:disabled) { background: var(--primary-hover); }
    .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .send-btn .material-icons { font-size: 18px; }

    .notes-panel { height: 500px; }
    .notes-panel ::ng-deep app-notes-editor { flex: 1; display: flex; flex-direction: column; }

    .ai-panel { height: 500px; }
    .ai-panel ::ng-deep app-ai-chat-panel { flex: 1; display: flex; flex-direction: column; height: 100%; }

    .timer-section { margin-top: 0; }

    .join-prompt { text-align: center; padding: 48px; color: var(--text-muted); }

    @media (max-width: 1200px) {
      .content-grid { grid-template-columns: 1fr 1fr; }
    }

    @media (max-width: 768px) {
      .room-header { flex-direction: column; }
      .content-grid { grid-template-columns: 1fr; }
      .chat-panel, .notes-panel, .ai-panel { height: 400px; }
    }
  `]
})
export class RoomDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private roomService = inject(RoomService);
  private signalR = inject(SignalRService);
  private chatService = inject(ChatService);
  private notesService = inject(NotesService);
  private auth = inject(AuthService);

  roomId = '';
  room?: Room;
  messages: Message[] = [];
  onlineUsers: string[] = [];
  newMessage = '';
  isMember = false;
  joining = false;
  loading = true;
  notesContext = '';

  async ngOnInit() {
    this.roomId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.roomId) return;

    try {
      this.room = await this.roomService.getById(this.roomId).toPromise();
      if (!this.room) { this.router.navigate(['/rooms']); return; }

      const userId = this.auth.currentUser()?.id;
      const members = await this.roomService.getMembers(this.roomId).toPromise();
      this.isMember = members?.some(m => m.id === userId) || false;

      if (this.isMember) {
        await this.loadChat();
        await this.loadNotes();
        await this.setupSignalR();
      }
    } catch { } finally {
      this.loading = false;
    }
  }

  async loadChat() {
    try {
      this.messages = await this.chatService.getMessages(this.roomId).toPromise() || [];
    } catch { }
  }

  async loadNotes() {
    try {
      const notes = await this.notesService.getNotes(this.roomId).toPromise();
      if (notes) this.notesContext = notes.content;
    } catch { }
  }

  async setupSignalR() {
    try {
      await this.signalR.startConnection();
      await this.signalR.joinRoom(this.roomId);

      this.signalR.message$.subscribe(msg => {
        if (msg.roomId === this.roomId) {
          this.messages = [...this.messages, msg];
        }
      });

      this.signalR.onlineUsers$.subscribe(users => {
        this.onlineUsers = users;
      });
    } catch { }
  }

  async sendMessage() {
    if (!this.newMessage.trim()) return;

    try {
      await this.signalR.sendMessage(this.roomId, this.newMessage);
      this.newMessage = '';
    } catch { }
  }

  async joinRoom() {
    this.joining = true;
    try {
      if (this.room?.isPrivate) {
        const code = prompt('Enter join code:');
        if (!code) { this.joining = false; return; }
        await this.roomService.join(this.roomId, code).toPromise();
      } else {
        await this.roomService.join(this.roomId).toPromise();
      }

      this.isMember = true;
      await this.loadChat();
      await this.setupSignalR();
    } catch (err: any) {
      alert(err.error?.error || 'Failed to join room.');
    } finally {
      this.joining = false;
    }
  }

  async leaveRoom() {
    if (!confirm('Leave this room?')) return;

    try {
      await this.signalR.leaveRoom(this.roomId);
      await this.roomService.leave(this.roomId).toPromise();
      this.isMember = false;
      this.messages = [];
      this.router.navigate(['/rooms']);
    } catch { }
  }

  ngOnDestroy() {
    if (this.isMember) {
      this.signalR.leaveRoom(this.roomId);
    }
  }
}
