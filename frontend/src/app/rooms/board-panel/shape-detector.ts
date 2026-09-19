import { fabric } from 'fabric';

export interface Pt {
  x: number;
  y: number;
}

export type DetectedTool =
  | 'circle'
  | 'ellipse'
  | 'rect'
  | 'square'
  | 'triangle'
  | 'diamond'
  | 'hexagon'
  | 'star'
  | 'pentagon'
  | 'octagon'
  | 'trapezoid'
  | 'cross'
  | 'chevron'
  | 'doubleArrow'
  | 'sparkle'
  | 'star6'
  | 'tag'
  | 'shield'
  | 'bolt'
  | 'plus'
  | 'semicircle'
  | 'crescent'
  | 'droplet'
  | 'cloud'
  | 'heart'
  | 'line';

export interface DetectionResult {
  tool: DetectedTool;
  angle: number;
  points: Pt[];
}

export const SHAPE_POLY: Record<string, [number, number][]> = {
  triangle: [[0, -50], [-58, 50], [58, 50]],
  diamond: [[0, -50], [42, 0], [0, 50], [-42, 0]],
  hexagon: [[0, -50], [43, -25], [43, 25], [0, 50], [-43, 25], [-43, -25]],
  star: [[0, -52], [12, -18], [48, -18], [18, 4], [30, 38], [0, 18], [-30, 38], [-18, 4], [-48, -18], [-12, -18]],
  pentagon: [[0, -50], [48, -15], [30, 40], [-30, 40], [-48, -15]],
  octagon: [[0, -50], [35, -35], [50, 0], [35, 35], [0, 50], [-35, 35], [-50, 0], [-35, -35]],
  trapezoid: [[-30, -50], [30, -50], [50, 50], [-50, 50]],
  cross: [[-14, -50], [14, -50], [14, -14], [50, -14], [50, 14], [14, 14], [14, 50], [-14, 50], [-14, 14], [-50, 14], [-50, -14], [-14, -14]],
  chevron: [[-50, -50], [26, 0], [-50, 50], [-24, 50], [50, 0], [-24, -50]],
  doubleArrow: [[-16, -50], [-50, 0], [-16, 50], [16, 50], [50, 0], [16, -50]],
  sparkle: [[0, -50], [12, -12], [50, 0], [12, 12], [0, 50], [-12, 12], [-50, 0], [-12, -12]],
  star6: [[0, -50], [10, -18], [39, -31], [16, 0], [39, 31], [10, 18], [0, 50], [-10, 18], [-39, 31], [-16, 0], [-39, -31], [-10, -18]],
  tag: [[-50, -35], [34, -35], [50, -12], [50, 12], [34, 35], [-50, 35]],
  shield: [[0, -52], [42, -44], [42, 4], [0, 50], [-42, 4], [-42, -44]],
  bolt: [[10, -50], [-36, 4], [-6, 4], [-10, 50], [36, -8], [8, -8]],
  plus: [[-16, -50], [16, -50], [16, -16], [50, -16], [50, 16], [16, 16], [16, 50], [-16, 50], [-16, 16], [-50, 16], [-50, -16], [-16, -16]]
};

export const SHAPE_PATH: Record<string, string> = {
  semicircle: 'M -50,50 L 50,50 A 50,50 0 0 0 -50,50 Z',
  crescent: 'M 0,-50 A 50,50 0 0 1 0,50 A 34,34 0 0 0 0,-50 Z',
  droplet: 'M 0,-50 C 34,2 42,18 36,30 C 30,44 16,50 0,50 C -16,50 -30,44 -36,30 C -42,18 -34,2 0,-50 Z',
  cloud: 'M -24,-34 A 13,13 0 0 1 0,-40 A 16,16 0 0 1 26,-30 A 14,14 0 0 1 40,-16 A 12,12 0 0 1 28,10 A 14,14 0 0 1 8,16 A 17,17 0 0 1 -22,10 A 13,13 0 0 1 -40,-6 A 12,12 0 0 1 -24,-34 Z',
  heart: 'M 0,46 C 0,46 -25,21 -35,6 C -45,-9 -45,-29 -32,-37 C -17,-46 -5,-34 0,-21 C 5,-34 17,-46 32,-37 C 45,-29 45,-9 35,6 C 25,21 0,46 0,46 Z'
};

