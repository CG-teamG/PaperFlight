// ============================================================
// 선박장: 해변의 보트하우스(굴뚝 연기, 점등) + 바다로 뻗은 나무 부두(탐험하면 부두 등불이 켜짐) +
//         잔잔한 날 타원 항로를 도는 돛단배들. 돛은 바람에 따라 붐이 돌아가고 배는 바람에 기울며 파도를 탄다.
//         폭풍이 오면 돛을 내리고 부두로 귀항해 계류하며, 잦아들면 다시 후진해 나와 항해를 재개한다.
// ============================================================
import { COLORS, Lamp, lerp, mulberry32 } from '../LandmarkKit.js';

const TAU = Math.PI * 2;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Environment 의 water 정점 셰이더와 동일해야 한다 (sea.js 와 같은 식)
function waveH(x, z, t) {
  return Math.sin(x * 0.045 + t * 1.3) * 0.6 + Math.cos(z * 0.05 + t * 1.0) * 0.5 + Math.sin((x + z) * 0.09 + t * 1.9) * 0.25;
}

const VARIANTS = [
  { hull: 0x2f5f8a, bottom: 0x6d2a28, sail: 0xf3ede0, jib: 0xe9dfc8 },
  { hull: 0xb8433a, bottom: 0x3b2a26, sail: 0xf6f1e4, jib: 0xd96a52 },
  { hull: 0x2f6b54, bottom: 0x4a2f24, sail: 0xeadbb2, jib: 0xf3ede0 },
];

// ---- 선체 (로컬: 원점 = 수선 중앙, 뱃머리 = +z) ----
const Z0 = -4.3,
  Z1 = 5.5;
const widthAt = (z) => {
  const t = (z - Z0) / (Z1 - Z0); // 0 선미 ~ 1 선수
  const body = Math.sin(Math.PI * Math.pow(t, 0.8) * 0.97 + 0.15);
  return 1.75 * clamp(body, 0.0, 1) * (t > 0.82 ? 1 - Math.pow((t - 0.82) / 0.18, 1.3) * 0.88 : 1) * (t < 0.06 ? 0.75 : 1);
};
const sheerAt = (z) => 1.0 + 0.5 * Math.pow(Math.max(0, (z - 1) / (Z1 - 1)), 2.0) + 0.1 * Math.pow(Math.max(0, (Z0 + 2.5 - z) / 2.5), 1);

