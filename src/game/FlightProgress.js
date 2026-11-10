import { RingSystem } from './RingSystem.js'

export const EMPTY_FLIGHT_PROGRESS = Object.freeze({
  score: 0,
  passedRings: 0,
  totalRings: 0,
  exploration: 0,
  completedTerrains: 0,
  totalTerrains: 0,
})

export function createFlightProgress(environment) {
  let rings = environment.getRingData()
  const ringSystem = new RingSystem(rings)

  function getSnapshot() {
    const terrains = Object.values(environment.getTerrainProgress())
      .filter(({ total }) => total > 0)

    return {
      score: ringSystem.getScore(),
      passedRings: ringSystem.getPassedCount(),
      totalRings: rings.length,
      exploration: Math.round(environment.getExplorationRate() * 100),
      completedTerrains: terrains.filter(({ passed, total }) => passed === total).length,
      totalTerrains: terrains.length,
    }
  }

  return {
    getSnapshot,
    // 매 프레임 월드 좌표를 전달하고, 기록이 바뀔 때만 UI에 반영한다.
    update(airplanePosition) {
      const newlyPassed = ringSystem.update(airplanePosition, (id) => {
        environment.markRingPassed(id)
      })
      return newlyPassed > 0 ? getSnapshot() : null
    },
    reset() {
      environment.reset()
      rings = environment.getRingData()
      ringSystem.setRings(rings)
      ringSystem.reset()
      return getSnapshot()
    },
  }
}
