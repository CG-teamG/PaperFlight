export class FlightController {
  constructor(airplane) {
    this.airplane = airplane
    this.speed = 5
    this.turnSpeed = 1
    this.keys = {}

    this.onKeyDown = (event) => {
      this.keys[event.code] = true
    }
    this.onKeyUp = (event) => {
      this.keys[event.code] = false
    }
    this.onBlur = () => {
      this.keys = {}
    }

    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
  }

  update(deltaTime) {
    const angle = this.turnSpeed * deltaTime

    // 요: 기수를 좌우로 회전
    if (this.keys.ArrowLeft) {
      this.airplane.rotateY(angle)
    }
    if (this.keys.ArrowRight) {
      this.airplane.rotateY(-angle)
    }

    // 피치: 기수를 위아래로 회전
    if (this.keys.ArrowUp) {
      this.airplane.rotateX(-angle)
    }
    if (this.keys.ArrowDown) {
      this.airplane.rotateX(angle)
    }

    // 롤: 날개를 좌우로 기울임
    if (this.keys.KeyA) {
      this.airplane.rotateZ(-angle)
    }
    if (this.keys.KeyD) {
      this.airplane.rotateZ(angle)
    }

    // 비행기가 바라보는 방향으로 전진
    this.airplane.translateZ(this.speed * deltaTime)
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
  }
}
