import { Component, inject } from '@angular/core';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { InvitationService } from '../core/services/invitation.service';
import { RoomInvitation } from '../shared/models/social.model';

@Component({
  selector: 'app-invitations',
  standalone: true,
  imports: [NgFor, NgIf, DatePipe],
  template: `
    <div class="invitations-page">
      <div class="page-header">
        <h1>Room Invitations</h1>
      </div>

      <div *ngIf="loading" class="loading">Loading…</div>

      <div *ngIf="!loading && invitations.length === 0" class="empty">
        <p>You have no pending room invitations.</p>
      </div>

      <div class="invite-list">
        <div class="invite-card" *ngFor="let inv of invitations">
          <div class="invite-icon"><span class="material-icons">meeting_room</span></div>
          <div class="invite-info">
            <span class="invite-room">{{ inv.roomName }}</span>
            <span class="invite-subject">{{ inv.roomSubject || 'General' }}</span>
            <span class="invite-meta">{{ inv.inviterName }} invited you · {{ inv.createdAt | date: 'medium' }}</span>
          </div>
          <div class="invite-actions">
            <button class="btn-accept" (click)="accept(inv)" [disabled]="processing">
              <span class="material-icons">check</span> Accept
            </button>
            <button class="btn-decline" (click)="decline(inv)" [disabled]="processing">
              <span class="material-icons">close</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .invitations-page { max-width: 800px; }

    .empty { text-align: center; padding: 48px; color: var(--text-muted); background: var(--surface); border: 1px solid var(--border); border-radius: 12px; }
    .loading { text-align: center; padding: 48px; color: var(--text-muted); }

    .invite-list { display: flex; flex-direction: column; gap: 12px; }

    .invite-card {
      display: flex; align-items: center; gap: 16px; padding: 16px;
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
    }

    .invite-icon {
      width: 48px; height: 48px; border-radius: 12px; background: rgba(56, 189, 248, 0.1);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .invite-icon .material-icons { color: var(--accent); font-size: var(--font-24); }

    .invite-info { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .invite-room { font-size: var(--font-15); font-weight: 600; color: var(--text-primary); }
    .invite-subject { font-size: var(--font-12); color: var(--accent); margin-bottom: 2px; }
    .invite-meta { font-size: var(--font-12); color: var(--text-muted); }

    .invite-actions { display: flex; gap: 8px; flex-shrink: 0; }

    .btn-accept {
      display: flex; align-items: center; gap: 4px; padding: 8px 14px;
      background: var(--primary); border: none; border-radius: 8px; color: white;
      font-size: var(--font-13); font-weight: 600; cursor: pointer; transition: background 0.15s;
    }
    .btn-accept:hover:not(:disabled) { background: var(--primary-hover); }
    .btn-accept:disabled, .btn-decline:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-accept .material-icons { font-size: var(--font-16); }

    .btn-decline {
      width: 36px; height: 36px; border-radius: 8px; background: transparent;
      border: 1px solid var(--error); color: var(--error); cursor: pointer;
      display: flex; align-items: center; justify-content: center; transition: background 0.15s;
    }
    .btn-decline:hover:not(:disabled) { background: rgba(239, 68, 68, 0.1); }
    .btn-decline .material-icons { font-size: var(--font-16); }

    @media (max-width: 600px) {
      .invite-card { flex-direction: column; align-items: flex-start; }
    }
  `]
})
export class InvitationsComponent {
  private invitationsService = inject(InvitationService);
  private router = inject(Router);

  invitations: RoomInvitation[] = [];
  loading = true;
  processing = false;

  async ngOnInit() {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    try {
      this.invitations = (await this.invitationsService.getIncoming().toPromise()) || [];
    } catch { } finally {
      this.loading = false;
    }
  }

  async accept(inv: RoomInvitation): Promise<void> {
    this.processing = true;
    try {
      await this.invitationsService.accept(inv.id).toPromise();
      this.invitations = this.invitations.filter(i => i.id !== inv.id);
      this.router.navigate(['/rooms', inv.roomId]);
    } catch (err: any) {
      alert(err.error?.error || 'Failed to accept invitation.');
    } finally {
      this.processing = false;
    }
  }

  async decline(inv: RoomInvitation): Promise<void> {
    this.processing = true;
    try {
      await this.invitationsService.decline(inv.id).toPromise();
      this.invitations = this.invitations.filter(i => i.id !== inv.id);
    } catch (err: any) {
      alert(err.error?.error || 'Failed to decline invitation.');
    } finally {
      this.processing = false;
    }
  }
}
