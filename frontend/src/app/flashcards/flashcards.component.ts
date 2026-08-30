import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { NgFor, NgIf, NgClass, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FlashcardsService, FlashcardDeck, FlashcardDeckDetail } from '../core/services/flashcards.service';
import { AIService, FlashcardGenResult } from '../core/services/ai.service';
import { HeroCardComponent } from '../shared/components/hero-card/hero-card.component';

@Component({
  selector: 'app-flashcards',
  standalone: true,
  imports: [NgFor, NgIf, NgClass, DatePipe, FormsModule, RouterLink, HeroCardComponent],
  template: `
    <div class="fc-page">
      <app-hero-card title="Flashcards" subtitle="Build decks manually or let AI turn your notes into flash cards." [badges]="heroBadges"></app-hero-card>

      <ng-container *ngIf="!activeDeck">
        <!-- Deck list -->
        <div class="fc-toolbar">
          <button class="btn-primary" (click)="openCreate()">
            <span class="material-icons">add</span> New deck
          </button>
          <button class="btn-accent" (click)="aiMode = 'generate'; createOpen = false">
            <span class="material-icons">auto_awesome</span> Generate with AI
          </button>
        </div>

        <div class="fc-grid" *ngIf="decks.length > 0">
          <div class="fc-deck-card" *ngFor="let deck of decks">
            <div class="fc-deck-icon"><span class="material-icons">style</span></div>
            <div class="fc-deck-name">{{ deck.title }}</div>
            <div class="fc-deck-meta">{{ deck.cardCount }} cards · updated {{ deck.updatedAt | date:'mediumDate' }}</div>
            <div class="fc-deck-actions">
              <button class="btn-primary sm" (click)="openDeck(deck.id)">
                <span class="material-icons">play_arrow</span> Drill
              </button>
              <button class="btn-secondary sm" (click)="editDeck(deck)">
                <span class="material-icons">edit</span>
              </button>
              <button class="btn-secondary sm danger" (click)="deleteDeck(deck)">
                <span class="material-icons">delete</span>
              </button>
            </div>
          </div>
        </div>
        <div class="empty-state" *ngIf="decks.length === 0 && !loading">
          <span class="material-icons">style</span>
          <p>No decks yet. Create one or paste some notes below to generate cards.</p>
        </div>

        <!-- Create deck -->
        <div class="fc-panel" *ngIf="createOpen">
          <h3>Create a deck</h3>
          <input class="fc-input" [(ngModel)]="newDeckTitle" placeholder="Deck title (e.g. Biology — Chapter 4)" />
          <input class="fc-input" [(ngModel)]="newDeckDesc" placeholder="Optional description" />
          <div class="fc-panel-actions">
            <button class="btn-primary" (click)="createDeck()" [disabled]="!newDeckTitle.trim()">Create</button>
            <button class="btn-secondary" (click)="createOpen = false">Cancel</button>
          </div>
        </div>

        <!-- AI generate -->
        <div class="fc-panel" *ngIf="aiMode === 'generate'">
          <h3><span class="material-icons">auto_awesome</span> Generate from notes</h3>
          <p class="fc-panel-hint">Paste lecture notes, a chapter outline, or key terms. AI will build a question/answer deck.</p>
          <textarea class="fc-textarea" [(ngModel)]="aiContent" rows="6"
            placeholder="Paste your notes here…"></textarea>
          <div class="fc-panel-row">
            <input class="fc-input" [(ngModel)]="aiFocus" placeholder="Focus (optional, e.g. photosynthesis)" />
            <button class="btn-accent" (click)="generate()" [disabled]="!aiContent.trim() || aiGenerating">
              {{ aiGenerating ? 'Generating…' : 'Generate cards' }}
            </button>
          </div>
          <div class="fc-error" *ngIf="aiError">{{ aiError }}</div>

          <div class="fc-preview" *ngIf="genCards.length">
            <h4>Preview ({{ genCards.length }} cards)</h4>
            <div class="fc-preview-card" *ngFor="let c of genCards; let i = index">
              <div class="fc-prev-num">{{ i + 1 }}</div>
              <div class="fc-prev-text">
                <span class="fc-prev-front">{{ c.front }}</span>
                <span class="fc-prev-back">{{ c.back }}</span>
              </div>
            </div>
            <div class="fc-preview-save">
              <input class="fc-input" [(ngModel)]="aiDeckTitle" placeholder="Deck title (defaults to focus/notes)" />
              <button class="btn-primary" (click)="saveGenerated()">Save as deck</button>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- Active deck: study view -->
      <ng-container *ngIf="activeDeck">
        <div class="fc-study-header">
          <button class="btn-secondary" (click)="closeDeck()"><span class="material-icons">arrow_back</span> All decks</button>
          <div class="fc-study-title">{{ activeDeck.title }}</div>
          <div class="fc-study-count">{{ cards.length }} cards</div>
        </div>

        <div class="fc-card-3d" [class.flipped]="flipped" (click)="flip()">
          <div class="fc-card-inner">
            <div class="fc-card-face fc-front">
              <span class="fc-card-label">Front</span>
              <span class="fc-card-content">{{ currentCard?.front }}</span>
            </div>
            <div class="fc-card-face fc-back">
              <span class="fc-card-label">Back</span>
              <span class="fc-card-content">{{ currentCard?.back }}</span>
            </div>
          </div>
        </div>
        <p class="fc-tap-hint">Tap the card to flip it</p>

        <div class="fc-study-controls">
          <button class="btn-secondary" [disabled]="cardIndex <= 0" (click)="prevCard()">
            <span class="material-icons">chevron_left</span>
          </button>
          <span class="fc-position">{{ cardIndex + 1 }} / {{ cards.length }}</span>
          <button class="btn-secondary" [disabled]="cardIndex >= cards.length - 1" (click)="nextCard()">
            <span class="material-icons">chevron_right</span>
          </button>
          <button class="btn-accent" (click)="shuffle()"><span class="material-icons">shuffle</span> Shuffle</button>
        </div>

        <div class="fc-manage" *ngIf="editingCards">
          <h3>Edit cards</h3>
          <div class="fc-edit-row" *ngFor="let c of cards; let i = index">
            <input class="fc-input" [(ngModel)]="c.front" placeholder="Front" />
            <input class="fc-input" [(ngModel)]="c.back" placeholder="Back" />
            <button class="btn-secondary sm danger" (click)="removeCard(i)"><span class="material-icons">close</span></button>
          </div>
          <div class="fc-panel-actions">
            <button class="btn-secondary" (click)="addCard()"><span class="material-icons">add</span> Add card</button>
            <button class="btn-primary" (click)="saveCards()">Save cards</button>
          </div>
        </div>
        <div class="fc-manage-toggle">
          <button class="btn-secondary" (click)="editingCards = !editingCards">
            {{ editingCards ? 'Done editing' : 'Edit cards' }}
          </button>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .fc-page { max-width: 900px; margin: 0 auto; }
    .page-header { margin-bottom: 20px; }
    .page-header h1 { font-size: var(--font-24); font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
    .page-subtitle { font-size: var(--font-14); color: var(--text-secondary); }

    .fc-toolbar { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }

    .fc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; }
    .fc-deck-card {
      background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
      padding: 18px; display: flex; flex-direction: column; gap: 8px;
      transition: border-color 0.15s, transform 0.15s;
    }
    .fc-deck-card:hover { border-color: var(--accent); transform: translateY(-2px); }
    .fc-deck-icon {
      width: 42px; height: 42px; border-radius: 10px;
      background: color-mix(in srgb, var(--accent) 15%, transparent);
      display: flex; align-items: center; justify-content: center;
    }
    .fc-deck-icon .material-icons { color: var(--accent); font-size: 22px; }
    .fc-deck-name { font-size: var(--font-15); font-weight: 700; color: var(--text-primary); word-break: break-word; }
    .fc-deck-meta { font-size: var(--font-12); color: var(--text-muted); }
    .fc-deck-actions { display: flex; gap: 6px; margin-top: auto; flex-wrap: wrap; }

    .empty-state {
      display: flex; flex-direction: column; align-items: center; gap: 10px;
      padding: 40px 20px; color: var(--text-muted); border: 1px dashed var(--border); border-radius: 14px;
    }
    .empty-state .material-icons { font-size: 36px; }

    .fc-panel {
      margin-top: 20px; background: var(--surface); border: 1px solid var(--border);
      border-radius: 14px; padding: 18px;
    }
    .fc-panel h3 { display: flex; align-items: center; gap: 8px; font-size: var(--font-16); font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }
    .fc-panel-hint { font-size: var(--font-13); color: var(--text-secondary); margin-bottom: 12px; }
    .fc-input {
      width: 100%; box-sizing: border-box;
      background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
      padding: 10px 12px; color: var(--text-primary); font-size: var(--font-14);
      margin-bottom: 10px; outline: none;
    }
    .fc-input:focus { border-color: var(--primary); }
    .fc-textarea {
      width: 100%; box-sizing: border-box; resize: vertical;
      background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
      padding: 10px 12px; color: var(--text-primary); font-size: var(--font-14);
      outline: none; margin-bottom: 10px; font-family: inherit;
    }
    .fc-textarea:focus { border-color: var(--primary); }
    .fc-panel-actions { display: flex; gap: 8px; margin-top: 6px; }
    .fc-panel-row { display: flex; gap: 10px; align-items: flex-start; }
    .fc-panel-row .fc-input { flex: 1; }
    .fc-error { color: var(--error); font-size: var(--font-13); margin-top: 6px; }

    .fc-preview { margin-top: 16px; border-top: 1px solid var(--border); padding-top: 14px; }
    .fc-preview h4 { font-size: var(--font-14); font-weight: 700; color: var(--text-primary); margin-bottom: 10px; }
    .fc-preview-card {
      display: flex; gap: 10px; padding: 8px 6px; border-bottom: 1px solid var(--border);
      align-items: flex-start;
    }
    .fc-prev-num { font-size: var(--font-12); color: var(--text-muted); font-weight: 700; width: 20px; flex-shrink: 0; }
    .fc-prev-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .fc-prev-front { font-size: var(--font-13); font-weight: 600; color: var(--text-primary); }
    .fc-prev-back { font-size: var(--font-12); color: var(--text-secondary); }
    .fc-preview-save { display: flex; gap: 10px; margin-top: 12px; align-items: center; }

    .fc-study-header {
      display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 20px;
    }
    .fc-study-title { font-size: var(--font-18); font-weight: 700; color: var(--text-primary); flex: 1; }
    .fc-study-count { font-size: var(--font-13); color: var(--text-muted); }

    .fc-card-3d {
      perspective: 1000px; height: 260px; cursor: pointer; margin: 0 auto; max-width: 560px;
    }
    .fc-card-inner {
      position: relative; width: 100%; height: 100%;
      transition: transform 0.5s; transform-style: preserve-3d;
    }
    .fc-card-3d.flipped .fc-card-inner { transform: rotateY(180deg); }
    .fc-card-face {
      position: absolute; inset: 0; backface-visibility: hidden;
      background: var(--surface); border: 1px solid var(--border); border-radius: 16px;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 12px; padding: 24px; box-sizing: border-box;
    }
    .fc-card-face.fc-back { transform: rotateY(180deg); border-color: var(--accent); }
    .fc-card-label {
      align-self: flex-start; font-size: var(--font-11); font-weight: 700;
      text-transform: uppercase; letter-spacing: 1px; color: var(--accent);
    }
    .fc-card-content { font-size: var(--font-16); color: var(--text-primary); text-align: center; word-break: break-word; }
    .fc-tap-hint { text-align: center; font-size: var(--font-12); color: var(--text-muted); margin-top: 10px; }

    .fc-study-controls {
      display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 16px; flex-wrap: wrap;
    }
    .fc-position { font-size: var(--font-14); font-weight: 600; color: var(--text-primary); min-width: 60px; text-align: center; }

    .fc-manage { margin-top: 24px; }
    .fc-manage h3 { font-size: var(--font-15); font-weight: 700; color: var(--text-primary); margin-bottom: 10px; }
    .fc-edit-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
    .fc-edit-row .fc-input { margin-bottom: 0; }
    .fc-manage-toggle { margin-top: 14px; text-align: center; }

    .btn-primary, .btn-accent, .btn-secondary { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; border: none; border-radius: 10px; padding: 10px 14px; font-size: var(--font-13); font-weight: 600; transition: opacity 0.15s, background 0.15s; }
    .btn-primary { background: var(--primary); color: white; }
    .btn-accent { background: var(--accent); color: white; }
    .btn-secondary { background: var(--surface); color: var(--text-secondary); border: 1px solid var(--border); }
    .btn-primary:disabled, .btn-accent:disabled { opacity: 0.55; cursor: not-allowed; }
    .btn-primary.sm, .btn-accent.sm, .btn-secondary.sm { padding: 7px 10px; font-size: var(--font-12); }
    .btn-secondary.danger .material-icons { color: var(--error); }
  `]
})
export class FlashcardsComponent implements OnInit, OnDestroy {
  private flashcardsService = inject(FlashcardsService);
  private aiService = inject(AIService);

