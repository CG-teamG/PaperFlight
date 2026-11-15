// ============================================================
// 파일명: LandmarkKit.js
// 담당자: 팀원 A - 3D 그래픽
// 역할: 조형물 공통 도구
//   1. GeoBuilder  : 여러 도형을 "정점 색"과 함께 하나의 지오메트리로 합친다 (Environment의 mergeGeometries는 색을 버려서 새로 만듦)
//   2. material()  : 탐험 공개(회색조 -> 컬러, applyReveal) + 바람 흔들림 + 꽃 개화 + 창문 점등을 한 재질에 끼워 넣는다
//   3. LitSet      : 창문/등불처럼 "탐험하면 켜지는" 인스턴스 묶음
//   4. Lamp        : 점등 상태(지연 후 서서히 켜짐)
// ============================================================

const TAU = Math.PI * 2;
export const clamp01 = (v) => Math.min(1, Math.max(0, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 유럽 시골 팔레트 (링 색: 주황/하늘색/초록과 겹치지 않게 채도를 낮춘 따뜻한 색 위주)
export const COLORS = {
  cream: 0xf0e2c0,
  ochre: 0xe0b97a,
  white: 0xf3ecdc,
  terracotta: 0xb5573a,
  terracotta2: 0xa24d37,
  slate: 0x5a5f69,
  darkWood: 0x6d4a3a,
  wood: 0x9a6b3f,
  lightWood: 0xb98d5a,
  bark: 0x8c6239,
  stone: 0xa79c88,
  stoneLight: 0xd8c7a0,
  stoneDark: 0x7d756a,
  glass: 0x2b3440,
  shutterSage: 0x5f8a62,
  shutterRed: 0x8d3a30,
  shutterBlue: 0x5d7893,
  road: 0xc9b88f,
  fence: 0xe9dfc6,
  hay: 0xd9b95c,
  steel: 0x7d8790,
  rope: 0x6b5a45,
  canvas: 0xe8dcc0,
};


// 창문 한 장: 유리(탐험하면 켜지는 LitSet용 빌더) + 프레임/덧창(벽 빌더). 벽면 위치 (x,y,z), 벽이 향한 각도 ry
export function addWindow(body, glass, x, y, z, ry, shutter = null, size = [2.0, 2.5]) {
  const c = Math.cos(ry),
    s = Math.sin(ry);
  const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const [w, h] = size;
  let [px, pz] = at(0, 0.05);
  body.box(COLORS.white, w + 0.7, h + 0.7, 0.25, px, y, pz, ry);
  [px, pz] = at(0, 0.13);
  glass.box(COLORS.glass, w, h, 0.3, px, y, pz, ry);
  if (shutter)
    for (const sx of [-(w / 2 + 0.65), w / 2 + 0.65]) {
      [px, pz] = at(sx, 0.1);
      body.box(shutter, 0.95, h + 0.2, 0.2, px, y, pz, ry);
    }
}

// ------------------------------------------------------------
// GeoBuilder
// ------------------------------------------------------------
export class GeoBuilder {
  constructor(THREE) {
    this.THREE = THREE;
    this.pos = [];
    this.col = [];
    this.w = [];
    this.head = [];
    this.useW = false;
    this.useHead = false;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
    this._c = new THREE.Color();
    this._up = new THREE.Vector3(0, 1, 0);
    this._unitBox = new THREE.BoxGeometry(1, 1, 1);
    this._gable = this._makeGable();
  }

  _makeGable() {
    // x: [-.5,.5] (용마루 방향), z: [-.5,.5], y: [0,1] 의 박공지붕
    const v = [
      [-0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 1, 0],
      [-0.5, 0, 0.5, 0.5, 1, 0, -0.5, 1, 0],
      [0.5, 0, -0.5, -0.5, 0, -0.5, -0.5, 1, 0],
      [0.5, 0, -0.5, -0.5, 1, 0, 0.5, 1, 0],
      [-0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 1, 0],
      [0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 1, 0],
    ].flat();
    const g = new this.THREE.BufferGeometry();
    g.setAttribute('position', new this.THREE.Float32BufferAttribute(v, 3));
    return g;
  }

  // color: hex | THREE.Color | (x,y,z) => THREE.Color  (변환 후 좌표 기준)
  add(geometry, color, matrix, { w = 0, head = 0 } = {}) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    g.applyMatrix4(matrix);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i);
      const c = typeof color === 'function' ? color(x, y, z) : this._c.set(color);
      this.pos.push(x, y, z);
      this.col.push(c.r, c.g, c.b);
      this.w.push(w);
      this.head.push(head);
    }
    if (w) this.useW = true;
    if (head) this.useHead = true;
    g.dispose();
    return this;
  }

  matrix(px, py, pz, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
    this._e.set(rx, ry, rz, 'YXZ');
    this._q.setFromEuler(this._e);
    return this._m.compose(this._p.set(px, py, pz), this._q, this._s.set(sx, sy, sz));
  }

  // 상자: 중심(x,y,z), 크기(w,h,d), 회전(ry, rx, rz)
  box(color, w, h, d, x, y, z, ry = 0, rx = 0, rz = 0, opts) {
    return this.add(this._unitBox, color, this.matrix(x, y, z, rx, ry, rz, w, h, d), opts);
  }

  cyl(color, rTop, rBot, h, x, y, z, seg = 8, ry = 0, rx = 0, rz = 0, opts) {
    const g = new this.THREE.CylinderGeometry(rTop, rBot, h, seg);
    this.add(g, color, this.matrix(x, y, z, rx, ry, rz), opts);
    g.dispose();
    return this;
  }

  cone(color, r, h, x, y, z, seg = 6, ry = 0, opts) {
    const g = new this.THREE.ConeGeometry(r, h, seg);
    this.add(g, color, this.matrix(x, y, z, 0, ry, 0), opts);
    g.dispose();
    return this;
  }

  ico(color, r, x, y, z, sx = 1, sy = 1, sz = 1, detail = 0, ry = 0, opts) {
    const g = new this.THREE.IcosahedronGeometry(r, detail);
    this.add(g, color, this.matrix(x, y, z, 0, ry, 0, sx, sy, sz), opts);
    g.dispose();
    return this;
  }

  // 박공지붕: 용마루는 로컬 x 방향, 바닥 중심(x,y,z), 크기(w: 용마루 길이, d: 폭, h: 높이)
  gable(color, w, d, h, x, y, z, ry = 0) {
    return this.add(this._gable, color, this.matrix(x, y, z, 0, ry, 0, w, h, d));
  }

  // 두 점을 잇는 각재 (정사각 단면)
  beam(color, ax, ay, az, bx, by, bz, t = 0.4, opts) {
    this._a.set(bx - ax, by - ay, bz - az);
    const len = this._a.length();
    if (len < 1e-4) return this;
    this._a.divideScalar(len);
    this._q.setFromUnitVectors(this._up, this._a);
    this._m.compose(this._p.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2), this._q, this._s.set(t, len, t));
    return this.add(this._unitBox, color, this._m, opts);
  }

  // 두 점을 잇는 통나무/밧줄 (원통)
  log(color, ax, ay, az, bx, by, bz, r = 0.4, seg = 6, opts) {
    this._a.set(bx - ax, by - ay, bz - az);
    const len = this._a.length();
    if (len < 1e-4) return this;
    this._a.divideScalar(len);
    const g = new this.THREE.CylinderGeometry(r, r, len, seg);
    this._q.setFromUnitVectors(this._up, this._a);
    this._m.compose(this._p.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2), this._q, this._s.set(1, 1, 1));
    this.add(g, color, this._m, opts);
    g.dispose();
    return this;
  }

  // 삼각형 하나 (정점마다 흔들림 가중치 w: aW 속성)
  tri(color, a, b, c, wa = 0, wb = 0, wc = 0) {
    const col = this._c.set(color);
    for (const [p, w] of [
      [a, wa],
      [b, wb],
      [c, wc],
    ]) {
      this.pos.push(p[0], p[1], p[2]);
      this.col.push(col.r, col.g, col.b);
      this.w.push(w);
      this.head.push(0);
    }
    if (wa || wb || wc) this.useW = true;
    return this;
  }

  build() {
    const g = new this.THREE.BufferGeometry();
    g.setAttribute('position', new this.THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new this.THREE.Float32BufferAttribute(this.col, 3));
    if (this.useW) g.setAttribute('aW', new this.THREE.Float32BufferAttribute(this.w, 1));
    if (this.useHead) g.setAttribute('aHead', new this.THREE.Float32BufferAttribute(this.head, 1));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    this._unitBox.dispose();
    this._gable.dispose();
    return g;
  }
}

