import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FriendService } from '../core/services/friend.service';
import { StatisticsService, FriendLeaderboardRow } from '../core/services/statistics.service';
import { UiFeedbackService } from '../core/services/ui-feedback.service';
import { Friend, UserSearchResult, FriendPresence } from '../shared/models/social.model';
import { HeroCardComponent } from '../shared/components/hero-card/hero-card.component';

@Component({
  selector: 'app-people',
  standalone: true,
  imports: [NgFor, NgIf, DatePipe, FormsModule, RouterLink, HeroCardComponent],
  template: `
    <div class="people-page">
      <app-hero-card
        title="People"
        subtitle="Discover classmates, send requests and build your network."
        [badges]="heroBadges"
      ></app-hero-card>

      <div class="view-toggle">
        <button class="view-btn" [class.active]="mode === 'discover'" (click)="showDiscover()">
          <span class="material-icons">explore</span> Discover
        </button>
        <button class="view-btn" [class.active]="mode === 'friends'" (click)="mode = 'friends'">
          <span class="material-icons">group</span> Friends
        </button>
        <button class="view-btn" [class.active]="mode === 'leaderboard'" (click)="showLeaderboard()">
          <span class="material-icons">leaderboard</span> Leaderboard
        </button>
      </div>

      <!-- Search -->
      <div *ngIf="mode === 'discover'" class="card">
        <div class="card-head">
          <div class="card-head-icon"><span class="material-icons">search</span></div>
          <div>
            <h2>Find People</h2>
            <p class="card-subtitle">Search by name, username or school.</p>
          </div>
        </div>
        <div class="search-box">
          <span class="material-icons search-icon">search</span>
          <input
            type="text"
            [(ngModel)]="query"
            placeholder="Search by name, username or school…"
            (input)="search()"
          />
        </div>

        <div *ngIf="results.length > 0" class="results-wrap">
          <div *ngFor="let user of results" class="person-row">
            <div class="avatar-wrap">
              <div class="avatar" [class.has-image]="user.avatarUrl">
                <img *ngIf="user.avatarUrl; else initial" [src]="user.avatarUrl" alt="" />
                <ng-template #initial>{{ (user.displayName || user.username).charAt(0).toUpperCase() }}</ng-template>
              </div>
              <span *ngIf="presenceOf(user.id)" class="presence-dot" [class.online]="presenceOf(user.id)?.isOnline"></span>
            </div>
            <div class="person-info" [routerLink]="['/profile', profileId(user)]">
              <span class="person-name">{{ user.displayName || '@' + user.username }}</span>
              <span class="person-sub" *ngIf="user.schoolName">{{ user.schoolName }}</span>
              <span *ngIf="user.mutualCount || user.sharedRoomCount" class="person-chips">
                <span *ngIf="user.mutualCount" class="chip">
                  <span class="material-icons">group</span> {{ user.mutualCount }} mutual
                </span>
                <span *ngIf="user.sharedRoomCount" class="chip">
                  <span class="material-icons">meeting_room</span> {{ user.sharedRoomCount }} shared
                </span>
              </span>
            </div>
            <div class="row-actions">
              <button
                *ngIf="user.relationship === 'None'"
                class="btn-primary"
                (click)="sendRequest(user)"
              >
                Add Friend
              </button>
              <span *ngIf="user.relationship === 'RequestSent'" class="status-label">Request Sent</span>
              <button
                *ngIf="user.relationship === 'RequestReceived'"
                class="btn-accent"
                (click)="acceptFromSearch(user)"
              >
                Accept Request
              </button>
              <span *ngIf="user.relationship === 'Friends'" class="status-label friends">Friends</span>
            </div>
          </div>
        </div>
        <div *ngIf="query && !loading && results.length === 0" class="empty">No people found.</div>
      </div>

      <!-- Discover -->
      <div *ngIf="mode === 'discover' && suggestions.length > 0" class="card">
        <div class="card-head">
          <div class="card-head-icon"><span class="material-icons">explore</span></div>
          <div>
            <h2>Discover</h2>
            <p class="card-subtitle">People you may know first, then others worth connecting with.</p>
          </div>
          <span class="discover-count">{{ suggestions.length }} people</span>
        </div>
          <div *ngFor="let user of suggestions" class="person-row">
            <div class="avatar-wrap">
              <div class="avatar" [class.has-image]="user.avatarUrl">
                <img *ngIf="user.avatarUrl; else sugInitial" [src]="user.avatarUrl" alt="" />
                <ng-template #sugInitial>{{ (user.displayName || user.username).charAt(0).toUpperCase() }}</ng-template>
              </div>
              <span *ngIf="presenceOf(user.id)" class="presence-dot" [class.online]="presenceOf(user.id)?.isOnline"></span>
            </div>
            <div class="person-info" [routerLink]="['/profile', user.id]">
              <span class="person-name">{{ user.displayName || '@' + user.username }}</span>
              <span *ngIf="user.mutualCount || user.sharedRoomCount" class="person-chips">
                <span *ngIf="user.mutualCount" class="chip">
                  <span class="material-icons">group</span> {{ user.mutualCount }} mutual
                </span>
                <span *ngIf="user.sharedRoomCount" class="chip">
                  <span class="material-icons">meeting_room</span> {{ user.sharedRoomCount }} shared
                </span>
              </span>
              <span *ngIf="user.reason" class="person-reason">{{ user.reason }}</span>
            </div>
          <button
            *ngIf="user.relationship === 'None'"
            class="btn-primary"
            (click)="sendRequest(user)"
          >
            Add Friend
          </button>
          <span *ngIf="user.relationship === 'RequestSent'" class="status-label">Request Sent</span>
        </div>
      </div>

      <div class="cards-row">
        <!-- Friend Requests -->
        <div *ngIf="mode === 'friends' && requests.length > 0" class="card">
          <div class="card-head">
            <div class="card-head-icon"><span class="material-icons">person_add</span></div>
            <div>
              <h2>Friend Requests</h2>
              <p class="card-subtitle">Pending requests you can accept or decline.</p>
            </div>
          </div>
          <div *ngFor="let req of requests" class="person-row">
            <div class="avatar-wrap">
              <div class="avatar" [class.has-image]="req.avatarUrl">
                <img *ngIf="req.avatarUrl; else reqInitial" [src]="req.avatarUrl" alt="" />
                <ng-template #reqInitial>{{ (req.displayName || req.username).charAt(0).toUpperCase() }}</ng-template>
              </div>
              <span *ngIf="presenceOf(req.userId)" class="presence-dot" [class.online]="presenceOf(req.userId)?.isOnline"></span>
            </div>
            <div class="person-info" [routerLink]="['/profile', req.userId]">
              <span class="person-name">{{ req.displayName || '@' + req.username }}</span>
            </div>
            <div class="row-actions">
              <button class="btn-accent" (click)="accept(req)">Accept</button>
              <button class="btn-secondary" (click)="decline(req)">Decline</button>
            </div>
          </div>
        </div>

        <!-- Sent Requests -->
        <div *ngIf="mode === 'friends' && sentRequests.length > 0" class="card">
          <div class="card-head">
            <div class="card-head-icon muted"><span class="material-icons">outgoing_mail</span></div>
            <div>
              <h2>Sent Requests</h2>
              <p class="card-subtitle">Requests you've sent that are still pending.</p>
            </div>
          </div>
          <div *ngFor="let req of sentRequests" class="person-row">
            <div class="avatar-wrap">
              <div class="avatar" [class.has-image]="req.avatarUrl">
                <img *ngIf="req.avatarUrl; else sentInitial" [src]="req.avatarUrl" alt="" />
                <ng-template #sentInitial>{{ (req.displayName || req.username).charAt(0).toUpperCase() }}</ng-template>
              </div>
              <span *ngIf="presenceOf(req.userId)" class="presence-dot" [class.online]="presenceOf(req.userId)?.isOnline"></span>
            </div>
            <div class="person-info" [routerLink]="['/profile', req.userId]">
              <span class="person-name">{{ req.displayName || '@' + req.username }}</span>
              <span class="person-sub" *ngIf="req.createdAt">sent {{ req.createdAt | date:'mediumDate' }}</span>
            </div>
            <div class="row-actions">
              <button class="btn-secondary" (click)="cancelRequest(req)">Cancel</button>
            </div>
          </div>
        </div>

        <!-- My Friends -->
        <div *ngIf="mode === 'friends'" class="card">
          <div class="card-head">
            <div class="card-head-icon"><span class="material-icons">group</span></div>
            <div>
              <h2>My Friends</h2>
              <p class="card-subtitle">People you're connected with.</p>
            </div>
            <span class="discover-count">{{ onlineFriendCount }} online</span>
          </div>
          <div *ngIf="friends.length === 0" class="empty">No friends yet. Add some people above!</div>
          <div *ngFor="let friend of friends" class="person-row">
            <div class="avatar-wrap">
              <div class="avatar" [class.has-image]="friend.avatarUrl">
                <img *ngIf="friend.avatarUrl; else friendInitial" [src]="friend.avatarUrl" alt="" />
                <ng-template #friendInitial>{{ (friend.displayName || friend.username).charAt(0).toUpperCase() }}</ng-template>
              </div>
              <span *ngIf="presenceOf(friend.userId)" class="presence-dot" [class.online]="presenceOf(friend.userId)?.isOnline"></span>
            </div>
            <div class="person-info" [routerLink]="['/profile', friend.userId]">
              <span class="person-name">{{ friend.displayName || '@' + friend.username }}</span>
              <span *ngIf="!presenceOf(friend.userId)?.isOnline" class="person-sub">Last seen {{ lastSeenText(presenceOf(friend.userId)?.lastSeenAt) }}</span>
            </div>
            <button class="btn-secondary danger" (click)="unfriend(friend)">Remove</button>
          </div>
        </div>
      </div>

      <!-- Leaderboard -->
      <div *ngIf="mode === 'leaderboard'" class="card full">
        <div class="card-head">
          <div class="card-head-icon"><span class="material-icons">leaderboard</span></div>
          <div>
            <h2>Friends Leaderboard</h2>
            <p class="card-subtitle">Weekly XP earned by you and your friends — focus sessions fuel the climb.</p>
          </div>
          <span class="discover-count">7-day round</span>
        </div>

        <div class="lb-strip">
          <div class="lb-me">
            <div class="lb-avatar">
              <img *ngIf="myRow?.avatarUrl; else meInitial" [src]="myRow?.avatarUrl" alt="" />
              <ng-template #meInitial>{{ (myRow?.displayName || myRow?.username || 'Me').charAt(0).toUpperCase() }}</ng-template>
            </div>
            <div class="lb-me-info">
              <span class="lb-me-rank">#{{ myRow?.rank || '–' }}</span>
              <span class="lb-me-name">{{ myRow?.displayName || myRow?.username || 'You' }}</span>
              <span class="lb-me-xp">{{ myRow?.weeklyXp || 0 }} XP this week · Level {{ myRow?.level || 1 }}</span>
            </div>
          </div>
          <div class="lb-me-bar">
            <div class="progress-bar">
              <div class="progress-fill" [style.width.%]="myRow ? pctOf(myRow.weeklyXp) : 0"></div>
            </div>
          </div>
        </div>

        <div *ngIf="leaderboard.length === 0" class="empty">No ranked friends yet — complete a focus session to earn your first XP.</div>
        <div *ngFor="let row of leaderboard" class="lb-row" [class.me]="row.isMe" (click)="openProfile(row)">
          <span class="lb-rank" [class.top3]="row.rank <= 3">
            <span *ngIf="row.rank === 1" class="material-icons rank-icon">military_tech</span>
            <span *ngIf="row.rank === 2" class="material-icons rank-icon">emoji_events</span>
            <span *ngIf="row.rank === 3" class="material-icons rank-icon">workspace_premium</span>
            <span *ngIf="row.rank > 3">{{ row.rank }}</span>
          </span>
          <div class="lb-avatar">
            <img *ngIf="row.avatarUrl; else lbInitial" [src]="row.avatarUrl" alt="" />
            <ng-template #lbInitial>{{ row.displayName.charAt(0).toUpperCase() }}</ng-template>
          </div>
          <div class="lb-info">
            <span class="lb-name">
              {{ row.displayName }}
              <span *ngIf="row.isMe" class="lb-me-tag">You</span>
            </span>
            <span class="lb-sub">Level {{ row.level }} · {{ row.streak }} day streak · {{ row.thisWeekMinutes }} min this week</span>
            <div class="lb-bar">
              <div class="lb-bar-fill" [style.width.%]="pctOf(row.weeklyXp)"></div>
            </div>
          </div>
          <span class="lb-xp">{{ row.weeklyXp }} XP</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .people-page { max-width: 900px; margin: 0 auto; }

    .page-header { margin-bottom: 24px; }
    .page-header h1 { font-size: var(--font-24); font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
    .page-subtitle { font-size: var(--font-14); color: var(--text-secondary); }

    .view-toggle {
      display: inline-flex;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 4px;
      gap: 4px;
      margin-bottom: 24px;
    }
    .view-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: none;
      background: none;
      color: var(--text-secondary);
      padding: 9px 18px;
      border-radius: 8px;
      font-size: var(--font-14);
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .view-btn .material-icons { font-size: var(--font-18); }
    .view-btn:hover { color: var(--text-primary); }
    .view-btn.active { background: var(--primary); color: white; }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .card.full { max-width: 100%; }

    .card-head { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
    .card-head-icon {
      width: 44px; height: 44px; border-radius: 12px;
      background: var(--primary); color: white;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .card-head-icon .material-icons { font-size: var(--font-22); }
    .card-head-icon.muted { background: var(--text-secondary); }
    .card-head h2 { font-size: var(--font-18); font-weight: 600; color: var(--text-primary); margin: 0; }
    .card-subtitle { font-size: var(--font-13); color: var(--text-secondary); margin: 2px 0 0; }
    .discover-count {
      margin-left: auto; flex-shrink: 0;
      font-size: var(--font-12); font-weight: 600; color: var(--success);
      background: color-mix(in srgb, var(--success) 10%, transparent);
      border: 1px solid color-mix(in srgb, var(--success) 25%, transparent);
      padding: 4px 10px; border-radius: 12px;
    }

    .search-box {
      display: flex; align-items: center; gap: 10px;
      background: var(--background); border: 1px solid var(--border);
      border-radius: 10px; padding: 12px 14px;
    }
    .search-box:focus-within { border-color: var(--primary); }
    .search-icon { color: var(--text-muted); }
    .search-box input {
      flex: 1; background: none; border: none; color: var(--text-primary);
      font-size: var(--font-14); outline: none;
    }

    .results-wrap { margin-top: 8px; }

    .person-row {
      display: flex; align-items: center; gap: 14px;
      padding: 12px 2px; border-bottom: 1px solid var(--border);
    }
    .person-row:last-child { border-bottom: none; }

    .avatar-wrap { position: relative; width: 40px; height: 40px; flex-shrink: 0; }
    .presence-dot {
      position: absolute; bottom: 0; right: 0;
      width: 12px; height: 12px; border-radius: 50%;
      background: var(--text-muted);
      border: 2px solid var(--surface);
      box-sizing: border-box;
    }
    .presence-dot.online {
      background: var(--success);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--success) 30%, transparent);
    }

    .person-info { display: flex; flex-direction: column; flex: 1; min-width: 0; cursor: pointer; }
    .person-name { font-size: var(--font-15); font-weight: 600; color: var(--text-primary); }
    .person-sub { font-size: var(--font-13); color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .person-seen { font-size: var(--font-12); color: var(--text-muted); }
    .person-reason { font-size: var(--font-12); color: var(--primary); font-weight: 500; margin-top: 2px; }

    .person-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px; }
    .chip {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: var(--font-12); font-weight: 600;
      color: var(--primary);
      background: color-mix(in srgb, var(--primary) 12%, transparent);
      border: 1px solid color-mix(in srgb, var(--primary) 25%, transparent);
      border-radius: 12px; padding: 2px 8px;
    }
    .chip .material-icons { font-size: 13px; }

    .row-actions { display: flex; gap: 10px; align-items: center; flex-shrink: 0; }

    .status-label { font-size: var(--font-13); color: var(--text-muted); font-weight: 500; }
    .status-label.friends { color: var(--success); }

    .cards-row { display: grid; grid-template-columns: 1fr; grid-auto-rows: 1fr; gap: 24px; }
    .cards-row .card { margin-bottom: 0; }

    /* Mobile: pin the Discover / Friends / Leaderboard toggle to the bottom,
       mirroring the room-detail mobile tab bar, and pad content so nothing
       hides behind it. */
    @media (max-width: 768px) {
      .people-page { padding-bottom: calc(var(--mobile-tabbar-height, 66px) + 32px); }

      .view-toggle {
        position: fixed; left: 0; right: 0; bottom: 0; z-index: 1150;
        display: flex; background: var(--surface);
        border: none; border-top: 1px solid var(--border); border-radius: 0;
        padding: 4px 0 calc(env(safe-area-inset-bottom) + 2px); margin: 0; gap: 0;
      }
      .view-btn {
        flex: 1; flex-direction: column; gap: 2px; padding: 2px 0 6px;
        border-radius: 8px; font-size: var(--font-10); justify-content: center;
      }
      .view-btn .material-icons { font-size: 20px; }
      .view-btn.active { background: color-mix(in srgb, var(--primary) 12%, transparent); color: var(--primary); }
    }

    /* Leaderboard */
    .progress-bar { width: 100%; height: 8px; background: var(--background); border-radius: 4px; overflow: hidden; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, var(--primary), var(--accent)); border-radius: 4px; transition: width 0.6s ease; }
    .lb-strip {
      display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 12px; padding: 14px 16px; margin-bottom: 14px;
    }
    .lb-me { display: flex; align-items: center; gap: 12px; }
    .lb-avatar {
      width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
      background: var(--primary); color: white; overflow: hidden;
      display: flex; align-items: center; justify-content: center;
      font-size: var(--font-15); font-weight: 700;
    }
    .lb-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .lb-me-info { display: flex; flex-direction: column; }
    .lb-me-rank { font-size: var(--font-11); color: var(--accent); font-weight: 700; }
    .lb-me-name { font-size: var(--font-14); font-weight: 700; color: var(--text-primary); }
    .lb-me-xp { font-size: var(--font-12); color: var(--text-muted); }
    .lb-me-bar { flex: 1; min-width: 200px; }

    .lb-row {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 4px; border-bottom: 1px solid var(--border);
      cursor: pointer; transition: background 0.15s;
      border-radius: 8px;
    }
    .lb-row:hover { background: var(--surface-hover); }
    .lb-row:last-child { border-bottom: none; }
    .lb-row.me {
      background: color-mix(in srgb, var(--primary) 10%, transparent);
      border-radius: 10px; padding: 10px 8px;
    }
    .lb-rank {
      width: 34px; height: 34px; flex-shrink: 0; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: var(--font-13); color: var(--text-muted);
      background: var(--surface);
    }
    .lb-rank.top3 .rank-icon { font-size: 18px; }
    .lb-rank .rank-icon { color: #f59e0b; }
    .lb-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .lb-name { font-size: var(--font-14); font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 6px; }
    .lb-me-tag {
      font-size: var(--font-10); font-weight: 700; text-transform: uppercase;
      background: var(--primary); color: white; padding: 1px 6px; border-radius: 6px;
    }
    .lb-sub { font-size: var(--font-11); color: var(--text-muted); }
    .lb-bar { height: 6px; border-radius: 3px; background: var(--surface); overflow: hidden; max-width: 280px; }
    .lb-bar-fill { height: 100%; border-radius: 3px; background: var(--accent); }
    .lb-xp { font-size: var(--font-13); font-weight: 700; color: var(--text-primary); flex-shrink: 0; }
  `]
})
export class PeopleComponent implements OnInit, OnDestroy {
  private friendService = inject(FriendService);
  private statsService = inject(StatisticsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(UiFeedbackService);

  query = '';
  results: UserSearchResult[] = [];
  suggestions: UserSearchResult[] = [];
  requests: Friend[] = [];
  sentRequests: Friend[] = [];
  friends: Friend[] = [];
  loading = false;
  mode: 'discover' | 'friends' | 'leaderboard' = 'discover';
  leaderboard: FriendLeaderboardRow[] = [];

  get heroBadges() {
    const badges = [];
    badges.push({ icon: 'group', text: `${this.friends.length} friends` });
    if (this.requests.length > 0) badges.push({ icon: 'person_add', text: `${this.requests.length} requests` });
    return badges;
  }
  private presenceMap = new Map<string, FriendPresence>();
  private refreshTimer?: any;

  ngOnInit(): void {
    const view = this.route.snapshot.queryParamMap.get('view');
    if (view === 'leaderboard') {
      this.mode = 'leaderboard';
      this.loadLeaderboard();
      return;
    }
    this.loadAll().then(() => this.syncPresence());
    this.refreshTimer = setInterval(() => {
      this.loadSuggestions().then(() => this.syncPresence());
    }, 60000);
  }

  get myRow(): FriendLeaderboardRow | undefined {
    return this.leaderboard.find(r => r.isMe);
  }

  get maxWeeklyXp(): number {
    return Math.max(1, ...this.leaderboard.map(r => r.weeklyXp));
  }

  pctOf(xp: number): number {
    return Math.max(0, Math.min(100, Math.round((xp / this.maxWeeklyXp) * 100)));
  }

  async showLeaderboard(): Promise<void> {
    this.mode = 'leaderboard';
    await this.loadLeaderboard();
    await this.syncPresence();
  }

  async loadLeaderboard(): Promise<void> {
    this.leaderboard = (await this.statsService.getFriendLeaderboard().toPromise()) || [];
  }

  openProfile(row: FriendLeaderboardRow): void {
    if (row.isMe) {
      this.mode = 'friends';
      return;
    }
    this.router.navigate(['/profile', row.userId]);
  }

  showDiscover(): void {
    this.mode = 'discover';
    this.loadSuggestions().then(() => this.syncPresence());
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  async loadAll(): Promise<void> {
    await Promise.all([this.loadRequests(), this.loadSentRequests(), this.loadFriends(), this.loadSuggestions()]);
  }

  async loadSuggestions(): Promise<void> {
    this.suggestions = (await this.friendService.getSuggestions().toPromise()) || [];
  }

  async loadRequests(): Promise<void> {
    this.requests = (await this.friendService.getIncomingRequests().toPromise()) || [];
  }

  async loadSentRequests(): Promise<void> {
    this.sentRequests = (await this.friendService.getOutgoingRequests().toPromise()) || [];
  }

  async loadFriends(): Promise<void> {
    this.friends = (await this.friendService.getFriends().toPromise()) || [];
  }

  search(): void {
    if (!this.query.trim()) {
      this.results = [];
      return;
    }
    this.loading = true;
    this.friendService.searchUsers(this.query.trim()).subscribe({
      next: (r) => {
        this.results = r || [];
        this.syncPresence();
      },
      error: () => {
        this.results = [];
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  async syncPresence(): Promise<void> {
    const ids = new Set<string>();
    for (const r of this.results) ids.add(r.id);
    for (const s of this.suggestions) ids.add(s.id);
    for (const f of [...this.requests, ...this.sentRequests, ...this.friends]) ids.add(f.userId);
    if (ids.size === 0) {
      this.presenceMap.clear();
      return;
    }
    try {
      const statuses = (await this.friendService.getUsersPresence([...ids]).toPromise()) || [];
      const next = new Map<string, FriendPresence>();
      for (const s of statuses) next.set(s.userId, s);
      this.presenceMap = next;
    } catch {
      this.presenceMap.clear();
    }
  }

  presenceOf(userId: string): FriendPresence | undefined {
    return this.presenceMap.get(userId);
  }

  get onlineFriendCount(): number {
    return this.friends.filter(f => this.presenceMap.get(f.userId)?.isOnline).length;
  }

  lastSeenText(iso?: string): string {
    if (!iso) return 'recently';
    const then = new Date(iso).getTime();
    const diffMs = Date.now() - then;
    if (diffMs < 0 || diffMs < 60000) return 'just now';
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
    return new Date(iso).toLocaleDateString();
  }

  async sendRequest(user: UserSearchResult): Promise<void> {
    await this.friendService.sendRequest(user.id).toPromise();
    user.relationship = 'RequestSent';
  }

  async acceptFromSearch(user: UserSearchResult): Promise<void> {
    if (!user.relationshipId) return;
    await this.friendService.acceptRequest(user.relationshipId).toPromise();
    user.relationship = 'Friends';
  }

  async accept(req: Friend): Promise<void> {
    await this.friendService.acceptRequest(req.id).toPromise();
    await this.loadAll();
    await this.syncPresence();
  }

  async decline(req: Friend): Promise<void> {
    const ok = await this.fb.confirm({
      title: 'Decline request',
      message: `Decline the friend request from ${req.displayName || '@' + req.username}?`,
      confirmLabel: 'Decline',
      danger: true
    });
    if (!ok) return;
    await this.friendService.deleteRequest(req.id).toPromise();
    await this.loadAll();
    await this.syncPresence();
    this.fb.success('Friend request declined.');
  }

  async cancelRequest(req: Friend): Promise<void> {
    const ok = await this.fb.confirm({
      title: 'Cancel request',
      message: `Cancel your friend request to ${req.displayName || '@' + req.username}?`,
      confirmLabel: 'Cancel request'
    });
    if (!ok) return;
    await this.friendService.deleteRequest(req.id).toPromise();
    await this.loadAll();
    await this.syncPresence();
  }

  async unfriend(friend: Friend): Promise<void> {
    const ok = await this.fb.confirm({
      title: 'Remove friend',
      message: `Remove ${friend.displayName || '@' + friend.username} from your friends?`,
      confirmLabel: 'Remove',
      danger: true
    });
    if (!ok) return;
    await this.friendService.removeFriend(friend.userId).toPromise();
    await this.loadAll();
    await this.syncPresence();
  }

  profileId(user: any): string {
    return user?.id || user?.userId || user?.UserId || '';
  }
}