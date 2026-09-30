// Outlet photos drawn as halftone dots, the same idea as the portrait on ewolution.cloud.
//
// The photo is sampled once per layout into a grid of brightness + colour; every frame after that
// is just arcs. Frames are only drawn while something moves (a morph to another outlet, the
// pointer lens), so an idle hero costs nothing. The dots are the theme's ink; under the pointer
// they swell and take on the photo's real colour.

type Cell = { lum: number; r: number; g: number; b: number };

export type Tint = { h: number; c: number };

type Options = {
  /** Called with the photo's dominant hue once it's sampled, for the page's ambient glow. */
  onTint?: (tint: Tint | null) => void;
};

const MORPH_MS = 900;
const LENS_RADIUS = 72;

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const smooth = (t: number) => t * t * (3 - 2 * t);

type Source = ImageBitmap | HTMLImageElement;

const size = (source: Source) =>
  source instanceof HTMLImageElement ? { w: source.naturalWidth, h: source.naturalHeight } : { w: source.width, h: source.height };

const images = new Map<string, Promise<Source>>();

/**
 * Decoded and scaled down off the main thread (the Kiosk photo is 3072 × 4096), then kept at
 * 720 px: plenty for a grid of dots, and cheap to resample when the layout changes.
 */
function loadImage(src: string): Promise<Source> {
  let pending = images.get(src);
  if (!pending) {
    pending = (async (): Promise<Source> => {
      try {
        const blob = await (await fetch(src)).blob();
        return await createImageBitmap(blob, { resizeWidth: 720, resizeQuality: 'high' });
      } catch {
        // Older engines without createImageBitmap options: decode an <img> (still off-thread).
        const img = new Image();
        img.src = src;
        await img.decode();
        return img;
      }
    })();
    pending.catch(() => images.delete(src));
    images.set(src, pending);
  }
  return pending;
}

/** Average hue of the photo's colourful pixels (neutral greys don't vote). */
function dominantTint(cells: Cell[]): Tint | null {
  let x = 0;
  let y = 0;
  let weight = 0;
  for (const { r, g, b } of cells) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    if (sat < 0.18 || max < 40) continue;
    let h = 0;
    if (max === r) h = ((g - b) / (max - min)) % 6;
    else if (max === g) h = (b - r) / (max - min) + 2;
    else h = (r - g) / (max - min) + 4;
    const angle = (h * 60 * Math.PI) / 180;
    const w = sat * sat;
    x += Math.cos(angle) * w;
    y += Math.sin(angle) * w;
    weight += w;
  }
  if (weight < cells.length * 0.01) return null;
  // sRGB hue → roughly the oklch hue (they differ by ~20–30° around red/orange).
  const hsl = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const strength = Math.hypot(x, y) / weight;
  return { h: (hsl + 25) % 360, c: clamp(0.03 + strength * 0.06, 0.03, 0.07) };
}

