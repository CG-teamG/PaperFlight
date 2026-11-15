// ============================================================
// 꽃밭: 라벤더·안개꽃·양귀비·수레국화 + 데이지·미나리아재비(노랑)·튤립(빨/노/분홍)·루핀·클로버·물망초
//  - 줄무늬 밭 한 곳(라벤더) 외에는 노이즈로 무리지어 흩뿌린다 (노랑 무리 / 하양 무리 / 보라·파랑 무리)
//  - 꽃은 종류마다 InstancedMesh 1개. 흔들림과 개화는 전부 정점 셰이더(GPU)에서 처리한다.
//  - 미탐험: 회색조 + 고개 숙인 작은 녹색 꽃봉오리
//    탐험(공개 텍스처 값이 올라가면): 꽃마다 조금씩 다른 타이밍에 고개를 들고 활짝 피어나며 색이 돌아온다
//  - 바람: 꽃대가 바람 방향으로 눕고 떨린다 (폭풍에서는 크게)
// ============================================================
import { mulberry32 } from '../LandmarkKit.js';

const TAU = Math.PI * 2;

// 연보랏빛 둥근 꽃 (예전 뾰족한 라벤더 대신). 같은 위치/개수로 대체
function lavenderGeo(kit) {
  const b = kit.builder();
  const stem = 0x6c8f4e,
    leaf = 0x7da05b;
  const cols = [0xcdbcf0, 0xdccdf5, 0xbfaae8, 0xd4c3f2];
  const oct = new kit.THREE.OctahedronGeometry(1);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.3,
      lean = 0.14 + (i % 2) * 0.12;
    const bx = Math.cos(a) * lean * 1.2,
      bz = Math.sin(a) * lean * 1.2;
    const h = 1.0 + (i % 3) * 0.2;
    b.log(stem, Math.cos(a) * 0.06, 0, Math.sin(a) * 0.06, bx, h, bz, 0.04, 3);
    b.add(oct, cols[i], b.matrix(bx, h + 0.15, bz, 0, a, 0, 0.3, 0.26, 0.3), { head: 1 });
  }
  for (let i = 0; i < 3; i++) b.cone(leaf, 0.35, 0.7, Math.cos(i * 2.1) * 0.15, 0.3, Math.sin(i * 2.1) * 0.15, 4, i);
  oct.dispose();
  return b.build();
}

function gypsophilaGeo(kit, THREE) {
  const b = kit.builder();
  const stem = 0x78995a;
  const tet = new THREE.TetrahedronGeometry(1);
  const blobs = [0xfbf9ff, 0xf1eefa, 0xffffff];
  const branches = [
    [0, 1.5, 0],
    [0.45, 1.2, 0.2],
    [-0.4, 1.3, -0.25],
    [0.1, 1.0, -0.5],
    [-0.2, 1.1, 0.45],
  ];
  branches.forEach(([x, h, z], bi) => {
    b.log(stem, 0, 0, 0, x, h, z, 0.03, 3);
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + bi;
      b.add(tet, blobs[(k + bi) % 3], b.matrix(x + Math.cos(a) * 0.17, h + (k % 2) * 0.12, z + Math.sin(a) * 0.17, 0.4 * k, a, 0.3, 0.2), { head: 1 });
    }
  });
  tet.dispose();
  return b.build();
}

function poppyGeo(kit, THREE) {
  const b = kit.builder();
  b.log(0x6c8f4e, 0, 0, 0, 0.08, 1.4, 0, 0.04, 3);
  const cup = new THREE.SphereGeometry(0.42, 6, 3, 0, TAU, Math.PI / 2, Math.PI / 2);
  b.add(cup, 0xd7372c, b.matrix(0.08, 1.45, 0), { head: 1 });
  b.cone(0x2b2230, 0.14, 0.2, 0.08, 1.52, 0, 4, 0, { head: 1 });
  b.cone(0x7da05b, 0.3, 0.7, 0.1, 0.3, 0.1, 4, 0.5);
  cup.dispose();
  return b.build();
}

function cornflowerGeo(kit, THREE) {
  const b = kit.builder();
  b.log(0x6c8f4e, 0, 0, 0, 0.05, 1.25, 0, 0.035, 3);
  const petal = new THREE.ConeGeometry(0.14, 0.5, 3);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    b.add(petal, 0x4a78d8, b.matrix(0.05 + Math.cos(a) * 0.2, 1.3, Math.sin(a) * 0.2, 1.15, a, 0), { head: 1 });
  }
  b.cone(0x2b3a7a, 0.12, 0.18, 0.05, 1.3, 0, 4, 0, { head: 1 });
  b.cone(0x7da05b, 0.3, 0.7, 0.1, 0.3, 0.1, 4, 0.5);
  petal.dispose();
  return b.build();
}


