# COILBREAK

**Fantasy:** Weave lethal energy coils across a collapsing neon arena, evolve your loadout between waves, and shatter the Core Warden before the void takes you.

A focused arena roguelite vertical slice — real combat, coil-beam tactics, and wave progression — built for the browser.

![stack](https://img.shields.io/badge/stack-Canvas%20%2B%20ESM-5ce1ff) ![tests](https://img.shields.io/badge/tests-vitest-7bffb3)

## Play

```bash
npm install
npm start
```

Open **http://localhost:4173**

> ES modules will not load from `file://`. Use `npm start` (or any static server from the repo root).

### Controls

| Input | Action |
|-------|--------|
| **WASD** / arrows | Move |
| **Mouse** | Aim |
| **Left click** | Fire energy bolts |
| **F** / **E** / **Right click** | Plant coil nodes (link 2+ for beams) |
| **Space** | Phase dash (i-frames, costs energy) |
| **Enter** / click | Start / restart |
| **1 / 2 / 3** | Choose an upgrade between waves |

### Goal

Survive **5 waves**. Between waves, pick one upgrade. Wave 5 spawns the **Core Warden**. Clear it to win. Hit 0 HP to lose.

## Test

```bash
npm test
```

Unit tests import the **shipped** simulation modules (`src/game/*`) and exercise:

- Input → player movement / firing / coils
- Combat + coil beam systems together
- Wave clear → upgrade → next wave progression
- Win and lose terminal outcomes

## Project layout

```
index.html          # entry
styles.css
src/
  main.js           # boot + game loop
  game/             # pure simulation (testable)
  render/           # canvas renderer
  input/            # keyboard/mouse bridge
  audio/            # optional WebAudio blips
tests/
  sim.test.js
scripts/
  verify-launch.mjs # Playwright launch probe
```

## Design notes

Two systems that matter:

1. **Combat** — bolts, dash, contact damage, enemy archetypes (grunt / swift / brute / warden).
2. **Coils + progression** — place up to 3–4 coil nodes; beams between them deal high DPS but drain energy. Clear waves to draft upgrades (damage, coil surge, iron core, splitter, …).

Simulation is pure JS with a seeded PRNG so tests and play share the same rules.

## License

MIT
