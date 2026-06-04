// ASCII pseudo-boot screen for the NokaScript REPL.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const LOGO = [
  '#########################',
  '#     #     #  #  #     #',
  '#  #  #  #  #    ##     #',
  '#  #  #     #  #  #  #  #',
  '#########################',
];
const ROWS = LOGO.length;
const COLS = LOGO[0].length;

const RESET = '\x1b[0m';
const HIDE = '\x1b[?25l';
const SHOW = '\x1b[?25h';
const C = (n) => `\x1b[38;5;${n}m`;
const WHITE = C(231);

const SKEW = 0.3;     // per-row lag, so the highlight travels on a slight diagonal
const HALF_W = 4.5;    // highlight half-width
const GRAIN = 0.15;    // brightness of the faint box grain ahead of the crest
const SWEEP_END = 0.5; // the box fence is fully white by here

const INT_START = 0.125;  // interiors begin glitching in once the boxes are polished
const INT_STAGGER = 0.25; // left-to-right lag so letters complete in reading order
const INT_SPAN = 0.25;    // glitch window length before an interior mark settles

const VERSION_DIM = 0.65; // version's final brightness

const EMPTY = 0;
const BOX = 1;
const INTERIOR = 2;

function buildCells() {
  const lit = LOGO.map((row) => [...row].map((ch) => ch === '#'));
  const columnFull = (c) => lit.every((row) => row[c]);
  return lit.map((row, r) =>
    row.map((on, c) => {
      if (!on) return EMPTY;
      if (r === 0 || r === ROWS - 1 || columnFull(c)) return BOX;
      return INTERIOR;
    }),
  );
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readVersion() {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(here, '..', '..', 'package.json'), 'utf8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function halfCell(topOn, botOn) {
  if (topOn && botOn) return '█';
  if (topOn) return '▀';
  if (botOn) return '▄';
  return ' ';
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const gauss = (x, w) => Math.exp(-(x * x) / (2 * w * w));
const rand = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };

function grey(level) {
  const idx = Math.round(clamp01(level) * 24);
  return idx >= 24 ? WHITE : C(232 + idx);
}

function crestAt(t) {
  const maxPos = COLS - 1 + (ROWS - 1) * SKEW;
  return -HALF_W + clamp01(t / SWEEP_END) * (maxPos + 2 * HALF_W);
}

function brightness(crest, r, c) {
  const d = crest - (c + r * SKEW);
  const trail = clamp01((d + HALF_W) / (2 * HALF_W));
  return clamp01(GRAIN + (1 - GRAIN) * trail + 0.3 * gauss(d, HALF_W * 0.55));
}

const OFF = { on: false, lvl: 0 };

function pixelState(cells, r, c, t, crest) {
  const kind = cells[r][c];
  if (kind === EMPTY) return OFF;
  if (kind === INTERIOR) {
    const start = INT_START + (c / COLS) * INT_STAGGER;
    const p = (t - start) / INT_SPAN; // 0..1 through the glitch window
    if (p <= 0) return OFF;
    if (p >= 1) return { on: true, lvl: 1 }; // settled
    const frame = Math.floor(t * 150);
    if (rand(r * 100 + c + frame) > p) return OFF; // flicker off
    return { on: true, lvl: 0.55 + 0.45 * rand(r * 70 + c * 3 + frame) }; // jittery glow
  }
  return { on: true, lvl: brightness(crest, r, c) }; // BOX
}

function renderRows(cells, t, lines) {
  const crest = crestAt(t);
  for (let lr = 0; lr * 2 < ROWS + 1; lr++) {
    const topR = lr * 2 - 1;
    const botR = lr * 2;
    let line = '';
    for (let c = 0; c < COLS; c++) {
      const top = topR >= 0 ? pixelState(cells, topR, c, t, crest) : OFF;
      const bot = botR < ROWS ? pixelState(cells, botR, c, t, crest) : OFF;
      if (!top.on && !bot.on) { line += ' '; continue; }
      line += grey(Math.max(top.lvl, bot.lvl)) + halfCell(top.on, bot.on) + RESET;
    }
    lines.push(line);
  }
}

function renderFrame(cells, t, version) {
  const lines = [];
  renderRows(cells, t, lines);

  // Version fades up once the letters have formed
  const vlevel = clamp01((t - 0.7) / 0.28) * VERSION_DIM;
  lines.push(vlevel > 0.04 ? `${grey(vlevel)}v${version}${RESET}` : '');
  lines.push('');
  return { text: lines.join('\n'), lineCount: lines.length };
}

export async function bootScreen() {
  const version = readVersion();
  const out = process.stdout;
  const cells = buildCells();

  // No animation when output isn't an interactive terminal: just the final frame.
  if (!out.isTTY) {
    out.write(renderFrame(cells, 1, version).text + '\n');
    return;
  }

  const FRAMES = 45;
  const FRAME_MS = 33.33; // ~30fps
  const height = renderFrame(cells, 0, version).lineCount;

  out.write(HIDE);
  out.write('\n'.repeat(height - 1));
  try {
    for (let f = 0; f <= FRAMES; f++) {
      const t = f / FRAMES;
      const { text } = renderFrame(cells, t, version);
      out.write(`\r\x1b[${height - 1}A`);
      out.write(text.split('\n').map((l) => l + '\x1b[K').join('\n'));
      await sleep(FRAME_MS);
    }
  } finally {
    out.write(SHOW);
  }
}
