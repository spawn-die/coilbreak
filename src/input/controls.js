/**
 * Browser input → simulation input bridge.
 */
export class Controls {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {() => any} getState
   */
  constructor(canvas, getState) {
    this.canvas = canvas;
    this.getState = getState;
    /** @type {Set<string>} */
    this.keys = new Set();
    this.mouseDown = false;
    this.rightDown = false;
    this.aimX = canvas.width / 2;
    this.aimY = canvas.height / 2;
    this._bound = false;
  }

  bind() {
    if (this._bound) return;
    this._bound = true;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    this.canvas.addEventListener('mouseup', this.onMouseUp);
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('mouseleave', () => {
      this.mouseDown = false;
      this.rightDown = false;
    });
  }

  unbind() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  onKeyDown = (e) => {
    this.keys.add(e.code);
    const state = this.getState();
    if (!state) return;

    if (e.code === 'Enter' || e.code === 'Space') {
      if (state.phase === 'title' || state.phase === 'won' || state.phase === 'lost') {
        state.input.start = true;
        e.preventDefault();
      }
    }
    if (state.phase === 'upgrade') {
      if (e.code === 'Digit1' || e.code === 'Numpad1') state.input.chooseUpgrade = 0;
      if (e.code === 'Digit2' || e.code === 'Numpad2') state.input.chooseUpgrade = 1;
      if (e.code === 'Digit3' || e.code === 'Numpad3') state.input.chooseUpgrade = 2;
    }
    if (e.code === 'Space' && state.phase === 'playing') {
      state.input.dash = true;
      e.preventDefault();
    }
    if ((e.code === 'KeyF' || e.code === 'KeyE') && state.phase === 'playing') {
      state.input.coil = true;
    }
  };

  onKeyUp = (e) => {
    this.keys.delete(e.code);
  };

  onMouseMove = (e) => {
    const rect = this.canvas.getBoundingClientRect();
    const sx = this.canvas.width / rect.width;
    const sy = this.canvas.height / rect.height;
    this.aimX = (e.clientX - rect.left) * sx;
    this.aimY = (e.clientY - rect.top) * sy;
  };

  onMouseDown = (e) => {
    const state = this.getState();
    if (!state) return;
    if (e.button === 0) {
      this.mouseDown = true;
      if (state.phase === 'title' || state.phase === 'won' || state.phase === 'lost') {
        state.input.start = true;
      }
      if (state.phase === 'upgrade') {
        this.pickUpgradeAt(state, e);
      }
    }
    if (e.button === 2) {
      this.rightDown = true;
      if (state.phase === 'playing') state.input.coil = true;
    }
  };

  onMouseUp = (e) => {
    if (e.button === 0) this.mouseDown = false;
    if (e.button === 2) this.rightDown = false;
  };

  /**
   * @param {any} state
   * @param {MouseEvent} e
   */
  pickUpgradeAt(state, e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = this.canvas.width / rect.width;
    const sy = this.canvas.height / rect.height;
    const x = (e.clientX - rect.left) * sx;
    const y = (e.clientY - rect.top) * sy;
    state.upgradeChoices.forEach((c, i) => {
      const hit = c._hit;
      if (!hit) return;
      if (x >= hit.x && x <= hit.x + hit.w && y >= hit.y && y <= hit.y + hit.h) {
        state.input.chooseUpgrade = i;
      }
    });
  }

  /**
   * Write continuous held-state into state.input each frame.
   * @param {any} state
   */
  sync(state) {
    const k = this.keys;
    state.input.up = k.has('KeyW') || k.has('ArrowUp');
    state.input.down = k.has('KeyS') || k.has('ArrowDown');
    state.input.left = k.has('KeyA') || k.has('ArrowLeft');
    state.input.right = k.has('KeyD') || k.has('ArrowRight');
    state.input.fire = this.mouseDown || k.has('KeyJ');
    state.input.aimX = this.aimX;
    state.input.aimY = this.aimY;
    if (this.rightDown) {
      // continuous coil place attempts gated by cooldown in sim
      state.input.coil = true;
    }
  }
}
