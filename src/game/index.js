/**
 * Public simulation API — import these from tests and the browser shell.
 */
export { ARENA, PLAYER, ENEMY, WAVE, UPGRADE_POOL, COLORS } from './constants.js';
export {
  createGameState,
  createInputState,
  createPlayer,
  nextRandom,
  randRange,
  nextId,
  resetIdCounter,
} from './state.js';
export {
  dist,
  clampToArena,
  firePlayerBolts,
  placeCoil,
  tryDash,
  segmentHitsCircle,
  damageEnemy,
  damagePlayer,
  applyCoilDamage,
  updateProjectiles,
} from './combat.js';
export {
  buildWavePlan,
  spawnEnemy,
  startWave,
  updateSpawns,
  isWaveClear,
} from './waves.js';
export {
  rollUpgradeChoices,
  applyUpgradeChoice,
  enterUpgradePhase,
  continueAfterUpgrade,
} from './upgrades.js';
export {
  startRun,
  setInput,
  step,
  stepFor,
  debugClearEnemies,
  spawnEnemyAt,
} from './sim.js';
