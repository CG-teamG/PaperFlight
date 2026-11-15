// ============================================================
// 마을 건물 모델 (유럽 시골 레퍼런스: 알프스 목조 샬레 / 돌+붉은 지붕 코티지 / 연립주택 / 높은 첨탑 교회 / 헛간+사일로)
//  - 각 모델은 { body, glass, chimneys } : body = 벽/지붕/장식, glass = 탐험하면 켜지는 창문
//  - 좌표: 원점 = 건물 중앙 땅, 정면 = +z
// ============================================================
import { COLORS, addWindow } from '../LandmarkKit.js';

const GERANIUM = [0xd8344a, 0xf06aa0, 0xff8f3a, 0xf5d640, 0xfff4f0, 0xb06ad8];
const BARK = 0x6b4a2b;

// 창가 화분 상자 + 꽃 (벽면 로컬 x 방향으로 w 만큼)
export function flowerBox(b, x, y, z, ry, w, seed = 0, pal = GERANIUM) {
  const c = Math.cos(ry),
    s = Math.sin(ry);
  b.box(BARK, w, 0.7, 0.85, x, y, z, ry);
  const n = Math.max(3, Math.round(w / 0.85));
  for (let i = 0; i < n; i++) {
    const lx = ((i + 0.5) / n - 0.5) * w;
    b.ico(pal[(i * 3 + seed) % pal.length], 0.46, x + lx * c, y + 0.6 + (i % 2) * 0.12, z - lx * s, 1, 0.85, 1, 0, i);
  }
  // 아래로 늘어진 덩굴
  b.box(0x5f9a4a, w * 0.8, 0.5, 0.3, x + 0.4 * s, y - 0.2, z + 0.4 * c, ry);
}

function woodPile(b, x, z, ry) {
  const c = Math.cos(ry),
    s = Math.sin(ry);
  for (let row = 0; row < 3; row++)
    for (let i = 0; i < 4 - (row > 1 ? 1 : 0); i++) {
      const lx = (i - 1.5 + row * 0.5) * 0.75;
      b.log(i % 2 ? 0x8a5a33 : 0x9c6a3c, x + lx * c - 1.1 * s, 0.5 + row * 0.7, z - lx * s - 1.1 * c, x + lx * c + 1.1 * s, 0.5 + row * 0.7, z - lx * s + 1.1 * c, 0.36, 5);
    }
}

function quoins(b, w, h, d, color, step = 1.6) {
  // 모서리 돌(번갈아 튀어나온 장식 돌)
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      for (let y = 0.8, i = 0; y < h - 0.5; y += step, i++)
        b.box(color, 0.9 + (i % 2) * 0.4, 0.8, 0.9 + ((i + 1) % 2) * 0.4, sx * (w / 2), y, sz * (d / 2));
}

