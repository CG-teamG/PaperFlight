// ============================================================
// 산: 베이지 석재 산장(발코니, 굴뚝 연기, 점등) / 정상 십자가 + 깃발 줄 / 능선 돌탑 / 케이블카
//  - 케이블카: 곤돌라 두 대가 서로 반대로 오가며 바람에 흔들린다. 폭풍이 오면 운행을 멈추고 크게 흔들린다.
// ============================================================
import { COLORS, Lamp, addWindow, lerp, mulberry32, smooth } from '../LandmarkKit.js';
import { flowerBox } from './houses.js';

const TAU_M = Math.PI * 2;

// ---- 산장 (로컬: 원점 = 땅 중앙, 정면/발코니 = +z) ----
function chaletGeometry(kit) {
  const b = kit.builder(),
    g = kit.builder();
  const W = 17,
    D = 11.5,
    H1 = 4.6,
    H2 = 4.2;
  const timber = 0xa87649,
    roof = 0x5b4636;
  b.box(COLORS.stoneDark, W + 1, 6.5, D + 1, 0, -2.7, 0); // 기초(비탈에 묻힘)
  b.box(COLORS.stoneLight, W, H1, D, 0, H1 / 2, 0); // 1층: 베이지 석재
  b.box(timber, W + 0.8, H2, D + 0.8, 0, H1 + H2 / 2, 0); // 2층: 목재
  for (const y of [H1 + 0.05, H1 + H2 - 0.2]) b.box(0x7a5636, W + 1.0, 0.3, D + 1.0, 0, y, 0); // 띠 장식
  b.gable(roof, W + 4.4, D + 5.2, 3.8, 0, H1 + H2 - 0.1, 0); // 낮고 넓은 처마
  // 지붕에 쌓인 눈 (처마 끝은 드러나게 조금 작게) + 처마 끝 눈덩이
  const snow = 0xf4f7fb;
  b.gable(snow, W + 4.0, D + 4.5, 3.8 * ((D + 4.5) / (D + 5.2)) + 0.2, 0, H1 + H2 + 0.18, 0);
  for (let i = 0; i < 7; i++) b.ico(snow, 1.0, -W / 2 - 1.3 + (i / 6) * (W + 2.6), H1 + H2 + 0.15 - 0.0, D / 2 + 1.6, 1.5, 0.5, 0.9, 0, i);
  for (let i = 0; i < 7; i++) b.ico(snow, 1.0, -W / 2 - 1.3 + (i / 6) * (W + 2.6), H1 + H2 + 0.15, -D / 2 - 1.6, 1.5, 0.5, 0.9, 0, i + 3);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU_M;
    b.ico(snow, 2.2 + (i % 3) * 0.8, Math.cos(a) * (W * 0.62), 0.0, Math.sin(a) * (D * 0.9), 1.5, 0.22, 1.2, 0, i); // 땅에 쌓인 눈
  }
  // 발코니
  const bz = D / 2 + 1.7;
  b.box(0x8a6240, W + 0.8, 0.4, 2.8, 0, H1 + 0.1, bz);
  for (let x = -W / 2; x <= W / 2 + 0.1; x += 2.6) b.beam(0x7a5636, x, H1 + 0.3, bz + 1.2, x, H1 + 1.5, bz + 1.2, 0.22);
  for (const y of [H1 + 1.5, H1 + 0.9]) b.box(0x7a5636, W + 0.8, 0.2, 0.2, 0, y, bz + 1.2);
  for (const x of [-W / 2 + 0.4, 0, W / 2 - 0.4]) b.beam(0x6d4a3a, x, -0.5, bz + 1.2, x, H1, bz + 1.2, 0.4);
  // 발코니/창 화분, 처마 장식, 돌계단
  flowerBox(b, 0, H1 + 1.85, bz + 1.4, 0, W - 2.0, 1);
  for (const x of [-W * 0.3, W * 0.3]) flowerBox(b, x, 1.0, D / 2 + 0.55, 0, 2.8, Math.round(x));
  for (const x of [-W * 0.3, 0, W * 0.3]) flowerBox(b, x, H1 + 1.0, D / 2 + 0.95, 0, 2.6, Math.round(x) + 2);
  for (const sx of [-1, 1]) b.beam(0x4a3425, sx * (W / 2 + 2.2), H1 + H2 - 0.1, D / 2 + 2.5, 0, H1 + H2 + 3.7, D / 2 + 2.5, 0.35);
  for (let i = 0; i < 3; i++) b.box(COLORS.stone, 4.2 - i * 0.3, 0.45, 1.1, 0, 0.1 + i * 0.0, D / 2 + 3.2 + i * 1.0);
  b.cyl(COLORS.darkWood, 0.35, 0.35, 1.2, -W / 2 - 1.0, 0.6, D / 2 + 1.2, 6); // 여물통 느낌의 통
  // 굴뚝
  const cx = W * 0.27,
    cz = -D * 0.15,
    top = H1 + H2 + 3.8 + 1.8;
  b.box(COLORS.stoneDark, 2.0, top - 2, 2.0, cx, (top + 2) / 2, cz);
  b.box(COLORS.stone, 2.6, 0.4, 2.6, cx, top, cz);
  b.ico(snow, 1.5, cx, top + 0.4, cz, 1, 0.45, 1, 0, 1); // 굴뚝 위의 눈
  // 문 / 창
  b.box(COLORS.white, 3.1, 4.0, 0.3, 0, 2.0, D / 2 + 0.06);
  b.box(COLORS.darkWood, 2.4, 3.6, 0.4, 0, 1.8, D / 2 + 0.14);
  for (const x of [-W * 0.3, W * 0.3]) addWindow(b, g, x, 2.6, D / 2, 0, COLORS.shutterRed);
  for (const x of [-W * 0.3, 0, W * 0.3]) addWindow(b, g, x, H1 + 2.2, D / 2 + 0.4, 0, COLORS.shutterRed);
  for (const sx of [-1, 1]) {
    addWindow(b, g, sx * W / 2, 2.6, 0, sx * Math.PI / 2, null);
    addWindow(b, g, sx * (W / 2 + 0.4), H1 + 2.2, 0, sx * Math.PI / 2, COLORS.shutterRed);
  }
  addWindow(b, g, 0, H1 + 2.2, -D / 2 - 0.4, Math.PI, null);
  // 장작더미
  for (let row = 0; row < 3; row++)
    for (let i = 0; i < 4 - row; i++) b.cyl(COLORS.bark, 0.42, 0.42, 3.0, W / 2 + 1.5, 0.45 + row * 0.8, -1.5 + i * 0.9 + row * 0.45, 6, 0, Math.PI / 2, 0);
  // 이정표
  b.beam(COLORS.darkWood, W / 2 + 4, -0.5, D / 2 + 3, W / 2 + 4, 3.4, D / 2 + 3, 0.28);
  b.box(COLORS.lightWood, 2.4, 0.7, 0.18, W / 2 + 4.9, 3.0, D / 2 + 3);
  return { body: b.build(), glass: g.build(), chimney: [cx, top + 0.6, cz] };
}

