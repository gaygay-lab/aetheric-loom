import * as THREE from './three.module.js';

const canvas = document.querySelector('#world');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050713);
scene.fog = new THREE.FogExp2(0x070b20, 0.0054);
const camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 6, 34);

const clock = new THREE.Clock();
const root = new THREE.Group();
scene.add(root);
const loom = new THREE.Group();
loom.position.y = 12;
root.add(loom);
const observatory = new THREE.Group();
root.add(observatory);
const orbiters = [];
const ribbons = [];
const stars = [];
const keys = new Set();

const palette = {
  ink: 0x07102e,
  cyan: 0x68e9ff,
  electric: 0x88a6ff,
  violet: 0x9a7dff,
  gold: 0xffd38a,
  coral: 0xff917e,
  white: 0xe7f6ff,
};

const chapters = [
  { title: '观象台苏醒', kicker: 'CHAPTER 01 / AWAKENING', description: '在第一束光抵达之前，一只野狗守着平台边缘，星尘把沉默织成了环。', start: 0, end: 36 },
  { title: '流光经过', kicker: 'CHAPTER 02 / DRIFTING LIGHT', description: '一道道光带从观象台的边缘穿过，把时间拉成了有厚度的丝。', start: 36, end: 72 },
  { title: '织机之心', kicker: 'CHAPTER 03 / THE LOOM', description: '晶体核心开始自转，所有轨道都朝向同一个不可见的中心。', start: 72, end: 108 },
  { title: '月背的回声', kicker: 'CHAPTER 04 / FAR SIDE', description: '越过织机的背面，月亮露出没有被照亮的那一半。', start: 108, end: 144 },
  { title: '回到无边之夜', kicker: 'CHAPTER 05 / AFTERGLOW', description: '最后一圈光环松开，观象台仍在远处替你保留一盏灯。', start: 144, end: 180 },
];

const state = { mode: 'film', playing: true, time: 0, speed: 1, quality: 1, uiHidden: false, yaw: 0, pitch: -0.12, freeSpeed: 0.18 };
let hound;
const filmPositions = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 6, 38), new THREE.Vector3(25, 11, 27), new THREE.Vector3(34, 20, -2),
  new THREE.Vector3(18, 9, -34), new THREE.Vector3(-17, 25, -37), new THREE.Vector3(-39, 10, -3),
  new THREE.Vector3(-28, 6, 28), new THREE.Vector3(0, 16, 42), new THREE.Vector3(30, 33, 14)
], false, 'catmullrom', .58);
const filmTargets = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 9, 0), new THREE.Vector3(0, 11, 0), new THREE.Vector3(2, 12, -1),
  new THREE.Vector3(-2, 14, 0), new THREE.Vector3(-5, 15, -2), new THREE.Vector3(1, 10, 1),
  new THREE.Vector3(0, 12, 0), new THREE.Vector3(0, 10, 0), new THREE.Vector3(4, 16, -3)
], false, 'catmullrom', .62);

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d'); const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.09, 'rgba(196,244,255,.95)'); g.addColorStop(.26, 'rgba(103,205,255,.36)'); g.addColorStop(1, 'rgba(80,130,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}
const sprite = glowTexture();

function mat(color, emissive = color, intensity = 0.7, roughness = .34, metalness = .32) {
  return new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: intensity, roughness, metalness });
}

