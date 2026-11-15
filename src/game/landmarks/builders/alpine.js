// ============================================================
// 설산: 눈 덮인 침엽수(바람에 눈 쌓인 가지가 흔들림) / 눈 쌓인 통나무 오두막(탐험하면 창에 불 + 굴뚝 연기)
//       / 정상 부근의 산정호수(고도가 높으면 얼어붙은 호수: 갈라진 얼음 + 눈 + 가장자리 바위)
// ============================================================
import { COLORS, Lamp, addWindow, lerp, mulberry32 } from '../LandmarkKit.js';

const TAU = Math.PI * 2;
const SNOW = 0xf4f7fb;

// ---- 침엽수 (로컬: 원점 = 땅). snowAmt: 가지 위에 쌓인 눈의 비율 (같은 꼭짓점을 공유하는 흰 원뿔을 덮는다) ----
function coniferGeometry(kit, variant, snowAmt) {
  const b = kit.builder();
  const greens = variant ? [0x2f5f45, 0x275440, 0x356b4a] : [0x2c5a38, 0x234c31, 0x336542];
  const tiers = variant ? 4 : 5;
  const H = variant ? 2.9 : 2.7;
  b.cyl(0x5a4030, 0.35, 0.55, 2.4, 0, 1.2, 0, 6);
  let y = 1.6;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const r = lerp(variant ? 3.9 : 3.4, 1.0, t);
    const h = H * (variant ? 1.15 : 1.0);
    const cy = y + h / 2;
    b.cone(greens[i % 3], r, h, 0, cy, 0, 7, i * 0.7);
    const f = snowAmt * (0.92 - t * 0.12);
    // 눈: 꼭짓점이 같은 더 작은 원뿔 (아래쪽 녹색 치마가 보인다)
    if (snowAmt > 0) b.cone(SNOW, r * f, h * f, 0, cy + h / 2 - (h * f) / 2 + 0.12, 0, 7, i * 0.7);
    y += h * 0.62;
  }
  if (snowAmt > 0) b.cone(SNOW, 0.45, 1.6, 0, y + 1.2, 0, 5);
  return b.build();
}

// ---- 오두막 (로컬: 원점 = 땅 중앙, 문 = +z) ----
function hutGeometry(kit) {
  const b = kit.builder(),
    g = kit.builder();
  const W = 8.2,
    D = 6.4,
    H = 3.3;
  const log = 0x8a5a34,
    logD = 0x6f4528;
  b.box(COLORS.stoneDark, W + 0.6, 1.4, D + 0.6, 0, 0.1, 0);
  b.box(log, W, H, D, 0, 0.8 + H / 2, 0);
  // 통나무 결: 가로로 한 줄씩 어두운 선 + 모서리 통나무 끝
  for (let i = 0; i < 5; i++) {
    const y = 1.2 + i * 0.62;
    b.box(logD, W + 0.15, 0.08, D + 0.15, 0, y, 0);
  }
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) for (let i = 0; i < 5; i++) b.cyl(i % 2 ? log : logD, 0.3, 0.3, 0.7, sx * (W / 2 + 0.05), 1.15 + i * 0.62, sz * (D / 2 + 0.05), 6, 0, Math.PI / 2, i % 2 ? 0 : Math.PI / 2);
  const ry = H + 0.8;
  b.gable(0x5b4636, W + 2.0, D + 2.2, 2.7, 0, ry, 0);
  // 지붕의 눈 (처마 끝은 조금 드러나게)
  b.gable(SNOW, W + 1.7, D + 1.6, 2.7 * ((D + 1.6) / (D + 2.2)) + 0.18, 0, ry + 0.2, 0);
  for (let i = 0; i < 5; i++) b.ico(SNOW, 0.8, -W / 2 - 0.6 + (i / 4) * (W + 1.2), ry + 0.12, D / 2 + 0.95, 1.4, 0.45, 0.8, 0, i);
  // 굴뚝
  const cx = W * 0.26,
    top = ry + 3.6;
  b.box(COLORS.stoneDark, 1.3, top - 2, 1.3, cx, (top + 2) / 2, -D * 0.12);
  b.box(COLORS.stone, 1.8, 0.3, 1.8, cx, top, -D * 0.12);
  b.ico(SNOW, 1.0, cx, top + 0.3, -D * 0.12, 1, 0.4, 1, 0, 1);
  // 문, 창, 장작
  b.box(COLORS.darkWood, 1.7, 2.4, 0.25, -W * 0.18, 1.9, D / 2 + 0.1);
  addWindow(b, g, W * 0.22, 2.4, D / 2, 0, COLORS.shutterRed, [1.5, 1.4]);
  addWindow(b, g, W / 2, 2.4, 0, Math.PI / 2, COLORS.shutterRed, [1.4, 1.3]);
  addWindow(b, g, -W / 2, 2.4, 0.4, -Math.PI / 2, COLORS.shutterRed, [1.4, 1.3]);
  for (let row = 0; row < 3; row++)
    for (let i = 0; i < 4 - row; i++) b.cyl(COLORS.bark, 0.32, 0.32, 2.4, -W / 2 - 1.1, 0.5 + row * 0.62, -1.4 + i * 0.7 + row * 0.35, 6, 0, Math.PI / 2, 0);
  b.box(SNOW, 2.6, 0.25, 3.0, -W / 2 - 1.1, 2.0, 0);
  // 문 앞 계단과 눈
  b.box(COLORS.stone, 2.4, 0.4, 1.0, -W * 0.18, 0.25, D / 2 + 0.9);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    b.ico(SNOW, 1.7 + (i % 3) * 0.5, Math.cos(a) * W * 0.62, 0.05, Math.sin(a) * D * 0.92, 1.5, 0.2, 1.2, 0, i);
  }
  return { body: b.build(), glass: g.build(), chimney: [cx, top + 0.7, -D * 0.12] };
}

