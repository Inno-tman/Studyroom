import { Component, Input } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';

export interface HeroBadge {
  icon: string;
  text: string;
}

@Component({
  selector: 'app-hero-card',
  standalone: true,
  imports: [NgFor, NgIf],
  template: `
    <div class="hero-card">
      <div class="hero-top">
        <div class="hero-greeting">
          <h1>{{ title }}</h1>
          <p *ngIf="subtitle">{{ subtitle }}</p>
        </div>
        <div class="hero-actions">
          <ng-content select="[heroActions]"></ng-content>
        </div>
      </div>
      <div class="hero-badges" *ngIf="badges && badges.length">
        <span class="hero-badge" *ngFor="let badge of badges">
          <span class="material-icons">{{ badge.icon }}</span>
          {{ badge.text }}
        </span>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .hero-card {
      background: linear-gradient(135deg, var(--primary), var(--accent));
      border-radius: 16px; padding: 28px; margin-bottom: 20px;
      color: white; display: flex; flex-direction: column; gap: 20px;
    }
    .hero-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .hero-greeting h1 { font-size: var(--font-24); font-weight: 700; margin-bottom: 6px; }
    .hero-greeting p { color: rgba(255,255,255,0.82); font-size: var(--font-14); }
    .hero-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .hero-actions ::ng-deep .hero-btn {
      background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.35);
      color: white; padding: 10px 16px; border-radius: 10px; font-weight: 600;
      font-size: var(--font-13); text-decoration: none; white-space: nowrap;
      display: inline-flex; align-items: center; gap: 6px; cursor: pointer;
      font-family: inherit; transition: background 0.15s;
    }
    .hero-actions ::ng-deep .hero-btn:hover { background: rgba(255,255,255,0.28); }
    .hero-actions ::ng-deep .hero-btn .material-icons { font-size: var(--font-18); }
    .hero-badges { display: flex; gap: 8px; flex-wrap: wrap; }
    .hero-badge {
      display: inline-flex; align-items: center; gap: 6px;
      background: rgba(255,255,255,0.16); border-radius: 8px;
      padding: 6px 10px; font-size: var(--font-12); font-weight: 600;
    }
    .hero-badge .material-icons { font-size: var(--font-16); }
    @media (max-width: 768px) {
      .hero-top { flex-direction: column; align-items: stretch; }
    }
  `]
})
export class HeroCardComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() badges: HeroBadge[] = [];
}