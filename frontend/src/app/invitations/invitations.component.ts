import { Component, inject } from '@angular/core';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { InvitationService } from '../core/services/invitation.service';
import { RoomInvitation } from '../shared/models/social.model';
import { LoadingComponent } from '../shared/components/loading/loading.component';
import { HeroCardComponent } from '../shared/components/hero-card/hero-card.component';

@Component({
  selector: 'app-invitations',
  standalone: true,
  imports: [NgFor, NgIf, DatePipe, LoadingComponent, HeroCardComponent],
  template: `
    <div class="invitations-page">
      <app-hero-card title="Room Invitations" subtitle="Accept or decline invites to study rooms." [badges]="heroBadges"></app-hero-card>

      <app-loading [loading]="loading" />

      <div *ngIf="!loading && invitations.length === 0" class="empty">
        <span class="material-icons">mail</span>
        <p>You have no pending room invitations.</p>
      </div>

      <div class="invite-list">
        <div class="invite-card" *ngFor="let inv of invitations">
          <div class="invite-icon"><span class="material-icons">meeting_room</span></div>
          <div class="invite-info">
            <span class="invite-room">{{ inv.roomName }}</span>
            <span class="badge badge-accent invite-subject">{{ inv.roomSubject || 'General' }}</span>
            <span class="invite-meta">{{ inv.inviterName }} invited you · {{ inv.createdAt | date: 'medium' }}</span>
          </div>
          <div class="invite-actions">
            <button class="btn-accent" (click)="accept(inv)" [disabled]="processing">
              <span class="material-icons">check</span> Accept
            </button>
            <button class="btn-outline-danger btn-icon" (click)="decline(inv)" [disabled]="processing">
              <span class="material-icons">close</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .invitations-page { max-width: 800px; margin: 0 auto; }

    .invite-list { display: flex; flex-direction: column; gap: 12px; }

    .invite-card {
      display: flex; align-items: center; gap: 16px; padding: 16px;
      background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
      transition: border-color 0.15s;
    }
    .invite-card:hover { border-color: var(--primary); }

    .invite-icon {
      width: 48px; height: 48px; border-radius: 12px; background: rgba(56, 189, 248, 0.1);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .invite-icon .material-icons { color: var(--accent); font-size: var(--font-24); }

    .invite-info { flex: 1; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .invite-room { font-size: var(--font-15); font-weight: 600; color: var(--text-primary); }
    .invite-subject { align-self: flex-start; }
    .invite-meta { font-size: var(--font-12); color: var(--text-muted); }

    .invite-actions { display: flex; gap: 8px; flex-shrink: 0; }

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

  get heroBadges() {
    return [{ icon: 'mail', text: `${this.invitations.length} pending` }];
  }

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
