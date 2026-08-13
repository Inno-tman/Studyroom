import { Component, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RoomService } from '../../../core/services/room.service';
import { Room } from '../../../shared/models/room.model';

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: string;
  run: () => void;
}

@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule],
  template: `
    <div class="palette-backdrop" *ngIf="open()" (click)="close()" (keydown)="onBackdropKeydown($event)">
      <div class="palette" (click)="$event.stopPropagation()">
        <div class="palette-input-wrap">
          <span class="material-icons palette-search-icon">search</span>
          <input
            class="palette-input"
            #searchInput
            [(ngModel)]="query"
            (input)="applyFilter()"
            (keydown)="onInputKeydown($event)"
            placeholder="Type a command…  (e.g. open a room, start a call)"
          />
          <kbd class="palette-esc">esc</kbd>
        </div>

        <div class="palette-results" *ngIf="filtered().length > 0">
          <button
            *ngFor="let cmd of filtered(); let i = index"
            class="palette-row"
            [class.active]="selectedIndex() === i"
            (mouseenter)="selectedIndex.set(i)"
            (click)="runCommand(cmd)"
          >
            <span class="material-icons row-icon">{{ cmd.icon }}</span>
            <span class="row-label">{{ cmd.label }}</span>
            <span class="row-hint" *ngIf="cmd.hint">{{ cmd.hint }}</span>
          </button>
        </div>

        <div class="palette-empty" *ngIf="filtered().length === 0">
          No results for “{{ query }}”
        </div>

        <div class="palette-footer">
          <span><kbd>↑</kbd> <kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: contents; }
    .palette-backdrop {
      position: fixed; inset: 0; z-index: 200;
      background: rgba(0, 0, 0, 0.45);
      display: flex; align-items: flex-start; justify-content: center;
      padding-top: 12vh;
    }
    .palette {
      width: min(560px, 92vw);
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      box-shadow: 0 24px 60px rgba(0,0,0,0.35);
      overflow: hidden;
    }
    .palette-input-wrap {
      display: flex; align-items: center; gap: 10px;
      padding: 14px 16px;
      border-bottom: 1px solid var(--border);
    }
    .palette-search-icon { color: var(--text-muted); }
    .palette-input {
      flex: 1; background: none; border: none; outline: none;
      color: var(--text-primary); font-size: var(--font-16);
    }
    .palette-input::placeholder { color: var(--text-muted); }
    kbd {
      background: var(--background); border: 1px solid var(--border);
      border-bottom-width: 2px; border-radius: 4px; padding: 1px 6px;
      font-size: var(--font-11); color: var(--text-muted);
      font-family: inherit;
    }
    .palette-esc { margin-left: 4px; }
    .palette-results {
      max-height: 360px; overflow-y: auto; padding: 6px;
    }
    .palette-row {
      display: flex; align-items: center; gap: 12px; width: 100%;
      background: none; border: none; border-radius: 8px;
      padding: 10px 12px; cursor: pointer; text-align: left; color: inherit;
      font-family: inherit;
    }
    .palette-row.active { background: var(--surface-hover); }
    .row-icon { color: var(--accent); font-size: var(--font-20); flex-shrink: 0; }
    .palette-row.active .row-icon { color: var(--primary); }
    .row-label { flex: 1; font-size: var(--font-14); color: var(--text-primary); }
    .row-hint { font-size: var(--font-12); color: var(--text-muted); }
    .palette-empty {
      padding: 24px; text-align: center; color: var(--text-muted); font-size: var(--font-14);
    }
    .palette-footer {
      display: flex; gap: 18px; padding: 10px 16px;
      border-top: 1px solid var(--border);
      font-size: var(--font-11); color: var(--text-muted);
    }
  `]
})
export class CommandPaletteComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private roomService = inject(RoomService);

  open = signal(false);
  query = '';
  selectedIndex = signal(0);
  filtered = signal<Command[]>([]);

  private commands: Command[] = [];

  @HostListener('window:keydown', ['$event'])
  onGlobalKeydown(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      this.toggle();
    }
  }

  async ngOnInit(): Promise<void> {
    this.rebuild();
  }

  ngOnDestroy(): void { }

  private toggle(): void {
    this.open.update(o => !o);
    if (this.open()) this.prepare();
  }

  private async prepare(): Promise<void> {
    this.query = '';
    this.selectedIndex.set(0);
    this.applyFilter();
  }

  private async rebuild(): Promise<void> {
    const nav: Command[] = [
      { id: 'dash', label: 'Go to Dashboard', icon: 'dashboard', run: () => this.go('/dashboard') },
      { id: 'rooms', label: 'Browse Rooms', icon: 'meeting_room', run: () => this.go('/rooms') },
      { id: 'timeline', label: 'Open Timeline', icon: 'article', run: () => this.go('/timeline') },
      { id: 'people', label: 'Find People', icon: 'people', run: () => this.go('/people') },
      { id: 'messages', label: 'Open Messages', icon: 'chat', run: () => this.go('/messages') },
      { id: 'notif', label: 'Notifications', icon: 'notifications', run: () => this.go('/notifications') },
      { id: 'invite', label: 'Invitations', icon: 'mark_email_unread', run: () => this.go('/invitations') },
      { id: 'profile', label: 'View Profile', icon: 'person', run: () => this.go('/profile') },
      { id: 'settings', label: 'Settings', icon: 'settings', run: () => this.go('/settings/profile') },
      { id: 'create', label: 'Create Room', icon: 'add_box', run: () => this.go('/rooms/create') },
    ];

    let roomCmds: Command[] = [];
    try {
      const myRooms = (await this.roomService.getMyRooms().toPromise()) || [];
      roomCmds = myRooms.slice(0, 12).map((r: Room) => ({
        id: `room-${r.id}`,
        label: `Open room: ${r.name}`,
        hint: r.subject || 'General',
        icon: 'meeting_room',
        run: () => this.go(`/rooms/${r.id}`)
      }));
    } catch { }

    this.commands = [...nav, ...roomCmds];
    this.filtered.set(this.commands);
  }

  applyFilter(): void {
    const q = this.query.trim().toLowerCase();
    if (!q) { this.filtered.set(this.commands); this.selectedIndex.set(0); return; }
    const filtered = this.commands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      (c.hint ?? '').toLowerCase().includes(q)
    );
    this.filtered.set(filtered);
    this.selectedIndex.set(0);
  }

  onInputKeydown(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown') { e.preventDefault(); this.move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); this.runSelected(); }
  }

  onBackdropKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') { e.preventDefault(); this.close(); }
  }

  private move(dir: number): void {
    const list = this.filtered();
    if (list.length === 0) return;
    const next = (this.selectedIndex() + dir + list.length) % list.length;
    this.selectedIndex.set(next);
  }

  private runSelected(): void {
    const list = this.filtered();
    const cmd = list[this.selectedIndex()];
    if (cmd) this.runCommand(cmd);
  }

  runCommand(cmd: Command): void {
    this.close();
    cmd.run();
  }

  close(): void {
    this.open.set(false);
  }

  private go(path: string): void {
    this.router.navigateByUrl(path);
  }
}