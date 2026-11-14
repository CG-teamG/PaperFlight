export const EMERGENCY_LANDING_RADIUS = 100
const AIRPLANE_CLEARANCE = 1.2

export function getLandingPoint(pad, previous, current) {
  const dx = current.x - previous.x
  const dz = current.z - previous.z
  const lengthSquared = dx * dx + dz * dz
  const t = lengthSquared ? Math.max(0, Math.min(1, ((pad.x - previous.x) * dx + (pad.z - previous.z) * dz) / lengthSquared)) : 0
  if (Math.hypot(previous.x + dx * t - pad.x, previous.z + dz * t - pad.z) > EMERGENCY_LANDING_RADIUS) return null
  return { x: pad.x, y: pad.y + AIRPLANE_CLEARANCE, z: pad.z }
}

export function isOutsideSurveyArea(position, mapSize) {
  return Math.max(Math.abs(position.x), Math.abs(position.z)) >= mapSize * 0.6
}

export function getFlightContact(environment, current) {
  const ground = environment.getGroundHeight(current.x, current.z)
  if (current.y <= ground + AIRPLANE_CLEARANCE) {
    return { reason: ground > 0 ? 'terrain' : 'water', position: current }
  }
  return null
}
