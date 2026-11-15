// ============================================================
// 협곡: 붉은 사암 바위 아치(통과 가능) / 협곡을 가로지르는 로프 현수교(바람에 출렁임) / 협곡 바닥 야영지(모닥불)
// ============================================================
import { COLORS, Lamp, lerp, mulberry32 } from '../LandmarkKit.js';

const TAU = Math.PI * 2;
const smooth01 = (t) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

// 위치만의 함수인 3D 값 노이즈 (정점이 갈라져 있어도 같은 자리는 같은 값 -> 틈이 생기지 않는다)
export function makeNoise3(seed) {
  const h = (x, y, z) => {
    let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177) + Math.imul(seed, 1442695041);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  return (x, y, z) => {
    const x0 = Math.floor(x),
      y0 = Math.floor(y),
      z0 = Math.floor(z);
    const fx = x - x0,
      fy = y - y0,
      fz = z - z0;
    const u = fx * fx * (3 - 2 * fx),
      v = fy * fy * (3 - 2 * fy),
      w = fz * fz * (3 - 2 * fz);
    const l = (a, b, t) => a + (b - a) * t;
    return l(
      l(l(h(x0, y0, z0), h(x0 + 1, y0, z0), u), l(h(x0, y0 + 1, z0), h(x0 + 1, y0 + 1, z0), u), v),
      l(l(h(x0, y0, z0 + 1), h(x0 + 1, y0, z0 + 1), u), l(h(x0, y0 + 1, z0 + 1), h(x0 + 1, y0 + 1, z0 + 1), u), v),
      w,
    );
  };
}

// ---- 바위 아치 (로컬: 원점 = 땅 중앙, 열린 방향 = z) ----
function archGeometry(kit, seed) {
  const THREE = kit.THREE;
  const noise = makeNoise3(seed);
  const R = 15,
    T = 4.6,
    legH = 14;
  const lo = new THREE.Color(0xb5502f),
    hi = new THREE.Color(0xdb8d57),
    c = new THREE.Color();
  // 협곡의 지층 줄무늬와 같은 계열: 높이에 따라 붉은색/살구색이 번갈아
  const strata = (x, y, z) => c.copy(lo).lerp(hi, 0.5 + 0.5 * Math.sin(y * 0.55 + Math.sin(x * 0.3 + z * 0.2) * 1.5));
  const b = kit.builder();
  const tor = new THREE.TorusGeometry(R, T, 7, 16, Math.PI);
  b.add(tor, strata, b.matrix(0, legH, 0, 0, 0, 0, 1, 1, 1.35));
  tor.dispose();
  for (const sx of [-1, 1]) {
    const leg = new THREE.CylinderGeometry(T * 0.95, 6.4, legH + 5, 8);
    b.add(leg, strata, b.matrix(sx * R, (legH - 5) / 2, 0, 0, 0, 0, 1, 1, 1.35));
    leg.dispose();
  }
  const rand = mulberry32(seed);
  for (let i = 0; i < 7; i++) {
    const side = i % 2 ? 1 : -1;
    const r = 2.4 + rand() * 2.6;
    b.ico(strata, r, side * (R + 4 + rand() * 7), r * 0.35, (rand() - 0.5) * 12, 1, 0.75, 1, 0, rand() * 6);
  }
  const g = b.build();
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    p.setXYZ(i, x + (noise(x * 0.3, y * 0.3, z * 0.3) - 0.5) * 2.2, y + (noise(x * 0.3 + 9, y * 0.3, z * 0.3) - 0.5) * 1.6, z + (noise(x * 0.3, y * 0.3 + 5, z * 0.3 + 3) - 0.5) * 2.2);
  }
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// ---- 로프 현수교 (월드 좌표, 셰이더가 가운데를 크게 흔든다) ----
function ropeBridgeGeometry(kit, br) {
  const { heightAt } = kit.ctx;
  const b = kit.builder();
  const A = br.a,
    B = br.b;
  const L = Math.hypot(B.x - A.x, B.z - A.z);
  const ux = (B.x - A.x) / L,
    uz = (B.z - A.z) / L;
  const vx = -uz,
    vz = ux;
  const yA = A.y + 1.4,
    yB = B.y + 1.4;
  const sag = 0.05 * L;
  const yAt = (t) => lerp(yA, yB, t) - sag * 4 * t * (1 - t);
  const P = (t, lat) => [A.x + ux * L * t + vx * lat, A.z + uz * L * t + vz * lat];
  const yaw = Math.atan2(ux, uz);
  const woods = [0x9a7448, 0x8a6740, 0xa98154];

  const n = Math.floor(L / 1.35);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const [x, z] = P(t, 0);
    const pitch = -Math.atan2(yAt(Math.min(1, t + 0.01)) - yAt(Math.max(0, t - 0.01)), 0.02 * L);
    b.box(woods[i % 3], 4.4, 0.26, 1.0, x, yAt(t), z, yaw, pitch, 0);
  }
  const N = Math.max(8, Math.round(L / 3));
  for (const lat of [-2.3, 2.3]) {
    for (let i = 0; i < N; i++) {
      const t0 = i / N,
        t1 = (i + 1) / N;
      const [x0, z0] = P(t0, lat),
        [x1, z1] = P(t1, lat);
      b.log(COLORS.rope, x0, yAt(t0) + 1.35, z0, x1, yAt(t1) + 1.35, z1, 0.13, 4);
      b.log(0x5a4a38, x0, yAt(t0) - 0.15, z0, x1, yAt(t1) - 0.15, z1, 0.16, 4);
      if (i > 0) b.log(COLORS.rope, x0, yAt(t0) + 0.1, z0, x0, yAt(t0) + 1.35, z0, 0.06, 3);
    }
  }
  // 양쪽 끝의 기둥 + 보 + 당김줄
  for (const [e, t, dir] of [
    [A, 0, -1],
    [B, 1, 1],
  ]) {
    const y0 = heightAt(e.x, e.z);
    const yTop = yAt(t) + 6.2;
    const tops = [];
    for (const lat of [-2.6, 2.6]) {
      const [x, z] = P(t, lat);
      b.beam(0x6d4a3a, x, y0 - 1.5, z, x, yTop, z, 0.85);
      tops.push([x, z]);
      const sx = x + ux * dir * 9,
        sz = z + uz * dir * 9;
      b.log(COLORS.rope, x, yTop - 0.4, z, sx, heightAt(sx, sz) + 0.2, sz, 0.1, 4);
    }
    b.beam(0x7a5636, tops[0][0], yTop, tops[0][1], tops[1][0], yTop, tops[1][1], 0.6);
    const [mx, mz] = P(t, 0);
    b.box(COLORS.stone, 7.4, 2.6, 3.2, mx - ux * dir * 0.8, y0 - 0.4, mz - uz * dir * 0.8, yaw);
  }
  return b.build();
}

