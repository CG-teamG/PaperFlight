// ============================================================
// 미리보기용 게임 연결부 (GameScene 통합 전 확인용)
// 월드(지형·링) + 비행기 + 조종 + 링 판정 + 궤적을 한 장면으로 묶는다.
// ============================================================
import * as THREE from "three";
import { createEnvironment, configureRenderer } from "../game/Environment.js";
import { createAirplane } from "../game/Airplane.js";
import { FlightController } from "../game/FlightController.js";
import { updateFollowCamera } from "../game/FollowCamera.js";
import { RingSystem } from "../game/RingSystem.js";
import { FlightTrail, createHeightColorFn } from "../game/FlightTrail.js";

export function createGameRuntime(container, onStats) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  configureRenderer(THREE, renderer);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 1, 5000);
  const airplane = createAirplane(THREE);
  scene.add(airplane);

  const controller = new FlightController(airplane);
  const ringSystem = new RingSystem();
  const trail = new FlightTrail(THREE, {
    headGap: 3,
    colorFn: createHeightColorFn(THREE),
  }); // 비행 궤적
  scene.add(trail.mesh);

  let env = null;
  let paused = true;
  let lastEmit = 0;
  let firstSeed = new URLSearchParams(location.search).get("seed"); // ?seed=7 : 첫 판만 고정

  function activateNextRing() {
    const next = env.rings.find((r) => !r.passed);
    if (next) env.setActiveRing(next.id);
  }

  // 새 판 시작: 지형·링이 새로 만들어진다 (시드를 안 주면 매번 다른 맵)
  function start() {
    env?.dispose();
    env = createEnvironment(THREE, scene, {
      seed: firstSeed != null ? Number(firstSeed) : undefined,
    });
    firstSeed = null;
    trail.reset();
    ringSystem.reset();
    ringSystem.setRings(env.getRingData());
    airplane.position.copy(env.start.position);
    airplane.quaternion.identity();
    airplane.lookAt(airplane.position.clone().add(env.start.direction));
    activateNextRing();
  }

  // HUD / 결과 화면에 쓸 숫자
  function stats() {
    return {
      score: ringSystem.getScore(),
      passedRings: ringSystem.getPassedCount(),
      totalRings: env.rings.length,
      exploration: Math.round(env.getExplorationRate() * 100),
      discovered: env.getZoneState().filter((z) => z.discovered).length,
      totalRegions: env.zones.length,
    };
  }

  function resize() {
    const w = container.clientWidth || innerWidth;
    const h = container.clientHeight || innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener("resize", resize);

  let prev = performance.now();
  renderer.setAnimationLoop((now) => {
    if (!env) return;
    const dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;

    if (!paused) {
      const k = controller.keys;
      controller.speed = k.ShiftLeft || k.ShiftRight ? 160 : 60; // 맵이 크므로 확인용으로 빠르게 (Shift 가속)
      controller.update(dt);

      const ground = env.getGroundHeight(
        airplane.position.x,
        airplane.position.z,
      );
      if (airplane.position.y < ground + 3) airplane.position.y = ground + 3; // 지면 아래로 못 내려감

      if (ringSystem.update(airplane.position) > 0) {
        for (const id of ringSystem.passedRings) env.markRingPassed(id);
        activateNextRing();
      }
      trail.update(airplane.position);
      env.update(dt, airplane.position); // 지형 공개, 하늘, 링 연출 갱신
      updateFollowCamera(airplane, camera);
    }
    renderer.render(scene, camera);

    if (now - lastEmit > 100) {
      lastEmit = now;
      onStats(stats());
    }
  });

  return {
    start,
    setPaused: (v) => {
      paused = v;
    },
    // 결과 화면용: 최종 숫자 + 탐험 지도 데이터 + 비행 궤적
    getResult: () => ({
      stats: stats(),
      mapData: env.getMapData(),
      trail: trail.points.map((p) => ({ ...p })),
    }),
    dispose() {
      renderer.setAnimationLoop(null);
      removeEventListener("resize", resize);
      controller.dispose();
      trail.dispose();
      env?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
