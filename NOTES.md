# Coilbreak — agent notes

## Run

```bash
npm i && npm start   # :4783
npm test
npm run sync:forge   # pull Atelier sprites from ../forge arena build
node scripts/verify-launch.mjs   # needs playwright + system chrome channel
```

## Role

**Studio visual showcase** — best-looking playable title. Now loads **Forge/Atelier pipeline textures** for player + trash enemies (`assets/presentation.json`, `proxy: texture`). Geometry ship remains fallback if sprites fail.

## Pipeline

- Assets under `assets/canon/`, `assets/actors/`
- Sync: `npm run sync:forge` (requires `cd ../forge && npm run arena:build` first)
- Renderer: `src/render/sprites.js` + `drawImage` path in `renderer.js`
- **Readable scale:** `PLAYER_SPRITE_RADIUS_MULT=6.2`, `ENEMY_SPRITE_RADIUS_MULT=4.8` (render-only; hitboxes unchanged)
- **Audio:** `createAudio().play(cue)` — start/kill/hit/fire/coil from main loop

## Gotchas

- `#file-warning[hidden]` needs `display:none !important` (ID CSS overrode `hidden`).  
- Playwright bundled Chromium CDN 403 here — use `channel: 'chrome'`.

## Expansions

- **Siphon** enemies (wave 2+) hunt nearest coils and collapse them on contact; **Hard Nodes** upgrade gives coils 1 armor hit. Tests cover sabotage AI, armor, and wave plans.