function addStars() {
  const count = 9200; const positions = new Float32Array(count * 3); const colors = new Float32Array(count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const r = 110 + Math.pow(Math.random(), .46) * 310; const theta = Math.random() * Math.PI * 2; const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
    positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    positions[i * 3 + 1] = Math.cos(phi) * r * .8 + 30;
    positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
    const hue = Math.random() < .72 ? THREE.MathUtils.randFloat(.54, .68) : THREE.MathUtils.randFloat(.08, .15);
    color.setHSL(hue, THREE.MathUtils.randFloat(.45, .9), THREE.MathUtils.randFloat(.55, .9));
    colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ size: .42, map: sprite, transparent: true, opacity: .8, vertexColors: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  points.name = 'deep-starfield'; root.add(points); stars.push(points);

  const mistCount = 2200; const p = new Float32Array(mistCount * 3); const c = new Float32Array(mistCount * 3);
  for (let i = 0; i < mistCount; i++) {
    const a = Math.random() * Math.PI * 2; const r = 16 + Math.random() * 46;
    p[i * 3] = Math.cos(a) * r; p[i * 3 + 1] = -2 + Math.random() * 35; p[i * 3 + 2] = Math.sin(a) * r;
    color.setHSL(Math.random() < .55 ? .57 : .72, .7, .62); c[i * 3] = color.r; c[i * 3 + 1] = color.g; c[i * 3 + 2] = color.b;
  }
  const fogGeo = new THREE.BufferGeometry(); fogGeo.setAttribute('position', new THREE.BufferAttribute(p, 3)); fogGeo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  const fog = new THREE.Points(fogGeo, new THREE.PointsMaterial({ size: 1.1, map: sprite, transparent: true, opacity: .13, vertexColors: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  fog.name = 'low-nebula'; root.add(fog); stars.push(fog);
}

function makeTube(points, color, radius, opacity = 1) {
  const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal');
  const geo = new THREE.TubeGeometry(curve, 180, radius, 8, true);
  const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6, metalness: .2, roughness: .22, transparent: opacity < 1, opacity });
  const mesh = new THREE.Mesh(geo, material); loom.add(mesh); ribbons.push(mesh); return mesh;
}

function makeRing(radius, tube, color, tilt, y = 0) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 12, 160), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.3, metalness: .65, roughness: .2 }));
  mesh.rotation.set(tilt.x, tilt.y, tilt.z); mesh.position.y = y; loom.add(mesh); return mesh;
}

function buildLoom() {
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(4.45, 3), new THREE.MeshPhysicalMaterial({ color: 0x9fbdff, emissive: 0x514cff, emissiveIntensity: 1.2, metalness: .15, roughness: .1, transmission: .18, thickness: 1.4, clearcoat: 1, clearcoatRoughness: .12 }));
  core.name = 'crystal-heart'; loom.add(core);
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(5.2, 2), new THREE.MeshBasicMaterial({ color: palette.cyan, wireframe: true, transparent: true, opacity: .25, blending: THREE.AdditiveBlending })); loom.add(shell);
  makeRing(7.1, .08, palette.cyan, { x: .45, y: -.2, z: .22 });
  makeRing(9.6, .065, palette.violet, { x: 1.15, y: .28, z: -.42 });
  makeRing(12.8, .05, palette.gold, { x: .12, y: .9, z: .12 });
  makeRing(15.4, .035, palette.electric, { x: -.55, y: -.36, z: .4 });
  for (let band = 0; band < 4; band++) {
    const pts = []; const radius = 7.6 + band * 2.0; const height = 1.25 + band * .42;
    for (let i = 0; i < 18; i++) { const t = i / 18 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(t) * radius, Math.sin(t * 2 + band) * height, Math.sin(t) * radius)); }
    makeTube(pts, [palette.cyan, palette.violet, palette.gold, palette.coral][band], .045 + band * .012, .86);
  }
  const shardMat = mat(palette.gold, palette.gold, 1.35, .22, .4);
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2; const r = 7.3 + (i % 3) * 1.1;
    const shard = new THREE.Mesh(new THREE.ConeGeometry(.22 + (i % 4) * .08, 1.6 + (i % 5) * .4, 5), i % 4 === 0 ? shardMat : mat(palette.cyan, palette.cyan, 1.4, .25, .5));
    shard.position.set(Math.cos(a) * r, Math.sin(a * 3) * 2.6, Math.sin(a) * r); shard.rotation.set(Math.random() * 2, a, Math.random() * 2); loom.add(shard); orbiters.push({ object: shard, radius: r, angle: a, speed: .12 + (i % 3) * .03, lift: 2.5, phase: i });
  }
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2; const body = new THREE.Mesh(new THREE.SphereGeometry(.36 + (i % 3) * .13, 18, 14), mat(i % 3 === 0 ? palette.coral : palette.white, i % 3 === 0 ? palette.coral : palette.cyan, 2.1, .18, .6));
    body.position.set(Math.cos(a) * (10.5 + (i % 2) * 2.2), Math.sin(a * 2) * 1.8, Math.sin(a) * (10.5 + (i % 2) * 2.2)); loom.add(body); orbiters.push({ object: body, radius: body.position.length(), angle: a, speed: .18 + i * .008, lift: 1.8, phase: i * .7 });
  }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprite, color: palette.violet, transparent: true, opacity: .18, blending: THREE.AdditiveBlending, depthWrite: false })); halo.scale.set(28, 28, 1); halo.position.z = -1; loom.add(halo);
}