// ------------------------------------------------------------
// 점등 상태: 탐험(공개)되면 약간의 지연 뒤에 서서히 켜지고, 마을 집들이 하나씩 켜지는 느낌을 낸다
// ------------------------------------------------------------
export class Lamp {
  constructor(rand, delayRange = [0.2, 2.4]) {
    this.rand = rand;
    this.range = delayRange;
    this.value = 0;
    this.wait = this._newWait();
    this.discovered = false;
  }
  _newWait() {
    return this.range[0] + this.rand() * (this.range[1] - this.range[0]);
  }
  step(revealed, delta, up = 1.1, down = 3.5) {
    if (revealed) {
      this.discovered = true;
      if (this.wait > 0) this.wait -= delta;
      else this.value = Math.min(1, this.value + delta * up);
    } else {
      this.wait = this._newWait();
      this.value = Math.max(0, this.value - delta * down);
    }
    return this.value;
  }
  reset() {
    this.value = 0;
    this.wait = this._newWait();
    this.discovered = false;
  }
}

// ------------------------------------------------------------
// 셰이더 조각
// ------------------------------------------------------------
const VERT_PRELUDE = `
  mat3 lmR = mat3(modelMatrix);
  vec3 lmOrg = modelMatrix[3].xyz;
  #ifdef USE_INSTANCING
    lmR = lmR * mat3(instanceMatrix);
    lmOrg = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
  #endif
  float lmS2 = max(dot(lmR[0], lmR[0]), 1e-4);
  float lmPh = dot(lmOrg.xz, vec2(0.131, 0.173));
  float lmK = uLmWind.z;
  vec3 lmDir = vec3(uLmWind.x, 0.0, uLmWind.y);
  vec3 lmPerp = vec3(-lmDir.z, 0.0, lmDir.x);
`;

