/**
 * Headless launch probe for COILBREAK.
 * Serves the game, loads twice, checks canvas size + painted content + input effect.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SCRATCH =
  process.env.COILBREAK_SCRATCH ||
  '/tmp/grok-goal-be9010ae1d4e/implementer';
const OUT = join(SCRATCH, 'launch');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function log(line) {
  console.log(line);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const failLog = join(SCRATCH, 'launch-env-failure.log');

  const server = createServer((req, res) => {
    try {
      let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (urlPath === '/') urlPath = '/index.html';
      const filePath = join(ROOT, urlPath.replace(/^\//, ''));
      if (!filePath.startsWith(ROOT) || !existsSync(filePath)) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      const ext = extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      createReadStream(filePath).pipe(res);
    } catch (e) {
      res.writeHead(500);
      res.end(String(e));
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  log(`server ${base}`);

  /** @type {import('playwright').Browser | null} */
  let browser = null;
  const lines = [];
  const push = (s) => {
    lines.push(s);
    log(s);
  };

  try {
    // Prefer system Chrome when Playwright's bundled Chromium cannot be downloaded.
    browser = await chromium.launch({
      headless: true,
      channel: 'chrome',
    });
    for (let run = 1; run <= 2; run++) {
      const page = await browser.newPage();
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(String(err)));
      page.on('console', (msg) => {
        if (msg.type() !== 'error') return;
        const text = msg.text();
        // ignore missing favicon / source-map noise
        if (/favicon\.ico|404 \(Not Found\)/i.test(text) && /favicon|resource/i.test(text)) return;
        if (/Failed to load resource:.*favicon/i.test(text)) return;
        if (/Failed to load resource: the server responded with a status of 404/i.test(text)) return;
        pageErrors.push(`console.error: ${text}`);
      });
      page.on('response', (res) => {
        if (res.status() === 404 && !/favicon/i.test(res.url())) {
          pageErrors.push(`404: ${res.url()}`);
        }
      });

      await page.goto(base + '/', { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForFunction(() => window.__COILBREAK__ != null, null, { timeout: 15000 });
      // allow a few frames to paint
      await page.waitForTimeout(200);

      const metrics = await page.evaluate(() => {
        const c = document.getElementById('game');
        if (!(c instanceof HTMLCanvasElement)) return { error: 'no canvas' };
        const ctx = c.getContext('2d');
        const w = c.width;
        const h = c.height;
        const data = ctx.getImageData(0, 0, w, h).data;
        let opaque = 0;
        let nonBlack = 0;
        const total = w * h;
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a > 8) opaque++;
          if (a > 8 && (data[i] > 12 || data[i + 1] > 12 || data[i + 2] > 12)) nonBlack++;
        }
        const game = window.__COILBREAK__;
        return {
          width: w,
          height: h,
          opaque,
          nonBlack,
          total,
          opaqueFrac: opaque / total,
          nonBlackFrac: nonBlack / total,
          phase: game?.state?.phase ?? null,
          arena: game?.getArena?.() ?? null,
        };
      });

      push(`run${run} metrics ${JSON.stringify(metrics)}`);
      push(`run${run} pageErrors ${JSON.stringify(pageErrors)}`);

      if (pageErrors.length) {
        throw new Error(`Page errors on run ${run}: ${pageErrors.join(' | ')}`);
      }
      if (metrics.width !== 960 || metrics.height !== 640) {
        throw new Error(`Canvas size mismatch: ${metrics.width}x${metrics.height}`);
      }
      // Title screen fills nearly the whole canvas — require substantial paint
      if (metrics.nonBlackFrac < 0.25) {
        throw new Error(`Canvas under-painted: nonBlackFrac=${metrics.nonBlackFrac}`);
      }

      // Drive start input → phase should become playing
      await page.keyboard.press('Enter');
      await page.waitForTimeout(150);
      const after = await page.evaluate(() => {
        const g = window.__COILBREAK__;
        return {
          phase: g.state.phase,
          wave: g.state.wave,
          playerX: g.state.player.x,
        };
      });
      push(`run${run} afterEnter ${JSON.stringify(after)}`);
      if (after.phase !== 'playing') {
        throw new Error(`Expected playing after Enter, got ${after.phase}`);
      }

      // Move right — player x should increase
      const x0 = after.playerX;
      await page.keyboard.down('KeyD');
      await page.waitForTimeout(300);
      await page.keyboard.up('KeyD');
      const afterMove = await page.evaluate(() => window.__COILBREAK__.state.player.x);
      push(`run${run} move x0=${x0} x1=${afterMove}`);
      if (!(afterMove > x0 + 2)) {
        throw new Error(`Expected player to move right: ${x0} -> ${afterMove}`);
      }

      // Screenshot painted surface
      await page.locator('#game').screenshot({ path: join(OUT, `run${run}.png`) });
      await page.close();
    }

    writeFileSync(join(OUT, 'launch.log'), lines.join('\n') + '\n');
    push('LAUNCH OK');
    await browser.close();
    server.close();
    process.exit(0);
  } catch (err) {
    const msg = err && err.stack ? err.stack : String(err);
    push(`LAUNCH FAIL: ${msg}`);
    writeFileSync(join(OUT, 'launch.log'), lines.join('\n') + '\n');
    // If browser itself failed to launch, also write env failure
    if (/browserType\.launch|Executable doesn't exist|Failed to launch/i.test(msg)) {
      writeFileSync(failLog, msg);
    }
    try {
      if (browser) await browser.close();
    } catch {}
    server.close();
    process.exit(1);
  }
}

main();
