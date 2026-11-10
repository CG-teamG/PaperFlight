// ============================================================
// 파일명: GameScene.js
// 담당자: 팀원 전체 - 기능 통합
// 역할: Three.js 게임 장면을 초기화하고 각 시스템을 연결한다.
// 구현할 기능:
// 1. 3D 장면, 카메라, 렌더러를 생성한다.
// 2. 종이비행기와 주변 환경을 장면에 추가한다.
// 3. 비행, 링 통과, 탐험 시스템을 연결한다.
// 4. 매 프레임 게임 화면을 갱신한다.
// 5. 게임 종료 시 사용한 자원을 정리한다.
// ============================================================

import { createAirplane } from './Airplane.js'
import { configureRenderer, createEnvironment } from './Environment.js'
import { FlightController } from './FlightController.js'
import { createFlightProgress } from './FlightProgress.js'
import { updateFollowCamera } from './FollowCamera.js'

export function createGameScene(THREE, container, onProgress) {
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  configureRenderer(THREE, renderer)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 6500)
  const environment = createEnvironment(THREE, scene)
  const airplane = createAirplane(THREE)
  scene.add(airplane)

  const flight = new FlightController(airplane)
  const progress = createFlightProgress(environment)
  const target = new THREE.Vector3()
  let paused = false
  let previousTime = null

  function placeAirplane() {
    airplane.position.copy(environment.start.position)
    airplane.lookAt(target.copy(airplane.position).add(environment.start.direction))
    progress.update(airplane.position)
  }

  function render() {
    updateFollowCamera(airplane, camera)
    renderer.render(scene, camera)
  }

  function resize() {
    const width = container.clientWidth
    const height = container.clientHeight
    if (!width || !height) return
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height)
    render()
  }

  placeAirplane()
  environment.update(0, airplane.position)
  onProgress(progress.getSnapshot())
  container.appendChild(renderer.domElement)
  const observer = new ResizeObserver(resize)
  observer.observe(container)
  resize()

  renderer.setAnimationLoop((time) => {
    if (paused) return
    const delta = previousTime === null ? 0 : Math.min((time - previousTime) / 1000, 0.05)
    previousTime = time
    flight.update(delta)
    const snapshot = progress.update(airplane.position)
    if (snapshot) onProgress(snapshot)
    environment.update(delta, airplane.position)
    render()
  })

  return {
    setPaused(value) {
      paused = value
      previousTime = null
    },
    reset() {
      previousTime = null
      onProgress(progress.reset())
      placeAirplane()
      environment.update(0, airplane.position)
      render()
    },
    dispose() {
      renderer.setAnimationLoop(null)
      observer.disconnect()
      flight.dispose()
      environment.dispose()
      airplane.traverse((object) => {
        object.geometry?.dispose()
        object.material?.dispose()
      })
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
