/**
 * Screen 2 - Data Center Town, one hundred years on.
 *
 * A three.js scene the reader walks around. Two boards stand side by side at
 * the end of the street: a welcome sign, and the live chart.
 *
 * The chart board is not a picture of a chart. It carries the real D3 SVG,
 * rasterised onto a canvas texture, and the pointer reaches it by raycast:
 * the hit gives a UV on the board face, UV maps to a point in the SVG's own
 * coordinate system, and the chart hit-tests that point itself. Hovering a
 * bar out here dims the others out here. The buttons on the board are real
 * buttons. There is no overlay and no second page.
 */

import * as THREE from '../../vendor/three.module.js';
import { PALETTE } from '../palette.js';
import { createBoardTexture } from './boardTexture.js';

const W = PALETTE.waste;

// Both boards stand here, facing the spawn.
const BOARD_Z = 24;
const CHART_W = 30;
const CHART_H = 16.9;   // matches the chart SVG's 1600x900
const SIGN_W = 15;
const SIGN_H = 11;

export function createWasteland(canvas, { townName, chart }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(W.sky);
  scene.fog = new THREE.Fog(W.fog, 46, 185);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
  camera.position.set(-6, 1.75, 52);

  // --- light: low, orange, long shadows -------------------------------------
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.1);
  sun.position.set(-46, 26, 34);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const d = 95;
  Object.assign(sun.shadow.camera, { left: -d, right: d, top: d, bottom: -d, near: 1, far: 240 });
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(W.sky, W.groundDark, 0.8));
  scene.add(new THREE.AmbientLight(0xffe2bd, 0.3));

  // --- ground ---------------------------------------------------------------
  const groundGeo = new THREE.PlaneGeometry(620, 620, 110, 110);
  const pos = groundGeo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i); const y = pos.getY(i);
    const flat = Math.min(1, Math.hypot(x, y) / 80);
    pos.setZ(i, (Math.sin(x * 0.045) * Math.cos(y * 0.037) * 2.6
      + Math.sin(x * 0.011 + y * 0.015) * 4.2) * flat);
  }
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(
    groundGeo,
    new THREE.MeshStandardMaterial({ color: W.ground, roughness: 1, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  function groundHeight(x, z) {
    const flat = Math.min(1, Math.hypot(x, z) / 80);
    return (Math.sin(x * 0.045) * Math.cos(z * 0.037) * 2.6
      + Math.sin(x * 0.011 + z * 0.015) * 4.2) * flat;
  }

  // --- the town -------------------------------------------------------------
  const town = new THREE.Group();
  scene.add(town);

  const concrete = new THREE.MeshStandardMaterial({ color: W.concrete, roughness: 0.94 });
  const rust = new THREE.MeshStandardMaterial({ color: W.rust, roughness: 0.98 });
  const dark = new THREE.MeshStandardMaterial({ color: W.groundDark, roughness: 1 });

  // Deterministic pseudo-random, so the town looks the same every visit.
  let seed = 20260316;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  /** A ruined server hall: a long low shed with its roof partly gone. */
  function hall(x, z, len, wide, h, rot) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(len, h, wide), concrete);
    body.position.y = h / 2;
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);

    const slabs = Math.max(3, Math.round(len / 4));
    for (let i = 0; i < slabs; i += 1) {
      if (rnd() < 0.3) continue;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(len / slabs * 0.94, 0.3, wide * 1.04), rust);
      slab.position.set(-len / 2 + (i + 0.5) * (len / slabs), h + 0.15, 0);
      slab.rotation.z = (rnd() - 0.5) * 0.05;
      slab.castShadow = true;
      g.add(slab);
    }
    for (let i = 0; i < Math.round(len / 3); i += 1) {
      const unit = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 0.6), dark);
      unit.position.set(-len / 2 + 1.6 + i * 3, 1.1, wide / 2 + 0.3);
      unit.castShadow = true;
      g.add(unit);
    }
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    return g;
  }

  /** A cooling tower: the silhouette that says "this was infrastructure". */
  function tower(x, z, h, r) {
    const shell = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.78, r, h, 26, 1, true),
      new THREE.MeshStandardMaterial({
        color: W.concrete, roughness: 0.95, side: THREE.DoubleSide,
      }));
    shell.position.set(x, h / 2, z);
    shell.castShadow = true; shell.receiveShadow = true;
    return shell;
  }

  /** A dead transmission pylon. */
  function pylon(x, z) {
    const g = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: '#6E5B46', roughness: 0.9 });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 15, 0.22), steel);
      leg.position.set(lx * 0.72, 7.5, lz * 0.72);
      leg.rotation.set(lz * 0.03, 0, -lx * 0.03);
      leg.castShadow = true;
      g.add(leg);
    });
    [5.5, 10.5, 14].forEach((y, i) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(9 - i * 2, 0.22, 0.22), steel);
      arm.position.y = y; arm.castShadow = true;
      g.add(arm);
    });
    g.position.set(x, 0, z);
    return g;
  }

  // Halls sit behind the boards, so the street frames them rather than
  // crowding them.
  [-46, -38, -30, -22, -14, -6, 2, 10].forEach((z, i) => {
    const len = 16 - i * 0.5;
    town.add(hall(-25 - rnd() * 3, z, len, 9, 4.6 + rnd() * 2.2, 0.02 - rnd() * 0.04));
    town.add(hall(25 + rnd() * 3, z, len, 9, 4.6 + rnd() * 2.2, 0.02 - rnd() * 0.04));
  });
  town.add(tower(-34, -54, 26, 9));
  town.add(tower(-10, -66, 22, 7.5));
  town.add(tower(30, -58, 29, 10));
  [-48, -22, 4].forEach((z) => town.add(pylon(-56, z)));
  [-40, -12, 14].forEach((z) => town.add(pylon(56, z)));

  for (let i = 0; i < 190; i += 1) {
    const a = rnd() * Math.PI * 2;
    const rad = 16 + rnd() * 155;
    const s = 0.25 + rnd() * 1.5;
    const junk = new THREE.Mesh(
      new THREE.BoxGeometry(s * (1 + rnd() * 2), s * 0.5, s),
      rnd() < 0.5 ? rust : dark);
    junk.position.set(Math.cos(a) * rad, s * 0.25, Math.sin(a) * rad);
    junk.rotation.set(rnd() * 0.4, rnd() * Math.PI, rnd() * 0.4);
    junk.castShadow = true;
    town.add(junk);
  }

  // --- the two boards, side by side -----------------------------------------
  function boardMesh(w, h, tex) {
    const frame = new THREE.MeshStandardMaterial({ color: '#4A3A2A', roughness: 1 });
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, 0.45),
      [frame, frame, frame, frame,
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82 }),
        new THREE.MeshStandardMaterial({ color: '#3A2D20', roughness: 1 })]);
    mesh.castShadow = true;
    return mesh;
  }

  function addLegs(x, z, width, topY, thickness) {
    [-width / 2 + 1.8, width / 2 - 1.8].forEach((dx) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(thickness, topY, thickness), rust);
      leg.position.set(x + dx, topY / 2, z - 0.15);
      leg.castShadow = true;
      town.add(leg);
    });
  }

  // Welcome sign on the left.
  const signBoard = boardMesh(SIGN_W, SIGN_H, paintedSign(
    `WELCOME TO\n${townName.toUpperCase()}\nDATA CENTER TOWN\n\nPOP. 0`,
    1024, 750, '#2B2118', W.ink));
  signBoard.position.set(-23, 9.5, BOARD_Z);
  town.add(signBoard);
  addLegs(-23, BOARD_Z, SIGN_W, 6, 0.42);

  // The chart board carries the real SVG and repaints whenever it redraws.
  const board = createBoardTexture(chart.node, chart.width, chart.height);
  chart.onRedraw(() => board.paint());

  const chartBoard = boardMesh(CHART_W, CHART_H, board.texture);
  chartBoard.position.set(2, 12.2, BOARD_Z);
  town.add(chartBoard);
  addLegs(2, BOARD_Z, CHART_W, 4.5, 0.55);

  // A header plank over the chart, so it reads as a posted notice.
  const plank = boardMesh(CHART_W, 2.4, paintedSign(
    'LOOK AT OUR STATS FROM 100 YEARS BACK', 2048, 164, '#3A2A1A', '#F6DFB8'));
  plank.position.set(2, 22, BOARD_Z - 0.04);
  town.add(plank);

  // Lamps on gooseneck arms, pointed at each board.
  [[-23, SIGN_H, 9.5], [2, CHART_H, 12.2]].forEach(([x, h, cy]) => {
    const lamp = new THREE.PointLight(0xffc98a, 8, 36, 2);
    lamp.position.set(x, cy + h / 2 + 2.6, BOARD_Z + 4.5);
    town.add(lamp);
  });

  // --- dust -----------------------------------------------------------------
  const dustCount = 900;
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i += 1) {
    dustPos[i * 3] = (rnd() - 0.5) * 250;
    dustPos[i * 3 + 1] = rnd() * 30;
    dustPos[i * 3 + 2] = (rnd() - 0.5) * 250;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0xffe0b0, size: 0.28, transparent: true, opacity: 0.5, depthWrite: false,
  }));
  scene.add(dust);

  // --- controls -------------------------------------------------------------
  // Drag to look, WASD to walk. A press that does not drag is a click into the
  // world, and the chart board is the only thing that answers.
  const look = { yaw: 0, pitch: 0.06 };
  const keys = new Set();
  let dragging = false;
  let down = null;
  let moved = false;
  let overBoard = false;

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  function setCursor(actionable) {
    canvas.style.cursor = dragging ? 'grabbing' : (actionable ? 'pointer' : 'grab');
  }

  /**
   * Raycast at the pointer and, when it lands on the chart board, convert the
   * hit's UV into a point in the chart's own pixel space and hand it over.
   */
  function probe(e, kind) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObject(chartBoard, false)[0];
    if (!hit || !hit.uv) {
      if (overBoard) { overBoard = false; chart.leave(); }
      setCursor(false);
      return false;
    }
    overBoard = true;
    // UV has its origin bottom-left; SVG has it top-left.
    const px = hit.uv.x * chart.width;
    const py = (1 - hit.uv.y) * chart.height;
    const actionable = chart.hit(px, py, kind);
    setCursor(actionable);
    return true;
  }

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; moved = false;
    down = { x: e.clientX, y: e.clientY };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    setCursor();
  });

  canvas.addEventListener('pointerup', (e) => {
    dragging = false;
    if (!moved) probe(e, 'click'); else setCursor(false);
    down = null;
  });

  canvas.addEventListener('pointermove', (e) => {
    if (dragging && down) {
      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      if (Math.hypot(dx, dy) > 4) moved = true;
      look.yaw -= dx * 0.0032;
      look.pitch = THREE.MathUtils.clamp(look.pitch - dy * 0.0028, -0.55, 0.5);
      down = { x: e.clientX, y: e.clientY };
      return;
    }
    probe(e, 'move');
  });

  canvas.addEventListener('pointerleave', () => {
    if (overBoard) { overBoard = false; chart.leave(); }
  });

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
    keys.add(e.key.toLowerCase());
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

  // --- loop -----------------------------------------------------------------
  let running = false; let prev = 0; let near = false;
  const forward = new THREE.Vector3();
  const rightV = new THREE.Vector3();
  const upV = new THREE.Vector3(0, 1, 0);

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - prev) / 1000 || 0.016);
    prev = now;

    camera.rotation.set(look.pitch, look.yaw, 0, 'YXZ');
    camera.getWorldDirection(forward);
    forward.y = 0; forward.normalize();
    rightV.crossVectors(forward, upV).normalize();

    const speed = (keys.has('shift') ? 20 : 10) * dt;
    if (keys.has('w') || keys.has('arrowup')) camera.position.addScaledVector(forward, speed);
    if (keys.has('s') || keys.has('arrowdown')) camera.position.addScaledVector(forward, -speed);
    if (keys.has('a') || keys.has('arrowleft')) camera.position.addScaledVector(rightV, -speed);
    if (keys.has('d') || keys.has('arrowright')) camera.position.addScaledVector(rightV, speed);

    const lim = 110;
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -lim, lim);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -lim, lim);
    // Do not let the walker push through the boards.
    if (camera.position.z < BOARD_Z + 4 && Math.abs(camera.position.x - 2) < 34) {
      camera.position.z = BOARD_Z + 4;
    }
    camera.position.y = groundHeight(camera.position.x, camera.position.z) + 1.75;

    // Discoverability (§4): the hint appears as the board comes within reach,
    // so the reader learns it is live before they try to touch it.
    const dist = camera.position.distanceTo(chartBoard.position);
    const nowNear = dist < 46;
    if (nowNear !== near) {
      near = nowNear;
      canvas.dispatchEvent(new CustomEvent('billboard-proximity', { detail: { near } }));
    }

    const dp = dust.geometry.attributes.position;
    for (let i = 0; i < dustCount; i += 1) {
      const y = dp.getY(i) - dt * (0.4 + (i % 7) * 0.12);
      dp.setY(i, y < 0 ? 30 : y);
    }
    dp.needsUpdate = true;

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / Math.max(1, r.height);
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  return {
    start() {
      if (running) return;
      running = true; prev = performance.now();
      resize();
      board.paint();
      setCursor(false);
      requestAnimationFrame(frame);
    },
    stop() { running = false; },
    resize,
    /** Walk the reader to a spot where the chart is legible and reachable. */
    goToBoard() {
      camera.position.set(2, 1.75, BOARD_Z + 27);
      look.yaw = 0; look.pitch = 0.3;
    },
  };
}

