import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NotesService } from '../../core/services/notes.service';
import { SignalRService } from '../../core/services/signalr.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-notes-editor',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="notes-editor">
      <textarea
        [(ngModel)]="content"
        (input)="onInput()"
        placeholder="Start writing your notes here... (Markdown supported)"
        spellcheck="false"
      ></textarea>
    </div>
  `,
  styles: [`
    .notes-editor { flex: 1; display: flex; flex-direction: column; }
    textarea { flex: 1; padding: 16px; background: var(--background); border: none; color: var(--text-primary); font-size: 14px; font-family: 'JetBrains Mono', 'Fira Code', monospace; line-height: 1.6; resize: none; outline: none; min-height: 300px; }
    textarea::placeholder { color: var(--text-muted); }
  `]
})
export class NotesEditorComponent implements OnInit, OnDestroy {
  @Input() roomId = '';

  content = '';
  private autoSaveTimer: any;
  private subscription?: Subscription;

  constructor(
    private notesService: NotesService,
    private signalR: SignalRService
  ) {}

  async ngOnInit() {
    try {
      const notes = await this.notesService.getNotes(this.roomId).toPromise();
      if (notes) this.content = notes.content;
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
      await this.notesService.updateNotes(this.roomId, this.content).toPromise();
      await this.signalR.updateNotes(this.roomId, this.content);
    } catch { }
  }

  ngOnDestroy() {
    clearTimeout(this.autoSaveTimer);
    this.subscription?.unsubscribe();
  }
}
