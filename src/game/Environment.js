// ============================================================
// 파일명: Environment.js
// 담당자: 팀원 A(문선유) - 3D 그래픽
// 역할: 게임의 3D 환경과 시각적 요소를 생성한다.
// 구현할 기능:
// 1. 지형, 하늘, 구름, 조명을 만든다.
// 2. 링의 외형을 구현한다.
// 3. 그림자와 환경 효과를 추가한다.
// 참고: 링 통과 판정은 RingSystem.js에서 담당한다.
// ============================================================

// 맵 크기
export const MAP_SIZE = 2000;
export const ZONE_GRID = 4;
export const ZONE_SIZE = MAP_SIZE / ZONE_GRID;
const HALF = MAP_SIZE / 2;
const SEA_LEVEL = 0;

// 구역 지형 배치 [z][x]
export const ZONE_LAYOUT = [
  ["mountain", "mountain", "canyon", "canyon"],
  ["forest", "plain", "mountain", "sea"],
  ["forest", "forest", "plain", "sea"],
  ["plain", "forest", "sea", "sea"],
];

const ZONE_TYPES = ZONE_LAYOUT.flat();

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

const TYPE_HEIGHT = {
  plain: (x, z) => 8 + fbm(x * 0.003, z * 0.003, 3) * 18,
  forest: (x, z) => 10 + fbm(x * 0.004, z * 0.004, 4) * 42,
  sea: (x, z) => -35 + fbm(x * 0.005, z * 0.005, 3) * 14,
  mountain: (x, z) => 40 + Math.pow(ridged(x * 0.004, z * 0.004, 5), 1.7) * 330,
  canyon: (x, z) => {
    let h = 80 + fbm(x * 0.006, z * 0.006, 3) * 14;
    const warp = fbm(x * 0.003 + 7.3, z * 0.003 + 1.9, 3) * 4;
    const c = Math.abs(Math.sin(x * 0.0055 + z * 0.002 + warp));
    h -= 66 * (1 - smooth(0.0, 0.38, c)); // 협곡 깎기
    return h * 0.6 + Math.round(h / 10) * 10 * 0.4; // 지층(계단) 느낌
  },
};

function heightAt(x, z) {
  let h = 0;
  for (const [zi, w] of cornerWeights(x, z, 0.5)) {
    if (w < 1e-4) continue;
    h += w * TYPE_HEIGHT[ZONE_TYPES[zi]](x, z);
  }
  // 맵 가장자리는 바다로 가라앉힘
  const edge = Math.max(Math.abs(x), Math.abs(z));
  h = lerp(h, -40, smooth(HALF - 140, HALF, edge));
  return h;
}

// 지형 색상 (높이 + 지형 종류)
function groundColor(THREE, h, type, x, z, out, tmp) {
  const n = (hash2(Math.round(x / 10), Math.round(z / 10)) - 0.5) * 0.08;
  if (h < -3)
    out.setHex(0x3b6477); // 해저
  else if (h < 5)
    out.setHex(0xe6d8a2); // 모래/해안
  else if (type === "mountain") {
    out
      .setHex(0x6b9a4d)
      .lerp(tmp.setHex(0x8b8279), smooth(60, 130, h))
      .lerp(tmp.setHex(0xf5f8fb), smooth(175, 240, h)); // 산의 정상은 눈이 덮이게
  } else if (type === "forest") {
    out.setHex(0x4e8a3a).lerp(tmp.setHex(0x7a6a4a), smooth(70, 130, h));
  } else if (type === "canyon") {
    const t = 0.5 + 0.5 * Math.sin(h * 0.45); // 붉은 지층 줄무늬
    out.setHex(0xc8683c).lerp(tmp.setHex(0xe09a62), t);
    if (h > 78) out.lerp(tmp.setHex(0xcfa56a), 0.5);
  } else {
    out.setHex(0x8fbf5b).lerp(tmp.setHex(0x6fa04a), fbm(x * 0.01, z * 0.01, 2));
  }
  out.offsetHSL(0, 0, n);
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

export function createEnvironment(THREE, scene) {
  // 환경 객체를 한 그룹에 모아 둔다 -> 나중에 정리(dispose)하기 쉽도록
  const root = new THREE.Group();
  root.name = "Environment";
  scene.add(root);

  const tmpColor = new THREE.Color(); // 색을 섞을 때 쓰는 임시 색 (groundColor에 전달)

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
  const SEG = 200; // 200 x 200 칸, 정점은 10unit 간격
  const terrainGeo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, SEG, SEG);
  terrainGeo.rotateX(-Math.PI / 2); // 눕혀서 바닥으로
  const pos = terrainGeo.attributes.position;
  const baseColors = new Float32Array(pos.count * 3);
  const c1 = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h); // 높이 적용

    // 색을 정할 때 쓸 대표 지형 (영향이 가장 큰 구역)
    let best = 0,
      bw = -1;
    for (const [zi, w] of cornerWeights(x, z, 0.5))
      if (w > bw) {
        bw = w;
        best = zi;
      }
    groundColor(THREE, h, ZONE_TYPES[best], x, z, c1, tmpColor);
    baseColors.set([c1.r, c1.g, c1.b], i * 3);
  }
  terrainGeo.setAttribute("color", new THREE.BufferAttribute(baseColors, 3));
  terrainGeo.computeVertexNormals(); // 높이가 바뀌었으니 음영 재계산

  const terrain = new THREE.Mesh(
    terrainGeo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.95,
      metalness: 0,
    }),
  );
  terrain.receiveShadow = true;
  terrain.castShadow = true;
  root.add(terrain);

  // 매 프레임 갱신 조건
  function update(delta, planePosition) {
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
    scene.remove(root);
  }

  return {
    root,
    update,
    dispose,
    getGroundHeight: (x, z) => Math.max(heightAt(x, z), SEA_LEVEL), // 지면 충돌 판정용 (바다는 수면 높이)
  };
}