function daisyGeo(kit, THREE) {
  const b = kit.builder();
  b.log(0x6c8f4e, 0, 0, 0, 0.06, 1.35, 0, 0.035, 3);
  const petal = new THREE.TetrahedronGeometry(0.3);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    b.add(petal, 0xfffdf6, b.matrix(0.06 + Math.cos(a) * 0.3, 1.38, Math.sin(a) * 0.3, 0.9, a, 0, 1, 0.4, 1.6), { head: 1 });
  }
  b.ico(0xf2c230, 0.2, 0.06, 1.42, 0, 1, 0.7, 1, 0, 0, { head: 1 });
  b.cone(0x7da05b, 0.28, 0.6, 0.1, 0.25, 0.1, 4, 0.5);
  petal.dispose();
  return b.build();
}

function buttercupGeo(kit, THREE) {
  const b = kit.builder();
  b.log(0x6c8f4e, 0, 0, 0, 0.04, 1.0, 0, 0.03, 3);
  b.log(0x6c8f4e, 0, 0.3, 0, 0.4, 0.95, 0.15, 0.025, 3);
  const cup = new THREE.SphereGeometry(0.28, 5, 3, 0, TAU, 0, Math.PI / 2);
  b.add(cup, 0xf6cf2a, b.matrix(0.04, 1.02, 0, 0.2, 0, 0), { head: 1 });
  b.add(cup, 0xf9dc4c, b.matrix(0.4, 0.98, 0.15, -0.3, 0, 0), { head: 1 });
  b.cone(0x7da05b, 0.26, 0.5, 0.05, 0.2, 0.05, 4, 0.5);
  cup.dispose();
  return b.build();
}

function tulipGeo(kit, THREE, main, tip) {
  const b = kit.builder();
  b.log(0x5f8f4a, 0, 0, 0, 0.03, 1.2, 0, 0.05, 3);
  b.cone(0x6fa05a, 0.4, 1.1, 0.12, 0.55, 0.05, 4, 0.4);
  b.cone(0x6fa05a, 0.35, 0.9, -0.12, 0.45, -0.05, 4, 2.4);
  const cup = new THREE.SphereGeometry(0.34, 6, 4, 0, TAU, 0, Math.PI * 0.8);
  b.add(cup, main, b.matrix(0.03, 1.42, 0, Math.PI, 0, 0, 1, 1.35, 1), { head: 1 });
  const pt = new THREE.ConeGeometry(0.1, 0.22, 3);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    b.add(pt, tip, b.matrix(0.03 + Math.cos(a) * 0.2, 1.82, Math.sin(a) * 0.2, 0, a, 0), { head: 1 });
  }
  cup.dispose();
  pt.dispose();
  return b.build();
}

function cloverGeo(kit) {
  const b = kit.builder();
  b.log(0x6c8f4e, 0, 0, 0, 0.03, 0.7, 0, 0.03, 3);
  b.ico(0xf09ac0, 0.3, 0.03, 0.78, 0, 1, 0.9, 1, 0, 0, { head: 1 });
  b.ico(0xf6b6d4, 0.2, 0.03, 0.98, 0.04, 1, 1, 1, 0, 0, { head: 1 });
  b.cone(0x6fa05a, 0.3, 0.4, 0.1, 0.18, 0.05, 4, 0.4);
  return b.build();
}

function forgetMeNotGeo(kit) {
  const b = kit.builder();
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1;
    const x = Math.cos(a) * 0.22,
      z = Math.sin(a) * 0.22;
    b.log(0x6c8f4e, 0, 0, 0, x, 0.5 + (i % 2) * 0.2, z, 0.025, 3);
    b.ico(0x7aa8ee, 0.17, x, 0.58 + (i % 2) * 0.2, z, 1, 0.7, 1, 0, 0, { head: 1 });
  }
  return b.build();
}

