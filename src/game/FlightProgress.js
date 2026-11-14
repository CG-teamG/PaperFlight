import { RINGS_PER_TERRAIN } from './Environment.js'
import { BASE_RING_POINTS, RingSystem } from './RingSystem.js'

export const LANDING_BONUS_POINTS = 500
export const DISCOVERY_RING_TARGET = RINGS_PER_TERRAIN

export const EMPTY_FLIGHT_PROGRESS = Object.freeze({
  score: 0,
  ringPoints: 0,
  landingPoints: 0,
  passedRings: 0,
  totalRings: 0,
  completedTerrains: 0,
  totalTerrains: 0,
  terrains: [],
  award: null,
  storm: false,
  speed: 0,
  distance: 0,
  path: [],
  recoveries: 0,
  landingPad: null,
  outcome: null,
  elapsed: 0,
  guidance: null,
  recoveryReason: null,
  outsideSurveyArea: false,
})

export function createFlightProgress(environment) {
  let rings = environment.getRingData()
  const ringSystem = new RingSystem(rings)
  let targetRing = null
  let award = null

  function recommendRing(position, forward) {
    targetRing = null
    let bestCost = Infinity
    let bestObstructed = true
    let bestSurveyProgress = -1
    const terrainProgress = environment.getTerrainProgress()
    const firstGoalDone = Object.values(terrainProgress).some(({ passed, total }) => total > 0 && passed === total)

    for (const ring of rings) {
      if (ringSystem.hasPassed(ring.id)) continue

      const dx = ring.position.x - position.x
      const dy = ring.position.y - position.y
      const dz = ring.position.z - position.z
      const distance = Math.hypot(dx, dy, dz)
      const alignment = forward && distance > 0
        ? (forward.x * dx + forward.y * dy + forward.z * dz) / distance : 1
      let obstructed = false
      const samples = Math.min(24, Math.ceil(Math.hypot(dx, dz) / 60))
      for (let step = 1; step < samples; step++) {
        const t = step / samples
        const ground = environment.getGroundHeight(position.x + dx * t, position.z + dz * t)
        if (ground + 3 > position.y + dy * t) {
          obstructed = true
          break
        }
      }

      const terrain = terrainProgress[ring.terrain]
      const surveyProgress = !firstGoalDone && terrain?.total > 0 ? terrain.passed / terrain.total : 0
      const cost = distance * (1 + (1 - alignment) * 0.5)
      const advancesSurvey = surveyProgress > bestSurveyProgress ||
        (surveyProgress === bestSurveyProgress && cost < bestCost)
      if ((!obstructed && bestObstructed) || (obstructed === bestObstructed && advancesSurvey)) {
        bestCost = cost
        bestObstructed = obstructed
        bestSurveyProgress = surveyProgress
        targetRing = ring
      }
    }

    environment.setActiveRing(targetRing?.id)
  }

  function getSnapshot(outcome) {
    const terrains = Object.entries(environment.getTerrainProgress())
      .map(([type, counts]) => ({ type, ...counts }))
      .filter(({ total }) => total > 0)
      .map((terrain) => ({ ...terrain, discoveryTarget: DISCOVERY_RING_TARGET }))
      .map((terrain) => ({ ...terrain, discovered: terrain.passed >= terrain.discoveryTarget }))

    const ringPoints = ringSystem.getScore()
    const landingPoints = outcome === 'landed' || outcome === 'early-landing' ? LANDING_BONUS_POINTS : 0
    return {
      score: ringPoints + landingPoints,
      ringPoints,
      landingPoints,
      passedRings: ringSystem.getPassedCount(),
      totalRings: rings.length,
      completedTerrains: terrains.filter(({ passed, total }) => passed === total).length,
      totalTerrains: terrains.length,
      terrains,
      award,
    }
  }

  return {
    getSnapshot,
    suspendSurvey() {
      award = null
      ringSystem.clearPosition()
      environment.setActiveRing(undefined)
    },
    getTarget() {
      return targetRing
    },
    start(airplanePosition) {
      ringSystem.clearPosition()
      ringSystem.update(airplanePosition)
      recommendRing(airplanePosition)
    },
    // 매 프레임 월드 좌표를 전달하고, 기록이 바뀔 때만 UI에 반영한다.
    update(airplanePosition, forward) {
      const before = new Map()
      const newlyPassed = ringSystem.update(airplanePosition, (id, ring) => {
        if (!before.has(ring.terrain)) before.set(ring.terrain, environment.getTerrainProgress()[ring.terrain]?.passed ?? 0)
        environment.markRingPassed(id)
      })
      if (newlyPassed === 0) return null

      award = {
        points: BASE_RING_POINTS * newlyPassed,
        discoveries: getSnapshot().terrains.filter(({ type, discoveryTarget, discovered }) =>
          before.has(type) && before.get(type) < discoveryTarget && discovered).map(({ type }) => type),
      }
      recommendRing(airplanePosition, forward)
      return getSnapshot()
    },
    reset() {
      environment.reset()
      rings = environment.getRingData()
      ringSystem.setRings(rings)
      ringSystem.reset()
      targetRing = null
      award = null
    },
  }
}
