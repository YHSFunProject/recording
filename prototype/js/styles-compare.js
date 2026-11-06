// 视觉方向对比页：同一界面，三套主题。静态示意，不含 3D 与交互。
import { NATIONS, CITIES } from './data.js';
import { COAST, NATION_SHAPES } from './geo-vectors.js';
import { RIVERS, RIDGES } from './terrain.js';
import { fragSVG } from './collage.js';

const SEL = 'victoria';
const VB = [170, 555, 1000, 573]; // 聚焦大陆中部（维多利亚周边），保证示意图里的字号可读

// 平滑折线（经过中点的二次曲线）
function smoothPath(pts) {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i], [nx, ny] = pts[i + 1];
    d += ` Q${x} ${y} ${(x + nx) / 2} ${(y + ny) / 2}`;
  }
  const l = pts[pts.length - 1];
  return d + ` L${l[0]} ${l[1]}`;
}
// 沿山脊折线取等距点（用于画山形符号）
function along(pts, step) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], L = Math.hypot(bx - ax, by - ay);
    for (let s = 0; s < L; s += step) out.push([ax + (bx - ax) * s / L, ay + (by - ay) * s / L]);
  }
  return out;
}

function mapSVG(theme) {
  const [x0, y0, w, h] = VB;
  let s = `<svg class="m" viewBox="${x0} ${y0} ${w} ${h}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="land-${theme}"><path d="${COAST}" clip-rule="evenodd"/></clipPath>
    <pattern id="hatch-${theme}" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="10" class="hatch"/></pattern>
    <pattern id="waves-${theme}" width="46" height="22" patternUnits="userSpaceOnUse"><path d="M2 12 q 5.5 -6 11 0 t 11 0" class="wave"/></pattern>
  </defs>
  <rect class="sea" x="${x0 - 200}" y="${y0 - 200}" width="${w + 400}" height="${h + 400}"/>
  <rect class="sea-tex" x="${x0 - 200}" y="${y0 - 200}" width="${w + 400}" height="${h + 400}" fill="url(#waves-${theme})"/>`;
  // 近岸等深线：同一轮廓多次加粗描边、逐层变淡
  s += `<g class="bathy">${[34, 20, 9].map((sw, i) => `<path d="${COAST}" style="stroke-width:${sw}" class="b${i}"/>`).join('')}</g>`;
  s += `<path class="land" d="${COAST}" fill-rule="evenodd"/>`;
  // 经纬网
  let g = '';
  for (let x = 120; x < x0 + w; x += 120) g += `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y0 + h}"/>`;
  for (let y = 260; y < y0 + h; y += 120) g += `<line x1="${x0}" y1="${y}" x2="${x0 + w}" y2="${y}"/>`;
  s += `<g class="grid">${g}</g>`;
  // 国家地块
  s += `<g class="nations" clip-path="url(#land-${theme})">`;
  NATIONS.forEach((n, i) => {
    const d = NATION_SHAPES[n.id]; if (!d) return;
    s += `<path d="${d}" class="nat c${i % 6}${n.id === SEL ? ' sel' : ''}"/>`;
  });
  s += `<path d="${NATION_SHAPES[SEL]}" class="sel-hatch" fill="url(#hatch-${theme})"/></g>`;
  // 山脉与河流
  s += `<g class="ridges" clip-path="url(#land-${theme})">`;
  for (const r of RIDGES) {
    if (theme === 'B') s += along(r.p, 16).map(([x, y]) => `<path class="peak" d="M${x - 7} ${y + 5} L${x} ${y - 7 - r.h * 6} L${x + 7} ${y + 5}"/>`).join('');
    else for (let k = 1; k <= 3; k++) s += `<path class="rg rg${k}" d="${smoothPath(r.p)}" style="stroke-width:${(r.w * 0.55 * k) / 3}"/>`;
  }
  s += `</g><g class="rivers" clip-path="url(#land-${theme})">${RIVERS.map((r) => `<path d="${smoothPath(r)}"/>`).join('')}</g>`;
  s += `<path class="coast" d="${COAST}" fill-rule="evenodd"/>`;
  s += `<path class="sel-edge" d="${NATION_SHAPES[SEL]}"/>`;
  // 城市
  for (const c of CITIES) {
    if (!c.cap && !['lungmen', 'chernobog'].includes(c.id)) continue;
    const [x, y] = c.at, on = c.nation === SEL;
    s += c.cap ? `<rect class="city cap${on ? ' on' : ''}" x="${x - 5}" y="${y - 5}" width="10" height="10"/>` : `<circle class="city${on ? ' on' : ''}" cx="${x}" cy="${y}" r="5"/>`;
    if (on || ['lungmen', 'chernobog'].includes(c.id)) s += `<text class="ctl" x="${x + 9}" y="${y + 4}">${c.zh}</text>`;
  }
  // 国名
  for (const n of NATIONS) {
    if (n.life?.[1] != null) continue;
    const [x, y] = n.at, on = n.id === SEL;
    if (theme === 'A') {
      const tw = n.en.length * 8.4 + 10;
      s += `<g class="nl${on ? ' on' : ''}"><text class="zh" x="${x}" y="${y}" text-anchor="middle">${n.zh}</text>
        <rect x="${x - tw / 2}" y="${y + 5}" width="${tw}" height="15"/><text class="en" x="${x}" y="${y + 16.5}" text-anchor="middle">${n.en}</text></g>`;
    } else {
      s += `<g class="nl${on ? ' on' : ''}"><text class="zh" x="${x}" y="${y}" text-anchor="middle">${n.zh}</text><text class="en" x="${x}" y="${y + 17}" text-anchor="middle">${n.en}</text></g>`;
    }
  }
  // 未知地域
  s += `<g class="unk"><text x="440" y="250" text-anchor="middle">未知地域</text><text class="en" x="440" y="268" text-anchor="middle">${theme === 'B' ? 'TERRA INCOGNITA' : 'UNKNOWN AREA · DATA NOT FOUND'}</text></g>`;
  return s + '</svg>';
}

