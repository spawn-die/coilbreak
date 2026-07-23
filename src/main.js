import { ARENA } from './game/constants.js';
import { createGameState, step } from './game/sim.js';
import { Renderer } from './render/renderer.js';
import { Controls } from './input/controls.js';
import { createAudio } from './audio/sfx.js';

/**
 * Boot the game on a canvas. Exported for structural tests / tooling.
 * @param {HTMLCanvasElement} canvas
 * @param {{ audio?: boolean }} [opts]
 */
export function boot(canvas, opts = {}) {
  if (!canvas) throw new Error('boot() requires a canvas element');

  const state = createGameState({ seed: (Date.now() ^ 0xc011) >>> 0 });
  const renderer = new Renderer(canvas);
  const controls = new Controls(canvas, () => state);
  controls.bind();
  const audio = opts.audio === false ? null : createAudio();

  let last = performance.now();
  let running = true;
  let prevPhase = state.phase;
  let prevKills = 0;

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    controls.sync(state);
    step(state, dt);

    if (audio) {
      if (state.phase === 'playing' && prevPhase === 'title') audio.beep(440, 0.06, 'square', 0.04);
      if (state.phase === 'upgrade' && prevPhase === 'playing') audio.beep(660, 0.08, 'triangle', 0.05);
      if (state.phase === 'won' && prevPhase !== 'won') audio.beep(880, 0.2, 'sawtooth', 0.06);
      if (state.phase === 'lost' && prevPhase !== 'lost') audio.beep(110, 0.25, 'sawtooth', 0.07);
      if (state.killCount > prevKills) audio.beep(320 + Math.random() * 80, 0.04, 'square', 0.03);
    }
    prevPhase = state.phase;
    prevKills = state.killCount;

    renderer.draw(state, dt);
    requestAnimationFrame(frame);
  }

  // paint first frame immediately so launch probes never see a blank buffer
  renderer.draw(state, 0);
  requestAnimationFrame(frame);

  return {
    state,
    renderer,
    controls,
    stop() {
      running = false;
      controls.unbind();
    },
    getArena() {
      return { width: ARENA.width, height: ARENA.height };
    },
    /** Presentation identity once Atelier sprites load. */
    getPlayerProxy() {
      return renderer.getPlayerProxy();
    },
    whenSpritesReady() {
      return renderer.whenSpritesReady();
    },
  };
}

// Auto-boot when loaded as a script in the browser
const canvas = typeof document !== 'undefined' ? document.getElementById('game') : null;
if (canvas) {
  // file: protocol note
  if (typeof location !== 'undefined' && location.protocol === 'file:') {
    const el = document.getElementById('file-warning');
    if (el) el.hidden = false;
  }
  const game = boot(/** @type {HTMLCanvasElement} */ (canvas));
  // expose for Playwright / debug
  // @ts-ignore
  window.__COILBREAK__ = game;
}
