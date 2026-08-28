import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotesService, NoteVersion } from '../../core/services/notes.service';
import { SignalRService } from '../../core/services/signalr.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-notes-editor',
  standalone: true,
  imports: [FormsModule, NgFor, NgIf, DatePipe],
  template: `
    <div class="notes-editor">
      <div class="notes-toolbar">
        <span class="notes-label">Notes</span>
        <span class="notes-hint">Markdown supported · auto-saved</span>
        <button class="history-btn" (click)="openHistory()" title="Version history">
          <span class="material-icons">history</span>
          <span class="history-label">History</span>
        </button>
      </div>

      <textarea
        [(ngModel)]="content"
        (input)="onInput()"
        placeholder="Start writing your notes here... (Markdown supported)"
        spellcheck="false"
      ></textarea>
    </div>

    <div class="hist-modal" *ngIf="showHistory">
      <div class="hist-card">
        <div class="hist-head">
          <h3>Version history</h3>
          <button class="hist-close" (click)="showHistory = false">
            <span class="material-icons">close</span>
          </button>
        </div>

        <div *ngIf="loadingVersions" class="hist-empty">Loading…</div>
        <div *ngIf="!loadingVersions && versions.length === 0" class="hist-empty">
          No previous versions yet — edits are saved here automatically.
        </div>

        <div class="hist-list">
          <div class="hist-item" *ngFor="let v of versions">
            <div class="hist-info">
              <span class="hist-who">{{ v.editedByName }}</span>
              <span class="hist-when">{{ v.editedAt | date:'MMM d, h:mm a' }}</span>
              <span class="hist-preview">{{ preview(v) }}</span>
            </div>
            <button class="hist-restore" [disabled]="restoringId === v.id" (click)="restore(v)">
              {{ restoringId === v.id ? '…' : 'Restore' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .notes-editor { flex: 1; display: flex; flex-direction: column; }
    .notes-toolbar {
      display: flex; align-items: center; gap: 10px; padding: 12px 16px;
      border-bottom: 1px solid var(--border);
    }
    .notes-label { font-size: var(--font-14); font-weight: 700; color: var(--text-primary); }
    .notes-hint { flex: 1; font-size: var(--font-11); color: var(--text-muted); }
    .history-btn {
      display: inline-flex; align-items: center; gap: 5px; background: none;
      border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px;
      font-size: var(--font-12); color: var(--text-secondary); cursor: pointer;
    }
    .history-btn:hover { border-color: var(--primary); color: var(--primary); }
    .history-btn .material-icons { font-size: 16px; }

    textarea { flex: 1; padding: 16px; background: var(--background); border: none; color: var(--text-primary); font-size: var(--font-14); font-family: 'JetBrains Mono', 'Fira Code', monospace; line-height: 1.6; resize: none; outline: none; min-height: 300px; }
    textarea::placeholder { color: var(--text-muted); }

    .hist-modal {
      position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 300;
      display: flex; align-items: center; justify-content: center; padding: 16px;
    }
    .hist-card {
      background: var(--secondary); border: 1px solid var(--border); border-radius: 14px;
      width: 100%; max-width: 460px; max-height: 80vh; display: flex; flex-direction: column;
    }
    .hist-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 18px; border-bottom: 1px solid var(--border);
    }
    .hist-head h3 { font-size: var(--font-16); font-weight: 700; color: var(--text-primary); }
    .hist-close { background: none; border: none; color: var(--text-muted); cursor: pointer; }
    .hist-empty { padding: 28px 18px; text-align: center; color: var(--text-muted); font-size: var(--font-13); }
    .hist-list { overflow-y: auto; padding: 6px 18px 18px; display: flex; flex-direction: column; }
    .hist-item {
      display: flex; align-items: center; gap: 12px; padding: 12px 0;
      border-bottom: 1px solid var(--border);
    }
    .hist-item:last-child { border-bottom: none; }
    .hist-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .hist-who { font-size: var(--font-13); font-weight: 600; color: var(--text-primary); }
    .hist-when { font-size: var(--font-11); color: var(--text-muted); }
    .hist-preview {
      font-size: var(--font-12); color: var(--text-secondary); white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis;
    }
    .hist-restore {
      flex-shrink: 0; background: var(--surface); border: 1px solid var(--border);
      border-radius: 8px; padding: 6px 12px; font-size: var(--font-12); color: var(--primary);
      cursor: pointer;
    }
    .hist-restore:disabled { opacity: 0.5; cursor: default; }
  `]
})
export class NotesEditorComponent implements OnInit, OnDestroy {
  @Input() roomId = '';

  content = '';
  noteId = '';
  showHistory = false;
  loadingVersions = false;
  restoringId = '';
  versions: NoteVersion[] = [];
  private autoSaveTimer: any;
  private subscription?: Subscription;

  constructor(
    private notesService: NotesService,
    private signalR: SignalRService
  ) {}

  async ngOnInit() {
    try {
      const notes = await this.notesService.getNotes(this.roomId).toPromise();
      if (notes) {
        this.content = notes.content;
        this.noteId = notes.id;
      }
    } catch { }

    this.subscription = this.signalR.notesUpdated$.subscribe(data => {
      if (data.roomId === this.roomId) {
        this.content = data.content;
      }
    });
  }

  onInput() {
    clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => this.save(), 1000);
  }

  async save() {
    try {
      const notes = await this.notesService.updateNotes(this.roomId, this.content).toPromise();
      if (notes) this.noteId = notes.id;
      await this.signalR.updateNotes(this.roomId, this.content);
    } catch { }
  }

  async openHistory() {
    if (!this.noteId) {
      try {
        const notes = await this.notesService.getNotes(this.roomId).toPromise();
        if (notes) this.noteId = notes.id;
      } catch { }
    }
    if (!this.noteId) return;

    this.showHistory = true;
    this.loadingVersions = true;
    try {
      this.versions = (await this.notesService.getVersions(this.roomId, this.noteId).toPromise()) || [];
    } catch {
      this.versions = [];
    }
    this.loadingVersions = false;
  }

  preview(v: NoteVersion): string {
    const text = v.content.replace(/\s+/g, ' ').trim();
    return text.length > 70 ? text.slice(0, 70) + '…' : (text || '(blank)');
  }

  async restore(v: NoteVersion) {
    this.restoringId = v.id;
    try {
      const notes = await this.notesService.restoreVersion(this.roomId, this.noteId, v.id).toPromise();
      if (notes) {
        this.content = notes.content;
        this.noteId = notes.id;
        await this.signalR.updateNotes(this.roomId, this.content);
      }
      this.showHistory = false;
    } catch { }
    this.restoringId = '';
  }

  ngOnDestroy() {
    clearTimeout(this.autoSaveTimer);
    this.subscription?.unsubscribe();
  }
}