// 时间轴：分时代、断轴（前文明 → 当代），预览「深时间」时间轴的样子
const ERAS = [
  { zh: '前文明', en: 'PRECURSORS', span: '年代不可考', w: 12 },
  { zh: '古代', en: 'ANTIQUITY', span: '诸国建立', w: 14 },
  { zh: '中世', en: 'MIDDLE AGES', span: '战争与迁徙', w: 16 },
  { zh: '近代', en: 'MODERN', span: '≈ 1000 – 1090', w: 22 },
  { zh: '当代', en: 'PRESENT', span: '1090 – 1099', w: 36 },
];
const TL_EV = [
  { era: 0, x: .5, yr: '???', zh: '前文明遗迹' },
  { era: 1, x: .45, yr: '古代*', zh: '萨卡兹与卡兹戴尔' },
  { era: 2, x: .5, yr: '中世*', zh: '维多利亚王朝' },
  { era: 3, x: .3, yr: '≈1050*', zh: '大静谧' },
  { era: 3, x: .8, yr: '≈1080*', zh: '高卢亡国' },
  { era: 4, x: .2, yr: '1094*', zh: '巴别塔与卡兹戴尔' },
  { era: 4, x: .55, yr: '1097', zh: '切尔诺伯格事变' },
  { era: 4, x: .9, yr: '1098*', zh: '伦蒂尼姆之战', on: true },
];
function timeline() {
  let x = 0;
  const bands = ERAS.map((e, i) => { const b = `<div class="era" style="left:${x}%;width:${e.w}%"><b>${e.zh}</b><i>${e.en}</i><span>${e.span}</span></div>`; x += e.w; return b; }).join('');
  const starts = []; x = 0; for (const e of ERAS) { starts.push(x); x += e.w; }
  const evs = TL_EV.map((e, i) => {
    const left = starts[e.era] + ERAS[e.era].w * e.x;
    return `<div class="ev${e.on ? ' on' : ''}${left > 80 ? ' flip' : ''}" style="left:${left}%;--lane:${i % 2}"><div class="card"><span>${e.yr}</span><b>${e.zh}</b></div><div class="stem"></div><div class="dot"></div></div>`;
  }).join('');
  const now = starts[4] + ERAS[4].w * 0.92;
  return `<div class="tl-in"><div class="eras">${bands}</div><div class="axis"></div>${evs}<div class="now" style="left:${now}%"><b>泰拉历 1098</b></div></div>`;
}

function panel(theme) {
  const n = NATIONS.find((x) => x.id === SEL);
  return `<div class="crumb">ARCHIVE / NATION / VI</div>
  <div class="ph"><div class="emb">VI</div><div><h2>${n.zh}</h2><div class="en">${n.en}</div></div></div>
  <dl><dt>政体</dt><dd>${n.gov}</dd><dt>首都</dt><dd>伦蒂尼姆</dd><dt>地形</dt><dd>${n.terrain}</dd><dt>存续</dt><dd>— 今</dd></dl>
  <p class="sum">${n.sum}</p>
  <button class="cta">阅读《维多利亚纪事报》<i>截至 1098 →</i></button>
  <h4>相关事件 <span>3</span></h4>
  <ul><li><span>1094*</span>巴别塔与卡兹戴尔</li><li><span>1098*</span>伦蒂尼姆之战</li><li><span>≈1080*</span>高卢亡国</li></ul>
  <h4>档案碎片 <span>2</span></h4>
  <div class="figs"><figure>${fragSVG('photo', theme.charCodeAt(0) * 3)}<figcaption>城区街景</figcaption></figure><figure>${fragSVG('elev', 9)}<figcaption>城墙立面</figcaption></figure></div>`;
}

