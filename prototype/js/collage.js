// 档案拼贴占位图（程序生成的黑白「照片」、文件、测绘、立面）与时间轴建筑暗影。
// 精细设计阶段替换为真实素材。

const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
let uid = 0;

export function fragSVG(kind, seed, w = 136, h = 84) {
  const r = rng(seed * 97 + 13), id = 'f' + (uid++);
  let s = '';
  if (kind === 'photo') {
    s += `<defs><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dcdbd7"/><stop offset="1" stop-color="#a3a19b"/></linearGradient>
      <filter id="${id}g"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${seed % 50}"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 0.4"/></feComponentTransfer></filter></defs>
      <rect width="${w}" height="${h}" fill="url(#${id}s)"/>`;
    for (let x = -4; x < w;) {
      const bw = 6 + r() * 18, bh = h * (0.25 + r() * 0.55), g = 50 + Math.floor(r() * 70);
      s += `<rect x="${x.toFixed(1)}" y="${(h - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="rgb(${g},${g},${g - 2})"/>`;
      if (r() < 0.3) s += `<path d="M${x} ${h - bh}L${x + bw / 2} ${h - bh - 6 - r() * 12}L${x + bw} ${h - bh}Z" fill="rgb(${g},${g},${g})"/>`;
      for (let wy = h - bh + 4; wy < h - 6; wy += 6) if (r() < 0.5) s += `<rect x="${x + 2}" y="${wy}" width="${Math.max(1, bw - 4)}" height="1.4" fill="#cfcdc7" opacity=".35"/>`;
      x += bw + r() * 2;
    }
    s += `<rect width="${w}" height="${h}" filter="url(#${id}g)"/>`;
  } else if (kind === 'doc') {
    s += `<rect width="${w}" height="${h}" fill="#f6f5f0"/><rect x="8" y="8" width="${w * 0.45}" height="5" fill="#2a2a28"/>`;
    for (let y = 20; y < h - 10; y += 6) s += `<rect x="8" y="${y}" width="${(w - 16) * (0.5 + r() * 0.5)}" height="2" fill="#9a9892"/>`;
    s += `<circle cx="${w - 26}" cy="${h - 24}" r="14" fill="none" stroke="#6b6963" stroke-width="1.2" stroke-dasharray="2 1.5"/><text x="${w - 26}" y="${h - 21}" font-size="6" text-anchor="middle" fill="#6b6963" font-family="monospace">ARCHIVE</text>`;
  } else if (kind === 'survey') {
    s += `<rect width="${w}" height="${h}" fill="#fbfaf7"/>`;
    for (let x = 0; x < w; x += 12) s += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="#e1dfd9"/>`;
    for (let y = 0; y < h; y += 12) s += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="#e1dfd9"/>`;
    const cx = w * (0.35 + r() * 0.3), cy = h * (0.4 + r() * 0.2);
    for (let i = 1; i < 8; i++) {
      let d = '';
      for (let a = 0; a <= 24; a++) {
        const t = a / 24 * Math.PI * 2, rr = i * 6 * (1 + 0.18 * Math.sin(t * 3 + i + seed));
        d += `${a ? 'L' : 'M'}${(cx + Math.cos(t) * rr * 1.4).toFixed(1)} ${(cy + Math.sin(t) * rr).toFixed(1)}`;
      }
      s += `<path d="${d}Z" fill="none" stroke="#6f6d67" stroke-width="${i % 3 ? 0.6 : 1.1}"/>`;
    }
    s += `<path d="M${cx - 8} ${cy}H${cx + 8}M${cx} ${cy - 8}V${cy + 8}" stroke="#1d1d1b"/><text x="4" y="${h - 4}" font-size="6" fill="#55534e" font-family="monospace">${(r() * 90).toFixed(2)}N ${(r() * 180).toFixed(2)}E</text>`;
  } else {
    s += `<rect width="${w}" height="${h}" fill="#fbfaf7"/><line x1="4" y1="${h - 10}" x2="${w - 4}" y2="${h - 10}" stroke="#1d1d1b"/>`;
    const n = 2 + Math.floor(r() * 3); let x = 12;
    for (let i = 0; i < n; i++) {
      const bw = 16 + r() * 22, bh = 20 + r() * 40;
      s += `<rect x="${x}" y="${h - 10 - bh}" width="${bw}" height="${bh}" fill="none" stroke="#2a2a28" stroke-width=".9"/>`;
      if (r() < 0.5) s += `<path d="M${x} ${h - 10 - bh}L${x + bw / 2} ${h - 10 - bh - 14}L${x + bw} ${h - 10 - bh}" fill="none" stroke="#2a2a28" stroke-width=".9"/>`;
      for (let wy = h - bh; wy < h - 16; wy += 7) for (let wx = x + 3; wx < x + bw - 4; wx += 6) s += `<rect x="${wx}" y="${wy}" width="3" height="4" fill="none" stroke="#8d8a83" stroke-width=".5"/>`;
      x += bw + 6;
    }
    s += `<path d="M12 ${h - 4}H${x - 6}" stroke="#8d8a83" stroke-width=".5" marker-start="none"/><text x="${(x + 6) / 2}" y="${h - 1}" font-size="5" fill="#8d8a83" text-anchor="middle" font-family="monospace">ELEV. ${(r() * 99).toFixed(1)}m</text>`;
  }
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}

