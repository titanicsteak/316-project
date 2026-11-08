/**
 * Screen machine and the jump between them.
 *
 * Two screens, one selection store, one palette. The map is rendered up front;
 * the wasteland and the billboard chart are built lazily the first time the
 * reader crosses over, so screen 1 is not paying for three.js it may never use.
 */

import { checkContrast } from './palette.js';
import { renderMap } from './viz/map.js';
import { renderCompanies, leadingCompany } from './viz/companies.js';
import { createWasteland } from './world/wasteland.js';

const el = (id) => document.getElementById(id);

const screens = {
  present: el('screen-present'),
  future: el('screen-future'),
};

let world = null;
let companiesReady = false;

init();

async function init() {
  // Logged rather than asserted: a failing pair should be visible in the
  // console at the Judge step, not swallowed.
  console.table(checkContrast());

  await renderMap(el('map-root'));

  const leader = await leadingCompany();
  el('hud-place').textContent = `${leader.company} Data Center Town`;

  el('btn-leap').addEventListener('click', () => goFuture(leader));
  el('btn-back').addEventListener('click', goPresent);
  el('btn-goto').addEventListener('click', () => world?.goToBillboard());
  el('board-close').addEventListener('click', closeBoard);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el('board-overlay').hidden) closeBoard();
  });
}

// --- the jump ---------------------------------------------------------------

async function goFuture(leader) {
  await runWarp();

  screens.present.classList.remove('is-active');
  screens.future.classList.add('is-active');

  if (!world) {
    const canvas = el('world');
    world = createWasteland(canvas, {
      townName: leader.company,
      onBillboard: openBoard,
    });
    canvas.addEventListener('billboard-proximity', (e) => {
      el('billboard-prompt').hidden = !e.detail.near;
    });
  }
  world.resize();
  world.start();
}

function goPresent() {
  world?.stop();
  closeBoard();
  screens.future.classList.remove('is-active');
  screens.present.classList.add('is-active');
  window.scrollTo({ top: 0 });
}

/**
 * The hundred-year transition. A canvas of streaking dust while the year
 * counter runs 2026 -> 2126, then the sky warms into the wasteland palette.
 */
function runWarp() {
  return new Promise((resolve) => {
    const warp = el('warp');
    const canvas = el('warp-canvas');
    const yearEl = el('warp-year');
    const ctx = canvas.getContext('2d');

    const DURATION = 2600;
    const dpr = Math.min(window.devicePixelRatio, 2);
    function size() {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    }
    size();

    const streaks = Array.from({ length: 420 }, () => ({
      a: Math.random() * Math.PI * 2,
      r: Math.random() * 60,
      v: 2 + Math.random() * 11,
      w: 0.6 + Math.random() * 2.4,
    }));

    warp.classList.add('is-on');
    const t0 = performance.now();

    function tick(now) {
      const p = Math.min(1, (now - t0) / DURATION);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // Sky warms from the present-day near-black to the wasteland orange.
      const warm = d3.interpolateRgb('#0E1116', '#C8783C')(d3.easeCubicIn(p));
      ctx.fillStyle = warm;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = `rgba(255,214,160,${0.1 + 0.6 * Math.sin(p * Math.PI)})`;
      streaks.forEach((s) => {
        s.r += s.v * (1 + p * 9);
        if (s.r > Math.hypot(cx, cy)) { s.r = 0; s.a = Math.random() * Math.PI * 2; }
        const x1 = cx + Math.cos(s.a) * s.r;
        const y1 = cy + Math.sin(s.a) * s.r;
        const len = 14 + p * 190;
        ctx.lineWidth = s.w * dpr;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(cx + Math.cos(s.a) * (s.r + len), cy + Math.sin(s.a) * (s.r + len));
        ctx.stroke();
      });

      yearEl.textContent = Math.round(2026 + 100 * d3.easeCubicInOut(p));
      yearEl.style.opacity = p < 0.9 ? 1 : (1 - p) * 10;

      if (p < 1) { requestAnimationFrame(tick); return; }
      warp.classList.remove('is-on');
      resolve();
    }
    requestAnimationFrame(tick);
  });
}

// --- the billboard ----------------------------------------------------------

async function openBoard() {
  const overlay = el('board-overlay');
  if (!companiesReady) {
    await renderCompanies(el('companies-root'), { theme: 'waste' });
    companiesReady = true;
  }
  overlay.hidden = false;
  requestAnimationFrame(() => overlay.classList.add('is-on'));
  el('board-close').focus();
}

function closeBoard() {
  const overlay = el('board-overlay');
  overlay.classList.remove('is-on');
  setTimeout(() => { overlay.hidden = true; }, 220);
}
