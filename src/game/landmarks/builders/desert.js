// ============================================================
// 협곡 장식(v3): 사암 후두 기둥 군락 / 사막 식물(선인장꽃·노란 야생화: 탐험하면 개화) /
//   바람에 굴러다니는 텀블위드(폭풍이면 훨씬 많이, 빠르게) / 절벽 중턱 바위집(카파도키아)과 첨탑 수도원(메테오라)
//   - 창문은 탐험하면 하나씩 불이 켜진다.
// ============================================================
import { COLORS, Lamp, addWindow, lerp, mulberry32 } from '../LandmarkKit.js';
import { makeNoise3 } from './canyon.js';

const TAU = Math.PI * 2;
const R = (rand, a, b) => a + (b - a) * rand();

// 지층 줄무늬 색 (높이에 따라 붉은색/살구색)
function strataColor(THREE, lo, hi, freq = 0.6) {
  const a = new THREE.Color(lo),
    b = new THREE.Color(hi),
    c = new THREE.Color();
  return (x, y, z) => c.copy(a).lerp(b, 0.5 + 0.5 * Math.sin(y * freq + Math.sin(x * 0.4 + z * 0.3) * 1.4));
}

function displace(THREE, g, seed, amp, freq = 0.3) {
  const noise = makeNoise3(seed);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    p.setXYZ(i, x + (noise(x * freq, y * freq, z * freq) - 0.5) * amp, y + (noise(x * freq + 9, y * freq, z * freq) - 0.5) * amp * 0.6, z + (noise(x * freq, y * freq + 5, z * freq + 3) - 0.5) * amp);
  }
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// ---- 후두: 굵은 밑동 + 가는 허리 + 모자 바위 (로컬: 원점 = 땅) ----
function hoodooGeometry(kit, v) {
  const THREE = kit.THREE;
  const rand = mulberry32(900 + v * 37);
  const col = strataColor(THREE, 0xb2512f, 0xe2995e, 0.7 + v * 0.1);
  const b = kit.builder();
  const H = 8 + v * 2.2;
  const segs = 3 + (v % 2);
  let y = -1.5,
    r = 3.4 + v * 0.3;
  for (let i = 0; i < segs; i++) {
    const h = (H + 1.5) / segs;
    const rn = i === segs - 1 ? r * 0.6 : r * R(rand, 0.55, 0.8);
    b.cyl(col, rn, r, h * 1.05, R(rand, -0.25, 0.25), y + h / 2, R(rand, -0.25, 0.25), 9);
    y += h;
    r = rn;
  }
  // 모자(캡) 바위: 평평하고 넓다. 모양마다 조금씩 기울여 불균형하게
  b.ico(strataColor(THREE, 0x9d4529, 0xc97f4d, 0.9), r * 1.9 + v * 0.2, 0, y + 0.3, 0, 1.0, 0.55, 0.9, 1, rand() * 6);
  if (v % 2) b.ico(col, r * 0.9, r * 1.1, y - 0.6, 0.5, 1, 0.8, 1, 0, 2);
  const g = b.build();
  return displace(THREE, g, 300 + v, 1.0, 0.35);
}

// ---- 사막 식물 ----
function yellowTuft(kit) {
  const b = kit.builder();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU,
      r = 0.22 + (i % 3) * 0.2;
    const h = 1.0 + (i % 4) * 0.28;
    const x = Math.cos(a) * r,
      z = Math.sin(a) * r;
    b.beam(0x7e8f4e, x * 0.4, 0, z * 0.4, x, h, z, 0.07);
    b.ico(0xf6d12e, 0.3, x, h + 0.08, z, 1, 0.3, 1, 0, 0, { head: 1 });
    b.ico(0x9a5a22, 0.13, x, h + 0.2, z, 1, 0.5, 1, 0, 0, { head: 1 });
  }
  b.ico(0x7d9158, 0.55, 0, 0.18, 0, 1.4, 0.4, 1.4, 0);
  return { geo: b.build(), head: [0, 1.3, 0], height: 2 };
}
function sage(kit) {
  const b = kit.builder();
  b.ico(0x8a9a78, 0.8, 0, 0.5, 0, 1.4, 0.8, 1.3, 0, 1);
  b.ico(0x9aa886, 0.6, 0.6, 0.4, 0.3, 1, 0.8, 1, 0, 2);
  b.ico(0x7d8d6b, 0.5, -0.5, 0.35, -0.3, 1, 0.8, 1, 0, 3);
  return { geo: b.build(), height: 1.2 };
}

