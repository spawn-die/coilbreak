#!/usr/bin/env node
/**
 * Sync Coilbreak showcase art from Forge media kit (SPACE ships, not arena knights).
 *
 * Prefers forge/fixtures/media/coilbreak-*-base.png when present.
 * Does NOT copy arena-2d humanoid sprites (wrong aesthetic for Coilbreak).
 */
import { cpSync, existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const coilRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const media = join(coilRoot, '../forge/fixtures/media');
const dest = join(coilRoot, 'assets');
const shipBase = join(media, 'coilbreak-ship-base.png');
const droneBase = join(media, 'coilbreak-drone-base.png');

if (!existsSync(shipBase) || !existsSync(droneBase)) {
  console.error(
    'Missing coilbreak ship/drone bases in forge/fixtures/media/.\n' +
      'Expected coilbreak-ship-base.png and coilbreak-drone-base.png',
  );
  process.exit(1);
}

mkdirSync(join(dest, 'canon'), { recursive: true });
mkdirSync(join(dest, 'actors'), { recursive: true });
cpSync(shipBase, join(dest, 'canon/hero_base.png'));
cpSync(droneBase, join(dest, 'canon/enemy_base.png'));

// Derive simple idle/thrust frames via PIL rotate (edit-from-canon)
const py = `
from PIL import Image
import sys, os
ship = Image.open(sys.argv[1]).convert("RGBA")
drone = Image.open(sys.argv[2]).convert("RGBA")
actors = sys.argv[3]
os.makedirs(actors, exist_ok=True)
for i, ang in enumerate([0, -4], 1):
    ship.rotate(ang, expand=False, fillcolor=(0,0,0,0)).save(f"{actors}/hero_idle_0{i}.png")
for i, (ang, ox) in enumerate([(-6,0),(6,0),(-3,2),(3,-2)], 1):
    fr = ship.rotate(ang, expand=False, fillcolor=(0,0,0,0))
    c = Image.new("RGBA", ship.size, (0,0,0,0))
    c.paste(fr, (ox, 0), fr)
    c.save(f"{actors}/hero_walk_0{i}.png")
for i, ang in enumerate([0, 8], 1):
    drone.rotate(ang, expand=False, fillcolor=(0,0,0,0)).save(f"{actors}/enemy_idle_0{i}.png")
print("ok")
`;
execFileSync('python3', ['-c', py, shipBase, droneBase, join(dest, 'actors')], {
  encoding: 'utf8',
});

const pres = {
  titleId: 'coilbreak',
  stage: 'L2',
  source: 'forge-atelier-pipeline',
  aesthetic: 'neon-space-ship',
  hero: {
    proxy: 'texture',
    kind: 'ship',
    canonBase: 'assets/canon/hero_base.png',
    idle: ['assets/actors/hero_idle_01.png', 'assets/actors/hero_idle_02.png'],
    walk: [
      'assets/actors/hero_walk_01.png',
      'assets/actors/hero_walk_02.png',
      'assets/actors/hero_walk_03.png',
      'assets/actors/hero_walk_04.png',
    ],
  },
  enemy: {
    proxy: 'texture',
    kind: 'drone',
    canonBase: 'assets/canon/enemy_base.png',
    idle: ['assets/actors/enemy_idle_01.png', 'assets/actors/enemy_idle_02.png'],
  },
};
writeFileSync(join(dest, 'presentation.json'), JSON.stringify(pres, null, 2));
console.log('synced SPACE ship/drone art → coilbreak/assets (not arena knights)');
console.log('hero_base', readFileSync(join(dest, 'canon/hero_base.png')).length, 'bytes');