export class Halftone {
  private ctx: CanvasRenderingContext2D;
  private cols = 0;
  private rows = 0;
  private cell = 8;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private from: Float32Array = new Float32Array();
  private to: Float32Array = new Float32Array();
  private colors: Cell[] = [];
  private morphStart = 0;
  private src: string | null = null;
  private img: Source | null = null;
  private frame = 0;
  private pointer: { x: number; y: number } | null = null;
  private lens = 0;
  private lensTarget = 0;
  private ink = '#fff';
  private dark = true;
  private reduced = false;
  private resizeObserver: ResizeObserver;
  private destroyed = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private options: Options = {},
  ) {
    this.ctx = canvas.getContext('2d', { alpha: true })!;
    this.readTheme();
    this.resizeObserver = new ResizeObserver(() => this.layout());
    this.resizeObserver.observe(canvas);
    canvas.addEventListener('pointermove', this.onPointer);
    canvas.addEventListener('pointerleave', this.onLeave);
    canvas.addEventListener('pointerdown', this.onPointer);
  }

  /** Re-reads the ink colour after a theme switch. */
  readTheme() {
    const style = getComputedStyle(this.canvas);
    this.ink = style.getPropertyValue('--dot').trim() || '#fff';
    // color-scheme is inherited from :root, which the theme tokens set to exactly "dark" or "light".
    this.dark = style.colorScheme !== 'light';
    if (this.img) this.sample(this.img, false);
    this.draw();
  }

  setReducedMotion(reduced: boolean) {
    this.reduced = reduced;
  }

  async show(src: string | null) {
    this.src = src;
    if (!src) {
      this.img = null;
      this.options.onTint?.(null);
      this.retarget(this.rest());
      return;
    }
    // A photo that isn't cached yet: settle into the empty plate meanwhile, so the switch
    // still answers at once.
    const waiting = setTimeout(() => this.src === src && this.retarget(this.rest()), 140);
    try {
      const img = await loadImage(src);
      if (this.destroyed || this.src !== src) return;
      this.img = img;
      this.sample(img, true);
    } catch {
      if (this.src === src) this.retarget(this.rest());
    } finally {
      clearTimeout(waiting);
    }
  }

  /** No photo: small dots, a little larger towards the middle, like an empty plate. */
  private rest(): Float32Array {
    const out = new Float32Array(this.cols * this.rows);
    for (let i = 0; i < out.length; i++) {
      const x = (i % this.cols) / this.cols - 0.5;
      const y = Math.floor(i / this.cols) / this.rows - 0.45;
      out[i] = 0.03 + 0.1 * Math.max(0, 1 - Math.hypot(x, y) * 2.2);
    }
    return out;
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('pointermove', this.onPointer);
    this.canvas.removeEventListener('pointerleave', this.onLeave);
    this.canvas.removeEventListener('pointerdown', this.onPointer);
  }

  private layout() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    this.cell = rect.width < 520 ? 6.5 : 7.5;
    const cols = Math.ceil(rect.width / this.cell) + 1;
    const rows = Math.ceil(rect.height / this.cell) + 1;
    if (cols !== this.cols || rows !== this.rows) {
      this.cols = cols;
      this.rows = rows;
      this.from = new Float32Array(cols * rows);
      this.to = new Float32Array(cols * rows);
      if (this.img) this.sample(this.img, false);
    }
    this.draw();
  }

  /** Photo → per-cell brightness, cropped like object-fit: cover, contrast-stretched. */
  private sample(img: Source, animate: boolean) {
    const { cols, rows } = this;
    if (!cols || !rows) return;
    // Down in two steps so the photo doesn't alias into noise.
    const mid = document.createElement('canvas');
    mid.width = cols * 4;
    mid.height = rows * 4;
    const m = mid.getContext('2d')!;
    const { w, h } = size(img);
    const scale = Math.max(mid.width / w, mid.height / h);
    const sw = mid.width / scale;
    const sh = mid.height / scale;
    m.imageSmoothingQuality = 'high';
    m.drawImage(img, (w - sw) / 2, (h - sh) * 0.45, sw, sh, 0, 0, mid.width, mid.height);
    const small = document.createElement('canvas');
    small.width = cols;
    small.height = rows;
    const s = small.getContext('2d', { willReadFrequently: true })!;
    s.imageSmoothingQuality = 'high';
    s.drawImage(mid, 0, 0, cols, rows);
    const data = s.getImageData(0, 0, cols, rows).data;

    const cells: Cell[] = new Array(cols * rows);
    const lums = new Float32Array(cols * rows);
    for (let i = 0; i < cols * rows; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      cells[i] = { lum, r, g, b };
      lums[i] = lum;
    }
    const sorted = Float32Array.from(lums).sort();
    const lo = sorted[Math.floor(sorted.length * 0.03)];
    const hi = sorted[Math.floor(sorted.length * 0.97)];
    const span = Math.max(0.05, hi - lo);

    const target = new Float32Array(cols * rows);
    for (let i = 0; i < target.length; i++) {
      const v = clamp((lums[i] - lo) / span);
      // Dark theme: light dots where the photo is bright. Paper: ink where it's dark. Highlights
      // are pulled down so a sky doesn't turn into a slab of white.
      target[i] = this.dark ? 0.05 + 0.78 * Math.pow(v, 1.55) : 0.04 + 0.86 * Math.pow(1 - v, 1.25);
    }
    this.colors = cells;
    this.options.onTint?.(dominantTint(cells));
    if (animate) this.retarget(target);
    else {
      this.from = target;
      this.to = target;
      this.morphStart = 0;
      this.draw();
    }
  }

  private retarget(target: Float32Array) {
    if (target.length !== this.to.length) {
      this.from = target;
      this.to = target;
      this.draw();
      return;
    }
    // Start from wherever the dots are now, so a quick second switch doesn't jump.
    this.from = this.current(performance.now());
    this.to = target;
    this.morphStart = this.reduced ? 0 : performance.now();
    this.loop();
  }

  /** Dot values at time `now`, mid-morph included. */
  private current(now: number): Float32Array {
    if (!this.morphStart) return this.to;
    const out = new Float32Array(this.to.length);
    for (let i = 0; i < out.length; i++) out[i] = this.valueAt(i, now);
    return out;
  }

  private valueAt(i: number, now: number): number {
    if (!this.morphStart) return this.to[i];
    // A ripple from the lower left: each dot starts a little later the further away it is.
    const x = i % this.cols;
    const y = Math.floor(i / this.cols);
    const d = Math.hypot(x / this.cols, (this.rows - y) / this.rows) / Math.SQRT2;
    const t = clamp((now - this.morphStart - d * MORPH_MS * 0.55) / (MORPH_MS * 0.45));
    return this.from[i] + (this.to[i] - this.from[i]) * smooth(t);
  }

  private onPointer = (event: PointerEvent) => {
    if (this.reduced || event.pointerType === 'touch') return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    this.lensTarget = 1;
    this.loop();
  };

  private onLeave = () => {
    this.lensTarget = 0;
    this.loop();
  };

  private loop() {
    if (this.frame) return;
    const step = () => {
      this.frame = 0;
      const now = performance.now();
      this.lens += (this.lensTarget - this.lens) * 0.14;
      if (Math.abs(this.lensTarget - this.lens) < 0.01) this.lens = this.lensTarget;
      const morphing = this.morphStart && now - this.morphStart < MORPH_MS * 1.05;
      if (!morphing && this.morphStart) {
        this.from = this.to;
        this.morphStart = 0;
      }
      this.draw(now);
      if (morphing || this.lens !== this.lensTarget) this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }

  private draw(now = performance.now()) {
    const { ctx, cols, rows, cell, dpr } = this;
    if (!cols || !rows) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    const max = cell * 0.56;
    const lens = this.lens > 0.01 && this.pointer ? this.pointer : null;
    const colored: [number, number, number, string][] = [];

    ctx.fillStyle = this.ink;
    ctx.beginPath();
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        let v = this.valueAt(i, now);
        const cx = x * cell + (y % 2 ? cell / 2 : 0);
        const cy = y * cell;
        let lensed = 0;
        if (lens) {
          const d = Math.hypot(cx - lens.x, cy - lens.y);
          if (d < LENS_RADIUS) {
            lensed = smooth(1 - d / LENS_RADIUS) * this.lens;
            v = Math.min(1, v + lensed * 0.35);
          }
        }
        const r = max * Math.sqrt(v);
        if (r < 0.35) continue;
        if (lensed > 0.05 && this.colors[i]) {
          const { r: cr, g, b } = this.colors[i];
          colored.push([cx, cy, r * (1 + lensed * 0.3), `rgb(${cr} ${g} ${b} / ${0.35 + lensed * 0.65})`]);
          continue;
        }
        ctx.moveTo(cx + r, cy);
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
      }
    }
    ctx.fill();
    for (const [cx, cy, r, color] of colored) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
