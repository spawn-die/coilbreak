/**
 * Tiny WebAudio blips — optional polish, fails soft if AudioContext blocked.
 */
export function createAudio() {
  /** @type {AudioContext | null} */
  let ctx = null;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      return ctx;
    } catch {
      return null;
    }
  }

  /**
   * @param {number} freq
   * @param {number} dur
   * @param {OscillatorType} [type]
   * @param {number} [gain]
   */
  function beep(freq, dur, type = 'square', gain = 0.04) {
    const c = ensure();
    if (!c) return;
    if (c.state === 'suspended') c.resume().catch(() => {});
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** Named cues for combat / UI — used by main loop. */
  function play(cue) {
    switch (cue) {
      case 'start':
        beep(440, 0.06, 'square', 0.045);
        break;
      case 'upgrade':
        beep(660, 0.08, 'triangle', 0.05);
        break;
      case 'win':
        beep(880, 0.2, 'sawtooth', 0.06);
        break;
      case 'lose':
        beep(110, 0.25, 'sawtooth', 0.07);
        break;
      case 'kill':
        beep(320 + Math.random() * 80, 0.05, 'square', 0.04);
        break;
      case 'hit':
        beep(180, 0.07, 'sawtooth', 0.05);
        break;
      case 'fire':
        beep(520, 0.03, 'square', 0.03);
        break;
      case 'coil':
        beep(740, 0.05, 'triangle', 0.035);
        break;
      case 'ui':
        beep(600, 0.04, 'sine', 0.03);
        break;
      default:
        beep(400, 0.04, 'square', 0.03);
    }
  }

  return { beep, ensure, play };
}
