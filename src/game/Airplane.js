// ============================================================
// 파일명: Airplane.js
// 담당자: 팀원 A - 3D 그래픽
// 역할: 종이비행기의 3D 모델을 생성하고 관리한다.
// 구현할 기능:
// 1. 종이비행기의 기본 형태를 만든다.
// 2. 재질과 색상을 적용한다.
// 3. 비행 제어 시스템에서 사용할 비행기 객체를 반환한다.
// 사용 라이브러리: Three.js
// ============================================================

export function createAirplane(THREE) {
    // TODO: 실제 종이비행기 모델을 구현한다.
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
    return new THREE.Mesh(geometry, material);
}
