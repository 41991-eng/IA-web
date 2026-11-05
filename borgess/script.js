/* =========================================================
   borgess — script.js
   1) Cena 3D (Three.js): texto "borgess" cromado estilo bubble
   2) Interações: rolagem, cards, navegação ativa
   ========================================================= */
import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = matchMedia('(max-width: 768px)').matches || 'ontouchstart' in window;

/* ---------- 1. CENA 3D ---------- */
const canvas = document.getElementById('scene');
const hero = document.getElementById('inicio');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.z = 14;

/* Ambiente procedural: gradiente azulado + faixas de luz (dá o reflexo cromado) */
function buildEnvironment() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#DCE1E8');
  grad.addColorStop(0.45, '#737D8B');
  grad.addColorStop(0.5, '#11151D');
  grad.addColorStop(1, '#051230');
  g.fillStyle = grad; g.fillRect(0, 0, 1024, 512);
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 8; i++) g.fillRect(i * 128 + 20, 60, 26, 150);   // softboxes
  g.fillStyle = '#AEB7C2';
  g.fillRect(0, 300, 1024, 8);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tex).texture;
  tex.dispose(); pmrem.dispose();
  return env;
}
scene.environment = buildEnvironment();

/* Luzes dinâmicas que orbitam o objeto */
const lightA = new THREE.PointLight(0xDCE1E8, 90, 40);
const lightB = new THREE.PointLight(0x5b7cff, 60, 40);
scene.add(lightA, lightB, new THREE.AmbientLight(0x112244, 0.6));

/* Material cromado */
const chrome = new THREE.MeshPhysicalMaterial({
  color: 0xDCE1E8, metalness: 1, roughness: 0.06,
  clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.5
});

const pivot = new THREE.Group();   // grupo que recebe as rotações
scene.add(pivot);
let textWidth = 1;

new FontLoader().load(
  'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/fonts/helvetiker_bold.typeface.json',
  (font) => {
    let geo = new TextGeometry('BORGESS', {
      font, size: 2, height: 0.9,
      curveSegments: isMobile ? 8 : 16,
      bevelEnabled: true,
      bevelThickness: 0.45,   // bevel enorme = aparência inflada (bubble)
      bevelSize: 0.28,
      bevelSegments: isMobile ? 6 : 12
    });
    geo.deleteAttribute('normal');
    geo.deleteAttribute('uv');
    geo = mergeVertices(geo, 0.01);   // une vértices → normais suaves
    geo.computeVertexNormals();
    geo.center();
    geo.computeBoundingBox();
    textWidth = geo.boundingBox.max.x - geo.boundingBox.min.x;
    pivot.add(new THREE.Mesh(geo, chrome));
    fit();
    canvas.classList.add('ready');
  },
  undefined,
  () => console.error('Não foi possível carregar a fonte do Three.js (precisa de internet).')
);

/* Ajusta escala conforme o tamanho da tela */
function fit() {
  const w = hero.clientWidth, h = hero.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const visibleW = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z * camera.aspect;
  pivot.scale.setScalar((visibleW * (w < 700 ? 0.86 : 0.62)) / textWidth);
}
addEventListener('resize', fit);

/* ---------- Interação com o cursor + inércia ---------- */
const AUTO_SPEED = 0.9;        // rad/s — rotação automática relativamente rápida
let spin = 0;                  // velocidade extra vinda do mouse (com inércia)
let yaw = 0;                   // ângulo acumulado
let tiltX = 0, tiltY = 0;      // inclinação suave
let tgtX = 0, tgtY = 0;
let last = { x: null };

function onPointer(e) {
  const r = hero.getBoundingClientRect();
  const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
  const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
  tgtY = nx * 0.35; tgtX = ny * 0.25;
  if (last.x !== null) spin += (e.clientX - last.x) * 0.0045;  // acompanha a direção do movimento
  last.x = e.clientX;
}
hero.addEventListener('pointermove', onPointer);
hero.addEventListener('pointerleave', () => { tgtX = tgtY = 0; last.x = null; });

/* ---------- Loop (pausa quando o hero sai da tela) ---------- */
let visible = true, t0 = performance.now();
new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0 }).observe(hero);

function frame(now) {
  requestAnimationFrame(frame);
  if (!visible) { t0 = now; return; }
  const dt = Math.min((now - t0) / 1000, 0.05); t0 = now;

  spin *= Math.pow(0.04, dt);                       // amortecimento (inércia)
  spin = THREE.MathUtils.clamp(spin, -6, 6);
  yaw += ((reduceMotion ? 0.12 : AUTO_SPEED) * dt) + spin * dt * 6;
  tiltX += (tgtX - tiltX) * Math.min(dt * 4, 1);
  tiltY += (tgtY - tiltY) * Math.min(dt * 4, 1);

  pivot.rotation.set(tiltX, yaw + tiltY, 0);
  pivot.position.y = Math.sin(now * 0.001) * 0.12;  // flutuação sutil

  const t = now * 0.0006;
  lightA.position.set(Math.cos(t) * 8, 4 + Math.sin(t * 1.3) * 2, 6);
  lightB.position.set(Math.cos(t + 3) * -8, -3, 5 + Math.sin(t) * 2);

  renderer.render(scene, camera);
}
fit();
requestAnimationFrame(frame);

/* ---------- 2. ANIMAÇÕES DE ROLAGEM ---------- */
const reveals = document.querySelectorAll('.reveal');
reveals.forEach((el, i) => el.style.setProperty('--d', `${(i % 3) * 0.12}s`));
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); revealObs.unobserve(en.target); } });
}, { threshold: 0.2 });
reveals.forEach(el => revealObs.observe(el));

/* Link ativo na navegação conforme a seção visível */
const links = [...document.querySelectorAll('.nav__link')];
const navObs = new IntersectionObserver((entries) => {
  entries.forEach(en => {
    if (!en.isIntersecting) return;
    links.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id));
  });
}, { threshold: 0.5 });
document.querySelectorAll('[data-section]').forEach(s => navObs.observe(s));

/* ---------- Cards: tilt 3D + brilho que segue o cursor ---------- */
if (!isMobile && !reduceMotion) {
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--ry', `${(x - 0.5) * 10}deg`);
      card.style.setProperty('--rx', `${(0.5 - y) * 10}deg`);
      card.style.setProperty('--mx', `${x * 100}%`);
      card.style.setProperty('--my', `${y * 100}%`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg');
    });
  });
}