// ---------------- 코티지 (A 크림 / B 오커 / C 2층 흰색) ----------------
export function buildCottage(kit, spec) {
  const body = kit.builder(),
    glass = kit.builder();
  const { w, d, h, roofH, wall, roof, shutter, floors = 1, dormer = false } = spec;
  body.box(COLORS.stone, w + 0.8, 2.8, d + 0.8, 0, -1.0, 0);
  body.box(wall, w, h, d, 0, h / 2, 0);
  body.gable(roof, w + 1.8, d + 2.8, roofH, 0, h - 0.1, 0);
  body.box(0x4a3a2c, w + 1.9, 0.3, d + 2.9, 0, h - 0.2, 0); // 처마 보
  quoins(body, w, h, d, COLORS.stoneLight, 1.7);
  // 굴뚝 (벽돌 + 굴뚝갓)
  const cx = w * 0.26,
    cz = -d * 0.14;
  const chTop = h + roofH + 1.9;
  body.box(0x9b5a45, 1.9, chTop - (h - 1.5), 1.9, cx, (chTop + h - 1.5) / 2, cz);
  body.box(COLORS.stoneDark, 2.5, 0.45, 2.5, cx, chTop, cz);
  body.box(0x222222, 0.6, 0.5, 0.6, cx - 0.4, chTop + 0.4, cz);
  body.box(0x222222, 0.6, 0.5, 0.6, cx + 0.4, chTop + 0.4, cz);
  // 문 + 작은 현관 지붕
  body.box(COLORS.white, 2.9, 4.1, 0.3, 0, 2.05, d / 2 + 0.06);
  body.box(COLORS.darkWood, 2.2, 3.7, 0.4, 0, 1.85, d / 2 + 0.14);
  body.box(COLORS.stone, 3.4, 0.45, 1.3, 0, 0.1, d / 2 + 0.65);
  body.gable(roof, 4.6, 2.9, 1.2, 0, 4.6, d / 2 + 1.3);
  for (const sx of [-1, 1]) body.beam(0x5a3f2a, sx * 1.9, 0, d / 2 + 2.3, sx * 1.9, 4.7, d / 2 + 2.3, 0.3);
  // 앞창 + 화분
  const fh = h / floors;
  for (let f = 0; f < floors; f++) {
    const y = fh * f + fh * 0.56;
    const xs = f === 0 ? [-w * 0.3, w * 0.3] : [-w * 0.3, 0, w * 0.3];
    for (const x of xs) {
      if (floors === 2 && f === 1 && x === 0) {
        addWindow(body, glass, 0, y, d / 2, 0, null);
        flowerBox(body, 0, y - 1.7, d / 2 + 0.55, 0, 2.6, f);
        continue;
      }
      addWindow(body, glass, x, y, d / 2, 0, shutter);
      flowerBox(body, x, y - 1.7, d / 2 + 0.55, 0, 2.7, Math.round(x));
    }
  }
  for (let f = 0; f < floors; f++) {
    const y = fh * f + fh * 0.56;
    addWindow(body, glass, w / 2, y, 0, Math.PI / 2, null);
    addWindow(body, glass, -w / 2, y, 0, -Math.PI / 2, null);
  }
  addWindow(body, glass, 0, fh * 0.56, -d / 2, Math.PI, null);
  // 지붕창
  if (dormer) {
    for (const sx of [-1, 1]) {
      const zc = d / 2 - 0.2,
        yc = h + roofH * 0.38;
      body.box(wall, 3.0, 2.6, 2.4, sx * w * 0.26, yc + 1.0, zc);
      body.gable(roof, 3.8, 3.4, 1.6, sx * w * 0.26, yc + 2.2, zc, 0);
      addWindow(body, glass, sx * w * 0.26, yc + 1.0, zc + 1.2, 0, shutter, [1.5, 1.6]);
    }
  }
  // 담쟁이 + 장작더미
  body.box(0x5f8f4a, 0.3, h * 0.65, d * 0.35, -w / 2 - 0.1, h * 0.38, -d * 0.2);
  body.box(0x6fa05a, 0.3, h * 0.35, d * 0.25, -w / 2 - 0.12, h * 0.58, d * 0.12);
  woodPile(body, w / 2 + 1.2, -d * 0.18, Math.PI / 2);
  return { body: body.build(), glass: glass.build(), chimneys: [[cx, chTop + 0.9, cz]] };
}