/**
 * A painted sign. Text goes onto a canvas and is used as a texture, which
 * keeps the lettering crisp and lets it weather with the rest of the world.
 */
function paintedSign(text, pxW, pxH, bg, fg) {
  const c = document.createElement('canvas');
  c.width = pxW; c.height = pxH;
  const ctx = c.getContext('2d');

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, c.width, c.height);

  for (let i = 0; i < 220; i += 1) {
    ctx.fillStyle = `rgba(${90 + Math.random() * 70},${60 + Math.random() * 40},${30 + Math.random() * 30},${Math.random() * 0.1})`;
    ctx.beginPath();
    ctx.arc(Math.random() * c.width, Math.random() * c.height, Math.random() * 70 + 6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = fg;
  ctx.lineWidth = Math.max(4, pxH / 90);
  ctx.strokeRect(18, 18, c.width - 36, c.height - 36);

  const lines = text.split('\n');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Fit to the narrower of the two constraints, measuring the real glyphs.
  // Sizing off the canvas width alone ran the long header plank off both ends.
  const inner = c.width - 90;
  let size = (c.height * 0.76) / Math.max(1, lines.length * 1.25);
  ctx.font = `700 ${size}px "Courier New", monospace`;
  const widest = Math.max(...lines.map((ln) => ctx.measureText(ln).width || 1));
  if (widest > inner) size *= inner / widest;

  ctx.fillStyle = fg;
  ctx.font = `700 ${size}px "Courier New", monospace`;
  const lead = size * 1.25;
  const y0 = c.height / 2 - ((lines.length - 1) * lead) / 2;
  lines.forEach((ln, i) => ctx.fillText(ln, c.width / 2, y0 + i * lead));

  for (let i = 0; i < 70; i += 1) {
    ctx.strokeStyle = `rgba(0,0,0,${Math.random() * 0.1})`;
    ctx.lineWidth = Math.random() * 2.5;
    ctx.beginPath();
    const x = Math.random() * c.width; const y = Math.random() * c.height;
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 140, y + (Math.random() - 0.5) * 40);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