// ---- 돌탑 (월드 좌표) ----
function addCairn(b, rand, x, y, z, s, stones = 5) {
  const cols = [0xa39d92, 0xb5ae9f, 0x948e84, 0xc0b9aa];
  for (let i = 0; i < stones; i++) {
    const r = (1.5 - i * 0.22) * s * (0.85 + rand() * 0.3);
    b.cyl(cols[(i + Math.floor(rand() * 4)) % 4], r * 0.9, r, 0.55 * s, x + (rand() - 0.5) * 0.3 * s, y + (0.25 + i * 0.5) * s, z + (rand() - 0.5) * 0.3 * s, 7, rand() * 6);
  }
  b.ico(0xb5ae9f, 0.45 * s, x, y + (0.25 + stones * 0.5) * s + 0.1 * s, z, 1, 0.8, 1, 0);
}

// ---- 정상 풍차 (탑은 월드 좌표의 정적 지오메트리, 머리(지붕+날개)는 바람 쪽으로 돌아간다) ----
const MILL_H = 11.5;
function windmillTower(kit, plan, rand) {
  const stat = kit.builder();
  for (const s of plan.summits) {
    const base = s.y - 1.2;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rand();
      stat.ico(0x948e84, 1.5 + rand(), s.x + Math.cos(a) * 4.8, base + 0.5, s.z + Math.sin(a) * 4.8, 1.2, 0.7, 1.2, 0, i);
    }
    stat.cyl(COLORS.stoneDark, 5.0, 7.5, 16, s.x, base - 6.2, s.z, 10); // 깊이 박힌 석조 기초 (경사에서 떠 보이지 않게)
    stat.cyl(COLORS.stoneDark, 4.4, 5.0, 1.6, s.x, base + 1.0, s.z, 10);
    stat.cyl(0xece3d0, 2.7, 3.7, MILL_H, s.x, base + 1.8 + MILL_H / 2, s.z, 10);
    for (const y of [3, 6.5, 9.5]) stat.cyl(0xd9cdb4, 3.2 - y * 0.075, 3.2 - y * 0.075, 0.18, s.x, base + 1.8 + y, s.z, 10);
    const f = (ang, r, y) => [s.x + Math.sin(ang) * r, base + 1.8 + y, s.z + Math.cos(ang) * r];
    const door = f(s.yaw, 3.55, 1.6);
    stat.box(COLORS.darkWood, 1.5, 2.8, 0.3, door[0], door[1] + 0.1, door[2], s.yaw);
    for (const [da, y] of [
      [1.9, 6.0],
      [-1.9, 6.0],
      [0.9, 9.0],
    ]) {
      const w = f(s.yaw + da, 2.95 - y * 0.075 + 0.25, y);
      stat.box(0x6d4a3a, 1.0, 1.4, 0.25, w[0], w[1], w[2], s.yaw + da);
    }
    stat.cyl(0x7a5636, 3.9, 3.9, 0.35, s.x, base + 1.8 + MILL_H, s.z, 10);
  }
  return stat.build();
}

