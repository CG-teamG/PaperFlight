// ============================================================
// 강철 케이블 현수교: 돌 탑문(뾰족 아치) 2개 + 주 케이블 + 수직 행어 + 격자 난간 + 철판 상판
//   - 로프 현수교와 달리 곧고 단단한 구조. 바람이 불면 가운데가 옆으로 흔들리고 폭풍에는 크게 출렁인다.
//   - 월드 좌표로 만들고 셰이더('bridge')가 가운데를 흔든다. 탑 근처는 거의 고정.
// ============================================================
import { COLORS, lerp } from '../LandmarkKit.js';

function hangBridgeGeometry(kit, br) {
  const { heightAt } = kit.ctx;
  const b = kit.builder();
  const A = br.a,
    B = br.b;
  const L = Math.hypot(B.x - A.x, B.z - A.z);
  const ux = (B.x - A.x) / L,
    uz = (B.z - A.z) / L;
  const vx = -uz,
    vz = ux;
  const yaw = Math.atan2(ux, uz);
  const yA = A.y + 1.0,
    yB = B.y + 1.0;
  const deckY = (t) => lerp(yA, yB, t) + 0.0045 * L * 4 * t * (1 - t); // 살짝 위로 볼록한 상판
  const P = (t, lat) => [A.x + ux * L * t + vx * lat, A.z + uz * L * t + vz * lat];
  const steel = 0x59626b,
    steelL = 0x8c969f,
    brick = 0xb9a58a,
    brickD = 0x8b7a64,
    lamp = 0xffe6a8;
  const HALF_W = 2.1,
    TOWER_H = 13;

  // 상판: 철판(어두움) + 가운데 나무 판자 줄 + 가장자리 보
  const n = Math.floor(L / 1.2);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const [x, z] = P(t, 0);
    const pitch = -Math.atan2(deckY(Math.min(1, t + 0.01)) - deckY(Math.max(0, t - 0.01)), 0.02 * L);
    b.box(i % 2 ? steel : 0x4d555d, HALF_W * 2, 0.22, 1.05, x, deckY(t), z, yaw, pitch, 0);
    if (i % 3 === 0) b.box(COLORS.lightWood, 1.2, 0.08, 0.5, x, deckY(t) + 0.14, z, yaw, pitch, 0);
  }
  for (const lat of [-HALF_W, HALF_W]) {
    const N = Math.max(10, Math.round(L / 4));
    for (let i = 0; i < N; i++) {
      const t0 = i / N,
        t1 = (i + 1) / N;
      const [x0, z0] = P(t0, lat),
        [x1, z1] = P(t1, lat);
      b.beam(steel, x0, deckY(t0) - 0.2, z0, x1, deckY(t1) - 0.2, z1, 0.3); // 가장자리 보
      b.beam(steelL, x0, deckY(t0) + 1.2, z0, x1, deckY(t1) + 1.2, z1, 0.12); // 손잡이
    }
  }
  // 격자 난간: 가는 기둥을 촘촘히 + X자 가새
  const posts = Math.floor(L / 1.6);
  for (const lat of [-HALF_W, HALF_W])
    for (let i = 0; i <= posts; i++) {
      const t = i / posts;
      const [x, z] = P(t, lat);
      b.beam(steel, x, deckY(t), z, x, deckY(t) + 1.2, z, 0.07);
      if (i < posts) {
        const t1 = (i + 1) / posts;
        const [x1, z1] = P(t1, lat);
        b.beam(steel, x, deckY(t), z, x1, deckY(t1) + 1.15, z1, 0.04);
      }
    }
  // 주 케이블: 탑 꼭대기에서 출발해 가운데에서 난간 위 2m까지 처진다 + 수직 행어
  const topA = yA + TOWER_H - 1.5,
    topB = yB + TOWER_H - 1.5;
  const cableY = (t) => {
    const mid = deckY(0.5) + 3.0;
    const end = lerp(topA, topB, t);
    return lerp(end, mid, 1 - Math.pow(2 * t - 1, 2)) + 0;
  };
  const M = Math.max(14, Math.round(L / 3));
  for (const lat of [-HALF_W - 0.2, HALF_W + 0.2]) {
    for (let i = 0; i < M; i++) {
      const t0 = i / M,
        t1 = (i + 1) / M;
      const [x0, z0] = P(t0, lat),
        [x1, z1] = P(t1, lat);
      b.log(0x3b4249, x0, cableY(t0), z0, x1, cableY(t1), z1, 0.22, 5);
    }
    for (let i = 1; i < M; i++) {
      const t = i / M;
      const [x, z] = P(t, lat);
      b.beam(steelL, x, cableY(t), z, x, deckY(t) + 1.2, z, 0.05);
    }
  }
  // 양쪽 탑: 돌 기둥 두 개 + 뾰족 아치 상인방 + 램프 + 석조 받침
  for (const [e, t, dir] of [
    [A, 0, -1],
    [B, 1, 1],
  ]) {
    const y0 = heightAt(e.x, e.z);
    const yTop = (t ? yB : yA) + TOWER_H;
    const [mx, mz] = P(t, 0);
    const tw = HALF_W + 0.9;
    for (const sd of [-1, 1]) {
      const [x, z] = P(t, sd * tw);
      b.box(brick, 1.8, yTop - y0 + 2, 1.8, x, (yTop + y0 - 2) / 2, z, yaw);
      for (let k = 0; k < 5; k++) b.box(brickD, 2.0, 0.18, 2.0, x, y0 + 2.5 + k * ((yTop - y0 - 3) / 4.5), z, yaw);
      b.cone(brickD, 1.5, 2.8, x, yTop + 2.4, z, 4, yaw + Math.PI / 4); // 뾰족한 머리
      b.ico(lamp, 0.35, x, yTop - 1.6, z, 1, 1.2, 1, 0, 0);
      b.cyl(0x3b4249, 0.1, 0.1, 1.0, x, yTop - 0.7, z, 4);
    }
    // 아치형 상인방: 두 기둥 사이를 잇는 뾰족 아치(삼각 두 개)
    const [lx, lz] = P(t, -tw),
      [rx, rz] = P(t, tw);
    const tipY = yTop + 1.8;
    b.beam(brick, lx, yTop - 1.0, lz, mx, tipY, mz, 0.9);
    b.beam(brick, rx, yTop - 1.0, rz, mx, tipY, mz, 0.9);
    b.box(brickD, 4.4, 0.5, 2.0, mx, yTop - 3.0, mz, yaw + Math.PI / 2);
    // 케이블 고정용 앵커 블록과 뒷줄(지지 케이블)
    for (const sd of [-1, 1]) {
      const [x, z] = P(t, sd * (HALF_W + 0.2));
      const ax = x + ux * dir * 14,
        az = z + uz * dir * 14;
      b.log(0x3b4249, x, yTop - 1.6, z, ax, heightAt(ax, az) + 0.4, az, 0.2, 5);
      b.box(COLORS.stoneDark, 3.0, 1.6, 3.0, ax, heightAt(ax, az) + 0.2, az, yaw);
    }
    b.box(COLORS.stone, 8.2, 2.4, 4.0, mx - ux * dir * 1.6, y0 - 0.4, mz - uz * dir * 1.6, yaw);
  }
  return b.build();
}

export function buildHangBridges(kit, plan, group) {
  const THREE = kit.THREE;
  if (!plan.hangBridges.length) return null;
  const landmarks = [];
  const geos = [];
  for (const br of plan.hangBridges) {
    const geo = hangBridgeGeometry(kit, br);
    geos.push(geo);
    const L = Math.hypot(br.b.x - br.a.x, br.b.z - br.a.z);
    const mat = kit.material({
      key: 'hang-bridge',
      swayMode: 'bridge',
      sway: [1.1, 1, 1.9, 0],
      uniforms: {
        uBr: { value: new THREE.Vector4(br.a.x, br.a.z, (br.b.x - br.a.x) / L, (br.b.z - br.a.z) / L) },
        uBrLen: { value: L },
      },
    });
    group.add(kit.mesh(geo, mat));
    landmarks.push({ kind: 'hangbridge', name: '강철 현수교', x: (br.a.x + br.b.x) / 2, z: (br.a.z + br.b.z) / 2, discovered: false });
  }
  return {
    landmarks,
    update() {},
    dispose() {
      geos.forEach((g) => g.dispose());
    },
  };
}