// ---------------- 알프스 목조 샬레 (F): 박공 정면 + 발코니 + 화분 + 석조 1층 ----------------
export function buildChalet(kit, spec = {}) {
  const body = kit.builder(),
    glass = kit.builder();
  const w = spec.w ?? 12,
    d = spec.d ?? 10.5,
    h0 = 4.4,
    h1 = 4.6,
    h = h0 + h1;
  const timber = spec.timber ?? 0x6e4b33,
    plaster = spec.plaster ?? 0xefe1c0,
    roofC = spec.roof ?? 0x3f444c,
    shutter = spec.shutter ?? COLORS.shutterRed;
  const roofH = 6.8,
    ridgeLen = d + 4.2,
    span = w + 3.4;
  body.box(COLORS.stone, w + 0.8, 2.8, d + 0.8, 0, -1.0, 0);
  body.box(plaster, w, h0, d, 0, h0 / 2, 0);
  // 석조 모서리 + 1층 하부 돌띠
  body.box(COLORS.stone, w + 0.3, 1.2, d + 0.3, 0, 0.6, 0);
  quoins(body, w, h0, d, COLORS.stoneLight, 1.5);
  // 목조 2층 (살짝 앞으로 튀어나옴) + 가로 판자 줄
  body.box(timber, w + 0.8, h1, d + 0.8, 0, h0 + h1 / 2, 0);
  for (let i = 1; i < 6; i++) body.box(0x5c3d28, w + 0.95, 0.12, d + 0.95, 0, h0 + (i * h1) / 6, 0);
  body.box(0x4a3425, w + 1.2, 0.35, d + 1.2, 0, h0 + 0.1, 0); // 층 사이 보
  // 지붕: 용마루가 z 방향 → 박공이 정면
  body.gable(roofC, ridgeLen, span, roofH, 0, h - 0.1, 0, Math.PI / 2);
  // 정면 박공 장식: 목재 삼각형 + 박공널
  const zf = ridgeLen / 2 + 0.06;
  const hw = span / 2 - 0.5;
  const apex = h - 0.1 + roofH - 0.8;
  body.tri(0x7a5236, [-hw, h - 0.1, zf], [hw, h - 0.1, zf], [0, apex, zf]);
  for (const sx of [-1, 1]) body.beam(0xd8c9a8, sx * hw, h - 0.1, zf + 0.1, 0, apex + 0.1, zf + 0.1, 0.32);
  // 박공 안 작은 창(하트 모양 대신 둥근 환기창)
  body.cyl(0x3a2a1c, 0.9, 0.9, 0.3, 0, h + 1.9, zf + 0.05, 10, 0, Math.PI / 2);
  // 발코니
  const bz = d / 2 + 0.4;
  body.box(0x8a6740, w + 0.4, 0.38, 2.4, 0, h0 + 0.2, bz + 1.1);
  for (const sx of [-1, 1]) body.beam(0x5a3f2a, sx * (w / 2 - 0.2), 0, bz + 2.15, sx * (w / 2 - 0.2), h0 + 0.1, bz + 2.15, 0.42);
  body.box(0x8a6740, w + 0.4, 0.28, 0.28, 0, h0 + 1.6, bz + 2.2);
  for (let i = 0; i <= 14; i++) body.box(0x8a6740, 0.2, 1.3, 0.2, ((i / 14) - 0.5) * (w + 0.1), h0 + 0.95, bz + 2.2);
  for (const sx of [-1, 1]) body.box(0x8a6740, 0.28, 1.3, 2.3, sx * (w / 2 + 0.05), h0 + 0.95, bz + 1.1);
  flowerBox(body, 0, h0 + 1.95, bz + 2.3, 0, w - 1.2, 0);
  // 창/문
  const fx = [-w * 0.3, w * 0.3];
  for (const x of fx) {
    addWindow(body, glass, x, h0 + 2.5, d / 2 + 0.4, 0, shutter, [1.9, 2.4]);
    addWindow(body, glass, x, 2.7, d / 2, 0, shutter, [1.9, 2.4]);
    flowerBox(body, x, 1.1, d / 2 + 0.55, 0, 2.5, Math.round(x));
  }
  body.box(COLORS.darkWood, 2.2, 3.7, 0.4, 0, 1.85, d / 2 + 0.14);
  body.box(COLORS.white, 2.9, 4.1, 0.3, 0, 2.05, d / 2 + 0.06);
  addWindow(body, glass, 0, h0 + 2.5, d / 2 + 0.4, 0, null, [1.6, 2.4]);
  for (let f = 0; f < 2; f++) {
    const y = f ? h0 + 2.5 : 2.7;
    const off = f ? 0.4 : 0;
    addWindow(body, glass, w / 2 + off, y, -d * 0.18, Math.PI / 2, null);
    addWindow(body, glass, w / 2 + off, y, d * 0.22, Math.PI / 2, null);
    addWindow(body, glass, -w / 2 - off, y, -d * 0.18, -Math.PI / 2, null);
    addWindow(body, glass, -w / 2 - off, y, d * 0.22, -Math.PI / 2, null);
  }
  // 굴뚝
  const cx = -w * 0.28,
    cz = -d * 0.2,
    chTop = h + roofH + 0.4;
  body.box(COLORS.stoneDark, 2.0, chTop - h + 2, 2.0, cx, (chTop + h - 2) / 2, cz);
  body.box(COLORS.stone, 2.6, 0.4, 2.6, cx, chTop, cz);
  woodPile(body, -w / 2 - 1.0, d * 0.05, -Math.PI / 2);
  return { body: body.build(), glass: glass.build(), chimneys: [[cx, chTop + 0.7, cz]] };
}