// 时间轴背景：两层低对比天际线 + 事件地标剪影 + 档案碎片
function landmark(type, x, base, r) {
  const B = base;
  switch (type) {
    case 'castle': return `<path d="M${x - 46} ${B}V${B - 46}h8v-6h6v6h8v-6h6v6h8v-6h6v6h8v46ZM${x - 58} ${B}V${B - 74}l6 -12l6 12V${B}ZM${x + 46} ${B}V${B - 70}l6 -12l6 12V${B}Z"/>`;
    case 'twin': return `<path d="M${x - 22} ${B}V${B - 96}l7 -22l7 22V${B}ZM${x + 6} ${B}V${B - 96}l7 -22l7 22V${B}ZM${x - 34} ${B}V${B - 34}h68V${B}Z"/>`;
    case 'tower': return `<path d="M${x - 14} ${B}V${B - 104}h28V${B}ZM${x - 1} ${B - 104}v-18h2v18ZM${x - 40} ${B}V${B - 52}h22V${B}ZM${x + 18} ${B}V${B - 64}h26V${B}Z"/>`;
    case 'arena': return `<path d="M${x - 64} ${B}V${B - 30}Q${x} ${B - 62} ${x + 64} ${B - 30}V${B}Z"/>`;
    case 'dome': return `<path d="M${x - 30} ${B}V${B - 44}h60V${B}ZM${x - 24} ${B - 44}A24 24 0 0 1 ${x + 24} ${B - 44}ZM${x - 1} ${B - 68}v-12h2v12Z"/>`;
    case 'light': return `<path d="M${x - 10} ${B}L${x - 5} ${B - 88}h10L${x + 10} ${B}ZM${x - 8} ${B - 88}v-10h16v10ZM${x - 2} ${B - 98}l2 -6l2 6Z"/>`;
    case 'shell': return `<path d="M${x - 56} ${B}Q${x - 56} ${B - 70} ${x + 10} ${B - 70}Q${x + 50} ${B - 70} ${x + 56} ${B}Z"/>`;
    case 'block': return `<path d="M${x - 60} ${B}V${B - 40}h30v-16h30v-12h40v68ZM${x - 50} ${B - 40}v-34h6v34ZM${x - 38} ${B - 40}v-26h6v26Z"/>`;
    default: { // ruin
      let d = `M${x - 50} ${B}`;
      for (let i = 0; i <= 10; i++) d += `L${x - 50 + i * 10} ${B - 20 - r() * 50}`;
      return `<path d="${d}L${x + 50} ${B}Z"/>`;
    }
  }
}
export function skylineSVG(W, base, marks) {
  const r = rng(7);
  let back = '', front = '', lm = '', frag = '';
  for (let x = -10; x < W;) {
    const bw = 14 + r() * 40, bh = 18 + r() * 62;
    back += `<rect x="${x.toFixed(0)}" y="${(base - bh).toFixed(0)}" width="${bw.toFixed(0)}" height="${bh.toFixed(0)}"/>`;
    if (r() < 0.22) back += `<path d="M${x} ${base - bh}L${x + bw / 2} ${base - bh - 10 - r() * 16}L${x + bw} ${base - bh}Z"/>`;
    x += bw + r() * 8;
  }
  for (let x = -10; x < W;) {
    const bw = 10 + r() * 28, bh = 8 + r() * 34;
    front += `<rect x="${x.toFixed(0)}" y="${(base - bh).toFixed(0)}" width="${bw.toFixed(0)}" height="${bh.toFixed(0)}"/>`;
    x += bw + r() * 14;
  }
  for (const m of marks) lm += landmark(m.type, m.x + 40, base, r);
  marks.forEach((m, i) => {
    if (i % 2) return;
    const x = m.x + 70 + r() * 40, y = base - 70 - r() * 40, a = (r() - 0.5) * 10;
    frag += `<g transform="translate(${x} ${y}) rotate(${a.toFixed(1)})" opacity=".55"><rect width="54" height="38" fill="#efeee9" stroke="#dcd9d1"/><rect x="4" y="4" width="46" height="24" fill="url(#ht)"/><rect x="4" y="31" width="30" height="2" fill="#d9d6ce"/></g>`;
  });
  return `<svg width="${W}" height="${base + 40}" xmlns="http://www.w3.org/2000/svg">
    <defs><pattern id="ht" width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#d6d3cb"/></pattern>
    <pattern id="gh" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#eceae4" stroke-width="1"/></pattern></defs>
    <g fill="#eeede8">${back}</g>${frag}<g fill="#e8e6e0">${front}</g><g fill="#e2dfd8">${lm}</g>
    <rect x="0" y="${base}" width="${W}" height="40" fill="url(#gh)"/></svg>`;
}