// ---- 산정호수 (로컬: 원점 = 호수 중심, 수면 높이 = 0) ----
function tarnGeometry(kit, tarn) {
  const THREE = kit.THREE;
  const rand = mulberry32(tarn.seed);
  const N = 44;
  const ph = [rand() * TAU, rand() * TAU, rand() * TAU];
  const rad = (a) => tarn.r * (1 + 0.1 * Math.sin(a * 2 + ph[0]) + 0.07 * Math.sin(a * 3 + ph[1]) + 0.04 * Math.sin(a * 5 + ph[2]));
  const lake = new THREE.Color(tarn.frozen ? 0xb9e0ee : 0x3f93b8);
  const edge = new THREE.Color(tarn.frozen ? 0xeaf4f8 : 0x74bcd2);
  const pos = [],
    col = [];
  const tmp = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * TAU,
      a1 = ((i + 1) / N) * TAU;
    const r0 = rad(a0),
      r1 = rad(a1);
    const p = [
      [0, 0, 0, lake],
      [Math.cos(a0) * r0 * 0.6, 0, Math.sin(a0) * r0 * 0.6, lake],
      [Math.cos(a1) * r1 * 0.6, 0, Math.sin(a1) * r1 * 0.6, lake],
    ];
    const q = [
      [Math.cos(a0) * r0 * 0.6, 0, Math.sin(a0) * r0 * 0.6, lake],
      [Math.cos(a0) * r0, 0, Math.sin(a0) * r0, edge],
      [Math.cos(a1) * r1 * 0.6, 0, Math.sin(a1) * r1 * 0.6, lake],
      [Math.cos(a1) * r1 * 0.6, 0, Math.sin(a1) * r1 * 0.6, lake],
      [Math.cos(a0) * r0, 0, Math.sin(a0) * r0, edge],
      [Math.cos(a1) * r1, 0, Math.sin(a1) * r1, edge],
    ];
    for (const v of [...p, ...q]) {
      pos.push(v[0], 0, v[2]);
      tmp.copy(v[3]);
      col.push(tmp.r, tmp.g, tmp.b);
    }
  }
  const disc = new THREE.BufferGeometry();
  disc.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  disc.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  disc.computeVertexNormals();
  // 위쪽 면이 보이도록 법선 방향 보정 (아래를 향하면 뒤집는다)
  const n = disc.getAttribute('normal');
  if (n.getY(0) < 0) {
    for (let i = 0; i < n.count; i++) n.setY(i, -n.getY(i));
  }

  // 얼음의 균열/눈, 가장자리 바위와 눈
  const d = kit.builder();
  if (tarn.frozen) {
    for (let i = 0; i < 7; i++) {
      const a = rand() * TAU,
        len = tarn.r * R(rand, 0.5, 1.2),
        off = R(rand, -0.35, 0.35) * tarn.r;
      const cx = Math.cos(a + 1.57) * off,
        cz = Math.sin(a + 1.57) * off;
      d.box(0x7fa9bd, len, 0.04, 0.22, cx, 0.08, cz, -a);
      d.box(0xe9f3f7, len * 0.55, 0.05, 0.16, cx + Math.cos(a) * 1.5, 0.1, cz - Math.sin(a) * 1.5, -a + 0.4);
    }
    for (let i = 0; i < 6; i++) {
      const a = rand() * TAU,
        r = Math.sqrt(rand()) * tarn.r * 0.7;
      d.ico(0xf6fafc, R(rand, 1.2, 2.6), Math.cos(a) * r, 0.06, Math.sin(a) * r, 1.6, 0.12, 1.1, 0, rand() * 6); // 얼음 위의 눈
    }
  }
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU + rand() * 0.2;
    const r = rad(a) * R(rand, 1.0, 1.12);
    const s = R(rand, 0.9, 2.1);
    const x = Math.cos(a) * r,
      z = Math.sin(a) * r;
    d.ico(i % 3 ? 0x8d8a82 : 0x77746c, s, x, s * 0.3 - 0.1, z, 1.2, 0.7, 1.0, 0, rand() * 6);
    if (rand() < 0.7) d.ico(SNOW, s * 0.85, x, s * 0.55, z, 1.1, 0.35, 0.9, 0, rand() * 6);
  }
  // 호숫가의 마른 갈대/눈 덮인 풀
  for (let i = 0; i < 18; i++) {
    const a = rand() * TAU;
    const r = rad(a) * R(rand, 1.06, 1.3);
    const x = Math.cos(a) * r,
      z = Math.sin(a) * r;
    d.ico(SNOW, R(rand, 1.4, 2.6), x, 0.0, z, 1.5, 0.22, 1.3, 0, rand() * 6);
  }
  return { disc, detail: d.build() };
}
const R = (rand, a, b) => a + (b - a) * rand();

