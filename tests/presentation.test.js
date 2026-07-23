import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function isPng(buf) {
  return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
}

describe('Coilbreak Forge pipeline presentation', () => {
  it('presentation declares texture proxy and asset paths', () => {
    const path = join(ROOT, 'assets/presentation.json');
    expect(existsSync(path)).toBe(true);
    const pres = JSON.parse(readFileSync(path, 'utf8'));
    expect(pres.hero.proxy).toBe('texture');
    expect(pres.source).toMatch(/forge|atelier/i);
    expect(pres.hero.canonBase).toMatch(/hero_base\.png$/);
    expect(pres.hero.idle.length).toBeGreaterThanOrEqual(2);
    expect(pres.hero.walk.length).toBeGreaterThanOrEqual(4);
  });

  it('pipeline PNGs exist on disk with signatures', () => {
    const pres = JSON.parse(readFileSync(join(ROOT, 'assets/presentation.json'), 'utf8'));
    const paths = [
      pres.hero.canonBase,
      ...pres.hero.idle,
      ...pres.hero.walk,
      ...(pres.enemy ? [pres.enemy.canonBase, ...pres.enemy.idle] : []),
    ];
    for (const rel of paths) {
      const abs = join(ROOT, rel);
      expect(existsSync(abs), abs).toBe(true);
      const buf = readFileSync(abs);
      expect(isPng(buf), rel).toBe(true);
      expect(buf.length).toBeGreaterThan(8_000);
    }
  });

  it('renderer ships sprite load + drawImage player path', () => {
    const src = readFileSync(join(ROOT, 'src/render/renderer.js'), 'utf8');
    expect(src).toMatch(/loadSpritePack/);
    expect(src).toMatch(/drawImage/);
    expect(src).toMatch(/getPlayerProxy/);
    expect(src).toMatch(/heroWalk|heroIdle/);
  });

  it('pipeline sprites use readable ship scale (not humanoid-giant, not tiny)', async () => {
    const { PLAYER_SPRITE_RADIUS_MULT, ENEMY_SPRITE_RADIUS_MULT } = await import(
      '../src/render/renderer.js'
    );
    expect(PLAYER_SPRITE_RADIUS_MULT).toBeGreaterThanOrEqual(4);
    expect(PLAYER_SPRITE_RADIUS_MULT).toBeLessThan(7);
    expect(ENEMY_SPRITE_RADIUS_MULT).toBeGreaterThanOrEqual(3);
    expect(14 * PLAYER_SPRITE_RADIUS_MULT).toBeGreaterThan(50);
  });

  it('presentation aesthetic is neon space ship, not fantasy knight', () => {
    const pres = JSON.parse(readFileSync(join(ROOT, 'assets/presentation.json'), 'utf8'));
    expect(pres.aesthetic).toMatch(/ship|space|neon/i);
    expect(pres.hero.kind).toBe('ship');
    expect(pres.enemy.kind).toBe('drone');
  });
});