  loading = true;
  decks: FlashcardDeck[] = [];

  get heroBadges() {
    return [{ icon: 'style', text: `${this.decks.length} decks` }];
  }

  createOpen = false;
  newDeckTitle = '';
  newDeckDesc = '';

  aiMode: 'none' | 'generate' = 'none';
  aiContent = '';
  aiFocus = '';
  aiDeckTitle = '';
  aiGenerating = false;
  aiError = '';
  aiResult: FlashcardGenResult | null = null;

  activeDeck: FlashcardDeckDetail | null = null;
  cards: { id: string; front: string; back: string }[] = [];
  cardIndex = 0;
  flipped = false;
  editingCards = false;

  async ngOnInit(): Promise<void> {
    await this.loadDecks();
  }

  ngOnDestroy(): void {}

  async loadDecks(): Promise<void> {
    this.loading = true;
    try {
      this.decks = (await this.flashcardsService.getDecks().toPromise()) || [];
    } catch {
      this.decks = [];
    } finally {
      this.loading = false;
    }
  }

  get currentCard(): { front: string; back: string } | undefined {
    return this.cards[this.cardIndex];
  }

  get genCards(): FlashcardGenResult['cards'] {
    return this.aiResult?.cards || [];
  }

  openCreate(): void {
    this.createOpen = true;
    this.aiMode = 'none';
  }