// ---- 야영지 (로컬: 원점 = 모닥불 자리) ----
function campGeometry(kit) {
  const b = kit.builder();
  b.gable(COLORS.canvas, 6.4, 5.4, 4.4, -6.5, 0, -1.5, 0.3);
  b.gable(0x8a9a6b, 6.4, 5.4, 4.2, 5.5, 0, -3.6, -0.55);
  b.box(0x3a3a3a, 0.2, 2.6, 0.2, -6.5, 0.9, 1.2, 0.3);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    b.ico(i % 2 ? 0x8d887f : 0xa39d92, 0.5, Math.cos(a) * 1.5, 0.25, Math.sin(a) * 1.5, 1, 0.8, 1, 0, i);
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI;
    b.log(0x5e3f26, Math.cos(a) * 1.1, 0.35, Math.sin(a) * 1.1, -Math.cos(a) * 1.1, 0.35, -Math.sin(a) * 1.1, 0.24, 5);
  }
  b.log(COLORS.bark, -3.4, 0.4, 3.6, 1.2, 0.4, 3.9, 0.42, 6);
  b.log(COLORS.bark, 3.2, 0.4, 3.4, 3.6, 0.4, -0.4, 0.42, 6);
  b.cyl(COLORS.wood, 0.85, 0.85, 1.7, -2.4, 0.85, -4.6, 8);
  b.cyl(0x4a3a2a, 0.9, 0.9, 0.15, -2.4, 0.9, -4.6, 8);
  b.box(COLORS.lightWood, 1.6, 1.3, 1.6, 0.6, 0.65, -5.2, 0.4);
  return b.build();
}

