// ============================================================
// 숲: 언덕 위 나무 전망대(깃발 + 탐험하면 켜지는 등불) / 골짜기를 건너는 통나무 다리 + 개울
// ============================================================
import { COLORS, Lamp, mulberry32 } from '../LandmarkKit.js';

// ---- 전망대 (로컬 좌표: 원점 = 땅, +y 위) ----
function towerGeometry(kit) {
  const t = kit.builder();
  const H = 17,
    yBot = -2.5;
  const rAt = (y) => 4.3 - 1.9 * ((y - yBot) / (H - yBot));
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  const levels = [-0.5, 5.5, 11, H];
  for (const [sx, sz] of corners) {
    t.beam(COLORS.bark, sx * rAt(yBot), yBot, sz * rAt(yBot), sx * rAt(H), H, sz * rAt(H), 0.62);
    t.box(COLORS.stoneDark, 1.7, 1.3, 1.7, sx * rAt(0) * 1.02, 0.2, sz * rAt(0) * 1.02);
  }
  levels.forEach((y, li) => {
    const r = rAt(y);
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i],
        [bx, bz] = corners[(i + 1) % 4];
      t.beam(COLORS.wood, ax * r, y, az * r, bx * r, y, bz * r, 0.34);
      if (li > 0) {
        const y0 = levels[li - 1],
          r0 = rAt(y0);
        t.beam(COLORS.lightWood, ax * r0, y0, az * r0, bx * r, y, bz * r, 0.24);
        t.beam(COLORS.lightWood, bx * r0, y0, bz * r0, ax * r, y, az * r, 0.24);
      }
    }
  });
  // 사다리 (앞면 +z)
  const zf = (y) => rAt(y) + 0.35;
  for (const x of [-0.75, 0.75]) t.beam(COLORS.wood, x, -0.5, zf(-0.5), x, H + 0.6, zf(H), 0.2);
  for (let y = 0.6; y < H; y += 1.3) t.box(COLORS.lightWood, 1.7, 0.18, 0.18, 0, y, zf(y));
  // 전망대 바닥 + 난간
  t.box(COLORS.lightWood, 7.8, 0.6, 7.8, 0, H + 0.3, 0);
  t.box(COLORS.wood, 6.2, 0.4, 6.2, 0, H - 0.2, 0);
  const hs = 3.7;
  for (const [sx, sz] of corners) t.beam(COLORS.wood, sx * hs, H + 0.6, sz * hs, sx * hs, H + 2.0, sz * hs, 0.3);
  for (let i = 0; i < 4; i++) {
    const [ax, az] = corners[i],
      [bx, bz] = corners[(i + 1) % 4];
    if (i === 2) continue; // 사다리 쪽(+z)은 열어 둠
    for (const yy of [H + 1.2, H + 1.95]) t.beam(COLORS.lightWood, ax * hs, yy, az * hs, bx * hs, yy, bz * hs, 0.2);
  }
  // 지붕
  for (const [sx, sz] of corners) t.beam(COLORS.wood, sx * 3.2, H + 0.6, sz * 3.2, sx * 3.2, H + 5.6, sz * 3.2, 0.34);
  t.cone(0x6f4b35, 5.8, 3.8, 0, H + 5.6 + 1.9, 0, 4, Math.PI / 4);
  t.beam(COLORS.bark, 0, H + 7.3, 0, 0, H + 11.8, 0, 0.18); // 깃대
  return { geo: t.build(), top: H + 11.4, lanternY: H + 4.6 };
}

function lanternGeometry(kit) {
  return kit.builder().box(0x7a5a30, 0.9, 1.2, 0.9, 0, 0, 0).box(0x3a2a1a, 1.2, 0.18, 1.2, 0, 0.7, 0).build();
}

function flagGeometry(kit, color, len = 3.6, hgt = 1.9, seg = 9) {
  const f = kit.builder();
  for (let i = 0; i < seg; i++) {
    const x0 = (i / seg) * len,
      x1 = ((i + 1) / seg) * len;
    const h0 = hgt * (1 - (i / seg) * 0.35) * 0.5,
      h1 = hgt * (1 - ((i + 1) / seg) * 0.35) * 0.5;
    f.tri(color, [x0, -h0, 0], [x1, -h1, 0], [x1, h1, 0]);
    f.tri(color, [x0, -h0, 0], [x1, h1, 0], [x0, h0, 0]);
  }
  return f.build();
}

