import { ENEMY, WAVE } from './constants.js';
import { createGameState, nextId } from './state.js';
import {
  applyCoilDamage,
  clampToArena,
  damagePlayer,
  dist,
  findNearestCoil,
  firePlayerBolts,
  placeCoil,
  tryDash,
  trySiphonCoil,
  updateProjectiles,
} from './combat.js';
import { isWaveClear, startWave, updateSpawns } from './waves.js';
import {
  applyUpgradeChoice,
  continueAfterUpgrade,
  enterUpgradePhase,
} from './upgrades.js';

export { createGameState, startWave, applyUpgradeChoice };

/**
 * Begin a new run from title (or restart).
 * @param {ReturnType<typeof createGameState>} state
 * @param {{seed?: number}} [opts]
 */
export function startRun(state, opts = {}) {
  const seed = opts.seed ?? state.seed ?? 0xc011b4ea;
  const fresh = createGameState({ seed });
  for (const k of Object.keys(state)) {
    // @ts-ignore
    delete state[k];
  }
  Object.assign(state, fresh);
  state.phase = 'playing';
  startWave(state, 1);
  return state;
}

/**
 * Apply a one-frame input snapshot onto state.input.
 * @param {any} state
 * @param {Partial<ReturnType<typeof import('./state.js').createInputState>>} partial
 */
export function setInput(state, partial) {
  Object.assign(state.input, partial);
}

/**
 * Main simulation step. Pure logic for all systems.
 * @param {any} state
 * @param {number} dt seconds
 */
export function step(state, dt) {
  const t = Math.max(0, Math.min(0.05, dt));

  if (state.phase === 'title') {
    if (state.input.start) {
      state.input.start = false;
      startRun(state);
    }
    return state;
  }

  if (state.phase === 'won' || state.phase === 'lost') {
    if (state.input.start) {
      state.input.start = false;
      startRun(state);
    }
    tickEffects(state, t);
    return state;
  }

  if (state.phase === 'upgrade') {
    if (state.input.chooseUpgrade != null) {
      const idx = state.input.chooseUpgrade;
      state.input.chooseUpgrade = null;
      if (applyUpgradeChoice(state, idx)) {
        continueAfterUpgrade(state, startWave);
      }
    }
    tickEffects(state, t);
    return state;
  }

  if (state.hitstop > 0) {
    state.hitstop = Math.max(0, state.hitstop - t);
    if (state.shake > 0) state.shake = Math.max(0, state.shake - t * 20);
    return state;
  }

  state.time += t;
  if (state.messageTimer > 0) state.messageTimer = Math.max(0, state.messageTimer - t);
  if (state.shake > 0) state.shake = Math.max(0, state.shake - t * 18);

  updatePlayer(state, t);
  updateSpawns(state, t);
  updateEnemies(state, t);
  firePlayerBolts(state);
  placeCoil(state);
  state.input.coil = false;
  state.input.dash = false;

  updateProjectiles(state, t);
  applyCoilDamage(state, t);
  updateCoils(state, t);
  updatePickups(state, t);
  tickEffects(state, t);

  if (isWaveClear(state) && state.wave > 0) {
    state.waveClearTimer += t;
    if (state.waveClearTimer >= WAVE.clearDelay) {
      state.waveClearTimer = 0;
      if (state.wave >= state.meta.wavesToWin) {
        state.phase = 'won';
        state.message = 'CORE SHATTERED';
        state.messageTimer = 99;
        state.score += 1000;
      } else {
        enterUpgradePhase(state);
      }
    }
  }

  return state;
}

/**
 * @param {any} state
 * @param {number} dt
 */
function updatePlayer(state, dt) {
  const p = state.player;
  if (!p.alive) return;

  p.fireTimer = Math.max(0, p.fireTimer - dt);
  p.coilPlaceTimer = Math.max(0, p.coilPlaceTimer - dt);
  p.dashCdTimer = Math.max(0, p.dashCdTimer - dt);
  p.invuln = Math.max(0, p.invuln - dt);

  if (p.dashTimer > 0) {
    p.dashTimer = Math.max(0, p.dashTimer - dt);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    clampToArena(p, state.arena);
    return;
  }

  tryDash(state);

  let mx = 0;
  let my = 0;
  if (state.input.up) my -= 1;
  if (state.input.down) my += 1;
  if (state.input.left) mx -= 1;
  if (state.input.right) mx += 1;
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len;
    my /= len;
    p.vx = mx * p.speed;
    p.vy = my * p.speed;
  } else {
    p.vx *= 0.8;
    p.vy *= 0.8;
    if (Math.hypot(p.vx, p.vy) < 4) {
      p.vx = 0;
      p.vy = 0;
    }
  }

  p.x += p.vx * dt;
  p.y += p.vy * dt;
  clampToArena(p, state.arena);

  const adx = state.input.aimX - p.x;
  const ady = state.input.aimY - p.y;
  if (adx !== 0 || ady !== 0) p.angle = Math.atan2(ady, adx);

  p.energy = Math.min(p.maxEnergy, p.energy + p.energyRegenPerSec * dt);
}

