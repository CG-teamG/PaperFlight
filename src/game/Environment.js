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

const ZONE_TYPES = ZONE_LAYOUT.flat();

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
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
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
// 지역 발견 반지름 -> ExplorationSystem에 radius로 반영
export const REGION_RADIUS = 300;

// 링은 지형 4종에 4개씩(총 16개), 각 지형 구역 안에서 매번 랜덤하게 배치된다(난수)
export const RING_TERRAINS = ["mountain", "forest", "canyon", "sea"];
export const RINGS_PER_TERRAIN = 4;
const RING_CLEARANCE = { mountain: 90, forest: 55, canyon: 60, sea: 50 }; // 지형별 지면 위 높이
const RING_MIN_SPACING = 160; // 링 사이 최소 거리
const RING_EDGE_MARGIN = 50; // 구역 경계에서 떨어질 거리

// 탐험 연출
// "terrain" = 지형별 링 통과율만큼 그 지형이 밝아짐
// "global" = 전체 링 통과율만큼 맵 전체가 밝아짐
export const REVEAL_MODE = "terrain";

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
    const main = Math.abs(Math.sin(x * 0.0055 + z * 0.002 + warp));
    h -= 72 * (1 - smooth(0.0, 0.34, main)); // 큰 협곡
    const branch = Math.abs(Math.sin(x * 0.0021 - z * 0.0049 + warp * 1.7 + 2));
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