// 풍차 머리 (로컬: 원점 = 탑 꼭대기, 날개 방향 = +z)
function windmillHead(kit) {
  const roof = kit.builder(),
    blades = kit.builder();
  roof.cone(0x7a4a30, 3.7, 3.6, 0, 1.8, 0, 10);
  roof.cyl(0x5e3f26, 0.35, 0.35, 1.6, 0, 3.9, 0, 6);
  roof.cyl(0x40454d, 0.4, 0.4, 2.2, 0, 1.7, 2.7, 8, 0, Math.PI / 2);
  roof.beam(0x6d4a3a, 0, 1.8, -2.5, 0, 1.8, -7.5, 0.35);
  roof.box(0x6d4a3a, 0.2, 2.2, 1.6, 0, 1.8, -7.3);
  const cloth = 0xf1e6cc,
    wood = 0x6d4a3a;
  blades.cyl(0x40454d, 0.7, 0.7, 0.6, 0, 0, 0, 8, 0, Math.PI / 2);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const ca = Math.cos(a),
      sa = Math.sin(a);
    const at = (r, off) => [-sa * r + ca * off, ca * r + sa * off];
    let [x, y] = at(5.6, 0);
    blades.box(wood, 0.35, 11.2, 0.35, x, y, 0, 0, 0, a);
    [x, y] = at(6.4, 1.4);
    blades.box(cloth, 2.5, 8.2, 0.1, x, y, 0.05, 0, 0, a);
    for (let k = 0; k < 7; k++) {
      [x, y] = at(2.5 + k * 1.05, 1.4);
      blades.box(wood, 2.6, 0.12, 0.16, x, y, 0.1, 0, 0, a);
    }
    [x, y] = at(6.4, 2.65);
    blades.box(wood, 0.14, 8.2, 0.16, x, y, 0.1, 0, 0, a);
  }
  return { roof: roof.build(), blades: blades.build() };
}