// ---------------- 연립주택 (G): 돌벽 + 붉은 지붕 3채 ----------------
export function buildRowHouse(kit, variant = 0) {
  const body = kit.builder(),
    glass = kit.builder();
  const d = 8.6;
  const sets = [
    { ws: [8.2, 9.4, 8.0], hs: [7.4, 8.8, 7.8], walls: [0xcdb88f, 0xeee3c8, 0xbfa77c], roofs: [0xb5573a, 0x9d4a35, 0x6a6f78] },
    { ws: [9.0, 7.6, 9.2], hs: [8.4, 7.2, 8.0], walls: [0xe6dcc2, 0xc4ae84, 0xd8c9a2], roofs: [0xa9503a, 0xb5573a, 0xa24d37] },
  ];
  const S = sets[variant % sets.length];
  const total = S.ws.reduce((a, b) => a + b, 0);
  const chimneys = [];
  let x0 = -total / 2;
  S.ws.forEach((w, i) => {
    const h = S.hs[i],
      cx = x0 + w / 2;
    body.box(COLORS.stone, w + 0.3, 2.6, d + 0.6, cx, -0.9, 0);
    body.box(S.walls[i], w, h, d, cx, h / 2, 0);
    body.box(COLORS.stoneDark, w + 0.15, 0.9, d + 0.2, cx, 0.45, 0);
    const roofH = 4.4 + (i % 2) * 0.6;
    body.gable(S.roofs[i], w + 0.9, d + 2.4, roofH, cx, h - 0.1, 0);
    const chx = cx + (i % 2 ? -1 : 1) * w * 0.28;
    const chTop = h + roofH + 1.5;
    body.box(0x9b5a45, 1.7, chTop - h + 1.5, 1.7, chx, (chTop + h - 1.5) / 2, -d * 0.1);
    body.box(0xb86d55, 1.7, 1.1, 1.7, chx - 1.9, chTop - 0.2, -d * 0.1); // 굴뚝 한 쌍
    body.box(COLORS.stoneDark, 2.3, 0.4, 2.3, chx, chTop, -d * 0.1);
    if (i !== 1) chimneys.push([chx, chTop + 0.9, -d * 0.1]);
    // 문 / 창
    const door = i === (variant % 2 ? 1 : 0) || i === 2;
    if (door) {
      body.box(COLORS.white, 2.7, 4.0, 0.3, cx + w * 0.22, 2.0, d / 2 + 0.06);
      body.box(i === 2 ? COLORS.shutterBlue : COLORS.shutterSage, 2.0, 3.6, 0.4, cx + w * 0.22, 1.8, d / 2 + 0.14);
      body.box(COLORS.stone, 3.2, 0.4, 1.1, cx + w * 0.22, 0.1, d / 2 + 0.6);
    }
    const floors = 2;
    for (let f = 0; f < floors; f++) {
      const y = f ? h * 0.72 : h * 0.34;
      const xs = door ? [-w * 0.2] : [-w * 0.22, w * 0.22];
      for (const dx of xs) {
        addWindow(body, glass, cx + dx, y, d / 2, 0, f ? null : COLORS.shutterSage, [1.6, 2.2]);
        if (!f) flowerBox(body, cx + dx, y - 1.5, d / 2 + 0.55, 0, 2.2, i + f);
      }
      if (door && f) addWindow(body, glass, cx + w * 0.22, y, d / 2, 0, null, [1.6, 2.2]);
    }
    // 담쟁이 (벽 일부)
    if (i === 1) body.box(0x5f8f4a, w * 0.5, h * 0.55, 0.28, cx + w * 0.1, h * 0.35, d / 2 + 0.12);
    addWindow(body, glass, cx, h * 0.45, -d / 2, Math.PI, null);
    x0 += w;
  });
  addWindow(body, glass, total / 2, 4.4, 0, Math.PI / 2, null);
  addWindow(body, glass, -total / 2, 4.4, 0, -Math.PI / 2, null);
  return { body: body.build(), glass: glass.build(), chimneys };
}

