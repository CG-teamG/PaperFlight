// ============================================================
// 파일명: Landmarks.js
// 담당자: 팀원 A - 3D 그래픽
// 역할: 지형별 조형물(마을/꽃밭/전망대/통나무 다리/산장/돌탑/케이블카/바위 아치/현수교/야영지/등대/부표 + 설송/오두막/산정호수/후두/사막식물/텀블위드/바위집/선박장/돛단배)을
//       한 곳에서 만들고 매 프레임 갱신한다.
//   - planLandmarks(env): 지형 생성 "전에" 부지(평탄화/나무·링 회피)를 정한다 (순수 함수, seed 고정)
//   - createLandmarks(THREE, ctx, plan): 지형 생성 "후에" 메시를 만든다
//   - update(): 바람 세기를 부드럽게 따라가고, 각 조형물의 탐험 반응(불/연기/개화)을 갱신한다
// ============================================================
import { createKit, smooth } from './LandmarkKit.js';
import { SmokeSystem } from './LandmarkSmoke.js';
import { buildVillages } from './builders/village.js';
import { buildFlowers } from './builders/flowers.js';
import { buildForest } from './builders/forest.js';
import { buildMountain } from './builders/mountain.js';
import { buildCanyon } from './builders/canyon.js';
import { buildSea } from './builders/sea.js';
import { buildAlpine } from './builders/alpine.js';
import { buildDesert } from './builders/desert.js';
import { buildHangBridges } from './builders/bridge2.js';
import { buildHarbor } from './builders/harbor.js';

export { planLandmarks } from './LandmarkPlanner.js';

// ctx: { heightAt, applyReveal, revealAtXZ, revealUniforms, HALF }
export function createLandmarks(THREE, ctx, plan) {
  const kit = createKit(THREE, ctx);
  const smoke = new SmokeSystem(THREE, kit);
  const group = new THREE.Group();
  group.name = 'Landmarks';

  const builders = [
    buildVillages(kit, plan, group, smoke),
    buildFlowers(kit, plan, group),
    buildForest(kit, plan, group),
    buildMountain(kit, plan, group, smoke),
    buildCanyon(kit, plan, group, smoke),
    buildSea(kit, plan, group),
    buildAlpine(kit, plan, group, smoke),
    buildDesert(kit, plan, group),
    buildHarbor(kit, plan, group, smoke),
    buildHangBridges(kit, plan, group),
  ].filter(Boolean);
  smoke.build(group);

  const landmarks = builders.flatMap((b) => b.landmarks ?? []);
  let power = 0; // 부드럽게 따라가는 바람 세기 0~1
  let dirX = 1,
    dirZ = 0;
  let elapsed = 0;
  const frame = { delta: 0, time: 0, waterTime: 0, storm: 0, windX: 1, windZ: 0, k: 0, windAngle: 0 };

  return {
    group,
    landmarks,
    // wind: { x, z } (Environment.wind 와 동일), waterTime: 바다 셰이더 시간(부표 높이를 맞추기 위함)
    update(delta, time, wind, waterTime) {
      elapsed = time;
      const len = Math.hypot(wind.x, wind.z) || 1;
      // 평소 바람은 (1,0) 단위, 폭풍에는 18~42 -> 0~1 세기로 환산
      const target = smooth(1.5, 30, len);
      const a = 1 - Math.exp(-delta * 1.6);
      power += (target - power) * a;
      dirX += (wind.x / len - dirX) * a;
      dirZ += (wind.z / len - dirZ) * a;
      const dl = Math.hypot(dirX, dirZ) || 1;
      kit.time.value = time;
      kit.wind.value.set(dirX / dl, dirZ / dl, power);

      frame.delta = delta;
      frame.time = time;
      frame.waterTime = waterTime ?? time;
      frame.storm = power;
      frame.windX = dirX / dl;
      frame.windZ = dirZ / dl;
      frame.k = power;
      frame.windAngle = Math.atan2(-frame.windZ, frame.windX);

      for (const b of builders) b.update(frame);
      smoke.update(delta);
      for (const l of landmarks) if (!l.discovered && (ctx.revealTrue ?? ctx.revealAtXZ)(l.x, l.z) > 0.5) l.discovered = true;
    },
    reset() {
      power = 0;
      dirX = 1;
      dirZ = 0;
      for (const l of landmarks) l.discovered = false;
      for (const b of builders) b.reset?.();
      smoke.reset();
    },
    getProgress() {
      const total = landmarks.length;
      return { total, found: landmarks.filter((l) => l.discovered).length };
    },
    getWindPower: () => power,
    debug: () => builders.map((b) => b.debug?.()).filter(Boolean), // 개발용: 내부 상태 확인
    getElapsed: () => elapsed,
    dispose() {
      for (const b of builders) b.dispose?.();
      smoke.mesh?.geometry.dispose();
      smoke.mesh?.material.dispose();
      kit.dispose();
      group.removeFromParent();
    },
  };
}
