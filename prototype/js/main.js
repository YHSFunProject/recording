import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MAP, buildTerrain, loadLand, toWorld, toSrc } from './terrain.js';
import { NATIONS, CITIES, EVENTS, ERAS, REGIONS, STORY, GLOSSARY, FRAGMENTS } from './data.js';
import { fragSVG, skylineSVG } from './collage.js';

const $ = (s) => document.querySelector(s);
const mapEl = $('#map'), labelsEl = $('#labels'), fragsEl = $('#frags'), overlay = $('#overlay'), panel = $('#panel');

const state = {
  sel: null, hiNation: null, tab: 'map', view: 'tilt', relief: 1.2,
  layers: { contour: true, hex: true, river: true, grid: true, collage: true },
  year: 1103, // 当前历史线：地图国界、时间轴、史料都按这一年显示
  paper: null, // { nat, ev } 打开中的史料
};
const TILT = 0.62;
const Y0 = ERAS[0].a, Y1 = ERAS[ERAS.length - 1].b;
const fmtYr = (y) => { const v = Math.floor(y + 1e-6); return v < 0 ? '前' + -v : String(v); };
const eraOf = (t) => ERAS.find((e) => t >= e.a && t < e.b) || ERAS[ERAS.length - 1];
// 地图样式随时代：ancient（远古/前文明，无国界勘测图）· classic（古代，平滑疆界、只有都城）· crystal · present（六边形实控地块）
const MAP_STYLE = { prehistory: 'ancient', predecessor: 'ancient', precommon: 'classic', precrystal: 'classic', crystal: 'crystal', present: 'present' };
const styleOf = (y = state.year) => MAP_STYLE[eraOf(y).id];
const STYLE_NAME = { ancient: '远古勘测图 · 无国界', classic: '古代疆域图 · 平滑疆界', crystal: '结晶纪元 · 实控地块', present: '当代 · 实控地块' };
const yrInt = (y) => Math.floor(y + 1e-6);
// 国家在 year 是否存续（life: [始, 终)）
const aliveAt = (n, y = state.year) => !n.life || ((n.life[0] == null || y >= n.life[0]) && (n.life[1] == null || y < n.life[1]));
const lifeTxt = (n) => (n.life ? `${n.life[0] ?? '?'} — ${n.life[1] ?? '今'}${n.tbd ? ' *' : ''}` : '— 今');
// 事件所属国家：地点是城市则取其国家，地点本身是国家则取它
const natOf = (e) => CITY[e.loc]?.nation ?? (NAT[e.loc] ? e.loc : null);
const eventsOf = (id) => EVENTS.filter((e) => natOf(e) === id || e.rel.some((r) => r === id || CITY[r]?.nation === id)).sort((a, b) => a.t - b.t);
const nIdx = Object.fromEntries(NATIONS.map((n, i) => [n.id, i]));
const NAT = Object.fromEntries(NATIONS.map((n) => [n.id, n]));
const CITY = Object.fromEntries(CITIES.map((c) => [c.id, c]));
const EVT = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
const REG = Object.fromEntries(REGIONS.map((r) => [r.id, r]));
const TERM = Object.fromEntries(GLOSSARY.map((g) => [g.id, g]));
const CH = Object.fromEntries(STORY.map((c) => [c.id, c]));
const thing = (id) => CITY[id] || NAT[id] || REG[id];
const posOf = (id) => thing(id)?.at;
const nameOf = (id) => (id == null ? '地点不详' : thing(id)?.zh ?? id);

await new Promise((r) => setTimeout(r, 30)); // 让 loading 先绘制
await loadLand('data/land.png');
const T = buildTerrain(NATIONS, (n) => aliveAt(n) && styleOf() !== 'ancient');

// ---------- three
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('#gl').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 400);
const controls = new OrbitControls(camera, renderer.domElement);
Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, minDistance: 7, maxDistance: 95, maxPolarAngle: 1.15, screenSpacePanning: false, zoomToCursor: true });
controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };

const baseCv = Object.assign(document.createElement('canvas'), { width: MAP.TW, height: MAP.TH });
const texCv = Object.assign(document.createElement('canvas'), { width: MAP.TW, height: MAP.TH });
const tctx = texCv.getContext('2d');
const texture = new THREE.CanvasTexture(texCv);
texture.colorSpace = THREE.SRGBColorSpace;
texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
// 边缘渐隐遮罩：圆角矩形模糊后作为透明度，让海面自然融进背景，而不是一块方板
const fadeMask = (() => {
  const w = 410, h = 500, c = Object.assign(document.createElement('canvas'), { width: w, height: h }), g = c.getContext('2d');
  g.filter = 'blur(22px)'; g.fillStyle = '#000';
  g.beginPath(); g.roundRect(34, 34, w - 68, h - 68, 70); g.fill();
  return c;
})();
function composeTexture() {
  tctx.clearRect(0, 0, MAP.TW, MAP.TH);
  tctx.drawImage(baseCv, 0, 0);
  if (state.hiNation && NAT[state.hiNation].own) T.drawSelection(tctx, nIdx[state.hiNation], drawnStyle);
  tctx.globalCompositeOperation = 'destination-in';
  tctx.drawImage(fadeMask, 0, 0, MAP.TW, MAP.TH);
  tctx.globalCompositeOperation = 'source-over';
  texture.needsUpdate = true;
}
let drawnStyle = null;
function redrawBase() {
  drawnStyle = styleOf();
  T.drawBase(baseCv.getContext('2d'), { ...state.layers, style: drawnStyle });
  composeTexture();
  const b = $('#era-style'); if (b) b.textContent = '地图样式 · ' + STYLE_NAME[drawnStyle];
}
redrawBase();

const geo = new THREE.PlaneGeometry(MAP.W / 40, MAP.H / 40, MAP.GW - 1, MAP.GH - 1);
geo.rotateX(-Math.PI / 2);
const posAttr = geo.attributes.position;
function applyRelief() {
  for (let k = 0; k < posAttr.count; k++) posAttr.setY(k, T.Hh[k] * state.relief);
  posAttr.needsUpdate = true;
  geo.computeVertexNormals(); geo.computeBoundingBox(); geo.computeBoundingSphere();
}
applyRelief();
const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95, metalness: 0, transparent: true }));
terrain.castShadow = terrain.receiveShadow = true;
scene.add(terrain);
// 不再用方形底座：贴图四周渐隐到页面背景（见 composeTexture 的 fadeMask）

scene.add(new THREE.HemisphereLight(0xffffff, 0xbdbab2, 1.5));
const sun = new THREE.DirectionalLight(0xfffdf8, 2.1);
sun.position.set(-18, 22, -14);
sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 90 });
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun);