// ---- 바위집 (로컬: 원점 = 테라스 중앙, 문 방향 = +z, 벽은 -z 쪽 비탈에 파묻힘) ----
function rockHouseGeometry(kit, seed) {
  const THREE = kit.THREE;
  const sand = strataColor(THREE, 0xcf9560, 0xe9c18c, 0.5);
  const mound = kit.builder(),
    d = kit.builder(),
    g = kit.builder();
  // 덩어리 바위: 절벽에 파묻힌 큰 둔덕 + 작은 둔덕들 + 원뿔 탑
  mound.ico(sand, 8.8, 0, 4.8, -9.6, 1.25, 1.0, 1.1, 1, 0.3);
  mound.ico(sand, 6.4, -7.6, 3.4, -7.4, 1, 1, 1, 1, 1.1);
  mound.ico(sand, 5.6, 7.2, 3.2, -7.0, 1, 1, 1, 1, 2.1);
  mound.cone(strataColor(THREE, 0xc1814f, 0xdba56f, 0.6), 3.0, 7.5, 3.4, 10.4, -6.6, 9, 0.5);
  mound.cone(strataColor(THREE, 0xc1814f, 0xdba56f, 0.6), 2.2, 5.5, -4.8, 8.6, -6.6, 8, 0.2);
  mound.box(sand, 12.6, 7.2, 3.4, 0, 3.4, -0.7); // 깎아낸 정면 벽
  mound.ico(sand, 3.0, -4.2, 6.9, -0.7, 1.2, 0.5, 0.8, 1, 0.4);
  mound.ico(sand, 3.2, 3.6, 6.9, -0.7, 1.2, 0.5, 0.8, 1, 1.4);
  const mg = displace(THREE, mound.build(), seed, 1.0, 0.28);
  // 정면: 문과 창 (아치형 문틀), 발코니, 계단
  d.box(0x3d2a1f, 1.9, 3.0, 0.3, -2.8, 1.5, 1.05);
  d.cyl(0x3d2a1f, 0.95, 0.95, 0.3, -2.8, 3.0, 1.05, 10, 0, Math.PI / 2);
  d.box(0x8a5a38, 1.5, 2.6, 0.2, -2.8, 1.4, 1.2);
  addWindow(d, g, 2.2, 1.9, 0.9, 0, COLORS.shutterBlue, [1.3, 1.9]);
  d.cyl(COLORS.white, 0.95, 0.95, 0.25, 2.2, 2.9, 0.95, 10, 0, Math.PI / 2);
  addWindow(d, g, -2.2, 5.3, 0.7, 0, COLORS.shutterBlue, [1.3, 1.9]);
  addWindow(d, g, 2.6, 5.3, 0.7, 0, null, [1.5, 2.1]);
  // 발코니(2층) + 난간 + 화분
  d.box(0x7a5636, 6.6, 0.35, 2.2, -0.2, 3.9, 2.0);
  for (let x = -3.2; x <= 2.9; x += 1.3) d.beam(0x6d4a3a, x, 3.95, 3.0, x, 5.0, 3.0, 0.16);
  d.box(0x6d4a3a, 6.6, 0.16, 0.16, -0.2, 5.0, 3.0);
  d.beam(0x5e3f26, -3.4, 0, 3.0, -3.4, 3.9, 3.0, 0.3);
  d.beam(0x5e3f26, 3.0, 0, 3.0, 3.0, 3.9, 3.0, 0.3);
  d.cyl(0xb5573a, 0.35, 0.28, 0.5, 1.4, 5.3, 3.0, 8);
  d.ico(0x4f7d4a, 0.45, 1.4, 5.7, 3.0, 1, 0.8, 1, 0);
  for (let i = 0; i < 4; i++) d.box(COLORS.stone, 3.6 - i * 0.2, 0.4, 1.2, -1.0, 0.2 + i * 0.0, 2.0 + i * 1.1 + 0.4);
  // 빨래줄 (몇 채만) 은 생략, 대신 나무 항아리와 건초
  d.cyl(0x9a6b3f, 0.6, 0.6, 1.0, 4.4, 0.5, 2.6, 8);
  return { mound: mg, detail: d.build(), glass: g.build() };
}