// 위치만의 값 노이즈 (무리짓기용)
const hash = (x, y) => {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};
function vnoise(x, y) {
  const x0 = Math.floor(x),
    y0 = Math.floor(y);
  const fx = x - x0,
    fy = y - y0;
  const u = fx * fx * (3 - 2 * fx),
    v = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0),
    b = hash(x0 + 1, y0),
    c = hash(x0, y0 + 1),
    d = hash(x0 + 1, y0 + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// 꽃 종류별 가중치 (무리별로 색이 달라지도록 노이즈 n 에 따라 고른다)
function pickSpecies(kind, n, r) {
  const t = r;
  if (kind === 'garden') {
    if (t < 0.12) return 'tuR';
    if (t < 0.22) return 'tuY';
    if (t < 0.32) return 'tuP';
    if (t < 0.45) return 'dai';
    if (t < 0.55) return 'pop';
    if (t < 0.65) return 'lav';
    if (t < 0.75) return 'cor';
    if (t < 0.85) return 'fmn';
    if (t < 0.93) return 'clo';
    return 'gyp';
  }
  if (n < 0.34) {
    // 노랑 무리
    return t < 0.6 ? 'but' : t < 0.78 ? 'dai' : t < 0.88 ? 'fmn' : t < 0.95 ? 'pop' : 'clo';
  }
  if (n < 0.68) {
    // 하양 무리
    return t < 0.36 ? 'dai' : t < 0.6 ? 'gyp' : t < 0.75 ? 'but' : t < 0.88 ? 'clo' : 'fmn';
  }
  // 보라·파랑·분홍 무리
  return t < 0.24 ? 'lav' : t < 0.44 ? 'cor' : t < 0.6 ? 'clo' : t < 0.74 ? 'fmn' : t < 0.86 ? 'pop' : t < 0.94 ? 'dai' : 'lav';
}

// 꽃 개수 배율: 너무 무거우면 낮춘다 (1 = 기본)
export const FLOWER_DENSITY = 0.6;
const CELL = 200; // 컬링 칸 크기(m)

export function buildFlowers(kit, plan, group) {
  if (!plan.flowers.length) return null;
  const THREE = kit.THREE;
  const { heightAt, slopeAt } = kit.ctx;
  const rand = mulberry32(plan.seed ^ 0xf10e);

  const mk = (geo, head) => ({ geo, head, list: [] });
  const types = {
    lav: mk(lavenderGeo(kit), [0, 1.2, 0]),
    gyp: mk(gypsophilaGeo(kit, THREE), [0, 1.3, 0]),
    pop: mk(poppyGeo(kit, THREE), [0, 1.45, 0]),
    cor: mk(cornflowerGeo(kit, THREE), [0, 1.3, 0]),
    dai: mk(daisyGeo(kit, THREE), [0, 1.4, 0]),
    but: mk(buttercupGeo(kit, THREE), [0, 1.0, 0]),
    tuR: mk(tulipGeo(kit, THREE, 0xd92d3a, 0xf06a76), [0, 1.5, 0]),
    tuY: mk(tulipGeo(kit, THREE, 0xf5c52b, 0xfbe27a), [0, 1.5, 0]),
    tuP: mk(tulipGeo(kit, THREE, 0xe86aa6, 0xf6a9cc), [0, 1.5, 0]),
    clo: mk(cloverGeo(kit), [0, 0.85, 0]),
    fmn: mk(forgetMeNotGeo(kit), [0, 0.6, 0]),
  };

  const plant = (type, x, z, s) => {
    const h = heightAt(x, z);
    if (h < 5.5 || slopeAt(x, z) > 0.9) return;
    types[type].list.push({ x, y: h - 0.08, z, ry: rand() * TAU, s, tone: 0.86 + rand() * 0.28 });
  };

  // 지터 격자: 균일하지 않고 자연스럽게 흩어진 점들 (cell 간격마다 한 송이)
  const scatter = (p, cell, density, kind) => {
    const c = Math.cos(p.ang),
      s = Math.sin(p.ang);
    const ph = rand() * 100;
    for (let v = -p.rz; v <= p.rz; v += cell)
      for (let u = -p.rx; u <= p.rx; u += cell) {
        const uu = u + (rand() - 0.5) * cell * 1.1,
          vv = v + (rand() - 0.5) * cell * 1.1;
        const e = (uu / p.rx) ** 2 + (vv / p.rz) ** 2;
        if (e > 1) continue;
        // 가장자리는 듬성듬성 + 안쪽에 노이즈로 빈 곳/촘촘한 곳
        const x = p.x + uu * c - vv * s,
          z = p.z + uu * s + vv * c;
        const clump = vnoise(x * 0.06 + ph, z * 0.06);
        const keep = density * (1 - e * 0.85) * (0.35 + 1.3 * clump);
        if (rand() > keep) continue;
        const n = vnoise(x * 0.045 + 31, z * 0.045 + ph);
        plant(pickSpecies(kind, n, rand()), x, z, 1.2 + rand() * 0.8);
      }
  };

  const D = FLOWER_DENSITY;
  for (const p of plan.flowers) {
    const c = Math.cos(p.ang),
      s = Math.sin(p.ang);
    const world = (u, v) => [p.x + u * c - v * s, p.z + u * s + v * c];
    if (p.kind === 'lavender') {
      // 라벤더 밭: 물결치는 줄무늬를 기본으로 하되, 노이즈로 군데군데 끊고 바깥으로 흩뿌려진 포기들을 더한다
      const ph = rand() * 50;
      for (let v = -p.rz + 1.5; v <= p.rz - 1.5; v += 3.4 + rand() * 1.6)
        for (let u = -p.rx; u <= p.rx; u += 1.7 / Math.sqrt(D)) {
          const bend = Math.sin(u * 0.09 + v * 0.7 + ph) * 3.4 + Math.sin(u * 0.23 + ph * 2) * 1.2;
          const uu = u + (rand() - 0.5) * 1.0;
          const vv = v + bend + (rand() - 0.5) * 0.9;
          const e = (uu / p.rx) ** 2 + (vv / p.rz) ** 2;
          if (e > 1.15) continue;
          const x = world(uu, vv)[0],
            z = world(uu, vv)[1];
          const gap = vnoise(x * 0.11 + ph, z * 0.11);
          if (gap < 0.36 || (e > 0.62 && rand() < (e - 0.62) / 0.45)) continue;
          plant('lav', x, z, 1.4 + rand() * 0.7);
        }
      for (let i = 0, n = Math.round(60 * D); i < n; i++) {
        const a = rand() * TAU,
          r = 0.9 + rand() * 0.55;
        const [x, z] = world(Math.cos(a) * p.rx * r, Math.sin(a) * p.rz * r);
        plant('lav', x, z, 1.2 + rand() * 0.6);
      }
    } else if (p.kind === 'garden') {
      scatter(p, 1.05 / Math.sqrt(D), 0.95, 'garden');
    } else {
      // 들꽃 초원: 노랑/하양/보라 무리가 노이즈로 번져 있음
      scatter(p, (p.sparse ? 2.6 : 1.45) / Math.sqrt(D), p.sparse ? 0.55 : 0.92, 'meadow');
    }
  }

  const meshes = [];
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (const [name, t] of Object.entries(types)) {
    if (!t.list.length) continue;
    const mat = kit.material({
      key: `flower-${name}`,
      swayMode: 'bend',
      sway: [0.55, 2.2, 2.2, 0],
      bloom: true,
      uniforms: { uHead: { value: new THREE.Vector3(...t.head) }, uHeadK: { value: 1 } },
    });
    // 지도를 격자 칸(CELL m)으로 나눠 칸마다 InstancedMesh 를 만든다 -> 화면 밖 칸은 그리지 않는다(프러스텀 컬링)
    const cells = new Map();
    for (const f of t.list) {
      const key = Math.floor((f.x + 1000) / CELL) * 64 + Math.floor((f.z + 1000) / CELL);
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(f);
    }
    for (const [key, list] of cells) {
      const mesh = new THREE.InstancedMesh(t.geo, mat, list.length);
      list.forEach((f, i) => {
        dummy.position.set(f.x, f.y, f.z);
        dummy.rotation.set(0, f.ry, 0);
        dummy.scale.setScalar(f.s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, color.setScalar(f.tone));
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.boundingSphere.radius += 6; // 바람에 휘는 여유
      mesh.frustumCulled = true;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.name = `Flowers-${name}-${key}`;
      group.add(mesh);
      meshes.push(mesh);
    }
  }

  const landmarks = plan.flowers
    .filter((p) => p.kind === 'lavender')
    .map((p) => ({ kind: 'flowers', name: '라벤더 밭', x: p.x, z: p.z, discovered: false }));
  const counts = Object.fromEntries(Object.entries(types).map(([k, t]) => [k, t.list.length]));

  return {
    landmarks,
    counts,
    update() {}, // 흔들림/개화는 셰이더가 처리
    reset() {},
    dispose() {
      Object.values(types).forEach((t) => t.geo.dispose());
    },
  };
}
