export class FlightController {
  constructor(airplane) {
    this.airplane = airplane
    this.speed = 1
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
    // 좌우 키를 누르는 동안 방향 회전
    if (this.keys.ArrowLeft) {
      this.airplane.rotation.y += this.turnSpeed * deltaTime
    }
    if (this.keys.ArrowRight) {
      this.airplane.rotation.y -= this.turnSpeed * deltaTime
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
