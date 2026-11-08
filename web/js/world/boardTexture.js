/**
 * Paints a live SVG onto a canvas so three.js can hang it on a billboard.
 *
 * The chart stays a real D3/SVG chart. This only rasterises it: serialise the
 * element, decode it as an image, draw it onto a 2D canvas, and mark the
 * texture dirty. Every interaction redraws the SVG, which repaints here, so
 * what is on the board is always the current chart and never a snapshot.
 *
 * Two things that bite:
 *  - External CSS does not survive serialisation, which is why the chart sets
 *    every visual property as a presentation attribute.
 *  - Repaints can be requested faster than they complete (a hover fires on
 *    every frame). So a repaint in flight sets a dirty flag instead of
 *    queueing, and exactly one more repaint runs when it lands.
 */

import * as THREE from '../../vendor/three.module.js';

export function createBoardTexture(svgNode, width, height, { weather = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;

  // A hundred years of sun, baked once and composited over every repaint.
  const grime = weather ? makeGrime(width, height) : null;

  let painting = false;
  let dirty = false;

  async function paint() {
    if (painting) { dirty = true; return; }
    painting = true;
    try {
      const svg = new XMLSerializer().serializeToString(svgNode);
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
      const img = new Image();
      img.src = url;
      try {
        await img.decode();
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        if (grime) ctx.drawImage(grime, 0, 0, width, height);
        texture.needsUpdate = true;
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      // A failed repaint leaves the previous frame on the board, which is
      // better than a blank one. Surface it rather than swallowing it.
      console.warn('board repaint failed', err);
    } finally {
      painting = false;
      if (dirty) { dirty = false; paint(); }
    }
  }

  return { texture, canvas, paint };
}

/** Streaks, blotches and a vignette, on their own transparent layer. */
function makeGrime(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');

  let seed = 90210;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  for (let i = 0; i < 150; i += 1) {
    g.fillStyle = `rgba(${120 + rnd() * 70},${80 + rnd() * 40},${40 + rnd() * 30},${rnd() * 0.07})`;
    g.beginPath();
    g.arc(rnd() * w, rnd() * h, rnd() * 160 + 20, 0, Math.PI * 2);
    g.fill();
  }

  // Rain streaks down the face.
  for (let i = 0; i < 70; i += 1) {
    const x = rnd() * w;
    g.strokeStyle = `rgba(30,18,8,${rnd() * 0.09})`;
    g.lineWidth = rnd() * 7 + 1;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + (rnd() - 0.5) * 24, h * (0.35 + rnd() * 0.65));
    g.stroke();
  }

  const vignette = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.95);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(18,10,4,0.42)');
  g.fillStyle = vignette;
  g.fillRect(0, 0, w, h);

  return c;
}