// ---- 케이블카 ----
function stationGeometry(kit) {
  const b = kit.builder();
  b.box(COLORS.stoneDark, 10, 5, 10, 0, -1.5, 0);
  b.box(COLORS.stoneLight, 9, 7, 8.5, 0, 3.5, 0);
  b.box(0xa87649, 7.6, 3.4, 7.2, 0, 8.2, 0);
  b.gable(0x5b4636, 11, 9.5, 2.8, 0, 9.8, 0, Math.PI / 2);
  b.cyl(COLORS.steel, 1.7, 1.7, 5.4, 0, 12.3, 1.2, 12, 0, 0, Math.PI / 2); // 도르래
  b.box(COLORS.darkWood, 2.2, 3.4, 0.4, 0, 1.7, 4.4);
  b.box(COLORS.white, 2.6, 0.5, 0.3, 0, 3.6, 4.4);
  return b.build();
}

function pylonGeometry(kit, n) {
  const b = kit.builder();
  const gy = n.ground - 2,
    top = n.y;
  const rB = 2.6,
    rT = 0.9;
  const rAt = (y) => lerp(rB, rT, (y - gy) / (top - gy));
  const cs = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  for (const [sx, sz] of cs) b.beam(COLORS.steel, n.x + sx * rB, gy, n.z + sz * rB, n.x + sx * rT, top, n.z + sz * rT, 0.34);
  const lv = [gy, lerp(gy, top, 0.38), lerp(gy, top, 0.72), top];
  for (let l = 1; l < lv.length; l++)
    for (let i = 0; i < 4; i++) {
      const [ax, az] = cs[i],
        [bx, bz] = cs[(i + 1) % 4];
      const y0 = lv[l - 1],
        y1 = lv[l];
      b.beam(COLORS.steel, n.x + ax * rAt(y0), y0, n.z + az * rAt(y0), n.x + bx * rAt(y1), y1, n.z + bz * rAt(y1), 0.16);
      b.beam(COLORS.steel, n.x + bx * rAt(y0), y0, n.z + bz * rAt(y0), n.x + ax * rAt(y1), y1, n.z + az * rAt(y1), 0.16);
    }
  return b.build();
}

function gondolaGeometry(kit) {
  const b = kit.builder();
  b.beam(COLORS.steel, 0, 0, 0, 0, -2.6, 0, 0.2);
  b.box(COLORS.steel, 0.9, 0.5, 0.9, 0, 0.1, 0);
  b.box(0x9d3b32, 4.4, 3.0, 3.4, 0, -4.2, 0);
  b.box(0xf1e7cf, 4.45, 0.7, 3.45, 0, -3.6, 0);
  b.box(0x6d2a24, 4.9, 0.3, 3.9, 0, -2.6, 0);
  for (const sx of [-1, 1]) b.box(0x8aa0ae, 0.1, 1.2, 2.6, sx * 2.22, -4.5, 0);
  for (const sz of [-1, 1]) b.box(0x8aa0ae, 3.4, 1.2, 0.1, 0, -4.5, sz * 1.72);
  return b.build();
}