const STROKE_N = 40;
const TEMPLATE_N = 48;
const GOOD_ERROR = 0.08;
const MARGIN = 1.3;
const MIN_DIAG = 20;
const CLOSE_FACTOR = 0.25;
const LINE_RESIDUAL = 0.04;

type Cmd = Array<string | number>;

function dist(a: Pt, b: Pt): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function addPt(pts: Pt[], p: Pt): void {
  const last = pts[pts.length - 1];
  if (!last || Math.abs(last.x - p.x) > 1e-9 || Math.abs(last.y - p.y) > 1e-9) {
    pts.push({ x: p.x, y: p.y });
  }
}

function lerp(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function extractPoints(commands: Cmd[]): Pt[] {
  const pts: Pt[] = [];
  let cur: Pt = { x: 0, y: 0 };
  let start: Pt = { x: 0, y: 0 };
  for (const cmd of commands) {
    const letter = String(cmd[0]);
    if (letter === 'M') {
      cur = { x: Number(cmd[1]), y: Number(cmd[2]) };
      start = cur;
      addPt(pts, cur);
    } else if (letter === 'L') {
      cur = { x: Number(cmd[1]), y: Number(cmd[2]) };
      addPt(pts, cur);
    } else if (letter === 'Q') {
      const c = { x: Number(cmd[1]), y: Number(cmd[2]) };
      const e = { x: Number(cmd[3]), y: Number(cmd[4]) };
      const segs = 8;
      for (let i = 1; i <= segs; i++) {
        const t = i / segs;
        const mt = 1 - t;
        addPt(pts, {
          x: mt * mt * cur.x + 2 * mt * t * c.x + t * t * e.x,
          y: mt * mt * cur.y + 2 * mt * t * c.y + t * t * e.y
        });
      }
      cur = e;
    } else if (letter === 'C') {
      const c1 = { x: Number(cmd[1]), y: Number(cmd[2]) };
      const c2 = { x: Number(cmd[3]), y: Number(cmd[4]) };
      const e = { x: Number(cmd[5]), y: Number(cmd[6]) };
      const segs = 10;
      for (let i = 1; i <= segs; i++) {
        const t = i / segs;
        const mt = 1 - t;
        addPt(pts, {
          x: mt * mt * mt * cur.x + 3 * mt * mt * t * c1.x + 3 * mt * t * t * c2.x + t * t * t * e.x,
          y: mt * mt * mt * cur.y + 3 * mt * mt * t * c1.y + 3 * mt * t * t * c2.y + t * t * t * e.y
        });
      }
      cur = e;
    } else if (letter === 'Z' || letter === 'z') {
      addPt(pts, start);
      cur = start;
    }
  }
  return pts;
}

function cumulativeLengths(pts: Pt[], closed: boolean): number[] {
  const lens: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    lens.push(lens[i - 1] + dist(pts[i - 1], pts[i]));
  }
  if (closed && pts.length > 2) {
    lens.push(lens[lens.length - 1] + dist(pts[pts.length - 1], pts[0]));
  }
  return lens;
}