  async createDeck(): Promise<void> {
    const title = this.newDeckTitle.trim();
    if (!title) return;
    this.createOpen = false;
    this.loading = true;
    try {
      const deck = await this.flashcardsService.createDeck(title, this.newDeckDesc.trim() || undefined).toPromise();
      if (deck) {
        this.newDeckTitle = '';
        this.newDeckDesc = '';
        await this.loadDecks();
        await this.openDeck(deck.id);
      }
    } catch { } finally { this.loading = false; }
  }

  async deleteDeck(deck: FlashcardDeck): Promise<void> {
    if (!confirm(`Delete "${deck.title}" and all its cards?`)) return;
    await this.flashcardsService.deleteDeck(deck.id).toPromise().catch(() => {});
    await this.loadDecks();
  }

  async editDeck(deck: FlashcardDeck): Promise<void> {
    this.newDeckTitle = deck.title;
    this.newDeckDesc = deck.description || '';
    this.createOpen = true;
    this.aiMode = 'none';
  }

  async openDeck(id: string): Promise<void> {
    this.loading = true;
    this.createOpen = false;
    try {
      const deck = await this.flashcardsService.getDeck(id).toPromise();
      if (!deck) return;
      this.activeDeck = deck;
      this.cards = (deck.cards || []).map(c => ({ ...c }));
      this.cardIndex = 0;
      this.flipped = false;
      this.editingCards = false;
    } catch { } finally { this.loading = false; }
  }

