import { ARENA, COLORS } from '../game/constants.js';
import { loadSpritePack } from './sprites.js';

/**
 * Canvas renderer — visual only; never mutates game rules.
 * Player/enemy can use Forge Atelier texture sprites when loaded.
 */
export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = ARENA.width;
    this.h = ARENA.height;
    canvas.width = this.w;
    canvas.height = this.h;
    this.t = 0;
    this.animPhase = 0;
    /** @type {import('./sprites.js').SpritePack | null} */
    this.sprites = null;
    this.stars = Array.from({ length: 80 }, (_, i) => ({
      x: (i * 97) % this.w,
      y: (i * 53) % this.h,
      z: 0.3 + (i % 5) * 0.15,
      p: (i * 17) % 100,
    }));
    // Fire-and-forget sprite load (geometry until ready)
    this._spritePromise = loadSpritePack().then((pack) => {
      this.sprites = pack;
      return pack;
    });
  }

  /** @returns {Promise<import('./sprites.js').SpritePack>} */
  whenSpritesReady() {
    return this._spritePromise;
  }

  /** @returns {string} */
  getPlayerProxy() {
    if (this.sprites?.ready && this.sprites.proxy === 'texture') return 'texture';
    return 'geometry';
  }

  /**
   * @param {any} state
   * @param {number} dt
   */
  draw(state, dt = 0) {
    this.t += dt;
    this.animPhase += dt * 8;
    const ctx = this.ctx;
    const shakeX = state.shake ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake ? (Math.random() - 0.5) * state.shake : 0;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);

    // Background gradient
    const g = ctx.createLinearGradient(0, 0, this.w, this.h);
    g.addColorStop(0, COLORS.bg0);
    g.addColorStop(0.5, '#0c0a1c');
    g.addColorStop(1, COLORS.bg1);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.save();
    ctx.translate(shakeX, shakeY);

    this.drawStars(ctx);
    this.drawArena(ctx, state);
    this.drawCoils(ctx, state);
    this.drawPickups(ctx, state);
    this.drawEnemies(ctx, state);
    this.drawProjectiles(ctx, state);
    this.drawPlayer(ctx, state);
    this.drawEffects(ctx, state);
    this.drawVignette(ctx);

    ctx.restore();

    this.drawHud(ctx, state);
    this.drawOverlays(ctx, state);
  }

  /** @param {CanvasRenderingContext2D} ctx */
  drawStars(ctx) {
    for (const s of this.stars) {
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(this.t * 2 + s.p));
      // drift slowly for life
      const x = (s.x + this.t * 6 * s.z) % this.w;
      const y = (s.y + this.t * 3 * s.z) % this.h;
      ctx.fillStyle = `rgba(180, 170, 255, ${0.22 * s.z * tw})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.1 * s.z, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {any} state
   */
  drawArena(ctx, state) {
    const m = state.arena.margin;
    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    const step = 40;
    ctx.beginPath();
    for (let x = m; x <= this.w - m; x += step) {
      ctx.moveTo(x, m);
      ctx.lineTo(x, this.h - m);
    }
    for (let y = m; y <= this.h - m; y += step) {
      ctx.moveTo(m, y);
      ctx.lineTo(this.w - m, y);
    }
    ctx.stroke();

    // border glow
    ctx.strokeStyle = 'rgba(92, 225, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#5ce1ff';
    ctx.shadowBlur = 12;
    ctx.strokeRect(m, m, this.w - m * 2, this.h - m * 2);
    ctx.shadowBlur = 0;

    // corner accents
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 3;
    const c = 18;
    const corners = [
      [m, m, 1, 1],
      [this.w - m, m, -1, 1],
      [m, this.h - m, 1, -1],
      [this.w - m, this.h - m, -1, -1],
    ];
    for (const [x, y, sx, sy] of corners) {
      ctx.beginPath();
      ctx.moveTo(x, y + sy * c);
      ctx.lineTo(x, y);
      ctx.lineTo(x + sx * c, y);
      ctx.stroke();
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {any} state
   */
  drawCoils(ctx, state) {
    const coils = state.coils;
    if (coils.length >= 2) {
      for (let i = 0; i < coils.length; i++) {
        for (let j = i + 1; j < coils.length; j++) {
          this.drawBeam(ctx, coils[i], coils[j], state);
        }
      }
    }
    for (const c of coils) {
      const pulse = 0.6 + 0.4 * Math.sin(c.pulse);
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.radius + 6 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(92, 225, 255, ${0.12 * pulse})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.coil;
      ctx.shadowColor = COLORS.coil;
      ctx.shadowBlur = 16;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = COLORS.coilHot;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{x:number,y:number}} a
   * @param {{x:number,y:number}} b
   * @param {any} state
   */
  drawBeam(ctx, a, b, state) {
    const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    grad.addColorStop(0, 'rgba(92, 225, 255, 0.15)');
    grad.addColorStop(0.5, 'rgba(255, 106, 213, 0.85)');
    grad.addColorStop(1, 'rgba(92, 225, 255, 0.15)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 6 + Math.sin(this.t * 20) * 1.5;
    ctx.shadowColor = '#ff6ad5';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    // electric jitter
    const mx = (a.x + b.x) / 2 + Math.sin(this.t * 30 + a.x) * 4;
    const my = (a.y + b.y) / 2 + Math.cos(this.t * 28 + a.y) * 4;
    ctx.quadraticCurveTo(mx, my, b.x, b.y);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(mx, my, b.x, b.y);
    ctx.stroke();
    void state;
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {any} state
   */
  drawPickups(ctx, state) {
    for (const pk of state.pickups) {
      const bob = Math.sin(this.t * 5 + pk.x) * 2;
      ctx.beginPath();
      ctx.arc(pk.x, pk.y + bob, pk.radius, 0, Math.PI * 2);
      ctx.fillStyle = pk.kind === 'health' ? COLORS.danger : COLORS.gold;
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {any} state
   */
  drawEnemies(ctx, state) {
    const enemyFrames = this.sprites?.ready ? this.sprites.enemyIdle : [];
    for (const e of state.enemies) {
      const flash = e.hitFlash > 0;
      ctx.save();
      ctx.translate(e.x, e.y);
      if (e.isBoss) {
        // rotating outer ring
        ctx.rotate(this.t * 0.8);
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 3;
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius + 8, 0, Math.PI * 1.4);
        ctx.stroke();
        ctx.rotate(-this.t * 1.6);
        ctx.beginPath();
        ctx.arc(0, 0, e.radius + 14, 0, Math.PI * 1.2);
        ctx.stroke();
        ctx.setTransform(1, 0, 0, 1, e.x + (state.shake ? 0 : 0), e.y);
      }

      const eimg =
        !e.isBoss && enemyFrames.length
          ? enemyFrames[Math.floor(this.animPhase + e.x * 0.01) % enemyFrames.length]
          : null;
      if (eimg && typeof ctx.drawImage === 'function') {
        const scale = (e.radius * 2.8) / Math.max(eimg.naturalWidth || eimg.width || 64, 1);
        const w = (eimg.naturalWidth || eimg.width || 64) * scale;
        const h = (eimg.naturalHeight || eimg.height || 64) * scale;
        if (flash) ctx.globalAlpha = 0.85;
        ctx.drawImage(eimg, -w / 2, -h * 0.55, w, h);
        ctx.globalAlpha = 1;
      } else {
        ctx.beginPath();
        const r = e.radius;
        if (e.type === 'siphon') {
          ctx.moveTo(0, -r);
          ctx.lineTo(r, 0);
          ctx.lineTo(0, r);
          ctx.lineTo(-r, 0);
          ctx.closePath();
        } else {
          ctx.moveTo(0, -r);
          ctx.lineTo(r * 0.85, r * 0.7);
          ctx.lineTo(0, r * 0.35);
          ctx.lineTo(-r * 0.85, r * 0.7);
          ctx.closePath();
        }
        ctx.fillStyle = flash ? '#ffffff' : e.color;
        ctx.shadowColor = e.color;
        ctx.shadowBlur = e.isBoss ? 24 : 12;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = e.type === 'siphon' ? COLORS.coilHot : 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // hp bar
      if (e.hp < e.maxHp || e.isBoss) {
        const bw = e.radius * 2;
        const pct = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(-bw / 2, -e.radius - 12, bw, 4);
        ctx.fillStyle = e.isBoss ? COLORS.coil : COLORS.danger;
        ctx.fillRect(-bw / 2, -e.radius - 12, bw * pct, 4);
      }
      ctx.restore();
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {any} state
   */
  drawProjectiles(ctx, state) {
    for (const pr of state.projectiles) {
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.radius, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.bolt;
      ctx.shadowColor = COLORS.bolt;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
      // trail
      ctx.strokeStyle = 'rgba(155, 255, 234, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pr.x, pr.y);
      ctx.lineTo(pr.x - pr.vx * 0.03, pr.y - pr.vy * 0.03);
      ctx.stroke();
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {any} state
   */
  drawPlayer(ctx, state) {
    const p = state.player;
    if (!p.alive && state.phase === 'lost') return;
    ctx.save();
    ctx.translate(p.x, p.y);

    // dash ghost
    if (p.dashTimer > 0 || p.invuln > 0) {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.t * 40);
    }

    // soft ground glow
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 10, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(61, 255, 154, 0.18)';
    ctx.fill();

    const moving = Math.hypot(p.vx, p.vy) > 25 || p.dashTimer > 0;
    const idle = this.sprites?.heroIdle ?? [];
    const walk = this.sprites?.heroWalk ?? [];
    const frames = moving && walk.length ? walk : idle;
    const img =
      frames.length && typeof ctx.drawImage === 'function'
        ? frames[Math.floor(this.animPhase) % frames.length]
        : null;

    if (img) {
      // texture path — Forge Atelier identity (not geometry ship)
      const scale = (p.radius * 3.4) / Math.max(img.naturalWidth || img.width || 64, 1);
      const w = (img.naturalWidth || img.width || 64) * scale;
      const h = (img.naturalHeight || img.height || 64) * scale;
      // face aim roughly: flip if aiming left
      const aimLeft = state.input && Math.cos(p.angle) < 0;
      ctx.save();
      if (aimLeft) ctx.scale(-1, 1);
      ctx.drawImage(img, -w / 2, -h * 0.62, w, h);
      ctx.restore();
    } else {
      // geometry fallback (ship)
      ctx.rotate(p.angle);
      if (state.phase === 'playing' && (Math.abs(p.vx) + Math.abs(p.vy) > 20 || p.dashTimer > 0)) {
        const flicker = 0.55 + 0.45 * Math.sin(this.t * 40);
        ctx.beginPath();
        ctx.moveTo(-p.radius * 0.5, -5);
        ctx.lineTo(-p.radius - 10 - flicker * 8, 0);
        ctx.lineTo(-p.radius * 0.5, 5);
        ctx.closePath();
        ctx.fillStyle = `rgba(255, 106, 213, ${0.55 * flicker})`;
        ctx.shadowColor = COLORS.coilHot;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.beginPath();
      ctx.moveTo(p.radius + 4, 0);
      ctx.lineTo(-p.radius * 0.8, p.radius * 0.75);
      ctx.lineTo(-p.radius * 0.4, 0);
      ctx.lineTo(-p.radius * 0.8, -p.radius * 0.75);
      ctx.closePath();
      ctx.fillStyle = COLORS.player;
      ctx.shadowColor = COLORS.playerGlow;
      ctx.shadowBlur = 18;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#e8fff2';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(2, 0, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#d0fff0';
      ctx.fill();
    }

    ctx.restore();

    // aim reticle
    if (state.phase === 'playing') {
      const ax = state.input.aimX;
      const ay = state.input.aimY;
      ctx.strokeStyle = 'rgba(255, 106, 213, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ax, ay, 10, 0, Math.PI * 2);
      ctx.moveTo(ax - 16, ay);
      ctx.lineTo(ax - 6, ay);
      ctx.moveTo(ax + 6, ay);
      ctx.lineTo(ax + 16, ay);
      ctx.moveTo(ax, ay - 16);
      ctx.lineTo(ax, ay - 6);
      ctx.moveTo(ax, ay + 6);
      ctx.lineTo(ax, ay + 16);
      ctx.stroke();
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {any} state
   */
  drawEffects(ctx, state) {
    for (const fx of state.effects) {
      const k = fx.life / fx.maxLife;
      if (fx.kind === 'ring') {
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, (fx.size || 20) * (1.2 - k * 0.5), 0, Math.PI * 2);
        ctx.strokeStyle = fx.color || COLORS.coil;
        ctx.globalAlpha = k;
        ctx.lineWidth = 3 * k;
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (fx.kind === 'spark') {
        ctx.globalAlpha = k;
        ctx.fillStyle = fx.color || COLORS.bolt;
        ctx.fillRect(fx.x - 2, fx.y - 2, 4, 4);
        ctx.globalAlpha = 1;
      } else if (fx.kind === 'text') {
        ctx.globalAlpha = k;
        ctx.fillStyle = fx.color || COLORS.gold;
        ctx.font = `bold ${fx.size || 14}px "Segoe UI", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(fx.text || '', fx.x, fx.y - (1 - k) * 20);
        ctx.globalAlpha = 1;
      }
    }
  }

  /** @param {CanvasRenderingContext2D} ctx */
  drawVignette(ctx) {
    const g = ctx.createRadialGradient(
      this.w / 2,
      this.h / 2,
      this.h * 0.25,
      this.w / 2,
      this.h / 2,
      this.h * 0.72,
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {any} state
   */
  drawHud(ctx, state) {
    if (state.phase === 'title') return;
    const p = state.player;

    // top bar panel
    ctx.fillStyle = 'rgba(10, 8, 24, 0.72)';
    ctx.fillRect(0, 0, this.w, 52);
    ctx.strokeStyle = 'rgba(92, 225, 255, 0.25)';
    ctx.strokeRect(0, 0, this.w, 52);

    ctx.fillStyle = COLORS.hud;
    ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`WAVE ${state.wave}/${state.meta.wavesToWin}`, 16, 22);
    ctx.fillStyle = COLORS.gold;
    ctx.fillText(`SCORE ${state.score}`, 16, 40);

    // HP bar
    this.drawBar(ctx, 160, 14, 200, 12, p.hp / p.maxHp, COLORS.danger, 'HP');
    // Energy
    this.drawBar(ctx, 160, 32, 200, 10, p.energy / p.maxEnergy, COLORS.coil, 'EN');

    ctx.fillStyle = COLORS.accent;
    ctx.textAlign = 'right';
    ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`ESSENCE ${state.essence}`, this.w - 16, 22);
    ctx.fillStyle = COLORS.hud;
    ctx.fillText(`KILLS ${state.killCount}`, this.w - 16, 40);

    // dash ready pip
    ctx.textAlign = 'left';
    ctx.fillStyle = p.dashCdTimer <= 0 ? COLORS.player : 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(380, 26, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.hud;
    ctx.font = '11px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('DASH', 392, 30);

    // banner message
    if (state.messageTimer > 0 && state.message) {
      const alpha = Math.min(1, state.messageTimer);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(this.w / 2 - 160, 70, 320, 40);
      ctx.fillStyle = COLORS.coil;
      ctx.font = '700 20px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = COLORS.coil;
      ctx.shadowBlur = 12;
      ctx.fillText(state.message, this.w / 2, 98);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    // controls hint
    if (state.phase === 'playing' && state.time < 6) {
      ctx.globalAlpha = Math.max(0, 1 - state.time / 6);
      ctx.fillStyle = 'rgba(232, 230, 255, 0.75)';
      ctx.font = '12px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        'WASD move · Mouse aim · Click fire · Right-click / F coil · Space dash',
        this.w / 2,
        this.h - 18,
      );
      ctx.globalAlpha = 1;
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {number} pct
   * @param {string} color
   * @param {string} label
   */
  drawBar(ctx, x, y, w, h, pct, color, label) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, pct)), h);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = COLORS.hud;
    ctx.font = '10px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + w + 8, y + h - 1);
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {any} state
   */
  drawOverlays(ctx, state) {
    if (state.phase === 'title') {
      this.drawTitle(ctx);
      return;
    }
    if (state.phase === 'upgrade') {
      this.drawUpgrade(ctx, state);
      return;
    }
    if (state.phase === 'won' || state.phase === 'lost') {
      this.drawEnd(ctx, state);
    }
  }

  /** @param {CanvasRenderingContext2D} ctx */
  drawTitle(ctx) {
    // full fill so launch checks see painted content
    ctx.fillStyle = 'rgba(7, 6, 15, 0.55)';
    ctx.fillRect(0, 0, this.w, this.h);

    // animated hex ring
    ctx.save();
    ctx.translate(this.w / 2, this.h / 2 - 40);
    ctx.strokeStyle = 'rgba(92, 225, 255, 0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.rotate(this.t * (0.2 + i * 0.05));
      ctx.beginPath();
      const R = 80 + i * 28;
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const x = Math.cos(a) * R;
        const y = Math.sin(a) * R;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.coil;
    ctx.font = '800 56px "Segoe UI", system-ui, sans-serif';
    ctx.shadowColor = COLORS.coil;
    ctx.shadowBlur = 24;
    ctx.fillText('COILBREAK', this.w / 2, this.h / 2 - 30);
    ctx.shadowBlur = 0;

    ctx.fillStyle = COLORS.coilHot;
    ctx.font = '600 16px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('WEAVE THE RIFT · SHATTER THE CORE', this.w / 2, this.h / 2 + 8);

    ctx.fillStyle = COLORS.hud;
    ctx.font = '14px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(
      'Plant energy coils. Link them into lethal beams. Survive five waves.',
      this.w / 2,
      this.h / 2 + 48,
    );

    const pulse = 0.55 + 0.45 * Math.sin(this.t * 3);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = COLORS.player;
    ctx.font = '700 18px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('PRESS ENTER / CLICK TO START', this.w / 2, this.h / 2 + 100);
    ctx.globalAlpha = 1;

    ctx.fillStyle = 'rgba(232,230,255,0.45)';
    ctx.font = '12px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('WASD · Mouse · Click fire · F / RMB coil · Space dash · 1-3 upgrades', this.w / 2, this.h - 36);
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {any} state
   */
  drawUpgrade(ctx, state) {
    ctx.fillStyle = 'rgba(7, 6, 15, 0.78)';
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.gold;
    ctx.font = '700 28px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('EVOLVE YOUR LOADOUT', this.w / 2, 120);
    ctx.fillStyle = COLORS.hud;
    ctx.font = '14px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('Choose one augmentation  ·  keys 1 / 2 / 3  or  click', this.w / 2, 150);

    const choices = state.upgradeChoices;
    const cardW = 220;
    const gap = 28;
    const total = choices.length * cardW + (choices.length - 1) * gap;
    let x0 = (this.w - total) / 2;
    const y = 220;

    choices.forEach((c, i) => {
      const x = x0 + i * (cardW + gap);
      // card
      ctx.fillStyle = 'rgba(18, 16, 42, 0.95)';
      ctx.strokeStyle = i === 0 ? COLORS.coil : COLORS.accent;
      ctx.lineWidth = 2;
      ctx.shadowColor = COLORS.accent;
      ctx.shadowBlur = 16;
      roundRect(ctx, x, y, cardW, 200, 12);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = COLORS.coil;
      ctx.font = '700 14px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`[ ${i + 1} ]`, x + cardW / 2, y + 36);
      ctx.fillStyle = COLORS.hud;
      ctx.font = '700 18px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(c.name, x + cardW / 2, y + 78);
      ctx.fillStyle = 'rgba(232,230,255,0.75)';
      ctx.font = '13px "Segoe UI", system-ui, sans-serif';
      wrapText(ctx, c.desc, x + cardW / 2, y + 120, cardW - 32, 18);

      // store hit box for input
      c._hit = { x, y, w: cardW, h: 200 };
    });
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {any} state
   */
  drawEnd(ctx, state) {
    ctx.fillStyle = 'rgba(7, 6, 15, 0.8)';
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.textAlign = 'center';
    const win = state.phase === 'won';
    ctx.fillStyle = win ? COLORS.player : COLORS.danger;
    ctx.font = '800 42px "Segoe UI", system-ui, sans-serif';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 20;
    ctx.fillText(win ? 'CORE SHATTERED' : 'SIGNAL LOST', this.w / 2, this.h / 2 - 30);
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.hud;
    ctx.font = '16px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`Score ${state.score}   ·   Kills ${state.killCount}   ·   Essence ${state.essence}`, this.w / 2, this.h / 2 + 20);
    ctx.fillStyle = COLORS.gold;
    ctx.font = '700 16px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('PRESS ENTER / CLICK TO REBOOT', this.w / 2, this.h / 2 + 70);
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r
 */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {number} maxW
 * @param {number} lineH
 */
function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}