function hullGeometry(kit, v) {
  const THREE = kit.THREE;
  const b = kit.builder();
  const stations = 12;
  const pts = [];
  for (let k = 0; k <= stations; k++) {
    const z = lerp(Z0, Z1, k / stations);
    const w = Math.max(0.05, widthAt(z));
    const top = sheerAt(z);
    const d = 0.95 * (1 - Math.pow(Math.max(0, (z - 1.5) / (Z1 - 1.5)), 1.4) * 0.8);
    pts.push([
      [-w, top],
      [-w * 0.97, 0.25],
      [-w * 0.62, -d * 0.62],
      [0, -d],
      [w * 0.62, -d * 0.62],
      [w * 0.97, 0.25],
      [w, top],
    ].map(([x, y]) => [x, y, z]));
  }
  const pos = [];
  const quad = (a, b2, c, d2) => pos.push(...a, ...b2, ...c, ...a, ...c, ...d2);
  for (let k = 0; k < stations; k++)
    for (let i = 0; i < 6; i++) quad(pts[k][i], pts[k][i + 1], pts[k + 1][i + 1], pts[k + 1][i]);
  // 갑판
  for (let k = 0; k < stations; k++) quad([pts[k][0][0] * 0.96, pts[k][0][1] - 0.04, pts[k][0][2]], [pts[k][6][0] * 0.96, pts[k][6][1] - 0.04, pts[k][6][2]], [pts[k + 1][6][0] * 0.96, pts[k + 1][6][1] - 0.04, pts[k + 1][6][2]], [pts[k + 1][0][0] * 0.96, pts[k + 1][0][1] - 0.04, pts[k + 1][0][2]]);
  // 선미 판
  quad(pts[0][0], pts[0][6], pts[0][4], pts[0][2]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const hull = new THREE.Color(VARIANTS[v].hull),
    bottom = new THREE.Color(VARIANTS[v].bottom),
    trim = new THREE.Color(0xf1e8d2),
    deck = new THREE.Color(0xc9a572);
  const colorFn = (x, y, z) => {
    const top = sheerAt(z);
    if (y > top - 0.07 && y < top - 0.0 && Math.abs(x) < widthAt(z) * 0.97) return deck;
    if (y > top - 0.3) return trim;
    if (y < 0.05) return bottom;
    return hull;
  };
  b.add(g, colorFn, new THREE.Matrix4());
  g.dispose();
  // 갑판 위: 선실, 조종석, 키, 난간 기둥, 구명 튜브
  b.box(0xefe6d0, 2.3, 0.75, 2.0, 0, sheerAt(-1.4) + 0.3, -1.4);
  b.box(0x7a5636, 2.4, 0.1, 2.1, 0, sheerAt(-1.4) + 0.72, -1.4);
  b.box(COLORS.glass, 1.2, 0.28, 0.1, 0, sheerAt(-1.4) + 0.32, -0.38);
  b.beam(0x5e3f26, 0, sheerAt(-3.6) + 0.1, -3.7, 0, sheerAt(-3.6) + 0.55, -4.5, 0.12);
  b.cyl(0xc7402f, 0.3, 0.3, 0.12, 0.95, sheerAt(-1) + 0.3, -0.1, 8, 0, Math.PI / 2);
  b.beam(0x40454d, 0, sheerAt(0.9), 0.9, 0, 11.2, 0.9, 0.2); // 돛대
  b.beam(0x40454d, 0, 11.0, 0.9, 0, sheerAt(Z1), Z1 - 0.1, 0.05); // 앞 버팀줄
  b.beam(0x40454d, 0, 11.0, 0.9, 0, sheerAt(Z0) + 0.3, Z0 + 0.1, 0.05); // 뒤 버팀줄
  b.cone(0xc7402f, 0.5, 0.9, 0, 11.7, 0.9, 4);
  return b.build();
}

// ---- 돛 (원점 = 돛대 아랫부분, 로컬 평면 x=0) ----
function sailGeometries(kit, v) {
  const main = kit.builder(),
    jib = kit.builder();
  const triWithBelly = (b, color, A, B, C, belly, wl) => {
    // A=luff 아래, B=luff 위(head), C=clew. 가운데를 +x 로 부풀린다. wl: leech 쪽 흔들림 가중
    const mid = (p, q, o = 0) => [(p[0] + q[0]) / 2 + o, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
    const Mf = mid(C, A, belly * 0.55),
      Ml = mid(B, C, belly * 0.5),
      K = [(A[0] + B[0] + C[0]) / 3 + belly, (A[1] + B[1] + C[1]) / 3, (A[2] + B[2] + C[2]) / 3];
    b.tri(color, A, Mf, K, 0, 0.5 * wl, 0.5 * wl);
    b.tri(color, Mf, C, K, 0.5 * wl, wl, 0.5 * wl);
    b.tri(color, C, Ml, K, wl, 0.85 * wl, 0.5 * wl);
    b.tri(color, Ml, B, K, 0.85 * wl, 0.15 * wl, 0.5 * wl);
    b.tri(color, B, A, K, 0.1 * wl, 0, 0.5 * wl);
  };
  triWithBelly(main, VARIANTS[v].sail, [0, 1.6, 0.1], [0, 10.6, 0.1], [0, 1.9, -4.3], 0.5, 1);
  main.beam(0x7a5636, 0, 1.65, 0.1, 0, 1.9, -4.3, 0.16); // 붐
  triWithBelly(jib, VARIANTS[v].jib, [0, 1.5, 5.1], [0, 10.2, 1.0], [0, 1.9, 1.9], -0.45, 1);
  return { main: main.build(), jib: jib.build() };
}

// ---- 선박장 시설 (로컬: 원점 = 부두 시작 해안점, +z = 바다 쪽) ----
function harborGeometry(kit, h) {
  const { heightAt } = kit.ctx;
  const b = kit.builder(),
    g = kit.builder();
  const c = Math.cos(h.yaw),
    s = Math.sin(h.yaw);
  const world = (lx, lz) => [h.x + lx * c + lz * s, h.z - lx * s + lz * c];
  const DECK = 2.4,
    HW = 2.5,
    L = h.pierLen;
  const woods = [0x9a7448, 0x8a6740, 0xa98154, 0x7f6038];
  for (let z = -4, i = 0; z < L; z += 1.0, i++) b.box(woods[i % 4], HW * 2, 0.22, 0.9, 0, DECK, z + 0.5);
  for (const sx of [-1, 1]) b.box(0x5e3f26, 0.35, 0.4, L + 5, sx * (HW - 0.1), DECK - 0.35, (L - 4) / 2);
  for (let z = 2; z <= L; z += 6)
    for (const sx of [-1, 1]) {
      const [wx, wz] = world(sx * (HW - 0.2), z);
      const sea = heightAt(wx, wz);
      const bottom = Math.min(DECK - 0.4, Math.max(sea - 0.5, -14));
      b.cyl(0x4a3524, 0.3, 0.34, DECK + 0.9 - bottom, sx * (HW - 0.2), (DECK + 0.9 + bottom) / 2, z, 7);
    }
  for (let z = 2; z <= L; z += 6) b.box(0x5e3f26, HW * 2 + 0.6, 0.3, 0.35, 0, DECK - 0.6, z);
  // 계류 말뚝, 구석의 통과 그물
  for (let i = 0; i < 6; i++) {
    const z = L - 8 - Math.floor(i / 2) * 12,
      sx = i % 2 ? 1 : -1;
    b.cyl(0x2f2a26, 0.18, 0.22, 0.6, sx * (HW - 0.35), DECK + 0.45, z, 6);
  }
  // 등불 기둥 (유리는 탐험하면 켜진다)
  for (const z of [12, 30, 48, L - 1.5])
    for (const sx of [-1, 1]) {
      b.beam(0x40454d, sx * (HW - 0.35), DECK, z, sx * (HW - 0.35), DECK + 3.0, z, 0.14);
      b.box(0x40454d, 0.7, 0.12, 0.7, sx * (HW - 0.35), DECK + 3.55, z);
      g.ico(COLORS.glass, 0.34, sx * (HW - 0.35), DECK + 3.28, z, 1, 1.15, 1, 1, 0);
    }
  // 부두 끝: 통, 상자, 밧줄 더미, 이정표
  for (const [x, z] of [
    [-1.2, L - 2.6],
    [-0.1, L - 2.9],
    [1.1, L - 2.3],
  ])
    b.cyl(0x7a5a3a, 0.5, 0.5, 1.1, x, DECK + 0.65, z, 8);
  b.box(COLORS.lightWood, 1.2, 0.9, 1.2, 1.3, DECK + 0.55, L - 5);
  b.cyl(COLORS.rope, 0.5, 0.5, 0.25, -1.4, DECK + 0.25, L - 6, 10);
  b.beam(COLORS.darkWood, 0, DECK, L - 0.2, 0, DECK + 2.2, L - 0.2, 0.2);
  b.box(0xe9dfc6, 1.4, 0.7, 0.14, 0, DECK + 2.1, L - 0.2);
  // 보트하우스: 부두 옆 해변 (로컬 좌표로 변환)
  const dx = h.house.x - h.x,
    dz = h.house.z - h.z;
  const hx = dx * c - dz * s,
    hz = dx * s + dz * c;
  const gy = h.house.y;
  const base = gy - 0.3;
  b.box(COLORS.stoneDark, 9.6, 1.0, 7.6, hx, base + 0.3, hz);
  b.box(0x6b86a0, 9, 4.2, 7, hx, base + 0.4 + 2.1, hz);
  for (let i = 0; i < 6; i++) b.box(0x5f7a92, 9.05, 0.1, 7.05, hx, base + 1.0 + i * 0.65, hz);
  b.gable(0x8c3b32, 10.2, 8.8, 3.6, hx, base + 4.5, hz, 0);
  b.box(COLORS.darkWood, 3.6, 3.5, 0.3, hx - 1.4, base + 2.2, hz + 3.55); // 보트 출입문
  b.box(0x4a3326, 0.12, 3.5, 0.34, hx - 1.4, base + 2.2, hz + 3.6);
  const sxw = hx + 2.7,
    szw = hz + 3.45;
  b.box(COLORS.white, 1.9, 1.9, 0.2, sxw, base + 3.0, szw);
  g.box(COLORS.glass, 1.4, 1.4, 0.28, sxw, base + 3.0, szw + 0.1);
  b.box(COLORS.shutterBlue, 0.6, 1.9, 0.18, sxw - 1.25, base + 3.0, szw + 0.05);
  b.box(COLORS.shutterBlue, 0.6, 1.9, 0.18, sxw + 1.25, base + 3.0, szw + 0.05);
  b.box(0x6d4a3a, 1.4, 0.18, 0.18, hx, base + 7.6, hz + 0.4, 0); // 들보 끝 도르래
  const chx = hx + 3.1,
    chz = hz - 1.2,
    top = base + 8.6;
  b.box(COLORS.stoneDark, 1.2, 4.2, 1.2, chx, top - 2.0, chz);
  b.box(COLORS.stone, 1.7, 0.3, 1.7, chx, top + 0.1, chz);
  // 옆: 뒤집어 놓은 거룻배, 통발, 그물
  const row = (x, z) => {
    b.ico(0x8a5a34, 1.5, x, base + 0.9, z, 1.0, 0.55, 2.4, 1, 0.3);
    b.ico(0x3b6b86, 1.5, x, base + 0.7, z, 1.02, 0.4, 2.42, 1, 0.3);
  };
  row(hx - 6.2, hz + 1.0);
  for (let i = 0; i < 4; i++) b.cyl(0xb98d5a, 0.55, 0.55, 0.9, hx + 5.6 + (i % 2) * 0.9, base + 0.6 + (i > 1 ? 0.8 : 0), hz + 1.6 + ((i + 1) % 2) * 0.2, 7);
  // 해변 쪽 돌 길 (부두 시작 ~ 보트하우스)
  for (let i = 0; i < 6; i++) b.ico(0xb5ab98, 0.9, lerp(hx, 0, i / 6), 0.1, lerp(hz + 4.6, -2, i / 6), 1.6, 0.18, 1.2, 0, i);
  return { body: b.build(), glass: g.build(), chimney: [chx, top + 0.6, chz], world, DECK };
}

export function buildHarbor(kit, plan, group, smoke) {
  const THREE = kit.THREE;
  const { revealAtXZ, heightAt } = kit.ctx;
  if (!plan.harbors.length) return null;
  const rand = mulberry32(plan.seed ^ 0x4a7b);
  const HALF = kit.ctx.HALF ?? 1000;
  const landmarks = [];
  const disposables = [];
  const harbors = [];
  const hullGeos = [],
    sailGeos = [];
  const sailMat = kit.material({ key: 'sailcloth', swayMode: 'attr', sway: [0.55, 1, 5.5, 0] });
  const wakeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const wakeGeo = new THREE.BufferGeometry();
  wakeGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 4.2, -1.7, 0, -4, 1.7, 0, -4, -1.7, 0, -4, -4.6, 0, -15, -1.3, 0, -15, 1.7, 0, -4, 1.3, 0, -15, 4.6, 0, -15, -1.7, 0, -4, -1.3, 0, -15, 1.3, 0, -15, -1.7, 0, -4, 1.3, 0, -15, 1.7, 0, -4], 3));
  disposables.push(wakeGeo, wakeMat);
  VARIANTS.forEach((_, v) => {
    hullGeos[v] = hullGeometry(kit, v);
    sailGeos[v] = sailGeometries(kit, v);
    disposables.push(hullGeos[v], sailGeos[v].main, sailGeos[v].jib);
  });

  const m4 = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    pos = new THREE.Vector3(),
    one = new THREE.Vector3(1, 1, 1),
    yAxis = new THREE.Vector3(0, 1, 0);

  for (const hb of plan.harbors) {
    const model = harborGeometry(kit, hb);
    disposables.push(model.body, model.glass);
    const mesh = kit.mesh(model.body, kit.staticMat);
    mesh.position.set(hb.x, 0, hb.z);
    mesh.rotation.y = hb.yaw;
    group.add(mesh);
    const lit = new kit.LitSet(model.glass, 1);
    lit.setMatrix(0, m4.compose(pos.set(hb.x, 0, hb.z), q.setFromAxisAngle(yAxis, hb.yaw), one));
    group.add(lit.mesh);
    const ce = new THREE.Vector3(...model.chimney).applyMatrix4(m4);
    const mid = { x: hb.x + hb.dx * hb.pierLen * 0.5, z: hb.z + hb.dz * hb.pierLen * 0.5 };
    const rec = { hb, lit, lamp: new Lamp(rand, [0.3, 1.6]), smoke: smoke.add(ce.x, ce.y, ce.z, 0.9), mid, boats: [] };
    landmarks.push({ kind: 'harbor', name: '선박장', x: mid.x, z: mid.z, discovered: false });

    const P = (lz, lat) => ({ x: hb.x + hb.dx * lz - hb.dz * lat, z: hb.z + hb.dz * lz + hb.dx * lat });
    const G = P(hb.pierLen + 26, 0);
    hb.boats.forEach((bd, i) => {
      const side = i % 2 ? 1 : -1;
      const s = hb.pierLen - 8 - Math.floor(i / 2) * 12;
      const berth = P(s, side * 5.0),
        entry = P(hb.pierLen + 14, side * 5.0);
      const root = new THREE.Group();
      const hullG = new THREE.Group();
      hullG.rotation.order = 'YXZ';
      const hullMesh = kit.mesh(hullGeos[bd.variant], kit.staticMat);
      const mainG = new THREE.Group(),
        jibG = new THREE.Group();
      mainG.position.set(0, 0, 0.9);
      mainG.add(kit.mesh(sailGeos[bd.variant].main, sailMat, { cast: false }));
      jibG.add(kit.mesh(sailGeos[bd.variant].jib, sailMat, { cast: false }));
      hullG.add(hullMesh, mainG, jibG);
      const wake = new THREE.Mesh(wakeGeo, wakeMat.clone());
      wake.position.y = 0.45;
      wake.renderOrder = 3;
      wake.frustumCulled = false;
      root.add(wake, hullG);
      group.add(root);
      disposables.push({ dispose: () => wake.material.dispose() });
      const e1 = [Math.cos(bd.rot), Math.sin(bd.rot)],
        e2 = [-Math.sin(bd.rot), Math.cos(bd.rot)];
      const ellipse = (th) => ({ x: bd.cx + e1[0] * bd.a * Math.cos(th) + e2[0] * bd.b * Math.sin(th), z: bd.cz + e1[1] * bd.a * Math.cos(th) + e2[1] * bd.b * Math.sin(th) });
      const th0 = bd.phase;
      const p0 = ellipse(th0),
        p1 = ellipse(th0 + 0.05 * bd.dir);
      const boat = {
        bd,
        root,
        hullG,
        mainG,
        jibG,
        wake,
        ellipse,
        state: 'sail',
        x: p0.x,
        z: p0.z,
        h: Math.atan2(p1.x - p0.x, p1.z - p0.z),
        speed: bd.spd,
        wp: [],
        wi: 0,
        calm: 0,
        sailUp: 1,
        boom: 0,
        jibA: 0,
        berth,
        entry,
        G,
        idx: i,
        ph: rand() * TAU,
        depth: 1,
      };
      rec.boats.push(boat);
    });
    harbors.push(rec);
  }

  function stepBoat(bt, dt, f) {
    const { storm, windX, windZ, k, waterTime } = f;
    const bd = bt.bd;
    const turn = 1.15;
    let target;
    let speed;
    let reverse = false;
    // ---- 상태 전이 ----
    if (bt.state === 'sail' && storm > 0.28) {
      bt.state = 'return';
      bt.wp = [{ ...bt.G }, { ...bt.entry }, { ...bt.berth, last: true }];
      bt.wi = 0;
    } else if (bt.state === 'moored') {
      bt.calm = storm < 0.12 ? bt.calm + dt : 0;
      if (bt.calm > 3.5 + bt.idx * 2.2) {
        bt.state = 'depart';
        bt.wp = [{ ...bt.entry, rev: true }, { ...bt.G }];
        bt.wi = 0;
      }
    }
    // (귀항 도중 폭풍이 사라져도 계속 입항한다: 왔다 갔다 하지 않게)
    // ---- 이동 ----
    if (bt.state === 'sail') {
      // 타원 위의 가장 가까운 각도 + 앞쪽을 노려 따라간다
      const ux = ((bt.x - bd.cx) * Math.cos(bd.rot) + (bt.z - bd.cz) * Math.sin(bd.rot)) / bd.a,
        vz = ((bt.x - bd.cx) * -Math.sin(bd.rot) + (bt.z - bd.cz) * Math.cos(bd.rot)) / bd.b;
      const th = Math.atan2(vz, ux);
      const tp = bt.ellipse(th + bd.dir * 0.42);
      target = tp;
      speed = bd.spd * (0.8 + 0.25 * k);
    } else if (bt.state === 'moored') {
      speed = 0;
    } else {
      const w = bt.wp[bt.wi];
      const d = Math.hypot(w.x - bt.x, w.z - bt.z);
      if (w.last) {
        speed = clamp(1.2 + d * 0.55, 1.0, 8.5);
        if (d < 0.9) {
          bt.state = 'moored';
          bt.calm = 0;
          bt.speed = 0;
        }
      } else {
        speed = bt.state === 'depart' ? (w.rev ? 3.0 : 6.5) : 8.5;
        if (d < (w.rev ? 3 : 6.5)) {
          bt.wi++;
          if (bt.wi >= bt.wp.length) {
            bt.state = 'sail';
            speed = bd.spd;
          }
        }
      }
      target = bt.state === 'return' || bt.state === 'depart' ? w : null;
      reverse = !!(w && w.rev);
    }
    if (target) {
      // 후진 중에는 선미가 목표를 향하도록 (선수 = 목표 반대 방향) 천천히 돌린다
      const hd = Math.atan2(target.x - bt.x, target.z - bt.z) + (reverse ? Math.PI : 0);
      const dh = wrap(hd - bt.h);
      const tr = reverse ? turn * 0.5 : turn;
      bt.h += clamp(dh, -tr * dt, tr * dt);
    }
    bt.cur = speed;
    const dir = reverse ? -1 : 1;
    bt.x += Math.sin(bt.h) * speed * dt * dir;
    bt.z += Math.cos(bt.h) * speed * dt * dir;

    // ---- 파도와 바람 ----
    const sf = [Math.sin(bt.h), Math.cos(bt.h)],
      sr = [Math.cos(bt.h), -Math.sin(bt.h)];
    const depth = -heightAt(bt.x, bt.z);
    const edge = Math.max(Math.abs(bt.x), Math.abs(bt.z));
    const damp = (0.4 + 0.6 * sstep(0, 8, depth)) * (1 - sstep(HALF - 80, HALF, edge));
    const y = waveH(bt.x, bt.z, waterTime) * damp;
    const slopeF = (waveH(bt.x + sf[0] * 2.2, bt.z + sf[1] * 2.2, waterTime) - waveH(bt.x - sf[0] * 2.2, bt.z - sf[1] * 2.2, waterTime)) / 4.4;
    const slopeR = (waveH(bt.x + sr[0] * 1.4, bt.z + sr[1] * 1.4, waterTime) - waveH(bt.x - sr[0] * 1.4, bt.z - sr[1] * 1.4, waterTime)) / 2.8;
    const lx = windX * sr[0] + windZ * sr[1],
      lz = windX * sf[0] + windZ * sf[1];
    // 돛: 항해 중에는 올리고 붐은 바람 방향에 맞춰 돌린다. 폭풍(귀항/계류)에는 접는다
    const sailTarget = bt.state === 'sail' ? 1 : 0.08;
    bt.sailUp += (sailTarget - bt.sailUp) * (1 - Math.exp(-dt * (sailTarget > bt.sailUp ? 0.7 : 1.1)));
    const tail = (lz + 1) / 2;
    const boomTarget = (lx >= 0 ? 1 : -1) * (0.14 + 1.0 * tail) * 0.9;
    bt.boom += (boomTarget - bt.boom) * (1 - Math.exp(-dt * 0.9));
    const heel = (0.05 + 0.2 * k) * bt.sailUp + 0.015;
    const t = waterTime + bt.ph;
    bt.root.position.set(bt.x, y + 0.05, bt.z);
    bt.root.rotation.y = bt.h;
    bt.hullG.rotation.x = -Math.atan(slopeF * 1.5 * damp) + Math.sin(t * 0.9) * (0.008 + 0.03 * k);
    bt.hullG.rotation.z = Math.atan(slopeR * 1.5 * damp) - lx * heel + Math.sin(t * 1.1 + 1) * (0.01 + 0.035 * k);
    bt.mainG.rotation.y = -bt.boom;
    bt.mainG.scale.set(1, Math.max(0.09, bt.sailUp), Math.max(0.35, bt.sailUp));
    bt.jibG.rotation.y = -bt.boom * 0.55 * Math.sign(1);
    bt.jibG.scale.set(1, Math.max(0.09, bt.sailUp), Math.max(0.35, bt.sailUp));
    const wakeK = clamp((bt.cur ?? 0) / 6, 0, 1) * (reverse ? 0.4 : 1);
    bt.wake.material.opacity = 0.3 * wakeK;
    bt.wake.visible = wakeK > 0.02;
    bt.wake.scale.set(1, 1, 0.5 + 0.8 * wakeK);
  }

  return {
    landmarks,
    update(frame) {
      const dt = Math.min(frame.delta, 0.05);
      for (const hb of harbors) {
        const v = hb.lamp.step(revealAtXZ(hb.mid.x, hb.mid.z) > 0.45, frame.delta, 0.7);
        hb.lit.set(0, v);
        hb.lit.commit();
        smoke.setTarget(hb.smoke, v > 0.4 ? 1 : 0);
        for (const bt of hb.boats) stepBoat(bt, dt, frame);
      }
    },
    debug: () => harbors.map((hb) => hb.boats.map((b) => ({ s: b.state, x: Math.round(b.x), z: Math.round(b.z), up: +b.sailUp.toFixed(2) }))),
    reset() {
      for (const hb of harbors) {
        hb.lamp.reset();
        for (const bt of hb.boats) {
          bt.state = 'sail';
          bt.sailUp = 1;
          bt.calm = 0;
          const p = bt.ellipse(bt.bd.phase),
            p1 = bt.ellipse(bt.bd.phase + 0.05 * bt.bd.dir);
          bt.x = p.x;
          bt.z = p.z;
          bt.h = Math.atan2(p1.x - p.x, p1.z - p.z);
        }
      }
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
      harbors.forEach((h) => h.boats.forEach((b) => b.root.removeFromParent()));
    },
  };
}