// ---------- camera tween
const sph = new THREE.Spherical();
let tween = null;
function flyTo({ target, dist, polar, theta }, dur = 900) {
  sph.setFromVector3(camera.position.clone().sub(controls.target));
  const from = { r: sph.radius, phi: sph.phi, th: sph.theta };
  const to = { r: dist ?? from.r, phi: polar ?? from.phi, th: theta ?? from.th };
  const d = to.th - from.th; to.th = from.th + Math.atan2(Math.sin(d), Math.cos(d));
  tween = { t0: performance.now(), dur, fromT: controls.target.clone(), toT: target ? target.clone() : controls.target.clone(), from, to };
}
function stepTween(now) {
  if (!tween) return false;
  const t = Math.min(1, (now - tween.t0) / tween.dur), e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const { from: a, to: b } = tween;
  controls.target.lerpVectors(tween.fromT, tween.toT, e);
  sph.set(a.r + (b.r - a.r) * e, Math.max(0.0005, a.phi + (b.phi - a.phi) * e), a.th + (b.th - a.th) * e);
  camera.position.setFromSpherical(sph).add(controls.target);
  camera.lookAt(controls.target);
  if (t >= 1) tween = null;
  return true;
}
const groundY = (sx, sy) => Math.max(0, T.sample(T.Hh, sx, sy)) * state.relief;
const worldVec = (sx, sy, lift = 0.05) => { const [x, z] = toWorld(sx, sy); return new THREE.Vector3(x, groundY(sx, sy) + lift, z); };
const curPolar = () => controls.getPolarAngle();
const viewPolar = () => (state.view === 'top' ? 0.0005 : Math.max(curPolar(), 0.35));
// 总览：按视口比例把整块大陆（含北部未知地域）放进画面
function fitDist() { const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)); return Math.max(19.5 / t, 15 / (t * camera.aspect)) * 1.02; }
function overview(dur) { flyTo({ target: new THREE.Vector3(-0.5, 0, -2.5), dist: fitDist() * (state.view === 'top' ? 1 : 0.8), polar: state.view === 'top' ? 0.0005 : TILT, theta: 0 }, dur); }
camera.position.set(0, 40, 30); controls.target.set(0, 0, 1);
overview(1);

// ---------- labels
const labels = [];
function addLabel(html, cls, id, at, onClick) {
  const el = document.createElement('div');
  el.className = cls; el.innerHTML = html; el.dataset.id = id;
  el.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
  labelsEl.appendChild(el);
  labels.push({ el, id, kind: cls.split(' ')[0], at });
}
for (const r of REGIONS) addLabel(`<div><div class="zh">${r.zh}</div><div class="en">${r.en}</div><div class="nf">DATA NOT FOUND</div></div>`, 'rg', r.id, r.at, () => select('region', r.id));
for (const c of CITIES) {
  const n = FRAGMENTS[c.id]?.length;
  addLabel(`<div><i></i><span>${c.zh}</span><em>${c.en} · ${c.code}</em>${n ? `<b>▣${n}</b>` : ''}</div>`, `ct${c.cap ? ' cap' : ''}${c.site ? ' site' : ''}`, c.id, c.at, () => select('city', c.id));
}
for (const n of NATIONS) addLabel(`<div><div class="zh">${n.zh}</div><div class="en">${n.en}</div></div>`, 'nl', n.id, n.at, () => select('nation', n.id));