export function resample(pts: Pt[], n: number, closed: boolean): Pt[] {
  if (pts.length < 2) return pts.slice();
  const lens = cumulativeLengths(pts, closed);
  const total = lens[lens.length - 1];
  if (total <= 0) return pts.slice();
  const out: Pt[] = [];
  let startLen = 0;
  let segStart = 0;
  for (let k = 0; k < n; k++) {
    const target = (k / n) * total;
    while (segStart < lens.length - 1 && lens[segStart + 1] < target) {
      segStart++;
      startLen = lens[segStart];
    }
    if (segStart >= lens.length - 1) break;
    const segLen = lens[segStart + 1] - startLen;
    const t = segLen > 0 ? (target - startLen) / segLen : 0;
    const a = pts[Math.min(segStart, pts.length - 1)];
    const b = pts[Math.min(segStart + 1, pts.length - 1)];
    if (closed && segStart === pts.length - 1) {
      out.push(lerp(a, pts[0], t));
    } else {
      out.push(lerp(a, b, t));
    }
  }
  if (closed && out.length) out.push(out[0]);
  return out;
}

function normalize(pts: Pt[]): { points: Pt[]; scale: number } {
  let cx = 0;
  let cy = 0;
  for (const p of pts) { cx += p.x; cy += p.y; }
  cx /= pts.length;
  cy /= pts.length;
  let maxR = 0;
  for (const p of pts) {
    const r = Math.hypot(p.x - cx, p.y - cy);
    if (r > maxR) maxR = r;
  }
  if (maxR <= 0) return { points: [], scale: 0 };
  const scale = 1 / maxR;
  return {
    points: pts.map(p => ({ x: (p.x - cx) * scale, y: (p.y - cy) * scale })),
    scale
  };
}

function rotate(p: Pt, rad: number): Pt {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

function errorBidir(a: Pt[], b: Pt[]): number {
  let s = 0;
  for (const p of a) {
    let m = Infinity;
    for (const q of b) {
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      const d = dx * dx + dy * dy;
      if (d < m) m = d;
    }
    s += m;
  }
  let t = 0;
  for (const q of b) {
    let m = Infinity;
    for (const p of a) {
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const d = dx * dx + dy * dy;
      if (d < m) m = d;
    }
    t += m;
  }
  return Math.sqrt((s + t) / (a.length + b.length));
}

function bestRotation(strokeN: Pt[], tmplN: Pt[]): { err: number; angle: number } {
  let best = { err: Infinity, angle: 0 };
  for (let deg = -180; deg < 180; deg += 15) {
    const rad = (deg * Math.PI) / 180;
    const err = errorBidir(strokeN.map(p => rotate(p, rad)), tmplN);
    if (err < best.err) best = { err, angle: deg };
  }
  for (let deg = best.angle - 15; deg <= best.angle + 15; deg += 3) {
    const rad = (deg * Math.PI) / 180;
    const err = errorBidir(strokeN.map(p => rotate(p, rad)), tmplN);
    if (err < best.err) best = { err, angle: deg };
  }
  return best;
}

function boundsOf(pts: Pt[]): { x: number; y: number; w: number; h: number; cx: number; cy: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2
  };
}

function aspectOf(pts: Pt[]): number {
  const b = boundsOf(pts);
  if (!b.w || !b.h) return 1;
  return b.w / b.h;
}

const templateCache = new Map<string, Pt[]>();

function polyTemplate(points: [number, number][]): Pt[] {
  const key = 'p:' + points.map(p => p.join(',')).join('|');
  const cached = templateCache.get(key);
  if (cached) return cached;
  const outline: Pt[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = { x: points[i][0], y: points[i][1] };
    const b = { x: points[(i + 1) % points.length][0], y: points[(i + 1) % points.length][1] };
    for (let k = 0; k <= 24; k++) {
      outline.push(lerp(a, b, k / 24));
    }
  }
  const t = normalize(resample(outline, TEMPLATE_N, true)).points;
  templateCache.set(key, t);
  return t;
}

function pathTemplate(svg: string): Pt[] {
  const cached = templateCache.get('d:' + svg);
  if (cached) return cached;
  const u = fabric.util as any;
  const parsed = u.parsePath(svg) as Cmd[];
  const simpler = u.makePathSimpler(parsed) as Cmd[];
  const t = normalize(resample(extractPoints(simpler), TEMPLATE_N, true)).points;
  templateCache.set('d:' + svg, t);
  return t;
}