function buildObservatory() {
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(20, 24, 1.2, 96), new THREE.MeshStandardMaterial({ color: 0x0c1639, metalness: .8, roughness: .28, emissive: 0x07102c, emissiveIntensity: .5 })); floor.position.y = -4.6; observatory.add(floor);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(21.7, .24, 10, 160), new THREE.MeshStandardMaterial({ color: palette.cyan, emissive: palette.cyan, emissiveIntensity: 2.6, metalness: .75, roughness: .2 })); rim.position.y = -4; observatory.add(rim);
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2; const spoke = new THREE.Mesh(new THREE.BoxGeometry(.07, .22, 19), new THREE.MeshStandardMaterial({ color: i % 3 ? palette.electric : palette.gold, emissive: i % 3 ? palette.electric : palette.gold, emissiveIntensity: 1.8, metalness: .8, roughness: .25 }));
    spoke.position.set(Math.cos(a) * 9.5, -3.95, Math.sin(a) * 9.5); spoke.rotation.y = -a; observatory.add(spoke);
  }
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 6, 5, 64), new THREE.MeshStandardMaterial({ color: 0x101d4e, metalness: .82, roughness: .21, emissive: 0x111b54, emissiveIntensity: .6 })); pedestal.position.y = -2; observatory.add(pedestal);
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 6.5, .35, 64), new THREE.MeshStandardMaterial({ color: 0x1b2d68, metalness: .68, roughness: .2, emissive: 0x1b2f6b, emissiveIntensity: .5 })); platform.position.y = .65; observatory.add(platform);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2; const obelisk = new THREE.Mesh(new THREE.ConeGeometry(.5, 4.2 + (i % 3) * 1.5, 4), mat(i % 2 ? palette.electric : palette.gold, i % 2 ? palette.electric : palette.gold, 1.2, .26, .72));
    obelisk.position.set(Math.cos(a) * (12 + (i % 2) * 4), -1.6 + (i % 3) * .2, Math.sin(a) * (12 + (i % 2) * 4)); obelisk.rotation.y = a; observatory.add(obelisk);
  }
  const moon = new THREE.Mesh(new THREE.SphereGeometry(5.7, 64, 32), new THREE.MeshStandardMaterial({ color: 0xb9c4e1, roughness: .78, metalness: .04, emissive: 0x192044, emissiveIntensity: .16 })); moon.position.set(-34, 28, -58); root.add(moon);
  const moonRing = new THREE.Mesh(new THREE.TorusGeometry(8.3, .12, 10, 128), new THREE.MeshBasicMaterial({ color: palette.gold, transparent: true, opacity: .72 })); moonRing.position.copy(moon.position); moonRing.rotation.set(.5, -.35, .2); root.add(moonRing);
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprite, color: 0xa8c2ff, transparent: true, opacity: .16, blending: THREE.AdditiveBlending, depthWrite: false })); moonGlow.scale.set(22,22,1); moonGlow.position.copy(moon.position); root.add(moonGlow);
}

