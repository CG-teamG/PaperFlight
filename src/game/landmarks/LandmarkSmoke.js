// ============================================================
// 파일명: LandmarkSmoke.js
// 담당자: 팀원 A - 3D 그래픽
// 역할: 굴뚝/모닥불 연기. 연기 알갱이는 전부 GPU(정점 셰이더)가 시간으로 계산하고,
//       CPU는 "이 굴뚝이 켜졌나(emit)" 값만 갱신한다. -> 굴뚝이 수십 개여도 비용이 거의 없다.
//   - 평소: 위로 곧게 퍼지며 옅어짐
//   - 바람/폭풍: 바람 방향으로 휘어지고 길게 끌려간다 (uWind.z = 바람 세기)
//   - 미탐험(회색조) 상태에서는 emit = 0 이라 연기가 나지 않는다
// ============================================================

const PUFFS = 7;

export class SmokeSystem {
  constructor(THREE, kit) {
    this.THREE = THREE;
    this.kit = kit;
    this.emitters = [];
    this.mesh = null;
  }

  // 굴뚝 위치(월드 좌표), 크기 배율. 반환값 = 굴뚝 번호
  add(x, y, z, scale = 1) {
    this.emitters.push({ x, y, z, scale, emit: 0, target: 0 });
    return this.emitters.length - 1;
  }

  setTarget(id, v) {
    this.emitters[id].target = v;
  }

  build(parent) {
    const THREE = this.THREE;
    const n = this.emitters.length;
    if (!n) return;
    const count = n * PUFFS;
    const quad = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.setIndex(quad.index);
    geo.setAttribute('position', quad.getAttribute('position'));
    geo.setAttribute('uv', quad.getAttribute('uv'));
    const aPos = new Float32Array(count * 3);
    this.info = new Float32Array(count * 4);
    this.emitters.forEach((e, i) => {
      for (let p = 0; p < PUFFS; p++) {
        const k = i * PUFFS + p;
        aPos.set([e.x, e.y, e.z], k * 3);
        this.info.set([(p + Math.sin(i * 12.9898) * 0.3 + 0.3) / PUFFS, e.scale, 0, 0], k * 4);
      }
    });
    geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(aPos, 3));
    this.infoAttr = new THREE.InstancedBufferAttribute(this.info, 4);
    geo.setAttribute('aInfo', this.infoAttr);
    geo.instanceCount = count;

    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog]);
    uniforms.uTime = this.kit.time;
    uniforms.uWind = this.kit.wind;
    uniforms.uColor = { value: new THREE.Color(0xd8d2c8) };
    const mat = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      fog: true,
      vertexShader: `
        attribute vec3 aPos;
        attribute vec4 aInfo; // x: 위상, y: 크기, z: 켜짐
        uniform float uTime;
        uniform vec3 uWind;  // 방향 x, z / 세기
        varying vec2 vUv;
        varying float vAlpha;
        #include <fog_pars_vertex>
        void main() {
          float seed = aInfo.x;
          float sc = aInfo.y;
          float em = aInfo.z;
          float t = fract(uTime * (0.13 + 0.08 * uWind.z) + seed);
          vec3 p = aPos;
          p.y += t * 17.0 * sc;
          p.xz += uWind.xy * (t * t * (3.0 + 46.0 * uWind.z) * sc);
          p.xz += vec2(sin(t * 7.0 + seed * 31.0), cos(t * 6.0 + seed * 17.0)) * 0.9 * t * sc;
          float size = (1.4 + 5.5 * t) * sc;
          vAlpha = (1.0 - t) * smoothstep(0.0, 0.1, t) * 0.62 * em;
          vUv = uv;
          vec4 mvPosition = viewMatrix * vec4(p, 1.0);
          mvPosition.xy += position.xy * size * step(0.001, em);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform vec3 uColor;
        varying vec2 vUv;
        varying float vAlpha;
        #include <fog_pars_fragment>
        void main() {
          float a = smoothstep(1.0, 0.15, length(vUv * 2.0 - 1.0)) * vAlpha;
          if (a < 0.003) discard;
          gl_FragColor = vec4(uColor, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.mesh.name = 'LandmarkSmoke';
    parent.add(this.mesh);
    quad.dispose();
  }

  update(delta) {
    if (!this.mesh) return;
    let dirty = false;
    this.emitters.forEach((e, i) => {
      const dir = e.target > e.emit ? 0.55 : 2.2;
      const next = e.emit + Math.max(-dir * delta, Math.min(dir * delta, e.target - e.emit));
      if (Math.abs(next - e.emit) > 1e-4) {
        e.emit = next;
        for (let p = 0; p < PUFFS; p++) this.info[(i * PUFFS + p) * 4 + 2] = next;
        dirty = true;
      }
    });
    if (dirty) this.infoAttr.needsUpdate = true;
  }

  reset() {
    this.emitters.forEach((e, i) => {
      e.emit = 0;
      e.target = 0;
      for (let p = 0; p < PUFFS; p++) this.info[(i * PUFFS + p) * 4 + 2] = 0;
    });
    if (this.infoAttr) this.infoAttr.needsUpdate = true;
  }
}