// ---- 첨탑 수도원 (메테오라: 로컬 원점 = 땅) ----
function spireGeometry(kit, seed) {
  const THREE = kit.THREE;
  const rand = mulberry32(seed);
  const rock = strataColor(THREE, 0x9a8672, 0xb9a283, 0.45);
  const s = kit.builder(),
    d = kit.builder(),
    g = kit.builder();
  const H = 26;
  s.cyl(rock, 4.4, 8.6, H * 0.5, 0, H * 0.25 - 1, 0, 10);
  s.cyl(rock, 3.6, 4.4, H * 0.35, R(rand, -0.5, 0.5), H * 0.5 + H * 0.175 - 1, R(rand, -0.5, 0.5), 9);
  s.cyl(rock, 4.9, 3.6, H * 0.15 + 1.2, 0, H * 0.85 + 0.6 - 1, 0, 10);
  const sg = displace(THREE, s.build(), seed, 3.4, 0.2);
  const top = H - 0.6;
  // 정상의 수도원
  d.box(0xe9dfca, 7.4, 3.6, 5.4, 0, top + 1.8, 0, 0.4);
  d.gable(0xa8553a, 8.4, 6.6, 2.8, 0, top + 3.5, 0, 0.4);
  d.box(0xe9dfca, 2.2, 6.0, 2.2, -2.6, top + 3.0, 1.5, 0.4);
  d.cone(0xa8553a, 1.8, 2.6, -2.6, top + 7.3, 1.5, 4, 0.8);
  d.box(0x3d2a1f, 0.7, 1.0, 0.2, -2.6, top + 5.3, 2.62, 0.4);
  d.box(0x7a5636, 9.5, 0.3, 7.2, 0, top - 0.1, 0, 0.4);
  d.box(COLORS.darkWood, 1.4, 2.2, 0.3, 0.8, top + 1.1, 2.8, 0.4);
  const c = Math.cos(0.4),
    sn = Math.sin(0.4);
  const at = (lx, lz) => [lx * c + lz * sn, -lx * sn + lz * c];
  for (const lx of [-2.2, 3.0]) {
    const [x, z] = at(lx, 2.7);
    addWindow(d, g, x, top + 2.2, z, 0.4, COLORS.shutterRed, [1.0, 1.4]);
  }
  // 바위 중턱의 동굴 창 + 작은 발코니 + 지그재그 계단 + 도르래 줄
  for (const [y, a] of [
    [H * 0.4, 0.2],
    [H * 0.62, 1.3],
    [H * 0.28, 2.6],
  ]) {
    const r = lerp(8.4, 4.4, y / H) - 1.0;
    addWindow(d, g, Math.sin(a) * r, y, Math.cos(a) * r, a, null, [0.9, 1.3]);
  }
  for (let i = 0; i < 12; i++) d.box(0x7a5636, 1.6, 0.18, 0.7, 4.2 + i * 0.1, 1 + i * 1.9, 2.5 + i * 0.1, 0.4 + i * 0.12);
  d.log(COLORS.rope, 0, top - 0.2, 4.4, 0, 3.0, 4.6, 0.07, 3);
  d.box(0x9a6b3f, 1.1, 0.9, 1.1, 0, 2.6, 4.6);
  return { rock: sg, detail: d.build(), glass: g.build() };
}