function buildHound() {
  hound = new THREE.Group(); hound.name = 'wild-hound-guardian'; hound.position.set(-10.5, .95, 5.4); hound.rotation.y = -.32; root.add(hound);
  const fur = mat(0x8b563d, 0x3e1f2b, .18, .82, .06); const darkFur = mat(0x39202a, 0x170f1b, .1, .9, .03); const warm = mat(0xc98252, 0x3e1b25, .28, .72, .08); const eye = mat(0xffc66e, 0xff7c47, 2.9, .18, .15);
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.45, 28, 18), fur); body.scale.set(1.46, .75, .78); body.position.set(0, 1.35, 0); hound.add(body);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(1.05, 24, 16), warm); chest.scale.set(.9, 1.08, .84); chest.position.set(.95, 1.42, -.05); hound.add(chest);
  const neck = new THREE.Mesh(new THREE.SphereGeometry(.75, 24, 16), fur); neck.scale.set(.8, 1.15, .72); neck.position.set(1.15, 2.03, -.02); neck.rotation.z = -.18; hound.add(neck);
  const head = new THREE.Group(); head.position.set(1.65, 2.72, -.08); head.rotation.z = -.09; hound.add(head); hound.userData.head = head;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(.76, 24, 16), fur); skull.scale.set(1.06, .9, .84); head.add(skull);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(.42, 20, 14), warm); muzzle.scale.set(1.25, .66, .75); muzzle.position.set(.55, -.17, -.06); head.add(muzzle);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(.17, 16, 10), darkFur); nose.scale.set(1.2, .75, .9); nose.position.set(.99, -.13, -.06); head.add(nose);
  for (const z of [-.36, .36]) { const e = new THREE.Mesh(new THREE.ConeGeometry(.34, 1.05, 5), darkFur); e.position.set(-.05, .64, z); e.rotation.set(z * .45, 0, z * .2); head.add(e); }
  for (const z of [-.34, .34]) { const eyeMesh = new THREE.Mesh(new THREE.SphereGeometry(.09, 12, 8), eye); eyeMesh.position.set(.49, .13, z); head.add(eyeMesh); }
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(.23, 16, 10), darkFur); jaw.scale.set(1.45, .42, .68); jaw.position.set(.55, -.4, -.06); head.add(jaw);
  const legs = [];
  for (const [x, z, lean] of [[-.76,-.46,-.08],[-.76,.46,-.1],[.82,-.46,.08],[.82,.46,.1]]) { const leg = new THREE.Group(); leg.position.set(x, .77, z); leg.rotation.z = lean; const upper = new THREE.Mesh(new THREE.CylinderGeometry(.22, .29, 1.25, 12), fur); upper.position.y = -.48; leg.add(upper); const paw = new THREE.Mesh(new THREE.SphereGeometry(.27, 16, 10), darkFur); paw.scale.set(1.25, .43, .95); paw.position.set(.1, -1.12, 0); leg.add(paw); hound.add(leg); legs.push(leg); }
  const tailCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-1.3, 1.65, 0), new THREE.Vector3(-2.15, 2.2, .02), new THREE.Vector3(-2.9, 2.9, .1), new THREE.Vector3(-3.28, 2.32, .12)]);
  const tail = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 32, .2, 10, false), fur); hound.add(tail); hound.userData.tail = tail;
  for (let i = 0; i < 8; i++) { const tuft = new THREE.Mesh(new THREE.ConeGeometry(.16 - i * .009, .58 - i * .025, 5), i % 2 ? fur : warm); tuft.position.set(-.65 - i * .23, 2.02 + Math.sin(i * .8) * .12, (i % 3 - 1) * .18); tuft.rotation.z = Math.PI * .5; hound.add(tuft); }
  hound.userData.chest = chest; hound.userData.legs = legs;
}

function setupLights() {
  scene.add(new THREE.HemisphereLight(0x9bbdff, 0x080a1b, 1.15));
  const key = new THREE.PointLight(palette.cyan, 38, 100, 2); key.position.set(0, 16, 4); root.add(key);
  const fill = new THREE.PointLight(palette.violet, 30, 90, 2); fill.position.set(-22, 8, -24); root.add(fill);
  const warm = new THREE.PointLight(palette.gold, 24, 70, 2); warm.position.set(22, -1, 12); root.add(warm);
  const moon = new THREE.DirectionalLight(0xb9c7ff, 2.4); moon.position.set(-18, 30, -26); scene.add(moon);
}

function buildWorld() { addStars(); buildLoom(); buildObservatory(); buildHound(); setupLights(); }
buildWorld();

const tmp = new THREE.Vector3(); const target = new THREE.Vector3();
function chapterFor(time) { return chapters.findIndex(c => time >= c.start && time < c.end) >= 0 ? chapters.findIndex(c => time >= c.start && time < c.end) : 4; }
function updateChapterUI(index) {
  const c = chapters[index]; document.querySelector('#chapterKicker').textContent = c.kicker; document.querySelector('#chapterTitle').textContent = c.title; document.querySelector('#chapterDescription').textContent = c.description; document.querySelector('#chapterNumber').textContent = String(index + 1).padStart(2, '0'); document.querySelector('#chapterName').textContent = c.title;
  document.querySelectorAll('.chapter').forEach((el, i) => { el.classList.toggle('active', i === index); });
}

function filmCamera(time) {
  const t = time / 180; const pos = filmPositions.getPointAt(t); const look = filmTargets.getPointAt(t);
  camera.position.lerp(pos, .075); target.lerp(look, .1); camera.lookAt(target);
}

