/**
 * Load Forge/Atelier presentation sprites for Coilbreak.
 * Renderer falls back to geometric ship if load fails.
 */

/**
 * @typedef {{
 *   proxy: string,
 *   ready: boolean,
 *   heroIdle: HTMLImageElement[],
 *   heroWalk: HTMLImageElement[],
 *   enemyIdle: HTMLImageElement[],
 *   presentation: any | null,
 * }} SpritePack
 */

/**
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    // Node / test env without Image
    if (typeof Image === 'undefined') {
      reject(new Error('no Image'));
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`sprite load fail: ${src}`));
    img.src = src;
  });
}

/**
 * @param {string} [presentationUrl]
 * @returns {Promise<SpritePack>}
 */
export async function loadSpritePack(presentationUrl = 'assets/presentation.json') {
  /** @type {SpritePack} */
  const pack = {
    proxy: 'geometry',
    ready: false,
    heroIdle: [],
    heroWalk: [],
    enemyIdle: [],
    presentation: null,
  };

  try {
    if (typeof fetch === 'undefined') return pack;
    const res = await fetch(presentationUrl);
    if (!res.ok) return pack;
    const pres = await res.json();
    pack.presentation = pres;
    pack.proxy = pres?.hero?.proxy ?? 'geometry';
    if (pres?.hero?.idle?.length) {
      pack.heroIdle = await Promise.all(pres.hero.idle.map(loadImage));
    }
    if (pres?.hero?.walk?.length) {
      pack.heroWalk = await Promise.all(pres.hero.walk.map(loadImage));
    }
    if (pres?.enemy?.idle?.length) {
      pack.enemyIdle = await Promise.all(pres.enemy.idle.map(loadImage));
    }
    pack.ready = pack.heroIdle.length > 0 || pack.heroWalk.length > 0;
    if (pack.ready && pack.proxy === 'texture') {
      // ok
    } else if (pack.ready) {
      pack.proxy = 'texture';
    }
  } catch {
    pack.ready = false;
    pack.proxy = 'geometry';
  }
  return pack;
}