  closeDeck(): void {
    this.activeDeck = null;
    this.cards = [];
    this.cardIndex = 0;
    this.flipped = false;
    this.loadDecks();
  }

  flip(): void { this.flipped = !this.flipped; }

  prevCard(): void {
    if (this.cardIndex > 0) { this.cardIndex--; this.flipped = false; }
  }

  nextCard(): void {
    if (this.cardIndex < this.cards.length - 1) { this.cardIndex++; this.flipped = false; }
  }

  shuffle(): void {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
    this.cardIndex = 0;
    this.flipped = false;
  }

  addCard(): void {
    this.cards.push({ id: '', front: '', back: '' });
  }

  removeCard(i: number): void {
    this.cards.splice(i, 1);
    if (this.cardIndex >= this.cards.length) this.cardIndex = Math.max(0, this.cards.length - 1);
  }

  async saveCards(): Promise<void> {
    if (!this.activeDeck) return;
    const cleaned = this.cards
      .filter(c => c.front.trim() && c.back.trim())
      .map(c => ({ front: c.front.trim(), back: c.back.trim() }));
    try {
      const updated = await this.flashcardsService.replaceCards(this.activeDeck.id, cleaned).toPromise();
      if (updated) {
        this.activeDeck = updated;
        this.cards = updated.cards.map(c => ({ ...c }));
        this.cardIndex = 0;
        this.flipped = false;
        this.editingCards = false;
        await this.loadDecks();
      }
    } catch { }
  }

  async generate(): Promise<void> {
    if (!this.aiContent.trim() || this.aiGenerating) return;
    this.aiGenerating = true;
    this.aiError = '';
    this.aiResult = null;
    try {
      const res = await this.aiService.generateFlashcards({
        content: this.aiContent,
        count: 12,
        focus: this.aiFocus.trim() || undefined
      }).toPromise();
      this.aiResult = res || null;
      this.aiDeckTitle = res?.suggestedTitle || this.aiFocus.trim() || '';
      if (res && !res.ok) this.aiError = res.error || 'Generation failed.';
    } catch {
      this.aiError = 'Could not reach the AI service. Try again later.';
    } finally {
      this.aiGenerating = false;
    }
  }

  async saveGenerated(): Promise<void> {
    if (!this.aiResult?.cards?.length) return;
    const title = this.aiDeckTitle.trim() || this.aiFocus.trim() || 'Generated deck';
    try {
      const deck = await this.flashcardsService.createDeck(title, 'Generated from notes').toPromise();
      if (deck) {
        const cards = this.aiResult.cards.map(c => ({ front: c.front, back: c.back }));
        await this.flashcardsService.replaceCards(deck.id, cards).toPromise();
        this.aiContent = '';
        this.aiFocus = '';
        this.aiDeckTitle = '';
        this.aiResult = null;
        this.aiMode = 'none';
        await this.loadDecks();
        await this.openDeck(deck.id);
      }
    } catch { }
  }
}