const v3 = new THREE.Vector3();
let mapW = 1, mapH = 1, mapRect = { left: 0, top: 0 };
function project(sx, sy, lift = 0.05) {
  const [x, z] = toWorld(sx, sy);
  v3.set(x, groundY(sx, sy) + lift, z).project(camera);
  return { x: (v3.x + 1) / 2 * mapW, y: (1 - v3.y) / 2 * mapH, ok: v3.z < 1 };
}
const relevant = new Set(); // 当前选择关联的地点 id
function updateLabels(dist) {
  labelsEl.classList.toggle('near', dist < 24);
  for (const L of labels) {
    const st = drawnStyle;
    // 远古不显示国名与城市；古代只显示都城；与当前选择相关的地点始终显示
    const show = L.kind === 'nl' ? aliveAt(NAT[L.id]) && st !== 'ancient'
      : L.kind !== 'ct' ? true
      : relevant.has(L.id) || (st !== 'ancient' && (st !== 'classic' || CITY[L.id].cap) && (dist < 34 || (state.hiNation && CITY[L.id].nation === state.hiNation)));
    const p = project(L.at[0], L.at[1]);
    if (!show || !p.ok || p.x < -80 || p.x > mapW + 80 || p.y < -40 || p.y > mapH + 40) { L.el.style.display = 'none'; continue; }
    L.el.style.display = '';
    L.el.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px)`;
  }
}
function refreshLabelClasses() {
  for (const L of labels) {
    const on = (L.kind === 'nl' && L.id === state.hiNation) || (L.kind !== 'nl' && relevant.has(L.id));
    L.el.classList.toggle('on', on);
  }
}

// ---------- collage fragments
let frags = [];
function buildFrags() {
  fragsEl.innerHTML = ''; frags = [];
  if (!state.layers.collage || !state.sel) return;
  const { type, id } = state.sel;
  let anchors = [];
  if (type === 'city') anchors = [[id, 3]];
  else if (type === 'event') anchors = [[EVT[id].loc, 3]];
  else if (type === 'nation' && NAT[id].capital) anchors = [[NAT[id].capital, 1]];
  let seed = 1;
  for (const [aid, max] of anchors) {
    (FRAGMENTS[aid] || []).slice(0, max).forEach((f, i) => {
      const el = document.createElement('div');
      el.className = 'frag';
      el.innerHTML = fragSVG(f.k, seed++ * 7 + aid.length) + `<div class="cap"><b>FIG.${String(i + 1).padStart(2, '0')}</b>${f.cap}</div>`;
      fragsEl.appendChild(el);
      frags.push({ el, at: posOf(aid), i });
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
    });
  }
}
function positionFrags(svg) {
  const OFF_Y = [-125, -5, 115];
  for (const f of frags) {
    const p = project(f.at[0], f.at[1]);
    if (!p.ok) { f.el.style.display = 'none'; continue; }
    f.el.style.display = '';
    const side = p.x > mapW * 0.55 ? -1 : 1;
    const w = 124, h = 100;
    let x = p.x + side * 210 + (side < 0 ? -w : 0), y = p.y + OFF_Y[f.i] - h / 2 + 20;
    x = Math.max(8, Math.min(mapW - w - 8, x)); y = Math.max(110, Math.min(mapH - h - 8, y));
    f.el.style.transform = `translate(${x}px,${y}px)`;
    const ex = side > 0 ? x : x + w, ey = y + h / 2, mx = mapRect.left, my = mapRect.top;
    svg.push(`<polyline class="ld" points="${mx + ex},${my + ey} ${mx + ex - side * 24},${my + ey} ${mx + p.x},${my + p.y}"/>`);
    if (f.i === 0) svg.push(`<circle class="anc" cx="${mx + p.x}" cy="${my + p.y}" r="9"/>`);
  }
}

// ---------- overlay (连线：时间节点 ↔ 地点；事件关联路线)
function drawOverlay() {
  const svg = [];
  positionFrags(svg);
  const sel = state.sel;
  if (sel && (sel.type === 'event' || sel.type === 'term')) {
    const mx = mapRect.left, my = mapRect.top;
    const locs = sel.type === 'event' ? [EVT[sel.id].loc, ...EVT[sel.id].rel] : TERM[sel.id].rel;
    const pts = locs.map((id) => { const a = posOf(id); return a && project(a[0], a[1]); });
    if (sel.type === 'event' && pts[0]?.ok) {
      const card = document.querySelector(`.tl-ev[data-id="${sel.id}"] .card`);
      if (card) {
        const r = card.getBoundingClientRect(), tlTop = $('#timeline').getBoundingClientRect().top;
        const cx = r.left + 12, ax = mx + pts[0].x, ay = my + pts[0].y;
        svg.push(`<path class="evl" d="M${cx} ${r.top} V${tlTop - 14} L${ax} ${ay}"/>`);
      }
      for (let i = 1; i < pts.length; i++) {
        if (!pts[i]?.ok) continue;
        const a = pts[0], b = pts[i], ctrlX = (a.x + b.x) / 2, ctrlY = Math.min(a.y, b.y) - 50 - Math.abs(a.x - b.x) * 0.2;
        svg.push(`<path class="route" d="M${mx + a.x} ${my + a.y} Q${mx + ctrlX} ${my + ctrlY} ${mx + b.x} ${my + b.y}"/>`);
      }
    }
    pts.forEach((p) => p?.ok && svg.push(`<circle class="ancY" cx="${mapRect.left + p.x}" cy="${mapRect.top + p.y}" r="4"/>`));
  }
  overlay.innerHTML = svg.join('');
}

// ---------- selection
function select(type, id, opts = {}) {
  // 时间联动：选中事件 → 时间轴跳到事件发生年；选中已消亡/尚未建立的国家 → 跳到它存续的年份
  if (type === 'event') {
    const t = EVT[id].t;
    if (t < tlRange[0] || t > tlRange[1]) zoomEra(tlEra ? eraOf(t).id : null);
    setYear(t, { quiet: true });
  }
  if (type === 'nation' && !aliveAt(NAT[id])) {
    const [a, b] = NAT[id].life;
    setYear(b != null && state.year >= b ? b - 0.5 : a + 0.1, { quiet: true });
  }
  state.sel = type ? { type, id } : null;
  relevant.clear();
  let nat = null;
  if (type === 'nation') nat = id;
  else if (type === 'city') { nat = CITY[id].nation; relevant.add(id); }
  else if (type === 'event') { const e = EVT[id]; nat = natOf(e); relevant.add(e.loc); e.rel.forEach((r) => relevant.add(r)); }
  else if (type === 'term') TERM[id].rel.forEach((r) => relevant.add(r));
  else if (type === 'region') relevant.add(id);
  if (nat !== state.hiNation) { state.hiNation = nat; composeTexture(); }
  refreshLabelClasses();
  renderPanel();
  markTimeline();
  buildFrags();
  if (opts.fly !== false) flyToSel();
}
function flyToSel() {
  const sel = state.sel;
  if (!sel) return overview();
  let pts = [], dist = 24;
  if (sel.type === 'nation') { pts = [NAT[sel.id].at]; dist = 30; }
  else if (sel.type === 'city') { pts = [CITY[sel.id].at]; dist = 17; }
  else if (sel.type === 'region') { pts = [REG[sel.id].at]; dist = 32; }
  else if (sel.type === 'event') { const e = EVT[sel.id]; pts = [e.loc, ...e.rel].map(posOf).filter(Boolean); dist = 20; }
  else if (sel.type === 'term') { pts = TERM[sel.id].rel.map(posOf).filter(Boolean); dist = 30; }
  else if (sel.type === 'chapter') { pts = CH[sel.id].ev.map((e) => posOf(EVT[e].loc)).filter(Boolean); dist = 24; }
  if (!pts.length) return;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 40;
  const t = worldVec(cx, cy, 0);
  t.z += 0.6; // 略偏南，给标签与拼贴留出上方空间
  flyTo({ target: t, dist: dist + span * 1.6, polar: viewPolar() });
}

// ---------- panel
const esc = (s) => String(s);
const tbd = (x) => (x?.tbd ? '<span class="tbd">待考证</span>' : '');
// 地点链接：按城市 / 国家 / 区域区分，地点不详时只显示文字
const placeLink = (id) => (CITY[id] ? `<a data-sel="city:${id}">${nameOf(id)}</a>` : NAT[id] ? `<a data-sel="nation:${id}">${nameOf(id)}</a>` : REG[id] ? `<a data-sel="region:${id}">${nameOf(id)}</a>` : nameOf(id));
const evItem = (e) => `<li data-sel="event:${e.id}"><span class="yr">${e.yr}${e.tbd ? '*' : ''}</span><b>${e.zh}</b><em>${nameOf(e.loc)}</em></li>`;
const cityItem = (c) => `<li data-sel="city:${c.id}"><span class="k">${c.cap ? '■' : c.site ? '◌' : '□'}</span><b>${c.zh}</b><em>${c.code}</em></li>`;
const thumbs = (id) => (FRAGMENTS[id] || []).map((f, i) => `<figure>${fragSVG(f.k, i * 7 + 3 + id.length)}<figcaption>FIG.${String(i + 1).padStart(2, '0')} ${f.cap}</figcaption></figure>`).join('');
const back = (label = '返回总览') => `<a data-back>← ${label}</a>`;

function renderPanel() {
  const sel = state.sel;
  let h = '';
  if (!sel) h = renderTab();
  else if (sel.type === 'nation') {
    const n = NAT[sel.id], cs = CITIES.filter((c) => c.nation === n.id);
    const es = eventsOf(n.id);
    const gone = n.life?.[1] != null;
    h = `<div class="crumb"><span>ARCHIVE / NATION / ${n.code}</span>${back()}</div>
      <div class="ph-head"><div class="emb${gone ? ' gone' : ''}">${n.en.slice(0, 2)}</div><div><h1>${n.zh}${tbd(n)}</h1><div class="ph-en">${n.en}${gone ? ' · 已消亡' : ''}</div></div></div>
      <dl class="kv"><dt>政体</dt><dd>${n.gov}</dd><dt>地形</dt><dd>${n.terrain}</dd><dt>存续</dt><dd class="mono">泰拉历 ${lifeTxt(n)}</dd><dt>识别码</dt><dd class="mono">${n.code}</dd><dt>首都</dt><dd>${n.capital ? nameOf(n.capital) : '—'}</dd></dl>
      <p class="sum">${n.sum}</p>
      <button class="cta" data-paper="${n.id}">查阅《${n.zh}史料》<i>截至 ${fmtYr(state.year)} 年 →</i></button>
      <h3><span>城市与地点 CITIES</span><span>${cs.length}</span></h3><ul class="list">${cs.map(cityItem).join('') || '<li>暂无档案</li>'}</ul>
      <h3><span>相关事件 EVENTS</span><span>${es.length}</span></h3><ul class="list">${es.map(evItem).join('') || '<li>暂无档案</li>'}</ul>
      ${n.capital && FRAGMENTS[n.capital] ? `<h3><span>档案碎片 FRAGMENTS</span></h3><div class="thumbs">${thumbs(n.capital)}</div>` : ''}`;
  } else if (sel.type === 'city') {
    const c = CITY[sel.id], n = NAT[c.nation], es = EVENTS.filter((e) => e.loc === c.id || e.rel.includes(c.id));
    h = `<div class="crumb"><span>ARCHIVE / ${c.site ? 'SITE' : 'CITY'} / ${c.code}</span>${back()}</div>
      <div class="ph-head"><div class="emb">${c.cap ? '■' : c.site ? '◌' : '□'}</div><div><h1>${c.zh}${tbd(c)}</h1><div class="ph-en">${c.en.toUpperCase()}</div></div></div>
      <dl class="kv"><dt>所属</dt><dd><a data-sel="nation:${n.id}">${n.zh} ${n.en}</a></dd><dt>类型</dt><dd>${c.site ? '地点 / 区域' : c.cap ? '首都 · 移动城市' : '城市'}</dd>
      <dt>识别码</dt><dd class="mono">${c.code}</dd><dt>坐标</dt><dd class="mono">${fmtCoord(...c.at)}</dd></dl>
      <h3><span>相关事件 EVENTS</span><span>${es.length}</span></h3><ul class="list">${es.map(evItem).join('') || '<li>暂无档案</li>'}</ul>
      <h3><span>档案碎片 FRAGMENTS</span><span>${(FRAGMENTS[c.id] || []).length}</span></h3><div class="thumbs">${thumbs(c.id) || '—'}</div>`;
  } else if (sel.type === 'event') {
    const e = EVT[sel.id], c = natOf(e) ? { nation: natOf(e) } : null, ch = STORY.find((s) => s.ev.includes(e.id));
    h = `<div class="crumb"><span>ARCHIVE / EVENT / ${e.yr}</span>${back()}</div>
      <div class="ph-head"><div class="emb ev">${e.yr.replace('≈', '')}</div><div><h1 style="font-size:22px">${e.zh}${tbd(e)}</h1><div class="ph-en">${e.en}</div></div></div>
      <dl class="kv"><dt>时间</dt><dd class="mono">泰拉历 ${e.yr}</dd><dt>地点</dt><dd>${placeLink(e.loc)}</dd>
      <dt>所属</dt><dd>${c ? `<a data-sel="nation:${c.nation}">${NAT[c.nation].zh}</a>` : '—'}</dd>
      <dt>关联</dt><dd>${e.rel.map(placeLink).join(' · ') || '—'}</dd>
      ${ch ? `<dt>剧情</dt><dd><a data-sel="chapter:${ch.id}">${ch.no} ${ch.zh}</a></dd>` : ''}</dl>
      <p class="sum">${e.sum}</p>
      ${c ? `<button class="cta" data-paper="${c.nation}" data-ev="${e.id}">阅读完整记录与材料<i>《${srcOf(e)}》→</i></button>` : ''}
      <h3><span>档案碎片 FRAGMENTS</span></h3><div class="thumbs">${thumbs(e.loc) || '—'}</div>`;
  } else if (sel.type === 'region') {
    const r = REG[sel.id];
    h = `<div class="crumb"><span>ARCHIVE / REGION</span>${back()}</div><div class="ph-head"><div class="emb">？</div><div><h1>${r.zh}</h1><div class="ph-en">${r.en}</div></div></div>
      <p class="sum">该区域缺少可靠测绘资料。<br><span class="mono" style="color:#b0402f">DATA NOT FOUND</span></p>`;
  } else if (sel.type === 'term') {
    const g = TERM[sel.id];
    h = `<div class="crumb"><span>ARCHIVE / GLOSSARY</span>${back('返回词条')}</div><div class="ph-head"><div class="emb">${g.en.slice(0, 2)}</div><div><h1>${g.zh}</h1><div class="ph-en">${g.en}</div></div></div>
      <p class="sum">${g.sum}</p><h3><span>地图关联 ON MAP</span><span>${g.rel.length}</span></h3>
      <ul class="list">${g.rel.map((id) => CITY[id] ? cityItem(CITY[id]) : `<li data-sel="nation:${id}"><span class="k">◇</span><b>${nameOf(id)}</b></li>`).join('') || '<li>无具体地点</li>'}</ul>`;
  } else if (sel.type === 'chapter') {
    const ch = CH[sel.id];
    h = `<div class="crumb"><span>ARCHIVE / STORY / ${ch.no}</span>${back('返回剧情')}</div><div class="ph-head"><div class="emb">${ch.no.slice(0, 2)}</div><div><h1>${ch.zh}</h1><div class="ph-en">${ch.en}</div></div></div>
      <p class="sum">剧情章节作为「阅读路径」：按章节顺序串联事件与地点，点击事件即在地图与时间轴上定位。</p>
      <h3><span>章节事件 EVENTS</span></h3><ul class="list">${ch.ev.map((id) => evItem(EVT[id])).join('')}</ul>`;
  }
  panel.innerHTML = h + `<div class="note">低保真原型 · 文案与年份为占位，需按官方设定核对。<br>海岸线提取自行政概略图；山脉、河流与国界为近似。</div>`;
  panel.scrollTop = 0;
}
function renderTab() {
  const t = state.tab;
  if (t === 'nations') {
    // 存续年表：每国一条横线，竖线为当前年份；已消亡的国家也在这里
    // 年表用分段比例（与时间轴总览一致），让近一千年不被远古压扁
    const px = (y) => (overviewFrac(y) * 100).toFixed(1);
    const rows = NATIONS.map((n) => {
      const a = n.life?.[0] ?? Y0, b = n.life?.[1] ?? Y1;
      return `<li data-sel="nation:${n.id}" class="${aliveAt(n) ? '' : 'dead'}"><b>${n.zh}</b><span class="bar"><i style="left:${px(a)}%;width:${(px(b) - px(a)).toFixed(1)}%"></i>${n.life?.[1] != null ? `<u style="left:${px(b)}%">†${n.life[1]}</u>` : ''}</span></li>`;
    }).join('');
    return `<div class="crumb"><span>ARCHIVE / NATIONS</span></div><h1>国家</h1><div class="ph-en">NATIONS OF TERRA</div>
    <p class="sum">横条为存续年份，黄线为时间轴当前年份（${fmtYr(state.year)}）。已消亡的国家仍可查看，地图会跳回它存在的年代。</p>
    <h3><span>存续年表 · 远古 — ${Math.floor(Y1)}</span><span>${NATIONS.length}</span></h3>
    <ul class="life" style="--now:${px(state.year)}%">${rows}</ul>`;
  }
  if (t === 'gazette') return `<div class="crumb"><span>ARCHIVE / RECORDS</span></div><h1>史料</h1><div class="ph-en">TERRA RECORDS</div>
    <p class="sum">按国家整理的史料：收录截至当前年份与该国相关的全部记录，最近的排在最前，每条都可展开查看正文与材料。每条记录标有出处，如编年史、公报、报纸或遗迹考察记录。</p>
    <h3><span>泰拉历 ${fmtYr(state.year)} 年 · ${eraOf(state.year).zh}</span><span>${NATIONS.length}</span></h3>
    <ul class="list">${NATIONS.map((n) => `<li data-paper="${n.id}"><span class="k">▤</span><b>${n.zh}史料</b><em>${eventsOf(n.id).length} 条${aliveAt(n) ? '' : n.life?.[1] != null && state.year >= n.life[1] ? ' · 已终止' : ' · 尚未建立'}</em></li>`).join('')}</ul>`;
  if (t === 'cities') return `<div class="crumb"><span>ARCHIVE / CITIES</span></div><h1>城市</h1><div class="ph-en">CITIES & SITES</div><h3><span>全部</span><span>${CITIES.length}</span></h3><ul class="list">${CITIES.map(cityItem).join('')}</ul>`;
  if (t === 'events') return `<div class="crumb"><span>ARCHIVE / HISTORY</span></div><h1>历史</h1><div class="ph-en">CHRONICLE</div><h3><span>按时间</span><span>${EVENTS.length}</span></h3><ul class="list">${EVENTS.map(evItem).join('')}</ul>`;
  if (t === 'story') return `<div class="crumb"><span>ARCHIVE / STORY</span></div><h1>剧情</h1><div class="ph-en">STORY ROUTES</div><h3><span>章节</span><span>${STORY.length}</span></h3>
    ${STORY.map((c) => `<div class="chapter" data-sel="chapter:${c.id}"><div class="no">${c.no} · ${c.en}</div><b>${c.zh}</b><div class="mono" style="font-size:10px;color:var(--ink3)">${c.ev.map((e) => EVT[e].zh).join(' → ')}</div></div>`).join('')}`;
  if (t === 'glossary') return `<div class="crumb"><span>ARCHIVE / GLOSSARY</span></div><h1>词条</h1><div class="ph-en">GLOSSARY</div><h3><span>世界观</span><span>${GLOSSARY.length}</span></h3>
    <ul class="list">${GLOSSARY.map((g) => `<li data-sel="term:${g.id}"><span class="k">◇</span><b>${g.zh}</b><em>${g.en}</em></li>`).join('')}</ul>`;
  return `<div class="crumb"><span>ARCHIVE / OVERVIEW</span><span>PRTS</span></div><h1>泰拉</h1><div class="ph-en">TERRA · CONTINENT ARCHIVE</div>
    <div class="stats"><div><b>${NATIONS.length}</b><span>NATIONS</span></div><div><b>${CITIES.length}</b><span>CITIES</span></div><div><b>${EVENTS.length}</b><span>EVENTS</span></div></div>
    <p class="sum">以地图为主体的泰拉档案。国家、城市、事件、剧情与词条互相连接：从任一入口进入，地图都会定位到相关地区。</p>
    <h3><span>操作 HOW TO</span></h3><ul class="list" style="cursor:default">
      <li><span class="k">01</span>点击地块或国名 → 国家档案</li><li><span class="k">02</span>点击城市标记 → 城市档案与拼贴</li>
      <li><span class="k">03</span>点击下方事件 → 定位并连线</li><li><span class="k">04</span>拉近地图 → 城市标记显示 ▣ 档案数</li></ul>
    <h3><span>国家 NATIONS</span></h3><div class="grid2">${NATIONS.slice(0, 8).map((n) => `<button data-sel="nation:${n.id}">${n.zh}<i>${n.en}</i></button>`).join('')}</div>
    <h3><span>最近事件 RECENT</span></h3><ul class="list">${EVENTS.slice(-4).reverse().map(evItem).join('')}</ul>`;
}
panel.addEventListener('click', (e) => {
  const p = e.target.closest('[data-paper]');
  if (p) { openPaper(p.dataset.paper, p.dataset.ev); return; }
  const s = e.target.closest('[data-sel]');
  if (s) { const [type, id] = s.dataset.sel.split(':'); select(type, id); return; }
  if (e.target.closest('[data-back]')) select(null);
});

// ---------- timeline
const tlTrack = $('#tl-track');
// 时间轴有两种视图：
//   总览 —— 所有时代按 share 分段排开（远古压缩、近代放大），点击时代条可放大；
//   时代 —— 只显示一个时代，线性比例。
let tlEra = null; // null = 总览；否则为 ERAS 的 id
// 总览比例：年份 → 0..1
function overviewFrac(y) {
  y = Math.max(Y0, Math.min(Y1, y));
  let f = 0;
  for (const e of ERAS) {
    if (y < e.b || e === ERAS[ERAS.length - 1]) return f + (Math.min(y, e.b) - e.a) / (e.b - e.a) * e.share;
    f += e.share;
  }
  return 1;
}
function overviewYear(f) {
  let acc = 0;
  for (const e of ERAS) {
    if (f <= acc + e.share || e === ERAS[ERAS.length - 1]) return e.a + Math.max(0, Math.min(1, (f - acc) / e.share)) * (e.b - e.a);
    acc += e.share;
  }
  return Y1;
}
let tlX = (y) => 0, tlYear = (x) => Y0, tlAxisY = 0, tlRange = [Y0, Y1];
const niceStep = (span) => { const raw = span / 8, p = 10 ** Math.floor(Math.log10(raw)); return [1, 2, 5, 10].map((k) => k * p).find((s) => s >= raw); };
function buildTimeline() {
  const W = tlTrack.clientWidth, H = tlTrack.clientHeight, axisY = H - 52, padL = 30, a = W - padL - 60;
  tlAxisY = axisY;
  const era = ERAS.find((e) => e.id === tlEra);
  tlRange = era ? [era.a, era.b] : [Y0, Y1];
  const frac = era ? (y) => (y - era.a) / (era.b - era.a) : overviewFrac;
  const unfrac = era ? (f) => era.a + f * (era.b - era.a) : overviewYear;
  const X = (y) => padL + Math.max(0, Math.min(1, frac(y))) * a;
  tlX = X;
  tlYear = (x) => unfrac(Math.max(0, Math.min(1, (x - padL) / a)));
  const inView = (t) => t >= tlRange[0] && t <= tlRange[1];
  const evs = EVENTS.filter((e) => inView(e.t));
  $('#tl-bg').innerHTML = skylineSVG(W, axisY, evs.filter((e) => e.major || era).map((e) => ({ x: X(e.t), type: e.mark })));

  // 刻度
  let ax = `<line x1="0" y1="${axisY}" x2="${W}" y2="${axisY}" stroke="#1d1d1b"/>`;
  const tick = (y, label, major = true) => {
    const x = X(y);
    ax += `<line x1="${x}" y1="${axisY}" x2="${x}" y2="${axisY + (major ? 8 : 4)}" stroke="${major ? '#1d1d1b' : '#8d8a83'}"/>`;
    if (label) ax += `<text x="${x + 3}" y="${axisY + 19}">${label}</text>`;
  };
  if (era) {
    const st = niceStep(era.b - era.a);
    for (let y = Math.ceil(era.a / st) * st; y <= era.b; y += st) tick(y, fmtYr(y));
    if (era.b - era.a < 30) for (let y = Math.ceil(era.a); y < era.b; y++) for (let q = 1; q < 4; q++) tick(y + q / 4, '', false);
  } else {
    for (const e of ERAS) tick(e.a, fmtYr(e.a));
    for (let y = 1095; y <= 1103; y++) tick(y, y % 2 === 1 ? String(y) : '', y % 2 === 1);
  }
  ax += `<text x="${padL}" y="${axisY + 44}" style="fill:#8d8a83;font-size:9px">${era ? `${era.zh} · 线性比例 · 共 ${evs.length} 个事件` : '总览：越早的时代压缩越多，点击上方时代条放大'}</text>`;
  $('#tl-axis').innerHTML = ax;

  // 时代条（顶部，可点击放大 / 返回总览）
  let bands = '';
  if (era) bands = `<button class="tl-era back" data-era="" style="left:${padL}px">← 全部时代</button><div class="tl-era on" style="left:${padL + 92}px;right:60px"><b>${era.zh}</b><i>${era.en}</i><span>${fmtYr(era.a)} — ${fmtYr(era.b)}</span></div>`;
  else bands = ERAS.map((e) => `<button class="tl-era" data-era="${e.id}" style="left:${X(e.a)}px;width:${X(e.b) - X(e.a) - 2}px" title="${e.zh} ${fmtYr(e.a)} — ${fmtYr(e.b)}"><b>${e.zh}</b><i>${e.en}</i></button>`).join('');

  // 事件卡片：按车道排布，放不下的只显示菱形点（悬停看名称）
  const lanesY = [30, 68, 106], laneEnd = [-1e9, -1e9, -1e9], CARD = 150;
  const order = [...evs].sort((p, q) => (era ? 0 : (q.major ? 1 : 0) - (p.major ? 1 : 0)) || p.t - q.t);
  const placed = new Map();
  for (const e of order) {
    const x = X(e.t);
    // 卡片朝右展开；靠近右端时朝左
    const flip = x + CARD > W - 10;
    const x0 = flip ? x - CARD : x, x1 = flip ? x : x + CARD;
    let lane = -1;
    for (let i = 0; i < 3; i++) if (!(placed.get(i) || []).some(([l, r]) => x0 < r + 6 && x1 > l - 6)) { lane = i; break; }
    if (lane >= 0) { placed.set(lane, [...(placed.get(lane) || []), [x0, x1]]); e._lane = lane; e._flip = flip; } else e._lane = -1;
  }
  $('#tl-nodes').innerHTML = bands + evs.map((e) => {
    const x = X(e.t), lane = e._lane;
    if (lane < 0) return `<div class="tl-ev mini" data-id="${e.id}" style="left:${x}px;top:${axisY - 5}px" title="${e.yr} ${e.zh}"><div class="dot" style="top:0"></div></div>`;
    const top = lanesY[lane];
    return `<div class="tl-ev${e._flip ? ' flip' : ''}" data-id="${e.id}" style="left:${x}px;top:${top}px"><div class="card"><span class="yr">${e.yr}${e.tbd ? '*' : ''}</span><b>${e.zh}</b><em>${nameOf(e.loc)}${NAT[natOf(e)] && natOf(e) !== e.loc ? ' · ' + NAT[natOf(e)].en : ''}</em></div>
      <div class="stem" style="top:38px;height:${axisY - top - 38}px"></div><div class="dot" style="top:${axisY - top - 5}px"></div></div>`;
  }).join('') + `<div id="tl-cursor"><i></i><b></b></div>`;
  $('#tl-range').textContent = era ? `${era.zh} · ${fmtYr(era.a)} — ${fmtYr(era.b)}` : '全部时代';
  markTimeline();
}
function zoomEra(id) { tlEra = id || null; buildTimeline(); }
function placeCursor() {
  const c = $('#tl-cursor'); if (!c) return;
  const vis = state.year >= tlRange[0] && state.year <= tlRange[1];
  c.style.display = vis ? '' : 'none';
  c.style.transform = `translateX(${tlX(state.year).toFixed(1)}px)`;
  const b = c.querySelector('b');
  b.textContent = '泰拉历 ' + fmtYr(state.year); b.style.top = tlAxisY + 24 + 'px';
  c.querySelector('i').style.height = tlAxisY + 'px';
  $('#tl-year').textContent = fmtYr(state.year);
}
function markTimeline() {
  const sel = state.sel;
  placeCursor();
  document.querySelectorAll('.tl-ev').forEach((el) => {
    const e = EVT[el.dataset.id];
    el.classList.toggle('future', e.t > state.year + 1e-6);
    el.classList.toggle('on', sel?.type === 'event' && sel.id === e.id);
    const rel = sel && ((sel.type === 'nation' && (natOf(e) === sel.id || e.rel.includes(sel.id))) || (sel.type === 'city' && (e.loc === sel.id || e.rel.includes(sel.id))) || (sel.type === 'chapter' && CH[sel.id].ev.includes(e.id)));
    el.classList.toggle('rel', !!rel);
  });
}
$('#tl-nodes').addEventListener('click', (e) => {
  const b = e.target.closest('[data-era]');
  if (b) { zoomEra(b.dataset.era); return; }
  const n = e.target.closest('.tl-ev'); if (n) select('event', n.dataset.id);
});

// ---------- 时间：拖动时间轴上的年份游标（或在刻度带上点按/拖动）
function setYear(y, { quiet = false } = {}) {
  const prev = fmtYr(state.year);
  state.year = Math.max(Y0, Math.min(Y1, y));
  if (T.setYear() || styleOf() !== drawnStyle) { redrawBase(); }
  // 当前高亮的国家若已不存在，则取消高亮
  if (state.hiNation && !aliveAt(NAT[state.hiNation])) { state.hiNation = null; composeTexture(); }
  markTimeline();
  if (!quiet && fmtYr(state.year) !== prev) { if (!state.sel || state.sel.type === 'nation') renderPanel(); if (state.paper) renderPaper(); }
}
let yearDrag = false;
tlTrack.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.tl-ev .card')) return; // 点卡片 = 选事件
  const r = tlTrack.getBoundingClientRect();
  const onCursor = e.target.closest('#tl-cursor');
  if (!onCursor && e.clientY - r.top < tlAxisY - 16) return; // 只在刻度带或游标上开始拖动
  yearDrag = true; tlTrack.setPointerCapture(e.pointerId); tlTrack.classList.add('drag');
  setYear(tlYear(e.clientX - r.left));
  e.preventDefault();
});
tlTrack.addEventListener('pointermove', (e) => {
  if (!yearDrag) return;
  setYear(tlYear(e.clientX - tlTrack.getBoundingClientRect().left));
});
const endDrag = () => { if (!yearDrag) return; yearDrag = false; tlTrack.classList.remove('drag'); };
tlTrack.addEventListener('pointerup', endDrag);
tlTrack.addEventListener('pointercancel', endDrag);

// ---------- 史料：某国截至当前年份的全部记录，统一叫「X史料」，版式固定。
// 每一条记录各自标注出处：事件可在数据里写 src 指定；没写的按事件发生的时代给出当时可能的资料形式。
const SOURCE_FORM = { prehistory: '遗迹考察记录', predecessor: '遗迹考察记录', precommon: '古史残卷', precrystal: '编年史', crystal: '公报', present: '纪事报' };
const srcOf = (e) => e.src || `${NAT[natOf(e)]?.zh ?? '泰拉'}${SOURCE_FORM[eraOf(e.t).id]}`;
const srcTag = (e) => `<span class="src-tag">出处 · 《${srcOf(e)}》</span>`;
const paperEl = $('#paper');
const paras = (t) => t.split('\n\n').map((p) => `<p>${p}</p>`).join('');
function openPaper(nat, ev) { state.paper = { nat, ev: ev || null }; paperEl.hidden = false; renderPaper(); paperEl.scrollTop = 0; }
function closePaper() { state.paper = null; paperEl.hidden = true; }
function renderPaper() {
  const { nat } = state.paper, n = NAT[nat], Y = fmtYr(state.year);
  const all = eventsOf(nat), shown = all.filter((e) => e.t <= state.year + 1e-6), later = all.length - shown.length;
  let lead = state.paper.ev && EVT[state.paper.ev];
  if (lead && lead.t > state.year + 1e-6) lead = null; // 当前年份之后的记录尚未出现
  lead = lead || shown[shown.length - 1];
  const gone = n.life?.[1] != null && state.year >= n.life[1];
  const notYet = n.life?.[0] != null && state.year < n.life[0];
  const mats = lead ? [...(lead.mats || []), ...(FRAGMENTS[lead.loc] || [])] : [];
  const fig = mats.find((m) => m.k === 'photo') || mats[0];
  const others = shown.filter((e) => e !== lead).reverse();
  const elsewhere = lead ? EVENTS.filter((e) => !all.includes(e) && Math.abs(e.t - lead.t) <= 1.2 && e.t <= state.year + 1e-6)
    .sort((a, b) => Math.abs(a.t - lead.t) - Math.abs(b.t - lead.t)).slice(0, 4) : [];
  const places = lead ? [lead.loc, ...lead.rel].filter((x) => x != null) : [];
  paperEl.innerHTML = `
  <div class="pp-bar"><button data-pp-close>← 返回地图</button><span class="mono">RECORDS / ${n.code} / ${Y}</span>
    <label>换一个国家 <select data-pp-switch>${NATIONS.map((m) => `<option value="${m.id}"${m.id === nat ? ' selected' : ''}>${m.zh}史料${aliveAt(m) ? '' : '（已不存在）'}</option>`).join('')}</select></label>
    <span class="hint">拖动下方时间轴，收录的记录随年份更新</span></div>
  <article class="pp-sheet">
    <header class="pp-mast">
      <div class="ear">泰拉历 ${Y} 年<br>当前历史线</div>
      <div class="title"><h1>${n.zh}史料</h1><div class="sub">RECORDS OF ${n.en}</div></div>
      <div class="ear r">PRTS 档案重排版<br>共 ${all.length} 条记录</div>
    </header>
    <div class="pp-rule"><span>当前历史线 · 截至泰拉历 ${Y} 年</span><span>已收录 ${shown.length} / 共 ${all.length} 条</span></div>
    ${gone ? `<div class="pp-stamp">${n.zh}已于泰拉历 ${n.life[1]} 年消亡${n.tbd ? ' *' : ''}<i>以下为它存在期间留下的记录</i></div>` : ''}
    ${notYet ? `<div class="pp-stamp">${n.zh}尚未建立<i>泰拉历 ${n.life[0]} 年后才有记录</i></div>` : ''}
    ${!lead ? `<div class="pp-empty">截至泰拉历 ${Y} 年，尚无与${n.zh}相关的记录。<br>向右拖动时间轴，查看之后发生的事。</div>` : `
    <div class="pp-grid">
      <div class="pp-lead">
        <div class="kicker">${state.paper.ev ? '记录' : '最新记录'} · ${lead.yr}${lead.tbd ? '*' : ''} · ${nameOf(lead.loc)}${tbd(lead)}</div>
        <h2>${lead.zh}</h2><div class="en">${lead.en}</div>${srcTag(lead)}
        <p class="deck">${lead.sum}</p>
        ${fig ? `<figure class="pp-fig">${fragSVG(fig.k, lead.id.length * 11 + 5, 520, 230)}<figcaption>图 · ${fig.cap}</figcaption></figure>` : ''}
        <div class="pp-body">${paras(lead.body || lead.sum)}</div>
        <div class="pp-act"><button data-pp-map="${lead.id}">在地图上定位此事件 →</button></div>
        <h4>相关材料 MATERIALS <span>${mats.length}</span></h4>
        <div class="pp-mats">${mats.map((m, i) => `<figure>${fragSVG(m.k, i * 13 + lead.id.length)}<figcaption>材料 ${String(i + 1).padStart(2, '0')} · ${m.cap}</figcaption></figure>`).join('') || '<p class="muted">暂无材料，待补充。</p>'}</div>
        <h4>相关地点 PLACES</h4>
        <div class="pp-tags">${places.map((id) => `<a data-pp-sel="${CITY[id] ? 'city' : NAT[id] ? 'nation' : 'region'}:${id}">${nameOf(id)}</a>`).join('')}</div>
        <p class="muted src">资料来源：PRTS Wiki「泰拉年表」、Arknights Terra Wiki「Timeline」；标 * 的年份或译名待核对。</p>
      </div>
      <aside class="pp-side">
        <h4>国家概况</h4>
        <dl><dt>政体</dt><dd>${n.gov}</dd><dt>地形</dt><dd>${n.terrain}</dd><dt>首都</dt><dd>${n.capital ? nameOf(n.capital) : '—'}</dd><dt>存续</dt><dd>${lifeTxt(n)}</dd></dl>
        <h4>其他记录 <span>${others.length}</span></h4>
        ${others.map((e) => `<div class="pp-item" data-pp-ev="${e.id}"><span>${e.yr}${e.tbd ? '*' : ''}</span><b>${e.zh}</b>${srcTag(e)}<p>${e.sum}</p></div>`).join('') || '<p class="muted">无其他记录。</p>'}
        ${later ? `<div class="pp-locked">还有 ${later} 条记录发生在 ${Y} 年之后<br>向右拖动时间轴解锁</div>` : ''}
        ${elsewhere.length ? `<h4>同期他国 ELSEWHERE</h4>${elsewhere.map((e) => `<div class="pp-item" data-pp-other="${e.id}"><span>${e.yr}</span><b>${e.zh}</b>${srcTag(e)}<p>${e.sum}</p></div>`).join('')}` : ''}
      </aside>
    </div>`}
  </article>`;
}
paperEl.addEventListener('click', (e) => {
  const t = e.target;
  if (t.closest('[data-pp-close]')) return closePaper();
  const ev = t.closest('[data-pp-ev]');
  if (ev) { state.paper.ev = ev.dataset.ppEv; renderPaper(); paperEl.scrollTop = 0; return; }
  const other = t.closest('[data-pp-other]');
  if (other) { const o = EVT[other.dataset.ppOther]; if (natOf(o)) openPaper(natOf(o), o.id); return; }
  const m = t.closest('[data-pp-map]');
  if (m) { closePaper(); select('event', m.dataset.ppMap); return; }
  const s = t.closest('[data-pp-sel]');
  if (s) { closePaper(); const [type, id] = s.dataset.ppSel.split(':'); select(type, id); }
});
paperEl.addEventListener('change', (e) => { if (e.target.matches('[data-pp-switch]')) openPaper(e.target.value); });

// ---------- HUD & input
$('#nav').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  document.querySelectorAll('#nav button').forEach((x) => x.classList.toggle('on', x === b));
  state.tab = b.dataset.tab;
  if (state.paper) closePaper();
  if (state.tab === 'map') select(null); else { state.sel = null; relevant.clear(); refreshLabelClasses(); renderPanel(); markTimeline(); buildFrags(); if (state.hiNation) { state.hiNation = null; composeTexture(); } }
});
$('#view-seg').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.view === 'reset') { select(null); return; }
  state.view = b.dataset.view;
  document.querySelectorAll('#view-seg [data-view]').forEach((x) => x.classList.toggle('on', x.dataset.view === state.view));
  flyTo({ polar: state.view === 'top' ? 0.0005 : TILT, theta: state.view === 'top' ? 0 : undefined }, 700);
});
$('#layers').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const k = b.dataset.layer; state.layers[k] = !state.layers[k]; b.classList.toggle('on', state.layers[k]);
  if (k === 'collage') buildFrags(); else redrawBase();
});
addEventListener('keydown', (e) => { if (e.key !== 'Escape') return; if (state.paper) closePaper(); else select(null); });

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hoverPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.1), hit = new THREE.Vector3();
const toNdc = (e) => { const r = renderer.domElement.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); };
const fmtCoord = (sx, sy) => { const lat = -(sy - 980) / 1560 * 140, lon = (sx - 680) / 1280 * 180; return `${lat < 0 ? 'S' : 'N'} ${Math.abs(lat).toFixed(1).padStart(4, '0')}° · ${lon < 0 ? 'W' : 'E'} ${Math.abs(lon).toFixed(1).padStart(5, '0')}°`; };
let down = null;
const cv = renderer.domElement;
cv.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; tween = null; });
cv.addEventListener('pointerup', (e) => {
  if (!down || e.button !== 0 || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return (down = null);
  down = null; toNdc(e); ray.setFromCamera(ndc, camera);
  const h = ray.intersectObject(terrain)[0];
  if (!h) return select(null);
  const o = T.ownerAt(...toSrc(h.point.x, h.point.z));
  o >= 0 ? select('nation', NATIONS[o].id) : select(null);
});
const tip = $('#tip');
cv.addEventListener('pointermove', (e) => {
  toNdc(e); ray.setFromCamera(ndc, camera);
  hoverPlane.constant = -0.1 * state.relief;
  if (!ray.ray.intersectPlane(hoverPlane, hit)) return;
  const [sx, sy] = toSrc(hit.x, hit.z);
  $('#coord').textContent = fmtCoord(sx, sy);
  const o = e.buttons ? -1 : T.ownerAt(sx, sy);
  cv.style.cursor = o >= 0 ? 'pointer' : 'grab';
  if (o >= 0) {
    const r = mapEl.getBoundingClientRect();
    tip.style.display = 'block'; tip.innerHTML = `${NATIONS[o].zh}<i>${NATIONS[o].en}</i>`;
    tip.style.transform = `translate(${e.clientX - r.left + 14}px,${e.clientY - r.top + 14}px)`;
  } else tip.style.display = 'none';
});
cv.addEventListener('pointerleave', () => (tip.style.display = 'none'));

// ---------- scale bar / compass
const right = new THREE.Vector3(), pA = new THREE.Vector3(), pB = new THREE.Vector3();
function updateHud() {
  right.setFromMatrixColumn(camera.matrixWorld, 0);
  pA.copy(controls.target).project(camera); pB.copy(controls.target).add(right).project(camera);
  const pxPerUnit = Math.abs(pB.x - pA.x) / 2 * mapW, kmPerPx = 500 / pxPerUnit; // 1 世界单位 ≈ 500 km（虚构比例）
  const nice = [100, 200, 500, 1000, 2000, 5000].find((k) => k / kmPerPx >= 50) ?? 5000;
  $('#scale-bar').style.width = (nice / kmPerPx).toFixed(0) + 'px';
  $('#scale-txt').textContent = nice + ' km';
  $('#compass i').style.transform = `rotate(${controls.getAzimuthalAngle()}rad)`;
}

// ---------- layout & loop
function resize() {
  const r = mapEl.getBoundingClientRect();
  mapW = r.width; mapH = r.height; mapRect = r;
  renderer.setSize(mapW, mapH); camera.aspect = mapW / mapH; camera.updateProjectionMatrix();
  buildTimeline();
}
new ResizeObserver(resize).observe(mapEl);
resize();
renderPanel();
setInterval(() => ($('#clock').textContent = new Date().toTimeString().slice(0, 8)), 1000);
$('#loading').remove();

function loop(now) {
  requestAnimationFrame(loop);
  if (!stepTween(now)) controls.update();
  renderer.render(scene, camera);
  updateLabels(camera.position.distanceTo(controls.target));
  drawOverlay();
  updateHud();
}
requestAnimationFrame(loop);