function buildCableCar(kit, car, group) {
  const THREE = kit.THREE;
  const nodes = car.nodes;
  const first = nodes[0],
    last = nodes[nodes.length - 1];
  let ax = last.x - first.x,
    az = last.z - first.z;
  const al = Math.hypot(ax, az);
  ax /= al;
  az /= al;
  const lat = [-az, ax];
  const OFF = 2.3;
  const heading = Math.atan2(ax, az);
  const parts = [];

  // 정류장 (정면 +z 가 케이블 방향)
  const stGeo = stationGeometry(kit);
  parts.push(stGeo);
  nodes.forEach((n, i) => {
    if (i !== 0 && i !== nodes.length - 1) return;
    const st = kit.mesh(stGeo, kit.staticMat);
    st.position.set(n.x, n.ground - 0.2, n.z);
    st.rotation.y = i === 0 ? heading : heading + Math.PI;
    group.add(st);
  });

  // 철탑 + 케이블 (월드 좌표)
  const stat = kit.builder();
  for (let i = 1; i < nodes.length - 1; i++) {
    const g = pylonGeometry(kit, nodes[i]);
    parts.push(g);
    group.add(kit.mesh(g, kit.staticMat));
    const n = nodes[i];
    stat.box(COLORS.steel, 0.5, 0.5, OFF * 2 + 2.4, n.x, n.y + 0.2, n.z, Math.atan2(lat[0], lat[1]));
  }
  const SUB = 8;
  const sagOf = (len) => 0.012 * len;
  const segs = [];
  let total = 0;
  for (let i = 0; i < nodes.length - 1; i++) {
    const len = Math.hypot(nodes[i + 1].x - nodes[i].x, nodes[i + 1].z - nodes[i].z);
    segs.push({ len, start: total });
    total += len;
  }
  // 경로 위의 점 (정류장 사이 s=0..1), 케이블 한쪽(side = ±1)
  const pointOn = (s, side, out) => {
    const d = s * total;
    let i = segs.findIndex((g, k) => d <= g.start + g.len || k === segs.length - 1);
    i = Math.max(0, i);
    const t = Math.min(1, Math.max(0, (d - segs[i].start) / segs[i].len));
    const a = nodes[i],
      c = nodes[i + 1];
    out.set(
      lerp(a.x, c.x, t) + lat[0] * OFF * side,
      lerp(a.y, c.y, t) - sagOf(segs[i].len) * 4 * t * (1 - t),
      lerp(a.z, c.z, t) + lat[1] * OFF * side,
    );
    return i;
  };
  const p0 = new THREE.Vector3(),
    p1 = new THREE.Vector3();
  for (const side of [-1, 1]) {
    const N = nodes.length - 1;
    for (let i = 0; i < N * SUB; i++) {
      pointOn(i / (N * SUB), side, p0);
      pointOn((i + 1) / (N * SUB), side, p1);
      stat.log(0x3d4348, p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, 0.2, 4);
    }
  }
  const cableGeo = stat.build();
  parts.push(cableGeo);
  group.add(kit.mesh(cableGeo, kit.staticMat));

  // 곤돌라 두 대
  const gGeo = gondolaGeometry(kit);
  parts.push(gGeo);
  const cars = [1, -1].map((side) => {
    const root = new THREE.Group();
    root.rotation.order = 'YXZ';
    const cabin = kit.mesh(gGeo, kit.staticMat);
    root.add(cabin);
    group.add(root);
    return { root, side };
  });

  const HALF_TRIP = 46; // 한 번 오가는 데 걸리는 시간(초)
  let phase = 0;
  const tmp = new THREE.Vector3();
  const mid = nodes[Math.floor(nodes.length / 2)];

  return {
    landmark: { kind: 'cablecar', name: '케이블카', x: mid.x, z: mid.z, discovered: false },
    update({ delta, time, storm, windX, windZ, k }) {
      phase += (delta * (1 - smooth(0.2, 0.65, storm))) / HALF_TRIP; // 폭풍: 운행 중지
      const x = phase % 2;
      const tri = x < 1 ? x : 2 - x;
      const e = smooth(0, 1, Math.min(1, Math.max(0, (tri - 0.05) / 0.9)));
      cars.forEach((c, idx) => {
        const s = idx === 0 ? e : 1 - e;
        const seg = pointOn(s, c.side, tmp);
        c.root.position.copy(tmp);
        const dirSign = idx === 0 ? (x < 1 ? 1 : -1) : x < 1 ? -1 : 1;
        c.root.rotation.y = heading + (dirSign < 0 ? Math.PI : 0);
        const swing = Math.sin(time * 1.15 + idx * 1.7) * (0.02 + 0.16 * k);
        c.root.rotation.z = swing + 0.09 * k * (windX * lat[0] + windZ * lat[1]) * (dirSign < 0 ? -1 : 1);
        c.root.rotation.x = Math.sin(time * 0.9 + idx) * (0.01 + 0.05 * k) + (nodes[seg + 1].y - nodes[seg].y) * 0.0005;
      });
    },
    reset() {
      phase = 0;
    },
    dispose() {
      parts.forEach((g) => g.dispose());
    },
  };
}

