import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RoomService } from '../../core/services/room.service';
import { Room } from '../../shared/models/room.model';
import { LoadingComponent } from '../../shared/components/loading/loading.component';

@Component({
  selector: 'app-room-list',
  standalone: true,
  imports: [RouterLink, NgFor, NgIf, DatePipe, FormsModule, LoadingComponent],
  template: `
    <div class="browse-rooms">
      <!-- ── Hero header card ─────────────────────────────────── -->
      <div class="hero-card">
        <div class="hero-top">
          <div class="hero-greeting">
            <h1>Study Rooms</h1>
            <p>Find your crew, pick a subject, and study together.</p>
          </div>
          <a routerLink="/rooms/create" class="hero-create">
            <span class="material-icons">add_box</span> Create Room
          </a>
        </div>
        <div class="hero-badges">
          <span class="hero-badge">
            <span class="material-icons">meeting_room</span>
            {{ rooms.length }} rooms
          </span>
          <span class="hero-badge">
            <span class="material-icons">apps</span>
            {{ activeSubject || 'All subjects' }}
          </span>
        </div>
      </div>

      <!-- ── Filters ──────────────────────────────────────────── -->
      <div class="filters">
        <div class="search-box">
          <span class="material-icons">search</span>
          <input type="text" [(ngModel)]="search" (input)="loadRooms()" placeholder="Search rooms..." />
        </div>
        <select [(ngModel)]="subject" (change)="loadRooms()" class="subject-filter">
          <option value="">All Subjects</option>
          <option value="Mathematics">Mathematics</option>
          <option value="Physics">Physics</option>
          <option value="Chemistry">Chemistry</option>
          <option value="Biology">Biology</option>
          <option value="Computer Science">Computer Science</option>
          <option value="Literature">Literature</option>
          <option value="History">History</option>
          <option value="Languages">Languages</option>
        </select>
      </div>

      <app-loading [loading]="loading" />

      <div class="room-grid" *ngIf="!loading">
        <div class="room-card" *ngFor="let room of rooms" (click)="navigateToRoom(room.id)">
          <div class="room-card-header">
            <h3>{{ room.name }}</h3>
            <span class="badge badge-accent">{{ room.subject || 'General' }}</span>
          </div>
          <p class="room-desc">{{ room.description || 'No description' }}</p>
          <div class="room-meta">
            <span>{{ room.memberCount }} members</span>
            <span>{{ room.createdAt | date:'mediumDate' }}</span>
          </div>
        </div>

        <div class="room-card empty" *ngIf="rooms.length === 0">
          <p>No rooms found. Create one!</p>
          <a routerLink="/rooms/create" class="btn-outline">Create Room</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .browse-rooms { max-width: 1200px; margin: 0 auto; }

    /* Hero header card */
    .hero-card {
      background: linear-gradient(135deg, var(--primary), var(--accent));
      border-radius: 16px; padding: 28px; margin-bottom: 20px;
      color: white; display: flex; flex-direction: column; gap: 20px;
    }
    .hero-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    .hero-greeting h1 { font-size: var(--font-24); font-weight: 700; margin-bottom: 6px; }
    .hero-greeting p { color: rgba(255,255,255,0.82); font-size: var(--font-14); }
    .hero-create {
      background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.35);
      color: white; padding: 10px 16px; border-radius: 10px; font-weight: 600;
      font-size: var(--font-13); text-decoration: none; white-space: nowrap;
      display: inline-flex; align-items: center; gap: 6px; transition: background 0.15s;
    }
    .hero-create:hover { background: rgba(255,255,255,0.28); }
    .hero-badges { display: flex; gap: 8px; flex-wrap: wrap; }
    .hero-badge {
      display: inline-flex; align-items: center; gap: 6px;
      background: rgba(255,255,255,0.16); border-radius: 8px;
      padding: 6px 10px; font-size: var(--font-12); font-weight: 600;
    }
    .hero-badge .material-icons { font-size: var(--font-16); }

    /* Filters */
    .filters { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }

    .search-box { display: flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 0 12px; flex: 1; min-width: 200px; }
    .search-box .material-icons { color: var(--text-muted); font-size: var(--font-20); }
    .search-box input { flex: 1; padding: 10px 0; background: none; border: none; color: var(--text-primary); font-size: var(--font-14); outline: none; }
    .search-box input::placeholder { color: var(--text-muted); }

    .subject-filter { padding: 10px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); font-size: var(--font-14); outline: none; cursor: pointer; }

    .room-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }

    .room-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px; cursor: pointer; transition: border-color 0.15s; }
    .room-card:hover { border-color: var(--primary); }
    .room-card.empty { cursor: default; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .room-card.empty:hover { border-color: var(--border); }

    .room-card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
    .room-card-header h3 { font-size: var(--font-15); font-weight: 600; color: var(--text-primary); flex: 1; }
    .room-desc { font-size: var(--font-13); color: var(--text-secondary); margin-bottom: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .room-meta { display: flex; justify-content: space-between; font-size: var(--font-12); color: var(--text-muted); }

    @media (max-width: 768px) {
      .hero-top { flex-direction: column; }
    }
  `]
})
export class RoomListComponent implements OnInit {
  private roomService = inject(RoomService);
  private router = inject(Router);

  rooms: Room[] = [];
  search = '';
  subject = '';
  loading = true;

  get activeSubject(): string {
    return this.subject || 'All subjects';
  }

  async ngOnInit() {
    await this.loadRooms();
  }

  async loadRooms() {
    this.loading = true;
    try {
      this.rooms = await this.roomService.getAll(this.search || undefined, this.subject || undefined).toPromise() || [];
    } catch { } finally {
      this.loading = false;
    }
  }

  navigateToRoom(id: string) {
    this.router.navigate(['/rooms', id]);
  }
}