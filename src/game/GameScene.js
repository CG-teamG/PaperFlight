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
import { createFlightPath } from './FlightPath.js'
import { createFlightProgress } from './FlightProgress.js'
import { getEmergencyLandingPoint, getFlightContact, isOutsideSurveyArea } from './FlightRules.js'
import { updateFollowCamera } from './FollowCamera.js'

const FLIGHT_SPEED = 20
const STORM_INTERVAL = 45
const HUD_REFRESH_INTERVAL = 0.25
const MAX_FLIGHT_STEP = 0.05
const MAX_FRAME_TIME = 0.5
const FOLLOW_CAMERA = { distance: 24, height: 10, lookAhead: 16 }

export function createGameScene(THREE, container, onProgress, ringDirection, onDocked) {
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  configureRenderer(THREE, renderer)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 6500)
  const environment = createEnvironment(THREE, scene)
  const airplane = new THREE.Group()
  airplane.name = 'Airplane'
  const airplaneModel = createAirplane(THREE)
  airplaneModel.name = 'AirplaneModel'
  airplane.add(airplaneModel)
  scene.add(airplane)

  const flight = new FlightController(airplane, FLIGHT_SPEED, { manualRoll: false })
  const progress = createFlightProgress(environment)
  const target = new THREE.Vector3()
  const ringInView = new THREE.Vector3()
  const previousPosition = new THREE.Vector3()
  const forward = new THREE.Vector3()
  let paused = false
  let previousTime = null
  let timeSinceHudRefresh = 0
  let flightPath
  let recoveries = 0
  const routeEvents = []
  let storm = false
  let docked = false
  let emergencyLanding = null
  let nextStorm = STORM_INTERVAL
  let stormsResolved = 0
  let guidingLanding = false
  let recoveryReason = null
  let elapsed = 0
  let outcome = null

  function placeAirplane() {
    airplane.position.copy(environment.start.position)
    airplaneModel.rotation.z = 0
    progress.start(airplane.position)
    const firstRing = progress.getTarget()
    if (firstRing) {
      target.copy(firstRing.position)
    } else {
      target.copy(airplane.position).add(environment.start.direction)
    }
    airplane.lookAt(target)
  }

  function getGuide() {
    const ring = progress.getTarget()
    return ring && !guidingLanding && !storm
      ? { kind: 'ring', position: ring.position, terrain: ring.terrain }
      : { kind: 'landing', position: environment.landingPad.position }
  }

  function publishProgress(snapshot = progress.getSnapshot()) {
    const guide = getGuide()
    const guidance = {
      ...guide,
      distance: Math.hypot(guide.position.x - airplane.position.x, guide.position.z - airplane.position.z),
      altitude: Math.round(airplane.position.y - guide.position.y),
    }
    airplane.getWorldDirection(forward)
    onProgress({
      heading: Math.atan2(forward.x, -forward.z) * 180 / Math.PI,
      routeEvents: routeEvents.slice(),
      ...snapshot,
      storm,
      autoLanding: emergencyLanding !== null && !docked,
      stormCountdown: storm || docked ? null : Math.max(0, Math.ceil(nextStorm - elapsed)),
      stormsResolved,
      ...flightPath.getSnapshot(),
      speed: flight.speed,
      recoveries,
      recoveryReason,
      outsideSurveyArea: isOutsideSurveyArea(airplane.position, environment.mapSize),
      elapsed: Math.floor(elapsed),
      guidance,
      landingPad: environment.landingPad.position,
      outcome,
    })
    timeSinceHudRefresh = 0
  }

  function finish(reason) {
    paused = true
    flight.setInputEnabled(false)
    outcome = reason
    publishProgress()
  }

  function dock() {
    docked = true
    routeEvents.push({ type: 'landing', x: airplane.position.x, z: airplane.position.z })
    finish(storm ? 'sheltered' : 'landed')
    render()
    onDocked?.(storm)
  }

  function updateRingDirection() {
    if (!ringDirection) return

    const guide = getGuide()
    if (guide.kind !== 'landing') {
      ringDirection.hidden = true
      return
    }

    camera.updateMatrixWorld()
    ringInView.copy(guide.position).applyMatrix4(camera.matrixWorldInverse)
    const { x, y, z } = ringInView
    ringInView.applyMatrix4(camera.projectionMatrix)
    const visible = z < -camera.near && z > -camera.far &&
      Math.abs(ringInView.x) <= 1 && Math.abs(ringInView.y) <= 1
    ringDirection.hidden = false
    ringDirection.dataset.inView = String(visible)
    ringDirection.dataset.turn = x < 0 ? 'left' : 'right'
    const directionX = visible ? ringInView.x : x * camera.projectionMatrix.elements[0]
    const directionY = visible ? ringInView.y : y * camera.projectionMatrix.elements[5]
    const edgeScale = Math.max(Math.abs(directionX), Math.abs(directionY)) || 1
    ringDirection.style.setProperty('--guide-x', `${50 + 39 * directionX / (visible ? 1 : edgeScale)}%`)
    ringDirection.style.setProperty('--guide-y', `${50 - 34 * directionY / (visible ? 1 : edgeScale)}%`)
    if (!visible) {
      const angle = storm
        ? Math.abs(x) < 0.001 ? Math.PI / 2 : Math.sign(x) * Math.PI / 2
        : Math.hypot(x, y) < 0.001 ? Math.PI : Math.atan2(x, y)
      ringDirection.style.setProperty('--ring-angle', `${angle}rad`)
    }
  }

  function render() {
    const extraSpeed = Math.max(0, flight.speed - FLIGHT_SPEED)
    updateFollowCamera(airplane, camera, {
      distance: FOLLOW_CAMERA.distance + extraSpeed * 0.12,
      height: FOLLOW_CAMERA.height + extraSpeed * 0.06,
      lookAhead: FOLLOW_CAMERA.lookAhead + extraSpeed * 0.2,
    })
    updateRingDirection()
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
  flightPath = createFlightPath(airplane.position)
  environment.update(0, airplane.position)
  publishProgress()
  container.appendChild(renderer.domElement)
  const observer = new ResizeObserver(resize)
  observer.observe(container)
  resize()

  function applyStormWind(delta) {
    const gust = Math.sin(elapsed * 2.1)
    const strength = 0.6 + 0.4 * gust
    const drift = Math.min(19, flight.speed * 0.58) * strength
    const sideGust = Math.sin(elapsed * 1.4) * 0.7
    airplane.position.x += drift * delta
    airplane.position.z += drift * sideGust * delta
    airplane.rotateY(Math.sin(elapsed * 3.1) * strength * 0.58 * delta)
    airplane.rotateX(Math.sin(elapsed * 4.3) * strength * 0.27 * delta)
    environment.setWind(18 + strength * 24, 8 + sideGust * 12)
    return Math.sin(elapsed * 4.4) * strength * 0.52
  }

  function stepFlight(delta) {
    elapsed += delta
    if (emergencyLanding) {
      emergencyLanding.elapsed += delta
      const progress = Math.min(emergencyLanding.elapsed / 2, 1)
      airplane.position.lerpVectors(emergencyLanding.start, emergencyLanding.destination, progress)
      flightPath.update(airplane.position)
      if (progress === 1) dock()
      else if ((timeSinceHudRefresh += delta) >= HUD_REFRESH_INTERVAL) publishProgress()
      return
    }
    const stormStarted = !storm && elapsed >= nextStorm
    if (stormStarted) {
      storm = true
      routeEvents.push({ type: 'storm', x: airplane.position.x, z: airplane.position.z })
      environment.setStorm(true)
      progress.suspendSurvey()
    }
    previousPosition.copy(airplane.position)
    flight.update(delta)
    const windBank = storm ? applyStormWind(delta) : 0
    const landingPoint = storm && getEmergencyLandingPoint(environment.landingPad.position, airplane.position)
    if (landingPoint) {
      emergencyLanding = {
        start: airplane.position.clone(),
        destination: new THREE.Vector3(landingPoint.x, landingPoint.y, landingPoint.z),
        elapsed: 0,
      }
      airplane.lookAt(emergencyLanding.destination)
      airplaneModel.rotation.z = 0
      flightPath.update(airplane.position)
      flight.setInputEnabled(false)
      publishProgress()
      return
    }
    airplaneModel.rotation.z = THREE.MathUtils.damp(airplaneModel.rotation.z, -flight.turnInput * 0.35 + windBank, 8, delta)
    const contact = getFlightContact(environment, previousPosition, airplane.position, flight.speed)
    if (contact) airplane.position.copy(contact.position)
    flightPath.update(airplane.position)
    let snapshot
    if (!storm) {
      snapshot = progress.update(airplane.position, airplane.getWorldDirection(forward))
    }

    if (contact?.outcome === 'landed') {
      dock()
      return
    }
    if (contact?.outcome === 'recovered') {
      recoveries += 1
      recoveryReason = contact.reason
      flight.reset()
      placeAirplane()
      if (storm) progress.suspendSurvey()
      flightPath.resumeAt(airplane.position)
    }

    timeSinceHudRefresh += delta
    if (stormStarted || contact || snapshot || timeSinceHudRefresh >= HUD_REFRESH_INTERVAL) publishProgress(snapshot ?? undefined)
  }

  renderer.setAnimationLoop((time) => {
    if (paused) return
    const delta = previousTime === null ? 0 : Math.min((time - previousTime) / 1000, MAX_FRAME_TIME)
    previousTime = time
    let remaining = delta
    while (remaining > 0 && !paused) {
      const step = Math.min(remaining, MAX_FLIGHT_STEP)
      stepFlight(step)
      remaining -= step
    }
    if (paused) return
    environment.update(delta, airplane.position)
    render()
  })

  return {
    setPaused(value) {
      paused = value || docked
      previousTime = null
      flight.setInputEnabled(!paused && !emergencyLanding)
    },
    setLandingGuide(enabled) {
      guidingLanding = enabled
      publishProgress()
      render()
    },
    finish() {
      if (storm) return false
      finish('manual')
      return true
    },
    resolveStorm() {
      if (!docked || !storm) return
      storm = false
      stormsResolved += 1
      nextStorm = elapsed + STORM_INTERVAL
      environment.setStorm(false)
      environment.setWind(1, 0)
      outcome = 'landed'
      publishProgress()
      render()
    },
    takeOff() {
      if (!docked || storm) return
      docked = false
      emergencyLanding = null
      outcome = null
      guidingLanding = false
      flight.reset()
      const pad = environment.landingPad.position
      airplane.position.set(pad.x, pad.y + 30, pad.z)
      airplaneModel.rotation.z = 0
      progress.start(airplane.position)
      airplane.lookAt(target.copy(airplane.position).add(environment.start.direction))
      flightPath.resumeAt(airplane.position)
      publishProgress()
      render()
      paused = false
      previousTime = null
      flight.setInputEnabled(true)
    },
    reset() {
      previousTime = null
      recoveries = 0
      routeEvents.length = 0
      storm = false
      docked = false
      emergencyLanding = null
      nextStorm = STORM_INTERVAL
      stormsResolved = 0
      environment.setStorm(false)
      environment.setWind(1, 0)
      elapsed = 0
      recoveryReason = null
      guidingLanding = false
      outcome = null
      flight.reset()
      progress.reset()
      placeAirplane()
      flightPath = createFlightPath(airplane.position)
      publishProgress()
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
