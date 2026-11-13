// ============================================================
// 파일명: FlightTrail.js
// 담당자: 선유 - 3D 그래픽 (비행 궤적의 선 시각 효과)
// 역할: 비행기가 지나간 위치를 일정 간격으로 저장하고, 저장된 점들을 이어 3D 궤적(가는 튜브)을 그린다.
//
// 사용 (게임 장면):
//   const trail = new FlightTrail(THREE)
//   scene.add(trail.mesh)
//   매 프레임: trail.update(airplane.position)
//   새 게임:   trail.reset()
//   결과 화면: trail.points  (= [{x, y, z}, ...]) 를 탐험 지도에 넘긴다
//
// 구현: 점 하나당 4개 정점(사각 단면)을 미리 만들어 둔 버퍼에 이어 붙이고 drawRange만 늘린다.
// ============================================================
// 높이에 따른 궤적 색: 낮을수록 밝은 하늘색, 높을수록 어두운 남색
//   반환값: (y, out) => out(THREE.Color)  — y는 월드 높이

export const HEIGHT_COLOR = {
  minY: 20,
  maxY: 450,
  low: 0x9ae6ff,
  high: 0x22379c,
};
export function createHeightColorFn(THREE, opts = {}) {
  const { minY, maxY, low, high } = { ...HEIGHT_COLOR, ...opts };
  const lo = new THREE.Color(low);
  const hi = new THREE.Color(high);
  return (y, out) => {
    const t = Math.min(1, Math.max(0, (y - minY) / (maxY - minY)));
    return out.copy(lo).lerp(hi, t * t * (3 - 2 * t));
  };
}

export class FlightTrail {
  constructor(THREE, options = {}) {
    const {
      maxPoints = 6000, // 저장할 수 있는 최대 점 개수
      spacing = 8, // 새 점을 저장
      radius = 0.9, // 궤적 두께(반지름)
      color = 0x8fe8ff, // 기본 색
      opacity = 1,
      fog = false, // 궤적이 안개에 묻히지 않도록
      headGap = 0, // 비행기 바로 뒤 이 개수의 점은 그리지 않도록
      colorFn = null, // (y, outColor) => Color : 점을 저장할 때 그 높이(y)에 따라 색을 정하도록
    } = options;

    this.THREE = THREE;
    this.maxPoints = maxPoints;
    this.spacing = spacing;
    this.radius = radius;
    this.headGap = headGap;
    this.colorFn = colorFn;
    this.color = new THREE.Color(color);
    this.points = []; // [{ x, y, z }]
    this.count = 0;

    this._pos = new Float32Array(maxPoints * 4 * 3);
    this._col = new Float32Array(maxPoints * 4 * 3);
    this._idx = new Uint32Array((maxPoints - 1) * 4 * 6);
    this._dirs = []; // 각 점의 진행 방향 (첫 점 보정용)
    this._tmp = {
      dir: new THREE.Vector3(),
      right: new THREE.Vector3(),
      up: new THREE.Vector3(),
      ref: new THREE.Vector3(),
      c: new THREE.Color(),
    };

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this._pos, 3).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(this._col, 3).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.setIndex(
      new THREE.BufferAttribute(this._idx, 1).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.setDrawRange(0, 0);

    this.mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        transparent: opacity < 1,
        opacity,
        toneMapped: false,
        fog,
      }),
    );
    this.mesh.name = "FlightTrail";
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
  }

  // 점 하나(= 정점 4개 한 겹)를 쓴다. dir: 그 지점에서의 진행 방향
  _writeRing(i, p, dir, color) {
    const { right, up, ref } = this._tmp;
    ref.set(0, 1, 0);
    if (Math.abs(dir.y) > 0.98) ref.set(1, 0, 0);
    right.crossVectors(dir, ref).normalize();
    up.crossVectors(right, dir).normalize();
    const r = this.radius;
    const offs = [
      [right.x, right.y, right.z],
      [up.x, up.y, up.z],
      [-right.x, -right.y, -right.z],
      [-up.x, -up.y, -up.z],
    ];
    for (let k = 0; k < 4; k++) {
      const o = (i * 4 + k) * 3;
      this._pos[o] = p.x + offs[k][0] * r;
      this._pos[o + 1] = p.y + offs[k][1] * r;
      this._pos[o + 2] = p.z + offs[k][2] * r;
      this._col[o] = color.r;
      this._col[o + 1] = color.g;
      this._col[o + 2] = color.b;
    }
  }

  /** 점을 하나 추가한다. color를 생략하면 기본 색. */
  addPoint(p, color = this.color) {
    if (this.count >= this.maxPoints) return false;
    const i = this.count;
    const pt = { x: p.x, y: p.y, z: p.z };
    this.points.push(pt);

    const dir = this._tmp.dir;
    if (i > 0) {
      const prev = this.points[i - 1];
      dir.set(pt.x - prev.x, pt.y - prev.y, pt.z - prev.z);
      if (dir.lengthSq() < 1e-9) dir.set(0, 0, 1);
      dir.normalize();
      if (i === 1) this._writeRing(0, prev, dir, color); // 첫 점은 둘째 점이 생겨야 방향이 정해진다
      this._writeRing(i, pt, dir, color);

      // 이전 겹과 이번 겹을 사각 단면 4면으로 연결
      let o = (i - 1) * 24;
      for (let k = 0; k < 4; k++) {
        const a = (i - 1) * 4 + k;
        const b = (i - 1) * 4 + ((k + 1) % 4);
        const c = i * 4 + k;
        const d = i * 4 + ((k + 1) % 4);
        this._idx.set([a, b, c, b, d, c], o);
        o += 6;
      }
    } else {
      this._writeRing(0, pt, dir.set(0, 0, 1), color);
    }

    this.count++;
    const g = this.mesh.geometry;
    g.setDrawRange(0, Math.max(0, (this.count - 1 - this.headGap) * 24));
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    g.index.needsUpdate = true;
    return true;
  }

  /** 매 프레임 호출: 마지막 점에서 spacing 이상 움직였을 때만 새 점을 저장한다. */
  update(position) {
    const last = this.points[this.points.length - 1];
    if (last) {
      const dx = position.x - last.x;
      const dy = position.y - last.y;
      const dz = position.z - last.z;
      if (dx * dx + dy * dy + dz * dz < this.spacing * this.spacing) return;
    }
    this.addPoint(
      position,
      this.colorFn ? this.colorFn(position.y, this._tmp.c) : this.color,
    );
  }

  /** 저장된 점들로 한 번에 만든다. colorFn(t, out, point): t = 0(시작) ~ 1(끝) → THREE.Color */
  setPoints(points, colorFn) {
    this.reset();
    const n = points.length;
    points.forEach((p, i) => {
      this.addPoint(
        p,
        colorFn ? colorFn(n > 1 ? i / (n - 1) : 0, this._tmp.c, p) : this.color,
      );
    });
  }

  reset() {
    this.points = [];
    this.count = 0;
    this.mesh.geometry.setDrawRange(0, 0);
  }

  /** 결과 화면 등에서 headGap 없이 전부 그리고 싶을 때 */
  showAll() {
    this.mesh.geometry.setDrawRange(0, Math.max(0, (this.count - 1) * 24));
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.removeFromParent();
  }
}
