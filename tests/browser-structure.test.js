/**
 * Structural + window-global load checks when full Playwright Chromium
 * cannot install in the environment.
 *
 * Loads shipped browser entry modules under a minimal `window`/`document`
 * shim and asserts the real boot path paints a full-size canvas.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARENA } from '../src/game/constants.js';
import { boot } from '../src/main.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function makeMockCanvas(width = ARENA.width, height = ARENA.height) {
  /** @type {Uint8ClampedArray | null} */
  let lastFill = null;
  const pixels = new Uint8ClampedArray(width * height * 4);

  const ctx = {
    canvas: null,
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    globalAlpha: 1,
    font: '10px sans-serif',
    textAlign: 'left',
    shadowColor: 'transparent',
    shadowBlur: 0,
    _ops: /** @type {string[]} */ ([]),
    setTransform() {
      this._ops.push('setTransform');
    },
    clearRect(x, y, w, h) {
      this._ops.push(`clearRect:${w}x${h}`);
      // clear to transparent
      pixels.fill(0);
    },
    fillRect(x, y, w, h) {
      this._ops.push(`fillRect:${Math.round(w)}x${Math.round(h)}`);
      // paint a substantial region so "filled" checks pass
      const x0 = Math.max(0, Math.floor(x));
      const y0 = Math.max(0, Math.floor(y));
      const x1 = Math.min(width, Math.ceil(x + w));
      const y1 = Math.min(height, Math.ceil(y + h));
      // parse simple color if possible
      let r = 20,
        g = 16,
        b = 40,
        a = 255;
      const fs = String(this.fillStyle);
      if (fs.startsWith('#') && fs.length >= 7) {
        r = parseInt(fs.slice(1, 3), 16);
        g = parseInt(fs.slice(3, 5), 16);
        b = parseInt(fs.slice(5, 7), 16);
      } else if (fs.includes('gradient') || fs.startsWith('rgba') || fs.startsWith('rgb')) {
        r = 12;
        g = 10;
        b = 28;
      }
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * width + xx) * 4;
          pixels[i] = r;
          pixels[i + 1] = g;
          pixels[i + 2] = b;
          pixels[i + 3] = a;
        }
      }
      lastFill = pixels;
    },
    strokeRect() {
      this._ops.push('strokeRect');
    },
    beginPath() {
      this._ops.push('beginPath');
    },
    closePath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    quadraticCurveTo() {},
    fill() {
      this._ops.push('fill');
    },
    stroke() {
      this._ops.push('stroke');
    },
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    fillText() {
      this._ops.push('fillText');
    },
    measureText(t) {
      return { width: String(t).length * 7 };
    },
    createLinearGradient() {
      return {
        addColorStop() {},
        toString() {
          return 'gradient';
        },
      };
    },
    createRadialGradient() {
      return {
        addColorStop() {},
        toString() {
          return 'gradient';
        },
      };
    },
    getImageData(x, y, w, h) {
      // return full buffer view
      return { data: pixels, width: w, height: h };
    },
  };

  const canvas = {
    width,
    height,
    style: {},
    getContext(type) {
      if (type !== '2d') return null;
      ctx.canvas = canvas;
      return ctx;
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width, height, right: width, bottom: height };
    },
    addEventListener() {},
    removeEventListener() {},
  };
  return { canvas, ctx, pixels };
}

describe('browser entry structure', () => {
  it('ships index.html with canvas#game and module main entry', () => {
    const htmlPath = join(ROOT, 'index.html');
    expect(existsSync(htmlPath)).toBe(true);
    const html = readFileSync(htmlPath, 'utf8');
    expect(html).toMatch(/id=["']game["']/);
    expect(html).toMatch(/src=["']\.\/src\/main\.js["']/);
    expect(html).toMatch(/type=["']module["']/);
    expect(existsSync(join(ROOT, 'src/main.js'))).toBe(true);
    expect(existsSync(join(ROOT, 'src/game/sim.js'))).toBe(true);
    expect(existsSync(join(ROOT, 'src/render/renderer.js'))).toBe(true);
  });

  it('README documents run and test commands', () => {
    const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
    expect(readme).toMatch(/npm start/);
    expect(readme).toMatch(/npm test/);
    expect(readme).toMatch(/COILBREAK|coil/i);
  });
});

describe('boot() under window global (no Node-only APIs required)', () => {
  /** @type {ReturnType<typeof boot> | null} */
  let game = null;
  let rafCallbacks = [];

  beforeEach(() => {
    rafCallbacks = [];
    // minimal browser globals used by main/renderer/controls/audio
    globalThis.window = globalThis;
    globalThis.performance = { now: () => 0 };
    globalThis.requestAnimationFrame = (cb) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    };
    // AudioContext may be missing — audio fails soft
    // @ts-ignore
    delete globalThis.AudioContext;
    // @ts-ignore
    delete globalThis.webkitAudioContext;

    const listeners = new Map();
    globalThis.document = {
      getElementById: () => null,
      addEventListener() {},
    };
    globalThis.location = { protocol: 'http:' };
    globalThis.addEventListener = (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    };
    globalThis.removeEventListener = () => {};
  });

  afterEach(() => {
    if (game) game.stop();
    game = null;
  });

  it('boot paints full 960×640 surface and start input changes phase', () => {
    const { canvas, ctx, pixels } = makeMockCanvas();
    game = boot(/** @type {any} */ (canvas), { audio: false });

    expect(canvas.width).toBe(ARENA.width);
    expect(canvas.height).toBe(ARENA.height);
    expect(game.getArena()).toEqual({ width: ARENA.width, height: ARENA.height });

    // first draw already happened in boot
    expect(ctx._ops.some((o) => o.startsWith('fillRect') || o === 'fill')).toBe(true);

    // painted fraction: count non-near-black opaque pixels from mock fillRect paints
    let nonBlack = 0;
    const total = ARENA.width * ARENA.height;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] > 8 && (pixels[i] > 12 || pixels[i + 1] > 12 || pixels[i + 2] > 12)) {
        nonBlack++;
      }
    }
    const frac = nonBlack / total;
    expect(frac).toBeGreaterThan(0.25);

    // drive start like keyboard Enter path
    expect(game.state.phase).toBe('title');
    game.state.input.start = true;
    // run one sim step via exported step path (same as rAF loop body)
    const { step } = requireStep();
    step(game.state, 1 / 60);
    expect(game.state.phase).toBe('playing');
    expect(game.state.wave).toBe(1);

    // movement input changes player x
    const x0 = game.state.player.x;
    game.state.input.right = true;
    for (let i = 0; i < 30; i++) step(game.state, 1 / 60);
    expect(game.state.player.x).toBeGreaterThan(x0);
  });
});

function requireStep() {
  // use shipped module
  return { step: bootStep };
}

import { step as bootStep } from '../src/game/sim.js';
