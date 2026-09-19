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
import { CommonModule } from '@angular/common';
import { fabric } from 'fabric';
import { SignalRService } from '../../core/services/signalr.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { Subscription } from 'rxjs';
import { detectShape, SHAPE_PATH, SHAPE_POLY } from './shape-detector';
import type { DetectionResult, DetectedTool, Pt } from './shape-detector';

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
            <span class="material-icons">{{ synced ? 'cloud_done' : 'sync' }}</span>
          </span>
        </div>

        <div class="toolbar-content" [class.scrolled]="true">
          <ng-container *ngIf="activeGroup === 'tools'">
            <button
              class="tool-btn"
              [class.active]="tool === 'select'"
              (click)="setTool('select')"
              title="Select / move"
            ><span class="material-icons">pan_tool</span></button>

             <button
               class="tool-btn"
               [class.active]="tool === 'pen'"
               (click)="setTool('pen')"
               title="Draw"
             ><span class="material-icons">edit</span></button>

             <button
               class="tool-btn"
               [class.active]="shapeDetect"
               (click)="shapeDetect = !shapeDetect"
               title="Snap drawn shapes to perfect shapes"
             ><span class="material-icons">tune</span></button>

             <button
               class="tool-btn"
               [class.active]="tool === 'eraser'"
               (click)="setTool('eraser')"
               title="Eraser"
             ><span class="material-icons">auto_fix_high</span></button>

            <button
              class="tool-btn"
              [class.active]="tool === 'text'"
              (click)="setTool('text')"
              title="Add text"
            ><span class="material-icons">text_fields</span></button>

            <span class="board-divider"></span>

            <div class="color-row">
              <button
                *ngFor="let p of palette"
                class="swatch"
                [class.active]="color === p.color"
                [class.dark]="p.color === '#FFFFFF'"
                [style.background]="p.color"
                (click)="setMainColor(p.color)"
                [title]="p.name"
                [attr.aria-label]="'Color ' + p.name"
              ></button>
              <label class="custom-color" title="Custom color">
                <input type="color" [value]="color" (input)="onColorInput($event)" />
              </label>
            </div>

            <span class="board-divider"></span>

            <label class="size-control">
              <span class="material-icons">line_weight</span>
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
            <button class="tool-btn" [class.active]="filled" (click)="filled = !filled" title="Filled / outline shapes"><span class="material-icons">format_color_fill</span></button>
            <button class="tool-btn" [class.active]="borderOn" (click)="toggleBorder()" title="Show / hide border"><span class="material-icons">border_clear</span></button>

            <label class="size-control" title="Fill opacity">
              <span class="material-icons">opacity</span>
              <input type="range" min="0.05" max="1" step="0.05" [value]="fillOpacity" (input)="setFillOpacity(+$any($event.target).value)" />
            </label>

            <div class="color-row border-row">
              <button
                *ngFor="let p of palette"
                class="swatch sm"
                [class.active]="fillColor === p.color"
                [class.dark]="p.color === '#FFFFFF'"
                [style.background]="p.color"
                (click)="setFillColor(p.color)"
                [title]="'Fill ' + p.name"
                [attr.aria-label]="'Fill color ' + p.name"
              ></button>
              <label class="custom-color" title="Custom fill color">
                <input type="color" [value]="fillColor" (input)="onFillColorInput($event)" />
              </label>
            </div>

            <div class="color-row border-row">
              <button
                *ngFor="let p of palette"
                class="swatch sm"
                [class.active]="borderColor === p.color"
                [class.dark]="p.color === '#FFFFFF'"
                [style.background]="p.color"
                (click)="setBorderColor(p.color)"
                [title]="'Border ' + p.name"
                [attr.aria-label]="'Border color ' + p.name"
              ></button>
              <label class="custom-color" title="Custom border color">
                <input type="color" [value]="borderColor" (input)="onBorderColorInput($event)" />
              </label>
            </div>

            <span class="board-divider"></span>
            <button class="tool-btn" [class.active]="tool === 'rect'" (click)="setTool('rect')" title="Rectangle"><span class="material-icons">rectangle</span></button>
            <button class="tool-btn" [class.active]="tool === 'circle'" (click)="setTool('circle')" title="Circle"><span class="material-icons">circle</span></button>
            <button class="tool-btn" [class.active]="tool === 'line'" (click)="setTool('line')" title="Line"><span class="material-icons">straighten</span></button>
            <button class="tool-btn" [class.active]="tool === 'arrow'" (click)="setTool('arrow')" title="Arrow"><span class="material-icons">arrow_forward</span></button>
            <button class="tool-btn" [class.active]="tool === 'triangle'" (click)="setTool('triangle')" title="Triangle"><span class="material-icons">change_history</span></button>
            <button class="tool-btn" [class.active]="tool === 'diamond'" (click)="setTool('diamond')" title="Diamond"><span class="material-icons">diamond</span></button>
            <button class="tool-btn" [class.active]="tool === 'hexagon'" (click)="setTool('hexagon')" title="Hexagon"><span class="material-icons">hexagon</span></button>
            <button class="tool-btn" [class.active]="tool === 'star'" (click)="setTool('star')" title="Star"><span class="material-icons">star</span></button>
            <button class="tool-btn" [class.active]="tool === 'pentagon'" (click)="setTool('pentagon')" title="Pentagon"><span class="material-icons">pentagon</span></button>
            <button class="tool-btn" [class.active]="tool === 'heart'" (click)="setTool('heart')" title="Heart"><span class="material-icons">favorite</span></button>
            <button class="tool-btn" [class.active]="tool === 'shield'" (click)="setTool('shield')" title="Shield"><span class="material-icons">shield</span></button>
            <button class="tool-btn" [class.active]="tool === 'bolt'" (click)="setTool('bolt')" title="Lightning bolt"><span class="material-icons">bolt</span></button>
            <button class="tool-btn" [class.active]="tool === 'plus'" (click)="setTool('plus')" title="Plus"><span class="material-icons">add</span></button>
            <button class="tool-btn" [class.active]="tool === 'ring'" (click)="setTool('ring')" title="Ring"><span class="material-icons">radio_button_checked</span></button>
            <button class="tool-btn" [class.active]="tool === 'ellipse'" (click)="setTool('ellipse')" title="Ellipse"><span class="material-icons">lens</span></button>
            <button class="tool-btn" [class.active]="tool === 'square'" (click)="setTool('square')" title="Square"><span class="material-icons">crop_square</span></button>
            <button class="tool-btn" [class.active]="tool === 'semicircle'" (click)="setTool('semicircle')" title="Semicircle"><span class="material-icons">pie_chart</span></button>
            <button class="tool-btn" [class.active]="tool === 'octagon'" (click)="setTool('octagon')" title="Octagon"><span class="material-icons">workspaces</span></button>
            <button class="tool-btn" [class.active]="tool === 'trapezoid'" (click)="setTool('trapezoid')" title="Trapezoid"><span class="material-icons">home</span></button>
            <button class="tool-btn" [class.active]="tool === 'crescent'" (click)="setTool('crescent')" title="Crescent"><span class="material-icons">nightlight</span></button>
            <button class="tool-btn" [class.active]="tool === 'droplet'" (click)="setTool('droplet')" title="Droplet"><span class="material-icons">water_drop</span></button>
            <button class="tool-btn" [class.active]="tool === 'cloud'" (click)="setTool('cloud')" title="Cloud"><span class="material-icons">cloud</span></button>
            <button class="tool-btn" [class.active]="tool === 'cross'" (click)="setTool('cross')" title="Cross"><span class="material-icons">close</span></button>
            <button class="tool-btn" [class.active]="tool === 'chevron'" (click)="setTool('chevron')" title="Chevron"><span class="material-icons">chevron_right</span></button>
            <button class="tool-btn" [class.active]="tool === 'doubleArrow'" (click)="setTool('doubleArrow')" title="Double arrow"><span class="material-icons">double_arrow</span></button>
            <button class="tool-btn" [class.active]="tool === 'sparkle'" (click)="setTool('sparkle')" title="Sparkle star"><span class="material-icons">flare</span></button>
            <button class="tool-btn" [class.active]="tool === 'star6'" (click)="setTool('star6')" title="6-point star"><span class="material-icons">stars</span></button>
            <button class="tool-btn" [class.active]="tool === 'tag'" (click)="setTool('tag')" title="Tag"><span class="material-icons">tag</span></button>
          </ng-container>

          <ng-container *ngIf="activeGroup === 'style'">
            <label class="size-control" title="Opacity">
              <span class="material-icons">opacity</span>
              <input type="range" min="0.1" max="1" step="0.05" [value]="opacity" (input)="setOpacity(+$any($event.target).value)" />
            </label>

            <button class="tool-btn" [class.active]="dashed" (click)="toggleDash()" title="Dashed outline"><span class="material-icons">border_style</span></button>

            <span class="board-divider"></span>

            <label class="size-control" title="Font size">
              <span class="material-icons">format_size</span>
              <input type="range" min="12" max="120" [value]="fontSize" (input)="setFontSize(+$any($event.target).value)" />
            </label>
            <button class="tool-btn" [class.active]="bold" (click)="toggleBold()" title="Bold text"><span class="material-icons">format_bold</span></button>

            <span class="board-divider"></span>

            <button class="tool-btn" (click)="duplicateSelected()" title="Duplicate"><span class="material-icons">content_copy</span></button>
            <button class="tool-btn" (click)="deleteSelected()" title="Delete"><span class="material-icons">delete</span></button>
            <button class="tool-btn" (click)="bringForward()" title="Bring forward"><span class="material-icons">layers</span></button>
            <button class="tool-btn" (click)="sendBackwards()" title="Send backward"><span class="material-icons">layers_clear</span></button>
          </ng-container>

          <ng-container *ngIf="activeGroup === 'slides'">
            <button class="tool-btn" (click)="prevSlide()" title="Previous slide"><span class="material-icons">chevron_left</span></button>
            <span class="slide-count">{{ activeSlide + 1 }} / {{ slides.length }}</span>
            <button class="tool-btn" (click)="nextSlide()" title="Next slide"><span class="material-icons">chevron_right</span></button>
            <button class="tool-btn" (click)="addSlide()" title="New slide"><span class="material-icons">note_add</span></button>
            <button class="tool-btn" (click)="duplicateSlide()" title="Duplicate slide"><span class="material-icons">content_copy</span></button>
            <button class="tool-btn danger" (click)="deleteSlide()" title="Delete slide"><span class="material-icons">delete</span></button>
          </ng-container>

          <ng-container *ngIf="activeGroup === 'board'">
            <button class="tool-btn" (click)="zoomOut()" title="Zoom out"><span class="material-icons">zoom_out</span></button>
            <button class="tool-btn" (click)="zoomFit()" title="Zoom to fit"><span class="material-icons">fit_screen</span></button>
            <button class="tool-btn" (click)="zoomIn()" title="Zoom in"><span class="material-icons">zoom_in</span></button>
            <span class="zoom-pct">{{ zoom | number: '1.0-1' }}%</span>

            <span class="board-divider"></span>

            <button class="tool-btn" (click)="undo()" title="Undo"><span class="material-icons">undo</span></button>
            <button class="tool-btn" (click)="redo()" title="Redo"><span class="material-icons">redo</span></button>
            <button class="tool-btn" (click)="exportPng()" title="Export image"><span class="material-icons">download</span></button>
            <button class="tool-btn danger" (click)="clearBoard()" title="Clear board"><span class="material-icons">delete_sweep</span></button>
          </ng-container>
        </div>
      </div>

      <div class="board-canvas-wrap" #wrap>
        <div class="board-empty-hint" *ngIf="isEmpty">
          <span class="material-icons">draw</span>
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

    .tool-btn .material-icons { font-size: var(--font-18); }

    .board-divider { width: 1px; height: 22px; background: var(--border); margin: 0 4px; }

    .zoom-pct { font-size: var(--font-13); color: var(--text-secondary); min-width: 38px; text-align: center; }

    .slide-count { font-size: var(--font-13); color: var(--text-secondary); min-width: 44px; text-align: center; font-variant-numeric: tabular-nums; display: inline-flex; align-items: center; justify-content: center; }

    .sync-indicator { display: inline-flex; align-items: center; margin-left: auto; color: var(--primary); font-size: var(--font-16); animation: sync-pulse 1.2s ease-in-out infinite; }

    .sync-indicator .material-icons { font-size: var(--font-18); }

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

    .border-row { overflow-x: auto; max-width: 260px; padding-bottom: 2px; }

    .border-row .swatch, .border-row .custom-color { width: 16px; height: 16px; flex: 0 0 auto; }

    .size-control { display: flex; align-items: center; gap: 5px; color: var(--text-secondary); }

    .size-control .material-icons { font-size: var(--font-16); }

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

    .board-empty-hint .material-icons { font-size: 44px; opacity: 0.4; }
  `]
})
export class BoardPanelComponent implements OnInit, OnDestroy {
  @Input() roomId: string = '';

  @ViewChild('wrap') wrapEl!: ElementRef<HTMLDivElement>;
  @ViewChild('canvasEl') canvasEl!: ElementRef<HTMLCanvasElement>;

  private signalR = inject(SignalRService);
  private fb = inject(UiFeedbackService);
  private ngZone = inject(NgZone);

  private canvas!: fabric.Canvas;
  private resizeObs?: ResizeObserver;
  private subs: Subscription[] = [];

  tool: BoardTool = 'select';
  activeGroup: BoardGroup = 'tools';
  shapeDetect = true;
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
    } else if (tool === 'eraser') {
      this.canvas.selection = false;
      this.canvas.skipTargetFind = true;
      this.canvas.discardActiveObject();
      this.canvas.requestRenderAll();
    } else {
      this.canvas.selection = true;
      this.canvas.skipTargetFind = false;
      this.canvas.discardActiveObject();
      this.canvas.requestRenderAll();
    }
  }

  // â”€â”€ Canva-style actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  zoom = 1;
  opacity = 1;
  dashed = false;
  filled = true;
  fillOpacity = 0.18;
  fillColor = PALETTE[1].color;
  borderOn = true;
  borderColor = PALETTE[1].color;
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
    if (/^#[0-9A-Fa-f]{6}$/.test(el.value)) this.setMainColor(el.value);
  }

  setMainColor(v: string): void {
    this.color = v;
    this.fillColor = v;
    this.borderColor = v;
    this.filled = true;
    this.borderOn = true;
    const o = this.canvas.getActiveObject();
    if (o) {
      o.set('fill', this.shapeFill());
      o.set('stroke', this.strokeColor());
      this.canvas.requestRenderAll();
      this.scheduleBroadcast();
    }
  }

  onBorderColorInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    if (/^#[0-9A-Fa-f]{6}$/.test(el.value)) this.setBorderColor(el.value);
  }

  setBorderColor(v: string): void {
    this.borderColor = v;
    this.borderOn = true;
    const o = this.canvas.getActiveObject();
    if (o) {
      o.set('stroke', this.strokeColor());
      this.canvas.requestRenderAll();
      this.scheduleBroadcast();
    }
  }

  onFillColorInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    if (/^#[0-9A-Fa-f]{6}$/.test(el.value)) this.setFillColor(el.value);
  }

  setFillColor(v: string): void {
    this.fillColor = v;
    this.filled = true;
    const o = this.canvas.getActiveObject();
    if (o) {
      o.set('fill', this.rgbaFill(v, this.fillOpacity));
      this.canvas.requestRenderAll();
      this.scheduleBroadcast();
    }
  }

  toggleBorder(): void {
    this.borderOn = !this.borderOn;
    const o = this.canvas.getActiveObject();
    if (o) {
      o.set('stroke', this.strokeColor());
      this.canvas.requestRenderAll();
      this.scheduleBroadcast();
    }
  }

  setFillOpacity(v: number): void {
    this.fillOpacity = v;
    const o = this.canvas.getActiveObject();
    if (o) {
      const f = o.get('fill');
      const col = new fabric.Color(typeof f === 'string' ? f : this.color);
      col.setAlpha(v);
      o.set('fill', col.toRgba());
      this.canvas.requestRenderAll();
      this.scheduleBroadcast();
    }
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
    this.canvas.on('path:created', e => this.onPathCreated(e));
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
          fill: this.shapeFill(),
          stroke: this.strokeColor(),
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
          fill: this.shapeFill(),
          stroke: this.strokeColor(),
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
          fill: this.shapeFill(),
          stroke: this.strokeColor(),
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
          fill: this.shapeFill(),
          stroke: this.strokeColor(),
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
          fill: this.shapeFill(),
          stroke: this.strokeColor(),
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
          fill: this.shapeFill(),
          stroke: this.strokeColor(),
          strokeWidth: this.strokeWidth,
          scaleX: 0.1,
          scaleY: 0.1
        });
        break;
      case 'line':
      case 'arrow':
        this.activeShape = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
          stroke: this.strokeColor(),
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
          fill: this.shapeFill(),
          stroke: this.strokeColor(),
          strokeWidth: this.strokeWidth
        });
        break;
      case 'square':
        this.activeShape = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
          width: 0,
          height: 0,
          fill: this.shapeFill(),
          stroke: this.strokeColor(),
          strokeWidth: this.strokeWidth
        });
        break;
      case 'semicircle':
        this.activeShape = new fabric.Path('M -50,50 L 50,50 A 50,50 0 0 0 -50,50 Z', {
          left: pointer.x,
          top: pointer.y,
          originX: 'center',
          originY: 'center',
          fill: this.shapeFill(),
          stroke: this.strokeColor(),
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
          fill: this.shapeFill(),
          stroke: this.strokeColor(),
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
          fill: this.shapeFill(),
          stroke: this.strokeColor(),
          strokeWidth: this.strokeWidth,
          scaleX: 0.1,
          scaleY: 0.1
        });
        break;
      case 'crescent':
        this.activeShape = new fabric.Path('M 0,-50 A 50,50 0 0 1 0,50 A 34,34 0 0 0 0,-50 Z', {
          left: pointer.x,
          top: pointer.y,
          originX: 'center',
          originY: 'center',
          fill: this.shapeFill(),
          stroke: this.strokeColor(),
          strokeWidth: this.strokeWidth,
          scaleX: 0.1,
          scaleY: 0.1
        });
        break;
      case 'droplet':
        this.activeShape = new fabric.Path('M 0,-50 C 34,2 42,18 36,30 C 30,44 16,50 0,50 C -16,50 -30,44 -36,30 C -42,18 -34,2 0,-50 Z', {
          left: pointer.x,
          top: pointer.y,
          originX: 'center',
          originY: 'center',
          fill: this.shapeFill(),
          stroke: this.strokeColor(),
          strokeWidth: this.strokeWidth,
          scaleX: 0.1,
          scaleY: 0.1
        });
        break;
      case 'cloud':
        this.activeShape = new fabric.Path('M -24,-34 A 13,13 0 0 1 0,-40 A 16,16 0 0 1 26,-30 A 14,14 0 0 1 40,-16 A 12,12 0 0 1 28,10 A 14,14 0 0 1 8,16 A 17,17 0 0 1 -22,10 A 13,13 0 0 1 -40,-6 A 12,12 0 0 1 -24,-34 Z', {
          left: pointer.x,
          top: pointer.y,
          originX: 'center',
          originY: 'center',
          fill: this.shapeFill(),
          stroke: this.strokeColor(),
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
          fill: this.shapeFill(),
          stroke: this.strokeColor(),
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
          fill: this.shapeFill(),
          stroke: this.strokeColor(),
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
          fill: this.shapeFill(),
          stroke: this.strokeColor(),
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
          fill: this.shapeFill(),
          stroke: this.strokeColor(),
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
          fill: this.shapeFill(),
          stroke: this.strokeColor(),
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
          fill: this.shapeFill(),
          stroke: this.strokeColor(),
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
          fill: this.shapeFill(),
          stroke: this.strokeColor(),
          strokeWidth: this.strokeWidth,
          scaleX: 0.1,
          scaleY: 0.1
        });
        break;
      case 'heart':
        this.activeShape = new fabric.Path('M 0,46 C 0,46 -25,21 -35,6 C -45,-9 -45,-29 -32,-37 C -17,-46 -5,-34 0,-21 C 5,-34 17,-46 32,-37 C 45,-29 45,-9 35,6 C 25,21 0,46 0,46 Z', {
          left: pointer.x,
          top: pointer.y,
          originX: 'center',
          originY: 'center',
          fill: this.shapeFill(),
          stroke: this.strokeColor(),
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
          fill: this.shapeFill(),
          stroke: this.strokeColor(),
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
          fill: this.shapeFill(),
          stroke: this.strokeColor(),
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
          fill: this.shapeFill(),
          stroke: this.strokeColor(),
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
          stroke: this.strokeColor(),
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

  private onPathCreated(e: fabric.IEvent): void {
    const path = (e as { path?: fabric.Object }).path;
    if (!path) { this.scheduleBroadcast(); return; }
    if (this.tool !== 'pen' || !this.shapeDetect) { this.scheduleBroadcast(); return; }
    const commands = (path as any).path as Array<Array<string | number>> | undefined;
    if (!commands) { this.scheduleBroadcast(); return; }
    const detected = detectShape(commands);
    if (!detected) { this.scheduleBroadcast(); return; }

    const rect = path.getBoundingRect(true, true);
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const shift = this.pointsShift(detected.points, cx, cy);

    this.suppress = true;
    this.canvas.remove(path);

    const shape = detected.tool === 'line'
      ? this.buildDetectedLine(detected, shift)
      : this.buildDetectedShape(detected.tool, detected.angle, rect.width, rect.height, cx, cy);

    if (shape) {
      this.canvas.add(shape);
      shape.setCoords();
      this.canvas.discardActiveObject();
    }
    this.suppress = false;
    this.canvas.requestRenderAll();
    this.scheduleBroadcast();
  }

  private pointsShift(pts: Pt[], cx: number, cy: number): { x: number; y: number } {
    const b = this.ptsBounds(pts);
    return { x: cx - (b.x + b.w / 2), y: cy - (b.y + b.h / 2) };
  }

  private ptsBounds(pts: { x: number; y: number }[]): { x: number; y: number; w: number; h: number } {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  private unwrapSize(w: number, h: number, angle: number): { w: number; h: number } {
    const rad = (angle * Math.PI) / 180;
    const c = Math.abs(Math.cos(rad));
    const s = Math.abs(Math.sin(rad));
    const denom = c * c - s * s;
    if (Math.abs(denom) < 0.1) {
      const k = w / 1.4142;
      return { w: Math.max(k, 1), h: Math.max(k, 1) };
    }
    const ww = (w * c - h * s) / denom;
    const hh = (h * c - w * s) / denom;
    if (!isFinite(ww) || !isFinite(hh) || ww <= 0 || hh <= 0) return { w, h };
    return { w: Math.max(ww, 1), h: Math.max(hh, 1) };
  }

  private buildDetectedLine(detected: DetectionResult, shift: { x: number; y: number }): fabric.Object | null {
    if (detected.points.length < 2) return null;
    const p0 = detected.points[0];
    const p1 = detected.points[detected.points.length - 1];
    return new fabric.Line(
      [p0.x + shift.x, p0.y + shift.y, p1.x + shift.x, p1.y + shift.y],
      {
        stroke: this.strokeColor(),
        strokeWidth: this.strokeWidth,
        strokeLineCap: 'round'
      }
    );
  }

  private buildDetectedShape(
    tool: DetectedTool,
    angle: number,
    w: number,
    h: number,
    cx: number,
    cy: number
  ): fabric.Object | null {
    const dims = this.unwrapSize(w, h, angle);
    const fill = this.shapeFill();
    const stroke = this.strokeColor();
    const sw = this.strokeWidth;
    const center = { left: cx, top: cy, originX: 'center' as const, originY: 'center' as const };

    if (tool === 'circle') {
      const r = Math.max((dims.w + dims.h) / 4, 1);
      return new fabric.Ellipse({ ...center, rx: r, ry: r, fill, stroke, strokeWidth: sw });
    }
    if (tool === 'ellipse') {
      return new fabric.Ellipse({
        ...center,
        rx: Math.max(dims.w / 2, 1),
        ry: Math.max(dims.h / 2, 1),
        angle,
        fill,
        stroke,
        strokeWidth: sw
      });
    }
    if (tool === 'rect') {
      return new fabric.Rect({
        ...center,
        width: Math.max(dims.w, 1),
        height: Math.max(dims.h, 1),
        angle,
        fill,
        stroke,
        strokeWidth: sw
      });
    }
    if (tool === 'square') {
      const size = Math.max((dims.w + dims.h) / 2, 1);
      return new fabric.Rect({ ...center, width: size, height: size, fill, stroke, strokeWidth: sw });
    }
    if (SHAPE_POLY[tool]) {
      const base = SHAPE_POLY[tool].map(p => ({ x: p[0], y: p[1] }));
      const bb = this.ptsBounds(base);
      return new fabric.Polygon(base, {
        ...center,
        scaleX: bb.w ? dims.w / bb.w : 1,
        scaleY: bb.h ? dims.h / bb.h : 1,
        angle,
        fill,
        stroke,
        strokeWidth: sw
      });
    }
    if (SHAPE_PATH[tool]) {
      const path = new fabric.Path(SHAPE_PATH[tool], {
        ...center,
        fill,
        stroke,
        strokeWidth: sw,
        angle
      });
      const bb = path.getBoundingRect();
      path.set({
        scaleX: bb.width ? dims.w / bb.width : 1,
        scaleY: bb.height ? dims.h / bb.height : 1
      });
      return path;
    }
    return null;
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
      const box = o.getBoundingRect(true, true);
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
    const r = o.getBoundingRect(true, true);
    if (p.x < r.left - radius || p.x > r.left + r.width + radius) return false;
    if (p.y < r.top - radius || p.y > r.top + r.height + radius) return false;
    try {
      if (o.containsPoint(p as any, undefined, true)) return true;
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
    } else if (this.activeShape instanceof fabric.Polygon || this.activeShape instanceof fabric.Path) {
      const size = Math.max(Math.abs(dx), Math.abs(dy)) / 100;
      (this.activeShape as fabric.Object).set({
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

  private shapeFill(): string {
    return this.filled ? this.rgbaFill(this.fillColor, this.fillOpacity) : 'rgba(0,0,0,0)';
  }

  private strokeColor(): string {
    return this.borderOn ? this.borderColor : 'rgba(0,0,0,0)';
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