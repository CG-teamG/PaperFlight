import { BASE_RING_POINTS, RingSystem } from './RingSystem.js'

export const LANDING_BONUS_POINTS = 500

export function speedBonus(speed) {
  return Math.min(100, Math.max(0, Math.floor((speed - 20) / 2)))
}

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
  let nextRecommendation = 0

  function recommendRing(position, forward, keepCurrent = false) {
    const previous = targetRing
    targetRing = null
    let bestCost = Infinity
    let bestObstructed = true

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

      const cost = distance * (1 + (1 - alignment) * 0.5) * (keepCurrent && ring === previous ? 0.75 : 1)
      if ((!obstructed && bestObstructed) || (obstructed === bestObstructed && cost < bestCost)) {
        bestCost = cost
        bestObstructed = obstructed
        targetRing = ring
      }
    }

    if (!keepCurrent || targetRing !== previous) environment.setActiveRing(targetRing?.id)
  }

  function getSnapshot(outcome) {
    const terrains = Object.entries(rings.reduce((counts, ring) => {
      const terrain = counts[ring.terrain] ??= { passed: 0, total: 0 }
      terrain.total++
      if (ringSystem.hasPassed(ring.id)) terrain.passed++
      return counts
    }, {}))
      .map(([type, counts]) => ({ type, ...counts }))
      .filter(({ total }) => total > 0)

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
    refreshTarget(position, forward, elapsed) {
      if (elapsed < nextRecommendation) return
      nextRecommendation = elapsed + 2
      recommendRing(position, forward, true)
    },
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
    update(airplanePosition, forward, speed) {
      const bonus = speedBonus(speed)
      const newlyPassed = ringSystem.update(airplanePosition, (id) => {
        environment.markRingPassed(id)
        return BASE_RING_POINTS + bonus
      })
      if (newlyPassed === 0) return null

      award = {
        points: (BASE_RING_POINTS + bonus) * newlyPassed,
        bonus: bonus * newlyPassed,
      }
      recommendRing(airplanePosition, forward)
      return getSnapshot()
    },
    reset() {
      nextRecommendation = 0
      environment.reset()
      rings = environment.getRingData()
      ringSystem.setRings(rings)
      ringSystem.reset()
      targetRing = null
      award = null
    },
  }
}
