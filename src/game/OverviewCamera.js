// ============================================================
// 파일명: OverviewCamera.js
// 담당자: 팀원 A - 3D 그래픽
// 역할: 탐험과 별도로, 공중에서 전체 맵을 내려다보는 "전체 지도 보기" 카메라.
//   - 맵 중앙을 도는 궤도 카메라 (기본은 천천히 자동 회전)
//   - 마우스: 왼쪽 드래그 = 회전/기울기, 오른쪽(또는 Shift) 드래그 = 이동, 휠 = 확대/축소
//   - 키보드: ←/→ 회전, ↑/↓ 기울기, W/S 확대/축소, A/D 좌우 이동, R 처음 시점
//   - 공개 데이터는 건드리지 않는다 (Environment.setOverview 가 컬러/구름/안개만 바꿈)
// ============================================================

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const HOME = { yaw: Math.PI * 0.25, pitch: 0.95, distance: 1900 };
const MIN_DISTANCE = 90;
const MAX_DISTANCE = 3200;
const MIN_PITCH = 0.12;
const MAX_PITCH = 1.5;

export class OverviewCamera {
  constructor(THREE, camera, domElement, { limit = 1000 } = {}) {
    this.THREE = THREE;
    this.camera = camera;
    this.dom = domElement;
    this.limit = limit;
    this.active = false;
    this.autoRotate = true;
    this.target = new THREE.Vector3(0, 0, 0);
    this.yaw = HOME.yaw;
    this.pitch = HOME.pitch;
    this.distance = HOME.distance;
    this.keys = {};
    this.drag = null;
    this._right = new THREE.Vector3();
    this._fwd = new THREE.Vector3();

    this.onKeyDown = (e) => {
      if (e.code.startsWith("Arrow") || e.code === "KeyW" || e.code === "KeyS")
        e.preventDefault();
      if (e.code === "KeyR" && !e.repeat) this.home();
      this.keys[e.code] = true;
      this.autoRotate = false;
    };
    this.onKeyUp = (e) => {
      this.keys[e.code] = false;
    };
    this.onBlur = () => {
      this.keys = {};
    };
    this.onPointerDown = (e) => {
      this.drag = {
        x: e.clientX,
        y: e.clientY,
        pan: e.button === 2 || e.shiftKey,
      };
      this.autoRotate = false;
      this.dom.setPointerCapture?.(e.pointerId);
    };
    this.onPointerMove = (e) => {
      if (!this.drag) return;
      const dx = e.clientX - this.drag.x;
      const dy = e.clientY - this.drag.y;
      this.drag.x = e.clientX;
      this.drag.y = e.clientY;
      if (this.drag.pan)
        this.pan(-dx * this.distance * 0.0016, -dy * this.distance * 0.0016);
      else {
        this.yaw -= dx * 0.006;
        this.pitch = clamp(this.pitch + dy * 0.005, MIN_PITCH, MAX_PITCH);
      }
    };
    this.onPointerUp = (e) => {
      this.drag = null;
      this.dom.releasePointerCapture?.(e.pointerId);
    };
    this.onWheel = (e) => {
      e.preventDefault();
      this.distance = clamp(
        this.distance * Math.exp(e.deltaY * 0.0012),
        MIN_DISTANCE,
        MAX_DISTANCE,
      );
      this.autoRotate = false;
    };
    this.onContextMenu = (e) => e.preventDefault();
  }

  get enabled() {
    return this.active;
  }

  enable() {
    if (this.active) return;
    this.active = true;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    this.dom.addEventListener("pointerdown", this.onPointerDown);
    this.dom.addEventListener("pointermove", this.onPointerMove);
    this.dom.addEventListener("pointerup", this.onPointerUp);
    this.dom.addEventListener("pointercancel", this.onPointerUp);
    this.dom.addEventListener("wheel", this.onWheel, { passive: false });
    this.dom.addEventListener("contextmenu", this.onContextMenu);
    this.autoRotate = true;
    this.update(0);
  }

  disable() {
    if (!this.active) return;
    this.active = false;
    this.keys = {};
    this.drag = null;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.dom.removeEventListener("pointerdown", this.onPointerDown);
    this.dom.removeEventListener("pointermove", this.onPointerMove);
    this.dom.removeEventListener("pointerup", this.onPointerUp);
    this.dom.removeEventListener("pointercancel", this.onPointerUp);
    this.dom.removeEventListener("wheel", this.onWheel);
    this.dom.removeEventListener("contextmenu", this.onContextMenu);
  }

  home() {
    this.target.set(0, 0, 0);
    Object.assign(this, {
      yaw: HOME.yaw,
      pitch: HOME.pitch,
      distance: HOME.distance,
    });
  }

  // 특정 지점을 가까이 보기 (뷰어/디버깅용)
  focusOn(x, y, z, distance = 260, pitch = 0.55, yaw = this.yaw) {
    this.target.set(x, y, z);
    this.distance = clamp(distance, MIN_DISTANCE, MAX_DISTANCE);
    this.pitch = clamp(pitch, MIN_PITCH, MAX_PITCH);
    this.yaw = yaw;
    this.autoRotate = false;
    if (this.active) this.update(0);
  }

  // 화면 기준 좌우/앞뒤로 이동
  pan(right, forward) {
    this._right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this._fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.target
      .addScaledVector(this._right, right)
      .addScaledVector(this._fwd, -forward);
    this.target.x = clamp(this.target.x, -this.limit, this.limit);
    this.target.z = clamp(this.target.z, -this.limit, this.limit);
  }

  update(delta) {
    if (!this.active) return;
    const k = this.keys;
    const turn = Number(Boolean(k.ArrowLeft)) - Number(Boolean(k.ArrowRight));
    const tilt = Number(Boolean(k.ArrowUp)) - Number(Boolean(k.ArrowDown));
    const zoom = Number(Boolean(k.KeyS)) - Number(Boolean(k.KeyW));
    const side = Number(Boolean(k.KeyD)) - Number(Boolean(k.KeyA));
    if (this.autoRotate) this.yaw += delta * 0.06;
    this.yaw += turn * delta * 1.1;
    this.pitch = clamp(this.pitch + tilt * delta * 0.7, MIN_PITCH, MAX_PITCH);
    this.distance = clamp(
      this.distance * Math.exp(zoom * delta * 1.1),
      MIN_DISTANCE,
      MAX_DISTANCE,
    );
    if (side) this.pan(side * delta * this.distance * 0.6, 0);

    const cp = Math.cos(this.pitch);
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * cp * this.distance,
      this.target.y + Math.sin(this.pitch) * this.distance,
      this.target.z + Math.cos(this.yaw) * cp * this.distance,
    );
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.target);
  }

  dispose() {
    this.disable();
  }
}
