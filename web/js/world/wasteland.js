/**
 * Screen 2 - Data Center Town, one hundred years on.
 *
 * A three.js scene the reader walks around. It is scenery, not a chart: nothing
 * here encodes data except the billboard, and the billboard opens the real D3
 * view rather than trying to be one in 3D. Keeping the quantitative work in SVG
 * is deliberate - a chart painted onto a tilted plane in perspective breaks
 * every length comparison the bar chart depends on.
 *
 * The town is named after whoever wins Viz 2, read from the data at load time,
 * so the world is downstream of the chart rather than hardcoded.
 */

import * as THREE from '../../vendor/three.module.js';
import { PALETTE } from '../palette.js';

const W = PALETTE.waste;

export function createWasteland(canvas, { townName, onBillboard }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(W.sky);
  scene.fog = new THREE.Fog(W.fog, 34, 165);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);
  camera.position.set(0, 1.7, 46);

  // --- light: low, orange, long shadows -------------------------------------
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.1);
  sun.position.set(-46, 24, -34);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const d = 90;
  Object.assign(sun.shadow.camera, { left: -d, right: d, top: d, bottom: -d, near: 1, far: 220 });
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(W.sky, W.groundDark, 0.75));
  scene.add(new THREE.AmbientLight(0xffe2bd, 0.28));

  // --- ground ---------------------------------------------------------------
  const groundGeo = new THREE.PlaneGeometry(620, 620, 110, 110);
  const pos = groundGeo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i); const y = pos.getY(i);
    // Low rolling dunes, flattened near the middle so the town sits level.
    const flat = Math.min(1, Math.hypot(x, y) / 70);
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

    // Roof in slabs, some missing.
    const slabs = Math.max(3, Math.round(len / 4));
    for (let i = 0; i < slabs; i += 1) {
      if (rnd() < 0.3) continue;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(len / slabs * 0.94, 0.3, wide * 1.04), rust);
      slab.position.set(-len / 2 + (i + 0.5) * (len / slabs), h + 0.15, 0);
      slab.rotation.z = (rnd() - 0.5) * 0.05;
      slab.castShadow = true;
      g.add(slab);
    }
    // Cooling units on the long wall.
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

  /** A cooling tower, the silhouette that says "this was infrastructure". */
  function tower(x, z, h, r) {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.78, r, h, 26, 1, true),
      new THREE.MeshStandardMaterial({ color: W.concrete, roughness: 0.95, side: THREE.DoubleSide }));
    shell.position.y = h / 2;
    shell.castShadow = true; shell.receiveShadow = true;
    g.add(shell);
    g.position.set(x, 0, z);
    return g;
  }

  /** A dead transmission pylon. */
  function pylon(x, z) {
    const g = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: '#6E5B46', roughness: 0.9 });
    [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 15, 0.22), steel);
      leg.position.set(lx * 0.55, 7.5, lz * 0.55);
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

  // Main street: halls down both sides, narrowing toward the billboard.
  const layout = [-34, -26, -18, -10, -2, 6, 14, 22];
  layout.forEach((z, i) => {
    const len = 16 - i * 0.6;
    town.add(hall(-15 - rnd() * 3, z, len, 9, 4.6 + rnd() * 2.2, 0.02 - rnd() * 0.04));
    town.add(hall(15 + rnd() * 3, z, len, 9, 4.6 + rnd() * 2.2, 0.02 - rnd() * 0.04));
  });
  town.add(tower(-30, -42, 26, 9));
  town.add(tower(-12, -56, 22, 7.5));
  town.add(tower(26, -48, 29, 10));
  [-40, -14, 12, 34].forEach((z) => town.add(pylon(-46, z)));
  [-30, -4, 24].forEach((z) => town.add(pylon(46, z)));

  // Scrap, so the ground is not empty.
  for (let i = 0; i < 180; i += 1) {
    const a = rnd() * Math.PI * 2;
    const rad = 12 + rnd() * 150;
    const s = 0.25 + rnd() * 1.5;
    const junk = new THREE.Mesh(
      new THREE.BoxGeometry(s * (1 + rnd() * 2), s * 0.5, s),
      rnd() < 0.5 ? rust : dark);
    junk.position.set(Math.cos(a) * rad, s * 0.25, Math.sin(a) * rad);
    junk.rotation.set(rnd() * 0.4, rnd() * Math.PI, rnd() * 0.4);
    junk.castShadow = true;
    town.add(junk);
  }

  // --- the town sign --------------------------------------------------------
  const sign = makeSignboard(
    `WELCOME TO\n${townName.toUpperCase()}\nDATA CENTER TOWN`,
    14, 7, '#2B2118', W.ink);
  sign.position.set(0, 5.6, 30);
  town.add(sign);
  const signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 5.6), rust);
  signPost.position.set(0, 2.8, 30.2); signPost.castShadow = true;
  town.add(signPost);

  // --- the billboard: the thing you came here to read -----------------------
  const billboard = new THREE.Group();
  const boardFace = makeSignboard(
    'LOOK AT OUR STATS\nFROM 100 YEARS BACK\n\nSee how much progress\nwe were making\n\n[ CLICK TO READ ]',
    22, 11, '#1C1510', '#F4D9A8');
  boardFace.position.y = 9.5;
  billboard.add(boardFace);
  [-8, 8].forEach((x) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 9.5, 0.5), rust);
    leg.position.set(x, 4.75, 0); leg.castShadow = true;
    billboard.add(leg);
  });
  const lamp = new THREE.PointLight(0xffc46b, 9, 30, 2);
  lamp.position.set(0, 16.5, 4);
  billboard.add(lamp);
  billboard.position.set(0, 0, -34);
  billboard.userData.isBillboard = true;
  boardFace.userData.isBillboard = true;
  town.add(billboard);

  // --- dust -----------------------------------------------------------------
  const dustCount = 900;
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i += 1) {
    dustPos[i * 3] = (rnd() - 0.5) * 240;
    dustPos[i * 3 + 1] = rnd() * 28;
    dustPos[i * 3 + 2] = (rnd() - 0.5) * 240;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0xffe0b0, size: 0.28, transparent: true, opacity: 0.5, depthWrite: false,
  }));
  scene.add(dust);

  // --- controls: drag to look, WASD or arrows to walk -----------------------
  const look = { yaw: 0, pitch: -0.04 };
  const keys = new Set();
  let dragging = false; let last = null;

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; last = { x: e.clientX, y: e.clientY };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointerup', (e) => {
    dragging = false; canvas.style.cursor = 'grab';
    // A click that did not drag is a click on the world.
    if (last && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 5) pick(e);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging || !last) return;
    look.yaw -= (e.clientX - last.x) * 0.0032;
    look.pitch = THREE.MathUtils.clamp(
      look.pitch - (e.clientY - last.y) * 0.0028, -0.6, 0.45);
    last = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
    keys.add(e.key.toLowerCase());
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

  const raycaster = new THREE.Raycaster();
  function pick(e) {
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects([boardFace], false)[0];
    if (hit) onBillboard();
  }

  function groundHeight(x, z) {
    const flat = Math.min(1, Math.hypot(x, z) / 70);
    return (Math.sin(x * 0.045) * Math.cos(z * 0.037) * 2.6
      + Math.sin(x * 0.011 + z * 0.015) * 4.2) * flat;
  }

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

    const speed = (keys.has('shift') ? 22 : 11) * dt;
    if (keys.has('w') || keys.has('arrowup')) camera.position.addScaledVector(forward, speed);
    if (keys.has('s') || keys.has('arrowdown')) camera.position.addScaledVector(forward, -speed);
    if (keys.has('a') || keys.has('arrowleft')) camera.position.addScaledVector(rightV, -speed);
    if (keys.has('d') || keys.has('arrowright')) camera.position.addScaledVector(rightV, speed);

    // Keep the walker inside the valley.
    const lim = 110;
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -lim, lim);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -lim, lim);
    camera.position.y = groundHeight(camera.position.x, camera.position.z) + 1.75;

    // Discoverability (§4): the prompt appears as you get close, so the reader
    // learns the billboard is clickable before they try it.
    const dist = camera.position.distanceTo(billboard.position);
    const nowNear = dist < 52;
    if (nowNear !== near) {
      near = nowNear;
      canvas.dispatchEvent(new CustomEvent('billboard-proximity', { detail: { near } }));
    }

    dust.rotation.y += dt * 0.012;
    const dp = dust.geometry.attributes.position;
    for (let i = 0; i < dustCount; i += 1) {
      const y = dp.getY(i) - dt * (0.4 + (i % 7) * 0.12);
      dp.setY(i, y < 0 ? 28 : y);
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
      canvas.style.cursor = 'grab';
      requestAnimationFrame(frame);
    },
    stop() { running = false; },
    resize,
    /** Walk the camera to the billboard, used by the "take me there" button. */
    goToBillboard() {
      // The billboard sits at z = -34 and a camera with yaw 0 looks down -z,
      // so stand just short of it and keep yaw at 0. Turning to PI showed the
      // blank back of the board.
      camera.position.set(0, 1.75, -2);
      look.yaw = 0; look.pitch = 0.20;
    },
  };
}

