// 程序生成的泰拉浅浮雕地形 + 测绘风格贴图。
// 轮廓用椭圆块并集 + 噪声近似设定图；国界用六边形地块（呼应「实控地块」表达）。

export const MAP = { SX0: 40, SY0: 200, W: 1280, H: 1560, GW: 321, GH: 391, TW: 3072, TH: 3744 };
// 绘制逻辑按 2048 宽的「逻辑贴图」坐标书写，再整体缩放到实际贴图分辨率
const LW = 2048, LH = 2496, K = LW / MAP.W, SC = MAP.TW / LW;
export const toWorld = (sx, sy) => [(sx - 680) / 40, (sy - 980) / 40];
export const toSrc = (x, z) => [x * 40 + 680, z * 40 + 980];

// ---------- noise
function hash(x, y) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, oct = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * (vnoise(x * f, y * f) * 2 - 1); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// 脊状噪声：山脊连续、山谷分叉，避免圆包状山体
function ridged(x, y, oct = 3) {
  let s = 0, a = 0.5, f = 1, w = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    let v = 1 - Math.abs(vnoise(x * f + i * 17, y * f) * 2 - 1);
    v *= v; v *= w; w = Math.min(1, v * 1.8);
    s += v * a; n += a; a *= 0.5; f *= 2.1;
  }
  return s / n;
}

// ---------- geography (设定图像素坐标)
export const RIDGES = [
  { p: [[360, 515], [500, 525], [640, 535]], h: 0.55, w: 30 },
  { p: [[470, 780], [500, 820], [525, 880]], h: 0.95, w: 24 },
  { p: [[880, 640], [905, 700], [925, 760]], h: 0.7, w: 26 },
  { p: [[1030, 700], [1060, 770], [1060, 820]], h: 0.6, w: 28 },
  { p: [[195, 670], [195, 770], [205, 900]], h: 0.5, w: 22 },
  { p: [[290, 960], [360, 985], [440, 1000]], h: 0.45, w: 22 },
  { p: [[820, 975], [880, 1000], [930, 1020]], h: 0.5, w: 24 },
  { p: [[640, 760], [690, 790]], h: 0.4, w: 20 },
  { p: [[300, 1300], [360, 1380], [380, 1480]], h: 0.4, w: 30 },
];
export const RIVERS = [
  [[505, 860], [540, 900], [560, 950], [545, 1000]],
  [[900, 700], [880, 760], [860, 820], [828, 848]],
  [[1040, 720], [990, 790], [1000, 860], [1012, 872]],
  [[200, 700], [300, 760], [380, 830], [420, 900]],
  [[690, 620], [640, 680], [612, 700]],
  [[360, 995], [330, 1060], [300, 1140], [250, 1210]],
  [[680, 800], [700, 870], [720, 930]],
];
const UNKNOWN = [420, 265, 135];

