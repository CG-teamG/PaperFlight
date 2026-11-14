// ============================================================
// 파일명: ExplorationMap.js
// 담당자: 팀원 A - 3D 그래픽 (결과 화면의 "나만의 탐험 지도")
// 역할: 게임이 끝난 뒤, 이번 판의 맵을 작은 3D 지도로 줄여서 보여 주고
//       그 위에 비행 경로 / 링 / 시작·착륙 지점을 표시한다. 마우스로 돌려 볼 수 있다.
//
// 사용:
//   const map = new ExplorationMap(THREE, OrbitControls, containerElement, mapData, trailPoints)
//   ... 화면을 떠날 때 map.dispose()
//   mapData     = env.getMapData()
//   trailPoints = flightTrail.points
//
// 별도의 WebGLRenderer(작은 캔버스)를 쓰므로 게임 장면과 독립적이다.
// ============================================================
import { createAirplane } from "./Airplane.js";
import { FlightTrail, createHeightColorFn } from "./FlightTrail.js";
import { createPadTexture } from "./padTexture.js";

const Y_SCALE = 1.7; // 높이 과장: 축소하면 산이 납작해 보이므로 키운다
const SEA_COLOR = 0x2f86c4;

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// 게임 셰이더(Environment.js의 revealColor)와 같은 공식: rev 0 = 어두운 회색조, 1 = 원래 색
function revealColor(r, g, b, rev, out) {
  let gray = r * 0.299 + g * 0.587 + b * 0.114;
  gray = lerp(gray, 0.18, (1 - rev) * 0.4);
  const sat = rev * (1 + 0.18 * rev);
  const k = lerp(0.3, 1.04, rev);
  out[0] = Math.max(0, (gray + (r - gray) * sat) * lerp(0.92, 1, rev) * k);
  out[1] = Math.max(0, (gray + (g - gray) * sat) * lerp(0.97, 1, rev) * k);
  out[2] = Math.max(0, (gray + (b - gray) * sat) * lerp(1.08, 1, rev) * k);
}

export class ExplorationMap {
  constructor(THREE, OrbitControls, container, data, trailPoints = []) {
    this.THREE = THREE;
    this.container = container;
    this.data = data;
    this.disposed = false;
    this.lastInteract = -1e9;

    const W = Math.max(200, container.clientWidth);
    const H = Math.max(200, container.clientHeight);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(W, H);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, W / H, 100, 12000); // near를 키워 멀리서도 깊이 값이 정확하도록 (겹친 면 깜빡임 방지)
    this.camera.position.set(1150, 1750, 2050);

    this.scene.add(new THREE.HemisphereLight(0xdcecff, 0x4a4036, 1.35));
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
    sun.position.set(900, 1600, 700);
    this.scene.add(sun);

    this.group = new THREE.Group();
    this.scene.add(this.group);