function ellipseTemplate(rx: number, ry: number): Pt[] {
  const key = 'e:' + rx.toFixed(3) + ':' + ry.toFixed(3);
  const cached = templateCache.get(key);
  if (cached) return cached;
  const pts: Pt[] = [];
  for (let i = 0; i <= TEMPLATE_N; i++) {
    const a = (i / TEMPLATE_N) * Math.PI * 2;
    pts.push({ x: rx * Math.cos(a), y: ry * Math.sin(a) });
  }
  const t = normalize(resample(pts, TEMPLATE_N, true)).points;
  templateCache.set(key, t);
  return t;
}

function rectTemplate(w: number, h: number): Pt[] {
  const key = 'r:' + w.toFixed(3) + ':' + h.toFixed(3);
  const cached = templateCache.get(key);
  if (cached) return cached;
  const pts: Pt[] = [
    { x: -w / 2, y: -h / 2 },
    { x: w / 2, y: -h / 2 },
    { x: w / 2, y: h / 2 },
    { x: -w / 2, y: h / 2 }
  ];
  const t = normalize(resample(pts, TEMPLATE_N, true)).points;
  templateCache.set(key, t);
  return t;
}

function semicircleArcTemplate(): Pt[] {
  const cached = templateCache.get('arc');
  if (cached) return cached;
  const pts: Pt[] = [];
  for (let i = 0; i <= STROKE_N; i++) {
    const a = (i / STROKE_N) * Math.PI;
    pts.push({ x: Math.cos(a), y: Math.sin(a) });
  }
  const t = normalize(pts).points;
  templateCache.set('arc', t);
  return t;
}

const CLOSED_TOOLS: DetectedTool[] = [
  'triangle', 'diamond', 'hexagon', 'star', 'pentagon', 'octagon',
  'trapezoid', 'cross', 'chevron', 'doubleArrow', 'sparkle', 'star6',
  'tag', 'shield', 'bolt', 'plus',
  'semicircle', 'crescent', 'droplet', 'cloud', 'heart'
];

function candidates(aspect: number): DetectedTool[] {
  const squareish = aspect >= 0.85 && aspect <= 1.18;
  const list: DetectedTool[] = squareish ? ['circle', 'square'] : ['ellipse', 'rect'];
  return list.concat(CLOSED_TOOLS);
}

function templateFor(tool: DetectedTool, aspect: number): Pt[] {
  switch (tool) {
    case 'circle':
      return ellipseTemplate(1, 1);
    case 'ellipse': {
      const a = Math.min(Math.max(aspect, 0.3), 3.3);
      return ellipseTemplate(a, 1);
    }
    case 'rect': {
      const a = Math.min(Math.max(aspect, 0.3), 3.3);
      return rectTemplate(a, 1);
    }
    case 'square':
      return rectTemplate(1, 1);
    case 'semicircle':
    case 'crescent':
    case 'droplet':
    case 'cloud':
    case 'heart':
      return pathTemplate(SHAPE_PATH[tool]);
    default: {
      const poly = SHAPE_POLY[tool];
      return poly ? polyTemplate(poly) : ellipseTemplate(1, 1);
    }
  }
}

function aspectPrune(tool: DetectedTool, strokeAspect: number): boolean {
  let tAspect = 1;
  if (SHAPE_POLY[tool]) {
    const b = boundsOf(SHAPE_POLY[tool].map(p => ({ x: p[0], y: p[1] })));
    if (b.w && b.h) tAspect = b.w / b.h;
  } else if (tool === 'crescent' || tool === 'droplet') {
    tAspect = 0.84;
  } else if (tool === 'tag') {
    tAspect = 1.43;
  } else if (tool === 'cross' || tool === 'plus' || tool === 'star' || tool === 'star6' || tool === 'cloud') {
    tAspect = 1;
  } else if (tool === 'semicircle') {
    tAspect = 1;
  } else if (tool === 'heart') {
    tAspect = 1;
  }
  if (tAspect <= 0 || strokeAspect <= 0) return false;
  const r = strokeAspect / tAspect;
  return r > 2.5 || r < 0.4;
}

