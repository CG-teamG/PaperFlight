// ============================================================
// 파일명: ExplorationSystem.js
// 담당자: 팀원 C - 예빈
// 역할: 비행 중 새롭게 발견한 탐험 구역을 기록한다.
// 구현할 기능:
// 1. 탐험할 지형 구역을 정의한다.
// 2. 비행기가 새로운 구역에 진입했는지 확인한다.
// 3. 이미 발견한 구역은 중복 기록하지 않는다.
// 4. 전체 탐험 진행률을 백분율로 계산한다.
// 5. 탐험 결과를 게임 UI에 전달한다.
// ============================================================

export class ExplorationSystem {
    constructor() {
        this.discoveredRegions = new Set();
        this.totalRegions = 0;
    }

    update(airplanePosition) {
        // TODO: 비행기의 위치를 바탕으로 새로운 탐험 구역을 기록한다.
    }

    getProgress() {
        // 전체 탐험 구역이 없으면 진행률을 0으로 반환한다.
        if (this.totalRegions === 0) {
            return 0;
        }

        // 발견한 구역의 비율을 백분율로 계산한다.
        return Math.round(
            (this.discoveredRegions.size / this.totalRegions) * 100
        );
    }
}
