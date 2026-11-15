// ============================================================
// 바다: 등대(회전하는 빛줄기, 탐험하면 점등) / 파도를 타고 출렁이는 부표 길(탐험하면 깜빡이는 등)
// 부표의 높이는 바다 셰이더(Environment WATER 정점 셰이더)의 waveH 와 같은 식으로 CPU에서 계산한다.
// ============================================================
import { COLORS, Lamp, lerp, mulberry32 } from '../LandmarkKit.js';

const TAU = Math.PI * 2;

const sstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Environment 의 water 정점 셰이더와 동일해야 한다
function waveH(x, z, t) {
  return Math.sin(x * 0.045 + t * 1.3) * 0.6 + Math.cos(z * 0.05 + t * 1.0) * 0.5 + Math.sin((x + z) * 0.09 + t * 1.9) * 0.25;
}

// ---- 등대 (로컬: 원점 = 수면 위 중앙. 바위 기초는 바닥(depth)까지 내려간다) ----
function lighthouseGeometry(kit, depth) {
  const b = kit.builder();
  const red = 0xb8433a;
  // 바위 기초: 바닥에서 수면 위 4m까지
  const rockTop = 4.2;
  const rocks = [0x8a8378, 0x7d756a, 0x968e80];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU;
    const r = 9 + (i % 3) * 2.2;
    b.ico(rocks[i % 3], 7 + (i % 4) * 1.2, Math.cos(a) * r, rockTop - 5.5 - (i % 2) * 1.5, Math.sin(a) * r, 1, 0.8, 1, 0, i);
  }
  b.cyl(rocks[0], 10.5, 13.5, depth + rockTop, 0, (rockTop - depth) / 2, 0, 9);
  b.cyl(COLORS.stoneDark, 8.2, 9.4, 1.6, 0, rockTop + 0.4, 0, 12);
  // 줄무늬 탑
  const bands = 6;
  const H = 34,
    r0 = 4.9,
    r1 = 3.3;
  const y0 = rockTop + 1.2;
  for (let i = 0; i < bands; i++) {
    const t0 = i / bands,
      t1 = (i + 1) / bands;
    b.cyl(i % 2 ? red : COLORS.white, lerp(r0, r1, t1), lerp(r0, r1, t0), H / bands + 0.05, 0, y0 + (t0 + t1) * 0.5 * H, 0, 12);
  }
  const top = y0 + H;
  // 문과 작은 창
  b.box(COLORS.darkWood, 2.2, 3.6, 0.5, 0, y0 + 1.8, r0 - 0.15, 0);
  for (let i = 1; i < 5; i++) {
    const rr = lerp(r0, r1, (i + 0.5) / bands) - 0.2;
    b.box(COLORS.glass, 0.9, 1.5, 0.4, 0, y0 + (i + 0.5) * (H / bands), rr, 0);
  }
  // 회랑 + 난간
  b.cyl(0x3b3f47, 5.9, 5.4, 0.7, 0, top + 0.35, 0, 12);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    b.box(0x3b3f47, 0.2, 1.6, 0.2, Math.cos(a) * 5.7, top + 1.5, Math.sin(a) * 5.7, 0);
  }
  b.cyl(0x3b3f47, 5.8, 5.8, 0.2, 0, top + 2.3, 0, 14);
  // 등롱 기둥 + 지붕 (유리 부분은 별도 메시)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.26;
    b.beam(0x3b3f47, Math.cos(a) * 2.7, top + 0.7, Math.sin(a) * 2.7, Math.cos(a) * 2.7, top + 5.2, Math.sin(a) * 2.7, 0.35);
  }
  b.cyl(red, 3.5, 3.5, 0.5, 0, top + 5.4, 0, 12);
  b.cone(red, 3.8, 3.0, 0, top + 7.0, 0, 12);
  b.cyl(0x3b3f47, 0.12, 0.12, 2.0, 0, top + 9.2, 0, 4);
  return { geo: b.build(), lanternY: top + 0.7, lanternTop: top + 5.2 };
}

function lanternGeometry(kit) {
  const b = kit.builder();
  b.cyl(0xffe6a8, 2.3, 2.3, 4.2, 0, 2.1, 0, 10);
  b.ico(0xfff4cf, 1.2, 0, 2.1, 0, 1, 1, 1, 1, 0);
  return b.build();
}

// ---- 부표 (로컬: 원점 = 수면, 빨강/하양 두 종) ----
function buoyGeometry(kit, bodyColor, bandColor) {
  const b = kit.builder();
  b.cyl(bodyColor, 1.9, 1.5, 1.8, 0, 0.35, 0, 10);
  b.cyl(bandColor, 1.52, 1.62, 0.5, 0, 0.5, 0, 10);
  b.cyl(0x40454d, 0.5, 0.5, 0.35, 0, 1.4, 0, 6);
  b.beam(0x40454d, 0, 1.4, 0, 0, 3.8, 0, 0.22);
  b.cone(bodyColor, 0.85, 1.3, 0, 4.1, 0, 6);
  b.cyl(0x40454d, 0.2, 0.2, 0.5, 0, 3.7, 0, 5);
  return b.build();
}

