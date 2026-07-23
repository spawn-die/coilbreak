/** @typedef {'title' | 'playing' | 'upgrade' | 'won' | 'lost'} GamePhase */

export const ARENA = Object.freeze({
  width: 960,
  height: 640,
  margin: 36,
});

export const PLAYER = Object.freeze({
  radius: 14,
  baseSpeed: 220,
  baseMaxHp: 100,
  baseMaxEnergy: 100,
  fireCooldown: 0.18,
  boltSpeed: 520,
  boltDamage: 12,
  boltRadius: 5,
  dashSpeed: 520,
  dashDuration: 0.14,
  dashCooldown: 0.85,
  dashCost: 18,
  invulnOnHit: 0.45,
  coilPlaceCooldown: 0.12,
  maxCoils: 3,
  coilRadius: 10,
  coilBeamWidth: 8,
  coilDamagePerSec: 55,
  coilEnergyDrainPerSec: 14,
  energyRegenPerSec: 10,
  pickupRadius: 22,
});

export const ENEMY = Object.freeze({
  grunt: { radius: 12, hp: 28, speed: 95, damage: 10, score: 10, essence: 3, color: '#ff4d6d' },
  swift: { radius: 10, hp: 18, speed: 165, damage: 8, score: 15, essence: 4, color: '#ff9f1c' },
  brute: { radius: 20, hp: 90, speed: 55, damage: 18, score: 30, essence: 8, color: '#c77dff' },
  /** Coil saboteur: hunts nearest coil and collapses it on contact. */
  siphon: { radius: 11, hp: 32, speed: 130, damage: 9, score: 25, essence: 6, color: '#5ce1ff' },
  warden: { radius: 34, hp: 520, speed: 70, damage: 22, score: 500, essence: 50, color: '#00f5d4' },
});

export const WAVE = Object.freeze({
  count: 5,
  clearDelay: 0.9,
  spawnPadding: 48,
});

export const UPGRADE_POOL = Object.freeze([
  { id: 'overcharge', name: 'Overcharge', desc: '+35% bolt damage', apply: (s) => { s.player.boltDamage *= 1.35; } },
  { id: 'coil_surge', name: 'Coil Surge', desc: '+40% coil DPS', apply: (s) => { s.player.coilDamagePerSec *= 1.4; } },
  { id: 'iron_core', name: 'Iron Core', desc: '+30 max HP & heal 30', apply: (s) => { s.player.maxHp += 30; s.player.hp = Math.min(s.player.maxHp, s.player.hp + 30); } },
  { id: 'capacitor', name: 'Capacitor', desc: '+40 max energy', apply: (s) => { s.player.maxEnergy += 40; s.player.energy = Math.min(s.player.maxEnergy, s.player.energy + 40); } },
  { id: 'rapid_fire', name: 'Rapid Fire', desc: '25% faster fire rate', apply: (s) => { s.player.fireCooldown *= 0.75; } },
  { id: 'phase_dash', name: 'Phase Dash', desc: 'Dash cools 35% faster', apply: (s) => { s.player.dashCooldown *= 0.65; } },
  { id: 'multicoil', name: 'Multi-Coil', desc: 'Place up to 4 coils', apply: (s) => { s.player.maxCoils = Math.max(s.player.maxCoils, 4); } },
  { id: 'vampiric', name: 'Leech Beam', desc: 'Coils heal you slightly', apply: (s) => { s.player.coilLifesteal = 0.08; } },
  { id: 'splitter', name: 'Splitter', desc: 'Bolts fork into 2', apply: (s) => { s.player.boltCount = Math.max(s.player.boltCount, 2); } },
  { id: 'magnet', name: 'Magnet Field', desc: 'Pull essence from farther', apply: (s) => { s.player.pickupRadius += 40; } },
  { id: 'hard_nodes', name: 'Hard Nodes', desc: 'Coils resist one siphon hit', apply: (s) => { s.player.coilArmor = Math.max(s.player.coilArmor || 0, 1); } },
]);

export const COLORS = Object.freeze({
  bg0: '#07060f',
  bg1: '#12102a',
  grid: 'rgba(90, 70, 200, 0.12)',
  player: '#7bffb3',
  playerGlow: '#3dff9a',
  bolt: '#9bffea',
  coil: '#5ce1ff',
  coilHot: '#ff6ad5',
  beam: 'rgba(92, 225, 255, 0.85)',
  hud: '#e8e6ff',
  danger: '#ff4d6d',
  accent: '#c77dff',
  gold: '#ffd166',
});
