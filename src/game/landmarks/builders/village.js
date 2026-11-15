// ============================================================
// 마을: 목조 샬레 / 코티지 / 연립주택 / 헛간 / 교회 + 굽이치는 개울(돌 둑, 돌다리) + 흙길 + 흩어진 울타리·돌담
//       + 꽃 핀 나무 + 우물/건초더미
//  - 집은 종류마다 InstancedMesh 1개(벽/지붕) + 창문 InstancedMesh 1개(탐험하면 켜짐)
//  - 탐험(공개) 되면: 집 창문이 하나씩 켜지고(지연 0.2~2.4초), 굴뚝에서 연기가 난다
// ============================================================
import { COLORS, Lamp, mulberry32 } from '../LandmarkKit.js';
import { buildCottage, buildChalet, buildRowHouse, buildBarn, buildChurch } from './houses.js';

const TAU = Math.PI * 2;

const COTTAGES = {
  A: { w: 12, d: 9, h: 7.2, roofH: 5, wall: COLORS.cream, roof: COLORS.terracotta, shutter: COLORS.shutterSage, floors: 1, dormer: true },
  B: { w: 13, d: 9.5, h: 7.5, roofH: 5.2, wall: COLORS.ochre, roof: COLORS.terracotta2, shutter: COLORS.shutterRed, floors: 1, dormer: true },
  C: { w: 9.5, d: 8.5, h: 12, roofH: 4.8, wall: COLORS.white, roof: COLORS.slate, shutter: COLORS.shutterBlue, floors: 2 },
};
const CHALETS = [
  { timber: 0x6e4b33, plaster: 0xefe1c0, roof: 0x3f444c, shutter: COLORS.shutterRed },
  { timber: 0x8a6a46, plaster: 0xe9dcc0, roof: 0x4a3a34, shutter: COLORS.shutterSage, w: 12.6, d: 10 },
];

function makePrefab(kit, kind, variant) {
  if (kind === 'D') return buildBarn(kit);
  if (kind === 'E') return buildChurch(kit);
  if (kind === 'F') return buildChalet(kit, CHALETS[variant % CHALETS.length]);
  if (kind === 'G') return buildRowHouse(kit, variant);
  return buildCottage(kit, COTTAGES[kind]);
}

// ---- 꽃 핀 나무 (0 벚꽃 / 1 흰 꽃 / 2 노란 새순 / 3 둥근 녹음수 / 4 가는 침엽수) ----
function treeGeometry(kit, kind) {
  const b = kit.builder();
  const blobs = [
    [0xf3a3c4, 0xf7bfd5, 0xe98fb3],
    [0xf8f3ee, 0xeee6e0, 0xfffaf5],
    [0xd6df6a, 0xc3d357, 0xe3e88a],
    [0x6fa84a, 0x5b9640, 0x82b858],
  ];
  if (kind === 4) {
    b.cyl(BARK, 0.45, 0.7, 2.2, 0, 1.1, 0, 5);
    for (let i = 0; i < 4; i++) b.cone(i % 2 ? 0x2f6d3a : 0x377a42, 3.1 - i * 0.6, 4.2, 0, 3.5 + i * 2.4, 0, 6, i);
    return b.build();
  }
  const c = blobs[kind];
  b.cyl(BARK, 0.4, 0.75, 4.2, 0, 2.1, 0, 6);
  b.log(BARK, 0, 3.4, 0, 1.4, 5.8, 0.4, 0.28, 4);
  b.log(BARK, 0, 3.6, 0, -1.3, 5.9, -0.6, 0.26, 4);
  const spots = [
    [0, 6.6, 0, 3.0],
    [2.0, 6.0, 0.8, 2.3],
    [-1.9, 6.2, -0.9, 2.4],
    [0.4, 8.2, -0.4, 2.2],
    [-0.5, 5.4, 2.0, 2.0],
    [0.8, 5.5, -1.9, 2.0],
  ];
  spots.forEach(([x, y, z, r], i) => b.ico(c[i % 3], r, x, y, z, 1, 0.85, 1, 1, i));
  return b.build();
}
const BARK = 0x6b4a2b;