function cornerHits(pts: Pt[], b: ReturnType<typeof boundsOf>): number {
  const tol = 0.22 * Math.min(b.w, b.h);
  const corners = [
    { x: b.x, y: b.y },
    { x: b.x + b.w, y: b.y },
    { x: b.x + b.w, y: b.y + b.h },
    { x: b.x, y: b.y + b.h }
  ];
  let hits = 0;
  for (const c of corners) {
    for (const p of pts) {
      if (dist(p, c) <= tol) { hits++; break; }
    }
  }
  return hits;
}

function detectLine(pts: Pt[]): { angle: number } | null {
  const b = boundsOf(pts);
  let mx = 0, my = 0;
  for (const p of pts) { mx += p.x; my += p.y; }
  mx /= pts.length;
  my /= pts.length;
  let sxx = 0, sxy = 0, syy = 0;
  for (const p of pts) {
    sxx += (p.x - mx) * (p.x - mx);
    sxy += (p.x - mx) * (p.y - my);
    syy += (p.y - my) * (p.y - my);
  }
  const len = Math.hypot(b.w, b.h);
  if (len < MIN_DIAG) return null;
  let res = 0;
  if (Math.abs(sxx) < 1e-9) {
    for (const p of pts) res += (p.x - mx) * (p.x - mx);
    res = Math.sqrt(res / pts.length) / len;
  } else {
    const slope = sxy / sxx;
    for (const p of pts) {
      const e = p.y - (my + slope * (p.x - mx));
      res += e * e;
    }
    res = Math.sqrt(res / pts.length) / len;
  }
  if (res > LINE_RESIDUAL) return null;
  const angle = (Math.atan2(sxy, sxx) * 180) / Math.PI;
  return { angle };
}

export function detectShape(commands: Cmd[]): DetectionResult | null {
  const raw = extractPoints(commands);
  if (raw.length < 8) return null;
  const b = boundsOf(raw);
  const diag = Math.hypot(b.w, b.h);
  if (diag < MIN_DIAG) return null;

  const closed = dist(raw[0], raw[raw.length - 1]) <= CLOSE_FACTOR * diag;

  if (!closed) {
    const line = detectLine(raw);
    if (line) return { tool: 'line', angle: line.angle, points: raw };
    const arc = bestRotation(normalize(raw).points, semicircleArcTemplate());
    if (arc.err <= GOOD_ERROR) return { tool: 'semicircle', angle: arc.angle, points: raw };
    return null;
  }

  const strokeN = normalize(resample(raw, STROKE_N, true)).points;
  if (!strokeN.length) return null;
  const aspect = aspectOf(raw);

  let best: { tool: DetectedTool; err: number; angle: number } | null = null;
  let second = Infinity;

  for (const tool of candidates(aspect)) {
    if (aspectPrune(tool, aspect)) continue;
    const tmpl = templateFor(tool, aspect);
    if (!tmpl.length) continue;
    const { err, angle } = bestRotation(strokeN, tmpl);
    if (best && err > best.err) {
      if (err < second) second = err;
      continue;
    }
    if (best) second = best.err;
    best = { tool, err, angle };
  }

  if (!best) return null;
  if (best.tool === 'square' || best.tool === 'diamond') {
    if (cornerHits(raw, b) >= 3) best.tool = 'square';
  }
  if (best.err > GOOD_ERROR || second < best.err * MARGIN) return null;
  return { tool: best!.tool, angle: best.angle, points: raw };
}