// 바람에 휘는 식물/천: 가중치(0 = 고정, 1 = 가장 많이 흔들림) 만큼 바람 방향으로 눕고 떤다.
// uSw = (진폭(월드 단위), 높이, 속도, 0)
const SWAY_BEND = (weightExpr) => `
  {
    float lmW = ${weightExpr};
    lmW = lmW * lmW;
    float o1 = sin(uLmTime * uSw.z * (0.8 + 1.6 * lmK) + lmPh);
    float o2 = sin(uLmTime * uSw.z * 1.7 * (0.8 + 1.3 * lmK) + lmPh * 1.9 + 1.3);
    vec3 d = lmDir * (0.22 + 0.9 * lmK + o1 * (0.1 + 0.55 * lmK)) + lmPerp * (o2 * (0.06 + 0.35 * lmK));
    transformed += (transpose(lmR) * (d * uSw.x * lmW)) / lmS2;
  }
`;

// 깃발: 로컬 +x 로 뻗은 천 (x = 0 이 깃대). 깃발 전체의 방향은 CPU가 바람 쪽으로 돌려 준다.
// uSw = (진폭, 깃발 길이, 속도, 0)
const SWAY_FLAG = `
  {
    float fw = clamp(position.x / uSw.y, 0.0, 1.0);
    float wave = sin(position.x * 1.3 - uLmTime * uSw.z * (1.0 + 2.2 * lmK)) * uSw.x * fw * (0.3 + 0.9 * lmK);
    transformed.z += wave;
    transformed.y += sin(position.x * 0.9 - uLmTime * uSw.z * 1.3) * uSw.x * 0.25 * fw * lmK;
  }
`;

// 현수교: 가운데일수록 크게 옆으로 흔들리고 위아래로 출렁인다. 메시가 월드 원점에 있고 좌표가 월드 좌표라고 가정.
// uBr = (시작 x, 시작 z, 축 x, 축 z), uBrLen = 길이, uSw.x = 진폭
const SWAY_BRIDGE = `
  {
    float t = clamp(dot(position.xz - uBr.xy, uBr.zw) / uBrLen, 0.0, 1.0);
    float w = sin(3.14159 * t);
    float amp = uSw.x * (0.15 + 1.25 * lmK);
    float s1 = sin(uLmTime * uSw.z * (0.7 + 0.8 * lmK) + t * 3.0);
    float s2 = sin(uLmTime * uSw.z * 1.9 + t * 5.0);
    vec3 lat = vec3(-uBr.w, 0.0, uBr.z);
    transformed += lat * (amp * w * s1) + vec3(0.0, 1.0, 0.0) * (amp * 0.35 * w * s2) + lmDir * (amp * 0.4 * w * lmK);
  }
`;