export function buildCanyon(kit, plan, group, smoke) {
  const THREE = kit.THREE;
  const { revealAtXZ } = kit.ctx;
  if (!plan.arches.length && !plan.ropeBridges.length && !plan.camps.length) return null;
  const rand = mulberry32(plan.seed ^ 0xca17);
  const landmarks = [];
  const disposables = [];
  const camps = [];
  const archSeedBase = plan.seed & 0xffff;

  plan.arches.forEach((a, i) => {
    const geo = archGeometry(kit, archSeedBase + i * 31);
    const mesh = kit.mesh(geo, kit.staticMat);
    mesh.position.set(a.x, a.y - 0.2, a.z);
    mesh.rotation.y = a.yaw;
    mesh.scale.setScalar(a.s ?? 1);
    group.add(mesh);
    disposables.push(geo);
    landmarks.push({ kind: 'arch', name: '바위 아치', x: a.x, z: a.z, discovered: false });
  });

  plan.ropeBridges.forEach((br) => {
    const geo = ropeBridgeGeometry(kit, br);
    const L = Math.hypot(br.b.x - br.a.x, br.b.z - br.a.z);
    const mat = kit.material({
      key: 'rope-bridge',
      swayMode: 'bridge',
      sway: [1.6, 1, 1.6, 0],
      uniforms: {
        uBr: { value: new THREE.Vector4(br.a.x, br.a.z, (br.b.x - br.a.x) / L, (br.b.z - br.a.z) / L) },
        uBrLen: { value: L },
      },
    });
    group.add(kit.mesh(geo, mat));
    disposables.push(geo);
    landmarks.push({ kind: 'bridge', name: '현수교', x: (br.a.x + br.b.x) / 2, z: (br.a.z + br.b.z) / 2, discovered: false });
  });

  if (plan.camps.length) {
    const geo = campGeometry(kit);
    disposables.push(geo);
    const flameGeo = new THREE.ConeGeometry(0.95, 2.6, 6).translate(0, 1.3, 0);
    const coreGeo = new THREE.ConeGeometry(0.5, 1.7, 5).translate(0, 0.85, 0);
    const glowGeo = new THREE.CircleGeometry(5.5, 24).rotateX(-Math.PI / 2);
    disposables.push(flameGeo, coreGeo, glowGeo);
    const add = (color, opacity) =>
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    for (const c of plan.camps) {
      const root = new THREE.Group();
      root.position.set(c.x, c.y, c.z);
      root.rotation.y = c.yaw;
      root.add(kit.mesh(geo, kit.staticMat));
      const flame = new THREE.Mesh(flameGeo, add(0xff9a2e, 0.85));
      const core = new THREE.Mesh(coreGeo, add(0xffe38a, 0.9));
      const glow = new THREE.Mesh(glowGeo, add(0xff7a22, 0.0));
      glow.position.y = 0.4;
      for (const m of [flame, core, glow]) {
        m.frustumCulled = false;
        m.renderOrder = 4;
        root.add(m);
      }
      group.add(root);
      camps.push({ x: c.x, z: c.z, flame, core, glow, lamp: new Lamp(rand, [0.4, 1.4]), smoke: smoke.add(c.x, c.y + 3.0, c.z, 0.9), ph: rand() * 10 });
      landmarks.push({ kind: 'camp', name: '야영지', x: c.x, z: c.z, discovered: false });
    }
  }

  return {
    landmarks,
    update({ delta, time, storm = 0 }) {
      // 폭풍이 오면 모닥불이 꺼지고, 잦아들면 다시 붙는다
      const ext = smooth01((storm - 0.25) / 0.3);
      for (const c of camps) {
        const v = c.lamp.step(revealAtXZ(c.x, c.z) > 0.5, delta, 1.4) * (1 - ext);
        const t = time * 1 + c.ph;
        const fl = 0.85 + 0.2 * Math.sin(t * 17) + 0.12 * Math.sin(t * 29 + 1.3);
        c.flame.visible = c.core.visible = v > 0.02;
        c.flame.scale.set(v * (1 + 0.12 * Math.sin(t * 23)), v * fl, v * (1 + 0.12 * Math.cos(t * 19)));
        c.core.scale.set(v, v * (0.9 + 0.25 * Math.sin(t * 31)), v);
        c.glow.material.opacity = 0.32 * v * (0.8 + 0.2 * Math.sin(t * 13));
        smoke.setTarget(c.smoke, v > 0.4 ? 1 : 0);
      }
    },
    reset() {
      for (const c of camps) c.lamp.reset();
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
      for (const c of camps) [c.flame, c.core, c.glow].forEach((m) => m.material.dispose());
    },
  };
}
