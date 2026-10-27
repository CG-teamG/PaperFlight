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

  return { root, update, dispose };
}
