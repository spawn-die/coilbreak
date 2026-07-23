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
  let prevHp = state.player.hp;
  let prevCoils = state.coils.length;

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    controls.sync(state);
    const shotsBefore = state.projectiles?.length ?? 0;
    step(state, dt);
    const shotsAfter = state.projectiles?.length ?? 0;

    if (audio) {
      if (state.phase === 'playing' && prevPhase === 'title') audio.play('start');
      if (state.phase === 'upgrade' && prevPhase === 'playing') audio.play('upgrade');
      if (state.phase === 'won' && prevPhase !== 'won') audio.play('win');
      if (state.phase === 'lost' && prevPhase !== 'lost') audio.play('lose');
      if (state.killCount > prevKills) audio.play('kill');
      if (state.player.hp < prevHp) audio.play('hit');
      if (state.coils.length > prevCoils) audio.play('coil');
      if (shotsAfter > shotsBefore && state.phase === 'playing') audio.play('fire');
    }
    prevPhase = state.phase;
    prevKills = state.killCount;
    prevHp = state.player.hp;
    prevCoils = state.coils.length;

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
    audio,
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