/**
 * @param {any} state
 * @param {number} dt
 */
function updateEnemies(state, dt) {
  const p = state.player;
  for (const e of state.enemies) {
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    if (e.siphonCd > 0) e.siphonCd = Math.max(0, e.siphonCd - dt);
    if (!p.alive) continue;

    // Siphon: hunt nearest coil when any exist; otherwise chase player.
    let targetX = p.x;
    let targetY = p.y;
    if (e.type === 'siphon' && state.coils.length > 0) {
      const coil = findNearestCoil(state.coils, e);
      if (coil) {
        targetX = coil.x;
        targetY = coil.y;
      }
    }

    const dx = targetX - e.x;
    const dy = targetY - e.y;
    const d = Math.hypot(dx, dy) || 1;
    let ux = dx / d;
    let uy = dy / d;
    if (e.isBoss && d < 160) {
      const tx = -uy;
      const ty = ux;
      ux = ux * 0.35 + tx * 0.65;
      uy = uy * 0.35 + ty * 0.65;
      const n = Math.hypot(ux, uy) || 1;
      ux /= n;
      uy /= n;
    }
    e.vx = ux * e.speed;
    e.vy = uy * e.speed;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    clampToArena(e, state.arena);

    if (e.type === 'siphon') {
      trySiphonCoil(state, e);
    }

    if (dist(e, p) <= e.radius + p.radius - 2) {
      damagePlayer(state, e.damage);
    }
  }
}

/**
 * @param {any} state
 * @param {number} dt
 */
function updateCoils(state, dt) {
  for (const c of state.coils) {
    c.life -= dt;
    c.pulse += dt * 6;
  }
  state.coils = state.coils.filter((c) => c.life > 0);
}

/**
 * @param {any} state
 * @param {number} dt
 */
function updatePickups(state, dt) {
  const p = state.player;
  for (const pk of state.pickups) {
    pk.life -= dt;
    const d = dist(pk, p);
    if (d < p.pickupRadius) {
      const pull = Math.min(1, (p.pickupRadius - d) / p.pickupRadius);
      const ang = Math.atan2(p.y - pk.y, p.x - pk.x);
      pk.x += Math.cos(ang) * 280 * pull * dt;
      pk.y += Math.sin(ang) * 280 * pull * dt;
    }
    if (d <= p.radius + pk.radius) {
      if (pk.kind === 'essence') {
        state.essence += pk.value;
        state.score += pk.value;
      } else if (pk.kind === 'health') {
        p.hp = Math.min(p.maxHp, p.hp + pk.value);
      }
      pk.life = 0;
    }
  }
  state.pickups = state.pickups.filter((pk) => pk.life > 0);
}

/**
 * @param {any} state
 * @param {number} dt
 */
function tickEffects(state, dt) {
  for (const fx of state.effects) {
    fx.life -= dt;
    if (fx.vx) fx.x += fx.vx * dt;
    if (fx.vy) fx.y += fx.vy * dt;
  }
  state.effects = state.effects.filter((fx) => fx.life > 0);
}

/**
 * Step many frames at fixed FPS.
 * @param {any} state
 * @param {number} seconds
 * @param {number} [fps]
 */
export function stepFor(state, seconds, fps = 60) {
  const frame = 1 / fps;
  const frames = Math.ceil(seconds * fps);
  for (let i = 0; i < frames; i++) step(state, frame);
  return state;
}

/**
 * @param {any} state
 */
export function debugClearEnemies(state) {
  state.enemies = [];
  state.spawnQueue = [];
}

/**
 * @param {any} state
 * @param {keyof typeof ENEMY} type
 * @param {number} x
 * @param {number} y
 */
export function spawnEnemyAt(state, type, x, y) {
  const def = ENEMY[type];
  const enemy = {
    id: nextId('en'),
    type,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: def.radius,
    hp: def.hp,
    maxHp: def.hp,
    speed: def.speed,
    damage: def.damage,
    score: def.score,
    essence: def.essence,
    color: def.color,
    hitFlash: 0,
    isBoss: type === 'warden',
    siphonCd: 0,
  };
  state.enemies.push(enemy);
  if (enemy.isBoss) state.bossSpawned = true;
  return enemy;
}
