// ============================================================
// 파일명: Environment.js
// 담당자: 팀원 A(문선유) - 3D 그래픽
// 역할: 게임의 3D 환경과 시각적 요소를 생성한다.
// 구현할 기능:
// 1. 지형, 하늘, 구름, 조명을 만든다.
// 2. 링의 외형을 구현한다.
// 3. 그림자와 환경 효과를 추가한다.
// 4. 바다: 수심 기반 물 셰이더 (해안 거품, 밀려오는 파도선)
// 참고: 링 통과 판정은 RingSystem.js에서 담당한다.
// ============================================================

// 맵 크기
import { createPadTexture, createHMarkerTexture } from "./padTexture.js";

export const MAP_SIZE = 2000;
export const ZONE_GRID = 4;
export const ZONE_SIZE = MAP_SIZE / ZONE_GRID; // 500
const HALF = MAP_SIZE / 2;
const SEA_LEVEL = 0;

// 섬 윤곽: 사각형인 맵 중심에서 거리가 커질수록 섬이 더 바다로 가라앉는다.
// 윤곽은 노이즈로 경계가 흐릿해지고, 바깥은 섬(작은 섬들)이 있는 바다가 된다.
const ISLAND_COAST0 = 700; // 이 이후로는 해안으로 낮아지기 시작
const ISLAND_COAST1 = 860; // 이 이후로는 완전한 바다

// 시작과 착륙 위치
const START = { x: -250, z: -250, altitude: 120 }; // 지면 위 높이
const LANDING_PAD = { x: 250, z: 250, radius: 34, y: 12 };

// 구역 지형 배치 [z][x]
// 바다는 섬을 둘러싸도록 변경
// 네 모서리 구역은 바다만, 나머지 가장자리는 해안선(heightAt의 섬 윤곽)으로 바다와 이어진다.
export const ZONE_LAYOUT = [
  ["sea", "mountain", "canyon", "sea"],
  ["forest", "plain", "mountain", "canyon"],
  ["forest", "forest", "plain", "mountain"],
  ["sea", "forest", "plain", "sea"],
];

// ZONE_LAYOUT은 "클래식(고정) 배치"로 남겨 두고, 실제 게임에서는 시드마다 새로 만든 배치를 쓴다.
// createEnvironment()가 시작될 때 setWorldSeed()가 아래 값들을 갱신한다.
let ZONE_TYPES = ZONE_LAYOUT.flat();
let NOISE_SEED = 0; // 0이면 기존 지형과 완전히 같음 (hash2에 더해지는 값)
let CANYON_PHASE = 0; // 협곡 줄기 위치를 옮기는 값

// 지형 이름 설정
const ZONE_NAMES = {
  mountain: "산",
  forest: "숲",
  sea: "바다",
  canyon: "협곡",
  plain: "평원",
};

