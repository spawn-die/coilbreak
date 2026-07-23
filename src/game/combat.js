import { nextId } from './state.js';

/**
 * Distance between two points.
 * @param {{x:number,y:number}} a
 * @param {{x:number,y:number}} b
 */
export function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

/**
 * Clamp entity inside arena with margin.
 * @param {{x:number,y:number,radius:number}} e
 * @param {{width:number,height:number,margin:number}} arena
 */
export function clampToArena(e, arena) {
  const m = arena.margin + e.radius;
  e.x = Math.max(m, Math.min(arena.width - m, e.x));
  e.y = Math.max(m, Math.min(arena.height - m, e.y));
}

/**
 * Fire player bolts toward aim point.
 * @param {any} state
 */
export function firePlayerBolts(state) {
  const p = state.player;
  if (p.fireTimer > 0) return [];
  if (!state.input.fire) return [];

  const dx = state.input.aimX - p.x;
  const dy = state.input.aimY - p.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  p.angle = Math.atan2(uy, ux);
  p.fireTimer = p.fireCooldown;

  const count = Math.max(1, p.boltCount | 0);
  /** @type {import('./state.js').Projectile[]} */
  const shots = [];
  const spread = count === 1 ? 0 : 0.14;
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : (i / (count - 1) - 0.5) * 2 * spread;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const bx = ux * c - uy * s;
    const by = ux * s + uy * c;
    /** @type {import('./state.js').Projectile} */
    const bolt = {
      id: nextId('bolt'),
      x: p.x + bx * (p.radius + 4),
      y: p.y + by * (p.radius + 4),
      vx: bx * p.boltSpeed,
      vy: by * p.boltSpeed,
      radius: p.boltRadius,
      damage: p.boltDamage,
      life: 1.4,
      owner: 'player',
    };
    state.projectiles.push(bolt);
    shots.push(bolt);
  }
  return shots;
}

/**
 * Place a coil at aim (or nearest free slot), cycling when at max.
 * @param {any} state
 * @returns {import('./state.js').Coil | null}
 */
export function placeCoil(state) {
  const p = state.player;
  if (!state.input.coil) return null;
  if (p.coilPlaceTimer > 0) return null;
  if (p.energy < 8) return null;

  p.coilPlaceTimer = p.coilPlaceCooldown;
  p.energy = Math.max(0, p.energy - 8);

  const x = state.input.aimX;
  const y = state.input.aimY;

  if (state.coils.length >= p.maxCoils) {
    state.coils.shift();
  }

  /** @type {import('./state.js').Coil} */
  const coil = {
    id: nextId('coil'),
    x,
    y,
    radius: p.coilRadius,
    life: 12,
    pulse: 0,
  };
  state.coils.push(coil);
  return coil;
}

/**
 * Attempt dash in movement direction (or aim if idle).
 * @param {any} state
 * @returns {boolean}
 */
export function tryDash(state) {
  const p = state.player;
  if (!state.input.dash) return false;
  if (p.dashCdTimer > 0 || p.dashTimer > 0) return false;
  if (p.energy < p.dashCost) return false;

  let mx = 0;
  let my = 0;
  if (state.input.up) my -= 1;
  if (state.input.down) my += 1;
  if (state.input.left) mx -= 1;
  if (state.input.right) mx += 1;
  if (mx === 0 && my === 0) {
    mx = Math.cos(p.angle);
    my = Math.sin(p.angle);
  }
  const len = Math.hypot(mx, my) || 1;
  p.vx = (mx / len) * p.dashSpeed;
  p.vy = (my / len) * p.dashSpeed;
  p.dashTimer = p.dashDuration;
  p.dashCdTimer = p.dashCooldown;
  p.energy -= p.dashCost;
  p.invuln = Math.max(p.invuln, p.dashDuration + 0.05);
  return true;
}

/**
 * Segment-circle intersection for coil beams.
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @param {number} cx
 * @param {number} cy
 * @param {number} r
 */
export function segmentHitsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const fx = x1 - cx;
  const fy = y1 - cy;
  const a = dx * dx + dy * dy;
  if (a < 1e-8) {
    return Math.hypot(fx, fy) <= r;
  }
  let t = -(fx * dx + fy * dy) / a;
  t = Math.max(0, Math.min(1, t));
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  return Math.hypot(px - cx, py - cy) <= r;
}

/**
 * Apply damage to enemy; spawn pickup/effects on death.
 * @param {any} state
 * @param {import('./state.js').Enemy} enemy
 * @param {number} amount
 * @param {{x:number,y:number}} [at]
 * @returns {boolean} killed
 */
