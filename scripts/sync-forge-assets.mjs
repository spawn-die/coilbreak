#!/usr/bin/env node
/**
 * Pull Forge Atelier arena assets into Coilbreak for showcase play.
 * Run from coilbreak/: node scripts/sync-forge-assets.mjs
 * Or from forge after arena:build: npm run sync:coilbreak
 */
import { cpSync, existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const coilRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const forgeAssets = join(coilRoot, '../forge/examples/arena-2d/public/assets');
const dest = join(coilRoot, 'assets');

if (!existsSync(join(forgeAssets, 'canon/hero_base.png'))) {
  console.error('Missing forge arena assets. Run: cd ../forge && npm run arena:build');
  process.exit(1);
}

mkdirSync(join(dest, 'canon'), { recursive: true });
mkdirSync(join(dest, 'actors'), { recursive: true });
cpSync(join(forgeAssets, 'canon'), join(dest, 'canon'), { recursive: true });
cpSync(join(forgeAssets, 'actors'), join(dest, 'actors'), { recursive: true });

const pres = {
  titleId: 'coilbreak',
  stage: 'L2',
  source: 'forge-atelier-pipeline',
  hero: {
    proxy: 'texture',
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
    canonBase: 'assets/canon/enemy_base.png',
    idle: ['assets/actors/enemy_idle_01.png', 'assets/actors/enemy_idle_02.png'],
  },
};
writeFileSync(join(dest, 'presentation.json'), JSON.stringify(pres, null, 2));
console.log('synced forge assets → coilbreak/assets');
console.log('hero_base', readFileSync(join(dest, 'canon/hero_base.png')).length, 'bytes');
