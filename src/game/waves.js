import { ARENA, ENEMY, WAVE } from './constants.js';
import { nextId, randRange } from './state.js';

/**
 * Wave composition. Wave 5 is the Warden boss.
 * @param {number} wave 1-based
 * @returns {Array<{type: keyof typeof ENEMY, delay: number}>}
 */
export function buildWavePlan(wave) {
  if (wave <= 0) return [];
  if (wave >= WAVE.count) {
    return [
      { type: 'grunt', delay: 0 },
      { type: 'grunt', delay: 0.3 },
      { type: 'swift', delay: 0.6 },
      { type: 'brute', delay: 1.0 },
      { type: 'warden', delay: 1.8 },
    ];
  }

  /** @type {Array<{type: keyof typeof ENEMY, delay: number}>} */
  const plan = [];
  const grunts = 3 + wave * 2;
  const swifts = Math.max(0, wave - 1);
  const brutes = wave >= 3 ? wave - 2 : 0;

  let t = 0;
  for (let i = 0; i < grunts; i++) {
    plan.push({ type: 'grunt', delay: t });
    t += Math.max(0.25, 0.55 - wave * 0.04);
  }
  for (let i = 0; i < swifts; i++) {
    plan.push({ type: 'swift', delay: t });
    t += 0.4;
  }
  for (let i = 0; i < brutes; i++) {
    plan.push({ type: 'brute', delay: t });
    t += 0.7;
  }
  return plan;
}

/**
 * @param {import('./state.js').createGameState extends (...args:any)=>infer R ? R : never} state
 * @param {keyof typeof ENEMY} type
 */
export function spawnEnemy(state, type) {
  const def = ENEMY[type];
  if (!def) throw new Error(`Unknown enemy type: ${type}`);

  const edge = Math.floor(randRange(state, 0, 4));
  const pad = WAVE.spawnPadding;
  let x = 0;
  let y = 0;
  switch (edge) {
    case 0: // top
      x = randRange(state, pad, ARENA.width - pad);
      y = pad;
      break;
    case 1: // right
      x = ARENA.width - pad;
      y = randRange(state, pad, ARENA.height - pad);
      break;
    case 2: // bottom
      x = randRange(state, pad, ARENA.width - pad);
      y = ARENA.height - pad;
      break;
    default: // left
      x = pad;
      y = randRange(state, pad, ARENA.height - pad);
      break;
  }

  /** @type {import('./state.js').Enemy} */
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
  };
  state.enemies.push(enemy);
  if (enemy.isBoss) state.bossSpawned = true;
  return enemy;
}

/**
 * Begin a wave (1-based). Clears spawn queue and schedules enemies.
 * @param {import('./state.js').ReturnType<typeof import('./state.js').createGameState>} state
 * @param {number} wave
 */
export function startWave(state, wave) {
  state.wave = wave;
  state.spawnQueue = buildWavePlan(wave).map((e) => ({ ...e }));
  state.spawnTimer = 0;
  state.waveClearTimer = 0;
  state.bossSpawned = false;
  state.message = wave >= WAVE.count ? 'CORE WARDEN INBOUND' : `WAVE ${wave}`;
  state.messageTimer = 1.6;
}

/**
 * Process spawn queue over time.
 * @param {any} state
 * @param {number} dt
 */
export function updateSpawns(state, dt) {
  if (state.spawnQueue.length === 0) return;
  state.spawnTimer += dt;
  while (state.spawnQueue.length > 0 && state.spawnTimer >= state.spawnQueue[0].delay) {
    const next = state.spawnQueue.shift();
    spawnEnemy(state, next.type);
  }
}

/**
 * True when wave combat is finished (no enemies, queue empty).
 * @param {any} state
 */
export function isWaveClear(state) {
  return state.spawnQueue.length === 0 && state.enemies.length === 0;
}