// 수학/노이즈 유틸
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function hash2(ix, iz) {
  // NOISE_SEED가 바뀌면 모든 노이즈(산 능선, 숲 구릉, 해안선, 섬 위치)가 통째로 달라진다
  let h =
    Math.imul(ix, 374761393) +
    Math.imul(iz, 668265263) +
    Math.imul(NOISE_SEED, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function valueNoise(x, z) {
  const x0 = Math.floor(x),
    z0 = Math.floor(z);
  const fx = x - x0,
    fz = z - z0;
  const u = fx * fx * (3 - 2 * fx),
    v = fz * fz * (3 - 2 * fz);
  return lerp(
    lerp(hash2(x0, z0), hash2(x0 + 1, z0), u),
    lerp(hash2(x0, z0 + 1), hash2(x0 + 1, z0 + 1), u),
    v,
  );
}

function fbm(x, z, oct = 4) {
  let sum = 0,
    amp = 0.5,
    total = 0,
    f = 1;
  for (let i = 0; i < oct; i++) {
    sum += amp * valueNoise(x * f, z * f);
    total += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / total; // 0 ~ 1
}

function ridged(x, z, oct = 5) {
  let sum = 0,
    amp = 0.5,
    total = 0,
    f = 1;
  for (let i = 0; i < oct; i++) {
    sum += amp * (1 - Math.abs(2 * valueNoise(x * f, z * f) - 1));
    total += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / total; // 0 ~ 1, 능선 형태
}

// 링 크기 -> RingSystem에 radius로 넘어감
export const RING_RADIUS = 22;
export const ACTIVE_RING_COLOR = "#58d8ff";
// 지역 발견 반지름 -> ExplorationSystem에 radius로 반영
export const REGION_RADIUS = 300;

// 링은 지형 4종에 4개씩(총 16개), 각 지형 구역 안에서 매번 랜덤하게 배치된다(난수)
export const RING_TERRAINS = ["mountain", "forest", "canyon", "sea"];
export const RINGS_PER_TERRAIN = 4;
const RING_CLEARANCE = { mountain: 90, forest: 55, canyon: 60, sea: 50 }; // 지형별 지면 위 높이
const RING_MIN_SPACING = 160; // 링 사이 최소 거리
const RING_EDGE_MARGIN = 50; // 구역 경계에서 떨어질 거리

// ------------------------------------------------------------
// 탐험(지도 공개) 설정
//  비행기가 "가까이" 지나간 곳만 회색조 -> 원래 색으로 서서히 공개된다 (안개가 걷히는 느낌).
//  공개 기록은 지도 전체를 REVEAL_GRID x REVEAL_GRID 칸으로 나눈 격자에 저장된다.
//  링은 점수/길잡이 역할만 하고 지형 공개에는 관여하지 않는다.
// ------------------------------------------------------------
const REVEAL_GRID = 128; // 공개 지도 해상도 (한 칸 = 2000 / 128 = 약 15.6)
// 비행기 바로 아래를 중심으로 한 "둥근 원": 안쪽(NEAR)은 완전히 밝고, 바깥(FAR)으로 갈수록 서서히 옅어진다.
const REVEAL_NEAR = 85; // 이 반경 안은 완전히 공개
const REVEAL_FAR = 250; // 이 반경 밖은 공개되지 않음 (그 사이는 바깥으로 갈수록 서서히 옅어짐)
const REVEAL_HEIGHT_FALLOFF = 700; // 지면 위 높이가 이만큼 커질수록 원이 작아진다 (낮게 날수록 잘 보임)
const REVEAL_MIN_SCALE = 0.45; // 아무리 높이 날아도 원 크기는 이 비율 밑으로 줄지 않음
const REVEAL_SPEED = 0.9; // 초당 공개 속도 (원 중심이 가장 빠르고 바깥은 느려서 원이 퍼지는 것처럼 보임)
const ZONE_DISCOVER_FRACTION = 0.25; // 구역의 25% 이상이 공개되면 그 구역을 "발견"으로 친다

// 지형 디테일 설정
const TERRAIN_SEGMENTS = 256; // 지형 격자 수
const TERRAIN_FLAT_SHADING = true; // 각진면
const DETAIL_TEXTURE_REPEAT = 60; // 지면 질감이 반복되는 횟수

// 구역 하나당 나무 배치 개수
const TREE_TRIES = {
  forest: 900,
  plain: 110,
  mountain: 240,
  canyon: 0,
  sea: 90,
};

// 미탐험 구역을 덮는 구름 베일 (탐험하면 걷힘)
const VEIL_ENABLED = true;
const VEIL_OPACITY = 0.5; // 0~1, 낮출수록 아래 지형이 더 비쳐 보임
const VEIL_COLOR = 0x5f6a79;
const VEIL_GRID = 4; // 구역당 구름 VEIL_GRID x VEIL_GRID개

// 이음새 없는 노이즈
function tileNoise(x, y, period) {
  const x0 = Math.floor(x),
    y0 = Math.floor(y);
  const fx = x - x0,
    fy = y - y0;
  const u = fx * fx * (3 - 2 * fx),
    v = fy * fy * (3 - 2 * fy);
  const w = (i) => ((i % period) + period) % period;
  return lerp(
    lerp(hash2(w(x0), w(y0)), hash2(w(x0 + 1), w(y0)), u),
    lerp(hash2(w(x0), w(y0 + 1)), hash2(w(x0 + 1), w(y0 + 1)), u),
    v,
  );
}

// 좌표를 노이즈로 비틂 -> 능선과 해안선 디테일 추가
const warpX = (x, z, s, amp) =>
  x + (fbm(x * s + 11.1, z * s + 3.3, 3) - 0.5) * amp;
const warpZ = (x, z, s, amp) =>
  z + (fbm(x * s + 5.7, z * s + 9.1, 3) - 0.5) * amp;

// 링 랜덤 배치로 변경
// export const RING_PATH = [
//   { x: -60, z: -170, clearance: 50 },
//   { x: 120, z: -250, clearance: 60 },
//   { x: 300, z: -300, clearance: 90 }, // 산
//   { x: 480, z: -480, clearance: 90 },
//   { x: 620, z: -700, clearance: 60 }, // 협곡
//   { x: 400, z: -800, clearance: 60 },
//   { x: 150, z: -650, clearance: 60 },
//   { x: -100, z: -700, clearance: 90 }, // 산
//   { x: -400, z: -450, clearance: 70 },
//   { x: -650, z: -200, clearance: 55 }, // 숲
//   { x: -700, z: 200, clearance: 55 },
//   { x: -400, z: 350, clearance: 55 },
//   { x: -100, z: 300, clearance: 50 },
//   { x: 150, z: 260, clearance: 40 }, // 착륙 지점 직전
// ];

// 좌표 주변 4개 구역 중심에 대한 보간 가중치 -> 구역 경계에서 지형이 부드럽게 이어짐
// band: 0.5면 부드럽게(높이용), 작을수록 경계가 또렷해짐(색상 공개용)
function cornerWeights(x, z, band) {
  const gx = (x + HALF) / ZONE_SIZE - 0.5;
  const gz = (z + HALF) / ZONE_SIZE - 0.5;
  let i0 = Math.floor(gx),
    j0 = Math.floor(gz);
  let fx = gx - i0,
    fz = gz - j0;
  if (band >= 0.5) {
    fx = fx * fx * (3 - 2 * fx);
    fz = fz * fz * (3 - 2 * fz);
  } else {
    fx = smooth(0.5 - band, 0.5 + band, fx);
    fz = smooth(0.5 - band, 0.5 + band, fz);
  }
  const cl = (v) => Math.min(ZONE_GRID - 1, Math.max(0, v));
  const i1 = cl(i0 + 1),
    j1 = cl(j0 + 1);
  i0 = cl(i0);
  j0 = cl(j0);
  const N = ZONE_GRID;
  return [
    [j0 * N + i0, (1 - fx) * (1 - fz)],
    [j0 * N + i1, fx * (1 - fz)],
    [j1 * N + i0, (1 - fx) * fz],
    [j1 * N + i1, fx * fz],
  ];
}

// 좌표가 속한 구역 index (맵 밖이면 -1)
function zoneIndexAt(x, z) {
  const c = Math.floor((x + HALF) / ZONE_SIZE);
  const r = Math.floor((z + HALF) / ZONE_SIZE);
  if (c < 0 || r < 0 || c >= ZONE_GRID || r >= ZONE_GRID) return -1;
  return r * ZONE_GRID + c;
}

const TYPE_HEIGHT = {
  // 평원: 완만한 언덕 + 작은 기복
  plain: (x, z) =>
    8 +
    fbm(x * 0.003, z * 0.003, 3) * 18 +
    (fbm(x * 0.015 + 3.1, z * 0.015 + 7.7, 3) - 0.5) * 5,
  // 숲: 구릉과 골짜기
  forest: (x, z) =>
    10 +
    fbm(x * 0.004, z * 0.004, 4) * 42 +
    (fbm(x * 0.014 + 8.2, z * 0.014 + 1.4, 3) - 0.5) * 9,
  // 바다: 해저 + 가끔 솟아오른 섬
  sea: (x, z) => {
    const floor = -35 + fbm(x * 0.005, z * 0.005, 3) * 14;
    const island =
      Math.max(0, fbm(x * 0.006 + 40, z * 0.006 + 40, 4) - 0.6) * 320;
    return floor + island;
  },
  // 산: 비틀린 능선 + 큰 산줄기 + 바위 표면의 잔 요철
  mountain: (x, z) => {
    const wx = warpX(x, z, 0.002, 260),
      wz = warpZ(x, z, 0.002, 260);
    const ridge = ridged(wx * 0.0045, wz * 0.0045, 6);
    const massif = fbm(x * 0.0015 + 2.2, z * 0.0015 + 8.8, 3); // 산줄기가 큰 곳/작은 곳
    const h = 30 + Math.pow(ridge, 1.8) * 345 * (0.5 + 0.8 * massif);
    return h + (fbm(x * 0.02, z * 0.02, 3) - 0.5) * 16;
  },
  // 협곡: 대지(메사) + 구불구불한 깊은 협곡 + 지류 + 지층 계단
  canyon: (x, z) => {
    let h = 85 + fbm(x * 0.006, z * 0.006, 3) * 16;
    const warp = fbm(x * 0.003 + 7.3, z * 0.003 + 1.9, 3) * 4;
    const main = Math.abs(
      Math.sin(x * 0.0055 + z * 0.002 + warp + CANYON_PHASE),
    );
    h -= 72 * (1 - smooth(0.0, 0.34, main)); // 큰 협곡
    const branch = Math.abs(
      Math.sin(x * 0.0021 - z * 0.0049 + warp * 1.7 + 2 + CANYON_PHASE * 1.3),
    );
    h -= 36 * (1 - smooth(0.0, 0.2, branch)); // 지류
    return lerp(h, Math.round(h / 9) * 9, 0.5); // 지층(계단) 느낌
  },
};

// 경사 = 기울기(높이 변화 / 거리)
function slopeAt(x, z) {
  const h = heightAt(x, z);
  return (
    (Math.abs(heightAt(x + 4, z) - h) + Math.abs(heightAt(x, z + 4) - h)) / 4
  );
}

function heightAt(x, z) {
  let h = 0;
  for (const [zi, w] of cornerWeights(x, z, 0.5)) {
    if (w < 1e-4) continue;
    h += w * TYPE_HEIGHT[ZONE_TYPES[zi]](x, z);
  }
  // 섬 윤곽: 해안에 가까워지면 먼저 낮고 완만한 해변으로, 그 너머는 바다(해저 + 작은 섬)로
  const dCoast = Math.pow(
    Math.pow(Math.abs(x), 4) + Math.pow(Math.abs(z), 4),
    0.25,
  );
  const coast = dCoast + (fbm(x * 0.0022 + 31, z * 0.0022 + 17, 3) - 0.5) * 420;
  if (h > 5)
    h = lerp(
      h,
      5,
      smooth(ISLAND_COAST0 - 120, ISLAND_COAST1 - 40, coast) * 0.9,
    );
  h = lerp(
    h,
    TYPE_HEIGHT.sea(x, z),
    smooth(ISLAND_COAST0, ISLAND_COAST1, coast),
  );

  // 착륙 지점 = 주변 평탄하게
  const d = Math.hypot(x - LANDING_PAD.x, z - LANDING_PAD.z);
  h = lerp(h, LANDING_PAD.y, 1 - smooth(45, 120, d));

  // 맵 가장자리는 바다로 가라앉힘
  const edge = Math.max(Math.abs(x), Math.abs(z));
  h = lerp(h, -40, smooth(HALF - 140, HALF, edge));
  return h;
}

// 지형 색상 (높이 + 지형 종류 + 경사)
function groundColor(THREE, h, slope, type, x, z, out, tmp) {
  const patch = fbm(x * 0.025 + 4.4, z * 0.025 + 9.9, 3); // 큰 얼룩 (0~1)
  const fine = fbm(x * 0.09 + 1.7, z * 0.09 + 6.1, 2); // 잔 얼룩
  const grain = (hash2(Math.round(x / 8), Math.round(z / 8)) - 0.5) * 0.06;
  const cliff = smooth(0.7, 1.3, slope); // 급경사일수록 1

  if (h < -2) {
    // 해저: 해안 모래색에서 시작해 깊어질수록 짙은 파랑으로 서서히 어두워진다
    out.setHex(0xbba871).lerp(tmp.setHex(0x1f4e6b), smooth(-2, -20, h));
  } else if (h < 4 + patch * 2.5) {
    out.setHex(0xe6d8a2).lerp(tmp.setHex(0xd2bf86), fine); // 모래 해안
    out.lerp(tmp.setHex(0xa8935c), (1 - smooth(-0.5, 1.8, h)) * 0.7); // 물가는 젖은 모래
  } else if (type === "mountain") {
    out.setHex(0x6b9a4d).lerp(tmp.setHex(0x55803f), patch); // 산기슭 초원
    out.lerp(tmp.setHex(0x8b8279), smooth(55, 130, h + (patch - 0.5) * 40)); // 바위
    out.lerp(tmp.setHex(0x6f675f), cliff * 0.7); // 절벽은 더 어두운 바위
    const snow = smooth(150, 215, h + (patch - 0.5) * 50) * (1 - cliff * 0.75);
    out.lerp(tmp.setHex(0xf5f8fb), snow); // 높은 곳은 눈 (가파른 면에는 쌓이지 않음)
  } else if (type === "forest") {
    out.setHex(0x4e8a3a).lerp(tmp.setHex(0x3f7a35), patch);
    out.lerp(tmp.setHex(0x7fae52), smooth(0.6, 0.8, fine) * 0.6); // 숲속 빈터
    out.lerp(tmp.setHex(0x7a6a4a), smooth(70, 130, h));
    out.lerp(tmp.setHex(0x6f675f), cliff * 0.5);
  } else if (type === "canyon") {
    const t = 0.5 + 0.5 * Math.sin(h * 0.45 + patch * 2); // 붉은 지층 줄무늬
    out.setHex(0xc8683c).lerp(tmp.setHex(0xe09a62), t);
    if (h > 78) out.lerp(tmp.setHex(0xcfa56a), 0.5);
    out.lerp(tmp.setHex(0x8e3f25), cliff * 0.6); // 협곡 벽은 더 어둡게
  } else if (type === "sea") {
    out.setHex(0x7cae58).lerp(tmp.setHex(0x4e8a3a), smooth(10, 35, h)); // 섬
  } else {
    out.setHex(0x8fbf5b).lerp(tmp.setHex(0x6fa04a), patch);
    out.lerp(tmp.setHex(0xb5b46a), smooth(0.62, 0.8, fine) * 0.5); // 마른 풀밭
    out.lerp(tmp.setHex(0x8b8279), cliff * 0.4);
  }
  out.offsetHSL(0, 0, grain);
}

// 지면 질감(색은 정점 색을 따르되 질감만 더해 준다): 밝은 회색, 이음새 x, 얼룩 무늬
function createDetailTexture(THREE) {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0,
        amp = 0.5,
        total = 0;
      for (const period of [8, 16, 32, 64]) {
        v += amp * tileNoise((x / size) * period, (y / size) * period, period);
        total += amp;
        amp *= 0.55;
      }
      const g = Math.round(205 + (v / total) * 50);
      data.set([g, g, g, 255], (y * size + x) * 4);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.repeat.set(DETAIL_TEXTURE_REPEAT, DETAIL_TEXTURE_REPEAT);
  tex.needsUpdate = true;
  return tex;
}

// 여러 지오메트리를 하나로 합친다 (여러 모양을 하나로 묶음)
function mergeGeometries(THREE, geos) {
  const parts = geos.map(
    (g) => (g.index ? g.toNonIndexed() : g).attributes.position.array,
  );
  const positions = new Float32Array(parts.reduce((n, a) => n + a.length, 0));
  let offset = 0;
  for (const a of parts) {
    positions.set(a, offset);
    offset += a.length;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  merged.computeVertexNormals();
  return merged;
}

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------
// 랜덤 구역 배치
//  - 네 모서리는 바다 고정 (섬 윤곽 / 바다 링 배치가 "모서리 = 바다"를 전제로 함)
//  - 시작 지점과 착륙 지점이 있는 구역은 평원 고정 (시작하자마자 산에 부딪히는 일 방지)
//  - 나머지 10칸: 산 / 숲 / 협곡이 최소 2칸씩(= 링 4개를 퍼뜨릴 수 있게) + 나머지는 랜덤
// ------------------------------------------------------------
const cellOf = (x, z) => [
  Math.floor((z + HALF) / ZONE_SIZE), // row
  Math.floor((x + HALF) / ZONE_SIZE), // col
];

function generateZoneLayout(rand) {
  const N = ZONE_GRID;
  const layout = Array.from({ length: N }, () => Array(N).fill("plain"));
  const fixed = new Set();
  const fix = (r, c, type) => {
    layout[r][c] = type;
    fixed.add(r * N + c);
  };
  for (const [r, c] of [
    [0, 0],
    [0, N - 1],
    [N - 1, 0],
    [N - 1, N - 1],
  ])
    fix(r, c, "sea");
  const [sr, sc] = cellOf(START.x, START.z);
  const [lr, lc] = cellOf(LANDING_PAD.x, LANDING_PAD.z);
  fix(sr, sc, "plain");
  fix(lr, lc, "plain");

  const slots = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) if (!fixed.has(r * N + c)) slots.push([r, c]);

  const bag = ["mountain", "mountain", "forest", "forest", "canyon", "canyon"];
  const extras = ["mountain", "forest", "canyon", "plain", "plain"];
  while (bag.length < slots.length)
    bag.push(extras[Math.floor(rand() * extras.length)]);
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  slots.forEach(([r, c], i) => (layout[r][c] = bag[i]));
  return layout;
}

// 시드를 정해서 이후 heightAt()/구역 종류가 모두 그 시드를 따르게 한다.
// classic = true면 기존 고정 지형 그대로
function setWorldSeed(seed, classic = false) {
  if (classic) {
    NOISE_SEED = 0;
    CANYON_PHASE = 0;
    ZONE_TYPES = ZONE_LAYOUT.flat();
    return;
  }
  NOISE_SEED = seed | 0;
  const rand = mulberry32(seed ^ 0x2545f491);
  CANYON_PHASE = rand() * Math.PI * 2;
  ZONE_TYPES = generateZoneLayout(rand).flat();
}

// 렌더러 설정 헬퍼: 그림자와 색 표현을 켠다 (GameScene에서 1회 호출)
export function configureRenderer(THREE, renderer) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // (PCFSoftShadowMap은 three r18x에서 제거됨)
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
}

export function createEnvironment(THREE, scene, options = {}) {
  // 환경 객체를 한 그룹에 모아 둔다 -> 나중에 정리(dispose)하기 쉽도록
  const root = new THREE.Group();
  root.name = "Environment";
  scene.add(root);

  let elapsed = 0; // 게임이 시작된 뒤 흐른 시간(초). 링 깜빡임 등에 사용
  let coverageTimer = 0; // 탐험률 재계산 주기

  // 월드 시드: options.seed를 주면 같은 맵(지형 + 링) / 없으면 매번 새로운 맵
  //  options.classic = true 이면 예전 고정 지형 (디버깅/비교용)
  const seed = options.seed ?? Math.floor(Math.random() * 2147483647);
  setWorldSeed(seed, options.classic);
  const ringRand = mulberry32(seed); // 링 배치용 난수

  const tmpColor = new THREE.Color(); // 색을 섞을 때 쓰는 임시 색 (groundColor에 전달)

  // 구역 상태 (탐험 연출용): p = 현재 밝기, target = 목표 밝기 (0 = 회색조, 1 = 원래색)
  const zones = ZONE_TYPES.map((type, index) => {
    const col = index % ZONE_GRID,
      row = Math.floor(index / ZONE_GRID);
    const minX = -HALF + col * ZONE_SIZE,
      minZ = -HALF + row * ZONE_SIZE;
    return {
      id: index + 1, // 1부터 시작
      index, // 0부터 시작
      col,
      row,
      type,
      name: ZONE_NAMES[type],
      min: { x: minX, z: minZ },
      max: { x: minX + ZONE_SIZE, z: minZ + ZONE_SIZE },
      center: { x: minX + ZONE_SIZE / 2, z: minZ + ZONE_SIZE / 2 },
      fraction: 0, // 구역 중 공개된 비율 (0~1)
      discovered: false, // fraction이 기준(ZONE_DISCOVER_FRACTION)을 넘어 "발견"되었는지
    };
  });

  const ease = (p) => p * p * (3 - 2 * p);

  // ---- 지도 공개 격자 ----
  const RG = REVEAL_GRID;
  const CELL = MAP_SIZE / RG;
  const CELLS_PER_ZONE = RG / ZONE_GRID;
  const revealData = new Float32Array(RG * RG); // 0~1, 한 번 공개되면 유지
  const flashData = new Float32Array(RG * RG); // 공개가 진행 중인 곳의 빛 (빠르게 사라짐)
  const cellGround = new Float32Array(RG * RG); // 칸 중심의 지면 높이 (바다는 수면)
  for (let iz = 0; iz < RG; iz++)
    for (let ix = 0; ix < RG; ix++)
      cellGround[iz * RG + ix] = Math.max(
        heightAt(-HALF + (ix + 0.5) * CELL, -HALF + (iz + 0.5) * CELL),
        SEA_LEVEL,
      );

  // 셰이더로 보내는 텍스처: R = 공개 정도, G = 공개 순간의 빛
  const revealTexData = new Uint8Array(RG * RG * 2);
  const revealTex = new THREE.DataTexture(
    revealTexData,
    RG,
    RG,
    THREE.RGFormat,
    THREE.UnsignedByteType,
  );
  revealTex.minFilter = revealTex.magFilter = THREE.LinearFilter;
  revealTex.wrapS = revealTex.wrapT = THREE.ClampToEdgeWrapping;
  revealTex.needsUpdate = true;
  const revealUniforms = {
    uRevealTex: { value: revealTex },
    uRevealInfo: { value: new THREE.Vector2(HALF, MAP_SIZE) }, // x: 맵 절반, y: 맵 크기
  };

  // 지형/나무/물 셰이더가 공통으로 쓰는 GLSL: 공개 정도를 읽고 색을 회색조 <-> 컬러로 바꾼다
  const REVEAL_GLSL = `
    uniform sampler2D uRevealTex;
    uniform vec2 uRevealInfo;
    float rvHash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    float rvNoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(rvHash(i), rvHash(i + vec2(1.0, 0.0)), f.x),
                 mix(rvHash(i + vec2(0.0, 1.0)), rvHash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    // x: 공개 정도(0~1, 가장자리를 노이즈로 흐트러뜨림), y: 공개 순간의 빛
    vec2 revealAt(vec2 xz) {
      vec2 t = texture2D(uRevealTex, (xz + uRevealInfo.x) / uRevealInfo.y).rg;
      float n = rvNoise(xz * 0.035) * 0.6 + rvNoise(xz * 0.11) * 0.4;
      float edge = 1.0 - abs(t.x * 2.0 - 1.0); // 경계(0.5 근처)에서만 노이즈가 작용
      float r = smoothstep(0.05, 0.95, clamp(t.x + (n - 0.5) * 0.22 * edge, 0.0, 1.0));
      return vec2(r, t.y);
    }
    vec3 revealColor(vec3 c, float rev, float flash) {
      float gray = dot(c, vec3(0.299, 0.587, 0.114));
      gray = mix(gray, 0.18, (1.0 - rev) * 0.4);
      float sat = rev * (1.0 + 0.18 * rev) + flash * 0.35;
      float k = mix(0.3, 1.04, rev) * (1.0 + 0.3 * flash);
      vec3 tint = vec3(mix(0.92, 1.0, rev), mix(0.97, 1.0, rev), mix(1.08, 1.0, rev));
      return max((vec3(gray) + (c - vec3(gray)) * sat) * tint * k, 0.0);
    }
  `;

  // MeshStandardMaterial(지형, 나무)에 공개 효과를 끼워 넣는다.
  // 월드 좌표(인스턴싱 포함)를 구해 공개 텍스처를 읽고, 색을 바꾼다.
  function applyReveal(material) {
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, revealUniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec2 vRevealXZ;",
        )
        .replace(
          "#include <project_vertex>",
          `#include <project_vertex>
           {
             vec4 rwp = vec4(transformed, 1.0);
             #ifdef USE_INSTANCING
             rwp = instanceMatrix * rwp;
             #endif
             vRevealXZ = (modelMatrix * rwp).xz;
           }`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec2 vRevealXZ;\n" + REVEAL_GLSL,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
           {
             vec2 rr = revealAt(vRevealXZ);
             diffuseColor.rgb = revealColor(diffuseColor.rgb, rr.x, rr.y);
           }`,
        );
    };
    material.customProgramCacheKey = () => "reveal-v1";
    return material;
  }

  // 월드 좌표의 공개 정도 (CPU용: 구름 베일 등)
  function revealAtXZ(x, z) {
    const ix = Math.min(RG - 1, Math.max(0, Math.floor((x + HALF) / CELL)));
    const iz = Math.min(RG - 1, Math.max(0, Math.floor((z + HALF) / CELL)));
    return revealData[iz * RG + ix];
  }

  // 비행기 주변 칸의 공개를 올린다: 가까울수록 높은 목표값, 목표를 향해 서서히 오른다.
  function stepReveal(delta, planePos) {
    let dirty = false;
    // 빛은 모든 칸에서 빠르게 사라진다
    const decay = Math.exp(-delta * 2.5);
    for (let i = 0; i < flashData.length; i++) {
      if (flashData[i] > 0.003) {
        flashData[i] *= decay;
        dirty = true;
      } else if (flashData[i] > 0) {
        flashData[i] = 0;
        dirty = true;
      }
    }
    if (planePos && delta > 0) {
      const px = planePos.x,
        pz = planePos.z,
        py = planePos.y;
      const cl = (v) => Math.min(RG - 1, Math.max(0, v));
      // 비행기 아래 지면 높이 -> 지면 위 높이가 클수록 원이 작아진다 (높이 날면 멀리 있는 땅은 흐릿하게 보임)
      const pgx = cl(Math.floor((px + HALF) / CELL));
      const pgz = cl(Math.floor((pz + HALF) / CELL));
      const above = Math.max(0, py - cellGround[pgz * RG + pgx]);
      const scale = Math.min(
        1.15,
        Math.max(REVEAL_MIN_SCALE, 1.15 - above / REVEAL_HEIGHT_FALLOFF),
      );
      const rNear = REVEAL_NEAR * scale;
      const rFar = REVEAL_FAR * scale;
      const ix0 = cl(Math.floor((px - rFar + HALF) / CELL));
      const ix1 = cl(Math.floor((px + rFar + HALF) / CELL));
      const iz0 = cl(Math.floor((pz - rFar + HALF) / CELL));
      const iz1 = cl(Math.floor((pz + rFar + HALF) / CELL));
      for (let iz = iz0; iz <= iz1; iz++)
        for (let ix = ix0; ix <= ix1; ix++) {
          const i = iz * RG + ix;
          const dx = -HALF + (ix + 0.5) * CELL - px;
          const dz = -HALF + (iz + 0.5) * CELL - pz;
          const d = Math.sqrt(dx * dx + dz * dz); // 수평 거리만 -> 지형 높낮이와 상관없이 둥근 원
          const target = 1 - smooth(rNear, rFar, d);
          const cur = revealData[i];
          if (target > cur + 1e-4) {
            // 중심에 가까울수록 빨리 채워진다 -> 가운데에서 바깥으로 번져 나가는 원
            const rate = REVEAL_SPEED * (0.3 + 0.7 * (1 - d / rFar)) * delta;
            revealData[i] = cur + Math.min(target - cur, rate);
            // 번져 나가는 가장자리는 살짝 빛난다
            flashData[i] = Math.max(
              flashData[i],
              0.55 * smooth(0.0, 0.5, target),
            );
            dirty = true;
          }
        }
    }
    if (dirty) uploadReveal();
  }

  function uploadReveal() {
    for (let i = 0; i < revealData.length; i++) {
      revealTexData[i * 2] = Math.round(revealData[i] * 255);
      revealTexData[i * 2 + 1] = Math.round(flashData[i] * 255);
    }
    revealTex.needsUpdate = true;
  }

  // 구역별 공개 비율 / 전체 탐험률 (0.25초마다 계산)
  let coverage = 0;
  const newlyDiscovered = [];
  function recomputeCoverage() {
    const counts = new Array(zones.length).fill(0);
    let total = 0;
    for (let iz = 0; iz < RG; iz++)
      for (let ix = 0; ix < RG; ix++) {
        if (revealData[iz * RG + ix] < 0.5) continue; // 절반 이상 공개된 칸만 "탐험"으로 센다
        total++;
        counts[
          Math.floor(iz / CELLS_PER_ZONE) * ZONE_GRID +
            Math.floor(ix / CELLS_PER_ZONE)
        ]++;
      }
    coverage = total / (RG * RG);
    zones.forEach((z, i) => {
      z.fraction = counts[i] / (CELLS_PER_ZONE * CELLS_PER_ZONE);
      if (!z.discovered && z.fraction >= ZONE_DISCOVER_FRACTION) {
        z.discovered = true;
        newlyDiscovered.push(z);
      }
    });
  }

  // 1. 하늘 + 안개
  const SUN_OFFSET = new THREE.Vector3(420, 640, 260); // 비행기 기준 태양 위치
  const sunDir = SUN_OFFSET.clone().normalize();
  const horizonColor = new THREE.Color(0xcfe6f7);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(3000, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x3d86d8) },
        horizonColor: { value: horizonColor },
        sunDir: { value: sunDir },
      },
      vertexShader: `
                varying vec3 vDir;
                void main() {
                    vDir = normalize(position);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }`,
      fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 horizonColor;
                uniform vec3 sunDir;
                varying vec3 vDir;
                void main() {
                    float h = clamp(vDir.y, 0.0, 1.0);
                    vec3 col = mix(horizonColor, topColor, pow(h, 0.55));
                    float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
                    col += vec3(1.0, 0.92, 0.75) * (pow(s, 700.0) * 1.6 + pow(s, 14.0) * 0.2);
                    gl_FragColor = vec4(col, 1.0);
                    #include <tonemapping_fragment>
                    #include <colorspace_fragment>
                }`,
    }),
  );
  sky.renderOrder = -1;
  root.add(sky);

  scene.background = horizonColor.clone();
  scene.fog = new THREE.Fog(horizonColor, 500, 3000);

  // 2. 조명 + 그림자
  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x6b5a3c, 0.9);
  root.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
  sun.position.copy(SUN_OFFSET);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -220;
  sc.right = 220;
  sc.top = 220;
  sc.bottom = -220;
  sc.near = 10;
  sc.far = 1800;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  root.add(sun);
  root.add(sun.target);

  // 3. 지형
  const SEG = TERRAIN_SEGMENTS; // SEG x SEG 칸
  const spacing = MAP_SIZE / SEG; // 정점 간격
  const terrainGeo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, SEG, SEG);
  terrainGeo.rotateX(-Math.PI / 2); // 눕혀서 바닥으로
  const pos = terrainGeo.attributes.position;
  const baseColors = new Float32Array(pos.count * 3);
  const c1 = new THREE.Color();

  // 1) 모든 정점의 높이를 먼저 정한다
  const heights = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    heights[i] = heightAt(pos.getX(i), pos.getZ(i));
    pos.setY(i, heights[i]);
  }

  // 2) 높이와 경사(이웃 정점과의 높이 차)로 색을 정한다
  const row = SEG + 1;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      z = pos.getZ(i);
    const h = heights[i];
    const ix = i % row,
      iy = Math.floor(i / row);
    const left = heights[iy * row + Math.max(0, ix - 1)];
    const right = heights[iy * row + Math.min(SEG, ix + 1)];
    const up = heights[Math.max(0, iy - 1) * row + ix];
    const down = heights[Math.min(SEG, iy + 1) * row + ix];
    const slope = Math.hypot(
      (right - left) / (2 * spacing),
      (down - up) / (2 * spacing),
    );

    // 구역 경계에서는 이웃 지형의 색과 부드럽게 섞는다
    let r = 0,
      g = 0,
      b = 0,
      wsum = 0;
    for (const [zi, w] of cornerWeights(x, z, 0.5)) {
      if (w < 0.08) continue;
      groundColor(THREE, h, slope, ZONE_TYPES[zi], x, z, c1, tmpColor);
      r += c1.r * w;
      g += c1.g * w;
      b += c1.b * w;
      wsum += w;
    }
    baseColors.set([r / wsum, g / wsum, b / wsum], i * 3);
  }
  // 정점 색은 "원래 색" 그대로 둔다. 회색조 <-> 컬러는 공개 텍스처를 읽는 셰이더(applyReveal)가 처리한다.
  terrainGeo.setAttribute("color", new THREE.BufferAttribute(baseColors, 3));
  terrainGeo.computeVertexNormals(); // 높이가 바뀌었으니 음영 재계산

  const detailTex = createDetailTexture(THREE);
  const terrain = new THREE.Mesh(
    terrainGeo,
    applyReveal(
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        map: detailTex, // 지면 질감
        flatShading: TERRAIN_FLAT_SHADING,
        roughness: 0.95,
        metalness: 0,
      }),
    ),
  );

  terrain.receiveShadow = true;
  terrain.castShadow = true;
  root.add(terrain);

  // 바다: 지형 높이를 텍스처로 만들어 물 셰이더가 "수심"을 인식하도록
  //    얕을수록 청록 + 투명, 해안/섬 가장자리에는 밀려왔다 빠지는 흰 거품과 파도선이 생긴다.
  //    (지형 메시의 정점 높이를 그대로 사용)
  const heightData = new Uint16Array(row * row);
  for (let i = 0; i < heightData.length; i++)
    heightData[i] = THREE.DataUtils.toHalfFloat(heights[i]);
  const heightTex = new THREE.DataTexture(
    heightData,
    row,
    row,
    THREE.RedFormat,
    THREE.HalfFloatType,
  );
  heightTex.minFilter = heightTex.magFilter = THREE.LinearFilter;
  heightTex.needsUpdate = true;

  const waterTime = { value: 0 };

  const WATER_COMMON = `
    uniform sampler2D uHeightTex;
    uniform vec3 uHeightInfo; // x: 맵 절반 크기, y: 정점 간격, z: 격자 칸 수 + 1
    float sampleH(vec2 xz) {
      vec2 uv = ((xz + uHeightInfo.x) / uHeightInfo.y + 0.5) / uHeightInfo.z;
      return texture2D(uHeightTex, uv).r;
    }
  `;

  const waterVertex = `
    uniform float uTime;
    uniform float uWaveAmp;
    varying vec3 vWorld;
    // varying vec3 vNormalW;
    ${WATER_COMMON}
    #include <fog_pars_vertex>

    float waveH(vec2 p, float t) {
      return sin(p.x * 0.045 + t * 1.3) * 0.6
           + cos(p.y * 0.05 + t * 1.0) * 0.5
           + sin((p.x + p.y) * 0.09 + t * 1.9) * 0.25;
    }
           
    // vec2 waveGrad(vec2 p, float t) {
    //   float a = cos((p.x + p.y) * 0.09 + t * 1.9) * 0.25 * 0.09;
    //   return vec2(cos(p.x * 0.045 + t * 1.3) * 0.6 * 0.045 + a,
    //               -sin(p.y * 0.05 + t * 1.0) * 0.5 * 0.05 + a);
    // }

    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      float depth = -sampleH(wp.xz);
      float edge = max(abs(wp.x), abs(wp.z));
      // 얕은 곳과 맵 가장자리에서는 파도를 줄여 지형을 뚫지 않고 바깥 바다와 매끄럽게 이어지게 한다
      float damp = uWaveAmp * (0.25 + 0.75 * smoothstep(0.0, 8.0, depth))
                 * (1.0 - smoothstep(uHeightInfo.x - 80.0, uHeightInfo.x, edge));
      wp.y += waveH(wp.xz, uTime) * damp;
      // vec2 g = waveGrad(wp.xz, uTime) * damp;
      // vNormalW = normalize(vec3(-g.x, 1.0, -g.y));
      vWorld = wp.xyz;
      vec4 mvPosition = viewMatrix * wp;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }
  `;

  const waterFragment = `
    uniform float uTime;
    uniform vec3 uShallow;
    uniform vec3 uDeep;
    uniform vec3 uSky;
    uniform vec3 uAbyss; // 맵에서 아주 먼 바다(배경) 색: 어두운 심해
    uniform vec3 uSunDir;
    uniform sampler2D uRevealTex; // 탐험 공개 텍스처 (R: 공개 정도, G: 빛)
    uniform vec2 uRevealInfo;
    uniform float uOpaque;
    varying vec3 vWorld;
    // varying vec3 vNormalW;
    ${WATER_COMMON}
    #include <fog_pars_fragment>

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    // 큰 파도의 기울기. 정점이 아니라 픽셀마다 계산해서 맵 안쪽과 바깥 바다가 똑같이 일렁이는 것처럼 보이게 한다.
    vec2 waveGrad(vec2 p, float t) {
      float a = cos((p.x + p.y) * 0.09 + t * 1.9) * 0.25 * 0.09;
      return vec2(cos(p.x * 0.045 + t * 1.3) * 0.6 * 0.045 + a,
                  -sin(p.y * 0.05 + t * 1.0) * 0.5 * 0.05 + a);
    }

    float vnoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
                 mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
    }

    // 탐험 연출 색 변환 
    vec3 revealTint(vec3 c, float rev, float flash) {
      float g = dot(c, vec3(0.299, 0.587, 0.114));
      g = mix(g, 0.18, (1.0 - rev) * 0.4);
      float sat = rev * (1.0 + 0.18 * rev) + flash * 0.35;
      float k = mix(0.3, 1.04, rev) * (1.0 + 0.3 * flash);
      vec3 cold = mix(vec3(0.92, 0.97, 1.08), vec3(1.0), rev);
      return max((vec3(g) + (c - vec3(g)) * sat) * cold * k, 0.0);
    }

    void main() {
      vec2 xz = vWorld.xz;
      float depth = -sampleH(xz); // 수심 (0이면 해안선, 음수면 육지)

      float n  = vnoise(xz * 0.07 + uTime * 0.05);
      float n2 = vnoise(xz * 0.25 + 7.3 - uTime * 0.09);
      float n3 = vnoise(xz * 0.23 - 3.1 + uTime * 0.11);

      // 잔물결
      vec2 g = waveGrad(xz, uTime) * (0.25 + 0.75 * smoothstep(0.0, 8.0, depth));
      vec3 N = normalize(vec3(-g.x, 1.0, -g.y) + vec3((n2 - 0.5) * 0.3, 0.0, (n3 - 0.5) * 0.3));
      vec3 V = normalize(cameraPosition - vWorld);
      float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);

      // 물 색: 얕은 곳은 청록, 깊은 곳은 짙은 파랑, 비스듬히 볼수록 하늘색 반사
      // 깊어질수록 지수 곡선으로 짙어진다
      vec3 col = mix(uShallow, uDeep, 1.0 - exp(-max(depth, 0.0) / 18.0));
      col = mix(col, uSky, fres * 0.55);
      vec3 R = reflect(-uSunDir, N);
      col += vec3(1.0, 0.95, 0.8) * pow(max(dot(R, V), 0.0), 120.0) * 0.9;

      // 해안 거품: 파도가 해안으로 밀려왔다 빠지며 거품 폭이 출렁인다
      float d = depth + (n - 0.5) * 1.2; // 거품 가장자리를 들쭉날쭉하게
      float swash = 0.5 + 0.5 * sin(depth * 0.55 + uTime * 1.15 + n * 2.5);
      float reach = 1.0 + swash * 3.0;
      float shoreFoam = 1.0 - smoothstep(reach * 0.35, reach, d);
      // 해안으로 다가오는 파도선 (깊은 곳 -> 얕은 곳으로 이동)
      float crest = sin(depth * 0.75 + uTime * 1.15 + n * 3.0);
      float crestLine = smoothstep(0.82, 0.98, crest)
                      * smoothstep(1.5, 3.0, depth)
                      * (1.0 - smoothstep(3.0, 9.0, depth));
      float foamTex = smoothstep(0.35, 0.65, vnoise(xz * 0.5 + uTime * 0.15));
      float foam = clamp(shoreFoam * (0.55 + 0.45 * foamTex) + crestLine * 0.55 * foamTex, 0.0, 1.0);
      col = mix(col, vec3(1.0), foam);

      float alpha = mix(0.58, 0.96, smoothstep(0.0, 14.0, depth));
      alpha = max(alpha, foam * 0.95);
      alpha = mix(alpha, 1.0, uOpaque);

      // 맵 가장자리로 갈수록 불투명
      // 맵 경계의 해저가 비쳐 보이지 않고 바깥 바다와 같은 색으로 이어지도록 수정
      float edgeDist = max(abs(xz.x), abs(xz.y));
      alpha = mix(alpha, 1.0, smoothstep(uHeightInfo.x - 120.0, uHeightInfo.x - 30.0, edgeDist));

      // 지형과 같은 방식으로, 비행기가 가까이 지나간 곳의 물만 서서히 색이 돌아온다
      vec2 rt = texture2D(uRevealTex, (xz + uRevealInfo.x) / uRevealInfo.y).rg;
      float rn = vnoise(xz * 0.035) * 0.6 + vnoise(xz * 0.11) * 0.4;
      float redge = 1.0 - abs(rt.x * 2.0 - 1.0);
      float rv = smoothstep(0.05, 0.95, clamp(rt.x + (rn - 0.5) * 0.22 * redge, 0.0, 1.0));

      // 맵 바깥 바다: 맵 가장자리에서의 거리(dOut)에 따라
      //  가까운 쪽 = 미탐험이라 회색조(맵 안쪽과 똑같은 색이라 경계가 안 보임)
      //  먼 쪽     = 배경으로 취급해 어두운 심해색으로 서서히 이어짐
      float dOut = length(max(abs(xz) - vec2(uHeightInfo.x), 0.0));
      float bg = smoothstep(120.0, 1500.0, dOut);
      rv *= 1.0 - smoothstep(40.0, 500.0, dOut); // 공개된 밝기도 바깥으로 갈수록 옅어짐
      col = revealTint(col, rv, rt.y);
      col = mix(col, uAbyss, bg);

      gl_FragColor = vec4(col, alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      // 안개: 심해 배경은 안개에 덜 묻히게(가까운 곳은 어둡게 유지), 아주 먼 수평선에서는 하늘과 자연스럽게 이어진다
      #ifdef USE_FOG
        float fogT = smoothstep(fogNear, fogFar, vFogDepth);
        float keepDark = bg * (1.0 - smoothstep(1100.0, 3000.0, vFogDepth));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogT * (1.0 - 0.8 * keepDark));
      #endif
    }
  `;

  function makeWaterMaterial({ inside }) {
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog]);
    Object.assign(uniforms, {
      uTime: waterTime,
      uWaveAmp: { value: inside ? 1.0 : 0.0 },
      uHeightTex: { value: heightTex },
      uHeightInfo: { value: new THREE.Vector3(HALF, spacing, row) },
      uShallow: { value: new THREE.Color(0x45aee8) },
      uDeep: { value: new THREE.Color(0x17608f) },
      uSky: { value: horizonColor },
      uAbyss: { value: new THREE.Color(0x0b2a4c) }, // 어두운 심해색
      uSunDir: { value: sunDir },
      uRevealTex: revealUniforms.uRevealTex,
      uRevealInfo: revealUniforms.uRevealInfo,
      uOpaque: { value: inside ? 0 : 1 },
    });
    return new THREE.ShaderMaterial({
      uniforms,
      vertexShader: waterVertex,
      fragmentShader: waterFragment,
      transparent: true,
      depthWrite: false,
      fog: true,
    });
  }

  // 맵 안쪽 수면: 맵 전체를 덮는 한 장 (구역 사이 이음새 없음)
  const waterMat = makeWaterMaterial({ inside: true }); // 인자 추가
  const waterMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, 250, 250).rotateX(-Math.PI / 2),
    waterMat,
  );
  waterMesh.position.y = SEA_LEVEL;
  waterMesh.renderOrder = -1; // 수면 위의 구름/베일/링보다 먼저 그린다
  waterMesh.frustumCulled = false;
  root.add(waterMesh);

  // 맵 바깥: 바다로 계속 이어진다 (맵 영역은 뚫려 있어 해저가 가려지지 않음)
  const outerShape = new THREE.Shape();
  const OH = 7000;
  outerShape.moveTo(-OH, -OH);
  outerShape.lineTo(OH, -OH);
  outerShape.lineTo(OH, OH);
  outerShape.lineTo(-OH, OH);
  outerShape.closePath();
  const hole = new THREE.Path();
  const OUTER_OVERLAP = 30;
  const HH = HALF - OUTER_OVERLAP;
  hole.moveTo(-HH, -HH);
  hole.lineTo(-HH, HH);
  hole.lineTo(HH, HH);
  hole.lineTo(HH, -HH);
  hole.closePath();
  outerShape.holes.push(hole);
  const outerSeaMesh = new THREE.Mesh(
    new THREE.ShapeGeometry(outerShape).rotateX(-Math.PI / 2),
    makeWaterMaterial({ inside: false }),
  );

  outerSeaMesh.position.y = SEA_LEVEL; // 같은 높이
  outerSeaMesh.renderOrder = -2; // 안쪽 수면(-1)보다 먼저 그림
  outerSeaMesh.frustumCulled = false;
  root.add(outerSeaMesh);

  // 나무
  // 구역마다 InstancedMesh로 한꺼번에 그린다
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 4, 5).translate(
    0,
    2,
    0,
  );
  const pineGeo = mergeGeometries(THREE, [
    new THREE.ConeGeometry(4.4, 9, 7).translate(0, 7.5, 0),
    new THREE.ConeGeometry(3.2, 7, 7).translate(0, 12.5, 0),
  ]);
  const roundGeo = new THREE.IcosahedronGeometry(3.4, 0).translate(0, 7, 0);
  const matrixDummy = new THREE.Object3D();
  const toneColor = new THREE.Color();

  function makeInstances(geometry, material, spots) {
    if (!spots.length) return;
    const mesh = new THREE.InstancedMesh(geometry, material, spots.length);
    spots.forEach((s, i) => {
      matrixDummy.position.set(s.x, s.y, s.z);
      matrixDummy.rotation.set(0, s.ry, 0);
      matrixDummy.scale.set(s.sx, s.sy, s.sz);
      matrixDummy.updateMatrix();
      mesh.setMatrixAt(i, matrixDummy.matrix);
      mesh.setColorAt(i, toneColor.setScalar(s.tone)); // 개체마다 밝기를 조금씩 다르게
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    root.add(mesh);
  }

  // 나무가 모여 있는 정도
  function vegetationMask(type, x, z) {
    const n = fbm(x * 0.012 + 20, z * 0.012 + 20, 3);
    if (type === "forest") return 0.25 + 0.75 * smooth(0.35, 0.55, n);
    if (type === "plain") return smooth(0.58, 0.7, n);
    if (type === "mountain") return 0.5 * smooth(0.4, 0.6, n);
    return 1; // 섬
  }

  // 나무 재질은 구역과 상관없이 공유한다 (공개 효과는 셰이더가 위치로 판단)
  const treeMat = (hex) =>
    applyReveal(
      new THREE.MeshStandardMaterial({
        color: hex,
        roughness: 0.9,
        flatShading: true,
      }),
    );
  const trunkMat = treeMat(0x6b4a2b);
  const pineMat = treeMat(0x2f7d3a);
  const roundMat = treeMat(0x5f9a3c);

  zones.forEach((z) => {
    const rand = mulberry32(1234 + z.index * 97 + NOISE_SEED);
    const trunks = [],
      pines = [],
      rounds = [];
    const hMax = z.type === "sea" ? 45 : 115;

    for (let t = 0; t < TREE_TRIES[z.type]; t++) {
      const x = lerp(z.min.x + 8, z.max.x - 8, rand());
      const zz = lerp(z.min.z + 8, z.max.z - 8, rand());
      const h = heightAt(x, zz);
      if (h < 5 || h > hMax) continue;
      if (slopeAt(x, zz) > 0.75) continue; // 가파른 곳에는 나무가 자라지 않음
      if (rand() > vegetationMask(z.type, x, zz)) continue;
      if (
        Math.hypot(x - LANDING_PAD.x, zz - LANDING_PAD.z) <
        LANDING_PAD.radius + 30
      )
        continue;
      if (Math.hypot(x - START.x, zz - START.z) < 25) continue;

      const s = 0.8 + rand() * 0.9;
      const ry = rand() * Math.PI * 2;
      const tone = 0.82 + rand() * 0.3;
      const base = { x, y: h, z: zz, ry, tone };
      trunks.push({ ...base, sx: s, sy: s, sz: s });
      const pine =
        z.type === "forest"
          ? rand() < 0.7
          : z.type === "mountain"
            ? true
            : rand() < 0.2;
      if (pine) pines.push({ ...base, sx: s, sy: s, sz: s });
      else rounds.push({ ...base, sx: s, sy: s * (0.9 + rand() * 0.3), sz: s });
    }

    makeInstances(trunkGeo, trunkMat, trunks);
    makeInstances(pineGeo, pineMat, pines);
    makeInstances(roundGeo, roundMat, rounds);
  });

  // 구름 (바람 방향에 따라 천천히 흐르도록 구현)
  function createCloudTexture(seed) {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    const rand = mulberry32(seed);
    ctx.clearRect(0, 0, size, size);
    for (let i = 0; i < 14; i++) {
      // 흐린 덩어리 14개를 겹침
      const r = size * (0.12 + rand() * 0.14);
      const x = size * (0.5 + (rand() - 0.5) * 0.3);
      const y = size * (0.5 + (rand() - 0.5) * 0.3);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(255,255,255,0.55)"); // 가운데: 진함
      g.addColorStop(0.5, "rgba(255,255,255,0.22)");
      g.addColorStop(1, "rgba(255,255,255,0)"); // 가장자리: 투명
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // 구름 설정 (안개 느낌)
  const cloudTextures = [11, 23, 37].map(createCloudTexture); // 모양이 다른 이미지 3종
  const clouds = [];
  const cloudRand = mulberry32(777 + NOISE_SEED);
  const CLOUD_RANGE = 1700;
  const CLOUD_COUNT = 40;
  const cloudWhite = new THREE.Color(0xffffff);
  const cloudShade = new THREE.Color(0xe3e6eb);

  for (let i = 0; i < CLOUD_COUNT; i++) {
    const cloud = new THREE.Group();
    const puffs = 8 + Math.floor(cloudRand() * 6); // 구름 하나 = 얼룩 덩어리 8~13장
    const tex = cloudTextures[Math.floor(cloudRand() * cloudTextures.length)];
    for (let k = 0; k < puffs; k++) {
      const px = (cloudRand() - 0.5) * 160;
      const py = (cloudRand() - 0.5) * 24;
      const pz = (cloudRand() - 0.5) * 60;
      const s = 60 + cloudRand() * 70;
      // 아래쪽 얼룩일수록 푸른 회색, 위쪽일수록 흰색
      const shade = Math.min(1, Math.max(0, 0.5 + py / 24));
      tmpColor.copy(cloudShade).lerp(cloudWhite, shade);
      const mat = new THREE.SpriteMaterial({
        map: tex,
        color: tmpColor.clone(),
        transparent: true,
        opacity: 0.45 + cloudRand() * 0.3,
        depthWrite: false,
      });
      const puff = new THREE.Sprite(mat);
      puff.scale.set(s * 1.6, s * 0.85, 1);
      puff.position.set(px, py, pz);
      cloud.add(puff);
    }
    cloud.position.set(
      (cloudRand() * 2 - 1) * CLOUD_RANGE,
      230 + cloudRand() * 230,
      (cloudRand() * 2 - 1) * CLOUD_RANGE,
    );
    cloud.userData.speed = 0.6 + cloudRand() * 0.8;
    cloud.scale.setScalar(0.8 + cloudRand() * 1.0);
    clouds.push(cloud);
    root.add(cloud);
  }

  // 구름 베일: 미탐험 지역 위에 낮게 깔린 두꺼운 구름.
  // 저지대는 가리고 높은 봉우리는 구름 위로 솟는다.
  // 구름 덩이(퍼프)마다 따로 움직인다: 비행기가 가까이 가서 그 자리가 공개되면 그 덩이만 위로 걷히며 옅어진다.
  const veils = [];
  zones.forEach((z) => {
    let sum = 0,
      cnt = 0;
    for (let i = 0; i <= 6; i++)
      for (let j = 0; j <= 6; j++) {
        sum += Math.max(
          0,
          heightAt(
            lerp(z.min.x, z.max.x, i / 6),
            lerp(z.min.z, z.max.z, j / 6),
          ),
        );
        cnt++;
      }
    const y = Math.max(40, sum / cnt + 25); // 구역 평균 지면 높이보다 위
    const rand = mulberry32(5000 + z.index * 31);
    if (!VEIL_ENABLED) return;
    for (let a = 0; a < VEIL_GRID; a++)
      for (let b = 0; b < VEIL_GRID; b++) {
        const mat = new THREE.SpriteMaterial({
          map: cloudTextures[(a + b * 2) % cloudTextures.length],
          color: VEIL_COLOR,
          transparent: true,
          opacity: VEIL_OPACITY,
          depthWrite: false,
        });
        const puff = new THREE.Sprite(mat);
        const w = 300 + rand() * 120;
        const wx =
          z.center.x +
          ((a + 0.5) / VEIL_GRID - 0.5) * ZONE_SIZE +
          (rand() - 0.5) * 70;
        const wz =
          z.center.z +
          ((b + 0.5) / VEIL_GRID - 0.5) * ZONE_SIZE +
          (rand() - 0.5) * 70;
        const baseY = y + (rand() - 0.5) * 24;
        puff.scale.set(w, w * 0.6, 1);
        puff.position.set(wx, baseY, wz);
        root.add(puff);
        veils.push({ puff, mat, wx, wz, w, baseY });
      }
  });

  function updateVeils() {
    for (const v of veils) {
      // 구름 덩이 중심과 주변 네 곳의 공개 정도 평균
      const o = v.w * 0.3;
      const r =
        (revealAtXZ(v.wx, v.wz) * 2 +
          revealAtXZ(v.wx + o, v.wz) +
          revealAtXZ(v.wx - o, v.wz) +
          revealAtXZ(v.wx, v.wz + o) +
          revealAtXZ(v.wx, v.wz - o)) /
        6;
      const e = ease(Math.min(1, r * 1.15));
      const op = VEIL_OPACITY * (1 - e);
      v.mat.opacity = op;
      v.puff.visible = op > 0.01;
      v.puff.position.y = v.baseY + 35 * e; // 위로 올라가며 사라짐
      v.puff.scale.set(v.w * (1 + 0.3 * e), v.w * 0.6 * (1 + 0.3 * e), 1); // 사방으로 퍼짐
    }
  }

  // 바람 설정
  const wind = { x: 1, z: 0.3 };
  const WIND_VISUAL_SPEED = 6;

  // 링 (외형 + 상태 효과)
  function groundMax(x, z, r) {
    let m = Math.max(heightAt(x, z), SEA_LEVEL);
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      m = Math.max(m, heightAt(x + Math.cos(ang) * r, z + Math.sin(ang) * r));
    }
    return m;
  }

  // 색 대비: 활성(목표) 링은 지형(초록/갈색/주황/흰색)·바다(파랑)·하늘(연한 파랑)·구름(회색) 어디에도
  // 없는 마젠타 계열로 → 배경과 섞이지 않는다. 대기 중 링은 눈에 덜 띄게 낮춘다.
  const RING_COLORS = { idle: 0xffb15c, active: Number.parseInt(ACTIVE_RING_COLOR.slice(1), 16), passed: 0x5fe08a };
  const RING_LOOK = {
    //          emissive, halo 투명도
    idle: { glow: 0.35, halo: 0.12 },
    active: { glow: 0.9, halo: 0.35 },
    passed: { glow: 0.25, halo: 0.08 },
  };
  const rings = [];
  // const ringPositions = RING_PATH.map(
  //   (r) => new THREE.Vector3(r.x, groundMax(r.x, r.z, 60) + r.clearance, r.z),
  // );

  // 지형 종류마다 {RINGS_PER_TERRAIN}개씩
  // 각 지형 구역 안에서 랜덤 위치를 뽑는다.
  function generateRingSpots(rand) {
    const spots = [];
    const limit = HALF - 150; // 맵 가장자리(바다로 가라앉는 곳)는 피함
    const farEnough = (x, z) =>
      spots.every((s) => Math.hypot(s.x - x, s.z - z) >= RING_MIN_SPACING) &&
      Math.hypot(x - START.x, z - START.z) >= RING_MIN_SPACING &&
      Math.hypot(x - LANDING_PAD.x, z - LANDING_PAD.z) >=
        RING_MIN_SPACING * 0.6;

    // 바다 링: 섬 둘레를 따라 사방으로, 각자 해안 바깥의 물 위에서 위치를 뽑는다.
    function addSeaRings() {
      const base = rand() * Math.PI * 2;
      for (let k = 0; k < RINGS_PER_TERRAIN; k++) {
        const ang =
          base + ((k + (rand() - 0.5) * 0.5) * Math.PI * 2) / RINGS_PER_TERRAIN;
        const dx = Math.cos(ang),
          dz = Math.sin(ang);
        // 섬 가장자리: 처음 물이 나올 때까지의 거리
        let rc = 300;
        while (rc < 1600 && heightAt(dx * rc, dz * rc) > -1) rc += 20;
        const rEdge = (HALF - 70) / Math.max(Math.abs(dx), Math.abs(dz)); // 맵 가장자리까지의 거리
        const rMin = rc + 50;
        const rMax = Math.max(rMin + 1, rEdge);
        let x = dx * Math.min(rMin, rEdge * 0.97),
          z = dz * Math.min(rMin, rEdge * 0.97);
        let found = false;
        for (let attempt = 0; attempt < 120; attempt++) {
          const r = lerp(rMin, rMax, rand());
          const side = (rand() - 0.5) * 160; // 해안선과 나란한 방향으로 흔들기
          const cx = dx * r - dz * side,
            cz = dz * r + dx * side;
          if (Math.max(Math.abs(cx), Math.abs(cz)) > HALF - 70) continue;
          if (heightAt(cx, cz) > -2) continue; // 물 위에만
          if (!farEnough(cx, cz)) continue;
          x = cx;
          z = cz;
          found = true;
          break;
        }
        if (!found) spots.failed = true; // 물 위에 못 놓았음 -> 맵을 다시 뽑는다
        spots.push({ x, z, type: "sea" });
      }
    }

    for (const type of RING_TERRAINS) {
      if (type === "sea") {
        addSeaRings();
        continue;
      }
      const typeZones = zones.filter((z) => z.type === type);
      for (let i = typeZones.length - 1; i > 0; i--) {
        // 구역 순서를 섞어서 링이 여러 구역에 퍼지게
        const j = Math.floor(rand() * (i + 1));
        [typeZones[i], typeZones[j]] = [typeZones[j], typeZones[i]];
      }
      for (let k = 0; k < RINGS_PER_TERRAIN; k++) {
        const zone = typeZones[k % typeZones.length];
        let x = 0,
          z = 0,
          found = false;
        for (let attempt = 0; attempt < 120; attempt++) {
          x = lerp(
            zone.min.x + RING_EDGE_MARGIN,
            zone.max.x - RING_EDGE_MARGIN,
            rand(),
          );
          z = lerp(
            zone.min.z + RING_EDGE_MARGIN,
            zone.max.z - RING_EDGE_MARGIN,
            rand(),
          );
          // 육지 링은 육지 위에서만 (해안선 안쪽)
          if (
            Math.max(Math.abs(x), Math.abs(z)) < limit &&
            heightAt(x, z) > 8 &&
            farEnough(x, z)
          ) {
            found = true;
            break;
          }
        }
        if (!found) spots.failed = true;
        spots.push({ x, z, type });
      }
    }
    return spots;
  }

  // 시작 위치에서 가까운 링부터 이어지도록
  function orderByNearest(spots) {
    const left = [...spots],
      ordered = [];
    let cx = START.x,
      cz = START.z;
    while (left.length) {
      let best = 0,
        bestD = Infinity;
      left.forEach((s, i) => {
        const d = Math.hypot(s.x - cx, s.z - cz);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      const [s] = left.splice(best, 1);
      ordered.push(s);
      cx = s.x;
      cz = s.z;
    }
    return ordered;
  }

  function clearRings() {
    for (const r of rings) {
      root.remove(r.mesh);
      r.mesh.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    }
    rings.length = 0; // 같은 배열을 유지 (env.rings 참조가 깨지지 않게)
    activeRing = -1;
    guide.visible = false;
    for (const b of bursts) disposeBurst(b);
    bursts.length = 0;
  }

  function buildRings() {
    clearRings();
    // 조건에 맞는 자리를 못 찾은 링이 있으면(물 위/육지 위 조건, 간격) 다시 뽑는다
    let raw = generateRingSpots(ringRand);
    for (let retry = 0; retry < 12 && raw.failed; retry++)
      raw = generateRingSpots(ringRand);
    const spots = orderByNearest(raw);
    const positions = spots.map(
      (s) =>
        new THREE.Vector3(
          s.x,
          groundMax(s.x, s.z, 60) + RING_CLEARANCE[s.type],
          s.z,
        ),
    );

    positions.forEach((pos, i) => {
      // 링 평면의 법선 = "이전 링(첫 링은 출발점)에서 이 링으로 다가오는 방향".
      // 예전에는 "다음 링 방향"이라 경로가 꺾이면 링을 옆에서 보게 되어 얇은 선처럼 보였다.
      // RingSystem은 양방향 통과를 모두 인정하므로 판정에는 영향이 없다.
      const prev = i === 0 ? startPos : positions[i - 1];
      const normal = pos.clone().sub(prev).normalize();

      const group = new THREE.Group();
      group.position.copy(pos);
      group.lookAt(pos.clone().add(normal)); // 링 평면의 법선(+Z)이 진행 방향을 향함

      const tube = RING_RADIUS * 0.14;
      const mat = new THREE.MeshStandardMaterial({
        color: RING_COLORS.idle,
        emissive: RING_COLORS.idle,
        emissiveIntensity: 0.55,
        roughness: 0.4,
        metalness: 0.2,
        transparent: true, // 불투명 링은 구름 베일보다 먼저 그려져 가려짐 -> renderOrder로 순서 제어
      });
      const main = new THREE.Mesh(
        new THREE.TorusGeometry(RING_RADIUS + tube, tube, 16, 56),
        mat,
      );
      const haloMat = new THREE.MeshBasicMaterial({
        color: RING_COLORS.idle,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(RING_RADIUS, tube * 2.6, 12, 56),
        haloMat,
      );
      main.castShadow = true;
      group.add(main, halo);
      root.add(group);

      rings.push({
        id: i + 1,
        terrain: spots[i].type,
        mesh: group,
        position: pos.clone(),
        normal,
        radius: RING_RADIUS,
        innerRadius: RING_RADIUS - tube,
        passed: false,
        state: "idle",
        pop: 1,
        _mat: mat,
        _haloMat: haloMat,
        _main: main,
        _halo: halo,
      });
    });

    // 첫 링 방향으로 시작 방향을 갱신
    start.direction.copy(positions[0]).sub(start.position).setY(0).normalize();
  }

  function applyRingState(ring) {
    const hex = RING_COLORS[ring.state];
    const look = RING_LOOK[ring.state];
    ring._mat.color.setHex(hex);
    ring._mat.emissive.setHex(hex);
    ring._mat.emissiveIntensity = look.glow;
    ring._haloMat.color.setHex(hex);
    ring._haloMat.opacity = look.halo;
    // 활성 링은 구름 베일/수면보다 나중에 그려서 베일 너머로도 선명하게 보이게 한다
    const order = ring.state === "active" ? 5 : 0;
    ring._main.renderOrder = order;
    ring._halo.renderOrder = order;
  }

  // ---- 목표 링 안내물 (활성 링 1개에만 붙여 쓴다) ----
  //  1) 세로 빛기둥: 안개 무시(fog:false) + 거리에 비례해 굵어짐 -> 맵 어디서든 위치를 알 수 있음
  //  2) 마커(▼): 화면 크기가 거리와 무관하게 일정(sizeAttenuation:false), 지형/구름 뒤에서도 보임
  //  3) 파동: 링 평면에서 바깥으로 퍼지는 고리 -> 링의 구멍 방향과 "여기다"가 한눈에 보임
  const guide = new THREE.Group();
  guide.name = "RingGuide";
  guide.visible = false;
  root.add(guide);

  const activeCss = "#" + new THREE.Color(RING_COLORS.active).getHexString();
  const markerTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    g.beginPath();
    g.moveTo(22, 26);
    g.lineTo(106, 26);
    g.lineTo(64, 104);
    g.closePath();
    g.lineJoin = "round";
    g.lineWidth = 16; // 어두운 바깥 테두리 -> 밝은 하늘/눈 위에서도 보임
    g.strokeStyle = "rgba(20,30,60,0.6)";
    g.stroke();
    g.lineWidth = 8;
    g.strokeStyle = "#ffffff";
    g.stroke();
    g.fillStyle = activeCss;
    g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();

  const guideBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 1200, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: RING_COLORS.active,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    }),
  );
  guideBeam.renderOrder = 6;
  guide.add(guideBeam);

  const guideMarker = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: markerTex,
      transparent: true,
      depthTest: false, // 지형이나 구름에 가려도 항상 보임 (웨이포인트)
      depthWrite: false,
      sizeAttenuation: false, // 거리와 상관없이 화면 크기 고정
      fog: false,
      toneMapped: false,
    }),
  );
  guideMarker.scale.set(0.06, 0.06, 1); // 화면 높이의 약 5%
  guideMarker.renderOrder = 10;
  guide.add(guideMarker);

  const guideRipples = new THREE.Group(); // 링과 같은 평면(회전)을 따라감
  guide.add(guideRipples);
  const rippleMats = [0, 1].map(
    () =>
      new THREE.MeshBasicMaterial({
        color: RING_COLORS.active,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
  );
  const rippleMeshes = rippleMats.map((m) => {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(RING_RADIUS, RING_RADIUS * 0.05, 8, 64),
      m,
    );
    mesh.renderOrder = 6;
    guideRipples.add(mesh);
    return mesh;
  });
  const MARKER_LIFT = RING_RADIUS * 1.8; // 링 위로 띄우는 높이

  function updateGuide(delta, planePosition) {
    const r = activeRing >= 0 ? rings[activeRing] : null;
    const on = !!r && r.state === "active";
    guide.visible = on;
    if (!on) return;
    guide.position.copy(r.position);
    guideRipples.quaternion.copy(r.mesh.quaternion);
    const d = planePosition ? planePosition.distanceTo(r.position) : 300;
    // 멀수록 기둥을 굵게 (화면에서 항상 몇 픽셀은 보이도록)
    const w = Math.min(8, Math.max(1, d / 220));
    guideBeam.scale.set(w, 1, w);
    // 가까워지면 마커는 서서히 사라지고 링 자체가 주인공이 된다
    guideMarker.material.opacity = smooth(110, 260, d);
    guideMarker.position.y = MARKER_LIFT + Math.sin(elapsed * 3.2) * 3;
    // 파동: 1 -> 1.9배로 퍼지며 사라짐, 두 개가 반 주기 어긋나게
    rippleMeshes.forEach((m, i) => {
      const ph = (elapsed * 0.7 + i * 0.5) % 1;
      m.scale.setScalar(1 + ph * 0.9);
      rippleMats[i].opacity = 0.6 * (1 - ph) * (1 - ph);
    });
  }

  // HUD(화살표 / 거리 표시)용: 활성 링이 화면 어디에 있는지 알려 준다
  const _vp = new THREE.Vector3();
  const _vc = new THREE.Vector3();
  function getActiveRingInfo(camera) {
    const r = activeRing >= 0 ? rings[activeRing] : null;
    if (!r || r.state !== "active" || !camera) return null;
    camera.updateMatrixWorld();
    _vc.copy(r.position).applyMatrix4(camera.matrixWorldInverse);
    const behind = _vc.z > 0; // 카메라 뒤쪽
    _vp.copy(r.position).project(camera); // NDC (-1 ~ 1)
    let x = _vp.x,
      y = _vp.y;
    if (behind) {
      x = -x; // 뒤에 있으면 좌우/상하가 뒤집혀 나오므로 되돌린다
      y = -y;
    }
    return {
      id: r.id,
      terrain: r.terrain,
      distance: camera.position.distanceTo(r.position),
      ndc: { x, y },
      behind,
      onScreen: !behind && Math.abs(x) <= 1 && Math.abs(y) <= 1,
    };
  }

  let activeRing = -1; // rings 배열 내부 index
  const ringById = (id) => rings.find((r) => r.id === id);
  function setActiveRing(id) {
    if (activeRing >= 0 && rings[activeRing] && !rings[activeRing].passed) {
      rings[activeRing].state = "idle";
      applyRingState(rings[activeRing]);
    }
    const r = ringById(id);
    if (!r) {
      activeRing = -1;
      return;
    }
    activeRing = rings.indexOf(r);
    if (!r.passed) {
      r.state = "active";
      applyRingState(r);
    }
  }

  // 링 통과 성공 파티클 (둥글고 부드러운 점 -> 네모난 점으로 보이지 않게)
  const burstTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.35, "rgba(255,255,255,0.8)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  // 링 통과 연출 (한 번에 겹쳐서 터진다)
  //  1) 링 안쪽 번쩍임: 링 구멍이 순간 밝아져 "통과했다"가 한눈에 보임
  //  2) 충격파 고리 2개: 링 평면에서 바깥으로 퍼지며 사라짐
  //  3) 불꽃: 링 테두리에서 사방으로 튀고 서서히 느려지며 사라짐 (작고 밝은 점 + 크고 부드러운 빛 알갱이)
  //  4) 링 자체가 번쩍였다가 통과 색(초록)으로 가라앉음 (update의 pop 처리)
  const bursts = [];
  const BURST_LIFE = 1.5;
  const BURST_COLOR = 0x2fe07a; // 밝은 하늘 위에서도 보이도록 채도 높은 초록
  // additive(가산)로만 그리면 밝은 하늘 위에서 안 보이므로, 충격파/불꽃은 일반 혼합으로 그린다
  const burstMat = (color, opacity, additive = false) =>
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
      toneMapped: false,
    });

  function makeSparks(
    ring,
    { count, size, color, speed, opacity, additive = false },
  ) {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const v = new THREE.Vector3();
    const t = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      v.set(Math.cos(a), Math.sin(a), 0).applyQuaternion(ring.mesh.quaternion);
      t.crossVectors(ring.normal, v); // 링 둘레 방향 (소용돌이 성분)
      pos[i * 3] = ring.position.x + v.x * ring.radius;
      pos[i * 3 + 1] = ring.position.y + v.y * ring.radius;
      pos[i * 3 + 2] = ring.position.z + v.z * ring.radius;
      const out = speed[0] + Math.random() * (speed[1] - speed[0]);
      const along = (Math.random() - 0.5) * speed[1] * 0.7;
      const swirl = (Math.random() - 0.5) * speed[1] * 0.5;
      vel[i * 3] = v.x * out + ring.normal.x * along + t.x * swirl;
      vel[i * 3 + 1] = v.y * out + ring.normal.y * along + t.y * swirl;
      vel[i * 3 + 2] = v.z * out + ring.normal.z * along + t.z * swirl;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color,
      map: burstTex,
      size,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      fog: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    root.add(pts);
    return { pts, vel, baseOpacity: opacity };
  }

  function spawnBurst(ring) {
    const group = new THREE.Group();
    group.position.copy(ring.position);
    group.quaternion.copy(ring.mesh.quaternion);
    root.add(group);

    const flash = new THREE.Mesh(
      new THREE.CircleGeometry(ring.radius, 40),
      burstMat(0xcfffe0, 0.5, true),
    );
    group.add(flash);
    const waves = [0, 0.14].map((delay) => {
      const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(ring.radius, ring.radius * 0.09, 8, 72),
        burstMat(BURST_COLOR, 0),
      );
      group.add(mesh);
      return { mesh, delay };
    });
    const sparks = makeSparks(ring, {
      count: 110,
      size: 3.6,
      color: 0x7dffb0,
      speed: [14, 38],
      opacity: 1,
    });
    const core = makeSparks(ring, {
      count: 60,
      size: 2.2,
      color: 0xffffff,
      speed: [10, 30],
      opacity: 1,
      additive: true,
    });
    const glow = makeSparks(ring, {
      count: 36,
      size: 13,
      color: BURST_COLOR,
      speed: [6, 20],
      opacity: 0.55,
    });
    bursts.push({
      group,
      flash,
      waves,
      particles: [sparks, core, glow],
      center: ring.position.clone(),
      age: 0,
      life: BURST_LIFE,
    });
  }

  function disposeBurst(b) {
    root.remove(b.group);
    b.group.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    for (const p of b.particles) {
      root.remove(p.pts);
      p.pts.geometry.dispose();
      p.pts.material.dispose();
    }
  }

  function markRingPassed(id) {
    const r = ringById(id);
    if (!r || r.passed) return;
    r.passed = true;
    r.state = "passed";
    r.pop = 0;
    applyRingState(r);
    spawnBurst(r);
    // 링은 점수/연출만 담당한다. 지형 공개는 비행기가 가까이 지나가면서 stepReveal()이 처리
  }

  // 착륙 지점 (원형 패드 + H 마크 + 조명)
  const pad = new THREE.Group();
  pad.position.set(LANDING_PAD.x, LANDING_PAD.y + 0.5, LANDING_PAD.z);
  const R = LANDING_PAD.radius;

  const padBase = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R * 1.04, 2.4, 48),
    new THREE.MeshStandardMaterial({
      color: 0x8e949c,
      roughness: 0.8,
      flatShading: true,
    }),
  );
  padBase.receiveShadow = true;
  padBase.castShadow = true;

  const padRing = new THREE.Mesh(
    new THREE.TorusGeometry(R * 0.86, 1.1, 8, 64),
    new THREE.MeshStandardMaterial({
      color: 0xff7043,
      emissive: 0xff7043,
      emissiveIntensity: 0.4,
    }),
  );
  padRing.rotation.x = Math.PI / 2;
  padRing.position.y = 1.25;

  // 패드 윗면: 밝은 주황 원판 + 굵은 흰색 H (조명 영향을 받지 않아 어디서든 환하게 보임)
  const padTex = createPadTexture(THREE);
  const padTop = new THREE.Mesh(
    new THREE.CircleGeometry(R * 0.97, 64).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      map: padTex,
      toneMapped: false,
      fog: false,
      polygonOffset: true, // 받침 윗면보다 항상 앞에 그려지게 깊이를 살짝 당긴다 (멀리서 깜빡임 방지)
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  padTop.position.y = 1.9; // 받침 윗면(1.2)과 충분히 띄움
  pad.add(padBase, padRing, padTop);
  root.add(pad);

  // 멀리서도 보이게: 안개를 무시하는 밝은 빛기둥(멀수록 굵어짐) + 화면 크기 고정 "H" 마커
  const padBeamMat = new THREE.MeshBasicMaterial({
    color: 0xffc233,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const padBeamCore = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 3, 1400, 16, 1, true),
    padBeamMat,
  );
  const padBeamHalo = new THREE.Mesh(
    new THREE.CylinderGeometry(13, 13, 1400, 20, 1, true),
    padBeamMat.clone(),
  );
  padBeamHalo.material.opacity = 0.16;
  for (const b of [padBeamCore, padBeamHalo]) {
    b.position.set(LANDING_PAD.x, LANDING_PAD.y + 600, LANDING_PAD.z);
    b.renderOrder = 6;
    root.add(b);
  }
  const padMarkerTex = createHMarkerTexture(THREE);
  const padMarker = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: padMarkerTex,
      transparent: true,
      depthTest: false, // 지형/구름 뒤에서도 보임
      depthWrite: false,
      sizeAttenuation: false, // 거리와 상관없이 화면 크기 고정
      fog: false,
      toneMapped: false,
    }),
  );
  padMarker.scale.set(0.055, 0.055, 1);
  padMarker.position.set(LANDING_PAD.x, LANDING_PAD.y + 85, LANDING_PAD.z);
  padMarker.renderOrder = 10;
  root.add(padMarker);

  // 시작 위치: 서쪽 평원 위, 첫 링을 바라보는 방향
  const startGround = Math.max(heightAt(START.x, START.z), SEA_LEVEL);
  const startPos = new THREE.Vector3(
    START.x,
    startGround + START.altitude,
    START.z,
  );
  const start = { position: startPos, direction: new THREE.Vector3(0, 0, 1) }; // 방향은 buildRings()에서 갱신

  // RingSystem에 넘길 링 데이터: { id, position, radius, normal }
  const toXYZ = (v) => ({ x: v.x, y: v.y, z: v.z });
  function getRingData() {
    return rings.map((r) => ({
      id: r.id,
      position: toXYZ(r.position),
      radius: r.radius,
      normal: toXYZ(r.normal),
    }));
  }

  // ExplorationSystem에 넘길 지역 데이터: { id, name, type, position, radius, ignoreY }
  // ignoreY: 높이(y)는 무시하고 수평(x, z) 거리로만 판정
  // (현재 ExplorationSystem은 아직 처리하지 않으므로, 연결 시 env.getZoneState()를 쓰거나 syncFromReveal 방식으로 동기화한다)
  function getRegionData() {
    return zones.map((z) => ({
      id: z.id,
      name: z.name,
      type: z.type,
      position: { x: z.center.x, y: 0, z: z.center.z },
      radius: REGION_RADIUS,
      ignoreY: true,
    }));
  }

  // 전체 탐험률: 공개된 칸 비율 (0~1). 비행기가 가까이 지나간 면적이 곧 탐험률이다.
  function getExplorationRate() {
    return coverage;
  }

  // 지형 종류별 발견 현황 { mountain: { discovered, total }, ... } (평원 포함)
  // 구역은 25% 이상 공개되면 "발견". 결과 화면의 "발견한 지형의 종류와 개수"에 사용
  function getTerrainProgress() {
    const out = {};
    for (const z of zones) {
      out[z.type] ??= { discovered: 0, total: 0 };
      out[z.type].total++;
      if (z.discovered) out[z.type].discovered++;
    }
    return out;
  }

  // 구역별 공개 현황 [{ id, fraction, discovered }] (ExplorationSystem.syncFromReveal에 전달)
  function getZoneState() {
    return zones.map((z) => ({
      id: z.id,
      fraction: z.fraction,
      discovered: z.discovered,
    }));
  }

  // 마지막 호출 이후 새로 "발견"된 구역 목록을 돌려주고 비운다
  function consumeDiscovered() {
    return newlyDiscovered.splice(0, newlyDiscovered.length);
  }

  // 결과 화면의 "나만의 탐험 지도"용 데이터 한 묶음.
  // 지형 높이/색은 격자를 한 칸씩 건너뛰어 줄인 것(129 x 129)이고, 공개 격자와 링, 시작/착륙 지점을 함께 담는다.
  // (ExplorationMap.js가 이 데이터만으로 축소 3D 지도를 만든다 -> Environment가 dispose 되어도 쓸 수 있음)
  function getMapData() {
    const stride = 2;
    const n = SEG / stride + 1;
    const mapHeights = new Float32Array(n * n);
    const mapColors = new Float32Array(n * n * 3);
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const src = j * stride * row + i * stride;
        mapHeights[j * n + i] = heights[src];
        mapColors.set(
          baseColors.subarray(src * 3, src * 3 + 3),
          (j * n + i) * 3,
        );
      }
    return {
      seed,
      mapSize: MAP_SIZE,
      grid: n,
      heights: mapHeights,
      colors: mapColors,
      reveal: getRevealGrid(),
      layout: ZONE_TYPES.slice(),
      zones: zones.map((z) => ({
        row: z.row,
        col: z.col,
        type: z.type,
        name: z.name,
        fraction: z.fraction,
        discovered: z.discovered,
      })),
      rings: rings.map((r) => ({
        id: r.id,
        terrain: r.terrain,
        passed: r.passed,
        position: toXYZ(r.position),
        normal: toXYZ(r.normal),
        radius: r.radius,
      })),
      start: toXYZ(start.position),
      landing: {
        ...toXYZ(
          new THREE.Vector3(LANDING_PAD.x, LANDING_PAD.y + 1.7, LANDING_PAD.z),
        ),
        radius: LANDING_PAD.radius,
      },
    };
  }

  // 결과 화면의 탐험 지도용: 공개 격자 (size x size, 0~1, 행 = z / 열 = x)
  function getRevealGrid() {
    return { size: RG, cell: CELL, data: Float32Array.from(revealData) };
  }

  // 새 게임: 지형을 회색조로 되돌리고(공개/발견 기록 초기화), 링을 새로 랜덤 배치한다.
  function reset() {
    revealData.fill(0);
    flashData.fill(0);
    zones.forEach((z) => {
      z.fraction = 0;
      z.discovered = false;
    });
    newlyDiscovered.length = 0;
    coverage = 0;
    uploadReveal();
    updateVeils();
    buildRings();
    setActiveRing(1);
  }

  // 매 프레임 갱신 조건
  function update(delta, planePosition, { survey = true } = {}) {
    elapsed += delta;

    // 탐험 연출: 비행기 주변이 서서히 공개되고(회색조 -> 컬러), 그 위의 구름이 걷힌다
    stepReveal(delta, survey ? planePosition : null);
    updateVeils();
    coverageTimer += delta;
    if (coverageTimer >= 0.25) {
      coverageTimer = 0;
      recomputeCoverage();
    }

    // 물결 (셰이더가 시간으로 계산)
    waterTime.value = elapsed;

    // 구름 흐름
    for (const c of clouds) {
      c.position.x += wind.x * WIND_VISUAL_SPEED * c.userData.speed * delta;
      c.position.z += wind.z * WIND_VISUAL_SPEED * c.userData.speed * delta;
      if (c.position.x > CLOUD_RANGE) c.position.x = -CLOUD_RANGE;
      else if (c.position.x < -CLOUD_RANGE) c.position.x = CLOUD_RANGE;
      if (c.position.z > CLOUD_RANGE) c.position.z = -CLOUD_RANGE;
      else if (c.position.z < -CLOUD_RANGE) c.position.z = CLOUD_RANGE;
    }
    // 링 효과
    for (const r of rings) {
      if (r.state === "active") {
        const pulse = Math.sin(elapsed * 5);
        r._mat.emissiveIntensity = RING_LOOK.active.glow + 0.4 * pulse;
        r._haloMat.opacity = RING_LOOK.active.halo + 0.2 * pulse;
        r.mesh.scale.setScalar(1 + 0.05 * pulse);
      }
      if (r.pop < 1) {
        // 통과 시 팝 애니메이션
        r.pop = Math.min(1, r.pop + delta / 0.5);
        r.mesh.scale.setScalar(1 + 0.35 * Math.sin(Math.PI * r.pop));
        // 통과 순간 환하게 번쩍였다가 통과 색으로 가라앉는다
        const flashAmt = (1 - r.pop) * (1 - r.pop);
        r._mat.emissiveIntensity = RING_LOOK.passed.glow + 1.3 * flashAmt;
        r._haloMat.opacity = RING_LOOK.passed.halo + 0.1 * flashAmt;
      }
    }

    if (options.worldRingGuide !== false) updateGuide(delta, planePosition); // 목표 링 안내물

    // 통과 연출
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.age += delta;
      const life = b.age / b.life;
      // 1) 링 안쪽 번쩍임
      // 비행기가 링 바로 앞/뒤에 있을 때는 화면이 하얗게 날아가지 않도록 가까울수록 약하게
      const near = planePosition
        ? smooth(25, 90, planePosition.distanceTo(b.center))
        : 1;
      const fp = Math.min(1, b.age / 0.35);
      b.flash.material.opacity = 0.5 * near * (1 - fp) * (1 - fp);
      b.flash.visible = fp < 1;
      // 2) 충격파 고리
      for (const w of b.waves) {
        const p = Math.min(1, Math.max(0, (b.age - w.delay) / 0.85));
        w.mesh.scale.setScalar(1 + p * 1.4);
        w.mesh.material.opacity = p <= 0 ? 0 : 0.9 * Math.pow(1 - p, 1.5);
      }
      // 3) 불꽃: 점점 느려지며 사라짐
      const damp = Math.exp(-delta * 1.7);
      for (const part of b.particles) {
        const arr = part.pts.geometry.attributes.position.array;
        for (let k = 0; k < arr.length; k++) {
          arr[k] += part.vel[k] * delta;
          part.vel[k] *= damp;
        }
        part.pts.geometry.attributes.position.needsUpdate = true;
        part.pts.material.opacity =
          part.baseOpacity * Math.pow(Math.max(0, 1 - life), 1.3);
      }
      if (b.age >= b.life) {
        disposeBurst(b);
        bursts.splice(i, 1);
      }
    }

    // 착륙 지점 안내: 빛기둥은 멀수록 굵게, H 마커는 가까워지면 서서히 사라진다
    const dPad = planePosition
      ? Math.hypot(
          planePosition.x - LANDING_PAD.x,
          planePosition.y - LANDING_PAD.y,
          planePosition.z - LANDING_PAD.z,
        )
      : 400;
    const pw = Math.min(8, Math.max(1, dPad / 260));
    padBeamCore.scale.set(pw, 1, pw);
    padBeamHalo.scale.set(pw, 1, pw);
    // 가까워지면 빛기둥이 옅어져 착륙할 H 마크를 가리지 않는다
    const beamK = 0.2 + 0.8 * smooth(60, 320, dPad);
    padBeamMat.opacity = (0.6 + 0.15 * Math.sin(elapsed * 2.2)) * beamK;
    padBeamHalo.material.opacity = 0.16 * beamK;
    padMarker.material.opacity = 1;
    padMarker.position.y = LANDING_PAD.y + 85 + Math.sin(elapsed * 2.4) * 3;
    padRing.material.emissiveIntensity = 0.9 + 0.5 * Math.sin(elapsed * 3); // 패드 둘레 조명 깜빡임

    if (planePosition) {
      sky.position.copy(planePosition); // 하늘이 항상 비행기를 따라감
      sun.target.position.set(
        Math.round(planePosition.x),
        planePosition.y * 0.5,
        Math.round(planePosition.z),
      );
      sun.position.copy(sun.target.position).add(SUN_OFFSET); // 그림자 범위도 따라감
    }
  }

  // 정리 (dispose)
  function dispose() {
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material)
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
          m.dispose(),
        );
    });
    cloudTextures.forEach((t) => t.dispose()); // 구름 이미지 해제
    detailTex.dispose(); // 지면 질감 해제
    markerTex.dispose(); // 목표 링 마커 이미지 해제
    heightTex.dispose(); // 물 셰이더용 높이 텍스처 해제
    revealTex.dispose(); // 탐험 공개 텍스처 해제
    burstTex.dispose(); // 파티클 이미지 해제
    padTex.dispose(); // 착륙 패드 H 이미지 해제
    padMarkerTex.dispose(); // 착륙 마커 이미지 해제
    scene.remove(root);
  }
  reset(); // 초기 상태: 전체 회색조, 링 랜덤 배치, 첫 링 강조

  return {
    root,
    update,
    dispose,
    reset,
    getGroundHeight: (x, z) => Math.max(heightAt(x, z), SEA_LEVEL), // 지면 충돌 판정용 (바다는 수면 높이)
    setStorm(active) {
      scene.fog.near = active ? 100 : 500;
      scene.fog.far = active ? 850 : 3000;
      scene.fog.color.copy(horizonColor);
      if (active) scene.fog.color.multiplyScalar(0.55);
    },
    setWind: (x, z) => {
      wind.x = x;
      wind.z = z;
    }, // 바람 방향 바꾸기 (구름 이동)
    rings,
    setActiveRing,
    getActiveRingInfo, // HUD용: 목표 링의 화면 위치 / 거리
    markRingPassed,
    getRingData, // 링
    getExplorationRate,
    getZoneState, // 구역별 공개 현황 -> ExplorationSystem.syncFromReveal
    consumeDiscovered, // 새로 발견된 구역
    getRevealGrid, // 결과 화면 탐험 지도용 공개 격자
    getMapData, // 결과 화면 탐험 지도용 데이터 (지형 + 공개 + 링 + 시작/착륙)
    getTerrainProgress, // 탐험률 / 지형 종류별 발견 현황
    zones,
    seed, // 이 맵의 시드 (결과 화면에 표시하거나 "같은 맵 다시"에 사용)
    layout: ZONE_TYPES.slice(), // 16칸 지형 종류 (행 우선: [z][x])
    getRegionData,
    getZoneAt: (x, z) => {
      const i = zoneIndexAt(x, z);
      return i < 0 ? -1 : i + 1;
    },
    start,
    landingPad: {
      position: new THREE.Vector3(
        LANDING_PAD.x,
        LANDING_PAD.y + 1.7,
        LANDING_PAD.z,
      ),
      radius: LANDING_PAD.radius,
    },
    mapSize: MAP_SIZE,
  };
}