export function buildAlpine(kit, plan, group, smoke) {
  const THREE = kit.THREE;
  const { revealAtXZ } = kit.ctx;
  if (!plan.conifers.length && !plan.huts.length && !plan.tarns.length) return null;
  const rand = mulberry32(plan.seed ^ 0xa1b1);
  const landmarks = [];
  const disposables = [];
  const subs = [];
  const m4 = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    pos = new THREE.Vector3(),
    sc = new THREE.Vector3(),
    yAxis = new THREE.Vector3(0, 1, 0);

  // ---- 침엽수: (변종 2 × 눈 양 2) 인스턴스 메시 ----
  if (plan.conifers.length) {
    for (const variant of [0, 1])
      for (const snow of [0, 1, 2]) {
        const list = plan.conifers.filter((c) => c.v === variant && c.snow === snow);
        if (!list.length) continue;
        const geo = coniferGeometry(kit, variant, [0, 0.45, 0.82][snow]);
        disposables.push(geo);
        const mat = kit.material({ key: 'conifer', swayMode: 'bend', sway: [1.1, 14, 1.4, 0] });
        const mesh = new THREE.InstancedMesh(geo, mat, list.length);
        const col = new THREE.Color();
        list.forEach((c, i) => {
          m4.compose(pos.set(c.x, c.y - 0.5, c.z), q.setFromAxisAngle(yAxis, c.yaw), sc.setScalar(c.s));
          mesh.setMatrixAt(i, m4);
          mesh.setColorAt(i, col.setScalar(0.88 + rand() * 0.2));
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor.needsUpdate = true;
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        group.add(mesh);
      }
  }

  // ---- 오두막 ----
  if (plan.huts.length) {
    const model = hutGeometry(kit);
    disposables.push(model.body, model.glass);
    const body = new THREE.InstancedMesh(model.body, kit.staticMat, plan.huts.length);
    const lit = new kit.LitSet(model.glass, plan.huts.length);
    const huts = [];
    plan.huts.forEach((h, i) => {
      m4.compose(pos.set(h.x, h.y - 0.1, h.z), q.setFromAxisAngle(yAxis, h.yaw), sc.setScalar(h.s));
      body.setMatrixAt(i, m4);
      lit.setMatrix(i, m4);
      const e = new THREE.Vector3(...model.chimney).applyMatrix4(m4);
      huts.push({ x: h.x, z: h.z, lamp: new Lamp(rand, [0.4, 2.0]), smoke: smoke.add(e.x, e.y, e.z, 0.85), index: i });
      landmarks.push({ kind: 'hut', name: '눈 덮인 오두막', x: h.x, z: h.z, discovered: false });
    });
    body.castShadow = body.receiveShadow = true;
    body.frustumCulled = false;
    group.add(body, lit.mesh);
    subs.push({
      update({ delta }) {
        for (const h of huts) {
          const v = h.lamp.step(revealAtXZ(h.x, h.z) > 0.55, delta, 0.9);
          lit.set(h.index, v);
          smoke.setTarget(h.smoke, h.lamp.value > 0.4 ? 1 : 0);
        }
        lit.commit();
      },
      reset: () => huts.forEach((h) => h.lamp.reset()),
    });
  }

  // ---- 산정호수 ----
  for (const t of plan.tarns) {
    const { disc, detail } = tarnGeometry(kit, t);
    disposables.push(disc, detail);
    const mat = kit.material({ key: t.frozen ? 'ice' : 'tarn', roughness: t.frozen ? 0.18 : 0.3, extra: { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 } });
    const dm = kit.mesh(disc, mat, { cast: false });
    dm.position.set(t.x, t.y + 0.28, t.z);
    const det = kit.mesh(detail, kit.staticMat, { cast: false });
    det.position.set(t.x, t.y + 0.28, t.z);
    group.add(dm, det);
    landmarks.push({ kind: 'tarn', name: t.frozen ? '얼어붙은 호수' : '산정호수', x: t.x, z: t.z, discovered: false });
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
