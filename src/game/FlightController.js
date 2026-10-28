export class FlightController {
  constructor(airplane) {
    this.airplane = airplane
    this.speed = 1
  }

  update(deltaTime) {
    // 속도 × 경과 시간만큼 +Z 방향으로 이동
    this.airplane.position.z += this.speed * deltaTime
  }

  dispose() {}
}