function frame(theme) {
  return `<div class="frame t${theme}">
    <header class="f-top"><div class="brand"><span class="mark"></span><b>泰拉纪事馆</b><i>TERRA ARCHIVE</i></div>
      <nav>${['总览', '国家', '城市', '历史', '剧情', '时报', '词条'].map((t, i) => `<span${i === 1 ? ' class="on"' : ''}>${t}</span>`).join('')}</nav><div class="sys">PRTS · 1098</div></header>
    <div class="f-map">${mapSVG(theme)}
      <div class="deco cartouche"><b>泰拉全图</b><i>TABULA TERRAE · 1098</i></div>
      <div class="deco scale"><span></span>1000 km</div>
      <div class="deco compass"><i></i>N</div>
    </div>
    <aside class="f-panel">${panel(theme)}</aside>
    <section class="f-tl"><div class="tl-head"><b>历史图景</b><i>CHRONICLE</i></div>${timeline()}</section>
  </div>`;
}

const INFO = {
  A: { name: '终端档案', en: 'PRTS TERMINAL', key: '冷静 · 精确 · 技术感',
    desc: '延续游戏内 PRTS 终端的语言：白底、黑字、等宽字体、细线、编号和测绘标注。地图像一份测绘档案，国名用黑底英文条。黄色只用于选中和关键操作。',
    good: '和游戏 UI 最接近，粉丝认同感强；信息密度高，适合查资料。', risk: '偏冷、偏工具，对不熟悉设定的新人不够亲切。',
    sw: ['#f1f0ec', '#fbfaf7', '#d6d3cb', '#1d1d1b', '#8d8a83', '#f2c300'], font: '等宽 Consolas / 无衬线 雅黑' },
  B: { name: '历史地图集', en: 'HISTORICAL ATLAS', key: '温暖 · 学术 · 可读',
    desc: '像一本历史与地理课本里的地图集：米黄纸张、衬线字体、柔和的国家着色、山形符号、波纹海面和地图题框。选中的国家用斜线与深色描边强调。',
    good: '最贴近「历史书 / 地理书」的学习感，各国区分一目了然，适合讲解历史变迁。', risk: '和游戏的科幻 UI 风格距离较远；彩色地块需要克制，否则显得幼稚。',
    sw: ['#efe6d2', '#f7f0df', '#c9d6d3', '#3b2f22', '#9a3b2a', '#d7c39a'], font: '衬线 宋体 / Georgia 斜体' },
  C: { name: '展陈馆', en: 'MUSEUM EXHIBITION', key: '沉浸 · 戏剧性 · 聚焦',
    desc: '像博物馆里的互动展陈：深色背景，地图是被灯光照亮的浮雕模型，标题用大号衬线，标注用细等宽字。黄色作为「聚光灯」，只照在当前选中的内容上。',
    good: '氛围最强，适合叙事和剧情回顾，截图传播效果好。', risk: '长时间阅读较累；深色下的细节和小字需要更多调试。',
    sw: ['#141518', '#1f2125', '#34373d', '#e9e6df', '#8b8f96', '#f2c300'], font: '衬线 宋体 标题 / 等宽 标注' },
};

const root = document.getElementById('cmp');
root.innerHTML = ['A', 'B', 'C'].map((t) => {
  const I = INFO[t];
  return `<section class="dir" id="${t}">
    <div class="dir-head"><span class="tag">${t}</span><div><h2>${I.name}<i>${I.en}</i></h2><div class="key">${I.key}</div></div></div>
    <div class="stage"><div class="fit">${frame(t)}</div></div>
    <div class="dir-info">
      <p>${I.desc}</p>
      <dl><dt>优点</dt><dd>${I.good}</dd><dt>风险</dt><dd>${I.risk}</dd><dt>字体</dt><dd>${I.font}</dd></dl>
      <div class="sw">${I.sw.map((c) => `<span style="background:${c}" title="${c}"><i>${c}</i></span>`).join('')}</div>
    </div>
  </section>`;
}).join('');

// 把 1280×760 的画框按容器宽度等比缩放
function fit() {
  document.querySelectorAll('.stage').forEach((st) => {
    const k = Math.min(1, st.clientWidth / 1280);
    const f = st.querySelector('.fit'); f.style.transform = `scale(${k})`; st.style.height = 760 * k + 'px';
  });
}
addEventListener('resize', fit); fit();
