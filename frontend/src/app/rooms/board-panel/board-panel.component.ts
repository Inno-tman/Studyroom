import {
  Component,
  ElementRef,
  HostListener,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  inject
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { fabric } from 'fabric';
import { SignalRService } from '../../core/services/signalr.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { Subscription } from 'rxjs';

type BoardTool =
  | 'select'
  | 'pen'
  | 'eraser'
  | 'rect'
  | 'circle'
  | 'line'
  | 'arrow'
  | 'text'
  | 'triangle'
  | 'diamond'
  | 'hexagon'
  | 'star'
  | 'pentagon'
  | 'heart'
  | 'shield'
  | 'bolt'
  | 'plus'
  | 'ring'
  | 'ellipse'
  | 'square'
  | 'semicircle'
  | 'octagon'
  | 'trapezoid'
  | 'crescent'
  | 'droplet'
  | 'cloud'
  | 'cross'
  | 'chevron'
  | 'doubleArrow'
  | 'sparkle'
  | 'star6'
  | 'tag';

type BoardGroup = 'tools' | 'shapes' | 'style' | 'slides' | 'board';

interface BoardPalette {
  name: string;
  color: string;
}

const PALETTE: BoardPalette[] = [
  { name: 'Black', color: '#0F172A' },
  { name: 'Sky', color: '#0EA5E9' },
  { name: 'Green', color: '#22C55E' },
  { name: 'Orange', color: '#F97316' },
  { name: 'Red', color: '#EF4444' },
  { name: 'Violet', color: '#8B5CF6' },
  { name: 'White', color: '#FFFFFF' }
];

const BOARD_ICONS: Record<string, string> = {
  'select': `<path d="M12.586 12.586 19 19" />
  <path d="M3.688 3.037a.497.497 0 0 0-.651.651l6.5 15.999a.501.501 0 0 0 .947-.062l1.569-6.083a2 2 0 0 1 1.448-1.479l6.124-1.579a.5.5 0 0 0 .063-.947z" />`,
  'pen': `<path d="m11 10 3 3" />
  <path d="M6.5 21A3.5 3.5 0 1 0 3 17.5a2.62 2.62 0 0 1-.708 1.792A1 1 0 0 0 3 21z" />
  <path d="M9.969 17.031 21.378 5.624a1 1 0 0 0-3.002-3.002L6.967 14.031" />`,
  'eraser': `<path d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21" />
  <path d="m5.082 11.09 8.828 8.828" />`,
  'text': `<path d="M12 4v16" />
  <path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2" />
  <path d="M9 20h6" />`,
  'line_weight': `<path d="M3 5h18" /><path d="M3 10.5h18" /><path d="M3 16h18" /><path d="M3 21.5h18" />`,
  'rect': `<rect width="20" height="12" x="2" y="6" rx="2" />`,
  'circle': `<circle cx="12" cy="12" r="10" />`,
  'ellipse': `<ellipse cx="12" cy="12" rx="10" ry="6" />`,
  'line': `<path d="M11 19H5v-6" />
  <path d="M13 5h6v6" />
  <path d="M19 5 5 19" />`,
  'arrow': `<path d="M5 12h14" />
  <path d="m12 5 7 7-7 7" />`,
  'triangle': `<path d="M13.73 4a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />`,
  'diamond': `<path d="M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z" />
  <path d="M2 9h20" />`,
  'hexagon': `<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />`,
  'star': `<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />`,
  'pentagon': `<path d="M10.83 2.38a2 2 0 0 1 2.34 0l8 5.74a2 2 0 0 1 .73 2.25l-3.04 9.26a2 2 0 0 1-1.9 1.37H7.04a2 2 0 0 1-1.9-1.37L2.1 10.37a2 2 0 0 1 .73-2.25z" />`,
  'heart': `<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />`,
  'shield': `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />`,
  'bolt': `<path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z" />`,
  'plus': `<path d="M5 12h14" />
  <path d="M12 5v14" />`,
  'ring': `<path d="M16.247 7.761a6 6 0 0 1 0 8.478" />
  <path d="M19.075 4.933a10 10 0 0 1 0 14.134" />
  <path d="M4.925 19.067a10 10 0 0 1 0-14.134" />
  <path d="M7.753 16.239a6 6 0 0 1 0-8.478" />
  <circle cx="12" cy="12" r="2" />`,
  'square': `<rect width="18" height="18" x="3" y="3" rx="2" />`,
  'semicircle': `<path d="M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z" />
  <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />`,
  'octagon': `<path d="M2.586 16.726A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2h6.624a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586z" />`,
  'trapezoid': `<path d="M4 18 7 6h10l3 12z" />`,
  'crescent': `<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />`,
  'droplet': `<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />`,
  'cloud': `<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />`,
  'cross': `<path d="M18 6 6 18" />
  <path d="m6 6 12 12" />`,
  'chevron': `<path d="m9 18 6-6-6-6" />`,
  'doubleArrow': `<path d="m6 17 5-5-5-5" />
  <path d="m13 17 5-5-5-5" />`,
  'sparkle': `<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />`,
  'star6': `<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
  <path d="M20 2v4" />
  <path d="M22 4h-4" />
  <circle cx="4" cy="20" r="2" />`,
  'tag': `<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
  <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />`,
  'opacity': `<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />
  <path d="M9 8.5a6.5 6.5 0 0 0-4 6" opacity="0.4" />`,
  'format_size': `<path d="m15 16 2.536-7.328a1.02 1.02 1 0 1 1.928 0L22 16" />
  <path d="M15.697 14h5.606" />
  <path d="m2 16 4.039-9.69a.5.5 0 0 1 .923 0L11 16" />
  <path d="M3.304 13h6.392" />`,
  'bold': `<path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" />`,
  'dash': `<path d="M5 3a2 2 0 0 0-2 2" />
  <path d="M19 3a2 2 0 0 1 2 2" />
  <path d="M21 19a2 2 0 0 1-2 2" />
  <path d="M5 21a2 2 0 0 1-2-2" />
  <path d="M9 3h1" />
  <path d="M9 21h1" />
  <path d="M14 3h1" />
  <path d="M14 21h1" />
  <path d="M3 9v1" />
  <path d="M21 9v1" />
  <path d="M3 14v1" />
  <path d="M21 14v1" />`,
  'copy': `<rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />`,
  'delete': `<path d="M10 11v6" />
  <path d="M14 11v6" />
  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  <path d="M3 6h18" />
  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />`,
  'delete_sweep': `<path d="M10 11v6" />
  <path d="M14 11v6" />
  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  <path d="M3 6h18" />
  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />`,
  'bring_front': `<rect x="8" y="8" width="8" height="8" rx="2" />
  <path d="M4 10a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2" />
  <path d="M14 20a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2" />`,
  'send_back': `<rect x="14" y="14" width="8" height="8" rx="2" />
  <rect x="2" y="2" width="8" height="8" rx="2" />
  <path d="M7 14v1a2 2 0 0 0 2 2h1" />
  <path d="M14 7h1a2 2 0 0 1 2 2v1" />`,
  'chevron_left': `<path d="m15 18-6-6 6-6" />`,
  'note_add': `<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
  <path d="M14 2v5a1 1 0 0 0 1 1h5" />
  <path d="M9 15h6" />
  <path d="M12 18v-6" />`,
  'zoom_out': `<circle cx="11" cy="11" r="8" />
  <line x1="21" x2="16.65" y1="21" y2="16.65" />
  <line x1="8" x2="14" y1="11" y2="11" />`,
  'zoom_in': `<circle cx="11" cy="11" r="8" />
  <line x1="21" x2="16.65" y1="21" y2="16.65" />
  <line x1="11" x2="11" y1="8" y2="14" />
  <line x1="8" x2="14" y1="11" y2="11" />`,
  'fit_screen': `<path d="M8 3H5a2 2 0 0 0-2 2v3" />
  <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
  <path d="M3 16v3a2 2 0 0 0 2 2h3" />
  <path d="M16 21h3a2 2 0 0 0 2-2v-3" />`,
  'download': `<path d="M12 15V3" />
  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
  <path d="m7 10 5 5 5-5" />`,
  'undo': `<path d="M9 14 4 9l5-5" />
  <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />`,
  'redo': `<path d="m15 14 5-5-5-5" />
  <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13" />`,
  'sync': `<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
  <path d="M21 3v5h-5" />
  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
  <path d="M8 16H3v5" />`,
  'cloud_done': `<path d="m17 15-5.5 5.5L9 18" />
  <path d="M5.516 16.07A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 3.501 7.327" />`,
  'draw': `<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />`
};

@Component({
  selector: 'app-board-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="board-panel">
      <div class="board-toolbar">
        <div class="toolbar-tabs">
          <button class="tool-tab" [class.active]="activeGroup === 'tools'" (click)="setGroup('tools')" title="Draw tools">Draw</button>
          <button class="tool-tab" [class.active]="activeGroup === 'shapes'" (click)="setGroup('shapes')" title="Shapes">Shapes</button>
          <button class="tool-tab" [class.active]="activeGroup === 'style'" (click)="setGroup('style')" title="Format selected">Style</button>
          <button class="tool-tab" [class.active]="activeGroup === 'slides'" (click)="setGroup('slides')" title="Slides">Slides</button>
          <button class="tool-tab" [class.active]="activeGroup === 'board'" (click)="setGroup('board')" title="Board actions">Board</button>
          <span class="sync-indicator" [class.unsynced]="!synced" [title]="synced ? 'Board synced with room' : 'Syncing board...'">
            <span class="icon" [innerHTML]="icon(synced ? 'cloud_done' : 'sync')"></span>
          </span>
        </div>

        <div class="toolbar-content" [class.scrolled]="true">
          <ng-container *ngIf="activeGroup === 'tools'">
            <button
              class="tool-btn"
              [class.active]="tool === 'select'"
              (click)="setTool('select')"
              title="Select / move"
            ><span class="icon" [innerHTML]="icon('select')"></span></button>

            <button
              class="tool-btn"
              [class.active]="tool === 'pen'"
              (click)="setTool('pen')"
              title="Draw"
            ><span class="icon" [innerHTML]="icon('pen')"></span></button>

            <button
              class="tool-btn"
              [class.active]="tool === 'eraser'"
              (click)="setTool('eraser')"
              title="Eraser"
            ><span class="icon" [innerHTML]="icon('eraser')"></span></button>

            <button
              class="tool-btn"
              [class.active]="tool === 'text'"
              (click)="setTool('text')"
              title="Add text"
            ><span class="icon" [innerHTML]="icon('text')"></span></button>

            <span class="board-divider"></span>

            <div class="color-row">
              <button
                *ngFor="let p of palette"
                class="swatch"
                [class.active]="color === p.color"
                [class.dark]="p.color === '#FFFFFF'"
                [style.background]="p.color"
                (click)="color = p.color"
                [title]="p.name"
                [attr.aria-label]="'Color ' + p.name"
              ></button>
              <label class="custom-color" title="Custom color">
                <input type="color" [value]="color" (input)="onColorInput($event)" />
              </label>
            </div>

            <span class="board-divider"></span>

            <label class="size-control">
              <span class="icon" [innerHTML]="icon('line_weight')"></span>
              <input
                type="range"
                min="1"
                max="20"
                [value]="strokeWidth"
                (input)="strokeWidth = +($any($event.target).value)"
              />
            </label>
          </ng-container>

          <ng-container *ngIf="activeGroup === 'shapes'">
            <button class="tool-btn" [class.active]="tool === 'rect'" (click)="setTool('rect')" title="Rectangle"><span class="icon" [innerHTML]="icon('rect')"></span></button>
            <button class="tool-btn" [class.active]="tool === 'circle'" (click)="setTool('circle')" title="Circle"><span class="icon" [innerHTML]="icon('circle')"></span></button>
            <button class="tool-btn" [class.active]="tool === 'line'" (click)="setTool('line')" title="Line"><span class="icon" [innerHTML]="icon('line')"></span></button>
            <button class="tool-btn" [class.active]="tool === 'arrow'" (click)="setTool('arrow')" title="Arrow"><span class="icon" [innerHTML]="icon('arrow')"></span></button>
            <button class="tool-btn" [class.active]="tool === 'triangle'" (click)="setTool('triangle')" title="Triangle"><span class="icon" [innerHTML]="icon('triangle')"></span></button>
            <button class="tool-btn" [class.active]="tool === 'diamond'" (click)="setTool('diamond')" title="Diamond"><span class="icon" [innerHTML]="icon('diamond')"></span></button>
            <button class="tool-btn" [class.active]="tool === 'hexagon'" (click)="setTool('hexagon')" title="Hexagon"><span class="icon" [innerHTML]="icon('hexagon')"></span></button>
            <button class="tool-btn" [class.active]="tool === 'star'" (click)="setTool('star')" title="Star"><span class="icon" [innerHTML]="icon('star')"></span></button>
            <button class="tool-btn" [class.active]="tool === 'pentagon'" (click)="setTool('pentagon')" title="Pentagon"><span class="icon" [innerHTML]="icon('pentagon')"></span></button>
            <button class="tool-btn" [class.active]="tool === 'heart'" (click)="setTool('heart')" title="Heart"><span class="icon" [innerHTML]="icon('heart')"></span></button>
            <button class="tool-btn" [class.active]="tool === 'shield'" (click)="setTool('shield')" title="Shield"><span class="icon" [innerHTML]="icon('shield')"></span></button>
            <button class="tool-btn" [class.active]="tool === 'bolt'" (click)="setTool('bolt')" title="Lightning bolt"><span class="icon" [innerHTML]="icon('bolt')"></span></button>
            <button class="tool-btn" [class.active]="tool === 'plus'" (click)="setTool('plus')" title="Plus"><span class="icon" [innerHTML]="icon('plus')"></span></button>
            <button class="tool-btn" [class.active]="tool === 'ring'" (click)="setTool('ring')" title="Ring"><span class="icon" [innerHTML]="icon('ring')"></span></button>
            <button class="tool-btn" [class.active]="tool === 'ellipse'" (click)="setTool('ellipse')" title="Ellipse"><span class="icon" [innerHTML]="icon('ellipse')"></span></button>
            <button class="tool-btn" [class.active]="tool === 'square'" (click)="setTool('square')" title="Square"><span class="icon" [innerHTML]="icon('square')"></span></button>
            <button class="tool-btn" [class.active]="tool === 'semicircle'" (click)="setTool('semicircle')" title="Semicircle"><span class="icon" [innerHTML]="icon('semicircle')"></span></button>
            <button class="tool-btn" [class.active]="tool === 'octagon'" (click)="setTool('octagon')" title="Octagon"><span class="icon" [innerHTML]="icon('octagon')"></span></button>
            <button class="tool-btn" [class.active]="tool === 'trapezoid'" (click)="setTool('trapezoid')" title="Trapezoid"><span class="icon" [innerHTML]="icon('trapezoid')"></span></button>
            <button class="tool-btn" [class.active]="tool === 'crescent'" (click)="setTool('crescent')" title="Crescent"><span class="icon" [innerHTML]="icon('crescent')"></span></button>
            <button class="tool-btn" [class.active]="tool === 'droplet'" (click)="setTool('droplet')" title="Droplet"><span class="icon" [innerHTML]="icon('droplet')"></span></button>
            <button class="tool-btn" [class.active]="tool === 'cloud'" (click)="setTool('cloud')" title="Cloud"><span class="icon" [innerHTML]="icon('cloud')"></span></button>
            <button class="tool-btn" [class.active]="tool === 'cross'" (click)="setTool('cross')" title="Cross"><span class="icon" [innerHTML]="icon('cross')"></span></button>
            <button class="tool-btn" [class.active]="tool === 'chevron'" (click)="setTool('chevron')" title="Chevron"><span class="icon" [innerHTML]="icon('chevron')"></span></button>
            <button class="tool-btn" [class.active]="tool === 'doubleArrow'" (click)="setTool('doubleArrow')" title="Double arrow"><span class="icon" [innerHTML]="icon('doubleArrow')"></span></button>
            <button class="tool-btn" [class.active]="tool === 'sparkle'" (click)="setTool('sparkle')" title="Sparkle star"><span class="icon" [innerHTML]="icon('sparkle')"></span></button>
            <button class="tool-btn" [class.active]="tool === 'star6'" (click)="setTool('star6')" title="6-point star"><span class="icon" [innerHTML]="icon('star6')"></span></button>
            <button class="tool-btn" [class.active]="tool === 'tag'" (click)="setTool('tag')" title="Tag"><span class="icon" [innerHTML]="icon('tag')"></span></button>
          </ng-container>

          <ng-container *ngIf="activeGroup === 'style'">
            <label class="size-control" title="Opacity">
              <span class="icon" [innerHTML]="icon('opacity')"></span>
              <input type="range" min="0.1" max="1" step="0.05" [value]="opacity" (input)="setOpacity(+$any($event.target).value)" />
            </label>

            <button class="tool-btn" [class.active]="dashed" (click)="toggleDash()" title="Dashed outline"><span class="icon" [innerHTML]="icon('dash')"></span></button>

            <span class="board-divider"></span>

            <label class="size-control" title="Font size">
              <span class="icon" [innerHTML]="icon('format_size')"></span>
              <input type="range" min="12" max="120" [value]="fontSize" (input)="setFontSize(+$any($event.target).value)" />
            </label>
            <button class="tool-btn" [class.active]="bold" (click)="toggleBold()" title="Bold text"><span class="icon" [innerHTML]="icon('bold')"></span></button>

            <span class="board-divider"></span>

            <button class="tool-btn" (click)="duplicateSelected()" title="Duplicate"><span class="icon" [innerHTML]="icon('copy')"></span></button>
            <button class="tool-btn" (click)="deleteSelected()" title="Delete"><span class="icon" [innerHTML]="icon('delete')"></span></button>
            <button class="tool-btn" (click)="bringForward()" title="Bring forward"><span class="icon" [innerHTML]="icon('bring_front')"></span></button>
            <button class="tool-btn" (click)="sendBackwards()" title="Send backward"><span class="icon" [innerHTML]="icon('send_back')"></span></button>
          </ng-container>

          <ng-container *ngIf="activeGroup === 'slides'">
            <button class="tool-btn" (click)="prevSlide()" title="Previous slide"><span class="icon" [innerHTML]="icon('chevron_left')"></span></button>
            <span class="slide-count">{{ activeSlide + 1 }} / {{ slides.length }}</span>
            <button class="tool-btn" (click)="nextSlide()" title="Next slide"><span class="icon" [innerHTML]="icon('chevron')"></span></button>
            <button class="tool-btn" (click)="addSlide()" title="New slide"><span class="icon" [innerHTML]="icon('note_add')"></span></button>
            <button class="tool-btn" (click)="duplicateSlide()" title="Duplicate slide"><span class="icon" [innerHTML]="icon('copy')"></span></button>
            <button class="tool-btn danger" (click)="deleteSlide()" title="Delete slide"><span class="icon" [innerHTML]="icon('delete')"></span></button>
          </ng-container>

          <ng-container *ngIf="activeGroup === 'board'">
            <button class="tool-btn" (click)="zoomOut()" title="Zoom out"><span class="icon" [innerHTML]="icon('zoom_out')"></span></button>
            <button class="tool-btn" (click)="zoomFit()" title="Zoom to fit"><span class="icon" [innerHTML]="icon('fit_screen')"></span></button>
            <button class="tool-btn" (click)="zoomIn()" title="Zoom in"><span class="icon" [innerHTML]="icon('zoom_in')"></span></button>
            <span class="zoom-pct">{{ zoom | number: '1.0-1' }}%</span>

            <span class="board-divider"></span>

            <button class="tool-btn" (click)="undo()" title="Undo"><span class="icon" [innerHTML]="icon('undo')"></span></button>
            <button class="tool-btn" (click)="redo()" title="Redo"><span class="icon" [innerHTML]="icon('redo')"></span></button>
            <button class="tool-btn" (click)="exportPng()" title="Export image"><span class="icon" [innerHTML]="icon('download')"></span></button>
            <button class="tool-btn danger" (click)="clearBoard()" title="Clear board"><span class="icon" [innerHTML]="icon('delete_sweep')"></span></button>
          </ng-container>
        </div>
      </div>

      <div class="board-canvas-wrap" #wrap>
        <div class="board-empty-hint" *ngIf="isEmpty">
          <span class="icon" [innerHTML]="icon('draw')"></span>
          <p>Pick a tool and start drawing, or add a slide</p>
        </div>
        <canvas #canvasEl></canvas>
      </div>
    </div>
  `,
  styles: [`
    .board-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 320px;
      overflow: hidden;
    }

    .board-toolbar {
      display: flex;
      flex-direction: column;
      gap: 0;
      border-bottom: 1px solid var(--border);
      background: var(--surface);
      flex-shrink: 0;
    }

    .toolbar-tabs {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 10px 0;
    }

    .tool-tab {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 30px;
      padding: 0 14px;
      border: 1px solid transparent;
      background: transparent;
      color: var(--text-secondary);
      border-radius: 8px 8px 0 0;
      cursor: pointer;
      font-size: var(--font-13);
      font-weight: 600;
      transition: all 0.15s;
      white-space: nowrap;
    }

    .tool-tab:hover { color: var(--text-primary); background: var(--surface-hover); }

    .tool-tab.active {
      color: var(--primary);
      background: var(--background);
      border-color: var(--border);
      border-bottom-color: var(--background);
    }

    .toolbar-content {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 10px;
      overflow-x: auto;
      scrollbar-width: thin;
      min-height: 50px;
    }

    .toolbar-content::-webkit-scrollbar { height: 6px; }
    .toolbar-content::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
    .toolbar-content::-webkit-scrollbar-track { background: transparent; }

    .tool-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border: 1px solid var(--border);
      background: var(--background);
      color: var(--text-secondary);
      border-radius: 8px;
      cursor: pointer;
      font-size: var(--font-16);
      transition: all 0.15s;
      flex-shrink: 0;
    }

    .tool-btn:hover { color: var(--text-primary); background: var(--surface-hover); }

    .tool-btn.active { background: var(--primary); border-color: var(--primary); color: white; }

    .tool-btn.danger:hover { color: var(--error); border-color: var(--error); }

    .tool-btn .icon { display: inline-flex; }
    .tool-btn .icon svg { width: 18px; height: 18px; display: block; }

    .board-divider { width: 1px; height: 22px; background: var(--border); margin: 0 4px; }

    .zoom-pct { font-size: var(--font-13); color: var(--text-secondary); min-width: 38px; text-align: center; }

    .slide-count { font-size: var(--font-13); color: var(--text-secondary); min-width: 44px; text-align: center; font-variant-numeric: tabular-nums; display: inline-flex; align-items: center; justify-content: center; }

    .sync-indicator { display: inline-flex; align-items: center; margin-left: auto; color: var(--primary); font-size: var(--font-16); animation: sync-pulse 1.2s ease-in-out infinite; }

    .sync-indicator .icon { display: inline-flex; }
    .sync-indicator .icon svg { width: 18px; height: 18px; display: block; }

    .sync-indicator.unsynced { color: var(--text-secondary); animation: sync-spin 1s linear infinite; }

    @keyframes sync-spin { to { transform: rotate(360deg); } }

    @keyframes sync-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

    .color-row { display: flex; align-items: center; gap: 6px; }

    .swatch {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid transparent;
      cursor: pointer;
      padding: 0;
      box-shadow: 0 0 0 1px var(--border);
    }

    .swatch.active { border-color: var(--text-primary); box-shadow: 0 0 0 2px var(--background), 0 0 0 3px var(--text-primary); }

    .swatch.dark { box-shadow: 0 0 0 1px var(--border); }

    .custom-color { position: relative; width: 20px; height: 20px; border-radius: 50%; overflow: hidden; box-shadow: 0 0 0 1px var(--border); cursor: pointer; }

    .custom-color input { position: absolute; inset: -6px; width: 32px; height: 32px; border: none; cursor: pointer; }

    .size-control { display: flex; align-items: center; gap: 5px; color: var(--text-secondary); }

    .size-control .icon { display: inline-flex; }
    .size-control .icon svg { width: 16px; height: 16px; display: block; }

    .size-control input { width: 70px; accent-color: var(--primary); cursor: pointer; }

    .board-canvas-wrap {
      flex: 1;
      position: relative;
      min-height: 0;
      overflow: hidden;
      background: var(--background);
    }

    .board-canvas-wrap canvas { position: absolute; inset: 0; }

    .board-empty-hint {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      color: var(--text-secondary);
      opacity: 0.7;
      pointer-events: none;
      font-size: var(--font-14);
      text-align: center;
      user-select: none;
    }

    .board-empty-hint .icon { display: inline-flex; opacity: 0.4; }
    .board-empty-hint .icon svg { width: 44px; height: 44px; display: block; }
  `]
})
export class BoardPanelComponent implements OnInit, OnDestroy {
  @Input() roomId: string = '';

  @ViewChild('wrap') wrapEl!: ElementRef<HTMLDivElement>;
  @ViewChild('canvasEl') canvasEl!: ElementRef<HTMLCanvasElement>;

  private signalR = inject(SignalRService);
  private fb = inject(UiFeedbackService);
  private ngZone = inject(NgZone);
  private sanitizer = inject(DomSanitizer);

  icon(name: string): SafeHtml {
    const body = BOARD_ICONS[name] ?? '';
    const svg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  private canvas!: fabric.Canvas;
  private resizeObs?: ResizeObserver;
  private subs: Subscription[] = [];

  tool: BoardTool = 'select';
  activeGroup: BoardGroup = 'tools';
  color = PALETTE[1].color;
  strokeWidth = 3;
  palette = PALETTE;

  private history: string[] = [];
  private redoStack: string[] = [];
  private suppress = false;
  private debounce: any;
  private startPoint: { x: number; y: number } | null = null;
  private activeShape: fabric.Object | null = null;
  private erasing = false;
  private erasePreview: fabric.Object | null = null;
  private eraserPts: { x: number; y: number }[] = [];
  private eraseSize = 24;

  ngOnInit(): void {
    this.subs.push(
      this.signalR.boardChanged$.subscribe(d => {
        if (d.roomId !== this.roomId || !d.json) return;
        this.ngZone.run(() => this.synced = true);
        this.applyRemote(d.json);
      }),
      this.signalR.boardLoaded$.subscribe(d => {
        if (d.roomId !== this.roomId) return;
        if (d.json) this.applyRemote(d.json, true);
      }),
      this.signalR.boardCleared$.subscribe(d => {
        if (d.roomId !== this.roomId) return;
        this.ngZone.run(() => this.synced = true);
        this.ngZone.run(() => this.clearRemote());
      })
    );
  }

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => this.initCanvas());
    void this.signalR.startConnection().then(() => this.signalR.requestBoard(this.roomId));
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.resizeObs?.disconnect();
    if (this.debounce) clearTimeout(this.debounce);
    this.canvas?.dispose();
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.redo(); else this.undo();
      return;
    }
    if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      this.redo();
      return;
    }
    if (mod && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      this.duplicateSelected();
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      this.deleteSelected();
      return;
    }
    if (e.key === '+' || e.key === '=') { this.zoomIn(); return; }
    if (e.key === '-' || e.key === '_') { this.zoomOut(); return; }
    if (e.key === '0') { this.zoomFit(); return; }
    if (e.key === 'PageDown') { e.preventDefault(); this.nextSlide(); return; }
    if (e.key === 'PageUp') { e.preventDefault(); this.prevSlide(); return; }
  }

  setGroup(group: BoardGroup): void {
    this.activeGroup = group;
  }

  setTool(tool: BoardTool): void {
    this.tool = tool;
    this.canvas.isDrawingMode = tool === 'pen';
    if (tool === 'pen') {
      this.canvas.freeDrawingBrush.width = this.strokeWidth;
      this.canvas.freeDrawingBrush.color = this.color;
    } else {
      this.canvas.selection = true;
      this.canvas.discardActiveObject();
      this.canvas.requestRenderAll();
    }
  }

  // â”€â”€ Canva-style actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  zoom = 1;
  opacity = 1;
  dashed = false;
  fontSize = 32;
  bold = false;
  slides: { id: number; json: string; color: string }[] = [{ id: 1, json: '', color: '#F8FAFC' }];
  activeSlide = 0;
  private sliding = false;
  synced = true;
  isEmpty = true;

  prevSlide(): void {
    if (this.activeSlide > 0) this.goSlide(this.activeSlide - 1);
  }

  nextSlide(): void {
    if (this.activeSlide < this.slides.length - 1) this.goSlide(this.activeSlide + 1);
  }

  addSlide(): void {
    const id = Date.now();
    this.slides.push({ id, json: JSON.stringify(this.canvas.toJSON()), color: this.slides[this.activeSlide].color });
    this.activeSlide = this.slides.length - 1;
    this.canvas.clear();
    this.canvas.backgroundColor = this.slides[this.activeSlide].color;
    this.canvas.requestRenderAll();
    this.scheduleBroadcast();
  }

  duplicateSlide(): void {
    const cur = this.slides[this.activeSlide];
    const copy = { id: Date.now(), json: cur.json, color: cur.color };
    this.slides.splice(this.activeSlide + 1, 0, copy);
    this.activeSlide += 1;
    this.applySlideJson(copy.json);
    this.scheduleBroadcast();
    void this.signalR.boardChanged(this.roomId, JSON.stringify(this.canvas.toJSON()));
  }

  deleteSlide(): void {
    if (this.slides.length <= 1) { this.scheduleBroadcast(); return; }
    this.slides.splice(this.activeSlide, 1);
    if (this.activeSlide >= this.slides.length) this.activeSlide = this.slides.length - 1;
    this.applySlideJson(this.slides[this.activeSlide].json);
    this.scheduleBroadcast();
    void this.signalR.boardChanged(this.roomId, JSON.stringify(this.canvas.toJSON()));
  }

  goSlide(i: number): void {
    if (i === this.activeSlide || this.sliding) return;
    this.sliding = true;
    this.slides[this.activeSlide].json = JSON.stringify(this.canvas.toJSON());
    this.activeSlide = i;
    this.applySlideJson(this.slides[i].json);
    void this.signalR.boardChanged(this.roomId, JSON.stringify(this.canvas.toJSON()));
    this.sliding = false;
  }

  private applySlideJson(json: string): void {
    if (!json) { this.canvas.clear(); return; }
    this.suppress = true;
    this.canvas.loadFromJSON(json, () => {
      this.canvas.backgroundColor = this.slides[this.activeSlide].color;
      this.canvas.requestRenderAll();
      this.suppress = false;
    });
  }

  setZoom(z: number): void {
    this.zoom = z;
    this.canvas.setZoom(z);
    this.canvas.requestRenderAll();
  }

  zoomIn(): void  { this.setZoom(Math.min(4, +(this.zoom * 1.2).toFixed(2))); }
  zoomOut(): void { this.setZoom(Math.max(0.25, +(this.zoom / 1.2).toFixed(2))); }

  zoomFit(): void {
    const c = this.canvas;
    const objects = c.getObjects();
    if (!objects.length) { this.setZoom(1); return; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    objects.forEach(o => {
      const r = o.getBoundingRect();
      minX = Math.min(minX, r.left);
      minY = Math.min(minY, r.top);
      maxX = Math.max(maxX, r.left + r.width);
      maxY = Math.max(maxY, r.top + r.height);
    });
    const pad = 60;
    const w = Math.max(maxX - minX, 1);
    const h = Math.max(maxY - minY, 1);
    const z = Math.min((c.getWidth() - pad) / w, (c.getHeight() - pad) / h);
    this.setZoom(Math.max(0.25, Math.min(z, 1.5)));
  }

  setOpacity(v: number): void {
    this.opacity = v;
    const o = this.canvas.getActiveObject();
    if (o) {
      o.set('opacity', v);
      this.canvas.requestRenderAll();
      this.scheduleBroadcast();
    }
  }

  toggleDash(): void {
    this.dashed = !this.dashed;
    const o = this.canvas.getActiveObject();
    if (o) {
      o.set('strokeDashArray', this.dashed ? [10, 8] : undefined);
      this.canvas.requestRenderAll();
      this.scheduleBroadcast();
    }
  }

  setFontSize(v: number): void {
    this.fontSize = v;
    const o = this.canvas.getActiveObject();
    if (o && (o as any).isType && (o as any).isType('text')) {
      o.set('fontSize' as any, v);
      this.canvas.requestRenderAll();
      this.scheduleBroadcast();
    }
  }

  toggleBold(): void {
    this.bold = !this.bold;
    const o = this.canvas.getActiveObject();
    if (o && (o as any).isType && (o as any).isType('text')) {
      o.set('fontWeight' as any, this.bold ? 'bold' : 'normal');
      this.canvas.requestRenderAll();
      this.scheduleBroadcast();
    }
  }

  duplicateSelected(): void {
    const o = this.canvas.getActiveObject();
    if (!o) return;
    o.clone((dup: fabric.Object) => {
      dup.set({
        left: (o.left ?? 0) + 24,
        top: (o.top ?? 0) + 24,
        evented: true
      });
      this.canvas.add(dup);
      this.canvas.setActiveObject(dup);
      this.canvas.requestRenderAll();
      this.scheduleBroadcast();
    });
  }

  deleteSelected(): void {
    const o = this.canvas.getActiveObject();
    if (!o) return;
    if (o instanceof fabric.ActiveSelection) {
      o.getObjects().forEach(p => this.canvas.remove(p as fabric.Object));
    } else {
      this.canvas.remove(o);
    }
    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
    this.scheduleBroadcast();
  }

  bringForward(): void  {
    const o = this.canvas.getActiveObject();
    if (!o) return;
    this.canvas.bringForward(o);
    this.canvas.requestRenderAll();
    this.scheduleBroadcast();
  }

  sendBackwards(): void {
    const o = this.canvas.getActiveObject();
    if (!o) return;
    this.canvas.sendBackwards(o);
    this.canvas.requestRenderAll();
    this.scheduleBroadcast();
  }

  onColorInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    if (/^#[0-9A-Fa-f]{6}$/.test(el.value)) this.color = el.value;
  }

  undo(): void {
    if (!this.history.length) { this.fb.info('Nothing to undo'); return; }
    const prev = this.history.pop();
    const cur = JSON.stringify(this.canvas.toJSON());
    this.redoStack.push(cur);
    this.applyAndBroadcast(prev!);
  }

  redo(): void {
    if (!this.redoStack.length) { this.fb.info('Nothing to redo'); return; }
    const next = this.redoStack.pop();
    const cur = JSON.stringify(this.canvas.toJSON());
    this.history.push(cur);
    this.applyAndBroadcast(next!);
  }

  async clearBoard(): Promise<void> {
    const ok = await this.fb.confirm({
      title: 'Clear the board?',
      message: 'This removes every element for everyone in the room.',
      confirmLabel: 'Clear board',
      danger: true
    });
    if (!ok) return;
    this.suppress = true;
    this.canvas.clear();
    this.suppress = false;
    this.history = [];
    this.redoStack = [];
    void this.signalR.boardClear(this.roomId);
  }

  clearRemote(): void {
    this.suppress = true;
    this.canvas.clear();
    this.suppress = false;
    this.history = [];
    this.redoStack = [];
  }

  exportPng(): void {
    const dataUrl = this.canvas.toDataURL({ format: 'png', multiplier: 2, enableRetinaScaling: false });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `board-${this.roomId}.png`;
    a.click();
    this.fb.success('Board exported as image');
  }

  private initCanvas(): void {
    const host = this.wrapEl.nativeElement;
    const canvasEl = this.canvasEl.nativeElement;
    this.canvas = new fabric.Canvas(canvasEl, {
      backgroundColor: '#F8FAFC',
      selection: true,
      preserveObjectStacking: true
    });

    this.resizeCanvas();
    this.resizeObs = new ResizeObserver(() => this.resizeCanvas());
    this.resizeObs.observe(host);

    this.canvas.on('mouse:down', o => this.onMouseDown(o));
    this.canvas.on('mouse:move', o => this.onMouseMove(o));
    this.canvas.on('mouse:up', () => this.onMouseUp());
    this.canvas.on('object:added', () => this.refreshEmpty());
    this.canvas.on('object:removed', () => this.refreshEmpty());
    this.canvas.on('object:modified', () => this.scheduleBroadcast());
    this.canvas.on('object:removed', () => this.scheduleBroadcast());
    this.canvas.on('path:created', () => this.scheduleBroadcast());
    this.canvas.on('text:changed', () => this.scheduleBroadcast());
  }

  private refreshEmpty(): void {
    this.ngZone.run(() => this.isEmpty = this.canvas.getObjects().length === 0);
  }

  private resizeCanvas(): void {
    if (!this.canvas) return;
    const host = this.wrapEl?.nativeElement;
    if (!host) return;
    const wrapper = (this.canvas as any).wrapperEl as HTMLElement;
    if (!wrapper) return;
    this.canvas.setDimensions({ width: host.clientWidth, height: host.clientHeight });
    wrapper.style.width = `${host.clientWidth}px`;
    wrapper.style.height = `${host.clientHeight}px`;
    this.canvas.calcOffset();
    this.canvas.requestRenderAll();
  }

  private onMouseDown(opt: fabric.IEvent): void {
    if (this.tool === 'eraser') {
      const pointer = this.canvas.getPointer(opt.e);
      this.erasing = true;
      this.eraserPts = [pointer];
      this.showErasePreview(pointer);
      return;
    }
    if (this.tool === 'select' || this.tool === 'pen') return;
    const pointer = this.canvas.getPointer(opt.e);
    this.startPoint = { x: pointer.x, y: pointer.y };
    const c = this.color;

    switch (this.tool) {
      case 'rect':
        this.activeShape = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
          width: 0,
          height: 0,
          fill: this.rgbaFill(c, 0.18),
          stroke: c,
          strokeWidth: this.strokeWidth
        });
        break;
      case 'circle':
        this.activeShape = new fabric.Ellipse({
          left: pointer.x,
          top: pointer.y,
          rx: 0,
          ry: 0,
          originX: 'center',
          originY: 'center',
          fill: this.rgbaFill(c, 0.18),
          stroke: c,
          strokeWidth: this.strokeWidth
        });
        break;
      case 'triangle':
        this.activeShape = new fabric.Polygon([
          { x: 0, y: -50 },
          { x: -58, y: 50 },
          { x: 58, y: 50 }
        ], {
          left: pointer.x,
          top: pointer.y,
          originX: 'center',
          originY: 'center',
          fill: this.rgbaFill(c, 0.18),
          stroke: c,
          strokeWidth: this.strokeWidth,
          scaleX: 0.1,
          scaleY: 0.1
        });
        break;
      case 'diamond':
        this.activeShape = new fabric.Polygon([
          { x: 0, y: -50 },
          { x: 42, y: 0 },
          { x: 0, y: 50 },
          { x: -42, y: 0 }
        ], {
          left: pointer.x,
          top: pointer.y,
          originX: 'center',
          originY: 'center',
          fill: this.rgbaFill(c, 0.18),
          stroke: c,
          strokeWidth: this.strokeWidth,
          scaleX: 0.1,
          scaleY: 0.1
        });
        break;
      case 'hexagon':
        this.activeShape = new fabric.Polygon([
          { x: 0, y: -50 },
          { x: 43, y: -25 },
          { x: 43, y: 25 },
          { x: 0, y: 50 },
          { x: -43, y: 25 },
          { x: -43, y: -25 }
        ], {
          left: pointer.x,
          top: pointer.y,
          originX: 'center',
          originY: 'center',
          fill: this.rgbaFill(c, 0.18),
          stroke: c,
          strokeWidth: this.strokeWidth,
          scaleX: 0.1,
          scaleY: 0.1
        });
        break;
      case 'star':
        this.activeShape = new fabric.Polygon([
          { x: 0, y: -52 },
          { x: 12, y: -18 },
          { x: 48, y: -18 },
          { x: 18, y: 4 },
          { x: 30, y: 38 },
          { x: 0, y: 18 },
          { x: -30, y: 38 },
          { x: -18, y: 4 },
          { x: -48, y: -18 },
          { x: -12, y: -18 }
        ], {
          left: pointer.x,
          top: pointer.y,
          originX: 'center',
          originY: 'center',
          fill: this.rgbaFill(c, 0.18),
          stroke: c,
          strokeWidth: this.strokeWidth,
          scaleX: 0.1,
          scaleY: 0.1
        });
        break;
      case 'line':
      case 'arrow':
        this.activeShape = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
          stroke: c,
          strokeWidth: this.strokeWidth
        });
        break;
      case 'ellipse':
        this.activeShape = new fabric.Ellipse({
          left: pointer.x,
          top: pointer.y,
          rx: 0,
          ry: 0,
          originX: 'center',
          originY: 'center',
          fill: this.rgbaFill(c, 0.18),
          stroke: c,
          strokeWidth: this.strokeWidth
        });
        break;
      case 'square':
        this.activeShape = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
          width: 0,
          height: 0,
          fill: this.rgbaFill(c, 0.18),
          stroke: c,
          strokeWidth: this.strokeWidth
        });
        break;
      case 'semicircle':
        this.activeShape = new fabric.Polygon([
          { x: -50, y: 50 },
          { x: 50, y: 50 },
          { x: 50, y: 0 },
          { x: 41, y: -29 },
          { x: 25, y: -43 },
          { x: 0, y: -50 },
          { x: -25, y: -43 },
          { x: -41, y: -29 },
          { x: -50, y: 0 }
        ], {
          left: pointer.x,
          top: pointer.y,
          originX: 'center',
          originY: 'center',
          fill: this.rgbaFill(c, 0.18),
          stroke: c,
          strokeWidth: this.strokeWidth,
          scaleX: 0.1,
          scaleY: 0.1
        });
        break;
      case 'octagon':
        this.activeShape = new fabric.Polygon([
          { x: 0, y: -50 },
          { x: 35, y: -35 },
          { x: 50, y: 0 },
          { x: 35, y: 35 },
          { x: 0, y: 50 },
          { x: -35, y: 35 },
          { x: -50, y: 0 },
          { x: -35, y: -35 }
        ], {
          left: pointer.x,
          top: pointer.y,
          originX: 'center',
          originY: 'center',
          fill: this.rgbaFill(c, 0.18),
          stroke: c,
          strokeWidth: this.strokeWidth,
          scaleX: 0.1,
          scaleY: 0.1
        });
        break;
      case 'trapezoid':
        this.activeShape = new fabric.Polygon([
          { x: -30, y: -50 },
          { x: 30, y: -50 },
          { x: 50, y: 50 },
          { x: -50, y: 50 }
        ], {
          left: pointer.x,
          top: pointer.y,
          originX: 'center',
          originY: 'center',
          fill: this.rgbaFill(c, 0.18),
          stroke: c,
          strokeWidth: this.strokeWidth,
          scaleX: 0.1,
          scaleY: 0.1
        });
        break;
      case 'crescent':
        this.activeShape = new fabric.Polygon([
          { x: 0, y: -50 },
          { x: 42, y: -38 },
          { x: 50, y: 0 },
          { x: 42, y: 38 },
          { x: 0, y: 50 },
          { x: -14, y: 34 },
          { x: -36, y: 24 },
          { x: -36, y: -24 },
          { x: -14, y: -34 }
        ], {
          left: pointer.x,
          top: pointer.y,
          originX: 'center',
          originY: 'center',
          fill: this.rgbaFill(c, 0.18),
          stroke: c,
          strokeWidth: this.strokeWidth,
          scaleX: 0.1,
          scaleY: 0.1
        });
        break;
      case 'droplet':
        this.activeShape = new fabric.Polygon([
          { x: 0, y: -50 },
          { x: 36, y: 4 },
          { x: 25, y: 36 },
          { x: 0, y: 50 },
          { x: -25, y: 36 },
          { x: -36, y: 4 }
        ], {
          left: pointer.x,
          top: pointer.y,
          originX: 'center',
          originY: 'center',
          fill: this.rgbaFill(c, 0.18),
          stroke: c,
          strokeWidth: this.strokeWidth,
          scaleX: 0.1,
          scaleY: 0.1
        });
        break;
      case 'cloud':
        this.activeShape = new fabric.Polygon([
          { x: 0, y: -40 },
          { x: 18, y: -44 },
          { x: 36, y: -30 },
          { x: 50, y: -14 },
          { x: 44, y: 8 },
          { x: 34, y: 26 },
          { x: 14, y: 40 },
          { x: -14, y: 40 },
          { x: -38, y: 26 },
          { x: -50, y: 6 },
          { x: -42, y: -16 },
          { x: -26, y: -34 }
        ], {
          left: pointer.x,
          top: pointer.y,
          originX: 'center',
          originY: 'center',
          fill: this.rgbaFill(c, 0.18),
          stroke: c,
          strokeWidth: this.strokeWidth,
          scaleX: 0.1,
          scaleY: 0.1
        });
        break;
      case 'cross':
        this.activeShape = new fabric.Polygon([
          { x: -14, y: -50 },
          { x: 14, y: -50 },
          { x: 14, y: -14 },
          { x: 50, y: -14 },
          { x: 50, y: 14 },
          { x: 14, y: 14 },
          { x: 14, y: 50 },
          { x: -14, y: 50 },
          { x: -14, y: 14 },
          { x: -50, y: 14 },
          { x: -50, y: -14 },
          { x: -14, y: -14 }
        ], {
          left: pointer.x,
          top: pointer.y,
          originX: 'center',
          originY: 'center',
          fill: this.rgbaFill(c, 0.18),
          stroke: c,
          strokeWidth: this.strokeWidth,
          scaleX: 0.1,
          scaleY: 0.1
        });
        break;
      case 'chevron':
        this.activeShape = new fabric.Polygon([
          { x: -50, y: -50 },
          { x: 26, y: 0 },
          { x: -50, y: 50 },
          { x: -24, y: 50 },
          { x: 50, y: 0 },
          { x: -24, y: -50 }
        ], {
          left: pointer.x,
          top: pointer.y,
          originX: 'center',
          originY: 'center',
          fill: this.rgbaFill(c, 0.18),
          stroke: c,
          strokeWidth: this.strokeWidth,
          scaleX: 0.1,
          scaleY: 0.1
        });
        break;
      case 'doubleArrow':
        this.activeShape = new fabric.Polygon([
          { x: -16, y: -50 },
          { x: -50, y: 0 },
          { x: -16, y: 50 },
          { x: 16, y: 50 },
          { x: 50, y: 0 },
          { x: 16, y: -50 }
        ], {
          left: pointer.x,
          top: pointer.y,
          originX: 'center',
          originY: 'center',
          fill: this.rgbaFill(c, 0.18),
          stroke: c,
          strokeWidth: this.strokeWidth,
          scaleX: 0.1,
          scaleY: 0.1
        });
        break;
      case 'sparkle':
        this.activeShape = new fabric.Polygon([
          { x: 0, y: -50 },
          { x: 12, y: -12 },
          { x: 50, y: 0 },
          { x: 12, y: 12 },
          { x: 0, y: 50 },
          { x: -12, y: 12 },
          { x: -50, y: 0 },
          { x: -12, y: -12 }
        ], {
          left: pointer.x,
          top: pointer.y,
          originX: 'center',
          originY: 'center',
          fill: this.rgbaFill(c, 0.18),
          stroke: c,
          strokeWidth: this.strokeWidth,
          scaleX: 0.1,
          scaleY: 0.1
        });
        break;
      case 'star6':
        this.activeShape = new fabric.Polygon([
          { x: 0, y: -50 },
          { x: 10, y: -18 },
          { x: 39, y: -31 },
          { x: 16, y: 0 },
          { x: 39, y: 31 },
          { x: 10, y: 18 },
          { x: 0, y: 50 },
          { x: -10, y: 18 },
          { x: -39, y: 31 },
          { x: -16, y: 0 },
          { x: -39, y: -31 },
          { x: -10, y: -18 }
        ], {
          left: pointer.x,
          top: pointer.y,
          originX: 'center',
          originY: 'center',
          fill: this.rgbaFill(c, 0.18),
          stroke: c,
          strokeWidth: this.strokeWidth,
          scaleX: 0.1,
          scaleY: 0.1
        });
        break;
      case 'tag':
        this.activeShape = new fabric.Polygon([
          { x: -50, y: -35 },
          { x: 34, y: -35 },
          { x: 50, y: -12 },
          { x: 50, y: 12 },
          { x: 34, y: 35 },
          { x: -50, y: 35 }
        ], {
          left: pointer.x,
          top: pointer.y,
          originX: 'center',
          originY: 'center',
          fill: this.rgbaFill(c, 0.18),
          stroke: c,
          strokeWidth: this.strokeWidth,
          scaleX: 0.1,
          scaleY: 0.1
        });
        break;
      case 'pentagon':
        this.activeShape = new fabric.Polygon([
          { x: 0, y: -50 },
          { x: 48, y: -15 },
          { x: 30, y: 40 },
          { x: -30, y: 40 },
          { x: -48, y: -15 }
        ], {
          left: pointer.x,
          top: pointer.y,
          originX: 'center',
          originY: 'center',
          fill: this.rgbaFill(c, 0.18),
          stroke: c,
          strokeWidth: this.strokeWidth,
          scaleX: 0.1,
          scaleY: 0.1
        });
        break;
      case 'heart':
        this.activeShape = new fabric.Polygon([
          { x: 0, y: -38 },
          { x: 14, y: -52 },
          { x: 34, y: -52 },
          { x: 50, y: -34 },
          { x: 50, y: -12 },
          { x: 34, y: 10 },
          { x: 0, y: 48 },
          { x: -34, y: 10 },
          { x: -50, y: -12 },
          { x: -50, y: -34 },
          { x: -34, y: -52 },
          { x: -14, y: -52 }
        ], {
          left: pointer.x,
          top: pointer.y,
          originX: 'center',
          originY: 'center',
          fill: this.rgbaFill(c, 0.18),
          stroke: c,
          strokeWidth: this.strokeWidth,
          scaleX: 0.1,
          scaleY: 0.1
        });
        break;
      case 'shield':
        this.activeShape = new fabric.Polygon([
          { x: 0, y: -52 },
          { x: 42, y: -44 },
          { x: 42, y: 4 },
          { x: 0, y: 50 },
          { x: -42, y: 4 },
          { x: -42, y: -44 }
        ], {
          left: pointer.x,
          top: pointer.y,
          originX: 'center',
          originY: 'center',
          fill: this.rgbaFill(c, 0.18),
          stroke: c,
          strokeWidth: this.strokeWidth,
          scaleX: 0.1,
          scaleY: 0.1
        });
        break;
      case 'bolt':
        this.activeShape = new fabric.Polygon([
          { x: 10, y: -50 },
          { x: -36, y: 4 },
          { x: -6, y: 4 },
          { x: -10, y: 50 },
          { x: 36, y: -8 },
          { x: 8, y: -8 }
        ], {
          left: pointer.x,
          top: pointer.y,
          originX: 'center',
          originY: 'center',
          fill: this.rgbaFill(c, 0.18),
          stroke: c,
          strokeWidth: this.strokeWidth,
          scaleX: 0.1,
          scaleY: 0.1
        });
        break;
      case 'plus':
        this.activeShape = new fabric.Polygon([
          { x: -16, y: -50 },
          { x: 16, y: -50 },
          { x: 16, y: -16 },
          { x: 50, y: -16 },
          { x: 50, y: 16 },
          { x: 16, y: 16 },
          { x: 16, y: 50 },
          { x: -16, y: 50 },
          { x: -16, y: 16 },
          { x: -50, y: 16 },
          { x: -50, y: -16 },
          { x: -16, y: -16 }
        ], {
          left: pointer.x,
          top: pointer.y,
          originX: 'center',
          originY: 'center',
          fill: this.rgbaFill(c, 0.18),
          stroke: c,
          strokeWidth: this.strokeWidth,
          scaleX: 0.1,
          scaleY: 0.1
        });
        break;
      case 'ring':
        this.activeShape = new fabric.Ellipse({
          left: pointer.x,
          top: pointer.y,
          rx: 0,
          ry: 0,
          originX: 'center',
          originY: 'center',
          fill: 'rgba(0,0,0,0)',
          stroke: c,
          strokeWidth: this.strokeWidth + 6
        });
        break;
      case 'text': {
        const text = new fabric.IText('Type something', {
          left: pointer.x,
          top: pointer.y,
          fontFamily: 'Inter',
          fontSize: 24,
          fill: c
        });
        this.canvas.add(text);
        this.canvas.setActiveObject(text);
        this.ngZone.run(() => {
          this.tool = 'select';
          this.canvas.isDrawingMode = false;
        });
        text.enterEditing();
        text.selectAll();
        this.scheduleBroadcast();
        return;
      }
    }

    this.canvas.add(this.activeShape!);
  }

  private showErasePreview(p: { x: number; y: number }): void {
    this.suppress = true;
    this.erasePreview = new fabric.Polyline(
      [new fabric.Point(p.x, p.y)],
      {
        fill: 'rgba(148, 163, 184, 0.25)',
        stroke: 'rgba(148, 163, 184, 0.6)',
        strokeWidth: this.eraseSize,
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
        selectable: false,
        evented: false,
        hoverCursor: 'default',
        excludeFromExport: true,
        objectCaching: false
      }
    );
    this.canvas.add(this.erasePreview);
    this.canvas.requestRenderAll();
    this.suppress = false;
  }

  private updateErasePreview(): void {
    const preview = this.erasePreview as fabric.Polyline | null;
    if (!preview) return;
    this.suppress = true;
    preview.set({ points: this.eraserPts.map(q => new fabric.Point(q.x, q.y)) });
    preview.setCoords();
    this.canvas.requestRenderAll();
    this.suppress = false;
  }

  private hideErasePreview(): void {
    if (!this.erasePreview) return;
    this.suppress = true;
    this.canvas.remove(this.erasePreview);
    this.erasePreview = null;
    this.canvas.requestRenderAll();
    this.suppress = false;
  }

  private applyEraseStroke(): void {
    const pts = this.eraserPts;
    this.eraserPts = [];
    if (!pts.length) return;
    const radius = this.eraseSize / 2;
    const touched = new Set<fabric.Object>();
    const objs = this.canvas.getObjects().slice().reverse();
    for (const o of objs) {
      if (o === this.erasePreview || !o.visible) continue;
      for (const p of pts) {
        if (this.objectHits(o, p, radius)) {
          touched.add(o);
          break;
        }
      }
    }
    if (!touched.size) return;
    this.suppress = true;
    for (const o of touched) {
      const img = this.carveObject(o, pts);
      if (!img) continue;
      this.canvas.remove(o);
      this.canvas.add(img);
    }
    this.suppress = false;
    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
    this.scheduleBroadcast();
  }

  private carveObject(o: fabric.Object, pts: { x: number; y: number }[]): fabric.Image | null {
    try {
      const box = o.getBoundingRect();
      if (box.width < 1 && box.height < 1) return null;
      const m = 2;
      const el = o.toCanvasElement({
        multiplier: m,
        withoutShadow: true,
        enableRetinaScaling: false
      } as any) as HTMLCanvasElement;
      if (!el || !el.width || !el.height) return null;
      const ctx = el.getContext('2d');
      if (!ctx) return null;
      const sx = el.width / box.width;
      const sy = el.height / box.height;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = this.eraseSize * ((sx + sy) / 2);
      if (pts.length === 1) {
        const px = (pts[0].x - box.left) * sx;
        const py = (pts[0].y - box.top) * sy;
        ctx.beginPath();
        ctx.arc(px, py, this.eraseSize * sx / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo((pts[0].x - box.left) * sx, (pts[0].y - box.top) * sy);
        for (let i = 1; i < pts.length; i++) ctx.lineTo((pts[i].x - box.left) * sx, (pts[i].y - box.top) * sy);
        ctx.stroke();
      }
      ctx.restore();
      const img = new fabric.Image(el);
      img.set({
        left: box.left,
        top: box.top,
        width: el.width,
        height: el.height,
        scaleX: 1 / m,
        scaleY: 1 / m,
        angle: 0,
        originX: 'left',
        originY: 'top'
      });
      img.setCoords();
      return img;
    } catch {
      return null;
    }
  }

  private objectHits(o: fabric.Object, p: { x: number; y: number }, radius: number): boolean {
    if (o instanceof fabric.ActiveSelection) return false;
    const r = o.getBoundingRect();
    if (p.x < r.left - radius || p.x > r.left + r.width + radius) return false;
    if (p.y < r.top - radius || p.y > r.top + r.height + radius) return false;
    try {
      if (o.isContainedWithinObject?.(p as any)) return true;
      if (o.containsPoint(p as any)) return true;
    } catch {
      return false;
    }
    return true;
  }

  private onMouseMove(opt: fabric.IEvent): void {
    if (this.tool === 'eraser') {
      if (!this.erasing) return;
      const pointer = this.canvas.getPointer(opt.e);
      const last = this.eraserPts[this.eraserPts.length - 1];
      if (last && Math.hypot(pointer.x - last.x, pointer.y - last.y) < 1) return;
      this.eraserPts.push(pointer);
      this.updateErasePreview();
      return;
    }
    if (!this.startPoint || !this.activeShape) return;
    const pointer = this.canvas.getPointer(opt.e);
    const sx = this.startPoint.x;
    const sy = this.startPoint.y;
    const dx = pointer.x - sx;
    const dy = pointer.y - sy;

    if (this.activeShape instanceof fabric.Rect) {
      const w = Math.abs(dx);
      const h = Math.abs(dy);
      const sz = this.tool === 'square' ? Math.max(w, h) : 0;
      this.activeShape.set({
        left: Math.min(sx, pointer.x),
        top: Math.min(sy, pointer.y),
        width: this.tool === 'square' ? sz : w,
        height: this.tool === 'square' ? sz : h
      });
    } else if (this.activeShape instanceof fabric.Ellipse) {
      if (this.tool === 'ellipse') {
        this.activeShape.set({ rx: Math.abs(dx) / 2, ry: Math.abs(dy) / 2, left: (sx + pointer.x) / 2, top: (sy + pointer.y) / 2 });
      } else {
        const rx = Math.abs(dx) / 2;
        this.activeShape.set({ rx, ry: rx, left: (sx + pointer.x) / 2, top: (sy + pointer.y) / 2 });
      }
    } else if (this.activeShape instanceof fabric.Polygon) {
      const size = Math.max(Math.abs(dx), Math.abs(dy)) / 100;
      this.activeShape.set({
        scaleX: size,
        scaleY: size,
        left: (sx + pointer.x) / 2,
        top: (sy + pointer.y) / 2
      });
    } else if (this.activeShape instanceof fabric.Line) {
      this.activeShape.set({ x2: pointer.x, y2: pointer.y });
    }
    this.activeShape.setCoords();
    this.canvas.requestRenderAll();
  }

  private onMouseUp(): void {
    if (this.tool === 'eraser') {
      this.erasing = false;
      this.hideErasePreview();
      this.applyEraseStroke();
      return;
    }
    if (!this.startPoint || !this.activeShape) return;
    const start = this.startPoint;
    const shape = this.activeShape;
    this.startPoint = null;
    this.activeShape = null;

    if (this.tool === 'arrow' && shape instanceof fabric.Line) {
      const end = {
        x: shape.get('x2') as number,
        y: shape.get('y2') as number
      };
      this.canvas.remove(shape);
      this.canvas.add(this.makeArrow(start.x, start.y, end.x, end.y));
    }

    const zeroRect = shape.width === 0 && shape.height === 0;
    const zeroEllipse = shape instanceof fabric.Ellipse && shape.rx === 0;
    if (zeroRect || zeroEllipse) {
      this.canvas.remove(shape);
      return;
    }

    if (shape instanceof fabric.Line && shape.get('x1') === shape.get('x2') && shape.get('y1') === shape.get('y2')) {
      this.canvas.remove(shape);
      return;
    }

    this.canvas.discardActiveObject();
    this.scheduleBroadcast();
  }

  private rgbaFill(color: string, alpha: number): string {
    const col = new fabric.Color(color);
    col.setAlpha(alpha);
    return col.toRgba();
  }

  private makeArrow(x1: number, y1: number, x2: number, y2: number): fabric.Group {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = Math.max(14, this.strokeWidth * 3);
    const headAngle = Math.PI / 7;
    const line = new fabric.Line([x1, y1, x2, y2], {
      stroke: this.color,
      strokeWidth: this.strokeWidth
    });
    const head = new fabric.Polygon(
      [
        { x: x2, y: y2 },
        { x: x2 - headLen * Math.cos(angle - headAngle), y: y2 - headLen * Math.sin(angle - headAngle) },
        { x: x2 - headLen * Math.cos(angle + headAngle), y: y2 - headLen * Math.sin(angle + headAngle) }
      ],
      { fill: this.color }
    );
    return new fabric.Group([line, head]);
  }

  private scheduleBroadcast(): void {
    if (this.suppress) return;
    if (this.debounce) clearTimeout(this.debounce);
    this.ngZone.run(() => this.synced = false);
    this.debounce = setTimeout(() => this.broadcast(), 250);
  }

  private broadcast(): void {
    if (this.suppress) return;
    const json = JSON.stringify(this.canvas.toJSON());
    this.ngZone.run(() => {
      if (this.history.length > 30) this.history.shift();
      this.history.push(json);
      this.redoStack = [];
    });
    void this.signalR.boardChanged(this.roomId, json)
      .then(() => this.ngZone.run(() => this.synced = true))
      .catch(() => this.ngZone.run(() => this.synced = true));
  }

  private applyAndBroadcast(json: string): void {
    this.applyRemote(json);
    void this.signalR.boardChanged(this.roomId, json);
  }

  private applyRemote(json: string, fit = false): void {
    this.ngZone.runOutsideAngular(() => {
      this.suppress = true;
      this.canvas.loadFromJSON(json, () => {
        this.canvas.requestRenderAll();
        this.refreshEmpty();
        this.suppress = false;
        if (fit) this.zoomFit();
      });
    });
  }
}