function updateFreeCamera(dt) {
  const forward = new THREE.Vector3(Math.sin(state.yaw), 0, Math.cos(state.yaw)); const right = new THREE.Vector3(Math.cos(state.yaw), 0, -Math.sin(state.yaw)); const velocity = new THREE.Vector3();
  if (keys.has('w')) velocity.addScaledVector(forward, -1); if (keys.has('s')) velocity.addScaledVector(forward, 1); if (keys.has('a')) velocity.addScaledVector(right, -1); if (keys.has('d')) velocity.addScaledVector(right, 1); if (keys.has('q')) velocity.y += 1; if (keys.has('e')) velocity.y -= 1;
  if (velocity.lengthSq()) { velocity.normalize().multiplyScalar(state.freeSpeed * (keys.has('shift') ? 3.4 : 1)); camera.position.addScaledVector(velocity, dt * 60); }
  camera.rotation.order = 'YXZ'; camera.rotation.y = state.yaw; camera.rotation.x = state.pitch;
}

function animateWorld(t) {
  const s = t * .001; loom.rotation.y = s * .055; loom.rotation.x = Math.sin(s * .2) * .04; observatory.rotation.y = Math.sin(s * .08) * .06;
  loom.children.forEach((obj, i) => { if (obj.geometry?.type === 'TorusGeometry') obj.rotation.z += .0004 * (i % 2 ? -1 : 1); });
  orbiters.forEach((o, i) => { o.angle += .001 * o.speed * 60; const a = o.angle; const r = o.radius; o.object.position.set(Math.cos(a) * r, Math.sin(a * 2 + o.phase) * o.lift, Math.sin(a) * r); o.object.rotation.x += .005 + i * .0001; o.object.rotation.z -= .004; });
  stars.forEach((p, i) => { p.rotation.y += i ? .00008 : .000015; });
  if (hound) { const breath = 1 + Math.sin(s * 2.2) * .018; hound.userData.chest.scale.y = 1.08 * breath; hound.userData.head.rotation.y = Math.sin(s * .55) * .035; hound.userData.tail.rotation.z = Math.sin(s * 1.4) * .07; hound.userData.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(s * 1.1 + i * 1.7) * .018; }); }
}

function setProgress(v) { const pct = `${(v / 180) * 100}%`; const el = document.querySelector('#timeline'); el.value = v; el.style.setProperty('--progress', pct); document.querySelector('#elapsed').textContent = `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(Math.floor(v % 60)).padStart(2, '0')}`; }
function showToast(text) { const el = document.querySelector('#toast'); el.textContent = text; el.classList.add('show'); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => el.classList.remove('show'), 1800); }
function setMode(mode) { state.mode = mode; const film = mode === 'film'; document.querySelector('#modeLabel').textContent = film ? '电影运镜' : '自由探索'; document.querySelector('#modeButton').classList.toggle('active', film); document.querySelector('#modeButton').setAttribute('aria-pressed', String(!film)); if (!film) { camera.position.set(0, 5, 31); state.yaw = 0; state.pitch = -.12; camera.lookAt(0, 10, 0); showToast('自由探索已开启'); } else showToast('电影运镜已开启'); }

document.querySelector('#modeButton').addEventListener('click', () => setMode(state.mode === 'film' ? 'free' : 'film'));
document.querySelector('#playButton').addEventListener('click', () => { state.playing = !state.playing; document.querySelector('#playButton').classList.toggle('is-playing', state.playing); document.querySelector('#playButton').setAttribute('aria-label', state.playing ? '暂停运镜' : '播放运镜'); });
document.querySelector('#timeline').addEventListener('input', e => { state.time = Number(e.target.value); setProgress(state.time); updateChapterUI(chapterFor(state.time)); });
document.querySelector('#speed').addEventListener('change', e => { state.speed = Number(e.target.value); showToast(`运镜速度 ${e.target.value}×`); });
document.querySelectorAll('.chapter').forEach((el, i) => el.addEventListener('click', () => { state.time = chapters[i].start; setProgress(state.time); updateChapterUI(i); }));
document.querySelector('#qualityButton').addEventListener('click', () => { state.quality = (state.quality + 1) % 3; const labels = ['HD', 'AUTO', 'MAX']; const ratios = [1.25, 1.8, 2.2]; renderer.setPixelRatio(Math.min(window.devicePixelRatio, ratios[state.quality])); document.querySelector('#qualityButton').textContent = labels[state.quality]; showToast(`画质：${labels[state.quality]}`); });
document.querySelector('#helpButton').addEventListener('click', () => { document.querySelector('#helpPanel').hidden = false; });
document.querySelector('#closeHelp').addEventListener('click', () => { document.querySelector('#helpPanel').hidden = true; });
document.querySelector('#fullscreenButton').addEventListener('click', () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); });
document.querySelector('#restoreUi').addEventListener('click', () => { state.uiHidden = false; document.querySelectorAll('.topbar,.hero-copy,.telemetry,.transport').forEach(e => e.style.display = ''); document.querySelector('#restoreUi').hidden = true; });

