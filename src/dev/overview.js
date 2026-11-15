// ============================================================
// 개발용 전체 지도 뷰어 (npm run dev 후 /overview.html?seed=123)
//  - 게임 없이 환경 + 조형물만 띄워서, 마우스로 맵을 돌려 보며 조형물을 확인한다.
//  - 버튼: 전체 공개 / 탐험 시뮬레이션(맵을 훑는 비행) / 폭풍 바람 / 시드 바꾸기
//  - URL: ?seed=숫자  (같은 시드 = 같은 맵과 같은 조형물 배치)
//  - window.viewer: 자동 점검(puppeteer)용 훅
// ============================================================
import * as THREE from "three";
import { configureRenderer, createEnvironment } from "../game/Environment.js";
import { OverviewCamera } from "../game/OverviewCamera.js";

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 1234) | 0;
const view = document.getElementById("view");
const hud = document.getElementById("hud");

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
});
configureRenderer(THREE, renderer);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 2, 6500);
const env = createEnvironment(THREE, scene, { worldRingGuide: false, seed });
const cam = new OverviewCamera(THREE, camera, renderer.domElement, {
  limit: env.mapSize / 2,
});
view.appendChild(renderer.domElement);
cam.enable();
cam.autoRotate = params.get("rotate") !== "0";

const plane = new THREE.Vector3(0, 150, 0);
const state = {
  full: params.get("full") !== "0",
  storm: params.get("storm") === "1",
  survey: false,
  t: 0,
};
env.setOverview(state.full);

function applyStorm() {
  env.setStorm(state.storm);
  if (state.storm) env.setWind(26, 10);
  else env.setWind(1, 0);
}
applyStorm();

function resize() {
  const w = innerWidth,
    h = innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
addEventListener("resize", resize);
resize();

// 탐험 시뮬레이션: 지그재그로 날며 공개를 넓힌다 (탐험 반응: 불/연기/개화 확인용)
function surveyStep(delta) {
  state.t += delta * 0.00035 * 1000;
  const lanes = 6;
  const u = (state.t * lanes) % lanes;
  const lane = Math.floor(u);
  const f = u - lane;
  const z = -850 + (lane / (lanes - 1)) * 1700;
  plane.set(lane % 2 ? 900 - f * 1800 : -900 + f * 1800, 140, z);
}

const clock = new THREE.Clock();
let steps = 0;
function frame() {
  const delta = Math.min(clock.getDelta(), 0.1);
  if (state.survey && !state.pin) surveyStep(delta);
  env.update(delta, plane, { survey: state.survey });
  cam.update(delta);
  renderer.render(scene, camera);
  steps++;
  refreshHud();
}
renderer.setAnimationLoop(frame);

function refreshHud() {
  if (steps % 20) return;
  const c = env.landmarkPlan?.counts?.() ?? {};
  const p = env.landmarks?.getProgress?.() ?? { found: 0, total: 0 };
  hud.querySelector("#info").textContent =
    `seed ${seed} · 탐험 ${Math.round(env.getExplorationRate() * 100)}% · 조형물 ${p.found}/${p.total}\n` +
    JSON.stringify(c);
}

hud.innerHTML = `
  <b>전체 지도 뷰어</b><br/>
  <button id="b-full">전체 공개 on/off</button>
  <button id="b-survey">탐험 시뮬레이션</button>
  <button id="b-storm">폭풍 바람</button>
  <button id="b-seed">다른 시드</button>
  <div>드래그=회전 · 우클릭/Shift 드래그=이동 · 휠=확대 · <code>R</code>=처음 시점</div>
  <pre id="info" style="white-space:pre-wrap;margin:6px 0 0;font-size:11px"></pre>`;
hud.querySelector("#b-full").onclick = () =>
  env.setOverview((state.full = !state.full));
hud.querySelector("#b-survey").onclick = () => (state.survey = !state.survey);
hud.querySelector("#b-storm").onclick = () => {
  state.storm = !state.storm;
  applyStorm();
};
hud.querySelector("#b-seed").onclick = () => {
  params.set("seed", String(Math.floor(Math.random() * 1e6)));
  location.search = params.toString();
};

window.viewer = {
  THREE,
  env,
  cam,
  camera,
  renderer,
  state,
  plane,
  pinPlane: (x, y, z) => {
    state.pin = true;
    state.survey = true;
    plane.set(x, y, z);
  },
  focusOn: (x, z, dist = 240, pitch = 0.5, yaw = 0.6) =>
    cam.focusOn(x, env.getGroundHeight(x, z), z, dist, pitch, yaw),
  setFull: (on) => env.setOverview((state.full = on)),
  setStorm: (on) => {
    state.storm = on;
    applyStorm();
  },
  ready: true,
};
