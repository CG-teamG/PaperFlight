const MIN_SPEED = 5
export const MAX_FLIGHT_SPEED = 100
const SPEED_CHANGE_PER_SECOND = 30

export class FlightController {
  constructor(airplane, speed = 5, { manualRoll = true } = {}) {
    this.airplane = airplane
    this.initialSpeed = speed
    this.speed = speed
    this.maxSpeed = MAX_FLIGHT_SPEED
    this.turnSpeed = 1
    this.keys = {}
    this.inputEnabled = true
    this.manualRoll = manualRoll

    this.onKeyDown = (event) => {
      if (!this.inputEnabled) return
      if (event.code.startsWith('Arrow')) event.preventDefault()
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

  get turnInput() {
    return Number(Boolean(this.keys.ArrowLeft)) - Number(Boolean(this.keys.ArrowRight))
  }

  update(deltaTime) {
    const angle = this.turnSpeed * deltaTime
    const throttle = Number(Boolean(this.keys.KeyW)) - Number(Boolean(this.keys.KeyS))
    if (throttle) {
      const nextSpeed = this.speed + throttle * SPEED_CHANGE_PER_SECOND * deltaTime
      this.speed = Math.min(this.maxSpeed, Math.max(MIN_SPEED, nextSpeed))
    }

    // 요: 기수를 좌우로 회전
    this.airplane.rotateY(angle * this.turnInput)

    // 피치: 기수를 위아래로 회전
    if (this.keys.ArrowUp) {
      this.airplane.rotateX(-angle)
    }
    if (this.keys.ArrowDown) {
      this.airplane.rotateX(angle)
    }

    // 롤: 날개를 좌우로 기울임
    if (this.manualRoll) {
      const roll = Number(Boolean(this.keys.KeyD)) - Number(Boolean(this.keys.KeyA))
      this.airplane.rotateZ(angle * roll)
    }

    // 비행기가 바라보는 방향으로 전진
    this.airplane.translateZ(this.speed * deltaTime)
  }

  reset() {
    this.speed = this.initialSpeed
    this.onBlur()
  }

  setInputEnabled(enabled) {
    this.inputEnabled = enabled
    if (!enabled) this.onBlur()
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
  }
}