export function buildVillages(kit, plan, group, smoke) {
  const THREE = kit.THREE;
  const { heightAt, revealAtXZ } = kit.ctx;
  if (!plan.villages.length) return null;
  const rand = mulberry32(plan.seed ^ 0x7a11);
  const disposables = [];

  // ---- 프리팹 만들기 (쓰는 종류만) ----
  const prefabs = {};
  const houses = [];
  const dummy = new THREE.Object3D();
  const tmp = new THREE.Vector3();
  for (const v of plan.villages)
    for (const h of v.houses) {
      const variant = h.kind === 'F' || h.kind === 'G' ? Math.floor(rand() * 2) : 0;
      const key = h.kind + variant;
      if (!prefabs[key]) prefabs[key] = { ...makePrefab(kit, h.kind, variant), houses: [] };
      const p = prefabs[key];
      // 집터: 네 모서리 중 가장 높은 땅에 맞춘다 (기초가 아래를 덮는다)
      let gy = heightAt(h.x, h.z);
      const rr = Math.min(h.r * 0.5, 7);
      for (const [dx, dz] of [
        [rr, rr * 0.8],
        [-rr, rr * 0.8],
        [rr, -rr * 0.8],
        [-rr, -rr * 0.8],
      ])
        gy = Math.max(gy, heightAt(h.x + dx * Math.cos(h.yaw) + dz * Math.sin(h.yaw), h.z - dx * Math.sin(h.yaw) + dz * Math.cos(h.yaw)));
      dummy.position.set(h.x, gy - 0.1, h.z);
      dummy.rotation.set(0, h.yaw, 0);
      dummy.scale.setScalar(h.scale);
      dummy.updateMatrix();
      const rec = {
        kind: h.kind,
        key,
        x: h.x,
        z: h.z,
        index: p.houses.length,
        matrix: dummy.matrix.clone(),
        tone: 0.93 + rand() * 0.12,
        lamp: new Lamp(rand),
        smokes: [],
      };
      for (const c of p.chimneys ?? []) {
        tmp.set(...c).applyMatrix4(rec.matrix);
        rec.smokes.push(smoke.add(tmp.x, tmp.y, tmp.z, 1));
      }
      p.houses.push(rec);
      houses.push(rec);
    }

  const litSets = [];
  const color = new THREE.Color();
  for (const key of Object.keys(prefabs)) {
    const p = prefabs[key];
    const n = p.houses.length;
    const mesh = new THREE.InstancedMesh(p.body, kit.staticMat, n);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    const lit = new kit.LitSet(p.glass, n);
    p.houses.forEach((r, i) => {
      mesh.setMatrixAt(i, r.matrix);
      mesh.setColorAt(i, color.setScalar(r.tone));
      lit.setMatrix(i, r.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    group.add(mesh, lit.mesh);
    p.lit = lit;
    litSets.push(lit);
    disposables.push(p.body);
  }

  // ---- 울타리 / 돌담 ----
  const postGeo = kit
    .builder()
    .box(COLORS.fence, 0.55, 2.6, 0.55, 0, 1.3, 0)
    .box(COLORS.fence, 0.8, 0.22, 0.8, 0, 2.65, 0)
    .build();
  const railGeo = kit.builder().box(COLORS.fence, 1, 0.28, 0.2, 0, 0, 0).build();
  const wallGeo = kit.builder().box(0xffffff, 1, 1, 1, 0, 0.5, 0).build();
  disposables.push(postGeo, railGeo, wallGeo);
  const posts = [],
    rails = [],
    walls = [];
  const X = new THREE.Vector3(1, 0, 0);
  const props = kit.builder();
  const brookMat = kit.ribbonMaterial({ key: 'brook', color: 0x7cc4ee, map: null, opacity: 0.94 });
  let brookTex = null;
  const roadMat = kit.ribbonMaterial({ key: 'road' });

  const segMatrix = (A, B, thick, hgt, sy) => {
    const dir = B.clone().sub(A);
    const len = dir.length();
    return new THREE.Matrix4().compose(
      A.clone().add(B).multiplyScalar(0.5).add(new THREE.Vector3(0, sy, 0)),
      new THREE.Quaternion().setFromUnitVectors(X, dir.normalize()),
      new THREE.Vector3(len + 0.3, hgt, thick),
    );
  };

  for (const v of plan.villages) {
    // 울타리/돌담 토막
    for (const run of v.fences) {
      const nodes = run.pts.map((p) => ({ x: p.x, z: p.z, y: heightAt(p.x, p.z) }));
      for (let i = 0; i < nodes.length; i++) {
        const n0 = nodes[i];
        if (run.type === 'fence') posts.push(n0);
        if (i === nodes.length - 1) continue;
        const n1 = nodes[i + 1];
        if (run.type === 'wall') {
          const A = new THREE.Vector3(n0.x, n0.y, n0.z),
            B = new THREE.Vector3(n1.x, n1.y, n1.z);
          walls.push(segMatrix(A, B, 1.1, 1.3 + rand() * 0.35, -0.1));
        } else
          for (const off of [1.0, 1.8]) {
            const A = new THREE.Vector3(n0.x, n0.y + off, n0.z),
              B = new THREE.Vector3(n1.x, n1.y + off, n1.z);
            rails.push(segMatrix(A, B, 1, 1, 0));
          }
      }
    }

    // 개울: 물 띠 + 돌 둑 + 바위
    brookTex ??= kit.streakTexture();
    brookMat.map = brookTex;
    brookMat.needsUpdate = true;
    const sp = v.stream.pts;
    const ribbon = sp.map((p, i) => ({ x: p.x, z: p.z, w: v.stream.width * (0.45 + 0.55 * Math.min(1, Math.min(i, sp.length - 1 - i) / 4)) }));
    const brookGeo = kit.makeRibbon(ribbon, v.stream.width, 0xffffff, 0.42, 0.1);
    group.add(kit.mesh(brookGeo, brookMat, { cast: false }));
    disposables.push(brookGeo);
    const stones = [0x9a968c, 0x8a867c, 0xb0aa9c, 0x7f7a70];
    for (let i = 1; i < sp.length - 1; i++) {
      const p = sp[i],
        q = sp[i + 1],
        o = sp[i - 1];
      if (Math.abs(p.u) > v.a + 18) continue;
      let dx = q.x - o.x,
        dz = q.z - o.z;
      const l = Math.hypot(dx, dz) || 1;
      dx /= l;
      dz /= l;
      const half = ribbon[i].w / 2 + 0.9;
      const nearBridge = v.bridges.some((br) => Math.hypot(br.x - p.x, br.z - p.z) < 9.5);
      for (const side of [-1, 1]) {
        if (nearBridge) continue;
        for (let k = 0; k < 3; k++) {
          const t = (k - 1) * 2.3;
          const x = p.x - dz * half * side + dx * t + (rand() - 0.5) * 0.5,
            z = p.z + dx * half * side + dz * t + (rand() - 0.5) * 0.5;
          const y = heightAt(x, z);
          const s = 1.0 + rand() * 0.9;
          props.ico(stones[Math.floor(rand() * 4)], s, x, y + 0.35, z, 1.6, 0.75 + rand() * 0.35, 1.1, 0, rand() * 6);
        }
      }
      if (i % 3 === 0) {
        const x = p.x + (rand() - 0.5) * 2.6,
          z = p.z + (rand() - 0.5) * 2.6;
        props.ico(stones[Math.floor(rand() * 4)], 0.9 + rand() * 0.8, x, heightAt(x, z) + 0.45, z, 1.2, 0.8, 1, 0, rand() * 6);
      }
    }

    // 돌다리 (아치)
    for (const br of v.bridges) {
      const bb = kit.builder();
      const L = br.len,
        N = 12;
      const yAt = (t) => 1.1 + 3.3 * Math.pow(Math.sin(Math.PI * t), 0.7);
      for (let i = 0; i < N; i++) {
        const t0 = i / N,
          t1 = (i + 1) / N,
          tm = (t0 + t1) / 2;
        const z0 = (t0 - 0.5) * L,
          z1 = (t1 - 0.5) * L;
        const pitch = -Math.atan2(yAt(t1) - yAt(t0), z1 - z0);
        const zc = (z0 + z1) / 2;
        bb.box(0x6b6558, 5.2, 0.7, (L / N) * 1.12, 0, yAt(tm), zc, 0, pitch, 0);
        bb.box(0x8e887a, 5.0, 0.12, (L / N) * 1.12, 0, yAt(tm) + 0.4, zc, 0, pitch, 0);
        for (const sx of [-1, 1]) {
          bb.box(i % 2 ? 0xa39d8f : 0x948e80, 0.8, 1.15, (L / N) * 1.12, sx * 2.5, yAt(tm) + 0.95, zc, 0, pitch, 0);
          bb.box(0x7d776a, 1.0, 0.25, (L / N) * 1.12, sx * 2.5, yAt(tm) + 1.6, zc, 0, pitch, 0);
        }
      }
      // 아치 고리 + 다리 밑 둥근 석재
      const tor = new THREE.TorusGeometry(4.6, 0.55, 5, 12, Math.PI);
      for (const sx of [-1, 1]) bb.add(tor, 0x877f72, bb.matrix(sx * 2.45, 0.2, 0, 0, Math.PI / 2, 0, 1, 1, 1));
      tor.dispose();
      for (const sz of [-1, 1]) {
        bb.box(0x7d776a, 5.6, 2.0, 3.2, 0, 0.7, sz * (L / 2 - 1.3));
        bb.box(0x6b6558, 5.2, 0.5, 5.0, 0, 0.2, sz * (L / 2 + 0.6));
      }
      const geo = bb.build();
      disposables.push(geo);
      const m = kit.mesh(geo, kit.staticMat);
      m.position.set(br.x, heightAt(br.x, br.z) + 0.1, br.z);
      m.rotation.y = br.yaw;
      group.add(m);

      // 길에서 다리로 이어지는 흙길
      let near = v.road.pts[0],
        bd = Infinity;
      for (const rp of v.road.pts) {
        const d = Math.hypot(rp.x - br.x, rp.z - br.z);
        if (d < bd) {
          bd = d;
          near = rp;
        }
      }
      const dx = br.x - near.x,
        dz = br.z - near.z;
      const dl = Math.hypot(dx, dz) || 1;
      const pathPts = [];
      for (let k = 0; k <= 8; k++) {
        const s = (k / 8) * (dl + L / 2 + 9);
        pathPts.push({ x: near.x + (dx / dl) * s, z: near.z + (dz / dl) * s, w: 3.4 });
      }
      const pg = kit.makeRibbon(pathPts, 3.4, COLORS.road, 0.45);
      disposables.push(pg);
      group.add(kit.mesh(pg, roadMat, { cast: false }));
    }

    // 흙길
    const rp = v.road.pts.map((p, i, a) => ({ x: p.x, z: p.z, w: v.road.width * (0.55 + 0.45 * Math.min(1, Math.min(i, a.length - 1 - i) / 3)) }));
    const rg = kit.makeRibbon(rp, v.road.width, COLORS.road, 0.46);
    disposables.push(rg);
    group.add(kit.mesh(rg, roadMat, { cast: false }));

    // 우물
    const w = v.well,
      wy = heightAt(w.x, w.z);
    props
      .cyl(COLORS.stone, 2.3, 2.5, 2.0, w.x, wy + 0.7, w.z, 9)
      .cyl(0x2b4a6a, 1.8, 1.8, 0.2, w.x, wy + 1.62, w.z, 9)
      .beam(COLORS.darkWood, w.x - 2, wy, w.z, w.x - 2, wy + 4.4, w.z, 0.35)
      .beam(COLORS.darkWood, w.x + 2, wy, w.z, w.x + 2, wy + 4.4, w.z, 0.35)
      .gable(COLORS.terracotta, 5.6, 4.2, 1.8, w.x, wy + 4.3, w.z, -v.theta + Math.PI / 2);
    // 건초더미
    const hays = [...v.hay];
    for (let k = 0; k < 2; k++) {
      const hp = v.houses[Math.floor(rand() * v.houses.length)];
      hays.push({ x: hp.x + (rand() - 0.5) * 30, z: hp.z + (rand() - 0.5) * 30 });
    }
    for (const hpos of hays) {
      const hy = heightAt(hpos.x, hpos.z);
      props.cyl(COLORS.hay, 2.7, 2.7, 1.2, hpos.x, hy + 0.5, hpos.z, 8).cone(COLORS.hay, 2.7, 3.6, hpos.x, hy + 3.0, hpos.z, 8);
    }
  }

  const post = new THREE.InstancedMesh(postGeo, kit.staticMat, Math.max(1, posts.length));
  post.count = posts.length;
  posts.forEach((p, i) => {
    dummy.position.set(p.x, p.y - 0.4, p.z);
    dummy.rotation.set(0, (i * 1.7) % 3, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    post.setMatrixAt(i, dummy.matrix);
  });
  const rail = new THREE.InstancedMesh(railGeo, kit.staticMat, Math.max(1, rails.length));
  rail.count = rails.length;
  rails.forEach((m, i) => rail.setMatrixAt(i, m));
  const wall = new THREE.InstancedMesh(wallGeo, kit.staticMat, Math.max(1, walls.length));
  wall.count = walls.length;
  walls.forEach((m, i) => {
    wall.setMatrixAt(i, m);
    wall.setColorAt(i, color.setHex([0xa39d90, 0x8f897c, 0xb2ab9a][i % 3]));
  });
  if (walls.length) wall.instanceColor.needsUpdate = true;
  for (const m of [post, rail, wall]) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    group.add(m);
  }
  const propsGeo = props.build();
  disposables.push(propsGeo);
  group.add(kit.mesh(propsGeo, kit.staticMat));

  // ---- 꽃 핀 나무 ----
  const treeBy = [[], [], [], [], []];
  for (const v of plan.villages) for (const t of v.trees) treeBy[t.kind].push(t);
  treeBy.forEach((list, kind) => {
    if (!list.length) return;
    const geo = treeGeometry(kit, kind);
    disposables.push(geo);
    const mat = kit.material({ key: `vtree${kind}`, swayMode: 'bend', sway: [kind === 4 ? 0.35 : 0.8, 9, 1.7, 0] });
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((t, i) => {
      dummy.position.set(t.x, heightAt(t.x, t.z) - 0.2, t.z);
      dummy.rotation.set(0, rand() * TAU, 0);
      dummy.scale.setScalar(t.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color.setScalar(0.88 + rand() * 0.22));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });

  const landmarks = plan.villages.map((v) => ({ kind: 'village', name: v.withChurch ? '마을' : '작은 마을', x: v.cx, z: v.cz, discovered: false }));

  return {
    landmarks,
    update({ delta, storm }) {
      for (const h of houses) {
        const revealed = revealAtXZ(h.x, h.z) > 0.55;
        let v = h.lamp.step(revealed, delta);
        if (storm > 0.3) v *= 0.9 + 0.1 * Math.sin(kit.time.value * 9 + h.x); // 폭풍에는 불빛이 살짝 흔들린다
        prefabs[h.key].lit.set(h.index, v);
        for (const s of h.smokes) smoke.setTarget(s, h.lamp.value > 0.4 ? 1 : 0);
      }
      for (const l of litSets) l.commit();
    },
    reset() {
      for (const h of houses) h.lamp.reset();
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
    },
  };
}