// 꽃 개화: 비행기가 지나가 공개된 정도(공개 텍스처)에 따라 닫힌 꽃봉오리(고개 숙임, 작고 녹색) -> 활짝 핀 꽃
const BLOOM = `
  vec4 lmRv = texture2D(uRevealTex, (lmOrg.xz + uRevealInfo.x) / uRevealInfo.y);
  float lmJ = fract(lmPh * 7.31);
  float lmB = smoothstep(0.42 + 0.22 * lmJ, 0.82 + 0.16 * lmJ, max(lmRv.r, uRevealForce));
  float lmDr = 1.0 - lmB;
  if (aHead > 0.5) {
    transformed = uHead + (transformed - uHead) * (mix(0.3, 1.0, lmB) * (1.0 + 0.4 * lmRv.g));
  }
  {
    float lmA = fract(lmPh * 3.77) * 6.2831;
    float yy = max(transformed.y, 0.0);
    transformed.xz += vec2(cos(lmA), sin(lmA)) * lmDr * yy * yy * 0.28 * uHeadK;
    transformed.y -= lmDr * yy * yy * 0.1 * uHeadK;
  }
  #if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
    vColor.rgb = mix(vColor.rgb, vColor.rgb * 0.35 + vec3(0.03, 0.07, 0.015), aHead * lmDr * 0.85);
  #endif
`;

