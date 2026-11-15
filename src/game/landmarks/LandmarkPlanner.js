// ============================================================
// 파일명: LandmarkPlanner.js
// 담당자: 팀원 A - 3D 그래픽
// 역할: 시드마다 달라지는 지형 위에 조형물(마을, 꽃밭, 전망대, 산장, 아치, 등대 ...)을
//       "어디에 놓을지"만 계산한다. (THREE 없이 순수 계산 -> 같은 시드 = 같은 배치)
//
// 호출 시점: Environment.createEnvironment() 에서 구역(zones)을 만든 직후, 지형 메시를 만들기 전.
//   1) plan.pads         -> heightAt()이 읽어서 조형물 밑 땅을 평탄하게 만든다 (착륙장과 같은 방식)
//   2) plan.blocksTree() -> 조형물 주변은 나무를 심지 않는다
//   3) plan.blocksRing() -> 링이 조형물 속에 생기지 않게 한다
//   4) 나머지 목록(villages, flowers ...)은 Landmarks.js 의 빌더들이 읽어서 모델을 만든다
// ============================================================

const sstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const ARCH_SCALE = 1.7;
const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function planLandmarks(env) {
  const { heightAt, slopeAt, snowAt, zones, seed, HALF, LANDING_PAD, START } = env;
  const rand = mulberry32(((seed | 0) ^ 0x51ed270b) >>> 0);
  const R = (a, b) => a + (b - a) * rand();
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const plan = {
    seed,
    pads: [], // 평탄화: { x, z, y, r0, r1, k }
    gullies: [], // 파내기(골짜기): { x, z, dx, dz, halfLen, w, depth } -> 통나무 다리 밑 개울 골짜기
    villages: [],
    flowers: [], // { kind: 'lavender' | 'meadow', x, z, rx, rz, ang }
    towers: [],
    logBridges: [],
    chalets: [],
    summits: [],
    cairns: [],
    cableCars: [],
    arches: [],
    ropeBridges: [],
    hangBridges: [],
    camps: [],
    lighthouses: [],
    buoys: [],
    tarns: [],
    huts: [],
    conifers: [],
    tumble: [],
    hoodoos: [],
    desert: [],
    rockHouses: [],
    rocks: [],
    harbors: [],
  };

  const treeCircles = [];
  const ringCircles = [];
  const taken = []; // 조형물끼리 겹치지 않게
  const blockTree = (x, z, r) => treeCircles.push({ x, z, r });
  const blockRing = (x, z, r) => ringCircles.push({ x, z, r });
  const take = (x, z, r) => taken.push({ x, z, r });
  const isFree = (x, z, r) => taken.every((t) => Math.hypot(t.x - x, t.z - z) >= t.r + r);
  const addPad = (x, z, y, r0, k = 1) =>
    plan.pads.push({ x, z, y, r0, r1: r0 + Math.max(16, r0 * 0.9), k });

  const inZone = (zn, margin) => ({
    x: R(zn.min.x + margin, zn.max.x - margin),
    z: R(zn.min.z + margin, zn.max.z - margin),
  });
  const rectDist = (x, z, zn) =>
    Math.hypot(Math.max(zn.min.x - x, 0, x - zn.max.x), Math.max(zn.min.z - z, 0, z - zn.max.z));
  const zoneGap = (a, b) =>
    Math.hypot(
      Math.max(a.min.x - b.max.x, b.min.x - a.max.x, 0),
      Math.max(a.min.z - b.max.z, b.min.z - a.max.z, 0),
    );
  const zoneOf = (x, z) => zones.find((zn) => x >= zn.min.x && x < zn.max.x && z >= zn.min.z && z < zn.max.z);

  // 중심 + 둘레 2겹으로 땅의 평탄함을 잰다
  function flatness(x, z, r) {
    const c = heightAt(x, z);
    let min = c,
      max = c,
      sum = c,
      n = 1;
    for (let ring = 0; ring < 2; ring++) {
      const rr = ring ? r : r * 0.5;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + ring * 0.4;
        const h = heightAt(x + Math.cos(a) * rr, z + Math.sin(a) * rr);
        if (h < min) min = h;
        if (h > max) max = h;
        sum += h;
        n++;
      }
    }
    return { range: max - min, mean: sum / n, min, max, center: c };
  }
  const gradient = (x, z) => ({
    gx: (heightAt(x + 4, z) - heightAt(x - 4, z)) / 8,
    gz: (heightAt(x, z + 4) - heightAt(x, z - 4)) / 8,
  });
  const coastRadius = (dx, dz) => {
    let r = 300;
    while (r < 1500 && heightAt(dx * r, dz * r) > -1) r += 15;
    return r;
  };

  // ------------------------------------------------------------
  // 1) 마을: 착륙장 근처의 큰 마을 + 평원 구역마다 작은 마을
  //    마을 = 길(흙길) 양쪽의 집들 + 타원형 울타리(입구 한 곳) + 우물/건초더미
  // ------------------------------------------------------------
  // 집 종류별 대략적인 반지름(간격 계산용): A,B,C 코티지 / F 알프스 샬레 / G 연립주택 / D 헛간 / E 교회
  const HOUSE_R = { A: 9, B: 9.5, C: 8.5, F: 11, G: 16, D: 11, E: 15 };

  // 마을 배치: 길(S자) + 개울 + 푸아송 원반 식으로 흩뿌린 집들 + 흩어진 울타리/돌담/나무/정원
  //  (예전의 "길 양쪽 일렬 + 타원 울타리"가 아니라, 길과 개울을 따라 자연스럽게 모인 마을)
  function layoutVillage(cx, cz, theta, houseCount, withChurch) {
    const ux = Math.cos(theta),
      uz = Math.sin(theta);
    const vx = -uz,
      vz = ux;
    const big = withChurch;
    const a = big ? 108 : 68,
      b = big ? 74 : 50;
    const at = (u, v) => ({ x: cx + ux * u + vx * v, z: cz + uz * u + vz * v });
    // 길(S자)과 개울(반대편에서 나란히 굽이침)
    const wA = R(5, 9),
      wF = R(0.028, 0.042),
      wP = R(0, TAU);
    const roadV = (u) => Math.sin(u * wF + wP) * wA;
    const side = rand() < 0.5 ? -1 : 1;
    const sA = R(4, 8),
      sF = R(0.03, 0.05),
      sP = R(0, TAU),
      sV0 = side * (big ? 33 : 27);
    const streamV = (u) => sV0 + Math.sin(u * sF + sP) * sA;
    const placed = [];
    const houses = [];
    const tryPlace = (kind, u, v, forceYaw) => {
      const rad = HOUSE_R[kind];
      const dRoad = Math.abs(v - roadV(u));
      const dStream = Math.abs(v - streamV(u));
      if ((u / a) ** 2 + (v / b) ** 2 > 1) return false;
      if (dRoad < 8.5 + rad * 0.35 || dStream < 9 + rad * 0.3) return false;
      for (const p of placed) if (Math.hypot(p.u - u, p.v - v) < p.r + rad + 3.5) return false;
      const sgn = v > roadV(u) ? -1 : 1; // 길 쪽을 향함
      const yaw = forceYaw ?? Math.atan2(vx * sgn, vz * sgn) + R(-0.3, 0.3) + (rand() < 0.22 ? R(-0.5, 0.5) : 0);
      const w = at(u, v);
      houses.push({ x: w.x, z: w.z, yaw, kind, scale: R(0.94, 1.12), r: rad });
      placed.push({ u, v, r: rad });
      return true;
    };
    if (withChurch) {
      const u = a * 0.62,
        v = roadV(u) - side * 26;
      tryPlace('E', u, v, Math.atan2(vx * side, vz * side));
    }
    const kinds = ['F', 'F', 'A', 'B', 'C', 'F', 'G', 'A', 'B', 'C', 'G', 'F'];
    let barns = big ? 2 : 1;
    for (let t = 0; t < 1400 && houses.length < houseCount + (withChurch ? 1 : 0); t++) {
      const u = R(-a * 0.96, a * 0.96),
        v = R(-b * 0.96, b * 0.96);
      const dRoad = Math.abs(v - roadV(u));
      if (dRoad > 36 && rand() < 0.7) continue; // 길에서 멀수록 드물게
      let kind = kinds[Math.floor(rand() * kinds.length)];
      if (barns > 0 && (u / a) ** 2 + (v / b) ** 2 > 0.45 && houses.length > 4) {
        kind = 'D';
      }
      if (tryPlace(kind, u, v) && kind === 'D') barns--;
    }

    // 개울 중심선 / 길 중심선 (월드 좌표)
    const streamPts = [],
      roadPts = [];
    for (let u = -a - 44; u <= a + 44; u += 7) streamPts.push({ ...at(u, streamV(u)), u });
    for (let u = a * 0.7; u >= -a - 46; u -= 7) roadPts.push({ ...at(u, roadV(u)), u });

    // 돌다리: 개울을 건너는 곳 (길에서 갈라진 샛길)
    const bridges = [];
    for (const uu of big ? [-a * 0.35, a * 0.2] : [-a * 0.1]) {
      const p0 = at(uu, streamV(uu));
      const dv = (streamV(uu + 1) - streamV(uu - 1)) / 2;
      bridges.push({ x: p0.x, z: p0.z, yaw: Math.atan2(vx, vz), u: uu, len: 17, dv });
    }

    // 울타리/돌담: 마을 둘레에 여러 토막으로 (길/개울과 겹치는 곳과 무작위 구간은 비움)
    const fences = [];
    const nF = 140,
      fa = a + 6,
      fb = b + 6;
    const gapPh = R(0, TAU),
      gapK = Math.floor(R(3, 6));
    let run = null;
    for (let i = 0; i <= nF; i++) {
      const t = (i / nF) * TAU;
      const u = fa * Math.cos(t),
        v = fb * Math.sin(t);
      const blocked =
        Math.abs(v - roadV(u)) < 7 ||
        Math.abs(v - streamV(u)) < 10 ||
        Math.sin(t * gapK + gapPh) > 0.35 + (big ? 0.1 : 0);
      if (blocked) {
        run = null;
        continue;
      }
      if (!run) {
        run = { type: rand() < 0.35 ? 'wall' : 'fence', pts: [] };
        fences.push(run);
      }
      run.pts.push(at(u, v));
    }
    // 길가의 짧은 울타리(레퍼런스의 완만한 비탈길 난간처럼)
    for (let k = 0; k < (big ? 4 : 2); k++) {
      const u0 = R(-a * 0.8, a * 0.5),
        len = R(24, 44),
        s = rand() < 0.5 ? -1 : 1;
      const pts = [];
      for (let u = u0; u <= u0 + len; u += 5) pts.push(at(u, roadV(u) + s * 5.4));
      fences.push({ type: 'fence', pts });
    }

    // 나무: 개울가, 집 마당, 빈터 (벚꽃/살구꽃/흰 꽃나무/버드나무/침엽수)
    const trees = [];
    const farFromHouses = (x, z, m = 5) => houses.every((h) => Math.hypot(h.x - x, h.z - z) > h.r * 0.75 + m);
    const farFromRoad = (u, v) => Math.abs(v - roadV(u)) > 6.5 && Math.abs(v - streamV(u)) > 6;
    const addTree = (u, v, kind) => {
      const w = at(u, v);
      if (!farFromHouses(w.x, w.z, 4) || !farFromRoad(u, v)) return;
      if (trees.some((t) => Math.hypot(t.x - w.x, t.z - w.z) < 7)) return;
      trees.push({ x: w.x, z: w.z, kind, s: R(0.85, 1.25) });
    };
    for (let u = -a; u <= a; u += R(10, 17)) {
      const sv = streamV(u);
      addTree(u, sv + (rand() < 0.5 ? -1 : 1) * R(11, 15), rand() < 0.5 ? 3 : Math.floor(R(0, 3)));
    }
    for (let t = 0; t < 420 && trees.length < houseCount * 1.8; t++) {
      const u = R(-a, a),
        v = R(-b, b);
      if ((u / a) ** 2 + (v / b) ** 2 > 1) continue;
      addTree(u, v, Math.floor(R(0, 5)));
    }

    // 집 앞 정원(튤립/데이지...)과 울타리 안 풀밭 꽃
    const gardens = [];
    for (const h of houses) {
      if (h.kind === 'D' || h.kind === 'E') continue;
      const fx = Math.sin(h.yaw),
        fz = Math.cos(h.yaw);
      const off = h.r * 0.62 + 4.5;
      gardens.push({ x: h.x + fx * off + R(-2, 2), z: h.z + fz * off + R(-2, 2), rx: R(5.5, 8), rz: R(3, 4.4), ang: h.yaw + Math.PI / 2 });
    }

    // 길가 돌담 조각
    const hay = [];
    for (const h of houses)
      if (h.kind === 'D') {
        const fx = Math.sin(h.yaw + 1.2),
          fz = Math.cos(h.yaw + 1.2);
        hay.push({ x: h.x + fx * 15, z: h.z + fz * 15 });
      }
    const wellU = -a * 0.05;
    return {
      cx,
      cz,
      theta,
      houses,
      a,
      b,
      withChurch,
      road: { pts: roadPts, width: big ? 7 : 6 },
      stream: { pts: streamPts, width: big ? 7.5 : 6, a, u0: -a, u1: a },
      bridges,
      fences,
      trees,
      gardens,
      hay,
      well: at(wellU, roadV(wellU) - side * 8.5),
    };
  }

  function validateVillage(v) {
    let sum = 0,
      n = 0,
      min = Infinity,
      max = -Infinity;
    const sample = (x, z) => {
      const h = heightAt(x, z);
      sum += h;
      n++;
      min = Math.min(min, h);
      max = Math.max(max, h);
    };
    for (const h of v.houses) sample(h.x, h.z);
    for (const p of v.stream.pts) if (Math.abs(p.u) <= v.a) sample(p.x, p.z);
    return { ok: v.houses.length >= (v.withChurch ? 9 : 4) && min > 6 && max - min < 26, y: sum / n };
  }

  function placeVillage(v, y) {
    const ux = Math.cos(v.theta),
      uz = Math.sin(v.theta);
    const vx = -uz,
      vz = ux;
    v.y = y;
    // 마을 전체를 하나의 완만한 평지로 (격자 모양 패드)
    for (let u = -v.a * 0.85; u <= v.a * 0.86; u += 36)
      for (const vv of [-v.b * 0.55, 0, v.b * 0.55]) {
        const px = v.cx + ux * u + vx * vv,
          pz = v.cz + uz * u + vz * vv;
        addPad(px, pz, y, 24, 0.9);
        blockTree(px, pz, 36);
      }
    blockRing(v.cx, v.cz, v.a + 40);
    take(v.cx, v.cz, Math.max(v.a, v.b) + 16);
    plan.villages.push(v);
    for (const g of v.gardens) plan.flowers.push({ kind: 'garden', x: g.x, z: g.z, rx: g.rx, rz: g.rz, ang: g.ang });
    // 마을 둘레 풀밭 꽃
    plan.flowers.push({ kind: 'meadow', x: v.cx, z: v.cz, rx: v.a * 1.15, rz: v.b * 1.15, ang: v.theta, sparse: true });
  }

  function planVillages() {
    // (가) 착륙장 근처 큰 마을: 폭풍 때 귀환하는 곳 가까이에 불 켜진 마을이 보이게
    let best = null;
    for (let i = 0; i < 160; i++) {
      const ang = R(0, TAU),
        dist = i < 80 ? R(185, 235) : R(150, 330);
      const x = LANDING_PAD.x + Math.cos(ang) * dist,
        z = LANDING_PAD.z + Math.sin(ang) * dist;
      if (Math.max(Math.abs(x), Math.abs(z)) > HALF - 260) continue;
      if (Math.hypot(x - START.x, z - START.z) < 170) continue;
      const f = flatness(x, z, 62);
      if (f.min < 7 || f.range > 22) continue;
      const score = f.range + R(0, 1.2);
      if (!best || score < best.score) best = { x, z, score };
    }
    if (best) {
      for (let attempt = 0; attempt < 12; attempt++) {
        const v = layoutVillage(best.x, best.z, R(0, TAU), 18, true);
        const check = validateVillage(v);
        if (check.ok) {
          placeVillage(v, check.y);
          break;
        }
      }
    }

    // (나) 평원 구역마다 작은 마을 (최대 3곳)
    const plains = shuffle(zones.filter((zn) => zn.type === 'plain'));
    let hamlets = 0;
    for (const zn of plains) {
      if (hamlets >= 3) break;
      let cand = null;
      for (let t = 0; t < 70; t++) {
        const p = inZone(zn, 120);
        if (Math.hypot(p.x - START.x, p.z - START.z) < 95) continue;
        if (Math.hypot(p.x - LANDING_PAD.x, p.z - LANDING_PAD.z) < 170) continue;
        if (!isFree(p.x, p.z, 95)) continue;
        const f = flatness(p.x, p.z, 50);
        if (f.min < 7 || f.range > 20) continue;
        if (!cand || f.range < cand.range) cand = { ...p, range: f.range };
      }
      if (!cand) continue;
      for (let attempt = 0; attempt < 8; attempt++) {
        const v = layoutVillage(cand.x, cand.z, R(0, TAU), 7 + Math.floor(rand() * 4), false);
        const check = validateVillage(v);
        if (check.ok) {
          placeVillage(v, check.y);
          hamlets++;
          break;
        }
      }
    }
  }

  // ------------------------------------------------------------
  // 2) 꽃밭: "산과 가까운 숲" 우선. (시드에 따라 산과 붙은 숲이 없을 수도 있어서
  //    '가장 가까운 숲'을 기준으로 한계 거리를 정한다.)
  //    라벤더 밭(등고선 방향 줄무늬) + 그 둘레의 들꽃(안개꽃/양귀비/수레국화)
  // ------------------------------------------------------------
  function planFlowers() {
    const mountains = zones.filter((zn) => zn.type === 'mountain');
    const forests = zones.filter((zn) => zn.type === 'forest');
    if (!mountains.length) return;
    const toMountain = (x, z) => Math.min(...mountains.map((m) => rectDist(x, z, m)));
    const forestInfo = forests.map((f) => ({ f, d: Math.min(...mountains.map((m) => zoneGap(f, m))) }));
    if (forestInfo.length) {
      const nearest = Math.min(...forestInfo.map((o) => o.d));
      const limit = Math.max(230, nearest + 150);
      for (const { f, d } of forestInfo) {
        if (d > limit - 40) continue;
        const want = Math.round(lerp(9, 4, clamp01(d / 320)));
        let count = 0;
        for (let t = 0; t < 320 && count < want; t++) {
          const p = inZone(f, 26);
          if (toMountain(p.x, p.z) > limit) continue;
          const h = heightAt(p.x, p.z);
          if (h < 9 || h > 78 || slopeAt(p.x, p.z) > 0.45) continue;
          const rx = R(24, 36),
            rz = R(14, 22);
          const rr = Math.max(rx, rz) * 1.15;
          if (!isFree(p.x, p.z, rr * 0.8)) continue;
          const g = gradient(p.x, p.z);
          const ang = Math.atan2(g.gz, g.gx) + Math.PI / 2 + R(-0.25, 0.25); // 등고선을 따라 줄무늬
          plan.flowers.push({ kind: 'lavender', x: p.x, z: p.z, rx, rz, ang });
          plan.flowers.push({ kind: 'meadow', x: p.x, z: p.z, rx: rx * 1.75, rz: rz * 2.1, ang });
          take(p.x, p.z, rr * 0.9);
          blockTree(p.x, p.z, Math.max(rx, rz) * 1.25);
          count++;
        }
      }
    }
    // 산 아래쪽 비탈의 들꽃밭
    for (const m of mountains) {
      let count = 0;
      for (let t = 0; t < 260 && count < 4; t++) {
        const p = inZone(m, 30);
        const h = heightAt(p.x, p.z);
        if (h < 16 || h > 62 || slopeAt(p.x, p.z) > 0.4) continue;
        const rx = R(26, 38),
          rz = R(20, 30);
        if (!isFree(p.x, p.z, rx * 0.8)) continue;
        plan.flowers.push({ kind: 'meadow', x: p.x, z: p.z, rx, rz, ang: R(0, TAU) });
        take(p.x, p.z, rx * 0.7);
        blockTree(p.x, p.z, rx * 0.8);
        count++;
      }
    }
  }

  // ------------------------------------------------------------
  // 3) 숲: 언덕 위 전망대, 골짜기를 건너는 통나무 다리(+ 개울)
  // ------------------------------------------------------------
  function planForest() {
    for (const zn of zones.filter((z) => z.type === 'forest')) {
      // 전망대: 주변보다 볼록한 완만한 언덕 꼭대기
      let best = null;
      for (let t = 0; t < 200; t++) {
        const p = inZone(zn, 70);
        const f = flatness(p.x, p.z, 9);
        if (f.center < 9 || f.center > 95 || f.range > 7.5) continue;
        let ringMean = 0;
        for (let i = 0; i < 6; i++)
          ringMean += heightAt(p.x + Math.cos((i / 6) * TAU) * 26, p.z + Math.sin((i / 6) * TAU) * 26) / 6;
        const top = f.center - ringMean;
        if (top < 1.2 || !isFree(p.x, p.z, 22)) continue;
        const score = top - f.range * 2;
        if (!best || score > best.score) best = { ...p, y: f.mean, score };
      }
      if (best) {
        plan.towers.push({ x: best.x, z: best.z, y: best.y, yaw: R(0, TAU) });
        plan.flowers.push({ kind: 'meadow', x: best.x, z: best.z, rx: 26, rz: 22, ang: R(0, TAU) });
        addPad(best.x, best.z, best.y, 8);
        blockTree(best.x, best.z, 15);
        blockRing(best.x, best.z, 42);
        take(best.x, best.z, 24);
      }

      // 통나무 다리: 두 언덕 사이의 움푹한 골짜기
      let bridge = null;
      for (let t = 0; t < 420; t++) {
        const p = inZone(zn, 50);
        const h0 = heightAt(p.x, p.z);
        if (h0 < 9 || h0 > 95) continue;
        const a = R(0, TAU),
          dx = Math.cos(a),
          dz = Math.sin(a);
        let minH = h0,
          low = null,
          end = -1;
        for (let s = 10; s <= 72; s += 2) {
          const h = heightAt(p.x + dx * s, p.z + dz * s);
          if (h < minH) {
            minH = h;
            low = { x: p.x + dx * s, z: p.z + dz * s, h };
          }
          if (minH < h0 - 7 && h >= h0 - 2) {
            end = s;
            break;
          }
        }
        if (end < 0 || end < 20 || end > 62) continue;
        const ex = p.x + dx * end,
          ez = p.z + dz * end,
          h1 = heightAt(ex, ez);
        if (Math.abs(h1 - h0) > 4.5) continue;
        if (slopeAt(p.x, p.z) > 0.7 || slopeAt(ex, ez) > 0.7) continue;
        if (!isFree(p.x, p.z, 10) || !isFree(ex, ez, 10)) continue;
        const score = h0 - minH + R(0, 4);
        if (!bridge || score > bridge.score) bridge = { a: { x: p.x, z: p.z, y: h0 }, b: { x: ex, z: ez, y: h1 }, low, dx, dz, score };
      }
      // 자연 골짜기가 없으면 평탄한 숲 자리에 개울 골짜기를 직접 판다 (heightAt 이 gullies 를 읽어 깎는다)
      let carved = null;
      if (!bridge) {
        let bestC = null;
        for (let t = 0; t < 160; t++) {
          const p = inZone(zn, 80);
          const f = flatness(p.x, p.z, 30);
          if (f.center < 15 || f.center > 70 || f.range > 10 || !isFree(p.x, p.z, 36)) continue;
          if (!bestC || f.range < bestC.range) bestC = { ...p, range: f.range, y: f.mean };
        }
        if (bestC) {
          const a = R(0, TAU),
            dx = Math.cos(a),
            dz = Math.sin(a);
          const ax = bestC.x - dx * 24,
            az = bestC.z - dz * 24,
            bx = bestC.x + dx * 24,
            bz = bestC.z + dz * 24;
          const gl = { x: bestC.x, z: bestC.z, dx: -dz, dz: dx, halfLen: 72, w: 15, depth: 9 };
          plan.gullies.push(gl);
          bridge = { a: { x: ax, z: az, y: heightAt(ax, az) }, b: { x: bx, z: bz, y: heightAt(bx, bz) }, low: { x: bestC.x, z: bestC.z }, dx, dz };
          carved = gl;
        }
      }
      if (bridge && carved) {
        // 파낸 골짜기의 바닥선을 따라 개울
        const pts = [];
        for (let s = -62; s <= 62; s += 9) pts.push({ x: carved.x + carved.dx * s, z: carved.z + carved.dz * s });
        plan.logBridges.push({ a: bridge.a, b: bridge.b, creek: pts });
        take(bridge.a.x, bridge.a.z, 12);
        take(bridge.b.x, bridge.b.z, 12);
        take(carved.x, carved.z, 32);
        blockTree(bridge.a.x, bridge.a.z, 9);
        blockTree(bridge.b.x, bridge.b.z, 9);
        for (const p of pts) blockTree(p.x, p.z, 12);
      } else if (bridge) {
        // 개울: 골짜기 바닥에서 위쪽(상류)으로 곧게 + 아래쪽(하류)으로 비탈을 따라
        const px = -bridge.dz,
          pz = bridge.dx;
        const sign = heightAt(bridge.low.x + px * 30, bridge.low.z + pz * 30) > heightAt(bridge.low.x - px * 30, bridge.low.z - pz * 30) ? 1 : -1;
        const pts = [];
        for (let i = 4; i >= 1; i--) pts.push({ x: bridge.low.x + px * sign * i * 9, z: bridge.low.z + pz * sign * i * 9 });
        let cx = bridge.low.x,
          cz = bridge.low.z;
        pts.push({ x: cx, z: cz });
        for (let i = 0; i < 12; i++) {
          const g = gradient(cx, cz);
          const gl = Math.hypot(g.gx, g.gz);
          if (gl < 0.012) break;
          cx -= (g.gx / gl) * 8;
          cz -= (g.gz / gl) * 8;
          if (heightAt(cx, cz) < 4) break;
          pts.push({ x: cx, z: cz });
        }
        plan.logBridges.push({ a: bridge.a, b: bridge.b, creek: pts.length >= 5 ? pts : null });
        take(bridge.a.x, bridge.a.z, 12);
        take(bridge.b.x, bridge.b.z, 12);
        blockTree(bridge.a.x, bridge.a.z, 9);
        blockTree(bridge.b.x, bridge.b.z, 9);
        blockTree((bridge.a.x + bridge.b.x) / 2, (bridge.a.z + bridge.b.z) / 2, 16);
        for (const p of pts) blockTree(p.x, p.z, 5);
      }
    }
  }

  // ------------------------------------------------------------
  // 4) 산: 산장, 정상 십자가 + 깃발 줄, 돌탑 길, 케이블카
  // ------------------------------------------------------------
  function planMountain() {
    const mts = zones.filter((z) => z.type === 'mountain');
    for (const zn of mts) {
      // 산장: 산기슭의 완만한 자리(없으면 조금 넓혀서 다시)
      let best = null;
      for (let t = 0; t < 520; t++) {
        const p = inZone(zn, 50);
        const f = flatness(p.x, p.z, 15);
        const loose = t > 300 ? 6 : 0;
        if (f.center < 36 || f.center > 100 + loose * 3 || f.range > 11 + loose || !isFree(p.x, p.z, 30)) continue;
        const score = f.range + Math.abs(f.center - 62) * 0.05 + R(0, 1);
        if (!best || score < best.score) best = { ...p, y: f.mean, score };
      }
      if (best) {
        const g = gradient(best.x, best.z);
        const gl = Math.hypot(g.gx, g.gz);
        const yaw = gl > 0.02 ? Math.atan2(-g.gx / gl, -g.gz / gl) : R(0, TAU); // 정면 = 내리막(골짜기) 쪽
        plan.chalets.push({ x: best.x, z: best.z, y: best.y, yaw });
        // 산장 앞 고산 정원 (루핀/데이지/튤립)
        const fx = Math.sin(yaw),
          fz = Math.cos(yaw);
        for (const sd of [-1, 1])
          plan.flowers.push({ kind: 'garden', x: best.x + fx * 15 + fz * sd * 9, z: best.z + fz * 15 - fx * sd * 9, rx: R(6, 8), rz: R(3.5, 5), ang: yaw + Math.PI / 2 });
        plan.flowers.push({ kind: 'meadow', x: best.x + fx * 6, z: best.z + fz * 6, rx: 30, rz: 24, ang: yaw, sparse: true });
        addPad(best.x, best.z, best.y, 15, 0.96);
        blockTree(best.x, best.z, 26);
        blockRing(best.x, best.z, 45);
        take(best.x, best.z, 30);
      }

      // 정상: 가장 높은 곳에 십자가
      let top = null;
      for (let t = 0; t < 900; t++) {
        const p = inZone(zn, 24);
        const h = heightAt(p.x, p.z);
        if (!top || h > top.y) top = { ...p, y: h };
      }
      if (top && top.y > 90) {
        // 뾰족한 봉우리 끝을 평평하게 깎아 풍차 자리를 만든다
        const sy = top.y - 2.5;
        addPad(top.x, top.z, sy, 8, 1);
        plan.summits.push({ x: top.x, z: top.z, y: sy, yaw: R(0, TAU) });
        take(top.x, top.z, 26);
        blockRing(top.x, top.z, 40);
      }

      // 능선 돌탑 (사이사이 간격을 두고)
      let cairns = 0;
      for (let t = 0; t < 500 && cairns < 7; t++) {
        const p = inZone(zn, 20);
        const h = heightAt(p.x, p.z);
        if (h < 70 || h > 175 || slopeAt(p.x, p.z) > 0.85) continue;
        if (plan.cairns.some((c) => Math.hypot(c.x - p.x, c.z - p.z) < 42)) continue;
        if (!isFree(p.x, p.z, 8)) continue;
        plan.cairns.push({ x: p.x, z: p.z, y: h, s: R(1.1, 1.6), yaw: R(0, TAU) });
        cairns++;
        // 가끔 작은 돌탑 1~2개가 곁에 (일렬이 아니라 무리로)
        for (let k = 0, extra = rand() < 0.5 ? 1 + Math.floor(rand() * 2) : 0; k < extra; k++) {
          const a = R(0, TAU),
            r = R(5, 9);
          const qx = p.x + Math.cos(a) * r,
            qz = p.z + Math.sin(a) * r;
          if (slopeAt(qx, qz) > 0.9) continue;
          plan.cairns.push({ x: qx, z: qz, y: heightAt(qx, qz), s: R(0.7, 1.0), yaw: R(0, TAU) });
        }
      }
    }

    // 케이블카: 산 구역 하나에 (아래 정류장 -> 위 정류장), 케이블이 지형에서 충분히 떠 있어야 함
    for (const zn of shuffle(mts.slice())) {
      let found = null;
      for (let t = 0; t < 900 && !found; t++) {
        const a = inZone(zn, 40);
        const fa = flatness(a.x, a.z, 9);
        if (fa.center < 18 || fa.center > 130 || fa.range > (t > 400 ? 24 : 16) || !isFree(a.x, a.z, 14)) continue;
        const ang = R(0, TAU),
          len = R(150, 300);
        const bx = a.x + Math.cos(ang) * len,
          bz = a.z + Math.sin(ang) * len;
        if (bx < zn.min.x + 30 || bx > zn.max.x - 30 || bz < zn.min.z + 30 || bz > zn.max.z - 30) continue;
        const fb = flatness(bx, bz, 9);
        const rise = fb.center - fa.center;
        if (rise < 28 || rise > 200 || fb.range > (t > 400 ? 26 : 18) || !isFree(bx, bz, 14)) continue;
        const yA = fa.mean + 13,
          yB = fb.mean + 13;
        const nodes = [{ x: a.x, z: a.z, y: yA, ground: fa.mean }];
        for (const f of [1 / 3, 2 / 3]) {
          const x = lerp(a.x, bx, f),
            z = lerp(a.z, bz, f);
          const g = heightAt(x, z);
          nodes.push({ x, z, y: Math.max(lerp(yA, yB, f), g + 22), ground: g });
        }
        nodes.push({ x: bx, z: bz, y: yB, ground: fb.mean });
        let clear = Infinity;
        for (let i = 0; i < nodes.length - 1; i++)
          for (let s = 0; s <= 14; s++) {
            const f = s / 14;
            const x = lerp(nodes[i].x, nodes[i + 1].x, f),
              z = lerp(nodes[i].z, nodes[i + 1].z, f);
            clear = Math.min(clear, lerp(nodes[i].y, nodes[i + 1].y, f) - heightAt(x, z));
          }
        if (clear < 7) continue;
        found = { nodes, a: fa, b: fb, ax: a.x, az: a.z, bx, bz };
      }
      if (found) {
        plan.cableCars.push({ nodes: found.nodes });
        addPad(found.ax, found.az, found.a.mean, 10, 0.97);
        addPad(found.bx, found.bz, found.b.mean, 10, 0.97);
        for (const n of found.nodes) {
          blockTree(n.x, n.z, 12);
          blockRing(n.x, n.z, 40);
        }
        take(found.ax, found.az, 16);
        take(found.bx, found.bz, 16);
        break;
      }
    }
  }

  // ------------------------------------------------------------
  // 5) 협곡: 바위 아치(고원 위), 로프 현수교(협곡을 가로지름), 협곡 바닥 야영지
  // ------------------------------------------------------------
  function planCanyon() {
    for (const zn of zones.filter((z) => z.type === 'canyon')) {
      // 아치: 협곡 가장자리 가까운 평평한 고원. 열린 쪽은 협곡을 향함
      let arch = null;
      for (let t = 0; t < 360; t++) {
        const p = inZone(zn, 60);
        const f = flatness(p.x, p.z, 24);
        if (f.center < 78 || f.center > 110 || f.range > 5.5 || !isFree(p.x, p.z, 38)) continue;
        let drop = null;
        for (let i = 0; i < 12 && !drop; i++) {
          const a = (i / 12) * TAU;
          for (const s of [70, 105])
            if (heightAt(p.x + Math.cos(a) * s, p.z + Math.sin(a) * s) < 55) {
              drop = { x: Math.cos(a), z: Math.sin(a) };
              break;
            }
        }
        if (!drop) continue;
        const score = f.range + R(0, 1.5);
        if (!arch || score < arch.score) arch = { ...p, y: f.mean, drop, score };
      }
      if (arch) {
        plan.arches.push({ x: arch.x, z: arch.z, y: arch.y, yaw: Math.atan2(arch.drop.x, arch.drop.z) });
        addPad(arch.x, arch.z, arch.y, 36);
        blockRing(arch.x, arch.z, 75);
        take(arch.x, arch.z, 56);
        plan.arches[plan.arches.length - 1].s = ARCH_SCALE;
      }

      // 로프 현수교: 한쪽 벽에서 출발해 협곡을 가로지르는 곳 (깊을수록 점수가 높음)
      let rope = null;
      for (let t = 0; t < 700; t++) {
        const p = inZone(zn, 30);
        const h0 = heightAt(p.x, p.z);
        if (h0 < 62 || h0 > 100) continue;
        const a = R(0, TAU),
          dx = Math.cos(a),
          dz = Math.sin(a);
        let minH = h0,
          end = -1;
        for (let s = 24; s <= 150; s += 3) {
          const h = heightAt(p.x + dx * s, p.z + dz * s);
          if (h < minH) minH = h;
          if (minH < h0 - 28 && h >= h0 - 4) {
            end = s;
            break;
          }
        }
        if (end < 64 || end > 132) continue;
        const ex = p.x + dx * end,
          ez = p.z + dz * end,
          h1 = heightAt(ex, ez);
        if (Math.abs(h1 - h0) > 7 || slopeAt(p.x, p.z) > 0.9 || slopeAt(ex, ez) > 0.9) continue;
        if (!isFree(p.x, p.z, 12) || !isFree(ex, ez, 12)) continue;
        const score = h0 - minH - Math.abs(end - 95) * 0.15 + R(0, 10);
        if (!rope || score > rope.score) rope = { a: { x: p.x, z: p.z, y: h0 }, b: { x: ex, z: ez, y: h1 }, score };
      }
      if (rope) {
        plan.ropeBridges.push({ a: rope.a, b: rope.b });
        for (const e of [rope.a, rope.b]) {
          take(e.x, e.z, 14);
          blockRing(e.x, e.z, 40);
        }
        blockRing((rope.a.x + rope.b.x) / 2, (rope.a.z + rope.b.z) / 2, 36);
      }

      // 야영지: 협곡 바닥(또는 낮은 평지)에서 가장 평평한 곳
      let camp = null;
      for (let t = 0; t < 520; t++) {
        const p = inZone(zn, 40);
        const f = flatness(p.x, p.z, 11);
        const loose = t > 320 ? 1 : 0;
        if (f.center < 8 || f.center > (loose ? 70 : 42) || f.range > (loose ? 6 : 3.6) || !isFree(p.x, p.z, 16)) continue;
        const score = f.range + R(0, 0.8);
        if (!camp || score < camp.score) camp = { ...p, y: f.mean, score };
      }
      if (camp) {
        plan.camps.push({ x: camp.x, z: camp.z, y: camp.y, yaw: R(0, TAU) });
        addPad(camp.x, camp.z, camp.y, 10);
        blockRing(camp.x, camp.z, 36);
        take(camp.x, camp.z, 18);
      }
    }
  }

  // ------------------------------------------------------------
  // 6) 바다: 등대 2곳(해안에서 조금 떨어진 바위 위) + 부표 길(바깥바다로 이어지는 항로 표지)
  // ------------------------------------------------------------
  function planSea() {
    const base = R(0, TAU);
    const lightAngles = [];
    for (let k = 0; k < 2; k++) {
      const ang = base + k * Math.PI + R(-0.5, 0.5);
      const dx = Math.cos(ang),
        dz = Math.sin(ang);
      const rc = coastRadius(dx, dz);
      let spot = null;
      for (let t = 0; t < 80 && !spot; t++) {
        const r = rc + R(35, 150),
          side = R(-70, 70);
        const x = dx * r - dz * side,
          z = dz * r + dx * side;
        if (Math.max(Math.abs(x), Math.abs(z)) > HALF - 140) continue;
        const h = heightAt(x, z);
        if (h > -7 || h < -26 || !isFree(x, z, 36)) continue;
        spot = { x, z, y: h };
      }
      if (spot) {
        plan.lighthouses.push(spot);
        lightAngles.push(ang);
        take(spot.x, spot.z, 36);
        blockRing(spot.x, spot.z, 44);
      }
    }

    // 부표: 해안 바깥에 몇 무리로 흩어서 (줄이 아니라 느슨한 무리 + 외톨이). 빨강/하양 섞기
    const clusters = 5;
    for (let k = 0; k < clusters; k++) {
      const ang = base + Math.PI / 2 + (k * TAU) / clusters + R(-0.5, 0.5);
      if (lightAngles.some((la) => Math.abs(Math.atan2(Math.sin(ang - la), Math.cos(ang - la))) < 0.3)) continue;
      const dx = Math.cos(ang),
        dz = Math.sin(ang);
      const rc = coastRadius(dx, dz);
      const r0 = rc + R(60, 240);
      const lat0 = R(-30, 30);
      const cx = dx * r0 - dz * lat0,
        cz = dz * r0 + dx * lat0;
      const n = 3 + Math.floor(rand() * 4);
      const pts = [];
      for (let t = 0; t < 80 && pts.length < n; t++) {
        const a = R(0, TAU),
          rr = Math.sqrt(rand()) * 62;
        const x = cx + Math.cos(a) * rr,
          z = cz + Math.sin(a) * rr;
        if (Math.max(Math.abs(x), Math.abs(z)) > HALF - 90) continue;
        if (heightAt(x, z) > -4) continue;
        if (pts.some((p) => Math.hypot(p.x - x, p.z - z) < 20)) continue;
        pts.push({ x, z });
      }
      for (const p of pts) plan.buoys.push({ x: p.x, z: p.z, type: rand() < 0.5 ? 0 : 1, phase: R(0, TAU) });
    }
  }

  // ------------------------------------------------------------
  // 7) v3 추가: 설산(눈 덮인 침엽수/오두막/산정호수), 협곡(후두/사막식물/바위집/텀블위드), 바다(선박장+돛단배)
  // ------------------------------------------------------------
  const archSpots = () => plan.arches.map((a) => ({ x: a.x, z: a.z }));
  // 아치가 차지한 땅(take)은 후두/선인장 군락이 둘러싸야 하는 자리이므로 무시한다
  const isFreeExceptArches = (x, z, r) => {
    const ar = archSpots();
    return taken.every((t) => ar.some((a) => a.x === t.x && a.z === t.z) || Math.hypot(t.x - x, t.z - z) >= t.r + r);
  };
  const insideZone = (zn, x, z, m) => x > zn.min.x + m && x < zn.max.x - m && z > zn.min.z + m && z < zn.max.z - m;

  function planMountainSnow() {
    for (const zn of zones.filter((z) => z.type === 'mountain')) {
      // (1) 산정호수: 높고 평평한 곳. 높으면 얼어붙은 호수, 낮으면 푸른 물
      let best = null;
      for (let t = 0; t < 900; t++) {
        const p = inZone(zn, 55);
        const loose = t > 450 ? 1 : 0;
        const f = flatness(p.x, p.z, 26);
        if (f.center < 72 || f.center > 205 || f.range > (loose ? 18 : 8.5) || !isFree(p.x, p.z, 50)) continue;
        const score = f.range - f.center * 0.025 + R(0, 1.5);
        if (!best || score < best.score) best = { ...p, y: f.mean, hi: f.center, score };
      }
      let tarn = null;
      if (best) {
        tarn = { x: best.x, z: best.z, y: best.y - 0.5, r: R(17, 21), frozen: best.hi > 108, seed: Math.floor(R(1, 9999)) };
        plan.tarns.push(tarn);
        addPad(tarn.x, tarn.z, tarn.y, 28, 1);
        take(tarn.x, tarn.z, 50);
        blockTree(tarn.x, tarn.z, 56);
        blockRing(tarn.x, tarn.z, 60);
      }
      // (2) 오두막: 호숫가 2~3채 (호수 쪽을 보고, 굴뚝 연기) + 비탈 쉼터 1~2채
      const huts = [];
      const addHut = (x, z, y, yaw) => {
        plan.huts.push({ x, z, y, yaw, s: R(0.95, 1.2) });
        addPad(x, z, y, 8, 0.97);
        take(x, z, 14);
        blockTree(x, z, 18);
        blockRing(x, z, 34);
        huts.push({ x, z });
      };
      if (tarn) {
        const n = 2 + (rand() < 0.5 ? 1 : 0);
        const a0 = R(0, TAU);
        for (let k = 0, got = 0; k < 16 && got < n; k++) {
          const a = a0 + got * 2.1 + R(-0.45, 0.45) + (k > 6 ? k * 0.4 : 0);
          const d = tarn.r + R(15, 19);
          const x = tarn.x + Math.cos(a) * d,
            z = tarn.z + Math.sin(a) * d;
          if (!insideZone(zn, x, z, 20) || Math.abs(heightAt(x, z) - tarn.y) > 9 || slopeAt(x, z) > 0.8) continue;
          if (huts.some((h) => Math.hypot(h.x - x, h.z - z) < 22)) continue;
          addHut(x, z, tarn.y, Math.atan2(tarn.x - x, tarn.z - z));
          got++;
        }
      }
      for (let t = 0, got = 0; t < 420 && got < 2; t++) {
        const p = inZone(zn, 40);
        const f = flatness(p.x, p.z, 9);
        if (f.center < 78 || f.center > 170 || f.range > (t > 220 ? 9 : 6) || !isFree(p.x, p.z, 26)) continue;
        const g = gradient(p.x, p.z);
        const gl = Math.hypot(g.gx, g.gz);
        addHut(p.x, p.z, f.mean, gl > 0.02 ? Math.atan2(-g.gx / gl, -g.gz / gl) : R(0, TAU));
        got++;
      }
      // (3) 침엽수: 산 위쪽(눈선 아래~눈 덮인 사면)일수록 빽빽하다. 눈은 지형의 눈 경계(snowAt)를 그대로 따른다
      const up = (h) => sstep(80, 160, h); // 0 (낮은 기슭) ~ 1 (높은 사면)
      const centers = [];
      for (let t = 0; t < 1200 && centers.length < 14; t++) {
        const p = inZone(zn, 30);
        const h = heightAt(p.x, p.z);
        if (h < 62 || h > 205 || slopeAt(p.x, p.z) > 1.25 || !isFree(p.x, p.z, 16)) continue;
        if (rand() > 0.12 + 0.88 * up(h)) continue;
        if (centers.some((c) => Math.hypot(c.x - p.x, c.z - p.z) < 46)) continue;
        centers.push({ ...p, h });
      }
      const mine = [];
      for (const c of centers) {
        const n = Math.floor(R(8, 16) * (0.6 + 0.9 * up(c.h))),
          rad = R(22, 44);
        for (let i = 0; i < n; i++) {
          const a = R(0, TAU),
            rr = Math.sqrt(rand()) * rad;
          const x = c.x + Math.cos(a) * rr,
            z = c.z + Math.sin(a) * rr;
          if (!insideZone(zn, x, z, 14)) continue;
          const h = heightAt(x, z);
          if (h < 52 || h > 215 || !isFree(x, z, 5)) continue;
          const sn = snowAt(x, z);
          if (slopeAt(x, z) > 1.0 + 0.5 * up(h)) continue;
          if (sn > 0.93) continue; // 완전히 눈으로 덮인 곳에는 나무가 없다
          if (mine.some((q) => (q.x - x) * (q.x - x) + (q.z - z) * (q.z - z) < 36)) continue;
          mine.push({ x, z, y: h, s: R(0.85, 1.5) * (1 - 0.25 * Math.max(0, (h - 140) / 60)), yaw: R(0, TAU), snow: sn < 0.05 ? 0 : sn < 0.4 ? 1 : 2, v: Math.floor(rand() * 2) });
        }
      }
      plan.conifers.push(...mine);
    }
  }

  function planCanyonExtras() {
    for (const zn of zones.filter((z) => z.type === 'canyon')) {
      plan.tumble.push({ min: zn.min, max: zn.max });
      const arches = plan.arches.filter((a) => insideZone(zn, a.x, a.z, 0));
      const camps = plan.camps.filter((c) => insideZone(zn, c.x, c.z, 0));

      const v0first = rand() < 0.5;
      // 정교한 대형 바위 조형물: 쌍둥이 아치(v0) / 층층 메사와 첨탑(v1). 협곡 구역마다 최대 2개 (종류별 1개)
      for (const v of v0first ? [0, 1] : [1, 0]) {
        let best = null;
        for (let t = 0; t < 700; t++) {
          const p = inZone(zn, 70);
          const f = flatness(p.x, p.z, 30);
          if (f.center < 40 || f.center > 118 || f.range > (t > 350 ? 13 : 7.5) || !isFreeExceptArches(p.x, p.z, 50)) continue;
          if (arches.some((a2) => Math.hypot(a2.x - p.x, a2.z - p.z) < 100)) continue;
          const score = f.range + R(0, 2);
          if (!best || score < best.score) best = { ...p, y: f.mean, score };
        }
        if (best) {
          plan.rocks.push({ x: best.x, z: best.z, y: best.y, yaw: R(0, TAU), v, s: v ? 1.0 : 1.15 });
          addPad(best.x, best.z, best.y, 34);
          take(best.x, best.z, 50);
          blockTree(best.x, best.z, 50);
          blockRing(best.x, best.z, 80);
        }
      }

      // 후두(사암 기둥) 군락: 아치 둘레 + 고원 곳곳
      const hoodCluster = (cx, cz, n, rmin, rmax) => {
        for (let i = 0, got = 0; i < n * 6 && got < n; i++) {
          const a = R(0, TAU),
            r = R(rmin, rmax);
          const x = cx + Math.cos(a) * r,
            z = cz + Math.sin(a) * r;
          if (!insideZone(zn, x, z, 20)) continue;
          const h = heightAt(x, z);
          if (h < 14 || slopeAt(x, z) > 0.8 || !isFreeExceptArches(x, z, 4)) continue;
          if (plan.hoodoos.some((q) => Math.hypot(q.x - x, q.z - z) < 7)) continue;
          plan.hoodoos.push({ x, z, y: h, s: R(0.8, 1.7), yaw: R(0, TAU), v: Math.floor(rand() * 4) });
          got++;
        }
      };
      for (const a of arches) for (let k = 0; k < 2; k++) hoodCluster(a.x + R(-6, 6), a.z + R(-6, 6), Math.floor(R(3, 6)), 44 + k * 14, 70 + k * 18);
      for (let k = 0; k < 2; k++) {
        const p = inZone(zn, 60);
        if (heightAt(p.x, p.z) > 40 && slopeAt(p.x, p.z) < 0.5 && isFreeExceptArches(p.x, p.z, 20)) hoodCluster(p.x, p.z, Math.floor(R(3, 7)), 4, 26);
      }

      // 사막 식물 군락 (선인장꽃/노란 꽃): 아치 둘레, 야영지 곁, 고원
      const desertClump = (cx, cz, n, rad) => {
        for (let i = 0, got = 0; i < n * 5 && got < n; i++) {
          const a = R(0, TAU),
            r = Math.sqrt(rand()) * rad;
          const x = cx + Math.cos(a) * r,
            z = cz + Math.sin(a) * r;
          if (!insideZone(zn, x, z, 14)) continue;
          const h = heightAt(x, z);
          if (h < 8 || slopeAt(x, z) > 0.75 || !isFreeExceptArches(x, z, 1.5)) continue;
          if (arches.some((a2) => Math.hypot(a2.x - x, a2.z - z) < 40)) continue;
          const u = rand();
          const kind = u < 0.7 ? 'yellow' : 'sage';
          plan.desert.push({ kind, x, z, y: h, s: R(0.8, 1.35), yaw: R(0, TAU) });
          got++;
        }
      };
      for (const a of arches) for (let k = 0; k < 4; k++) {
        const ang = (k / 4) * TAU + R(-0.4, 0.4),
          d = R(46, 100);
        desertClump(a.x + Math.cos(ang) * d, a.z + Math.sin(ang) * d, Math.floor(R(6, 11)), R(9, 15));
      }
      for (const c of camps) for (let k = 0; k < 2; k++) {
        const ang = R(0, TAU);
        desertClump(c.x + Math.cos(ang) * 30, c.z + Math.sin(ang) * 30, 6, 11);
      }
      for (let k = 0; k < 2; k++) {
        const p = inZone(zn, 50);
        desertClump(p.x, p.z, Math.floor(R(6, 10)), 13);
      }

      // 절벽 중턱 바위집(카파도키아): 가파른 벽에 파고든 집들의 군락 + 메테오라식 첨탑집
      let clusters = 0;
      for (let t = 0; t < 2200 && clusters < 2; t++) {
        const p = inZone(zn, 40);
        const h = heightAt(p.x, p.z);
        const s = slopeAt(p.x, p.z);
        if (h < 22 || h > 88 || s < 0.7 || s > 2.4) continue;
        const g = gradient(p.x, p.z);
        const gl = Math.hypot(g.gx, g.gz);
        if (gl < 0.3) continue;
        const nx = -g.gx / gl,
          nz = -g.gz / gl; // 바깥(내리막) 방향
        if (heightAt(p.x + nx * 16, p.z + nz * 16) > h - 4 || heightAt(p.x - nx * 9, p.z - nz * 9) < h + 1.5) continue;
        if (!isFree(p.x, p.z, 22) || plan.rockHouses.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 70)) continue;
        const n = 2;
        let got = 0;
        for (let k = 0; k < 14 && got < n; k++) {
          const off = (got + (k > 5 ? 1 : 0)) * R(13, 19) * (k % 2 ? 1 : -1) * (got ? 1 : 0);
          const x = p.x - nz * off + R(-3, 3),
            z = p.z + nx * off + R(-3, 3);
          const y = heightAt(x, z);
          if (!insideZone(zn, x, z, 24) || slopeAt(x, z) < 0.45 || heightAt(x + nx * 14, z + nz * 14) > y - 2.5) continue;
          if (plan.rockHouses.some((q) => Math.hypot(q.x - x, q.z - z) < 12)) continue;
          // 집 앞에 평평한 선반(테라스)을 파 준다
          const lx = x + nx * 3.5,
            lz = z + nz * 3.5;
          const ly = y - 1.2;
          plan.rockHouses.push({ x: lx, z: lz, y: ly, yaw: Math.atan2(nx, nz), s: R(0.95, 1.3), v: 0 });
          addPad(lx, lz, ly, 6, 0.92);
          take(lx, lz, 12);
          blockTree(lx, lz, 20);
          blockRing(lx, lz, 40);
          got++;
        }
        if (got) clusters++;
      }
      for (let t = 0, got = 0; t < 600 && got < 1; t++) {
        const p = inZone(zn, 45);
        const f = flatness(p.x, p.z, 9);
        if (f.center < 24 || f.center > 80 || f.range > 4.5 || !isFree(p.x, p.z, 22)) continue;
        plan.rockHouses.push({ x: p.x, z: p.z, y: f.mean, yaw: R(0, TAU), s: R(1.1, 1.5), v: 1 });
        addPad(p.x, p.z, f.mean, 9, 0.95);
        take(p.x, p.z, 16);
        blockTree(p.x, p.z, 22);
        blockRing(p.x, p.z, 40);
        got++;
      }
    }
  }

  // 강철 케이블 현수교(두 번째 다리): 산의 골짜기를 가로지른다 (없으면 협곡)
  function planHangBridge() {
    const zs = [...shuffle(zones.filter((z) => z.type === 'mountain')), ...shuffle(zones.filter((z) => z.type === 'canyon'))];
    for (const zn of zs) {
      let best = null;
      for (let t = 0; t < 1200; t++) {
        const p = inZone(zn, 40);
        const h0 = heightAt(p.x, p.z);
        if (h0 < 45 || h0 > 150 || slopeAt(p.x, p.z) > 1.0) continue;
        const a = R(0, TAU),
          dx = Math.cos(a),
          dz = Math.sin(a);
        let minH = h0,
          end = -1;
        for (let st = 30; st <= 170; st += 4) {
          const h = heightAt(p.x + dx * st, p.z + dz * st);
          if (h < minH) minH = h;
          if (minH < h0 - 22 && h >= h0 - 5) {
            end = st;
            break;
          }
        }
        if (end < 70 || end > 150) continue;
        const ex = p.x + dx * end,
          ez = p.z + dz * end,
          h1 = heightAt(ex, ez);
        if (Math.abs(h1 - h0) > 8 || slopeAt(ex, ez) > 1.0 || !insideZone(zn, ex, ez, 20)) continue;
        if (!isFree(p.x, p.z, 16) || !isFree(ex, ez, 16)) continue;
        const score = h0 - minH - Math.abs(end - 105) * 0.2 + R(0, 8);
        if (!best || score > best.score) best = { a: { x: p.x, z: p.z, y: h0 }, b: { x: ex, z: ez, y: h1 }, score };
      }
      if (best) {
        plan.hangBridges.push({ a: best.a, b: best.b });
        for (const e of [best.a, best.b]) {
          addPad(e.x, e.z, e.y, 7, 0.95);
          take(e.x, e.z, 16);
          blockTree(e.x, e.z, 18);
          blockRing(e.x, e.z, 40);
        }
        blockRing((best.a.x + best.b.x) / 2, (best.a.z + best.b.z) / 2, 40);
        return;
      }
    }
  }

  // 바위집을 2채 덜어낸다 (선반 평탄화도 함께 취소)
  function trimRockHouses(n) {
    for (let k = 0; k < n; k++) {
      let i = -1;
      for (let j = plan.rockHouses.length - 1; j >= 0; j--) if (plan.rockHouses[j].v === 0) { i = j; break; }
      if (i < 0) return;
      const h = plan.rockHouses.splice(i, 1)[0];
      const pi = plan.pads.findIndex((p) => p.x === h.x && p.z === h.z);
      if (pi >= 0) plan.pads.splice(pi, 1);
    }
  }

  // 캠프파이어 추가: 숲/협곡의 평평한 빈터에 2곳
  function planExtraCamps() {
    const zs = shuffle(zones.filter((z) => z.type === 'forest' || z.type === 'canyon'));
    let added = 0;
    for (const zn of zs) {
      if (added >= 2) break;
      let camp = null;
      for (let t = 0; t < 700; t++) {
        const p = inZone(zn, 50);
        const f = flatness(p.x, p.z, 11);
        const hi = zn.type === 'forest' ? 60 : 42;
        if (f.center < 6 || f.center > hi || f.range > (t > 400 ? 5 : 3.2) || !isFree(p.x, p.z, 22)) continue;
        const score = f.range + R(0, 0.8);
        if (!camp || score < camp.score) camp = { ...p, y: f.mean, score };
      }
      if (!camp) continue;
      plan.camps.push({ x: camp.x, z: camp.z, y: camp.y, yaw: R(0, TAU) });
      addPad(camp.x, camp.z, camp.y, 10);
      blockTree(camp.x, camp.z, 20);
      blockRing(camp.x, camp.z, 36);
      take(camp.x, camp.z, 20);
      added++;
    }
  }

  // 선박장: 해변에서 바다로 뻗은 부두 + 보트하우스 + 돛단배들 (폭풍이 오면 부두로 귀항)
  function planHarbor() {
    const cands = [];
    for (let i = 0; i < 90; i++) {
      const ang = (i / 90) * TAU + R(-0.02, 0.02);
      const dx = Math.cos(ang),
        dz = Math.sin(ang);
      let r = 260;
      while (r < 1500 && heightAt(dx * r, dz * r) > 0.3) r += 5;
      if (r >= 1500) continue;
      const L = { x: dx * (r - 2), z: dz * (r - 2) };
      if (Math.max(Math.abs(L.x), Math.abs(L.z)) > HALF - 260) continue;
      const pierLen = 64;
      // 부두 레인 전체가 보트가 뜰 만큼 깊어야 한다
      let ok = true;
      for (let s = 10; s <= pierLen + 30 && ok; s += 6)
        for (const lat of [-6, 0, 6]) if (heightAt(L.x + dx * s - dz * lat, L.z + dz * s + dx * lat) > (s < 24 ? -1.2 : -2.4)) ok = false;
      if (!ok) continue;
      // 보트하우스 자리 (해변 위 평지, 부두 옆)
      let house = null;
      for (let t = 0; t < 40 && !house; t++) {
        const back = R(9, 20),
          lat = (rand() < 0.5 ? -1 : 1) * R(9, 16);
        const x = L.x - dx * back - dz * lat,
          z = L.z - dz * back + dx * lat;
        const f = flatness(x, z, 7);
        if (f.center < 0.8 || f.center > 12 || f.range > 4.5) continue;
        house = { x, z, y: Math.max(f.mean, 1.6), yaw: Math.atan2(dx, dz) };
      }
      if (!house || !isFree(L.x, L.z, 40)) continue;
      cands.push({ ang, dx, dz, L, pierLen, house });
    }
    shuffle(cands);
    const chosen = [];
    for (const c of cands) {
      if (chosen.length >= 2) break;
      if (chosen.some((h) => Math.abs(Math.atan2(Math.sin(h.ang - c.ang), Math.cos(h.ang - c.ang))) < 0.9)) continue;
      chosen.push(c);
    }
    const want = [6, 4];
    chosen.forEach((c, ci) => {
      const { dx, dz, L, pierLen } = c;
      const G = { x: L.x + dx * (pierLen + 26), z: L.z + dz * (pierLen + 26) };
      const waterOK = (x, z, d) => heightAt(x, z) < d && Math.max(Math.abs(x), Math.abs(z)) < HALF - 110;
      const boats = [];
      for (let t = 0; t < 260 && boats.length < want[ci]; t++) {
        const dist = R(55, 230),
          lat = R(-120, 120);
        const cx = L.x + dx * (pierLen + dist) - dz * lat,
          cz = L.z + dz * (pierLen + dist) + dx * lat;
        const a = R(34, 76),
          b = R(24, 48),
          rot = Math.atan2(dz, dx) + R(-0.9, 0.9);
        const ex = Math.cos(rot),
          ez = Math.sin(rot);
        const P = (th) => ({ x: cx + ex * a * Math.cos(th) - ez * b * Math.sin(th), z: cz + ez * a * Math.cos(th) + ex * b * Math.sin(th) });
        let ok = true;
        for (let k = 0; k < 28 && ok; k++) {
          const p = P((k / 28) * TAU);
          if (!waterOK(p.x, p.z, -5)) ok = false;
          for (let s = 1; s <= 10 && ok; s++) {
            const f = s / 10;
            if (!waterOK(lerp(p.x, G.x, f), lerp(p.z, G.z, f), -1.6)) ok = false;
          }
        }
        if (!ok || boats.some((o) => Math.hypot(o.cx - cx, o.cz - cz) < 34)) continue;
        boats.push({ cx, cz, a, b, rot, dir: rand() < 0.5 ? 1 : -1, spd: R(3.6, 5.6), phase: R(0, TAU), variant: boats.length % 3 });
      }
      if (!boats.length) return;
      plan.harbors.push({ x: L.x, z: L.z, dx, dz, yaw: Math.atan2(dx, dz), pierLen, house: c.house, boats });
      addPad(c.house.x, c.house.z, c.house.y, 8, 0.97);
      take(L.x, L.z, 30);
      take(L.x + dx * 40, L.z + dz * 40, 36);
      blockTree(c.house.x, c.house.z, 22);
      blockRing(L.x, L.z, 60);
      blockRing(L.x + dx * 50, L.z + dz * 50, 60);
    });
  }

  planVillages();
  planFlowers();
  planForest();
  planMountain();
  planCanyon();
  planSea();
  planMountainSnow();
  planCanyonExtras();
  trimRockHouses(2);
  planExtraCamps();
  planHangBridge();
  planHarbor();

  // 조형물 근처에는 나무를 심지 않고, 링도 만들지 않는다
  plan.blocksTree = (x, z) => treeCircles.some((c) => (c.x - x) * (c.x - x) + (c.z - z) * (c.z - z) < c.r * c.r);
  plan.blocksRing = (x, z) => ringCircles.some((c) => (c.x - x) * (c.x - x) + (c.z - z) * (c.z - z) < c.r * c.r);
  plan.zoneOf = zoneOf;
  plan.counts = () => ({
    villages: plan.villages.length,
    houses: plan.villages.reduce((n, v) => n + v.houses.length, 0),
    flowerPatches: plan.flowers.length,
    towers: plan.towers.length,
    logBridges: plan.logBridges.length,
    chalets: plan.chalets.length,
    summits: plan.summits.length,
    cairns: plan.cairns.length,
    cableCars: plan.cableCars.length,
    arches: plan.arches.length,
    ropeBridges: plan.ropeBridges.length,
    hangBridges: plan.hangBridges.length,
    camps: plan.camps.length,
    lighthouses: plan.lighthouses.length,
    buoys: plan.buoys.length,
    tarns: plan.tarns.length,
    frozenTarns: plan.tarns.filter((t) => t.frozen).length,
    huts: plan.huts.length,
    conifers: plan.conifers.length,
    hoodoos: plan.hoodoos.length,
    desert: plan.desert.length,
    rockHouses: plan.rockHouses.length,
    rocks: plan.rocks.length,
    harbors: plan.harbors.length,
    sailboats: plan.harbors.reduce((n, h) => n + h.boats.length, 0),
  });
  return plan;
}