    this._buildTerrain();
    this._buildSea();
    this._buildMarkers();
    this._buildTrail(trailPoints);
    for (const event of data.routeEvents ?? []) {
      const marker = new THREE.Mesh(new THREE.SphereGeometry(15, 12, 8),
        new THREE.MeshBasicMaterial({ color: event.type === "storm" ? 0xffa444 : 0x75eb9c }));
      marker.position.set(event.x, (event.y ?? this._heightAt(event.x, event.z)) * Y_SCALE + 15, event.z);
      this.group.add(marker);
    }

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 150, 0); // 높이 올라간 궤적도 화면에 들어오도록 약간 위를 본다
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 1200;
    this.controls.maxDistance = 4200;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.enablePan = false;
    this.controls.addEventListener("start", () => {
      this.lastInteract = performance.now();
    });
    this.controls.update();

    this._onResize = () => this.resize();
    window.addEventListener("resize", this._onResize);

    // 처음에는 천천히 저절로 돈다. 사용자가 만지면 잠시 멈췄다가 다시 돈다.
    const loop = (now) => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      this.controls.autoRotate = now - this.lastInteract > 3500;
      this.controls.autoRotateSpeed = 0.9;
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(loop);
  }

  // 지형 높이 (월드 x, z → y), 격자 보간
  _heightAt(x, z) {
    const { grid, heights, mapSize } = this.data;
    const u = ((x + mapSize / 2) / mapSize) * (grid - 1);
    const v = ((z + mapSize / 2) / mapSize) * (grid - 1);
    const i0 = Math.min(grid - 2, Math.max(0, Math.floor(u)));
    const j0 = Math.min(grid - 2, Math.max(0, Math.floor(v)));
    const fu = Math.min(1, Math.max(0, u - i0));
    const fv = Math.min(1, Math.max(0, v - j0));
    const h = (j, i) => heights[j * grid + i];
    return lerp(
      lerp(h(j0, i0), h(j0, i0 + 1), fu),
      lerp(h(j0 + 1, i0), h(j0 + 1, i0 + 1), fu),
      fv,
    );
  }

  // 공개 정도 (월드 x, z → 0~1)
  _revealAt(x, z) {
    const { reveal, mapSize } = this.data;
    const n = reveal.size;
    const u = ((x + mapSize / 2) / mapSize) * n - 0.5;
    const v = ((z + mapSize / 2) / mapSize) * n - 0.5;
    const i0 = Math.floor(u);
    const j0 = Math.floor(v);
    const fu = u - i0;
    const fv = v - j0;
    const at = (j, i) =>
      reveal.data[
        Math.min(n - 1, Math.max(0, j)) * n + Math.min(n - 1, Math.max(0, i))
      ];
    const r = lerp(
      lerp(at(j0, i0), at(j0, i0 + 1), fu),
      lerp(at(j0 + 1, i0), at(j0 + 1, i0 + 1), fu),
      fv,
    );
    return smooth(0.08, 0.92, r);
  }

  _buildTerrain() {
    const THREE = this.THREE;
    const { grid, heights, colors, mapSize } = this.data;
    const n = grid;
    const positions = new Float32Array(n * n * 3);
    const vcolors = new Float32Array(n * n * 3);
    const tmp = [0, 0, 0];
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        const x = -mapSize / 2 + (i / (n - 1)) * mapSize;
        const z = -mapSize / 2 + (j / (n - 1)) * mapSize;
        positions.set([x, heights[k] * Y_SCALE, z], k * 3);
        // 가본 곳은 원래 색, 안 가본 곳은 어두운 회색조 → 비행 경로가 밝은 길처럼 드러난다
        revealColor(
          colors[k * 3],
          colors[k * 3 + 1],
          colors[k * 3 + 2],
          this._revealAt(x, z),
          tmp,
        );
        vcolors.set(tmp, k * 3);
      }
    const index = [];
    for (let j = 0; j < n - 1; j++)
      for (let i = 0; i < n - 1; i++) {
        const a = j * n + i;
        index.push(a, a + n, a + 1, a + 1, a + n, a + n + 1);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(vcolors, 3));
    geo.setIndex(index);
    geo.computeVertexNormals();
    this.terrain = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        roughness: 0.95,
        metalness: 0,
      }),
    );
    this.group.add(this.terrain);
  }

  // 바다: 투명한 수면(공개 상태에 따라 색이 달라짐) + 옆면이 보이는 물 덩어리(디오라마 느낌)
  _buildSea() {
    const THREE = this.THREE;
    const { mapSize } = this.data;
    const SEG = 64;
    const surf = new THREE.PlaneGeometry(mapSize, mapSize, SEG, SEG).rotateX(
      -Math.PI / 2,
    );
    const p = surf.attributes.position;
    const cols = new Float32Array(p.count * 3);
    const base = new THREE.Color(SEA_COLOR);
    const tmp = [0, 0, 0];
    for (let k = 0; k < p.count; k++) {
      revealColor(
        base.r,
        base.g,
        base.b,
        this._revealAt(p.getX(k), p.getZ(k)),
        tmp,
      );
      cols.set(tmp, k * 3);
    }
    surf.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    const water = new THREE.Mesh(
      surf,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.62,
        roughness: 0.25,
        depthWrite: false,
      }),
    );
    water.position.y = 0.5;
    water.renderOrder = 1;
    this.group.add(water);

    const depth = 90;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(mapSize, depth, mapSize),
      new THREE.MeshStandardMaterial({
        color: 0x1c5a86,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    );
    body.position.y = -depth / 2 - 1;
    body.renderOrder = 0;
    this.group.add(body);

    const base2 = new THREE.Mesh(
      new THREE.BoxGeometry(mapSize + 60, 36, mapSize + 60),
      new THREE.MeshStandardMaterial({ color: 0x0f1f2c, roughness: 0.9 }),
    );
    base2.position.y = -depth - 20;
    this.group.add(base2);
  }

  _buildMarkers() {
    const THREE = this.THREE;
    const { rings, start, landing } = this.data;
    const y = (x, z) => this._heightAt(x, z) * Y_SCALE;

    // 링: 통과한 링은 초록, 놓친 링은 속이 빈 회색
    for (const r of rings) {
      const { x, y: ry, z } = r.position;
      const color = r.passed ? 0x5fe08a : 0xb8c4cc;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r.radius * 1.9, r.radius * 0.28, 10, 36),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: r.passed ? 0.55 : 0.12,
          transparent: !r.passed,
          opacity: r.passed ? 1 : 0.55,
        }),
      );
      ring.position.set(x, ry * Y_SCALE, z);
      ring.lookAt(x + r.normal.x, ry * Y_SCALE + r.normal.y, z + r.normal.z);
      this.group.add(ring);
    }

    // 시작 지점: 흰 깃발
    const sx = start.x;
    const sz = start.z;
    const sy = y(sx, sz);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 3, 120, 8),
      new THREE.MeshStandardMaterial({ color: 0xffffff }),
    );
    pole.position.set(sx, sy + 60, sz);
    const flag = new THREE.Mesh(
      new THREE.ConeGeometry(26, 60, 3).rotateZ(-Math.PI / 2),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x9fd8ff,
        emissiveIntensity: 0.5,
      }),
    );
    flag.position.set(sx + 30, sy + 100, sz);
    this.group.add(pole, flag);

    // 착륙 지점: 게임 속과 같은 "H" 패드 + 멀리서도 보이는 밝은 빛기둥 (시작 깃발과 같은 계열의 빛기둥)
    const ly = y(landing.x, landing.z);
    this.padTex = createPadTexture(THREE);
    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(landing.radius * 3.8, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        map: this.padTex,
        toneMapped: false,
        polygonOffset: true, // 받침 윗면보다 항상 앞에 그려지게 깊이를 살짝 당긴다
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );
    pad.position.set(landing.x, ly + 5, landing.z); // 받침 윗면(ly + 4)보다 1 위: 같은 높이에서 겹쳐 깜빡이는(z-fighting) 문제 해결
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(
        landing.radius * 3.8,
        landing.radius * 3.8,
        8,
        48,
      ),
      new THREE.MeshStandardMaterial({ color: 0x555b63, roughness: 0.8 }),
    );
    rim.position.set(landing.x, ly + 0, landing.z);
    const beacon = (color, height) =>
      new THREE.Mesh(
        new THREE.CylinderGeometry(11, 16, height, 16, 1, true),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        }),
      );
    const padBeam = beacon(0xffc233, 420);
    padBeam.position.set(landing.x, ly + 210, landing.z);
    const startBeam = beacon(0x9fe8ff, 300); // 시작 지점은 하늘색 빛기둥
    startBeam.position.set(sx, sy + 150, sz);
    this.group.add(rim, pad, padBeam, startBeam);
  }

  // 비행 궤적: 높이에 따라 색이 달라진다 (낮을수록 밝은 하늘색, 높을수록 어두운 남색)
  // + 지면에 드리운 그림자 경로(높이를 읽기 쉽게)
  _buildTrail(points) {
    const THREE = this.THREE;
    if (!points.length) return;
    const pts = points.map((p) => ({
      x: p.x,
      y: p.y * Y_SCALE,
      z: p.z,
      rawY: p.y,
      breakBefore: p.breakBefore,
    }));
    const heightColor = createHeightColorFn(THREE); // 색은 실제 높이(rawY) 기준 (지도의 높이 과장과 무관)
    const gradient = (t, out, p) => heightColor(p.rawY, out);

    this.trail = new FlightTrail(this.THREE, {
      maxPoints: Math.max(2, pts.length),
      radius: 10,
      fog: false,
    });
    this.trail.setPoints(pts, gradient);
    this.group.add(this.trail.mesh);

    const shadowPts = points.map((p) => ({
      x: p.x,
      y: this._heightAt(p.x, p.z) * Y_SCALE + 3,
      breakBefore: p.breakBefore,
      z: p.z,
    }));
    this.shadow = new FlightTrail(this.THREE, {
      maxPoints: Math.max(2, shadowPts.length),
      radius: 6,
      color: 0x0a1620,
      opacity: 0.55,
      fog: false,
    });
    this.shadow.setPoints(shadowPts);
    this.group.add(this.shadow.mesh);

    // 마지막 위치에 종이비행기
    const last = pts[pts.length - 1];
    const prev = pts[Math.max(0, pts.length - 4)];
    const plane = createAirplane(THREE);
    plane.scale.setScalar(16);
    plane.position.set(last.x, last.y, last.z);
    plane.lookAt(
      last.x + (last.x - prev.x),
      last.y + (last.y - prev.y),
      last.z + (last.z - prev.z) + 0.001,
    );
    this.plane = plane;
    this.group.add(plane);
  }

  resize() {
    const W = Math.max(200, this.container.clientWidth);
    const H = Math.max(200, this.container.clientHeight);
    this.renderer.setSize(W, H);
    this.camera.aspect = W / H;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this._onResize);
    this.controls.dispose();
    this.trail?.dispose();
    this.shadow?.dispose();
    this.padTex?.dispose();
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      if (o.material)
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
          m.dispose(),
        );
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
