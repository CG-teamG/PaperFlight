
/**
 * 파일명: RingSystem.js
 * 담당자: 예빈
 * 역할: 종이비행기의 링 통과 여부와 점수를 관리한다.
 *
 * 링의 3D 외형은 Environment.js에서 담당한다.
 * 이 파일에서는 링의 위치와 비행기의 이동 경로를 비교한다.
 */

export class RingSystem {
    constructor(rings = []) {
        // 통과 판정에 사용할 링 목록
        this.rings = rings;

        // 지금까지 통과한 링 개수
        this.passedCount = 0;

        // 이미 통과한 링의 ID를 저장하여 중복 점수를 방지한다.
        this.passedRings = new Set();

        // 이전 프레임의 비행기 위치
        this.previousPosition = null;
    }

    /**
     * 링 목록을 설정한다.
     *
     * 각 링은 다음 형태의 정보를 가진다.
     * {
     *   id: 1,
     *   position: { x: 0, y: 0, z: -10 },
     *   radius: 3,
     *   normal: { x: 0, y: 0, z: 1 }
     * }
     *
     * normal은 링의 평면에 수직인 방향이다.
     * 생략하면 Z축 방향을 기본값으로 사용한다.
     */
    setRings(rings) {
        this.rings = rings;
    }

    /**
     * 비행기의 현재 위치를 확인하여
     * 이번 업데이트에서 새롭게 통과한 링 개수를 반환한다.
     */
    update(airplanePosition) {
        if (!airplanePosition) {
            return 0;
        }

        const current = this.toPoint(airplanePosition);

        // 첫 위치에서는 이전 이동 경로가 없으므로 저장만 한다.
        if (!this.previousPosition) {
            this.previousPosition = current;
            return 0;
        }

        const previous = this.previousPosition;
        let newlyPassed = 0;

        for (let i = 0; i < this.rings.length; i++) {
            const ring = this.rings[i];

            // ID가 없으면 배열 순서를 ID 대신 사용한다.
            const ringId = ring.id ?? i;

            // 이미 통과한 링은 다시 점수를 주지 않는다.
            if (this.passedRings.has(ringId)) {
                continue;
            }

            if (this.hasPassedThrough(previous, current, ring)) {
                this.passedRings.add(ringId);
                this.passedCount++;
                newlyPassed++;
            }
        }

        // 다음 프레임의 판정을 위해 현재 위치를 저장한다.
        this.previousPosition = current;

        return newlyPassed;
    }

    /**
     * 이전 위치와 현재 위치를 이용하여 링 통과 여부를 계산한다.
     * 링 평면을 가로질렀고, 교차 지점이 링 내부라면 통과한 것이다.
     */
    hasPassedThrough(previous, current, ring) {
        if (!ring.position || !Number.isFinite(ring.radius)) {
            return false;
        }

        const center = this.toPoint(ring.position);
        const normal = this.normalize(
            ring.normal ?? { x: 0, y: 0, z: 1 }
        );

        if (!normal) {
            return false;
        }

        // 링 평면을 기준으로 이전 위치와 현재 위치의 부호를 계산한다.
        const previousDistance = this.dot(
            this.subtract(previous, center),
            normal
        );

        const currentDistance = this.dot(
            this.subtract(current, center),
            normal
        );

        // 비행기가 링 평면을 실제로 가로지르지 않았다면 통과가 아니다.
        if (
            previousDistance * currentDistance > 0 ||
            previousDistance === currentDistance
        ) {
            return false;
        }

        // 두 위치 사이에서 링 평면과 만나는 지점을 계산한다.
        const t =
            previousDistance /
            (previousDistance - currentDistance);

        const intersection = {
            x: previous.x + (current.x - previous.x) * t,
            y: previous.y + (current.y - previous.y) * t,
            z: previous.z + (current.z - previous.z) * t,
        };

        // 교차 지점에서 링 중심까지의 거리를 계산한다.
        const offset = this.subtract(intersection, center);
        const distanceSquared = this.dot(offset, offset);

        // 링 반지름 안쪽을 통과했는지 확인한다.
        return distanceSquared <= ring.radius * ring.radius;
    }

    /**
     * Three.js Vector3와 일반 좌표 객체를 모두 처리한다.
     */
    toPoint(position) {
        return {
            x: position.x,
            y: position.y,
            z: position.z,
        };
    }

    subtract(a, b) {
        return {
            x: a.x - b.x,
            y: a.y - b.y,
            z: a.z - b.z,
        };
    }

    dot(a, b) {
        return a.x * b.x + a.y * b.y + a.z * b.z;
    }

    normalize(vector) {
        const length = Math.sqrt(this.dot(vector, vector));

        if (length === 0) {
            return null;
        }

        return {
            x: vector.x / length,
            y: vector.y / length,
            z: vector.z / length,
        };
    }

    // 현재까지 통과한 링 개수를 반환한다.
    getPassedCount() {
        return this.passedCount;
    }

    // 현재 점수를 반환한다. 링 하나당 100점이다.
    getScore() {
        return this.passedCount * 100;
    }

    // 게임을 다시 시작할 때 기록을 초기화한다.
    reset() {
        this.passedCount = 0;
        this.passedRings.clear();
        this.previousPosition = null;
    }
}