// 海陆场：由 tools/trace_land.py 从参考地图提取的有符号距离场（陆地为正，单位 px），2px 一格
const LG = { X0: 40, Y0: 200, W: 641, H: 781, STEP: 2 };
let LAND_SDF = null;
export async function loadLand(url) {
  // 用 onload 而不是 img.decode()：后台/隐藏标签页里 decode() 可能迟迟不返回
  const img = new Image();
  await new Promise((ok, fail) => { img.onload = ok; img.onerror = () => fail(new Error('无法加载 ' + url)); img.src = url; });
  const cv = document.createElement('canvas'); cv.width = LG.W; cv.height = LG.H;
  const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0);
  const d = cx.getImageData(0, 0, LG.W, LG.H).data;
  LAND_SDF = new Float32Array(LG.W * LG.H);
  for (let i = 0; i < LAND_SDF.length; i++) LAND_SDF[i] = (d[i * 4] - 128) / 3;
}
function landField(x0, y0) {
  const gx = Math.min(LG.W - 1.001, Math.max(0, (x0 - LG.X0) / LG.STEP)), gy = Math.min(LG.H - 1.001, Math.max(0, (y0 - LG.Y0) / LG.STEP));
  const i = Math.floor(gx), j = Math.floor(gy), u = gx - i, v = gy - j, k = j * LG.W + i, A = LAND_SDF;
  const d = (A[k] * (1 - u) + A[k + 1] * u) * (1 - v) + (A[k + LG.W] * (1 - u) + A[k + LG.W + 1] * u) * v;
  return d / 100;
}
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
function heightAt(x, y, f) {
  if (f <= 0) return -0.04;
  // 海岸缓坡抬升 → 平原：低而平，保持留白
  const coast = smooth(0, 0.2, f);
  let h = 0.015 + 0.09 * coast + Math.max(0, fbm(x / 170, y / 170, 3)) * 0.06 * coast;
  for (const r of RIDGES) {
    let d = Infinity;
    for (let i = 0; i < r.p.length - 1; i++) d = Math.min(d, segDist(x, y, ...r.p[i], ...r.p[i + 1]));
    d += fbm(x / 50, y / 50, 2) * 16;
    const m = Math.exp(-(d * d) / (r.w * r.w * 2.4));
    if (m > 0.004) h += r.h * m * (0.3 + 0.9 * ridged(x / 46, y / 46));
  }
  return -0.04 + (h + 0.04) * smooth(0, 0.025, f);
}

// ---------- hex grid (pointy-top, axial)
const S = 13, SQ3 = Math.sqrt(3);
const DIRS = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
const hexXY = (q, r) => [MAP.SX0 + S * SQ3 * (q + r / 2), MAP.SY0 + 1.5 * S * r];
function hexRound(fq, fr) {
  const x = fq, z = fr, y = -x - z;
  let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
  const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
  return [rx, rz];
}
const pixelHex = (x, y) => { x -= MAP.SX0; y -= MAP.SY0; return hexRound((SQ3 / 3 * x - y / 3) / S, (2 / 3 * y) / S); };
const corner = (cx, cy, i) => { const a = Math.PI / 180 * (60 * i - 30); return [(cx + S * Math.cos(a) - MAP.SX0) * K, (cy + S * Math.sin(a) - MAP.SY0) * K]; };

