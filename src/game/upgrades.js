import { UPGRADE_POOL } from './constants.js';
import { nextRandom } from './state.js';

/**
 * Pick up to `count` unique upgrades not already owned.
 * @param {any} state
 * @param {number} [count]
 * @returns {typeof UPGRADE_POOL[number][]}
 */
export function rollUpgradeChoices(state, count = 3) {
  const available = UPGRADE_POOL.filter((u) => !state.ownedUpgrades.includes(u.id));
  if (available.length === 0) return [];

  const pool = [...available];
  /** @type {typeof UPGRADE_POOL[number][]} */
  const picks = [];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(nextRandom(state) * pool.length);
    picks.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return picks;
}

/**
 * Apply upgrade by index into state.upgradeChoices.
 * @param {any} state
 * @param {0|1|2|number} index
 * @returns {boolean} whether applied
 */
export function applyUpgradeChoice(state, index) {
  if (state.phase !== 'upgrade') return false;
  const choice = state.upgradeChoices[index];
  if (!choice) return false;
  choice.apply(state);
  state.ownedUpgrades.push(choice.id);
  state.upgradeChoices = [];
  return true;
}

/**
 * Enter upgrade phase after a non-final wave.
 * @param {any} state
 */
export function enterUpgradePhase(state) {
  state.phase = 'upgrade';
  state.upgradeChoices = rollUpgradeChoices(state, 3);
  // If nothing to pick, auto-continue
  if (state.upgradeChoices.length === 0) {
    state.phase = 'playing';
  }
}

/**
 * Resume play into the next wave after upgrade.
 * @param {any} state
 * @param {(state: any, wave: number) => void} startWaveFn
 */
export function continueAfterUpgrade(state, startWaveFn) {
  const next = state.wave + 1;
  state.phase = 'playing';
  startWaveFn(state, next);
}
