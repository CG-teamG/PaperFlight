// ============================================================
// 파일명: Airplane.js
// 담당자: 팀원 A(문선유) - 3D 그래픽
// 역할: 종이비행기의 3D 모델을 생성하고 관리한다.
// 구현할 기능:
// 1. 종이비행기의 기본 형태를 만든다.
// 2. 재질과 색상을 적용한다.
// 3. 비행 제어 시스템에서 사용할 비행기 객체를 반환한다.
// 사용 라이브러리: Three.js
// ============================================================

// 모델 크기 배율 (1이면 길이 6, 날개폭 4.8)
export const AIRPLANE_SCALE = 1;

// 종이 색 (왼쪽/오른쪽 날개를 다르게 해서 접힌 느낌을 낸다)
const WING_LEFT_COLOR = 0xfffaf0;
const WING_RIGHT_COLOR = 0xe8e4da;
const KEEL_COLOR = 0xc9c4b8;
const EDGE_COLOR = 0x5b6470;

export function createAirplane(THREE) {
  const S = AIRPLANE_SCALE;
  const airplane = new THREE.Group();
  airplane.name = "Airplane";

  // 모델의 다섯 꼭짓점 (기수 방향 = +Z, 위쪽 = +Y)
  const NOSE = [0, 0, 3]; // 뾰족한 앞부분
  const TAIL = [0, -0.2, -3]; // 가운데 접힘선의 뒤쪽 끝
  const LEFT = [2.4, 0.5, -3]; // 왼쪽 날개 끝 (조종사 기준, +X쪽)
  const RIGHT = [-2.4, 0.5, -3]; // 오른쪽 날개 끝 (조종사 기준, -X쪽)
  const KEEL = [0, -1.0, -3]; // 아래로 내려온 중앙 날개(키일) 끝

  // 삼각형 종이 한 장을 만든다
  function addPaper(a, b, c, color) {
    const points = [...a, ...b, ...c].map((v) => v * S);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(points, 3),
    );
    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.85,
        metalness: 0,
        side: THREE.DoubleSide,
        flatShading: true, // 종이는 앞뒤 모두 보이게
      }),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // 접힌 모서리를 얇은 선으로 표시
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color: EDGE_COLOR }),
    );
    airplane.add(mesh, edges);
  }

  addPaper(NOSE, TAIL, LEFT, WING_LEFT_COLOR); // 왼쪽 날개
  addPaper(NOSE, RIGHT, TAIL, WING_RIGHT_COLOR); // 오른쪽 날개
  addPaper(NOSE, TAIL, KEEL, KEEL_COLOR); // 아래 중앙 날개

  // 다른 코드 구현할 때(FlightController 등) 참고할 정보
  airplane.userData.forward = new THREE.Vector3(0, 0, 1); // 기수 방향 (로컬 좌표)
  airplane.userData.up = new THREE.Vector3(0, 1, 0); // 위쪽 방향 (로컬 좌표)
  airplane.userData.length = 6 * S;
  airplane.userData.wingspan = 4.8 * S;

  return airplane;
}