// ---- 대형 바위 조형물 (로컬: 원점 = 땅 중앙) ----
// v0: 쌍둥이 아치 + 가운데 기둥 + 위로 이어진 능선 / v1: 층층이 쌓인 메사와 주변 첨탑, 동굴 입구
function rockFormationGeometry(kit, v, seed) {
  const THREE = kit.THREE;
  const rand = mulberry32(seed);
  const col = strataColor(THREE, 0xa94a2b, 0xe0975c, 0.5 + v * 0.15);
  const b = kit.builder();
  if (v === 0) {
    const arc = (cx, R0, T0, legH, sz) => {
      const tor = new THREE.TorusGeometry(R0, T0, 7, 18, Math.PI);
      b.add(tor, col, b.matrix(cx, legH, 0, 0, 0, 0, 1, 1, sz));
      tor.dispose();
      for (const sx of [-1, 1]) {
        const leg = new THREE.CylinderGeometry(T0 * 0.95, T0 * 1.45, legH + 5, 8);
        b.add(leg, col, b.matrix(cx + sx * R0, (legH - 5) / 2, 0, 0, 0, 0, 1, 1, sz));
        leg.dispose();
      }
    };
    arc(-15, 13, 4.2, 13, 1.4);
    arc(14, 9.5, 3.7, 11, 1.3);
    b.cyl(col, 5.2, 7.2, 24, -0.4, 11, 0, 9); // 가운데 공유 기둥
    b.ico(col, 6.5, -0.4, 24.5, 0, 1.6, 0.9, 1.1, 1, 0.4); // 두 아치를 잇는 능선
    b.ico(col, 4.2, -17, 29.5, 0, 1.4, 0.8, 1, 1, 1.2);
    b.ico(col, 3.6, 15, 25, 0, 1.3, 0.8, 1, 1, 2.2);
    for (let i = 0; i < 9; i++) {
      const side = i % 2 ? 1 : -1;
      const r = 2 + rand() * 3.2;
      b.ico(col, r, side * (R_(rand, 20, 38)), r * 0.35, R_(rand, -9, 9), 1, 0.75, 1, 0, rand() * 6);
    }
  } else {
    // 층층 메사: 위로 갈수록 좁아지고 중간에 차양처럼 튀어나온 지층
    const tiers = [
      [16, 9, 0],
      [13.4, 7, 9],
      [15.2, 4, 16],
      [10.4, 9, 20],
      [11.6, 3, 29],
      [6.5, 8, 32],
    ];
    tiers.forEach(([r, h, y0], i) => b.cyl(col, r * 0.92, r, h, 0, y0 - 2 + h / 2, 0, 11, i * 0.5));
    b.cone(strataColor(THREE, 0xa94a2b, 0xd8905a, 0.7), 5, 11, 0, 44, 0, 9);
    // 둘레의 첨탑 3개 (높이와 굵기가 제각각, 머리에 모자 바위)
    [
      [24, 6, 24, 3.4],
      [-22, 14, 20, 3.0],
      [4, -26, 28, 3.6],
    ].forEach(([x, z, h, r]) => {
      b.cyl(col, r * 0.62, r * 1.3, h, x, h / 2 - 1.5, z, 9);
      b.ico(strataColor(THREE, 0x9d4529, 0xc97f4d, 0.9), r * 1.5, x, h - 1.2, z, 1, 0.5, 1, 1, rand() * 6);
    });
    // 동굴 입구(어두운 틈)와 바위 조각
    for (let i = 0; i < 4; i++) {
      const a = i * 1.6 + 0.4;
      b.box(0x3a2418, 2.2, 3.6, 0.6, Math.cos(a) * 15.2, 5, Math.sin(a) * 15.2, -a + Math.PI / 2);
    }
    for (let i = 0; i < 10; i++) {
      const a = rand() * TAU,
        r = R_(rand, 17, 34),
        s = 1.6 + rand() * 3;
      b.ico(col, s, Math.cos(a) * r, s * 0.35, Math.sin(a) * r, 1, 0.7, 1, 0, rand() * 6);
    }
  }
  return displace(THREE, b.build(), seed, v ? 2.6 : 2.2, 0.28);
}
const R_ = (rand, a, b) => a + (b - a) * rand();

// ---- 텀블위드 ----
function tumbleGeometry(kit) {
  const THREE = kit.THREE;
  const b = kit.builder();
  const cols = [0xb89a62, 0x9f8350, 0xc7aa72];
  for (let i = 0; i < 7; i++) {
    const tor = new THREE.TorusGeometry(0.8 + (i % 3) * 0.08, 0.07, 4, 12);
    b.add(tor, cols[i % 3], b.matrix(0, 0, 0, i * 0.9, i * 1.3, i * 0.6));
    tor.dispose();
  }
  b.ico(cols[1], 0.55, 0, 0, 0, 1, 1, 1, 0);
  return b.build();
}

