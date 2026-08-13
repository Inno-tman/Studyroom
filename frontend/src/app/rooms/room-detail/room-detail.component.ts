import { Component, inject, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { RoomService } from '../../core/services/room.service';
import { SignalRService } from '../../core/services/signalr.service';
import { ChatService } from '../../core/services/chat.service';
import { NotesService } from '../../core/services/notes.service';
import { AuthService } from '../../core/services/auth.service';
import { InvitationService } from '../../core/services/invitation.service';
import { FriendService } from '../../core/services/friend.service';
import { Room } from '../../shared/models/room.model';
import { Message } from '../../shared/models/message.model';
import { UserDto } from '../../shared/models/room.model';
import { Friend } from '../../shared/models/social.model';
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
          <button *ngIf="isMember" class="btn-call" (click)="toggleCall()">
            <span class="material-icons">{{ inCall ? 'call_end' : 'videocam' }}</span>
            {{ inCall ? 'End Call' : 'Start Call' }}
          </button>
          <button *ngIf="isMember" class="btn-outline-danger" (click)="leaveRoom()">Leave</button>
        </div>
      </div>

      <div class="room-content" *ngIf="isMember">
        <div class="members-bar">
          <span class="members-title">Members ({{ members.length }})</span>
          <div class="members-avatars">
            <div *ngFor="let member of members" class="member-chip" [title]="member.username">
              <div class="member-avatar" [class.has-image]="member.avatarUrl">
                <img *ngIf="member.avatarUrl; else memberInitial" [src]="member.avatarUrl" alt="" />
                <ng-template #memberInitial>{{ member.username.charAt(0).toUpperCase() }}</ng-template>
              </div>
              <span class="member-name">{{ member.username }}</span>
            </div>
          </div>
          <button class="invite-btn" (click)="openInviteDialog()">
            <span class="material-icons">person_add</span>
            <span>Invite</span>
          </button>
        </div>

        <div class="invite-dialog-backdrop" *ngIf="showInviteDialog" (click)="showInviteDialog = false">
          <div class="invite-dialog" (click)="$event.stopPropagation()">
            <div class="invite-dialog-header">
              <h3>Invite friends to {{ room?.name }}</h3>
              <button class="dialog-close" (click)="showInviteDialog = false"><span class="material-icons">close</span></button>
            </div>
            <div class="invite-dialog-body">
              <p class="invite-hint" *ngIf="invitableFriends.length === 0">No friends to invite — everyone you know is already here!</p>
              <div *ngFor="let friend of invitableFriends" class="invite-row">
                <div class="member-avatar" [class.has-image]="friend.avatarUrl">
                  <img *ngIf="friend.avatarUrl; else friendInitial" [src]="friend.avatarUrl" alt="" />
                  <ng-template #friendInitial>{{ (friend.displayName || friend.username).charAt(0).toUpperCase() }}</ng-template>
                </div>
                <span class="invite-name">{{ friend.displayName || friend.username }}</span>
                <button
                  class="btn-invite"
                  (click)="inviteFriend(friend)"
                  [disabled]="friend.userId === invitingId"
                >{{ friend.userId === invitingId ? 'Inviting...' : 'Invite' }}</button>
              </div>
            </div>
          </div>
        </div>

        <div class="content-grid">
          <div class="panel chat-panel">
            <div class="panel-header">
              <h2>Chat</h2>
              <span class="online-count">{{ onlineUsers.length }} online</span>
            </div>
            <div class="messages" #messageContainer>
              <ng-container *ngFor="let msg of messages; let i = index">
                <div class="day-divider" *ngIf="showDayDivider(i)">
                  <span>{{ messages[i].createdAt | date:'mediumDate' }}</span>
                </div>
                <div class="message" [class.own]="msg.userId === currentUserId" [class.avatar-gap]="msg.userId === currentUserId || isFirstOfGroup(i)">
                  <div class="message-avatar" *ngIf="msg.userId !== currentUserId && isFirstOfGroup(i)" [class.has-image]="msg.avatarUrl">
                    <img *ngIf="msg.avatarUrl; else messageInitial" [src]="msg.avatarUrl" alt="" />
                    <ng-template #messageInitial>{{ msg.username.charAt(0).toUpperCase() }}</ng-template>
                  </div>
                  <div class="message-body">
                    <div class="message-header" *ngIf="msg.userId !== currentUserId && isFirstOfGroup(i)">
                      <span class="message-user">{{ msg.username }}</span>
                    </div>
                    <div class="bubble">
                      <span class="bubble-content">{{ msg.content }}</span>
                      <span class="message-time">{{ msg.createdAt | date:'shortTime' }}</span>
                    </div>
                  </div>
                </div>
              </ng-container>
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

      <div class="call-panel" *ngIf="isMember && inCall">
        <div class="call-header">
          <h2><span class="live-dot"></span> {{ room?.name }} — Video Call</h2>
          <span class="call-hint">Everyone in this room joins the same live call</span>
          <button class="dialog-close" (click)="toggleCall()" title="End call"><span class="material-icons">close</span></button>
        </div>
        <iframe
          class="call-frame"
          [src]="callUrl"
          allow="camera; microphone; speaker-selection; display-capture; fullscreen; clipboard-read; clipboard-write; web-share; autoplay; picture-in-picture"
          allowfullscreen
        ></iframe>
      </div>

      <div class="join-prompt" *ngIf="!isMember && room">
        <p>Join this room to start studying with others!</p>
      </div>
    </div>
  `,
  styles: [`
    .room-detail { max-width: 1200px; }

    .room-header { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 24px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }

    .back-link { display: inline-flex; align-items: center; gap: 4px; color: var(--text-secondary); text-decoration: none; font-size: var(--font-13); margin-bottom: 12px; }
    .back-link:hover { color: var(--accent); }
    .back-link .material-icons { font-size: var(--font-18); }

    .room-info h1 { font-size: var(--font-22); font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }

    .room-badges { display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
    .subject-badge { background: rgba(56, 189, 248, 0.1); color: var(--accent); padding: 4px 8px; border-radius: 6px; font-size: var(--font-11); font-weight: 600; }
    .members-badge { background: rgba(34, 197, 94, 0.1); color: var(--success); padding: 4px 8px; border-radius: 6px; font-size: var(--font-11); font-weight: 600; }
    .private-badge { background: rgba(245, 158, 11, 0.1); color: var(--warning); padding: 4px 8px; border-radius: 6px; font-size: var(--font-11); font-weight: 600; }

    .room-description { font-size: var(--font-13); color: var(--text-secondary); }

    .room-actions { display: flex; gap: 8px; }

    .btn-primary { padding: 10px 20px; background: var(--primary); color: white; border: none; border-radius: 8px; font-size: var(--font-14); font-weight: 600; cursor: pointer; white-space: nowrap; transition: background 0.15s; }
    .btn-primary:hover:not(:disabled) { background: var(--primary-hover); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

    .btn-outline-danger { padding: 10px 20px; background: transparent; border: 1px solid var(--error); border-radius: 8px; color: var(--error); font-size: var(--font-14); font-weight: 600; cursor: pointer; white-space: nowrap; transition: all 0.15s; }
    .btn-outline-danger:hover { background: rgba(239, 68, 68, 0.1); }

    .btn-call {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 10px 20px; background: var(--success); border: none; border-radius: 8px;
      color: white; font-size: var(--font-14); font-weight: 600; cursor: pointer; white-space: nowrap;
      transition: background 0.15s;
    }
    .btn-call:hover { background: #16a34a; }
    .btn-call .material-icons { font-size: var(--font-18); }

    .room-content { margin-top: 16px; }

    .members-bar {
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      padding: 14px 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
    }

    .members-title { font-size: var(--font-13); font-weight: 600; color: var(--text-secondary); flex-shrink: 0; }

    .members-avatars { display: flex; gap: 8px; flex-wrap: wrap; }

    .member-chip { display: flex; align-items: center; gap: 6px; padding: 4px 10px 4px 4px; border-radius: 20px; background: var(--background); border: 1px solid var(--border); }

    .member-avatar { width: 24px; height: 24px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; font-weight: 700; color: white; font-size: var(--font-11); overflow: hidden; flex-shrink: 0; }
    .member-avatar.has-image img { width: 100%; height: 100%; object-fit: cover; }

    .member-name { font-size: var(--font-12); color: var(--text-primary); }

    .invite-btn {
      margin-left: auto; display: flex; align-items: center; gap: 4px;
      padding: 6px 12px; background: transparent; border: 1px solid var(--primary);
      border-radius: 8px; color: var(--primary); font-size: var(--font-12); font-weight: 600;
      cursor: pointer; transition: background 0.15s;
    }
    .invite-btn:hover { background: rgba(56, 189, 248, 0.1); }
    .invite-btn .material-icons { font-size: var(--font-16); }

    .invite-dialog-backdrop {
      position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5);
      display: flex; align-items: center; justify-content: center; z-index: 1000;
    }

    .invite-dialog {
      width: 420px; max-width: 90vw; max-height: 80vh; background: var(--surface);
      border: 1px solid var(--border); border-radius: 12px; overflow: hidden;
      display: flex; flex-direction: column;
    }

    .invite-dialog-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px; border-bottom: 1px solid var(--border);
    }
    .invite-dialog-header h3 { font-size: var(--font-15); font-weight: 600; color: var(--text-primary); }

    .dialog-close { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; border-radius: 6px; }
    .dialog-close:hover { color: var(--text-primary); }

    .invite-dialog-body { padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
    .invite-hint { font-size: var(--font-13); color: var(--text-muted); }

    .invite-row { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 8px; }
    .invite-row:hover { background: var(--background); }
    .invite-name { flex: 1; font-size: var(--font-13); font-weight: 500; color: var(--text-primary); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .btn-invite {
      padding: 6px 12px; background: var(--primary); border: none; border-radius: 8px;
      color: white; font-size: var(--font-12); font-weight: 600; cursor: pointer; flex-shrink: 0;
    }
    .btn-invite:hover:not(:disabled) { background: var(--primary-hover); }
    .btn-invite:disabled { opacity: 0.5; cursor: not-allowed; }

    .content-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 16px; }

    .panel { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }

    .panel-header { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid var(--border); }
    .panel-header h2 { font-size: var(--font-15); font-weight: 600; color: var(--text-primary); }

    .online-count { font-size: var(--font-12); color: var(--success); }

    .chat-panel { height: 500px; }

    .messages { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 2px; }

    .day-divider { display: flex; align-items: center; justify-content: center; padding: 12px 0 8px; }
    .day-divider span { font-size: var(--font-11); color: var(--text-muted); background: var(--background); border: 1px solid var(--border); padding: 3px 10px; border-radius: 12px; }

    .message { display: flex; gap: 10px; padding: 2px 0; }

    .message.own { justify-content: flex-end; }
    .message.own .message-body { align-items: flex-end; }

    .message-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: var(--font-12); color: white; flex-shrink: 0; overflow: hidden; align-self: flex-end; margin-bottom: 2px; }
    .message-avatar.has-image img { width: 100%; height: 100%; object-fit: cover; }

    .message-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .message-header { margin-bottom: 2px; padding-left: 2px; }
    .message-user { font-size: var(--font-12); font-weight: 600; color: var(--accent); }

    .bubble { max-width: 70%; padding: 8px 12px; border-radius: 14px; background: var(--background); border: 1px solid var(--border); display: inline-flex; flex-direction: column; align-items: flex-start; gap: 2px; word-break: break-word; }
    .message.own .bubble { background: var(--primary); border-color: var(--primary); border-bottom-right-radius: 4px; }
    .message:not(.own):not(.avatar-gap) .bubble { border-bottom-left-radius: 4px; }

    .bubble-content { font-size: var(--font-13); color: var(--text-primary); line-height: 1.45; white-space: pre-wrap; }
    .message.own .bubble-content { color: white; }

    .message-time { font-size: var(--font-10); color: var(--text-muted); align-self: flex-end; }
    .message.own .message-time { color: rgba(255,255,255,0.7); }

    .chat-input { display: flex; align-items: center; padding: 12px; border-top: 1px solid var(--border); gap: 8px; }
    .chat-input input { flex: 1; padding: 10px 12px; background: var(--background); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); font-size: var(--font-13); outline: none; }
    .chat-input input:focus { border-color: var(--primary); }
    .chat-input input::placeholder { color: var(--text-muted); }

    .send-btn { width: 36px; height: 36px; border-radius: 8px; background: var(--primary); border: none; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.15s; }
    .send-btn:hover:not(:disabled) { background: var(--primary-hover); }
    .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .send-btn .material-icons { font-size: var(--font-18); }

    .notes-panel { height: 500px; }
    .notes-panel ::ng-deep app-notes-editor { flex: 1; display: flex; flex-direction: column; }

    .ai-panel { height: 500px; }
    .ai-panel ::ng-deep app-ai-chat-panel { flex: 1; display: flex; flex-direction: column; height: 100%; }

    .timer-section { margin-top: 0; }

    .call-panel { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; margin-top: 0; margin-bottom: 16px; }
    .call-header { display: flex; align-items: center; gap: 12px; padding: 16px; border-bottom: 1px solid var(--border); }
    .call-header h2 { display: flex; align-items: center; gap: 8px; font-size: var(--font-15); font-weight: 600; color: var(--text-primary); }
    .live-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--error); animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
    .call-hint { flex: 1; font-size: var(--font-12); color: var(--text-muted); }
    .call-frame { width: 100%; height: 480px; border: 0; display: block; }

    .join-prompt { text-align: center; padding: 48px; color: var(--text-muted); }

    @media (max-width: 768px) {
      .call-frame { height: 320px; }
    }

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
  private invitationService = inject(InvitationService);
  private friendService = inject(FriendService);
  private sanitizer = inject(DomSanitizer);

  @ViewChild('messageContainer', { static: false }) messageContainer?: ElementRef;

  roomId = '';
  room?: Room;
  messages: Message[] = [];
  members: UserDto[] = [];
  onlineUsers: string[] = [];
  newMessage = '';
  isMember = false;
  joining = false;
  loading = true;
  notesContext = '';
  showInviteDialog = false;
  friends: Friend[] = [];
  invitingId = '';
  inCall = false;
  private notesSub?: Subscription;

  get currentUserId(): string | undefined {
    return this.auth.currentUser()?.id;
  }

  private cachedCallUrl?: SafeResourceUrl;

  get callUrl(): SafeResourceUrl {
    if (!this.cachedCallUrl) {
      const user = this.auth.currentUser();
      const name = encodeURIComponent(user?.username || user?.email || 'Student');
      const room = encodeURIComponent(`studyroom-${this.roomId}`);
      this.cachedCallUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
        `https://sfu.mirotalk.com/join?room=${room}&name=${name}&audio=1&video=1&screen=1&duration=unlimited`
      );
    }
    return this.cachedCallUrl;
  }

  toggleCall() {
    this.inCall = !this.inCall;
  }

  isFirstOfGroup(index: number): boolean {
    if (index === 0) return true;
    const prev = this.messages[index - 1];
    const cur = this.messages[index];
    if (!prev || prev.userId !== cur.userId) return true;
    const prevTime = new Date(prev.createdAt).getTime();
    const curTime = new Date(cur.createdAt).getTime();
    return curTime - prevTime > 5 * 60 * 1000;
  }

  showDayDivider(index: number): boolean {
    if (index === 0) return true;
    const prev = this.messages[index - 1];
    const cur = this.messages[index];
    if (!prev) return true;
    return new Date(prev.createdAt).toDateString() !== new Date(cur.createdAt).toDateString();
  }

  async ngOnInit() {
    this.roomId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.roomId) return;

    try {
      this.room = await this.roomService.getById(this.roomId).toPromise();
      if (!this.room) { this.router.navigate(['/rooms']); return; }

      const userId = this.auth.currentUser()?.id;
      const members = await this.roomService.getMembers(this.roomId).toPromise();
      this.members = members || [];
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
      this.scrollToBottom();
    } catch { }
  }

  private scrollToBottom() {
    setTimeout(() => {
      try {
        const el = this.messageContainer?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      } catch { }
    }, 0);
  }

  async loadNotes() {
    try {
      const notes = await this.notesService.getNotes(this.roomId).toPromise();
      if (notes) this.notesContext = notes.content;
    } catch { }
    this.notesSub = this.signalR.notesUpdated$.subscribe(data => {
      if (data.roomId === this.roomId) this.notesContext = data.content;
    });
  }

  async setupSignalR() {
    try {
      await this.signalR.startConnection();
      await this.signalR.joinRoom(this.roomId);

      this.signalR.message$.subscribe(msg => {
        if (msg.roomId === this.roomId) {
          this.messages = [...this.messages, msg];
          this.scrollToBottom();
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
      this.inCall = false;
      await this.signalR.leaveRoom(this.roomId);
      await this.roomService.leave(this.roomId).toPromise();
      this.isMember = false;
      this.messages = [];
      this.router.navigate(['/rooms']);
    } catch { }
  }

  get invitableFriends(): Friend[] {
    const memberIds = new Set(this.members.map(m => m.id));
    return this.friends.filter(f => !memberIds.has(f.userId));
  }

  async openInviteDialog(): Promise<void> {
    this.showInviteDialog = true;
    if (this.friends.length === 0) {
      try {
        this.friends = (await this.friendService.getFriends().toPromise()) || [];
      } catch { }
    }
  }

  async inviteFriend(friend: Friend): Promise<void> {
    this.invitingId = friend.userId;
    try {
      await this.invitationService.invite(this.roomId, friend.userId).toPromise();
      this.friends = this.friends.filter(f => f.userId !== friend.userId);
    } catch (err: any) {
      alert(err.error?.error || 'Failed to invite friend.');
    } finally {
      this.invitingId = '';
    }
  }

  ngOnDestroy() {
    this.notesSub?.unsubscribe();
    this.inCall = false;
    if (this.isMember) {
      this.signalR.leaveRoom(this.roomId);
    }
  }
}