export function createKit(THREE, ctx) {
  const time = { value: 0 };
  const wind = { value: new THREE.Vector3(1, 0, 0.2) }; // x, z: 바람 방향(정규화), z: 세기(0~1)
  const materials = [];
  const textures = [];

  // swayMode: null | 'bend' (높이 비례) | 'attr' (정점 가중치 aW) | 'hang' (아래로 늘어진 것) | 'flag' | 'bridge'
  // lit: null | 'attr' (인스턴스 속성 aLit) | 'uniform' (uLit)
  function material(opts = {}) {
    const {
      key = 'static',
      swayMode = null,
      sway = [0.5, 2, 2, 0],
      bloom = null,
      lit = null,
      litColor = [1.0, 0.7, 0.3],
      litStrength = 1.9,
      uniforms = {},
      roughness = 0.92,
      extra = {},
    } = opts;
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness,
      metalness: 0,
      side: THREE.DoubleSide,
      ...extra,
    });
    ctx.applyReveal(mat);
    const revealHook = mat.onBeforeCompile;
    const sw = { value: new THREE.Vector4(...sway) };
    const litU = { value: 0 };
    mat.userData.sway = sw;
    mat.userData.lit = litU;
    mat.onBeforeCompile = (shader, renderer) => {
      revealHook(shader, renderer);
      shader.uniforms.uLmTime = time;
      shader.uniforms.uLmWind = wind;
      shader.uniforms.uSw = sw;
      shader.uniforms.uLit = litU;
      Object.assign(shader.uniforms, uniforms);

      const needPrelude = swayMode || bloom;
      let vDecl = '';
      if (needPrelude) vDecl += 'uniform float uLmTime;\nuniform vec3 uLmWind;\nuniform vec4 uSw;\n';
      if (bloom)
        vDecl +=
          'uniform sampler2D uRevealTex;\nuniform vec2 uRevealInfo;\nuniform float uRevealForce;\nuniform vec3 uHead;\nuniform float uHeadK;\nattribute float aHead;\n';
      if (swayMode === 'attr') vDecl += 'attribute float aW;\n';
      if (swayMode === 'bridge') vDecl += 'uniform vec4 uBr;\nuniform float uBrLen;\n';
      if (lit === 'attr') vDecl += 'attribute float aLit;\nvarying float vLit;\n';

      let vBody = '';
      if (needPrelude) vBody += VERT_PRELUDE;
      if (bloom) vBody += BLOOM;
      if (swayMode === 'bend') vBody += SWAY_BEND('clamp(transformed.y / uSw.y, 0.0, 1.0)');
      if (swayMode === 'hang') vBody += SWAY_BEND('clamp(-transformed.y / uSw.y, 0.0, 1.0)');
      if (swayMode === 'attr') vBody += SWAY_BEND('aW');
      if (swayMode === 'flag') vBody += SWAY_FLAG;
      if (swayMode === 'bridge') vBody += SWAY_BRIDGE;
      if (lit === 'attr') vBody += 'vLit = aLit;\n';

      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${vDecl}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${vBody}`);

      if (lit) {
        const c = `vec3(${litColor.map((v) => v.toFixed(3)).join(',')})`;
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', `#include <common>\n${lit === 'attr' ? 'varying float vLit;' : 'uniform float uLit;'}`)
          .replace(
            '#include <emissivemap_fragment>',
            `#include <emissivemap_fragment>\ntotalEmissiveRadiance += ${c} * ${lit === 'attr' ? 'vLit' : 'uLit'} * ${litStrength.toFixed(2)};`,
          );
      }
    };
    mat.customProgramCacheKey = () => `lm-${key}`; // applyReveal 의 'reveal-v1' 을 덮어써야 프로그램이 섞이지 않는다
    materials.push(mat);
    return mat;
  }

  // 길/개울 같은 땅 위의 띠
  function ribbonMaterial(opts = {}) {
    const { key = 'ribbon', color = 0xffffff, map = null, opacity = 1 } = opts;
    const mat = new THREE.MeshStandardMaterial({
      color,
      map,
      roughness: 1,
      metalness: 0,
      vertexColors: true,
      side: THREE.DoubleSide, // 띠의 감는 방향과 상관없이 위에서 보이게
      transparent: opacity < 1,
      opacity,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    ctx.applyReveal(mat);
    mat.customProgramCacheKey = () => `lm-${key}`;
    materials.push(mat);
    return mat;
  }

  // 땅 위를 따라가는 띠 지오메트리 (지형 높이를 따라 y를 맞춘다)
  function makeRibbon(points, width, colorHex, yOff = 0.5, uvPerUnit = 0.12) {
    const n = points.length;
    const pos = new Float32Array(n * 2 * 3);
    const uv = new Float32Array(n * 2 * 2);
    const col = new Float32Array(n * 2 * 3);
    const nor = new Float32Array(n * 2 * 3);
    const c = new THREE.Color(colorHex);
    let acc = 0;
    for (let i = 0; i < n; i++) {
      const p = points[i];
      const a = points[Math.max(0, i - 1)],
        b = points[Math.min(n - 1, i + 1)];
      let dx = b.x - a.x,
        dz = b.z - a.z;
      const l = Math.hypot(dx, dz) || 1;
      dx /= l;
      dz /= l;
      if (i > 0) acc += Math.hypot(p.x - points[i - 1].x, p.z - points[i - 1].z);
      const wdt = (p.w ?? width) / 2;
      for (let s = 0; s < 2; s++) {
        const side = s ? 1 : -1;
        const x = p.x - dz * wdt * side,
          z = p.z + dx * wdt * side;
        const k = i * 2 + s;
        pos.set([x, ctx.heightAt(x, z) + yOff, z], k * 3);
        uv.set([s, acc * uvPerUnit], k * 2);
        col.set([c.r, c.g, c.b], k * 3);
        nor.set([0, 1, 0], k * 3);
      }
    }
    const idx = [];
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  }

  const shared = {
    static: material({ key: 'static' }),
    window: material({ key: 'window', lit: 'attr', roughness: 0.4 }),
  };

  // 창문/등불: 탐험하면 켜지는 인스턴스 묶음
  class LitSet {
    constructor(geometry, count) {
      this.count = count;
      this.lit = new Float32Array(count);
      this.attr = new THREE.InstancedBufferAttribute(this.lit, 1);
      geometry.setAttribute('aLit', this.attr);
      this.mesh = new THREE.InstancedMesh(geometry, shared.window, count);
      this.mesh.frustumCulled = false;
      this.dirty = false;
    }
    setMatrix(i, m) {
      this.mesh.setMatrixAt(i, m);
      this.mesh.instanceMatrix.needsUpdate = true;
    }
    set(i, v) {
      if (Math.abs(this.lit[i] - v) > 0.004) {
        this.lit[i] = v;
        this.dirty = true;
      }
    }
    commit() {
      if (!this.dirty) return;
      this.attr.needsUpdate = true;
      this.dirty = false;
    }
  }

  // 아주 작은 줄무늬 텍스처 (개울 물결용)
  function streakTexture() {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#9fd0ee';
    g.fillRect(0, 0, 64, 128);
    const rand = mulberry32(42);
    for (let i = 0; i < 26; i++) {
      g.fillStyle = `rgba(255,255,255,${0.25 + rand() * 0.4})`;
      const x = rand() * 60,
        y = rand() * 120,
        l = 10 + rand() * 24;
      g.fillRect(x, y, 2 + rand() * 4, l);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    textures.push(t);
    return t;
  }

  return {
    THREE,
    ctx,
    time,
    wind,
    material,
    ribbonMaterial,
    makeRibbon,
    LitSet,
    streakTexture,
    staticMat: shared.static,
    windowMat: shared.window,
    builder: () => new GeoBuilder(THREE),
    mesh(geometry, mat, { cast = true, receive = true } = {}) {
      const m = new THREE.Mesh(geometry, mat ?? shared.static);
      m.castShadow = cast;
      m.receiveShadow = receive;
      m.frustumCulled = false;
      return m;
    },
    ground: (x, z) => ctx.heightAt(x, z),
    dispose() {
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
    TAU,
  };
}