window.addEventListener('keydown', e => { const k = e.key.toLowerCase(); if (['w','a','s','d','q','e','shift'].includes(k)) keys.add(k); if (k === 'f') document.querySelector('#fullscreenButton').click(); if (k === 'h') { state.uiHidden = !state.uiHidden; document.querySelectorAll('.topbar,.hero-copy,.telemetry,.transport').forEach(el => el.style.display = state.uiHidden ? 'none' : ''); document.querySelector('#restoreUi').hidden = !state.uiHidden; } if (k === ' ') { e.preventDefault(); document.querySelector('#playButton').click(); } });
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
let dragging = false; let lastX = 0; let lastY = 0;
canvas.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('pointermove', e => { if (!dragging || state.mode !== 'free') return; const dx = e.clientX - lastX; const dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; state.yaw -= dx * .004; state.pitch = THREE.MathUtils.clamp(state.pitch - dy * .003, -1.35, 1.35); });
canvas.addEventListener('wheel', e => { if (state.mode !== 'free') return; const dir = new THREE.Vector3(0, 0, -Math.sign(e.deltaY)); dir.applyQuaternion(camera.quaternion); camera.position.addScaledVector(dir, .9); }, { passive: true });
let touchDistance = 0;
canvas.addEventListener('touchstart', e => { if (e.touches.length === 2) touchDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); }, { passive: true });
canvas.addEventListener('touchmove', e => { if (state.mode !== 'free' || e.touches.length !== 2) return; e.preventDefault(); const next = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); const delta = next - touchDistance; touchDistance = next; const dir = new THREE.Vector3(0, 0, -Math.sign(delta)); dir.applyQuaternion(camera.quaternion); camera.position.addScaledVector(dir, Math.min(Math.abs(delta) * .015, 1.1)); }, { passive: false });
document.querySelectorAll('#touchControls button').forEach(button => {
  const key = button.dataset.move === 'forward' ? 'w' : button.dataset.move === 'backward' ? 's' : button.dataset.move === 'left' ? 'a' : button.dataset.move === 'right' ? 'd' : button.dataset.move === 'up' ? 'q' : 'e';
  const press = e => { e.preventDefault(); keys.add(key); };
  const release = e => { e.preventDefault(); keys.delete(key); };
  button.addEventListener('pointerdown', press); button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('pointerleave', release);
});

function resize() { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); }
window.addEventListener('resize', resize);

let lastChapter = -1;
function loop(now) {
  const dt = Math.min(clock.getDelta(), .05); animateWorld(now);
  if (state.mode === 'film') { if (state.playing) { state.time += dt * state.speed; if (state.time > 180) state.time = 0; } filmCamera(state.time); } else updateFreeCamera(dt);
  const chapter = chapterFor(state.time); if (chapter !== lastChapter) { lastChapter = chapter; updateChapterUI(chapter); }
  setProgress(state.time);
  document.querySelector('#altitude').textContent = `${(18.4 + Math.sin(now * .0004) * 3.7).toFixed(1).padStart(6, '0')}`;
  document.querySelector('#density').textContent = (8240 + Math.floor(Math.sin(now * .0007) * 280)).toLocaleString('en-US');
  document.querySelector('#fov').textContent = Math.round(camera.fov);
  renderer.render(scene, camera); requestAnimationFrame(loop);
}

updateChapterUI(0); setProgress(0); document.querySelector('#playButton').classList.add('is-playing');
requestAnimationFrame(loop);
setTimeout(() => document.querySelector('#loading').classList.add('hidden'), 850);