// ---------------- 헛간 + 사일로 (D) ----------------
export function buildBarn(kit) {
  const body = kit.builder(),
    glass = kit.builder();
  const w = 17,
    d = 11.5,
    h = 7.5,
    roofH = 5.8;
  body.box(COLORS.stone, w + 0.8, 2.8, d + 0.8, 0, -1.0, 0);
  body.box(0x8f6440, w, h, d, 0, h / 2, 0);
  for (let i = -8; i <= 8; i += 1)
    body.box(0x7a5233, 0.14, h - 0.3, 0.16, i * (w / 17.5), h / 2, d / 2 + 0.08); // 세로 판자 이음
  body.gable(COLORS.darkWood, w + 2, d + 2.8, roofH, 0, h - 0.1, 0);
  body.box(COLORS.white, 7.6, 6.2, 0.3, 0, 3.1, d / 2 + 0.06);
  body.box(0x5e4030, 6.8, 5.8, 0.4, 0, 2.9, d / 2 + 0.14);
  body.beam(COLORS.white, -3.2, 0.3, d / 2 + 0.38, 3.2, 5.5, d / 2 + 0.38, 0.28);
  body.beam(COLORS.white, 3.2, 0.3, d / 2 + 0.38, -3.2, 5.5, d / 2 + 0.38, 0.28);
  // 다락 창 + 도르래 보
  addWindow(body, glass, 0, h + 2.3, d / 2 - 0.2, 0, null);
  body.beam(0x4a3425, 0, h + 4.4, d / 2, 0, h + 4.4, d / 2 + 2.2, 0.4);
  // 오른쪽 덧붙인 헛간지붕
  body.box(0x7d5a3a, 5.5, 4.4, 9, w / 2 + 2.7, 2.2, 0);
  body.gable(COLORS.darkWood, 6.6, 9.8, 1.8, w / 2 + 2.7, 4.3, 0, Math.PI / 2);
  // 사일로
  const sx = -w / 2 - 4.2,
    sz = -1.5;
  body.cyl(0xc8c4b8, 2.9, 2.9, 13, sx, 6.5, sz, 12);
  for (let y = 1.2; y < 13; y += 2.0) body.cyl(0x8b877c, 3.0, 3.0, 0.22, sx, y, sz, 12);
  body.ico(0x9aa1a8, 3.0, sx, 13, sz, 1, 0.55, 1, 1);
  body.box(0x6b4a2b, 1.2, 2.4, 0.3, sx, 1.2, sz + 2.9);
  // 건초 수레
  body.box(0x9a6b3f, 4.2, 0.4, 2.4, -2, 1.1, d / 2 + 6);
  body.box(COLORS.hay, 3.8, 1.6, 2.1, -2, 2.0, d / 2 + 6);
  body.cyl(0x4a3a2a, 0.9, 0.9, 0.3, -3.4, 0.9, d / 2 + 7.3, 8, 0, Math.PI / 2, 0);
  body.cyl(0x4a3a2a, 0.9, 0.9, 0.3, -0.6, 0.9, d / 2 + 7.3, 8, 0, Math.PI / 2, 0);
  return { body: body.build(), glass: glass.build(), chimneys: [] };
}

