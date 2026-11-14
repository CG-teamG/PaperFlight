export const EMERGENCY_LANDING_RADIUS = 100
const AIRPLANE_CLEARANCE = 1.2

export function getLandingArrival(pad, previous, current) {
  const x = previous.x - pad.x
  const z = previous.z - pad.z
  const dx = current.x - previous.x
  const dz = current.z - previous.z
  const c = x * x + z * z - EMERGENCY_LANDING_RADIUS ** 2
  if (c <= 0) return 0

  const a = dx * dx + dz * dz
  const b = x * dx + z * dz
  const discriminant = b * b - a * c
  if (a === 0 || discriminant < 0) return null

  const entry = (-b - Math.sqrt(discriminant)) / a
  return entry >= 0 && entry <= 1 ? entry : null
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