// alive(n): 该国在当前年份是否存续；国界随年份重算（setYear）
export function buildTerrain(nations, alive = () => true) {
  const { GW, GH, W, H, SX0, SY0, TW, TH } = MAP;
  const cw = W / (GW - 1), ch = H / (GH - 1);
  const F = new Float32Array(GW * GH), Hh = new Float32Array(GW * GH);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const x = SX0 + i * cw, y = SY0 + j * ch, k = j * GW + i;
    F[k] = landField(x, y); Hh[k] = heightAt(x, y, F[k]);
  }
  const sample = (arr, x, y) => {
    const gx = Math.min(GW - 1.001, Math.max(0, (x - SX0) / cw)), gy = Math.min(GH - 1.001, Math.max(0, (y - SY0) / ch));
    const i = Math.floor(gx), j = Math.floor(gy), u = gx - i, v = gy - j, k = j * GW + i;
    return (arr[k] * (1 - u) + arr[k + 1] * u) * (1 - v) + (arr[k + GW] * (1 - u) + arr[k + GW + 1] * u) * v;
  };
  // 平滑后的高度场只用于等高线，让线条干净、不随细碎噪声抖动
  const Hs = Float32Array.from(Hh);
  for (let pass = 0; pass < 2; pass++) {
    const src = Float32Array.from(Hs);
    for (let j = 1; j < GH - 1; j++) for (let i = 1; i < GW - 1; i++) {
      const k = j * GW + i;
      Hs[k] = (src[k] * 4 + src[k - 1] + src[k + 1] + src[k - GW] + src[k + GW]) / 8;
    }
  }

  // nations → hex owners
  const nationAt = (x, y) => {
    const px = x + fbm(x / 140, y / 140, 3) * 30, py = y + fbm(x / 140 + 50, y / 140, 3) * 30;
    let best = -1, bd = 1;
    nations.forEach((n, i) => {
      if (!n.own || !alive(n)) return;
      const [cx, cy, rx, ry] = n.own, dx = (px - cx) / rx, dy = (py - cy) / ry, d = Math.hypot(dx, dy);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  };
  const hexes = new Map();
  const rows = Math.ceil(H / (1.5 * S)) + 1;
  for (let r = 0; r <= rows; r++) {
    const q0 = -Math.floor(r / 2) - 1, q1 = Math.ceil(W / (S * SQ3)) - Math.floor(r / 2) + 1;
    for (let q = q0; q <= q1; q++) {
      const [cx, cy] = hexXY(q, r);
      if (cx < SX0 - S || cx > SX0 + W + S) continue;
      const land = sample(F, cx, cy) > 0;
      hexes.set(q + ',' + r, { q, r, cx, cy, land, owner: land ? nationAt(cx, cy) : -1 });
    }
  }
  // 按当前存续的国家重新分配地块；返回是否有变化（有变化才需要重绘底图）
  function setYear() {
    let changed = false;
    for (const h of hexes.values()) {
      if (!h.land) continue;
      const o = nationAt(h.cx, h.cy);
      if (o !== h.owner) { h.owner = o; changed = true; }
    }
    return changed;
  }
  const hexAt = (x, y) => hexes.get(pixelHex(x, y).join(','));
  const ownerAt = (x, y) => { const h = hexAt(x, y); return h && h.land ? h.owner : -1; };

  // ---------- drawing helpers
  function iso(ctx, arr, level) {
    const sx = cw * K, sy = ch * K;
    ctx.beginPath();
    for (let j = 0; j < GH - 1; j++) for (let i = 0; i < GW - 1; i++) {
      const k = j * GW + i;
      const a = arr[k] - level, b = arr[k + 1] - level, c = arr[k + GW + 1] - level, d = arr[k + GW] - level;
      const idx = (a > 0 ? 8 : 0) | (b > 0 ? 4 : 0) | (c > 0 ? 2 : 0) | (d > 0 ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const P = {
        T: [(i + a / (a - b)) * sx, j * sy], R: [(i + 1) * sx, (j + b / (b - c)) * sy],
        B: [(i + d / (d - c)) * sx, (j + 1) * sy], L: [i * sx, (j + a / (a - d)) * sy],
      };
      const segs = { 1: 'LB', 2: 'BR', 3: 'LR', 4: 'TR', 5: 'TRLB', 6: 'TB', 7: 'TL', 8: 'TL', 9: 'TB', 10: 'TLBR', 11: 'TR', 12: 'LR', 13: 'BR', 14: 'LB' }[idx];
      for (let s = 0; s < segs.length; s += 2) { ctx.moveTo(...P[segs[s]]); ctx.lineTo(...P[segs[s + 1]]); }
    }
    ctx.stroke();
  }
  const tx = (x, y) => [(x - SX0) * K, (y - SY0) * K];
  function hexPath(ctx, h) {
    for (let i = 0; i < 6; i++) ctx[i ? 'lineTo' : 'moveTo'](...corner(h.cx, h.cy, i));
    ctx.closePath();
  }
  function riverPts(pts) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      for (let t = 0; t < 1; t += 0.04) {
        const t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        const x = f(p0[0], p1[0], p2[0], p3[0]), y = f(p0[1], p1[1], p2[1], p3[1]);
        out.push([x + fbm(x / 18, y / 18, 2) * 7, y + fbm(x / 18 + 9, y / 18, 2) * 7]);
      }
    }
    return out;
  }

  const raster = (fn) => {
    const c = document.createElement('canvas'); c.width = GW; c.height = GH;
    const cx = c.getContext('2d'), img = cx.createImageData(GW, GH);
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) img.data.set(fn(i, j, j * GW + i), (j * GW + i) * 4);
    cx.putImageData(img, 0, 0);
    return c;
  };
  const landMask = raster((i, j, k) => [250, 249, 246, Math.max(0, Math.min(1, F[k] * 60 + 0.5)) * 255]);
  // 海：离岸越远越深一点；近岸浅滩提亮
  const seaTint = raster((i, j, k) => {
    const f = F[k];
    if (f >= 0) return [0, 0, 0, 0];
    return f > -0.07 ? [255, 255, 255, (1 - -f / 0.07) * 110] : [40, 42, 44, Math.min(1, (-f - 0.07) / 0.6) * 46];
  });
  // 晕渲：西北光源，只在陆地上加暗面与少量亮面
  const LX = -0.62, LY = -0.62, LZ = 0.48;
  const hill = raster((i, j, k) => {
    if (F[k] <= 0 || i === 0 || j === 0 || i === GW - 1 || j === GH - 1) return [0, 0, 0, 0];
    const dx = (Hh[k + 1] - Hh[k - 1]) * 30, dy = (Hh[k + GW] - Hh[k - GW]) * 30;
    const n = Math.hypot(dx, dy, 1), s = (-dx * LX - dy * LY + LZ) / n;
    const flat = LZ, mtn = smooth(0.16, 0.34, Hs[k]); // 只在山地晕渲，平原保持纯白
    return s < flat ? [38, 36, 32, Math.min(1, (flat - s) * 1.2) * 58 * mtn] : [255, 255, 252, Math.min(1, (s - flat) * 2) * 40 * mtn];
  });
  // 晕滃线（hachure）：沿坡向的短线，坡越陡越长越密，背光面更重
  const hachures = [new Path2D(), new Path2D(), new Path2D()];
  for (let Y = 0; Y < LH; Y += 4.5) for (let X = (Y / 4.5 % 2) * 2.25; X < LW; X += 4.5) {
    const x = SX0 + (X + (hash(X | 0, Y | 0) - 0.5) * 3) / K, y = SY0 + (Y + (hash(Y | 0, X | 0) - 0.5) * 3) / K;
    if (sample(F, x, y) <= 0.02 || sample(Hs, x, y) < 0.19) continue;
    const gx = (sample(Hh, x + 2, y) - sample(Hh, x - 2, y)) / 4, gy = (sample(Hh, x, y + 2) - sample(Hh, x, y - 2)) / 4;
    const slope = Math.hypot(gx, gy);
    if (slope < 0.0055 || hash((X * 7) | 0, (Y * 3) | 0) > Math.min(1, slope * 90) * smooth(0.19, 0.3, sample(Hs, x, y))) continue;
    const len = Math.min(8, 2 + slope * 160), ux = -gx / slope, uy = -gy / slope;
    const lit = (ux * LX + uy * LY) / Math.SQRT2 * 2; // 朝光为正
    const p = hachures[lit > 0.35 ? 0 : lit > -0.35 ? 1 : 2];
    const [px, py] = [(x - SX0) * K, (y - SY0) * K];
    p.moveTo(px, py); p.lineTo(px + ux * len, py + uy * len);
  }

  function drawBase(ctx, L) {
    ctx.save();
    ctx.setTransform(SC, 0, 0, SC, 0, 0);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#dcdbd5'; ctx.fillRect(0, 0, LW, LH);
    ctx.drawImage(seaTint, 0, 0, LW, LH);
    ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 0.8; ctx.beginPath();
    for (let y = 0; y < LH; y += 6) { ctx.moveTo(0, y + 0.5); ctx.lineTo(LW, y + 0.5); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 0.9; iso(ctx, F, -0.04);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; iso(ctx, F, -0.1);
    ctx.strokeStyle = 'rgba(0,0,0,0.07)'; iso(ctx, F, -0.2);
    ctx.drawImage(landMask, 0, 0, LW, LH);
    ctx.drawImage(hill, 0, 0, LW, LH);

    if (L.grid) {
      ctx.strokeStyle = 'rgba(40,40,40,0.13)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = 680 % 80; x <= W + SX0; x += 80) { const [X] = tx(x, 0); ctx.moveTo(X, 0); ctx.lineTo(X, LH); }
      for (let y = 980 % 80; y <= H + SY0; y += 80) { const [, Y] = tx(0, y); ctx.moveTo(0, Y); ctx.lineTo(LW, Y); }
      ctx.stroke();
      ctx.fillStyle = 'rgba(40,40,40,0.45)'; ctx.font = '500 15px "JetBrains Mono", Consolas, monospace';
      for (let x = 680 % 80; x <= W + SX0; x += 80) { const [X] = tx(x, 0); const lon = Math.round((x - 680) / 1280 * 180); ctx.fillText(`${lon < 0 ? 'W' : 'E'}${String(Math.abs(lon)).padStart(3, '0')}`, X + 4, 18); }
      for (let y = 980 % 80; y <= H + SY0; y += 80) { const [, Y] = tx(0, y); const lat = Math.round(-(y - 980) / 1560 * 140); ctx.fillText(`${lat < 0 ? 'S' : 'N'}${String(Math.abs(lat)).padStart(2, '0')}`, 6, Y - 4); }
    }
    if (L.contour) {
      ctx.lineWidth = 0.7;
      ['rgba(60,58,52,0.38)', 'rgba(60,58,52,0.6)', 'rgba(30,30,28,0.7)'].forEach((c, i) => { ctx.strokeStyle = c; ctx.stroke(hachures[2 - i]); });
      for (let i = 0, lv = 0.2; lv < 1.6; lv += 0.08, i++) {
        ctx.strokeStyle = i % 4 === 3 ? 'rgba(50,48,44,0.6)' : 'rgba(60,58,52,0.28)';
        ctx.lineWidth = i % 4 === 3 ? 1.3 : 0.8;
        iso(ctx, Hs, lv);
      }
    }
    // 地图样式随时代变化：ancient = 无国界的勘测图；classic = 手绘感的平滑疆界；crystal / present = 六边形实控地块
    const style = L.style || 'present';
    if (L.hex && (style === 'crystal' || style === 'present')) {
      ctx.strokeStyle = 'rgba(0,0,0,0.075)'; ctx.lineWidth = 1; ctx.beginPath();
      for (const h of hexes.values()) if (h.owner >= 0) hexPath(ctx, h);
      ctx.stroke();
    }
    // unknown area
    ctx.fillStyle = '#d3d0c8'; ctx.strokeStyle = '#c0bdb5'; ctx.lineWidth = 1.2;
    for (const h of hexes.values()) if (Math.hypot(h.cx - UNKNOWN[0], h.cy - UNKNOWN[1]) < UNKNOWN[2]) { ctx.beginPath(); hexPath(ctx, h); ctx.fill(); ctx.stroke(); }

    if (L.river) {
      ctx.strokeStyle = '#7d8c96'; ctx.lineWidth = 2;
      for (const rv of RIVERS) {
        ctx.beginPath(); let started = false;
        for (const [x, y] of riverPts(rv)) {
          if (sample(F, x, y) < 0.01) { if (started) break; continue; }
          ctx[started ? 'lineTo' : 'moveTo'](...tx(x, y)); started = true;
        }
        ctx.stroke();
      }
    }
    if (style === 'classic') drawSmoothBorders(ctx);
    if (style === 'crystal' || style === 'present') drawHexBorders(ctx);
    ctx.strokeStyle = '#1e1e1c'; ctx.lineWidth = 2.4; iso(ctx, F, 0);
    // 整体色调：只有远古偏灰（勘测图）；古代不加色调，只靠平滑疆界区分
    if (style === 'ancient') {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = '#e3e1dc';
      ctx.fillRect(0, 0, LW, LH);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  // 古代疆界：把每国的地块做成平滑的区域，再取边界线（海洋视为「无边界」，避免与海岸线重复）
  // 古代样式用的平滑国家区域：地块归属 → 0/1 指示场 → 模糊。sea = 海洋格子的取值
  function ownerGrid() {
    const own = new Int16Array(GW * GH);
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
      const k = j * GW + i;
      own[k] = F[k] > 0 ? ownerAt(SX0 + i * cw, SY0 + j * ch) : -2;
    }
    return own;
  }
  function nationField(own, id, sea) {
    let I = new Float32Array(GW * GH);
    for (let k = 0; k < I.length; k++) I[k] = own[k] === id ? 1 : own[k] === -2 ? sea : 0;
    for (let pass = 0; pass < 3; pass++) {
      const src = I; I = Float32Array.from(src);
      for (let j = 1; j < GH - 1; j++) for (let i = 1; i < GW - 1; i++) {
        const k = j * GW + i;
        I[k] = (src[k] * 4 + src[k - 1] + src[k + 1] + src[k - GW] + src[k + GW]) / 8;
      }
    }
    return I;
  }
  // 古代疆界：海洋视为「无边界」（sea = 1），避免与海岸线重复
  function drawSmoothBorders(ctx) {
    const own = ownerGrid(), ids = new Set(own); ids.delete(-2); ids.delete(-1);
    ctx.strokeStyle = 'rgba(92,70,44,0.55)'; ctx.lineWidth = 2.2; ctx.setLineDash([10, 4, 2, 4]);
    for (const id of ids) iso(ctx, nationField(own, id, 1), 0.5);
    ctx.setLineDash([]);
  }

  function drawHexBorders(ctx) {
    const solid = new Path2D(), dashed = new Path2D();
    for (const h of hexes.values()) {
      if (h.owner < 0) continue;
      DIRS.forEach(([dq, dr], i) => {
        const n = hexes.get((h.q + dq) + ',' + (h.r + dr));
        if (!n || !n.land) return;
        if (n.owner === h.owner) return;
        if (n.owner >= 0 && n.owner < h.owner) return; // 每条边只画一次
        const p = n.owner >= 0 ? solid : dashed;
        p.moveTo(...corner(h.cx, h.cy, i)); p.lineTo(...corner(h.cx, h.cy, (i + 1) % 6));
      });
    }
    ctx.strokeStyle = 'rgba(30,30,28,0.8)'; ctx.lineWidth = 2; ctx.stroke(solid);
    ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(30,30,28,0.5)'; ctx.lineWidth = 1.4; ctx.stroke(dashed); ctx.setLineDash([]);
  }

  function drawSelection(ctx, idx, style = 'present') {
    ctx.save();
    ctx.setTransform(SC, 0, 0, SC, 0, 0);
    if (style === 'classic') {
      // 平滑高亮：模糊后的区域作为半透明填充，外缘用同一场的等值线描边
      const own = ownerGrid();
      const fill = nationField(own, idx, 0), edge = nationField(own, idx, 1);
      const img = raster((i, j, k) => [242, 195, 0, Math.max(0, Math.min(1, (fill[k] - 0.35) / 0.3)) * 72]);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, LW, LH);
      ctx.strokeStyle = '#c99700'; ctx.lineWidth = 3.5; iso(ctx, edge, 0.5);
      ctx.restore();
      return;
    }
    ctx.fillStyle = 'rgba(242,195,0,0.26)';
    ctx.beginPath();
    for (const h of hexes.values()) if (h.owner === idx) hexPath(ctx, h);
    ctx.fill();
    ctx.strokeStyle = '#c99700'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath();
    for (const h of hexes.values()) {
      if (h.owner !== idx) continue;
      DIRS.forEach(([dq, dr], i) => {
        const n = hexes.get((h.q + dq) + ',' + (h.r + dr));
        if (n && n.owner === idx && n.land) return;
        ctx.moveTo(...corner(h.cx, h.cy, i)); ctx.lineTo(...corner(h.cx, h.cy, (i + 1) % 6));
      });
    }
    ctx.stroke();
    ctx.restore();
  }

  return { F, Hh, sample, ownerAt, setYear, drawBase, drawSelection };
}