// ---------------- 교회 (E): 높고 가는 첨탑 + 시계 + 부벽 + 현관 ----------------
export function buildChurch(kit) {
  const body = kit.builder(),
    glass = kit.builder();
  const wall = 0xf1e9d6,
    stone = 0xe3d9c3,
    L = 17,
    W = 11,
    H = 9.6;
  body.box(COLORS.stone, W + 1, 2.8, L + 1, 0, -1.0, 0);
  body.box(wall, W, H, L, 0, H / 2, 0);
  body.gable(COLORS.slate, L + 1.8, W + 2.8, 5.6, 0, H - 0.1, 0, Math.PI / 2);
  // 부벽(버트레스)
  for (const side of [-1, 1])
    for (const z of [-6.2, -2.0, 2.2, 6.4]) {
      body.box(stone, 0.9, H - 1.5, 1.0, side * (W / 2 + 0.4), (H - 1.5) / 2 + 0.2, z);
    }
  // 앞쪽 종탑 (더 높고 가는 첨탑)
  const tz = L / 2 + 2.8,
    TW = 6.6,
    TH = 24;
  body.box(stone, TW, TH, TW, 0, TH / 2, tz);
  body.box(0xcfc4aa, TW + 0.5, 1.0, TW + 0.5, 0, 9.5, tz);
  body.box(0xcfc4aa, TW + 0.5, 1.0, TW + 0.5, 0, TH - 4.2, tz);
  for (const [x, z] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ])
    body.cone(COLORS.slate, 0.7, 3.0, x * (TW / 2 - 0.2), TH + 1.2, tz + z * (TW / 2 - 0.2), 4, Math.PI / 4);
  body.cone(0x3b4a58, 4.4, 17, 0, TH + 8.5, tz, 4, Math.PI / 4);
  body.ico(0xe0b34a, 0.55, 0, TH + 17.4, tz, 1, 1, 1, 1);
  body.beam(0xe0b34a, 0, TH + 17.6, tz, 0, TH + 20.0, tz, 0.22);
  body.beam(0xe0b34a, -0.9, TH + 19.0, tz, 0.9, TH + 19.0, tz, 0.2);
  // 종루 아치창(루버)
  for (const [x, z, ry] of [
    [0, tz + TW / 2 + 0.05, 0],
    [0, tz - TW / 2 - 0.05, 0],
    [TW / 2 + 0.05, tz, Math.PI / 2],
    [-TW / 2 - 0.05, tz, Math.PI / 2],
  ]) {
    body.box(0x3a3f47, 2.2, 4.2, 0.35, x, TH - 2.2, z, ry);
    body.ico(0x3a3f47, 1.1, x, TH - 0.1, z, 1, 0.9, 0.18, 0, ry);
  }
  // 시계
  body.cyl(0xf7f2e4, 1.7, 1.7, 0.35, 0, 14.6, tz + TW / 2 + 0.2, 16, 0, Math.PI / 2);
  body.box(0x2b2b2b, 0.18, 1.2, 0.1, 0, 15.0, tz + TW / 2 + 0.45);
  body.box(0x2b2b2b, 0.9, 0.18, 0.1, 0.4, 14.6, tz + TW / 2 + 0.45);
  // 현관 + 작은 박공
  body.box(stone, 4.6, 5.8, 0.4, 0, 2.9, tz + TW / 2 + 0.2);
  body.box(COLORS.darkWood, 3.2, 4.8, 0.4, 0, 2.4, tz + TW / 2 + 0.4);
  body.ico(COLORS.darkWood, 1.6, 0, 4.8, tz + TW / 2 + 0.4, 1, 0.6, 0.2);
  body.gable(COLORS.slate, 5.6, 3.0, 1.8, 0, 5.6, tz + TW / 2 + 1.0, 0);
  for (const sx of [-1, 1]) body.box(stone, 0.5, 5.6, 0.5, sx * 2.5, 2.8, tz + TW / 2 + 2.0);
  // 옆면 창 (켜짐) + 장미창
  for (const side of [-1, 1])
    for (const z of [-5.6, -1.4, 2.8, 7.0]) {
      body.box(stone, 2.1, 5.0, 0.25, side * (W / 2 + 0.05), 5.4, z, Math.PI / 2);
      glass.box(COLORS.glass, 1.5, 4.2, 0.3, side * (W / 2 + 0.13), 5.4, z, Math.PI / 2);
    }
  glass.box(COLORS.glass, 1.7, 4.4, 0.3, 0, 5.8, -L / 2 - 0.13);
  glass.cyl(COLORS.glass, 1.1, 1.1, 0.3, 0, H + 0.6, -L / 2 - 0.12, 12, 0, Math.PI / 2);
  // 묘비 몇 개
  for (const [x, z] of [
    [-8.2, 1],
    [-9.4, 3.2],
    [-7.8, 5.6],
  ]) {
    body.box(0xb9b6ad, 1.1, 1.7, 0.35, x, 0.85, z, 0.15);
    body.box(0xb9b6ad, 0.4, 0.4, 0.4, x, 1.9, z);
  }
  return { body: body.build(), glass: glass.build(), chimneys: [] };
}