// 렌더러 설정 헬퍼: 그림자와 색 표현을 켠다 (GameScene에서 1회 호출)
export function configureRenderer(THREE, renderer) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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

  // 링 배치용 난수 -> options.seed를 주면 같은 배치 / 없으면 매번 새로 배치
  const ringRand = mulberry32(
    options.seed ?? Math.floor(Math.random() * 2147483647),
  );

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
      p: 0,
      target: 0,
      flash: 0, // 공개 순간 반짝임 (1 -> 0)
    };
  });

  const ease = (p) => p * p * (3 - 2 * p);

  // 구역 밝기(0~1)와 반짝임을 색으로 바꾼다.
  //  미탐험(0): 어둡운 회색조, 대비감 낮게
  //  탐험(1)  : 채도와 밝기를 높게
  function revealRGB(r, g, b, rev, flash, out, idx) {
    let gray = r * 0.299 + g * 0.587 + b * 0.114;
    gray = lerp(gray, 0.18, (1 - rev) * 0.4);
    const sat = rev * (1 + 0.18 * rev) + flash * 0.35;
    const k = lerp(0.3, 1.04, rev) * (1 + 0.3 * flash);
    out[idx] = Math.max(0, (gray + (r - gray) * sat) * lerp(0.92, 1, rev) * k);
    out[idx + 1] = Math.max(
      0,
      (gray + (g - gray) * sat) * lerp(0.97, 1, rev) * k,
    );
    out[idx + 2] = Math.max(
      0,
      (gray + (b - gray) * sat) * lerp(1.08, 1, rev) * k,
    );
  }
  const rgbTmp = [0, 0, 0];
  function tintColor(base, rev, out, flash = 0) {
    revealRGB(base.r, base.g, base.b, rev, flash, rgbTmp, 0);
    out.setRGB(rgbTmp[0], rgbTmp[1], rgbTmp[2]);
  }

  // 구역에 속한 물체(나무)의 재질도 지형처럼 회색조 -> 원래 색으로 바뀌게 한다
  const zoneMats = zones.map(() => []);
  function registerZoneMaterial(zi, mat) {
    const entry = { mat, base: mat.color.clone() };
    zoneMats[zi].push(entry);
    tintColor(entry.base, ease(zones[zi].p), mat.color);
  }
  function applyZoneTint(z) {
    const e = ease(z.p),
      f = z.flash * z.flash;
    for (const m of zoneMats[z.index]) tintColor(m.base, e, m.mat.color, f);
    applyVeil(z); // 탐험 이후 구름이 걷힘
  }

  // 바다(섬을 둘러싼 모든 물)는 구역과 상관없이 "바다 링" 통과율 하나로 밝아진다.
  // 바다 구역(모서리)의 밝기를 그대로 따라가고, 물 셰이더와 해저 색이 이 값을 쓴다.
  const seaZone = zones.find((z) => z.type === "sea");
  const seaReveal = { value: 0 };
  const seaFlash = { value: 0 };
  function syncSeaReveal() {
    seaReveal.value = seaZone ? ease(seaZone.p) : 0;
    seaFlash.value = seaZone ? seaZone.flash * seaZone.flash : 0;
  }
  syncSeaReveal();

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

  const vZone = new Int16Array(pos.count * 4); // 정점이 영향받는 구역 4개
  const vWeight = new Float32Array(pos.count * 4); // 각 구역의 영향 비율
  const colorAttr = new THREE.BufferAttribute(
    new Float32Array(pos.count * 3),
    3,
  );

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
    cornerWeights(x, z, 0.12).forEach(([zi, w], k) => {
      vZone[i * 4 + k] = zi;
      vWeight[i * 4 + k] = w;
    });
  }
  terrainGeo.setAttribute("color", colorAttr);
  terrainGeo.computeVertexNormals(); // 높이가 바뀌었으니 음영 재계산

  // 구역별 밝기(0~1)를 정점 색에 반영: 0 = 어두운 회색조(윤곽만 보임), 1 = 원래 색

  // 물에 잠긴 정점일수록 1: 해저 색은 바다 탐험 상태를 따른다(구역 x)
  const wet = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) wet[i] = smooth(0.8, -2.5, heights[i]);

  function refreshTerrainColors() {
    const arr = colorAttr.array;
    const rev = zones.map((z) => ease(z.p));
    const fl = zones.map((z) => z.flash * z.flash);
    const seaRev = seaReveal.value,
      seaFl = seaFlash.value;
    for (let i = 0; i < pos.count; i++) {
      let r = 0,
        f = 0;
      for (let k = 0; k < 4; k++) {
        const w = vWeight[i * 4 + k],
          zi = vZone[i * 4 + k];
        r += w * rev[zi];
        f += w * fl[zi];
      }

      r = lerp(r, seaRev, wet[i]);
      f = lerp(f, seaFl, wet[i]);

      revealRGB(
        baseColors[i * 3],
        baseColors[i * 3 + 1],
        baseColors[i * 3 + 2],
        r,
        f,
        arr,
        i * 3,
      );
    }
    colorAttr.needsUpdate = true;
  }
  refreshTerrainColors();

  const detailTex = createDetailTexture(THREE);
  const terrain = new THREE.Mesh(
    terrainGeo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: detailTex, // 지면 질감
      flatShading: TERRAIN_FLAT_SHADING,
      roughness: 0.95,
      metalness: 0,
    }),
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
    varying vec3 vNormalW;
    ${WATER_COMMON}
    #include <fog_pars_vertex>

    float waveH(vec2 p, float t) {
      return sin(p.x * 0.045 + t * 1.3) * 0.6
           + cos(p.y * 0.05 + t * 1.0) * 0.5
           + sin((p.x + p.y) * 0.09 + t * 1.9) * 0.25;
    }
    vec2 waveGrad(vec2 p, float t) {
      float a = cos((p.x + p.y) * 0.09 + t * 1.9) * 0.25 * 0.09;
      return vec2(cos(p.x * 0.045 + t * 1.3) * 0.6 * 0.045 + a,
                  -sin(p.y * 0.05 + t * 1.0) * 0.5 * 0.05 + a);
    }

    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      float depth = -sampleH(wp.xz);
      float edge = max(abs(wp.x), abs(wp.z));
      // 얕은 곳과 맵 가장자리에서는 파도를 줄여 지형을 뚫지 않고 바깥 바다와 매끄럽게 이어지게 한다
      float damp = uWaveAmp * (0.25 + 0.75 * smoothstep(0.0, 8.0, depth))
                 * (1.0 - smoothstep(uHeightInfo.x - 80.0, uHeightInfo.x, edge));
      wp.y += waveH(wp.xz, uTime) * damp;
      vec2 g = waveGrad(wp.xz, uTime) * damp;
      vNormalW = normalize(vec3(-g.x, 1.0, -g.y));
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
    uniform vec3 uSunDir;
    uniform float uSeaReveal; // 바다 탐험 상태 (0~1)
    uniform float uSeaFlash;  // 바다 공개 효과
    uniform float uOpaque;
    varying vec3 vWorld;
    varying vec3 vNormalW;
    ${WATER_COMMON}
    #include <fog_pars_fragment>

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
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
      vec3 N = normalize(vNormalW + vec3((n2 - 0.5) * 0.3, 0.0, (n3 - 0.5) * 0.3));
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

      col = revealTint(col, uSeaReveal, uSeaFlash);

      gl_FragColor = vec4(col, alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
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
      uSunDir: { value: sunDir },
      uSeaReveal: seaReveal,
      uSeaFlash: seaFlash,
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
  hole.moveTo(-HALF, -HALF);
  hole.lineTo(-HALF, HALF);
  hole.lineTo(HALF, HALF);
  hole.lineTo(HALF, -HALF);
  hole.closePath();
  outerShape.holes.push(hole);
  const outerSeaMesh = new THREE.Mesh(
    new THREE.ShapeGeometry(outerShape).rotateX(-Math.PI / 2),
    makeWaterMaterial({ inside: false }),
  );
  outerSeaMesh.position.y = SEA_LEVEL - 0.3;
  outerSeaMesh.renderOrder = -1;
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

  function makeInstances(geometry, material, spots, zoneIndex) {
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
    registerZoneMaterial(zoneIndex, material);
  }

  // 나무가 모여 있는 정도
  function vegetationMask(type, x, z) {
    const n = fbm(x * 0.012 + 20, z * 0.012 + 20, 3);
    if (type === "forest") return 0.25 + 0.75 * smooth(0.35, 0.55, n);
    if (type === "plain") return smooth(0.58, 0.7, n);
    if (type === "mountain") return 0.5 * smooth(0.4, 0.6, n);
    return 1; // 섬
  }

  zones.forEach((z) => {
    const rand = mulberry32(1234 + z.index * 97);
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

    const mat = (hex) =>
      new THREE.MeshStandardMaterial({
        color: hex,
        roughness: 0.9,
        flatShading: true,
      });
    makeInstances(trunkGeo, mat(0x6b4a2b), trunks, z.index);
    makeInstances(pineGeo, mat(0x2f7d3a), pines, z.index);
    makeInstances(roundGeo, mat(0x5f9a3c), rounds, z.index);
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
  const cloudRand = mulberry32(777);
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

  // 구름 베일: 미탐험 구역 위에 낮게 깔린 두꺼운 구름.
  // 저지대는 가리고 높은 봉우리는 구름 위로 솟는다.
  // 구역이 공개되면 위로 걷히며 옅어진다. -> 기존 구름 텍스처 재사용
  const veils = zones.map((z) => {
    const group = new THREE.Group();
    group.visible = VEIL_ENABLED;
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
    group.position.set(z.center.x, y, z.center.z);
    const mats = cloudTextures.map(
      (tex) =>
        new THREE.SpriteMaterial({
          map: tex,
          color: VEIL_COLOR,
          transparent: true,
          opacity: VEIL_OPACITY,
          depthWrite: false,
        }),
    );
    const rand = mulberry32(5000 + z.index * 31);
    if (VEIL_ENABLED) {
      for (let a = 0; a < VEIL_GRID; a++)
        for (let b = 0; b < VEIL_GRID; b++) {
          const puff = new THREE.Sprite(mats[(a + b * 2) % mats.length]);
          const w = 300 + rand() * 120;
          puff.scale.set(w, w * 0.6, 1);
          puff.position.set(
            ((a + 0.5) / VEIL_GRID - 0.5) * ZONE_SIZE + (rand() - 0.5) * 70,
            (rand() - 0.5) * 24,
            ((b + 0.5) / VEIL_GRID - 0.5) * ZONE_SIZE + (rand() - 0.5) * 70,
          );
          group.add(puff);
        }
    }
    root.add(group);
    return { group, mats, y, spin: (rand() - 0.5) * 0.05 };
  });

  function applyVeil(z) {
    const v = veils[z.index];
    if (!VEIL_ENABLED) return;
    const e = ease(z.p);
    const op = VEIL_OPACITY * (1 - e);
    for (const m of v.mats) m.opacity = op;
    v.group.visible = op > 0.01;
    v.group.scale.setScalar(1 + 0.3 * e); // 걷히며 사방으로 퍼짐
    v.group.position.y = v.y + 35 * e; // 위로 올라가며 사라짐
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

  const RING_COLORS = { idle: 0xffa726, active: 0xffe082, passed: 0x5fe08a };
  const rings = [];
  // const ringPositions = RING_PATH.map(
  //   (r) => new THREE.Vector3(r.x, groundMax(r.x, r.z, 60) + r.clearance, r.z),
  // );
  const padTop = new THREE.Vector3(
    LANDING_PAD.x,
    LANDING_PAD.y + 30,
    LANDING_PAD.z,
  );

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
          break;
        }
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
          z = 0;
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
          )
            break;
        }
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
    for (const b of bursts) {
      root.remove(b.pts);
      b.pts.geometry.dispose();
      b.pts.material.dispose();
    }
    bursts.length = 0;
  }

  function buildRings() {
    clearRings();
    const spots = orderByNearest(generateRingSpots(ringRand));
    const positions = spots.map(
      (s) =>
        new THREE.Vector3(
          s.x,
          groundMax(s.x, s.z, 60) + RING_CLEARANCE[s.type],
          s.z,
        ),
    );

    positions.forEach((pos, i) => {
      const next = i < positions.length - 1 ? positions[i + 1] : padTop;
      const normal = next.clone().sub(pos).normalize(); // 링 통과 진행 방향

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
      });
      const main = new THREE.Mesh(
        new THREE.TorusGeometry(RING_RADIUS, tube, 16, 56),
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
      });
    });

    // 첫 링 방향으로 시작 방향을 갱신
    start.direction.copy(positions[0]).sub(start.position).setY(0).normalize();
  }

  function applyRingState(ring) {
    const hex = RING_COLORS[ring.state];
    ring._mat.color.setHex(hex);
    ring._mat.emissive.setHex(hex);
    ring._mat.emissiveIntensity = ring.state === "passed" ? 0.3 : 0.55;
    ring._haloMat.color.setHex(hex);
    ring._haloMat.opacity = ring.state === "passed" ? 0.12 : 0.22;
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

  // 링 통과 성공 파티클
  const bursts = [];
  function spawnBurst(ring) {
    const COUNT = 48;
    const pos = new Float32Array(COUNT * 3);
    const vel = new Float32Array(COUNT * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < COUNT; i++) {
      const a = Math.random() * Math.PI * 2;
      v.set(Math.cos(a), Math.sin(a), 0).applyQuaternion(ring.mesh.quaternion);
      pos[i * 3] = ring.position.x + v.x * ring.radius;
      pos[i * 3 + 1] = ring.position.y + v.y * ring.radius;
      pos[i * 3 + 2] = ring.position.z + v.z * ring.radius;
      const speed = 12 + Math.random() * 18;
      const along = (Math.random() - 0.5) * 14;
      vel[i * 3] = v.x * speed + ring.normal.x * along;
      vel[i * 3 + 1] = v.y * speed + ring.normal.y * along;
      vel[i * 3 + 2] = v.z * speed + ring.normal.z * along;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x9dffb8,
      size: 3.5,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    root.add(pts);
    bursts.push({ pts, vel, age: 0, life: 1.3 });
  }

  function markRingPassed(id) {
    const r = ringById(id);
    if (!r || r.passed) return;
    r.passed = true;
    r.state = "passed";
    r.pop = 0;
    applyRingState(r);
    spawnBurst(r);
    updateReveal(); // 링을 통과할 때마다 지형이 조금씩 밝아짐
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

  const markMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.6,
  });
  const bar = (w, d, x) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), markMat);
    m.position.set(x, 1.3, 0);
    return m;
  };
  pad.add(padBase, padRing, bar(3.2, 22, -7), bar(3.2, 22, 7), bar(17, 3.2, 0));
  root.add(pad);

  // 멀리서도 보이게
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffd54f,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 7, 140, 20, 1, true),
    beamMat,
  );
  beam.position.set(LANDING_PAD.x, LANDING_PAD.y + 70, LANDING_PAD.z);
  root.add(beam);

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
  // ignoreY: 높이(y)는 무시하고 수평(x, z) 거리로만 판정 (ExplorationSystem 1줄 수정과 함께 사용)
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

  // 링 통과 개수에 따라 각 구역이 도달할 밝기(0~1)를 정한다.
  // 실제 색 변화는 update()에서 진행된다.
  function updateReveal() {
    const total = rings.length;
    const globalRate = total ? rings.filter((r) => r.passed).length / total : 0;
    // 링이 있는 지형은 해당 지형의 통과율 / 링이 없는 지형(평원)은 null
    const own = zones.map((z) => {
      if (REVEAL_MODE !== "terrain") return globalRate;
      if (!RING_TERRAINS.includes(z.type)) return null;
      const same = rings.filter((r) => r.terrain === z.type);
      return same.length
        ? same.filter((r) => r.passed).length / same.length
        : 0;
    });
    zones.forEach((z, i) => {
      let target = own[i];
      if (target === null) {
        // 평원: 맞닿은 지형 구역들의 평균을 따라가며 함께 밝아진다
        const nb = [];
        for (const [dc, dr] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const c = z.col + dc,
            r = z.row + dr;
          if (c < 0 || r < 0 || c >= ZONE_GRID || r >= ZONE_GRID) continue;
          const v = own[r * ZONE_GRID + c];
          if (v !== null) nb.push(v);
        }
        target = nb.length
          ? nb.reduce((a, b) => a + b, 0) / nb.length
          : globalRate;
      }
      if (target > z.target + 1e-6) z.flash = 1; // 새로 밝아지는 순간 효과
      z.target = target;
    });
  }

  // 전체 탐험률 (통과한 링 / 전체 링), 0~1
  function getExplorationRate() {
    return rings.length
      ? rings.filter((r) => r.passed).length / rings.length
      : 0;
  }

  // 지형별 통과 현황 { mountain: { passed, total }, ... }
  function getTerrainProgress() {
    const out = {};
    for (const type of RING_TERRAINS) {
      const same = rings.filter((r) => r.terrain === type);
      out[type] = {
        passed: same.filter((r) => r.passed).length,
        total: same.length,
      };
    }
    return out;
  }

  // 새 게임: 지형을 회색조로 되돌리고, 링을 새로 랜덤 배치한다.
  function reset() {
    zones.forEach((z) => {
      z.p = 0;
      z.target = 0;
      z.flash = 0;
      applyZoneTint(z);
    });
    syncSeaReveal();
    refreshTerrainColors();
    buildRings();
    setActiveRing(1);
  }

  // 매 프레임 갱신 조건
  function update(delta, planePosition) {
    elapsed += delta;

    // 탐험 연출: 구역 밝기가 목표값으로  변함 + 공개 순간 반짝임(flash)이 사라짐
    let dirty = false;
    const tintStep = delta / 1.6;
    for (const z of zones) {
      let changed = false;
      if (z.p !== z.target) {
        z.p =
          z.p < z.target
            ? Math.min(z.target, z.p + tintStep)
            : Math.max(z.target, z.p - tintStep);
        changed = true;
      }
      if (z.flash > 0) {
        z.flash = Math.max(0, z.flash - delta / 1.1);
        changed = true;
      }
      if (changed) {
        applyZoneTint(z);
        dirty = true;
      }
    }
    if (dirty) {
      syncSeaReveal();
      refreshTerrainColors();
    }

    // 물결 (셰이더가 시간으로 계산)
    waterTime.value = elapsed;

    // 구름 베일이 천천히 맴도는 모양
    for (const v of veils)
      if (v.group.visible) v.group.rotation.y += v.spin * delta;

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
        r._haloMat.opacity = 0.3 + 0.2 * Math.sin(elapsed * 5);
        r.mesh.scale.setScalar(1 + 0.04 * Math.sin(elapsed * 5));
      }
      if (r.pop < 1) {
        // 통과 시 팝 애니메이션
        r.pop = Math.min(1, r.pop + delta / 0.5);
        r.mesh.scale.setScalar(1 + 0.35 * Math.sin(Math.PI * r.pop));
      }
    }

    // 통과 파티클
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.age += delta;
      const arr = b.pts.geometry.attributes.position.array;
      for (let k = 0; k < arr.length; k++) arr[k] += b.vel[k] * delta;
      b.pts.geometry.attributes.position.needsUpdate = true;
      b.pts.material.opacity = Math.max(0, 1 - b.age / b.life);
      if (b.age >= b.life) {
        root.remove(b.pts);
        b.pts.geometry.dispose();
        b.pts.material.dispose();
        bursts.splice(i, 1);
      }
    }

    beamMat.opacity = 0.18 + 0.05 * Math.sin(elapsed * 2); // H 구역 조명

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
    heightTex.dispose(); // 물 셰이더용 높이 텍스처 해제
    scene.remove(root);
  }
  reset(); // 초기 상태: 전체 회색조, 링 랜덤 배치, 첫 링 강조

  return {
    root,
    update,
    dispose,
    reset,
    getGroundHeight: (x, z) => Math.max(heightAt(x, z), SEA_LEVEL), // 지면 충돌 판정용 (바다는 수면 높이)
    setWind: (x, z) => {
      wind.x = x;
      wind.z = z;
    }, // 바람 방향 바꾸기 (구름 이동)
    rings,
    setActiveRing,
    markRingPassed,
    getRingData, // 링
    getExplorationRate,
    getTerrainProgress, // 탐험률
    zones,
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