export function damageEnemy(state, enemy, amount, at) {
  if (enemy.hp <= 0) return false;
  enemy.hp -= amount;
  enemy.hitFlash = 0.08;
  const pos = at || enemy;

  if (enemy.hp <= 0) {
    state.score += enemy.score;
    state.killCount += 1;
    state.essence += enemy.essence;
    state.pickups.push({
      id: nextId('pk'),
      x: enemy.x,
      y: enemy.y,
      radius: 8,
      kind: 'essence',
      value: enemy.essence,
      life: 8,
    });
    state.effects.push({
      id: nextId('fx'),
      kind: 'ring',
      x: enemy.x,
      y: enemy.y,
      life: 0.35,
      maxLife: 0.35,
      color: enemy.color,
      size: enemy.radius * 2,
    });
    state.effects.push({
      id: nextId('fx'),
      kind: 'text',
      x: pos.x,
      y: pos.y - 10,
      life: 0.6,
      maxLife: 0.6,
      text: `+${enemy.score}`,
      color: '#ffd166',
      size: 14,
    });
    state.shake = Math.min(10, state.shake + (enemy.isBoss ? 8 : 3));
    state.hitstop = Math.min(0.08, state.hitstop + (enemy.isBoss ? 0.06 : 0.02));
    return true;
  }

  state.effects.push({
    id: nextId('fx'),
    kind: 'spark',
    x: pos.x,
    y: pos.y,
    life: 0.2,
    maxLife: 0.2,
    color: '#9bffea',
    size: 3,
  });
  return false;
}

/**
 * Damage player unless invulnerable.
 * @param {any} state
 * @param {number} amount
 * @returns {boolean} applied
 */
export function damagePlayer(state, amount) {
  const p = state.player;
  if (!p.alive || p.invuln > 0 || p.dashTimer > 0) return false;
  p.hp -= amount;
  p.invuln = p.invulnOnHit;
  state.shake = Math.min(14, state.shake + 6);
  state.hitstop = Math.min(0.1, state.hitstop + 0.04);
  if (p.hp <= 0) {
    p.hp = 0;
    p.alive = false;
    state.phase = 'lost';
    state.message = 'SIGNAL LOST';
    state.messageTimer = 99;
  }
  return true;
}

/**
 * Apply coil beam damage between all coil pairs + nodes.
 * @param {any} state
 * @param {number} dt
 * @returns {number} total damage dealt this tick
 */
export function applyCoilDamage(state, dt) {
  const coils = state.coils;
  if (coils.length === 0) return 0;
  const p = state.player;

  // Energy drain for active network (2+ coils form beams)
  if (coils.length >= 2) {
    const drain = p.coilEnergyDrainPerSec * dt;
    p.energy = Math.max(0, p.energy - drain);
    if (p.energy <= 0) {
      // Network collapses when empty
      state.coils.length = 0;
      return 0;
    }
  }

  let total = 0;
  const dps = p.coilDamagePerSec;
  const halfW = p.coilBeamWidth * 0.5 + 4;

  for (const enemy of state.enemies) {
    let hit = false;
    // Node contact
    for (const c of coils) {
      if (dist(enemy, c) <= enemy.radius + c.radius + 2) {
        hit = true;
        break;
      }
    }
    // Beam contact
    if (!hit && coils.length >= 2) {
      for (let i = 0; i < coils.length; i++) {
        for (let j = i + 1; j < coils.length; j++) {
          const a = coils[i];
          const b = coils[j];
          if (segmentHitsCircle(a.x, a.y, b.x, b.y, enemy.x, enemy.y, enemy.radius + halfW)) {
            hit = true;
            break;
          }
        }
        if (hit) break;
      }
    }
    if (hit) {
      const dmg = dps * dt;
      total += dmg;
      const killed = damageEnemy(state, enemy, dmg, enemy);
      if (!killed && p.coilLifesteal > 0) {
        p.hp = Math.min(p.maxHp, p.hp + dmg * p.coilLifesteal);
      }
      if (killed && p.coilLifesteal > 0) {
        p.hp = Math.min(p.maxHp, p.hp + 4);
      }
    }
  }

  // Remove dead enemies
  state.enemies = state.enemies.filter((e) => e.hp > 0);
  return total;
}

/**
 * Projectile movement + collisions.
 * @param {any} state
 * @param {number} dt
 */
export function updateProjectiles(state, dt) {
  for (const pr of state.projectiles) {
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    pr.life -= dt;
  }

  for (const pr of state.projectiles) {
    if (pr.life <= 0) continue;
    if (pr.owner === 'player') {
      for (const enemy of state.enemies) {
        if (enemy.hp <= 0) continue;
        if (dist(pr, enemy) <= pr.radius + enemy.radius) {
          damageEnemy(state, enemy, pr.damage, pr);
          pr.life = 0;
          break;
        }
      }
    }
  }

  state.projectiles = state.projectiles.filter((p) => p.life > 0);
  state.enemies = state.enemies.filter((e) => e.hp > 0);
}
