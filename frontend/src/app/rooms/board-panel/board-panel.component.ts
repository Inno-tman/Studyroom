import {
  Component,
  ElementRef,
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

type BoardTool = 'select' | 'pen' | 'rect' | 'circle' | 'line' | 'arrow' | 'text';

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
          [class.active]="tool === 'text'"
          (click)="setTool('text')"
          title="Add text"
        ><span class="material-icons">text_fields</span></button>

        <button
          class="tool-btn"
          [class.active]="tool === 'rect'"
          (click)="setTool('rect')"
          title="Rectangle"
        ><span class="material-icons">rectangle_outlined</span></button>

        <button
          class="tool-btn"
          [class.active]="tool === 'circle'"
          (click)="setTool('circle')"
          title="Circle"
        ><span class="material-icons">circle_outlined</span></button>

        <button
          class="tool-btn"
          [class.active]="tool === 'line'"
          (click)="setTool('line')"
          title="Line"
        ><span class="material-icons">straighten</span></button>

        <button
          class="tool-btn"
          [class.active]="tool === 'arrow'"
          (click)="setTool('arrow')"
          title="Arrow"
        ><span class="material-icons">arrow_forward</span></button>

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
          <span class="material-icons">line_weight</span>
          <input
            type="range"
            min="1"
            max="20"
            [value]="strokeWidth"
            (input)="strokeWidth = +($any($event.target).value)"
          />
        </label>

        <span class="board-divider"></span>

        <button class="tool-btn" (click)="undo()" title="Undo"><span class="material-icons">undo</span></button>
        <button class="tool-btn" (click)="redo()" title="Redo"><span class="material-icons">redo</span></button>
        <button class="tool-btn" (click)="exportPng()" title="Export image"><span class="material-icons">download</span></button>
        <button class="tool-btn danger" (click)="clearBoard()" title="Clear board"><span class="material-icons">delete_sweep</span></button>
      </div>

      <div class="board-canvas-wrap" #wrap>
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
      align-items: center;
      gap: 6px;
      padding: 8px 10px;
      border-bottom: 1px solid var(--border);
      background: var(--surface);
      flex-wrap: wrap;
    }

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
    }

    .tool-btn:hover { color: var(--text-primary); background: var(--surface-hover); }

    .tool-btn.active { background: var(--primary); border-color: var(--primary); color: white; }

    .tool-btn.danger:hover { color: var(--error); border-color: var(--error); }

    .tool-btn .material-icons { font-size: var(--font-18); }

    .board-divider { width: 1px; height: 22px; background: var(--border); margin: 0 4px; }

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
  color = PALETTE[1].color;
  strokeWidth = 3;
  palette = PALETTE;

  private history: string[] = [];
  private redoStack: string[] = [];
  private suppress = false;
  private debounce: any;
  private startPoint: { x: number; y: number } | null = null;
  private activeShape: fabric.Object | null = null;

  ngOnInit(): void {
    this.subs.push(
      this.signalR.boardChanged$.subscribe(d => {
        if (d.roomId !== this.roomId || !d.json) return;
        this.applyRemote(d.json);
      }),
      this.signalR.boardLoaded$.subscribe(d => {
        if (d.roomId !== this.roomId) return;
        if (d.json) this.applyRemote(d.json);
      }),
      this.signalR.boardCleared$.subscribe(d => {
        if (d.roomId !== this.roomId) return;
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
    this.canvas.on('object:modified', () => this.scheduleBroadcast());
    this.canvas.on('object:removed', () => this.scheduleBroadcast());
    this.canvas.on('path:created', () => this.scheduleBroadcast());
    this.canvas.on('text:changed', () => this.scheduleBroadcast());
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
      case 'line':
      case 'arrow':
        this.activeShape = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
          stroke: c,
          strokeWidth: this.strokeWidth
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

  private onMouseMove(opt: fabric.IEvent): void {
    if (!this.startPoint || !this.activeShape) return;
    const pointer = this.canvas.getPointer(opt.e);
    const sx = this.startPoint.x;
    const sy = this.startPoint.y;
    const dx = pointer.x - sx;
    const dy = pointer.y - sy;

    if (this.activeShape instanceof fabric.Rect) {
      this.activeShape.set({
        left: Math.min(sx, pointer.x),
        top: Math.min(sy, pointer.y),
        width: Math.abs(dx),
        height: Math.abs(dy)
      });
    } else if (this.activeShape instanceof fabric.Ellipse) {
      const rx = Math.abs(dx) / 2;
      this.activeShape.set({ rx, ry: rx, left: (sx + pointer.x) / 2, top: (sy + pointer.y) / 2 });
    } else if (this.activeShape instanceof fabric.Line) {
      this.activeShape.set({ x2: pointer.x, y2: pointer.y });
    }
    this.activeShape.setCoords();
    this.canvas.requestRenderAll();
  }

  private onMouseUp(): void {
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
    void this.signalR.boardChanged(this.roomId, json);
  }

  private applyAndBroadcast(json: string): void {
    this.applyRemote(json);
    void this.signalR.boardChanged(this.roomId, json);
  }

  private applyRemote(json: string): void {
    this.ngZone.runOutsideAngular(() => {
      this.suppress = true;
      this.canvas.loadFromJSON(json, () => {
        this.canvas.requestRenderAll();
        this.suppress = false;
      });
    });
  }
}