/**
 * A painted sign. Text is drawn to a canvas and used as a texture, which keeps
 * the lettering crisp and lets it be weathered the same way as the world.
 */
function makeSignboard(text, w, h, bg, fg) {
  const px = 1024;
  const c = document.createElement('canvas');
  c.width = px; c.height = Math.round(px * (h / w));
  const ctx = c.getContext('2d');

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, c.width, c.height);

  // Weathering: blotches, then scratches.
  for (let i = 0; i < 260; i += 1) {
    ctx.fillStyle = `rgba(${90 + Math.random() * 70},${60 + Math.random() * 40},${30 + Math.random() * 30},${Math.random() * 0.12})`;
    const r = Math.random() * 70 + 6;
    ctx.beginPath();
    ctx.arc(Math.random() * c.width, Math.random() * c.height, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = fg;
  ctx.lineWidth = 8;
  ctx.strokeRect(22, 22, c.width - 44, c.height - 44);

  const lines = text.split('\n');
  const size = Math.min(c.width / 16, (c.height * 0.72) / lines.length);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${size}px "Courier New", monospace`;
  const lead = size * 1.25;
  const y0 = c.height / 2 - ((lines.length - 1) * lead) / 2;
  lines.forEach((ln, i) => ctx.fillText(ln, c.width / 2, y0 + i * lead));

  for (let i = 0; i < 90; i += 1) {
    ctx.strokeStyle = `rgba(0,0,0,${Math.random() * 0.12})`;
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

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, 0.4),
    [
      new THREE.MeshStandardMaterial({ color: '#4A3A2A', roughness: 1 }),
      new THREE.MeshStandardMaterial({ color: '#4A3A2A', roughness: 1 }),
      new THREE.MeshStandardMaterial({ color: '#4A3A2A', roughness: 1 }),
      new THREE.MeshStandardMaterial({ color: '#4A3A2A', roughness: 1 }),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }),
      new THREE.MeshStandardMaterial({ color: '#3A2D20', roughness: 1 }),
    ]);
  mesh.castShadow = true;
  return mesh;
}