// ---- 통나무 다리 (월드 좌표) ----
function logBridgeGeometry(kit, br) {
  const { heightAt } = kit.ctx;
  const b = kit.builder();
  const A = br.a,
    B = br.b;
  const L = Math.hypot(B.x - A.x, B.z - A.z);
  const ux = (B.x - A.x) / L,
    uz = (B.z - A.z) / L;
  const vx = -uz,
    vz = ux;
  const yA = A.y + 0.9,
    yB = B.y + 0.9;
  const yAt = (s) => yA + ((yB - yA) * s) / L;
  const P = (s, lat) => [A.x + ux * s + vx * lat, A.z + uz * s + vz * lat];
  const barks = [0x8c6239, 0x7e5632, 0x9a6f42];
  const yaw = Math.atan2(ux, uz);

  // 다리목 (돌 + 흙막이)
  for (const [s, y] of [
    [-0.8, yA],
    [L + 0.8, yB],
  ]) {
    const [x, z] = P(s, 0);
    b.box(COLORS.stone, 6.2, 3.4, 3.4, x, y - 1.9, z, yaw);
  }
  // 세로 들보 두 개
  for (const lat of [-1.9, 1.9]) {
    const [x0, z0] = P(-1.5, lat),
      [x1, z1] = P(L + 1.5, lat);
    b.log(COLORS.bark, x0, yA - 0.55, z0, x1, yB - 0.55, z1, 0.62, 7);
  }
  // 상판: 통나무를 가로로 촘촘히
  let i = 0;
  for (let s = 0.6; s < L; s += 1.1, i++) {
    const [x0, z0] = P(s, -2.7),
      [x1, z1] = P(s, 2.7);
    b.log(barks[i % 3], x0, yAt(s), z0, x1, yAt(s), z1, 0.52, 6);
  }
  // 난간: 기둥 + 위/가운데 가로대
  const posts = Math.max(2, Math.round(L / 4.4));
  for (const lat of [-2.7, 2.7]) {
    for (let k = 0; k <= posts; k++) {
      const s = (k / posts) * L;
      const [x, z] = P(s, lat);
      b.beam(COLORS.wood, x, yAt(s) + 0.3, z, x, yAt(s) + 1.9, z, 0.3);
    }
    for (const dy of [1.9, 1.0]) {
      const [x0, z0] = P(0, lat),
        [x1, z1] = P(L, lat);
      b.log(COLORS.lightWood, x0, yA + dy, z0, x1, yB + dy, z1, 0.2, 5);
    }
  }
  // 긴 다리는 가운데에 받침 (A자 다리)
  if (L > 34) {
    for (const s of [L * 0.5]) {
      for (const sign of [-1, 1]) {
        const [tx, tz] = P(s, sign * 1.9);
        const [gx, gz] = P(s, sign * 4.2);
        b.log(COLORS.bark, tx, yAt(s) - 0.5, tz, gx, heightAt(gx, gz) - 0.8, gz, 0.5, 6);
      }
      const [cx0, cz0] = P(s, -3.0),
        [cx1, cz1] = P(s, 3.0);
      b.log(COLORS.wood, cx0, yAt(s) - 3.1, cz0, cx1, yAt(s) - 3.1, cz1, 0.3, 5);
    }
  }
  return b.build();
}

export function buildForest(kit, plan, group) {
  const { revealAtXZ } = kit.ctx;
  const rand = mulberry32(plan.seed ^ 0x70e7);
  if (!plan.towers.length && !plan.logBridges.length) return null;
  const parts = [];
  const lamps = [];
  const flags = [];
  const landmarks = [];

  // ---- 전망대 ----
  if (plan.towers.length) {
    const model = towerGeometry(kit);
    const lanternGeo = lanternGeometry(kit);
    const flagGeo = flagGeometry(kit, 0xa8352c);
    const flagMat = kit.material({ key: 'flag-tower', swayMode: 'flag', sway: [0.55, 3.6, 4.5, 0] });
    parts.push(model.geo, lanternGeo, flagGeo);
    for (const tw of plan.towers) {
      const tower = kit.mesh(model.geo, kit.staticMat);
      tower.position.set(tw.x, tw.y, tw.z);
      tower.rotation.y = tw.yaw;
      group.add(tower);

      const lanternMat = kit.material({ key: 'lantern', lit: 'uniform', litColor: [1, 0.72, 0.32], litStrength: 2.4 });
      const lantern = kit.mesh(lanternGeo, lanternMat, { cast: false });
      lantern.position.set(tw.x, tw.y + model.lanternY, tw.z);
      group.add(lantern);

      const flag = kit.mesh(flagGeo, flagMat, { cast: false });
      flag.position.set(tw.x, tw.y + model.top, tw.z);
      group.add(flag);
      flags.push(flag);

      lamps.push({ x: tw.x, z: tw.z, mat: lanternMat, lamp: new Lamp(rand, [0.3, 1.2]) });
      landmarks.push({ kind: 'tower', name: '전망대', x: tw.x, z: tw.z, discovered: false });
    }
  }

  // ---- 통나무 다리 + 개울 ----
  let creekTex = null;
  for (const br of plan.logBridges) {
    group.add(kit.mesh(logBridgeGeometry(kit, br), kit.staticMat));
    landmarks.push({ kind: 'bridge', name: '통나무 다리', x: (br.a.x + br.b.x) / 2, z: (br.a.z + br.b.z) / 2, discovered: false });
    if (br.creek) {
      creekTex ??= kit.streakTexture();
      const mat = kit.ribbonMaterial({ key: 'creek', color: 0x6fb7e6, map: creekTex, opacity: 0.93 });
      const geo = kit.makeRibbon(br.creek.map((p, i, a) => ({ ...p, w: 3.6 + (i / a.length) * 2.6 })), 4.5, 0xffffff, 0.55, 0.09);
      group.add(kit.mesh(geo, mat, { cast: false }));
      parts.push(geo);
    }
  }

  return {
    landmarks,
    update({ delta, windAngle }) {
      for (const l of lamps) l.mat.userData.lit.value = l.lamp.step(revealAtXZ(l.x, l.z) > 0.55, delta, 1.2);
      for (const f of flags) f.rotation.y = windAngle;
      if (creekTex) creekTex.offset.y -= delta * 0.22;
    },
    reset() {
      for (const l of lamps) {
        l.lamp.reset();
        l.mat.userData.lit.value = 0;
      }
    },
    dispose() {
      parts.forEach((g) => g.dispose());
    },
  };
}
