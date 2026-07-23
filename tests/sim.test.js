import { describe, it, expect, beforeEach } from 'vitest';
import {
  createGameState,
  startRun,
  setInput,
  step,
  stepFor,
  spawnEnemyAt,
  debugClearEnemies,
  firePlayerBolts,
  placeCoil,
  applyCoilDamage,
  damagePlayer,
  damageEnemy,
  applyUpgradeChoice,
  enterUpgradePhase,
  isWaveClear,
  buildWavePlan,
  startWave,
  dist,
  ARENA,
  PLAYER,
  WAVE,
  resetIdCounter,
} from '../src/game/index.js';

describe('COILBREAK simulation', () => {
  beforeEach(() => {
    resetIdCounter(1);
  });

  it('createGameState starts on title with full player agency fields', () => {
    const s = createGameState({ seed: 42 });
    expect(s.phase).toBe('title');
    expect(s.player.hp).toBe(PLAYER.baseMaxHp);
    expect(s.player.x).toBe(ARENA.width / 2);
    expect(s.arena.width).toBe(ARENA.width);
    expect(s.meta.wavesToWin).toBe(WAVE.count);
  });

  it('input start begins a run at wave 1 (player agency → phase change)', () => {
    const s = createGameState({ seed: 7 });
    setInput(s, { start: true });
    step(s, 1 / 60);
    expect(s.phase).toBe('playing');
    expect(s.wave).toBe(1);
    expect(s.spawnQueue.length).toBeGreaterThan(0);
  });

  it('WASD input moves the player (input → state change)', () => {
    const s = createGameState({ seed: 11 });
    startRun(s, { seed: 11 });
    const x0 = s.player.x;
    const y0 = s.player.y;
    setInput(s, { right: true, up: true });
    stepFor(s, 0.5);
    expect(s.player.x).toBeGreaterThan(x0);
    expect(s.player.y).toBeLessThan(y0);
  });

  it('firing spawns projectiles toward aim', () => {
    const s = createGameState({ seed: 3 });
    startRun(s, { seed: 3 });
    s.player.fireTimer = 0;
    setInput(s, { fire: true, aimX: s.player.x + 100, aimY: s.player.y });
    const bolts = firePlayerBolts(s);
    expect(bolts.length).toBeGreaterThanOrEqual(1);
    expect(s.projectiles.length).toBe(bolts.length);
    expect(bolts[0].vx).toBeGreaterThan(0);
  });

  it('projectiles damage and can kill enemies (combat system)', () => {
    const s = createGameState({ seed: 5 });
    startRun(s, { seed: 5 });
    debugClearEnemies(s);
    const enemy = spawnEnemyAt(s, 'grunt', s.player.x + 40, s.player.y);
    const hp0 = enemy.hp;
    s.player.fireTimer = 0;
    s.player.boltDamage = 50;
    setInput(s, { fire: true, aimX: enemy.x, aimY: enemy.y });
    firePlayerBolts(s);
    stepFor(s, 0.25);
    // either dead or damaged
    const still = s.enemies.find((e) => e.id === enemy.id);
    if (still) {
      expect(still.hp).toBeLessThan(hp0);
    } else {
      expect(s.killCount).toBeGreaterThanOrEqual(1);
      expect(s.score).toBeGreaterThan(0);
    }
  });

  it('placing coils creates network nodes (second system)', () => {
    const s = createGameState({ seed: 9 });
    startRun(s, { seed: 9 });
    s.player.energy = 100;
    s.player.coilPlaceTimer = 0;
    setInput(s, { coil: true, aimX: 200, aimY: 200 });
    const c1 = placeCoil(s);
    expect(c1).not.toBeNull();
    expect(s.coils.length).toBe(1);
    s.player.coilPlaceTimer = 0;
    setInput(s, { coil: true, aimX: 400, aimY: 200 });
    placeCoil(s);
    expect(s.coils.length).toBe(2);
  });

  it('coil beams damage enemies between nodes (combat + coils integrated)', () => {
    const s = createGameState({ seed: 13 });
    startRun(s, { seed: 13 });
    debugClearEnemies(s);
    s.player.energy = 100;
    s.coils = [
      { id: 'a', x: 100, y: 300, radius: 10, life: 10, pulse: 0 },
      { id: 'b', x: 400, y: 300, radius: 10, life: 10, pulse: 0 },
    ];
    const enemy = spawnEnemyAt(s, 'grunt', 250, 300);
    enemy.hp = 40;
    const dealt = applyCoilDamage(s, 0.5);
    expect(dealt).toBeGreaterThan(0);
    // dead or hurt
    if (s.enemies.length === 0) {
      expect(s.killCount).toBeGreaterThanOrEqual(1);
    } else {
      expect(s.enemies[0].hp).toBeLessThan(40);
    }
  });

  it('player death sets lost terminal outcome', () => {
    const s = createGameState({ seed: 17 });
    startRun(s, { seed: 17 });
    s.player.hp = 5;
    s.player.invuln = 0;
    s.player.dashTimer = 0;
    const applied = damagePlayer(s, 50);
    expect(applied).toBe(true);
    expect(s.phase).toBe('lost');
    expect(s.player.alive).toBe(false);
    expect(s.player.hp).toBe(0);
  });

  it('clearing final wave yields won terminal outcome', () => {
    const s = createGameState({ seed: 19 });
    startRun(s, { seed: 19 });
    s.wave = WAVE.count;
    debugClearEnemies(s);
    s.waveClearTimer = 0;
    stepFor(s, WAVE.clearDelay + 0.1);
    expect(s.phase).toBe('won');
    expect(s.message).toMatch(/CORE SHATTERED/i);
  });

  it('clearing a non-final wave enters upgrade phase (progression system)', () => {
    const s = createGameState({ seed: 21 });
    startRun(s, { seed: 21 });
    s.wave = 1;
    debugClearEnemies(s);
    stepFor(s, WAVE.clearDelay + 0.15);
    expect(s.phase).toBe('upgrade');
    expect(s.upgradeChoices.length).toBeGreaterThan(0);
    expect(s.upgradeChoices.length).toBeLessThanOrEqual(3);
  });

  it('choosing an upgrade mutates player stats and advances wave (systems together)', () => {
    const s = createGameState({ seed: 23 });
    startRun(s, { seed: 23 });
    s.wave = 1;
    debugClearEnemies(s);
    stepFor(s, WAVE.clearDelay + 0.15);
    expect(s.phase).toBe('upgrade');
    const dmg0 = s.player.boltDamage;
    const hp0 = s.player.maxHp;
    // pick first choice regardless of which upgrade
    setInput(s, { chooseUpgrade: 0 });
    step(s, 1 / 60);
    expect(s.phase).toBe('playing');
    expect(s.wave).toBe(2);
    expect(s.ownedUpgrades.length).toBe(1);
    // some stat should have changed OR hp healed depending on roll — at least owned
    const changed =
      s.player.boltDamage !== dmg0 ||
      s.player.maxHp !== hp0 ||
      s.player.fireCooldown !== PLAYER.fireCooldown ||
      s.player.maxCoils !== PLAYER.maxCoils ||
      s.player.coilDamagePerSec !== PLAYER.coilDamagePerSec ||
      s.player.maxEnergy !== PLAYER.baseMaxEnergy ||
      s.player.dashCooldown !== PLAYER.dashCooldown ||
      s.player.coilLifesteal > 0 ||
      s.player.boltCount > 1 ||
      s.player.pickupRadius !== PLAYER.pickupRadius;
    expect(changed).toBe(true);
  });

  it('applyUpgradeChoice is rejected outside upgrade phase', () => {
    const s = createGameState({ seed: 29 });
    startRun(s, { seed: 29 });
    s.upgradeChoices = [
      {
        id: 'overcharge',
        name: 'Overcharge',
        desc: 'x',
        apply: (st) => {
          st.player.boltDamage *= 2;
        },
      },
    ];
    expect(applyUpgradeChoice(s, 0)).toBe(false);
    expect(s.player.boltDamage).toBeCloseTo(PLAYER.boltDamage);
  });

  it('buildWavePlan scales and final wave includes warden', () => {
    const w1 = buildWavePlan(1);
    const w5 = buildWavePlan(WAVE.count);
    expect(w1.length).toBeGreaterThan(0);
    expect(w5.some((e) => e.type === 'warden')).toBe(true);
  });

  it('contact damage from enemies hurts player (combat integration)', () => {
    const s = createGameState({ seed: 31 });
    startRun(s, { seed: 31 });
    debugClearEnemies(s);
    s.player.invuln = 0;
    s.player.dashTimer = 0;
    const hp0 = s.player.hp;
    spawnEnemyAt(s, 'grunt', s.player.x, s.player.y);
    stepFor(s, 0.1);
    expect(s.player.hp).toBeLessThan(hp0);
  });

  it('damageEnemy awards score and essence on kill', () => {
    const s = createGameState({ seed: 37 });
    startRun(s, { seed: 37 });
    debugClearEnemies(s);
    const e = spawnEnemyAt(s, 'swift', 100, 100);
    const essence0 = s.essence;
    damageEnemy(s, e, 999);
    s.enemies = s.enemies.filter((en) => en.hp > 0);
    expect(s.score).toBeGreaterThan(0);
    expect(s.essence).toBeGreaterThan(essence0);
    expect(s.killCount).toBe(1);
  });

  it('isWaveClear requires empty queue and enemies', () => {
    const s = createGameState({ seed: 41 });
    startRun(s, { seed: 41 });
    expect(isWaveClear(s)).toBe(false);
    debugClearEnemies(s);
    expect(isWaveClear(s)).toBe(true);
  });

  it('enterUpgradePhase sets choices from pool', () => {
    const s = createGameState({ seed: 43 });
    startRun(s, { seed: 43 });
    enterUpgradePhase(s);
    expect(s.phase).toBe('upgrade');
    expect(s.upgradeChoices.length).toBeGreaterThan(0);
  });

  it('dist and player stay within arena bounds after movement', () => {
    const s = createGameState({ seed: 47 });
    startRun(s, { seed: 47 });
    setInput(s, { left: true, up: true });
    stepFor(s, 5);
    expect(s.player.x).toBeGreaterThanOrEqual(s.arena.margin);
    expect(s.player.y).toBeGreaterThanOrEqual(s.arena.margin);
    expect(dist(s.player, { x: 0, y: 0 })).toBeGreaterThan(0);
  });

  it('startWave sets message and queue for boss wave', () => {
    const s = createGameState({ seed: 53 });
    startRun(s, { seed: 53 });
    startWave(s, WAVE.count);
    expect(s.wave).toBe(WAVE.count);
    expect(s.message).toMatch(/WARDEN/i);
    expect(s.spawnQueue.some((e) => e.type === 'warden')).toBe(true);
  });
});