export function buildDesert(kit, plan, group) {
  const THREE = kit.THREE;
  const { revealAtXZ, heightAt } = kit.ctx;
  if (!plan.rocks.length && !plan.hoodoos.length && !plan.desert.length && !plan.rockHouses.length && !plan.tumble.length) return null;
  const rand = mulberry32(plan.seed ^ 0xde5e);
  const landmarks = [];
  const disposables = [];
  const subs = [];
  const m4 = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    pos = new THREE.Vector3(),
    sc = new THREE.Vector3(),
    yAxis = new THREE.Vector3(0, 1, 0),
    col = new THREE.Color();

  // ---- 후두 ----
  for (let v = 0; v < 4; v++) {
    const list = plan.hoodoos.filter((h) => h.v === v);
    if (!list.length) continue;
    const geo = hoodooGeometry(kit, v);
    disposables.push(geo);
    const mesh = new THREE.InstancedMesh(geo, kit.staticMat, list.length);
    list.forEach((h, i) => {
      m4.compose(pos.set(h.x, h.y, h.z), q.setFromAxisAngle(yAxis, h.yaw), sc.set(h.s, h.s * (0.9 + (i % 3) * 0.15), h.s));
      mesh.setMatrixAt(i, m4);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  // ---- 대형 바위 조형물 ----
  for (const v of [0, 1]) {
    const list = plan.rocks.filter((r) => r.v === v);
    if (!list.length) continue;
    const geo = rockFormationGeometry(kit, v, plan.seed + 5 + v);
    disposables.push(geo);
    const mesh = new THREE.InstancedMesh(geo, kit.staticMat, list.length);
    list.forEach((r, i) => {
      m4.compose(pos.set(r.x, r.y - 0.3, r.z), q.setFromAxisAngle(yAxis, r.yaw), sc.setScalar(r.s));
      mesh.setMatrixAt(i, m4);
      landmarks.push({ kind: 'rockform', name: v ? '층층 메사' : '쌍둥이 아치', x: r.x, z: r.z, discovered: false });
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  // ---- 사막 식물 ----
  const kinds = { yellow: yellowTuft, sage };
  for (const [name, make] of Object.entries(kinds)) {
    const list = plan.desert.filter((p) => p.kind === name);
    if (!list.length) continue;
    const m = make(kit);
    disposables.push(m.geo);
    const mat = kit.material({
      key: `desert-${name}`,
      swayMode: 'bend',
      sway: [0.5, m.height, 2.0, 0],
      bloom: !!m.head,
      uniforms: m.head ? { uHead: { value: new THREE.Vector3(...m.head) }, uHeadK: { value: 1 } } : {},
    });
    const mesh = new THREE.InstancedMesh(m.geo, mat, list.length);
    list.forEach((p, i) => {
      m4.compose(pos.set(p.x, p.y - 0.05, p.z), q.setFromAxisAngle(yAxis, p.yaw), sc.setScalar(p.s));
      mesh.setMatrixAt(i, m4);
      mesh.setColorAt(i, col.setScalar(0.85 + rand() * 0.3));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    group.add(mesh);
  }

  // ---- 바위집 / 첨탑 수도원 ----
  const houses = [];
  for (const v of [0, 1]) {
    const list = plan.rockHouses.filter((h) => h.v === v);
    if (!list.length) continue;
    const model = v ? spireGeometry(kit, plan.seed + 77) : rockHouseGeometry(kit, plan.seed + 11);
    const geos = v ? [model.rock, model.detail, model.glass] : [model.mound, model.detail, model.glass];
    disposables.push(...geos);
    const meshes = [geos[0], geos[1]].map((g) => {
      const mesh = new THREE.InstancedMesh(g, kit.staticMat, list.length);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      return mesh;
    });
    const lit = new kit.LitSet(model.glass, list.length);
    list.forEach((h, i) => {
      m4.compose(pos.set(h.x, h.y - 0.1, h.z), q.setFromAxisAngle(yAxis, h.yaw), sc.setScalar(h.s));
      meshes.forEach((m) => m.setMatrixAt(i, m4));
      lit.setMatrix(i, m4);
      houses.push({ x: h.x, z: h.z, lamp: new Lamp(rand, [0.3, 2.4]), set: lit, index: i });
      landmarks.push({ kind: v ? 'spire' : 'rockhouse', name: v ? '첨탑 수도원' : '바위집', x: h.x, z: h.z, discovered: false });
    });
    meshes.forEach((m) => (m.instanceMatrix.needsUpdate = true));
    group.add(...meshes, lit.mesh);
    subs.push({ lit });
  }

  // ---- 텀블위드: 구역마다 풀(pool). 평소 몇 개 / 폭풍에는 최대로 늘어나 바람 방향으로 빠르게 굴러간다 ----
  const weeds = [];
  const POOL = 22;
  let weedMesh = null;
  if (plan.tumble.length) {
    const tgeo = tumbleGeometry(kit);
    disposables.push(tgeo);
    const mat = kit.material({ key: 'tumbleweed' });
    weedMesh = new THREE.InstancedMesh(tgeo, mat, POOL * plan.tumble.length);
    weedMesh.frustumCulled = false;
    weedMesh.castShadow = false;
    plan.tumble.forEach((z, zi) => {
      for (let i = 0; i < POOL; i++) {
        weeds.push({
          zone: z,
          idx: zi * POOL + i,
          rank: i,
          x: R(rand, z.min.x + 30, z.max.x - 30),
          z: R(rand, z.min.z + 30, z.max.z - 30),
          y: 40,
          vy: 0,
          life: 0,
          r: R(rand, 0.9, 1.7),
          speedK: R(rand, 0.7, 1.3),
          q: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(rand(), rand(), rand()).normalize(), rand() * TAU),
          wob: rand() * TAU,
        });
      }
    });
    group.add(weedMesh);
  }
  const axis = new THREE.Vector3(),
    dq = new THREE.Quaternion();
  const respawn = (w, wx, wz) => {
    const z = w.zone;
    let x = R(rand, z.min.x + 40, z.max.x - 40),
      zz = R(rand, z.min.z + 40, z.max.z - 40);
    // 풍상 쪽 가장자리로 밀어낸다
    let t = 1e9;
    if (wx > 0.05) t = Math.min(t, (x - z.min.x - 24) / wx);
    else if (wx < -0.05) t = Math.min(t, (z.max.x - 24 - x) / -wx);
    if (wz > 0.05) t = Math.min(t, (zz - z.min.z - 24) / wz);
    else if (wz < -0.05) t = Math.min(t, (z.max.z - 24 - zz) / -wz);
    if (t < 1e8) {
      const back = Math.max(0, t) * R(rand, 0.6, 1);
      x -= wx * back;
      zz -= wz * back;
    }
    w.x = x;
    w.z = zz;
    w.y = heightAt(x, zz) + 6;
    w.vy = 0;
    w.life = 0;
  };

  return {
    landmarks,
    update({ delta, time, windX, windZ, storm }) {
      // 바위집 창문: 탐험하면 한 채씩 불이 켜진다
      for (const h of houses) h.set.set(h.index, h.lamp.step(revealAtXZ(h.x, h.z) > 0.5, delta, 0.8));
      subs.forEach((s) => s.lit.commit());
      if (!weedMesh) return;
      const dt = Math.min(delta, 0.05);
      const nActive = Math.round(4 + 18 * Math.min(1, storm * 1.25));
      for (const w of weeds) {
        const on = w.rank < nActive;
        w.life += ((on ? 1 : 0) - w.life) * Math.min(1, dt * (on ? 1.2 : 0.8));
        if (w.life < 0.01 && !on) {
          weedMesh.setMatrixAt(w.idx, m4.makeScale(0, 0, 0));
          continue;
        }
        const wind = 0.35 + 13 * storm;
        const sp = wind * w.speedK;
        const nx = windX + Math.sin(time * 0.6 + w.wob) * 0.18,
          nz = windZ + Math.cos(time * 0.5 + w.wob) * 0.18;
        const nl = Math.hypot(nx, nz) || 1;
        const vx = (nx / nl) * sp,
          vz = (nz / nl) * sp;
        w.x += vx * dt;
        w.z += vz * dt;
        const z = w.zone;
        if (w.x < z.min.x + 18 || w.x > z.max.x - 18 || w.z < z.min.z + 18 || w.z > z.max.z - 18) {
          respawn(w, windX, windZ);
        }
        const g = heightAt(w.x, w.z);
        if (g < 3) respawn(w, windX, windZ);
        w.vy -= 26 * dt;
        w.y += w.vy * dt;
        const floor = g + w.r * 0.7;
        if (w.y <= floor) {
          w.y = floor;
          // 폭풍이면 튀어 오르며 굴러간다
          w.vy = storm > 0.25 ? R(rand, 0.6, 1) * (3 + 9 * storm) * (rand() < 0.04 + 0.1 * storm ? 2 : 0.35) : 0;
        }
        // 굴러가는 회전: 진행 방향 × 위 방향 축으로 (거리 / 반지름) 만큼
        const dist = Math.hypot(vx, vz) * dt;
        axis.set(vz, 0, -vx).normalize();
        dq.setFromAxisAngle(axis, dist / (w.r * 0.8));
        w.q.premultiply(dq);
        const s = w.r * Math.min(1, w.life * 1.4);
        m4.compose(pos.set(w.x, w.y, w.z), w.q, sc.setScalar(s));
        weedMesh.setMatrixAt(w.idx, m4);
      }
      weedMesh.instanceMatrix.needsUpdate = true;
    },
    reset() {
      houses.forEach((h) => h.lamp.reset());
      weeds.forEach((w) => (w.life = 0));
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
      weedMesh?.dispose();
    },
  };
}