export function buildSea(kit, plan, group) {
  const THREE = kit.THREE;
  const { revealAtXZ, heightAt } = kit.ctx;
  if (!plan.lighthouses.length && !plan.buoys.length) return null;
  const rand = mulberry32(plan.seed ^ 0x5ea5);
  const HALF = kit.ctx.HALF ?? 1000;
  const landmarks = [];
  const disposables = [];
  const lights = [];

  // ---------- 등대 ----------
  if (plan.lighthouses.length) {
    const lanternGeo = lanternGeometry(kit);
    const beamGeo = new THREE.ConeGeometry(7, 150, 12, 1, true).translate(0, -75, 0).rotateZ(Math.PI / 2);
    disposables.push(lanternGeo, beamGeo);
    for (const lh of plan.lighthouses) {
      const model = lighthouseGeometry(kit, -lh.y + 1);
      disposables.push(model.geo);
      const root = new THREE.Group();
      root.position.set(lh.x, 0, lh.z);
      root.add(kit.mesh(model.geo, kit.staticMat));

      const lanternMat = kit.material({ key: 'lantern', lit: 'uniform', litColor: [1, 0.78, 0.35], litStrength: 2.6 });
      const lantern = kit.mesh(lanternGeo, lanternMat, { cast: false });
      lantern.position.y = model.lanternY;
      root.add(lantern);

      // 빛줄기 두 갈래 (서로 반대 방향)
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xfff0b8,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const beams = new THREE.Group();
      beams.position.y = model.lanternY + 2.1;
      for (const flip of [0, Math.PI]) {
        const bm = new THREE.Mesh(beamGeo, beamMat);
        bm.rotation.y = flip;
        bm.rotation.z = -0.045;
        bm.frustumCulled = false;
        bm.renderOrder = 4;
        beams.add(bm);
      }
      root.add(beams);
      group.add(root);
      lights.push({ x: lh.x, z: lh.z, lanternMat, beamMat, beams, lamp: new Lamp(rand, [0.5, 1.6]), ph: rand() * TAU });
      landmarks.push({ kind: 'lighthouse', name: '등대', x: lh.x, z: lh.z, discovered: false });
    }
  }

  // ---------- 부표 ----------
  const buoys = plan.buoys.map((p) => {
    const depth = -heightAt(p.x, p.z);
    const edge = Math.max(Math.abs(p.x), Math.abs(p.z));
    const damp = (0.25 + 0.75 * sstep(0, 8, depth)) * (1 - sstep(HALF - 80, HALF, edge));
    return { ...p, damp, lamp: new Lamp(rand, [0.2, 2.0]), idx: 0 };
  });
  const sets = [];
  if (buoys.length) {
    const bulbGeo = new THREE.IcosahedronGeometry(0.55, 1);
    disposables.push(bulbGeo);
    const types = [
      { body: 0xc7402f, band: COLORS.white, bulb: 0xff5a40 },
      { body: COLORS.white, band: 0xc7402f, bulb: 0xfff0b0 },
    ];
    types.forEach((tp, ti) => {
      const list = buoys.filter((p) => p.type === ti);
      if (!list.length) return;
      const geo = buoyGeometry(kit, tp.body, tp.band);
      disposables.push(geo);
      const mat = kit.material({ key: `buoy${ti}` });
      const body = new THREE.InstancedMesh(geo, mat, list.length);
      const bulbMat = new THREE.MeshBasicMaterial({ color: tp.bulb, toneMapped: false });
      const bulb = new THREE.InstancedMesh(bulbGeo, bulbMat, list.length);
      for (const m of [body, bulb]) {
        m.frustumCulled = false;
        m.castShadow = m === body;
        group.add(m);
      }
      list.forEach((p, i) => (p.idx = i));
      sets.push({ list, body, bulb, bulbMat });
    });
  }

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const one = new THREE.Vector3(1.7, 1.7, 1.7);
  const top = new THREE.Vector3();

  return {
    landmarks,
    update({ delta, time, waterTime, windX, windZ, k }) {
      for (const l of lights) {
        const v = l.lamp.step(revealAtXZ(l.x, l.z) > 0.5, delta, 0.9);
        l.lanternMat.userData.lit.value = v;
        l.beamMat.opacity = 0.085 * v;
        l.beams.visible = v > 0.01;
        l.beams.rotation.y = time * 0.8 + l.ph;
      }
      const wt = waterTime ?? time;
      for (const s of sets) {
        for (const p of s.list) {
          const v = p.lamp.step(revealAtXZ(p.x, p.z) > 0.5, delta, 1.5);
          const h = waveH(p.x, p.z, wt) * p.damp;
          // 파도 기울기로 부표가 기울어진다 + 바람에 살짝 쏠림
          const gx = (waveH(p.x + 1.5, p.z, wt) - waveH(p.x - 1.5, p.z, wt)) / 3;
          const gz = (waveH(p.x, p.z + 1.5, wt) - waveH(p.x, p.z - 1.5, wt)) / 3;
          const lean = 0.05 + 0.1 * k;
          e.set(Math.atan(gz * p.damp * 2.2) + windZ * lean, 0, -Math.atan(gx * p.damp * 2.2) + -windX * lean);
          q.setFromEuler(e);
          pos.set(p.x, h + 0.2, p.z);
          m4.compose(pos, q, one);
          s.body.setMatrixAt(p.idx, m4);
          // 등: 깜빡임 (탐험한 뒤에만)
          const on = (time * 0.55 + p.phase / TAU) % 1 < 0.22 ? 1 : 0;
          const bs = v * on * 1.0;
          top.set(0, 3.75 * 1.7, 0).applyQuaternion(q).add(pos);
          sc.setScalar(Math.max(0.001, bs * 1.7));
          m4.compose(top, q, sc);
          s.bulb.setMatrixAt(p.idx, m4);
        }
        s.body.instanceMatrix.needsUpdate = true;
        s.bulb.instanceMatrix.needsUpdate = true;
      }
    },
    reset() {
      for (const l of lights) l.lamp.reset();
      for (const p of buoys) p.lamp.reset();
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
      for (const l of lights) {
        l.beamMat.dispose();
        l.lanternMat.dispose();
      }
      for (const s of sets) {
        s.bulbMat.dispose();
        s.body.dispose();
        s.bulb.dispose();
      }
    },
  };
}
