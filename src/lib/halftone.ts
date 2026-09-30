// Outlet photos drawn as halftone dots, the same idea as the portrait on ewolution.cloud.
//
// The photo is sampled once per layout into a grid of brightness + colour; every frame after
// that is just arcs, batched by colour. Frames are only drawn while something moves (a morph to
// another outlet, the pointer lens), so an idle hero costs nothing, and nothing redraws on scroll.
//
// Dot size carries the picture (bright areas grow big dots on the dark theme, dark areas on the
// light one); dot colour is the photo's own, muted towards the theme's ink so it reads as print
// rather than as a pixelated photo. The pointer lens is the landing page's: dots near the cursor
// swell and part like under a magnifier.

type Source = ImageBitmap | HTMLImageElement;

export type Tint = { h: number; c: number };

type Options = {
  /** Called with the photo's dominant hue once it's sampled, for the page's ambient glow. */
  onTint?: (tint: Tint | null) => void;
};

const MORPH_MS = 900;
const LENS_R = 78;
/** Target dot pitch in CSS px, the portrait's. */
const CELL = 4.6;
/** How much of each dot's colour is the photo's (the rest is the theme's ink). */
const COLOUR = 0.62;

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const smooth = (t: number) => t * t * (3 - 2 * t);

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

function parseColor(css: string): [number, number, number] {
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.fillStyle = css;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

/** Average hue of the photo's colourful pixels (neutral greys don't vote). */
function dominantTint(rgb: Uint8ClampedArray): Tint | null {
  let x = 0;
  let y = 0;
  let weight = 0;
  const n = rgb.length / 4;
  for (let i = 0; i < n; i++) {
    const r = rgb[i * 4];
    const g = rgb[i * 4 + 1];
    const b = rgb[i * 4 + 2];
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
  if (weight < n * 0.01) return null;
  // sRGB hue → roughly the oklch hue (they differ by ~20–30° around red/orange).
  const hsl = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const strength = Math.hypot(x, y) / weight;
  return { h: (hsl + 25) % 360, c: clamp(0.03 + strength * 0.06, 0.03, 0.07) };
}

/** One sampled picture: a size per cell and a colour per cell (an index into its palette). */
type Field = { value: Float32Array; colour: Uint16Array; palette: string[] };

export class Halftone {
  private ctx: CanvasRenderingContext2D;
  private cols = 0;
  private rows = 0;
  private cell = CELL;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private from: Field | null = null;
  private to: Field | null = null;
  private morphStart = 0;
  private src: string | null = null;
  private img: Source | null = null;
  private frame = 0;
  private last = 0;
  // The lens: raw pointer, eased pointer, eased strength.
  private tx = -1e4;
  private ty = -1e4;
  private mx = -1e4;
  private my = -1e4;
  private lens = 0;
  private lensTarget = 0;
  private ink: [number, number, number] = [240, 240, 244];
  private dark = true;
  private reduced = false;
  private resizeObserver: ResizeObserver;
  private destroyed = false;
  private buckets: number[][] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private options: Options = {},
  ) {
    this.ctx = canvas.getContext('2d', { alpha: true })!;
    this.readTheme(false);
    this.resizeObserver = new ResizeObserver(() => this.layout());
    this.resizeObserver.observe(canvas);
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      canvas.addEventListener('pointermove', this.onPointer);
      canvas.addEventListener('pointerleave', this.onLeave);
    }
  }

  /** Re-reads the ink colour and tone direction after a theme switch. */
  readTheme(resample = true) {
    const style = getComputedStyle(this.canvas);
    this.ink = parseColor(style.getPropertyValue('--dot').trim() || '#f0f0f4');
    // color-scheme is inherited from :root, which the theme tokens set to exactly "dark" or "light".
    this.dark = style.colorScheme !== 'light';
    if (resample && this.img) this.sample(this.img, false);
    else if (resample) this.retarget(this.rest(), false);
  }

  setReducedMotion(reduced: boolean) {
    this.reduced = reduced;
    if (reduced) {
      this.lens = 0;
      this.lensTarget = 0;
    }
  }

  async show(src: string | null) {
    this.src = src;
    if (!src) {
      this.img = null;
      this.options.onTint?.(null);
      this.retarget(this.rest(), true);
      return;
    }
    // A photo that isn't cached yet: settle into the empty plate meanwhile, so the switch
    // still answers at once.
    const waiting = setTimeout(() => this.src === src && this.retarget(this.rest(), true), 140);
    try {
      const img = await loadImage(src);
      if (this.destroyed || this.src !== src) return;
      this.img = img;
      this.sample(img, true);
    } catch {
      if (this.src === src) this.retarget(this.rest(), true);
    } finally {
      clearTimeout(waiting);
    }
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('pointermove', this.onPointer);
    this.canvas.removeEventListener('pointerleave', this.onLeave);
  }

  private layout() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    const cols = Math.ceil(rect.width / CELL) + 1;
    const rows = Math.ceil(rect.height / CELL) + 1;
    this.cell = rect.width / (cols - 1);
    if (cols !== this.cols || rows !== this.rows) {
      this.cols = cols;
      this.rows = rows;
      this.from = this.to = null;
      if (this.img) this.sample(this.img, false);
      else this.retarget(this.rest(), false);
    }
    this.draw(performance.now());
  }

  /** Photo → per-cell size and colour, cropped like object-fit: cover, contrast-stretched. */
  private sample(img: Source, animate: boolean) {
    const { cols, rows } = this;
    if (!cols || !rows) return;
    // Down in two steps so the photo doesn't alias into noise.
    const mid = document.createElement('canvas');
    mid.width = cols * 3;
    mid.height = rows * 3;
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

    const n = cols * rows;
    const lums = new Float32Array(n);
    for (let i = 0; i < n; i++) lums[i] = (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255;
    const sorted = Float32Array.from(lums).sort();
    const lo = sorted[Math.floor(n * 0.02)];
    const hi = sorted[Math.floor(n * 0.98)];
    const span = Math.max(0.05, hi - lo);

    const value = new Float32Array(n);
    const colour = new Uint16Array(n);
    const palette: string[] = [];
    const seen = new Map<number, number>();
    const [ir, ig, ib] = this.ink;
    for (let i = 0; i < n; i++) {
      const v = clamp((lums[i] - lo) / span);
      // Dark theme: light dots where the photo is bright. Paper: ink where it's dark.
      value[i] = this.dark ? 0.03 + 0.85 * Math.pow(v, 1.35) : 0.03 + 0.92 * Math.pow(1 - v, 1.15);

      // The photo's colour, brought to the ink's brightness so it reads against the page, then
      // mixed with the ink. Quantised, so a frame is a few dozen fills rather than thousands.
      let r = data[i * 4];
      let g = data[i * 4 + 1];
      let b = data[i * 4 + 2];
      const max = Math.max(r, g, b, 1);
      const target = this.dark ? 235 : 70;
      const k = target / max;
      r = Math.min(255, r * k);
      g = Math.min(255, g * k);
      b = Math.min(255, b * k);
      r = ir + (r - ir) * COLOUR;
      g = ig + (g - ig) * COLOUR;
      b = ib + (b - ib) * COLOUR;
      const q = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      let index = seen.get(q);
      if (index === undefined) {
        index = palette.length;
        seen.set(q, index);
        palette.push(`rgb(${(r >> 4) * 16 + 8} ${(g >> 4) * 16 + 8} ${(b >> 4) * 16 + 8})`);
      }
      colour[i] = index;
    }
    this.options.onTint?.(dominantTint(data));
    this.retarget({ value, colour, palette }, animate);
  }

  /** No photo: small dots, a little larger towards the middle, like an empty plate. */
  private rest(): Field {
    const n = this.cols * this.rows;
    const value = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i % this.cols) / this.cols - 0.5;
      const y = Math.floor(i / this.cols) / this.rows - 0.45;
      value[i] = 0.02 + 0.08 * Math.max(0, 1 - Math.hypot(x, y) * 2.2);
    }
    const [r, g, b] = this.ink;
    return { value, colour: new Uint16Array(n), palette: [`rgb(${r} ${g} ${b})`] };
  }

  private retarget(field: Field, animate: boolean) {
    if (!this.to || !animate || this.reduced || field.value.length !== this.to.value.length) {
      this.from = field;
      this.to = field;
      this.morphStart = 0;
      this.draw(performance.now());
      return;
    }
    // Start from wherever the dots are now, so a quick second switch doesn't jump.
    this.from = this.snapshot(performance.now());
    this.to = field;
    this.morphStart = performance.now();
    this.schedule();
  }

  /** The field as currently shown, mid-morph included. */
  private snapshot(now: number): Field {
    if (!this.morphStart || !this.from || !this.to) return this.to!;
    const n = this.to.value.length;
    const value = new Float32Array(n);
    const colour = new Uint16Array(n);
    const palette = [...this.from.palette, ...this.to.palette];
    const offset = this.from.palette.length;
    for (let i = 0; i < n; i++) {
      const t = this.progress(i, now);
      value[i] = this.from.value[i] + (this.to.value[i] - this.from.value[i]) * smooth(t);
      colour[i] = t < 0.5 ? this.from.colour[i] : this.to.colour[i] + offset;
    }
    return { value, colour, palette };
  }

  /** 0 → 1 for cell i: a ripple from the lower left, each dot a little later the further out. */
  private progress(i: number, now: number): number {
    if (!this.morphStart) return 1;
    const x = i % this.cols;
    const y = Math.floor(i / this.cols);
    const d = Math.hypot(x / this.cols, (this.rows - y) / this.rows) / Math.SQRT2;
    return clamp((now - this.morphStart - d * MORPH_MS * 0.55) / (MORPH_MS * 0.45));
  }

  private onPointer = (event: PointerEvent) => {
    if (this.reduced) return;
    const rect = this.canvas.getBoundingClientRect();
    this.tx = event.clientX - rect.left;
    this.ty = event.clientY - rect.top;
    if (this.lensTarget === 0) {
      this.mx = this.tx;
      this.my = this.ty;
    }
    this.lensTarget = 1;
    this.schedule();
  };

  private onLeave = () => {
    this.lensTarget = 0;
    this.schedule();
  };

  private schedule() {
    if (!this.frame) this.frame = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    this.frame = 0;
    const dt = Math.min((now - (this.last || now)) / 1000, 0.05);
    this.last = now;
    // Frame-rate independent easing, the portrait's constants.
    this.lens += (this.lensTarget - this.lens) * (1 - Math.pow(0.0005, dt));
    this.mx += (this.tx - this.mx) * (1 - Math.pow(0.00001, dt));
    this.my += (this.ty - this.my) * (1 - Math.pow(0.00001, dt));
    if (Math.abs(this.lensTarget - this.lens) < 0.002) this.lens = this.lensTarget;

    const morphing = this.morphStart > 0 && now - this.morphStart < MORPH_MS * 1.05;
    if (!morphing && this.morphStart) {
      this.from = this.to;
      this.morphStart = 0;
    }
    this.draw(now);
    if (morphing || this.lens !== this.lensTarget || this.lensTarget > 0) this.schedule();
    else this.last = 0;
  };

  private draw(now: number) {
    const { ctx, cols, rows, cell, dpr, from, to } = this;
    if (!cols || !rows || !from || !to) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    const max = cell * 0.62;
    const lensOn = this.lens > 0.001;
    const R2 = LENS_R * LENS_R;
    const offset = from.palette.length;
    const palette = this.morphStart ? [...from.palette, ...to.palette] : to.palette;
    const buckets = this.buckets;
    for (let i = 0; i < palette.length; i++) (buckets[i] ??= []).length = 0;

    // Positions and radii go into per-colour buckets as flat [x, y, r] triples.
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        let v: number;
        let c: number;
        if (this.morphStart) {
          const t = this.progress(i, now);
          v = from.value[i] + (to.value[i] - from.value[i]) * smooth(t);
          c = t < 0.5 ? from.colour[i] : to.colour[i] + offset;
        } else {
          v = to.value[i];
          c = to.colour[i];
        }
        let cx = x * cell + (y % 2 ? cell / 2 : 0);
        let cy = y * cell;
        let r = max * Math.sqrt(v);
        if (lensOn) {
          const dx = cx - this.mx;
          const dy = cy - this.my;
          const d2 = dx * dx + dy * dy;
          if (d2 < R2) {
            const k = (1 - Math.sqrt(d2) / LENS_R) ** 2 * this.lens;
            r *= 1 + 0.85 * k;
            // Magnifier-style: displacement grows with distance from the pointer, so the
            // centre never opens a hole between dots.
            cx += dx * k * 0.35;
            cy += dy * k * 0.35;
          }
        }
        if (r < 0.3) continue;
        buckets[c].push(cx, cy, r);
      }
    }

    for (let c = 0; c < palette.length; c++) {
      const list = buckets[c];
      if (!list.length) continue;
      ctx.fillStyle = palette[c];
      ctx.beginPath();
      for (let j = 0; j < list.length; j += 3) {
        ctx.moveTo(list[j] + list[j + 2], list[j + 1]);
        ctx.arc(list[j], list[j + 1], list[j + 2], 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }
}
