# Coilbreak — agent notes

## Run

```bash
npm i && npm start   # :4783 (not 4173 — keycrafted collision)
npm test
node scripts/verify-launch.mjs   # needs playwright + system chrome channel
```

## Role

Arcade side dish. Real fun loop; **not** the studio wow flagship (that’s Nightwell).

## Gotchas

- `#file-warning[hidden]` needs `display:none !important` (ID CSS overrode `hidden`).  
- Playwright bundled Chromium CDN 403 here — use `channel: 'chrome'`.
