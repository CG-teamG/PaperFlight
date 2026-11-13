export const LANDING_MAX_SPEED = 25
const AIRPLANE_CLEARANCE = 1.2

export function isOutsideSurveyArea(position, mapSize) {
  return Math.max(Math.abs(position.x), Math.abs(position.z)) >= mapSize * 0.6
}

export function getFlightContact(environment, previous, current, speed) {
  const dx = current.x - previous.x
  const dy = current.y - previous.y
  const dz = current.z - previous.z
  const { position: pad, radius } = environment.landingPad
  const landingHeight = pad.y + AIRPLANE_CLEARANCE

  if (dy < 0 && previous.y >= landingHeight && current.y <= landingHeight) {
    const t = (landingHeight - previous.y) / dy
    const x = previous.x + dx * t
    const z = previous.z + dz * t
    if (Math.hypot(x - pad.x, z - pad.z) <= radius - 3) {
      const gentleDescent = -dy <= Math.hypot(dx, dz) * 0.55
      const reason = speed > LANDING_MAX_SPEED ? 'speed' : !gentleDescent ? 'angle' : null
      return {
        outcome: reason ? 'recovered' : 'landed',
        reason,
        position: { x, y: landingHeight, z },
      }
    }
  }

  const insidePad = Math.hypot(current.x - pad.x, current.z - pad.z) <= radius
  if (insidePad && current.y <= landingHeight) {
    return { outcome: 'recovered', reason: 'pad-edge', position: current }
  }

  if (current.y <= environment.getGroundHeight(current.x, current.z) + AIRPLANE_CLEARANCE) {
    return { outcome: 'recovered', reason: 'terrain', position: current }
  }
  return null
}
