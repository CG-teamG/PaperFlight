const MAX_PATH_POINTS = 512

export function createFlightPath(startPosition) {
  const previousPosition = startPosition.clone()
  let distance = 0
  let path = [{ x: startPosition.x, z: startPosition.z }]

  function addPoint(point) {
    if (path.length === MAX_PATH_POINTS) {
      // 점을 줄일 때도 복귀로 끊긴 경로를 하나의 선으로 이어 붙이지 않는다.
      path = path.flatMap((sample, index) => {
        if (index % 2 !== 0 && index !== path.length - 1) return []
        const skippedBreak = index % 2 === 0 && path[index - 1]?.breakBefore
        return [{ ...sample, breakBefore: sample.breakBefore || skippedBreak }]
      })
    }
    path.push(point)
  }

  function samplePosition() {
    const { x, z } = previousPosition
    const last = path.at(-1)
    if (x !== last.x || z !== last.z) addPoint({ x, z })
  }

  return {
    update(position) {
      distance += previousPosition.distanceTo(position)
      previousPosition.copy(position)
    },
    resumeAt(position) {
      samplePosition()
      previousPosition.copy(position)
      addPoint({ x: position.x, z: position.z, breakBefore: true })
    },
    getSnapshot() {
      samplePosition()
      return { distance, path: path.slice() }
    },
  }
}
