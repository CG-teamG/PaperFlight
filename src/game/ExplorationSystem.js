
/**
 * 파일명: ExplorationSystem.js
 * 담당자: 예빈
 * 역할: 종이비행기가 탐험한 지역과 탐험 진행률을 관리한다.
 *
 * 지역의 3D 외형은 Environment.js에서 담당한다.
 * 이 파일에서는 비행기의 위치와 각 지역의 위치를 비교하여
 * 새로운 지역을 발견했는지 확인한다.
 */

export class ExplorationSystem {
    constructor(regions = []) {
        // 탐험할 수 있는 전체 지역 목록
        this.regions = regions;

        // 발견한 지역의 ID를 저장하여 중복 발견을 방지한다.
        this.discoveredRegions = new Set();

        // 전체 탐험 지역 개수
        this.totalRegions = regions.length;
    }

    /**
     * 탐험할 지역 목록을 설정한다.
     *
     * 각 지역은 다음 형태의 정보를 가진다.
     * {
     *   id: 1,
     *   name: "Forest",
     *   position: { x: 0, y: 0, z: -20 },
     *   radius: 30
     * }
     *
     * position은 지역의 중심 좌표이다.
     * radius는 비행기가 해당 지역을 발견할 수 있는 범위이다.
     * radius를 생략하면 기본값으로 30을 사용한다.
     */
    setRegions(regions) {
        this.regions = regions;

        // 전체 지역 개수를 갱신한다.
        this.totalRegions = regions.length;

        // 새로운 지역 목록으로 설정할 때 발견 기록을 초기화한다.
        this.discoveredRegions.clear();
    }

    /**
     * 비행기의 현재 위치를 확인하여
     * 새롭게 발견한 지역 목록을 반환한다.
     */
    update(airplanePosition) {
        // 비행기 위치가 없거나 탐험할 지역이 없으면 종료한다.
        if (!airplanePosition || this.regions.length === 0) {
            return [];
        }

        // 이번 업데이트에서 새롭게 발견한 지역 목록
        const discoveredNow = [];

        for (const region of this.regions) {
            // 이미 발견한 지역은 다시 처리하지 않는다.
            if (this.discoveredRegions.has(region.id)) {
                continue;
            }

            // 지역의 중심 좌표와 탐험 범위를 가져온다.
            const center = region.position;
            const radius = region.radius ?? 30;

            // 중심 좌표가 없는 지역은 탐험 판정에서 제외한다.
            if (!center) {
                continue;
            }

            // 비행기와 지역 중심점 사이의 X, Y, Z 거리 차이를 계산한다.
            const dx = airplanePosition.x - center.x;
            const dy = airplanePosition.y - center.y;
            const dz = airplanePosition.z - center.z;

            // 3차원 공간에서 비행기와 지역 중심점 사이의 거리
            const distance = Math.sqrt(
                dx * dx + dy * dy + dz * dz
            );

            // 비행기가 지역의 탐험 범위 안에 들어오면 발견 처리한다.
            if (distance <= radius) {
                this.discoveredRegions.add(region.id);
                discoveredNow.push(region);
            }
        }

        // 이번 업데이트에서 새롭게 발견한 지역 목록을 반환한다.
        return discoveredNow;
    }

    /**
     * 현재 탐험 진행률을 백분율로 반환한다.
     *
     * 전체 지역 중 발견한 지역의 비율을 계산한다.
     * 예: 전체 4개 중 2개를 발견했다면 50을 반환한다.
     */
    getProgress() {
        // 탐험할 지역이 없으면 진행률은 0%이다.
        if (this.totalRegions === 0) {
            return 0;
        }

        return Math.round(
            (this.discoveredRegions.size / this.totalRegions) * 100
        );
    }

    // 지금까지 발견한 지역의 개수를 반환한다.
    getDiscoveredCount() {
        return this.discoveredRegions.size;
    }

    // 전체 탐험 지역의 개수를 반환한다.
    getTotalRegions() {
        return this.totalRegions;
    }

    /**
     * 특정 지역을 이미 발견했는지 확인한다.
     * 발견한 지역이면 true, 아직 발견하지 않았다면 false를 반환한다.
     */
    isDiscovered(regionId) {
        return this.discoveredRegions.has(regionId);
    }

    // 게임을 다시 시작할 때 발견 기록을 초기화한다.
    reset() {
        this.discoveredRegions.clear();
    }
}