export function buildMountain(kit, plan, group, smoke) {
  const THREE = kit.THREE;
  const { revealAtXZ } = kit.ctx;
  if (!plan.chalets.length && !plan.summits.length && !plan.cairns.length && !plan.cableCars.length) return null;
  const rand = mulberry32(plan.seed ^ 0x3a17);
  const landmarks = [];
  const disposables = [];
  const subs = [];

  // ---- 산장 ----
  const chalets = [];
  if (plan.chalets.length) {
    const model = chaletGeometry(kit);
    disposables.push(model.body, model.glass);
    const body = new THREE.InstancedMesh(model.body, kit.staticMat, plan.chalets.length);
    const lit = new kit.LitSet(model.glass, plan.chalets.length);
    const m = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      v = new THREE.Vector3();
    plan.chalets.forEach((c, i) => {
      m.compose(v.set(c.x, c.y - 0.1, c.z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), c.yaw), new THREE.Vector3(1, 1, 1));
      body.setMatrixAt(i, m);
      lit.setMatrix(i, m);
      const e = new THREE.Vector3(...model.chimney).applyMatrix4(m);
      chalets.push({ x: c.x, z: c.z, lamp: new Lamp(rand, [0.3, 1.5]), smoke: smoke.add(e.x, e.y, e.z, 1.15), index: i });
      landmarks.push({ kind: 'chalet', name: '산장', x: c.x, z: c.z, discovered: false });
    });
    body.castShadow = body.receiveShadow = true;
    body.frustumCulled = false;
    group.add(body, lit.mesh);
    subs.push({
      update({ delta }) {
        for (const c of chalets) {
          const val = c.lamp.step(revealAtXZ(c.x, c.z) > 0.55, delta, 1.0);
          lit.set(c.index, val);
          smoke.setTarget(c.smoke, c.lamp.value > 0.4 ? 1 : 0);
        }
        lit.commit();
      },
      reset: () => chalets.forEach((c) => c.lamp.reset()),
    });
  }

  // ---- 정상 풍차 / 돌탑 ----
  {
    const stat = kit.builder();
    for (const c of plan.cairns) addCairn(stat, rand, c.x, c.y - 0.4, c.z, c.s * 1.7, 5);
    const parts = [stat.build()];
    if (plan.summits.length) parts.push(windmillTower(kit, plan, rand));
    for (const g of parts) {
      group.add(kit.mesh(g, kit.staticMat));
      disposables.push(g);
    }
    if (plan.summits.length) {
      const head = windmillHead(kit);
      disposables.push(head.roof, head.blades);
      const mills = plan.summits.map((s) => {
        const g = new THREE.Group();
        g.position.set(s.x, s.y - 1.2 + 1.8 + MILL_H, s.z);
        g.add(kit.mesh(head.roof, kit.staticMat));
        const bl = kit.mesh(head.blades, kit.staticMat);
        bl.position.set(0, 1.8, 3.9);
        g.add(bl);
        group.add(g);
        return { g, bl, yaw: s.yaw, spin: rand() * 6 };
      });
      subs.push({
        update({ delta, windX, windZ, k }) {
          // 바람이 불어오는 쪽으로 머리를 돌리고, 바람이 셀수록 빨리 돈다
          const target = Math.atan2(-windX, -windZ);
          for (const m of mills) {
            let d = target - m.yaw;
            d = Math.atan2(Math.sin(d), Math.cos(d));
            m.yaw += d * (1 - Math.exp(-delta * 0.6));
            m.g.rotation.y = m.yaw;
            m.spin += delta * (0.35 + 3.2 * k);
            m.bl.rotation.z = m.spin;
          }
        },
        reset() {},
      });
    }
    plan.summits.forEach((s) => landmarks.push({ kind: 'summit', name: '정상 풍차', x: s.x, z: s.z, discovered: false }));
  }

  // ---- 케이블카 ----
  for (const car of plan.cableCars) {
    const cc = buildCableCar(kit, car, group);
    landmarks.push(cc.landmark);
    subs.push(cc);
    disposables.push({ dispose: cc.dispose });
  }

  return {
    landmarks,
    update(frame) {
      subs.forEach((s) => s.update(frame));
    },
    reset() {
      subs.forEach((s) => s.reset());
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
    },
  };
}
