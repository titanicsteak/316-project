/**
 * Screen machine and the jump between them.
 *
 * Screen 1 is the start screen: the map, and a button. Screen 2 is the world,
 * where the second chart is read on a billboard rather than in an overlay.
 * The chart is built before the world, because the world is named after
 * whoever wins it and the board needs the SVG to paint.
 */

import { checkContrast } from './palette.js';
import { renderMap } from './viz/map.js';
import { createBoardChart, leadingCompany } from './viz/companies.js';
import { createWasteland } from './world/wasteland.js';

const el = (id) => document.getElementById(id);

const screens = {
  present: el('screen-present'),
  future: el('screen-future'),
};

let world = null;

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
  el('btn-goto').addEventListener('click', () => world?.goToBoard());
}

async function goFuture(leader) {
  // Build the chart and the world before the warp finishes, so the board is
  // already painted when the reader arrives.
  const building = buildWorld(leader);
  await runWarp();
  await building;

  screens.present.classList.remove('is-active');
  screens.future.classList.add('is-active');
  world.resize();
  world.start();
}

async function buildWorld(leader) {
  if (world) return;
  const chart = await createBoardChart();
  el('board-source').appendChild(chart.node);

  const canvas = el('world');
  world = createWasteland(canvas, { townName: leader.company, chart });
  canvas.addEventListener('billboard-proximity', (e) => {
    el('billboard-prompt').hidden = !e.detail.near;
  });
}

function goPresent() {
  world?.stop();
  screens.future.classList.remove('is-active');
  screens.present.classList.add('is-active');
  window.scrollTo({ top: 0 });
}

/**
 * The hundred-year transition. A canvas of streaking dust while the year
 * counter runs 2026 -> 2126, and the sky warms into the wasteland palette.
 */
function runWarp() {
  return new Promise((resolve) => {
    const warp = el('warp');
    const canvas = el('warp-canvas');
    const yearEl = el('warp-year');
    const ctx = canvas.getContext('2d');

    const DURATION = 2600;
    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;

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
