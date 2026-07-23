import { ARENA, PLAYER, WAVE } from './constants.js';

/**
 * Create a fresh game state for a new run (or title screen).
 * Pure data — no DOM, no RNG side effects beyond optional rng seed helper.
 * @param {{ seed?: number }} [opts]
 */
export function createGameState(opts = {}) {
  const seed = opts.seed ?? 0xC011B4EA;
  return {
    phase: /** @type {'title' | 'playing' | 'upgrade' | 'won' | 'lost'} */ ('title'),
    seed,
    rngState: seed >>> 0,
    time: 0,
    wave: 0,
    waveClearTimer: 0,
    score: 0,
    essence: 0,
    killCount: 0,
    shake: 0,
    hitstop: 0,
    message: '',
    messageTimer: 0,
    spawnQueue: /** @type {Array<{type: string, delay: number}>} */ ([]),
    spawnTimer: 0,
    bossSpawned: false,
    upgradeChoices: /** @type {import('./constants.js').UPGRADE_POOL[number][]} */ ([]),
    ownedUpgrades: /** @type {string[]} */ ([]),
    input: createInputState(),
    player: createPlayer(),
    enemies: /** @type {Enemy[]} */ ([]),
    projectiles: /** @type {Projectile[]} */ ([]),
    coils: /** @type {Coil[]} */ ([]),
    pickups: /** @type {Pickup[]} */ ([]),
    effects: /** @type {Effect[]} */ ([]),
    arena: { width: ARENA.width, height: ARENA.height, margin: ARENA.margin },
    meta: {
      wavesToWin: WAVE.count,
      version: 1,
    },
  };
}

export function createInputState() {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    fire: false,
    coil: false,
    dash: false,
    aimX: ARENA.width / 2,
    aimY: ARENA.height / 2,
    /** edge-triggered: set true for one frame */
    start: false,
    chooseUpgrade: /** @type {null | 0 | 1 | 2} */ (null),
    pause: false,
  };
}

export function createPlayer() {
  return {
    x: ARENA.width / 2,
    y: ARENA.height / 2,
    vx: 0,
    vy: 0,
    radius: PLAYER.radius,
    hp: PLAYER.baseMaxHp,
    maxHp: PLAYER.baseMaxHp,
    energy: PLAYER.baseMaxEnergy,
    maxEnergy: PLAYER.baseMaxEnergy,
    angle: 0,
    speed: PLAYER.baseSpeed,
    fireCooldown: PLAYER.fireCooldown,
    fireTimer: 0,
    boltSpeed: PLAYER.boltSpeed,
    boltDamage: PLAYER.boltDamage,
    boltRadius: PLAYER.boltRadius,
    boltCount: 1,
    dashSpeed: PLAYER.dashSpeed,
    dashDuration: PLAYER.dashDuration,
    dashCooldown: PLAYER.dashCooldown,
    dashTimer: 0,
    dashCdTimer: 0,
    dashCost: PLAYER.dashCost,
    invuln: 0,
    invulnOnHit: PLAYER.invulnOnHit,
    coilPlaceCooldown: PLAYER.coilPlaceCooldown,
    coilPlaceTimer: 0,
    maxCoils: PLAYER.maxCoils,
    coilRadius: PLAYER.coilRadius,
    coilBeamWidth: PLAYER.coilBeamWidth,
    coilDamagePerSec: PLAYER.coilDamagePerSec,
    coilEnergyDrainPerSec: PLAYER.coilEnergyDrainPerSec,
    coilLifesteal: 0,
    energyRegenPerSec: PLAYER.energyRegenPerSec,
    pickupRadius: PLAYER.pickupRadius,
    alive: true,
  };
}

/**
 * Deterministic mulberry32-style PRNG stored on state.
 * @param {ReturnType<typeof createGameState>} state
 * @returns {number} [0, 1)
 */
export function nextRandom(state) {
  let t = (state.rngState += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return r;
}

/**
 * @param {ReturnType<typeof createGameState>} state
 * @param {number} min
 * @param {number} max
 */
export function randRange(state, min, max) {
  return min + nextRandom(state) * (max - min);
}

/**
 * @typedef {Object} Enemy
 * @property {string} id
 * @property {'grunt'|'swift'|'brute'|'warden'} type
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {number} radius
 * @property {number} hp
 * @property {number} maxHp
 * @property {number} speed
 * @property {number} damage
 * @property {number} score
 * @property {number} essence
 * @property {string} color
 * @property {number} hitFlash
 * @property {boolean} isBoss
 */

/**
 * @typedef {Object} Projectile
 * @property {string} id
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {number} radius
 * @property {number} damage
 * @property {number} life
 * @property {'player'|'enemy'} owner
 */

/**
 * @typedef {Object} Coil
 * @property {string} id
 * @property {number} x
 * @property {number} y
 * @property {number} radius
 * @property {number} life
 * @property {number} pulse
 */

/**
 * @typedef {Object} Pickup
 * @property {string} id
 * @property {number} x
 * @property {number} y
 * @property {number} radius
 * @property {'essence'|'health'} kind
 * @property {number} value
 * @property {number} life
 */

/**
 * @typedef {Object} Effect
 * @property {string} id
 * @property {'spark'|'ring'|'text'} kind
 * @property {number} x
 * @property {number} y
 * @property {number} life
 * @property {number} maxLife
 * @property {number} [vx]
 * @property {number} [vy]
 * @property {string} [color]
 * @property {string} [text]
 * @property {number} [size]
 */

let _id = 1;
export function nextId(prefix = 'e') {
  _id += 1;
  return `${prefix}_${_id}`;
}

export function resetIdCounter(n = 1) {
  _id = n;
}
