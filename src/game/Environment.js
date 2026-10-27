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

// 시작과 착륙 위치
const START = { x: -250, z: -250, altitude: 120 }; // 지면 위 높이
const LANDING_PAD = { x: 250, z: 250, radius: 34, y: 12 };

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

// 링 크기 -> RingSystem에 radius로 넘어감
export const RING_RADIUS = 22;

export const RING_PATH = [
  { x: -60, z: -170, clearance: 50 },
  { x: 120, z: -250, clearance: 60 },
  { x: 300, z: -300, clearance: 90 }, // 산
  { x: 480, z: -480, clearance: 90 },
  { x: 620, z: -700, clearance: 60 }, // 협곡
  { x: 400, z: -800, clearance: 60 },
  { x: 150, z: -650, clearance: 60 },
  { x: -100, z: -700, clearance: 90 }, // 산
  { x: -400, z: -450, clearance: 70 },
  { x: -650, z: -200, clearance: 55 }, // 숲
  { x: -700, z: 200, clearance: 55 },
  { x: -400, z: 350, clearance: 55 },
  { x: -100, z: 300, clearance: 50 },
  { x: 150, z: 260, clearance: 40 }, // 착륙 지점 직전
];

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

export function createEnvironment(THREE, scene) {
  // 환경 객체를 한 그룹에 모아 둔다 -> 나중에 정리(dispose)하기 쉽도록
  const root = new THREE.Group();
  root.name = "Environment";
  scene.add(root);

  let elapsed = 0; // 게임이 시작된 뒤 흐른 시간(초). 링 깜빡임 등에 사용

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
  const ringPositions = RING_PATH.map(
    (r) => new THREE.Vector3(r.x, groundMax(r.x, r.z, 60) + r.clearance, r.z),
  );
  const padTop = new THREE.Vector3(
    LANDING_PAD.x,
    LANDING_PAD.y + 30,
    LANDING_PAD.z,
  );

  ringPositions.forEach((pos, i) => {
    const next = i < ringPositions.length - 1 ? ringPositions[i + 1] : padTop;
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
  }
  // 시작 위치: 서쪽 평원 위, 첫 링을 바라보는 방향
  const startGround = Math.max(heightAt(START.x, START.z), SEA_LEVEL);
  const startPos = new THREE.Vector3(
    START.x,
    startGround + START.altitude,
    START.z,
  );
  const startDir = ringPositions[0].clone().sub(startPos).setY(0).normalize();

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

  // 매 프레임 갱신 조건
  function update(delta, planePosition) {
    elapsed += delta;
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
    scene.remove(root);
  }

  return {
    root,
    update,
    dispose,
    getGroundHeight: (x, z) => Math.max(heightAt(x, z), SEA_LEVEL), // 지면 충돌 판정용 (바다는 수면 높이)
    setWind: (x, z) => {
      wind.x = x;
      wind.z = z;
    }, // 바람 방향 바꾸기 (구름 이동)
    rings,
    setActiveRing,
    markRingPassed,
    getRingData, // 링
    start: { position: startPos, direction: startDir },
  };
}
